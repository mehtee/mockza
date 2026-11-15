import 'package:dio/dio.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/data/repositories/exam_catalog_repository.dart';
import 'package:mockza/data/repositories/vocab_repository.dart';
import 'package:mockza/services/auth_session_service.dart';
import 'package:mockza/services/crash_log.dart';

/// Synchronizes exam catalog, bundles, micro-drills, and SM-2 vocabulary cards
/// from PostgreSQL / SeaweedFS API routes into local SQLite / IndexedDB storage.
final class ContentSyncService {
  /// Creates a [ContentSyncService].
  new({
    required this._dio,
    required this._catalogRepository,
    required this._vocabRepository,
    required this._authSession,
    required this._editionConfig,
    required this._crashLog,
  });

  final Dio _dio;
  final ExamCatalogRepository _catalogRepository;
  final VocabRepository _vocabRepository;
  final AuthSessionService _authSession;
  final EditionConfig _editionConfig;
  final CrashLog _crashLog;

  Future<Result<int, Failure>>? _inflightSync;

  /// Pulls catalog manifest, drills, vocab deck, and starter exam bundles into SQLite.
  /// Idempotent and coalesced so duplicate mounts trigger one network sync batch.
  Future<Result<int, Failure>> syncAllCatalogData({
    bool forceRefresh = false,
  }) async {
    final inflight = _inflightSync;
    if (inflight != null && !forceRefresh) {
      return await inflight;
    }

    final future = _runFullSync();
    _inflightSync = future;
    try {
      return await future;
    } finally {
      if (identical(_inflightSync, future)) {
        _inflightSync = null;
      }
    }
  }

  Future<Result<int, Failure>> _runFullSync() async {
    await _authSession.ensureAuthenticated();
    var syncedCount = 0;

    try {
      // 1. Catalog manifest
      final manifestRes = await _dio.get<Map<String, Object?>>(
        '/v1/catalog/manifest',
      );
      final rawPacks =
          (manifestRes.data?['packs'] as List<dynamic>?)
              ?.whereType<Map<String, Object?>>()
              .toList(growable: false) ??
          const <Map<String, Object?>>[];
      if (rawPacks.isNotEmpty) {
        await _catalogRepository.saveCatalogManifestPacks(rawPacks);
        syncedCount += rawPacks.length;
      }

      // 2. Micro-drills catalog
      final drillsRes = await _dio.get<Map<String, Object?>>('/v1/drills');
      final rawDrills =
          (drillsRes.data?['drills'] as List<dynamic>?)
              ?.whereType<Map<String, Object?>>()
              .toList(growable: false) ??
          const <Map<String, Object?>>[];
      if (rawDrills.isNotEmpty) {
        await _catalogRepository.saveSyncedDrills(rawDrills);
        syncedCount += rawDrills.length;
      }

      // 3. Shared Vocabulary deck (preserves existing learner SRS state)
      final vocabRes = await _dio.get<Map<String, Object?>>('/v1/vocab/deck');
      final rawCards =
          (vocabRes.data?['cards'] as List<dynamic>?)
              ?.whereType<Map<String, Object?>>()
              .toList(growable: false) ??
          const <Map<String, Object?>>[];
      if (rawCards.isNotEmpty) {
        await _vocabRepository.insertSyncedDeckCards(rawCards);
        syncedCount += rawCards.length;
      }

      // 4. Prefetch starter/free sample bundles so offline & diagnostic flows work immediately.
      for (final p in rawPacks) {
        final isFree = p['isFreeSample'] as bool? ?? false;
        final packId = p['packId'] as String?;
        if (isFree && packId != null && packId.isNotEmpty) {
          final existing = await _catalogRepository.getCachedExamBundle(packId);
          if (existing == null) {
            await downloadExamPack(packId);
          }
        }
      }

      return Ok(syncedCount);
    } on DioException catch (e) {
      _crashLog.info('Catalog sync skipped/offline: ${e.message}');
      return Err(
        NetworkFailure(
          'Unable to sync catalog: ${e.message ?? 'offline'}',
          statusCode: e.response?.statusCode,
        ),
      );
    } on Object catch (e, st) {
      _crashLog.recordError(e, st);
      return Err(UnexpectedFailure('Catalog sync failed: $e'));
    }
  }

  /// Downloads an exam bundle from `GET /v1/exams/:packId` and persists it in SQLite.
  Future<Result<Map<String, dynamic>, Failure>> downloadExamPack(
    String packId,
  ) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/v1/exams/$packId',
      );
      final data = response.data;
      if (data == null) {
        return const Err(ValidationFailure('Empty exam bundle response'));
      }
      final pack = (data['pack'] as Map<String, dynamic>?) ?? const {};
      await _catalogRepository.saveExamPayload(
        packId: packId,
        bundle: data,
      );

      // Warm SeaweedFS binary media (SVG chart / Listening audio) opportunistically.
      final mediaUrls = <String>{
        if (pack['mediaUrl'] is String &&
            (pack['mediaUrl'] as String).isNotEmpty)
          pack['mediaUrl'] as String,
        for (final s in (data['sections'] as List<dynamic>? ?? const []))
          if (s is Map &&
              s['mediaUrl'] is String &&
              (s['mediaUrl'] as String).isNotEmpty)
            s['mediaUrl'] as String,
      };
      for (final url in mediaUrls) {
        try {
          await _dio.get<List<int>>(
            _editionConfig.resolveMediaUrl(url),
            options: Options(responseType: ResponseType.bytes),
          );
        } on Object {
          // Non-fatal if media warm-up fails offline.
        }
      }
      return Ok(data);
    } on DioException catch (e) {
      return Err(
        NetworkFailure(
          'Failed to download exam $packId: ${e.message ?? 'offline'}',
          statusCode: e.response?.statusCode,
        ),
      );
    } on Object catch (e) {
      return Err(UnexpectedFailure('Unable to cache exam $packId: $e'));
    }
  }

  /// Ensures [packId] JSON bundle is available locally, fetching from backend if missing.
  Future<Result<Map<String, dynamic>, Failure>> ensureExamBundle(
    String packId,
  ) async {
    final cached = await _catalogRepository.getCachedExamBundle(packId);
    if (cached != null) {
      return Ok(cached);
    }
    return await downloadExamPack(packId);
  }
}

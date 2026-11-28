import 'dart:convert';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/data/repositories/exam_catalog_repository.dart';
import 'package:mockza/data/repositories/vocab_repository.dart';
import 'package:mockza/services/auth_session_service.dart';
import 'package:mockza/services/crash_log.dart';
import 'package:mockza/services/media_bytes_platform.dart';

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

      return Ok(syncedCount);
    } on DioException catch (e) {
      _crashLog.info('Catalog sync skipped/offline: ${e.message}');
      return Err(
        NetworkFailure(
          _friendlyDioError(e, context: 'Catalog sync'),
          statusCode: e.response?.statusCode,
        ),
      );
    } on Object catch (e, st) {
      _crashLog.recordError(e, st);
      return Err(UnexpectedFailure('Catalog sync failed: $e'));
    }
  }

  /// Downloads an exam bundle from `GET /v1/exams/:packId`, verifies its canonical
  /// SHA-256 digest and required media assets, and persists it for offline use (`TD-32`).
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
      final pack =
          (data['pack'] as Map<String, dynamic>?) ?? const <String, dynamic>{};
      final declaredSha = (pack['sha256'] as String?)?.trim() ?? '';
      if (!RegExp(r'^[a-f0-9]{64}$').hasMatch(declaredSha)) {
        return Err(
          ValidationFailure(
            'Exam bundle $packId is missing a valid SHA-256 integrity digest.',
          ),
        );
      }
      final computedSha = computeCanonicalBundleSha256(
        sections: data['sections'],
        questions: data['questions'],
      );
      if (computedSha != declaredSha) {
        return Err(
          ValidationFailure(
            'Exam bundle $packId failed SHA-256 integrity verification.',
          ),
        );
      }

      // Download & persist required media (SVG charts inline + Listening audio bytes)
      // BEFORE marking the pack cached offline (`TD-32`, `UX-04`).
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

      final cachedMediaInline = <String, String>{};
      final cachedMediaPaths = <String, String>{};
      final skill = (pack['skill'] as String?) ?? '';

      for (final url in mediaUrls) {
        try {
          final mediaRes = await _dio.get<List<int>>(
            _editionConfig.resolveMediaUrl(url),
            options: Options(responseType: ResponseType.bytes),
          );
          final rawBytes = mediaRes.data;
          if (rawBytes == null || rawBytes.isEmpty) {
            return Err(
              NetworkFailure(
                'Required media asset ($url) for $packId is empty',
              ),
            );
          }
          final bytes = Uint8List.fromList(rawBytes);
          final lowerUrl = url.toLowerCase();
          if (lowerUrl.endsWith('.svg')) {
            final svgText = utf8.decode(bytes, allowMalformed: true).trim();
            if (!svgText.contains('<svg')) {
              return Err(
                ValidationFailure('Invalid SVG chart asset ($url) for $packId'),
              );
            }
            cachedMediaInline[url] = svgText;
          } else {
            final maybeSvgPrefix = utf8
                .decode(
                  bytes.sublist(0, bytes.length < 64 ? bytes.length : 64),
                  allowMalformed: true,
                )
                .trimLeft();
            if (maybeSvgPrefix.startsWith('<svg') ||
                maybeSvgPrefix.startsWith('<?xml')) {
              cachedMediaInline[url] = utf8.decode(bytes, allowMalformed: true);
            } else {
              final mediaKey = '${packId}_${url.hashCode.toRadixString(16)}';
              final localRef = await persistCachedMediaBytes(bytes, mediaKey);
              if (localRef.isNotEmpty) {
                cachedMediaPaths[url] = localRef;
              } else {
                return Err(
                  StorageFailure(
                    'Failed to persist required $skill media asset for $packId',
                  ),
                );
              }
            }
          }
        } on DioException catch (e) {
          return Err(
            NetworkFailure(
              _friendlyDioError(e, context: 'Media download for "$packId"'),
              statusCode: e.response?.statusCode,
            ),
          );
        }
      }

      final bundleToPersist = <String, dynamic>{
        ...data,
        if (cachedMediaInline.isNotEmpty)
          'cachedMediaInline': cachedMediaInline,
        if (cachedMediaPaths.isNotEmpty) 'cachedMediaPaths': cachedMediaPaths,
      };
      await _catalogRepository.saveExamPayload(
        packId: packId,
        bundle: bundleToPersist,
      );
      return Ok(bundleToPersist);
    } on DioException catch (e) {
      return Err(
        NetworkFailure(
          _friendlyDioError(e, context: 'Exam pack "$packId"'),
          statusCode: e.response?.statusCode,
        ),
      );
    } on Object catch (e) {
      return Err(UnexpectedFailure('Unable to cache exam $packId: $e'));
    }
  }

  static String _friendlyDioError(DioException e, {required String context}) {
    final code = e.response?.statusCode;
    if (code == 404) {
      return '$context is not available on the server (404).';
    }
    if (code == 429) {
      return 'Too many requests. Please wait a few seconds and try again.';
    }
    if (code == 401 || code == 403) {
      return 'Session expired. Please refresh or sign in again.';
    }
    if (code != null && code >= 500) {
      return 'Server temporarily unavailable ($code). Please try again shortly.';
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return 'Connection timed out while loading $context. Please retry.';
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'Unable to reach the server. Check your internet connection.';
    }
    return '$context could not be loaded (${code != null ? 'HTTP $code' : 'offline'}).';
  }

  /// Ensures [packId] JSON bundle is available locally and matches latest manifest version/hash.
  Future<Result<Map<String, dynamic>, Failure>> ensureExamBundle(
    String packId,
  ) async {
    final cached = await _catalogRepository.getCachedExamBundle(packId);
    if (cached != null) {
      final manifestPack = await _catalogRepository.getInstalledPackById(
        packId,
      );
      final cachedPack = cached['pack'];
      final cachedVersion = cachedPack is Map ? cachedPack['version'] : null;
      final cachedSha = cachedPack is Map ? cachedPack['sha256'] : null;
      final isStale =
          manifestPack != null &&
          ((cachedVersion != null && manifestPack.version != cachedVersion) ||
              (manifestPack.sha256.isNotEmpty &&
                  cachedSha is String &&
                  cachedSha.isNotEmpty &&
                  manifestPack.sha256 != cachedSha));
      if (!isStale) {
        return Ok(cached);
      }
      final refreshed = await downloadExamPack(packId);
      if (refreshed.isSuccess) return refreshed;
      return Ok(cached);
    }
    return await downloadExamPack(packId);
  }

  /// Computes deterministic sorted-key SHA-256 over `{'questions': ..., 'sections': ...}` matching backend `@mockza/domain`.
  static String computeCanonicalBundleSha256({
    required Object? sections,
    required Object? questions,
  }) {
    final encoded = _stableJsonEncode(<String, Object?>{
      'questions': questions ?? const <Object?>[],
      'sections': sections ?? const <Object?>[],
    });
    return sha256.convert(utf8.encode(encoded)).toString();
  }

  static String _stableJsonEncode(Object? value) {
    if (value == null) {
      return 'null';
    }
    if (value is List) {
      return '[${value.map(_stableJsonEncode).join(',')}]';
    }
    if (value is Map) {
      final keys = value.keys.map((k) => k.toString()).toList()..sort();
      final parts = <String>[];
      for (final k in keys) {
        parts.add('${jsonEncode(k)}:${_stableJsonEncode(value[k])}');
      }
      return '{${parts.join(',')}}';
    }
    return jsonEncode(value);
  }
}

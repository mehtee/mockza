import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/data/repositories/exam_catalog_repository.dart';
import 'package:mockza/services/media_bytes_platform.dart';

/// Manages offline cached pack cleanup & local speaking clip eviction.
final class CacheCleanupService {
  /// Creates a [CacheCleanupService].
  const new({
    required this._catalogRepository,
    required this._attemptRepository,
  });

  final ExamCatalogRepository _catalogRepository;
  final AttemptRepository _attemptRepository;

  /// Clears downloaded exam bundles (`ExamPayloads`) and deletes all expired
  /// speaking audio clips from local disk / browser blob cache.
  Future<void> clearDownloadedCaches() async {
    await _catalogRepository.clearOfflineCache();
    final expired = await _attemptRepository.findExpiredAudioRecordings(
      retention: Duration.zero,
    );
    for (final rec in expired) {
      await deleteRecordedAudioClip(rec.localFilePath);
      await _attemptRepository.deleteAudioRecordingRow(rec.recordingId);
    }
  }
}

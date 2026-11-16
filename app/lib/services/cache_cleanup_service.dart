import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/data/repositories/exam_catalog_repository.dart';
import 'package:mockza/services/media_bytes_platform.dart';

/// Manages offline cached pack cleanup without destroying pending learner recordings.
final class CacheCleanupService {
  /// Creates a [CacheCleanupService].
  const new({
    required this._catalogRepository,
    required this._attemptRepository,
  });

  final ExamCatalogRepository _catalogRepository;
  final AttemptRepository _attemptRepository;

  /// Clears downloaded exam bundles (`ExamPayloads`) and removes only expired,
  /// already-completed speaking audio clips (`TD-40` protects pending work).
  Future<void> clearDownloadedCaches() async {
    await _catalogRepository.clearOfflineCache();
    final expiredCompleted = await _attemptRepository
        .findExpiredAudioRecordings();
    for (final rec in expiredCompleted) {
      await deleteRecordedAudioClip(rec.localFilePath);
      await _attemptRepository.deleteAudioRecordingRow(rec.recordingId);
    }
  }

  /// Unconditionally erases ALL cached packs and ALL local recorded/media audio bytes (`RR-05`).
  Future<bool> eraseAllLocalMediaForAccountWipe() async {
    await _catalogRepository.clearOfflineCache();
    return await clearAllCachedMediaAndClips();
  }
}

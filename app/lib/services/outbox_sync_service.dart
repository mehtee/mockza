import 'dart:convert';

import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/writing_evaluation.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/services/auth_session_service.dart';
import 'package:mockza/services/crash_log.dart';
import 'package:mockza/services/grading_gateway.dart';
import 'package:mockza/services/media_bytes_platform.dart';

/// Processes offline-queued uploads/evaluations and enforces 7-day audio retention.
final class OutboxSyncService {
  /// Creates an [OutboxSyncService].
  new({
    required this._attemptRepository,
    required this._gradingGateway,
    required this._authSession,
    required this._crashLog,
  });

  final AttemptRepository _attemptRepository;
  final GradingGateway _gradingGateway;
  final AuthSessionService _authSession;
  final CrashLog _crashLog;

  bool _isFlushing = false;

  /// Flushes ready items in `OutboxSyncQueue` and purges expired local audio files.
  Future<int> processPendingQueue({int batchSize = 10}) async {
    if (_isFlushing) return 0;
    _isFlushing = true;
    var processed = 0;

    try {
      await purgeExpiredAudio();
      final readyItems = await _attemptRepository.fetchReadyOutboxItems(
        limit: batchSize,
      );
      if (readyItems.isEmpty) return 0;

      await _authSession.ensureAuthenticated();

      for (final item in readyItems) {
        final ok = await _dispatchItem(
          id: item.id,
          actionType: item.actionType,
          payloadJson: item.payloadJson,
          retryCount: item.retryCount,
        );
        if (ok) processed++;
      }
      return processed;
    } on Object catch (e, st) {
      _crashLog.recordError(e, st);
      return processed;
    } finally {
      _isFlushing = false;
    }
  }

  Future<bool> _dispatchItem({
    required int id,
    required String actionType,
    required String payloadJson,
    required int retryCount,
  }) async {
    try {
      final payload = jsonDecode(payloadJson) as Map<String, Object?>;
      switch (actionType) {
        case 'submit_writing':
        case 'evaluate_writing':
          return await _handleWritingEvaluation(
            id: id,
            payload: payload,
            retryCount: retryCount,
          );
        case 'submit_speaking':
        case 'evaluate_speaking':
          return await _handleSpeakingEvaluation(
            id: id,
            payload: payload,
            retryCount: retryCount,
          );
        case 'flag_question':
          final flagRes = await _gradingGateway.flagQuestion(
            packId: payload['packId'] as String? ?? '',
            questionId: payload['questionId'] as String? ?? '',
            reason: payload['reason'] as String? ?? 'User flagged issue',
            note: payload['note'] as String?,
          );
          if (flagRes.isOk) {
            await _attemptRepository.deleteOutboxItem(id);
            return true;
          }
          await _attemptRepository.scheduleOutboxRetry(
            id: id,
            currentRetryCount: retryCount,
          );
          return false;
        default:
          await _attemptRepository.deleteOutboxItem(id);
          return false;
      }
    } on Object catch (e) {
      _crashLog.info('Invalid outbox payload $id: $e');
      await _attemptRepository.deleteOutboxItem(id);
      return false;
    }
  }

  Future<bool> _handleWritingEvaluation({
    required int id,
    required Map<String, Object?> payload,
    required int retryCount,
  }) async {
    final attemptId = payload['attemptId'] as String? ?? '';
    final packId = payload['packId'] as String? ?? '';
    final taskTypeName = payload['taskType'] as String? ?? 'task2Essay';
    final taskType = WritingTaskType.values.firstWhere(
      (t) => t.name == taskTypeName,
      orElse: () => WritingTaskType.task2Essay,
    );

    final enqueueRes = await _gradingGateway.enqueueWritingEvaluation(
      attemptId: attemptId,
      packId: packId,
      examId: payload['examId'] as String? ?? 'ielts_academic',
      taskType: taskType,
      promptTitle: payload['promptTitle'] as String? ?? '',
      promptBody: payload['promptBody'] as String? ?? '',
      essayText: payload['essayText'] as String? ?? '',
      durationSeconds: (payload['durationSeconds'] as num?)?.toInt(),
      wordCount: (payload['wordCount'] as num?)?.toInt(),
    );

    return await _completeAttemptDispatch(
      outboxId: id,
      attemptId: attemptId,
      retryCount: retryCount,
      enqueueResult: enqueueRes,
      originalSubmission: payload,
    );
  }

  Future<bool> _handleSpeakingEvaluation({
    required int id,
    required Map<String, Object?> payload,
    required int retryCount,
  }) async {
    final attemptId = payload['attemptId'] as String? ?? '';
    final packId = payload['packId'] as String? ?? '';
    final rawTurns = (payload['turns'] as List<dynamic>?) ?? const [];

    final uploadedTurns =
        <
          ({
            int partIndex,
            String promptText,
            String objectKey,
            int? durationMs,
          })
        >[];

    for (final rawTurn in rawTurns.whereType<Map<String, Object?>>()) {
      final partIndex = (rawTurn['partIndex'] as num?)?.toInt() ?? 2;
      final promptText = rawTurn['promptText'] as String? ?? '';
      final localPath = rawTurn['localFilePath'] as String? ?? '';
      final durationMs = (rawTurn['durationMs'] as num?)?.toInt();
      final contentType = rawTurn['contentType'] as String? ?? 'audio/mp4';

      var objectKey = rawTurn['objectKey'] as String?;
      if (objectKey == null || objectKey.isEmpty) {
        final bytes = await readRecordedAudioBytes(localPath);
        if (bytes == null || bytes.isEmpty) {
          await _attemptRepository.updateAttemptEvaluation(
            attemptId: attemptId,
            status: AttemptStatus.failedRetryable,
            errorCode: 'AUDIO_UNAVAILABLE',
          );
          await _attemptRepository.deleteOutboxItem(id);
          return false;
        }
        final presignRes = await _gradingGateway.presignAudioUpload(
          attemptId: attemptId,
          partIndex: partIndex,
          byteLength: bytes.length,
          contentType: contentType,
        );
        if (presignRes
            case Err<({String uploadUrl, String objectKey}), Failure>(
              :final failure,
            )) {
          return await _handleDispatchFailure(
            outboxId: id,
            attemptId: attemptId,
            retryCount: retryCount,
            failure: failure,
          );
        }
        final presign =
            (presignRes as Ok<({String uploadUrl, String objectKey}), Failure>)
                .value;
        final putRes = await _gradingGateway.uploadAudioBytes(
          uploadUrl: presign.uploadUrl,
          bytes: bytes,
          contentType: contentType,
        );
        if (putRes case Err<void, Failure>(:final failure)) {
          return await _handleDispatchFailure(
            outboxId: id,
            attemptId: attemptId,
            retryCount: retryCount,
            failure: failure,
          );
        }
        objectKey = presign.objectKey;
      }

      uploadedTurns.add((
        partIndex: partIndex,
        promptText: promptText,
        objectKey: objectKey,
        durationMs: durationMs,
      ));
    }

    if (uploadedTurns.isEmpty) {
      await _attemptRepository.updateAttemptEvaluation(
        attemptId: attemptId,
        status: AttemptStatus.failedRetryable,
        errorCode: 'NO_CLIPS_ATTACHED',
      );
      await _attemptRepository.deleteOutboxItem(id);
      return false;
    }

    final enqueueRes = await _gradingGateway.enqueueSpeakingEvaluation(
      attemptId: attemptId,
      packId: packId,
      examId: payload['examId'] as String? ?? 'ielts_academic',
      partSequence: payload['partSequence'] as String? ?? 'full',
      audioObjectKey: uploadedTurns.first.objectKey,
      partIndex: uploadedTurns.first.partIndex,
      turns: uploadedTurns,
    );

    return await _completeAttemptDispatch(
      outboxId: id,
      attemptId: attemptId,
      retryCount: retryCount,
      enqueueResult: enqueueRes,
      originalSubmission: payload,
    );
  }

  Future<bool> _completeAttemptDispatch({
    required int outboxId,
    required String attemptId,
    required int retryCount,
    required Result<String, Failure> enqueueResult,
    required Map<String, Object?> originalSubmission,
  }) async {
    switch (enqueueResult) {
      case Ok<String, Failure>(:final value):
        await _attemptRepository.updateAttemptEvaluation(
          attemptId: attemptId,
          status: AttemptStatus.queuedRemote,
          remoteJobId: value,
        );
        await _attemptRepository.deleteOutboxItem(outboxId);
        return true;
      case Err<String, Failure>(:final failure):
        return await _handleDispatchFailure(
          outboxId: outboxId,
          attemptId: attemptId,
          retryCount: retryCount,
          failure: failure,
        );
    }
  }

  Future<bool> _handleDispatchFailure({
    required int outboxId,
    required String attemptId,
    required int retryCount,
    required Failure failure,
  }) async {
    if (failure is QuotaExceededFailure ||
        failure is UnauthorizedFailure ||
        failure is ValidationFailure ||
        retryCount >= 6) {
      await _attemptRepository.updateAttemptEvaluation(
        attemptId: attemptId,
        status: AttemptStatus.failedRetryable,
        errorCode: failure.message,
      );
      await _attemptRepository.deleteOutboxItem(outboxId);
      return false;
    }
    await _attemptRepository.scheduleOutboxRetry(
      id: outboxId,
      currentRetryCount: retryCount,
    );
    return false;
  }

  /// Purges local audio recordings whose 7-day retention deadline has elapsed.
  Future<int> purgeExpiredAudio() async {
    final expired = await _attemptRepository.findExpiredAudioRecordings();
    var removed = 0;
    for (final rec in expired) {
      await deleteRecordedAudioClip(rec.localFilePath);
      await _attemptRepository.deleteAudioRecordingRow(rec.recordingId);
      removed++;
    }
    return removed;
  }
}

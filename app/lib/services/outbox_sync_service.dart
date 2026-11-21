import 'dart:async';
import 'dart:convert';

import 'package:clock/clock.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/writing_evaluation.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/data/repositories/linguistic_repository.dart';
import 'package:mockza/services/auth_session_service.dart';
import 'package:mockza/services/crash_log.dart';
import 'package:mockza/services/grading_gateway.dart';
import 'package:mockza/services/linguistic_gateway.dart';
import 'package:mockza/services/media_bytes_platform.dart';

/// Processes offline-queued uploads/evaluations with foreground scheduling,
/// full-batch draining, per-turn upload checkpointing, and pending-media protection.
final class OutboxSyncService {
  /// Creates an [OutboxSyncService].
  new({
    required this._attemptRepository,
    required this._gradingGateway,
    required this._authSession,
    required this._crashLog,
    this._linguisticGateway,
    this._linguisticRepository,
    this.clock = const Clock(),
  });

  final AttemptRepository _attemptRepository;
  final GradingGateway _gradingGateway;
  final AuthSessionService _authSession;
  final CrashLog _crashLog;
  final LinguisticGateway? _linguisticGateway;
  final LinguisticRepository? _linguisticRepository;

  /// Wall clock used for scheduling retry timers.
  final Clock clock;

  bool _isFlushing = false;
  bool _isDisposed = false;
  Timer? _nextDrainTimer;

  /// Releases pending foreground retry timers.
  void dispose() {
    _isDisposed = true;
    _nextDrainTimer?.cancel();
    _nextDrainTimer = null;
  }

  /// Triggers an immediate non-blocking drain after a new outbox entry is queued.
  void notifyWorkEnqueued() {
    if (_isDisposed) return;
    unawaited(processPendingQueue());
  }

  /// Drains ready items in `OutboxSyncQueue` across batches (up to [maxPerPass])
  /// and schedules a bounded timer for the earliest upcoming retry if any remain.
  Future<int> processPendingQueue({
    int batchSize = 10,
    int maxPerPass = 50,
  }) async {
    if (_isFlushing || _isDisposed) return 0;
    _isFlushing = true;
    _nextDrainTimer?.cancel();
    var processed = 0;

    try {
      await purgeExpiredAudio();

      while (!_isDisposed && processed < maxPerPass) {
        final remainingBudget = maxPerPass - processed;
        final fetchLimit = batchSize < remainingBudget
            ? batchSize
            : remainingBudget;
        final readyItems = await _attemptRepository.fetchReadyOutboxItems(
          limit: fetchLimit,
        );
        if (readyItems.isEmpty) break;

        await _authSession.ensureAuthenticated();

        var attemptedInBatch = 0;
        for (final item in readyItems) {
          attemptedInBatch++;
          final ok = await _dispatchItem(
            id: item.id,
            actionType: item.actionType,
            payloadJson: item.payloadJson,
            retryCount: item.retryCount,
          );
          if (ok) {
            processed++;
          }
        }
        // If no items succeeded or the batch was smaller than fetchLimit, exit loop
        // so failing items wait for their scheduled exponential backoff.
        if (readyItems.length < fetchLimit || attemptedInBatch == 0) {
          break;
        }
      }
      return processed;
    } on Object catch (e, st) {
      _crashLog.recordError(e, st);
      return processed;
    } finally {
      _isFlushing = false;
      if (!_isDisposed) {
        unawaited(_scheduleNextDrain());
      }
    }
  }

  Future<void> _scheduleNextDrain() async {
    if (_isDisposed) return;
    try {
      final nextAt = await _attemptRepository.nextOutboxAttemptTime();
      if (_isDisposed || nextAt == null) return;
      final delay = nextAt.difference(clock.now().toUtc());
      final boundedDelay = delay.isNegative
          ? const Duration(seconds: 2)
          : delay > const Duration(minutes: 15)
          ? const Duration(minutes: 15)
          : delay;
      _nextDrainTimer?.cancel();
      _nextDrainTimer = Timer(boundedDelay, () {
        if (!_isDisposed) {
          unawaited(processPendingQueue());
        }
      });
    } on Object {
      // Ignore scheduling failures when DB is already closed in tests.
    }
  }

  Future<bool> _dispatchItem({
    required int id,
    required String actionType,
    required String payloadJson,
    required int retryCount,
  }) async {
    final Map<String, Object?> payload;
    try {
      final decoded = jsonDecode(payloadJson);
      if (decoded is! Map<String, Object?>) {
        throw const FormatException(
          'Outbox payload root must be a JSON object',
        );
      }
      payload = decoded;
    } on FormatException catch (e) {
      _crashLog.info('Corrupt outbox JSON $id quarantined: $e');
      await _attemptRepository.deleteOutboxItem(id);
      return false;
    }

    try {
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
        case 'mission.complete':
          final ling = _linguisticGateway;
          if (ling == null) {
            await _attemptRepository.deleteOutboxItem(id);
            return false;
          }
          final missionId = payload['missionId'] as String? ?? '';
          final responseText = payload['responseText'] as String? ?? '';
          if (missionId.isEmpty || responseText.isEmpty) {
            await _attemptRepository.deleteOutboxItem(id);
            return false;
          }
          final missionRes = await ling.completeMission(
            missionId: missionId,
            responseText: responseText,
          );
          if (missionRes.valueOrNull case final updated?) {
            await _linguisticRepository?.cacheDailyMission(updated);
            await _attemptRepository.deleteOutboxItem(id);
            return true;
          }
          await _attemptRepository.scheduleOutboxRetry(
            id: id,
            currentRetryCount: retryCount,
          );
          return false;
        case 'graph.update_interests':
          final ling = _linguisticGateway;
          if (ling == null) {
            await _attemptRepository.deleteOutboxItem(id);
            return false;
          }
          final pinTopics =
              ((payload['pinTopics'] as List<Object?>?) ?? const <Object?>[])
                  .map((e) => '$e')
                  .where((e) => e.trim().isNotEmpty)
                  .toList(growable: false);
          final muteTopics =
              ((payload['muteTopics'] as List<Object?>?) ?? const <Object?>[])
                  .map((e) => '$e')
                  .where((e) => e.trim().isNotEmpty)
                  .toList(growable: false);
          final edition = payload['edition'] as String? ?? 'glb';
          final graphRes = await ling.updateInterests(
            pinTopics: pinTopics,
            muteTopics: muteTopics,
          );
          if (graphRes.valueOrNull case final snapshot?) {
            await _linguisticRepository?.cacheGraphSnapshot(
              snapshot,
              edition: edition,
            );
            await _attemptRepository.deleteOutboxItem(id);
            return true;
          }
          await _attemptRepository.scheduleOutboxRetry(
            id: id,
            currentRetryCount: retryCount,
          );
          return false;
        case 'drop.drill_complete':
          final dropId = payload['dropId'] as String? ?? '';
          if (dropId.isNotEmpty) {
            await _linguisticRepository?.markDropCompleted(dropId);
          }
          await _attemptRepository.deleteOutboxItem(id);
          return true;
        default:
          await _attemptRepository.deleteOutboxItem(id);
          return false;
      }
    } on Object catch (e, st) {
      // Never silently drop valid queued learner work on unexpected execution errors.
      _crashLog.recordError(e, st);
      await _attemptRepository.scheduleOutboxRetry(
        id: id,
        currentRetryCount: retryCount,
      );
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
    final turnMaps = rawTurns.whereType<Map<String, Object?>>().toList();

    if (turnMaps.isEmpty) {
      await _attemptRepository.updateAttemptEvaluation(
        attemptId: attemptId,
        status: AttemptStatus.failedRetryable,
        errorCode: 'NO_CLIPS_ATTACHED',
      );
      await _attemptRepository.deleteOutboxItem(id);
      return false;
    }

    final uploadedTurns =
        <
          ({
            int partIndex,
            String promptText,
            String objectKey,
            int? durationMs,
          })
        >[];

    var checkpointDirty = false;

    for (var i = 0; i < turnMaps.length; i++) {
      final rawTurn = turnMaps[i];
      final partIndex = (rawTurn['partIndex'] as num?)?.toInt() ?? 2;
      final turnId =
          rawTurn['turnId'] as String? ??
          rawTurn['promptId'] as String? ??
          't$i';
      final recordingId = rawTurn['recordingId'] as String?;
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
          turnId: turnId,
          byteLength: bytes.length,
          contentType: contentType,
        );
        if (presignRes
            case Err<({String uploadUrl, String objectKey}), Failure>(
              :final failure,
            )) {
          if (checkpointDirty) {
            await _attemptRepository.updateOutboxPayload(
              id: id,
              payloadJson: jsonEncode({...payload, 'turns': turnMaps}),
            );
          }
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
          if (checkpointDirty) {
            await _attemptRepository.updateOutboxPayload(
              id: id,
              payloadJson: jsonEncode({...payload, 'turns': turnMaps}),
            );
          }
          return await _handleDispatchFailure(
            outboxId: id,
            attemptId: attemptId,
            retryCount: retryCount,
            failure: failure,
          );
        }
        objectKey = presign.objectKey;
        rawTurn['objectKey'] = objectKey;
        checkpointDirty = true;

        if (recordingId != null && recordingId.isNotEmpty) {
          await _attemptRepository.updateAudioRecordingRemoteKey(
            recordingId: recordingId,
            remoteObjectKey: objectKey,
          );
        }
      }

      uploadedTurns.add((
        partIndex: partIndex,
        promptText: promptText,
        objectKey: objectKey,
        durationMs: durationMs,
      ));
    }

    if (checkpointDirty) {
      await _attemptRepository.updateOutboxPayload(
        id: id,
        payloadJson: jsonEncode({...payload, 'turns': turnMaps}),
      );
    }

    // Never submit a partial multi-turn session (`TD-19`).
    if (uploadedTurns.length < turnMaps.length) {
      await _attemptRepository.scheduleOutboxRetry(
        id: id,
        currentRetryCount: retryCount,
      );
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
    );
  }

  Future<bool> _completeAttemptDispatch({
    required int outboxId,
    required String attemptId,
    required int retryCount,
    required Result<String, Failure> enqueueResult,
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
        failure is EntitlementRequiredFailure ||
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

  /// Purges local audio recordings whose 7-day retention deadline has elapsed
  /// and whose parent attempts are no longer pending/retryable.
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

import 'dart:convert';

import 'package:clock/clock.dart';
import 'package:drift/drift.dart';
import 'package:meta/meta.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/data/db/app_database.dart';

/// Immutable domain projection of a local exam/practice attempt.
@immutable
class AttemptSummary {
  /// Creates an [AttemptSummary].
  const new({
    required this.attemptId,
    required this.packId,
    required this.skill,
    required this.status,
    required this.overallBand,
    required this.updatedAt,
    this.examId = 'ielts_academic',
    this.durationSeconds = 0,
    this.usedStudyMode = false,
    this.startedAtUtcMs,
    this.completedAtUtcMs,
  });

  /// Client-assigned attempt UUID.
  final String attemptId;

  /// Content pack identifier.
  final String packId;

  /// IELTS skill tested.
  final SkillKind skill;

  /// Offline/sync lifecycle status.
  final AttemptStatus status;

  /// Final band if scored, otherwise `null`.
  final double? overallBand;

  /// Last update timestamp in UTC.
  final DateTime updatedAt;

  /// Exam track identifier.
  final String examId;

  /// Time spent active in seconds.
  final int durationSeconds;

  /// Whether completed in untimed study mode.
  final bool usedStudyMode;

  /// Original start timestamp in UTC milliseconds, if recorded.
  final int? startedAtUtcMs;

  /// Immutable completion/submission timestamp in UTC milliseconds (`BF-12`, `TD-35`).
  final int? completedAtUtcMs;

  /// Best available immutable completion timestamp for analytics ordering & 30-day deltas.
  int get effectiveCompletedAtUtcMs =>
      completedAtUtcMs ?? startedAtUtcMs ?? updatedAt.millisecondsSinceEpoch;
}

/// In-progress essay draft auto-saved every 500ms.
@immutable
class InProgressWritingDraft {
  /// Creates an [InProgressWritingDraft].
  const new({
    required this.attemptId,
    required this.packId,
    required this.taskType,
    required this.draftText,
    required this.wordCount,
    required this.timerRemainingSec,
    required this.updatedAtUtcMs,
  });

  /// Attempt identifier.
  final String attemptId;

  /// Pack identifier.
  final String packId;

  /// Task type.
  final String taskType;

  /// Student draft text.
  final String draftText;

  /// Word count.
  final int wordCount;

  /// Timer remaining in seconds.
  final int timerRemainingSec;

  /// UTC millisecond timestamp.
  final int updatedAtUtcMs;
}

/// Learner text highlight or marginal note in a reading passage.
@immutable
class ReadingAnnotationItem {
  /// Creates a [ReadingAnnotationItem].
  const new({
    required this.annotationId,
    required this.packId,
    required this.passageIndex,
    required this.startOffset,
    required this.endOffset,
    required this.colorCode,
    this.noteText,
  });

  /// Unique annotation ID.
  final String annotationId;

  /// Owning pack ID.
  final String packId;

  /// Passage index (0..2).
  final int passageIndex;

  /// Start offset.
  final int startOffset;

  /// End offset.
  final int endOffset;

  /// Highlight color.
  final String colorCode;

  /// Optional attached note.
  final String? noteText;
}

/// Repository owning offline attempt creation, status updates, history queries, and draft autosave.
final class AttemptRepository {
  /// Creates an [AttemptRepository].
  const new({
    required this._db,
    required this._clock,
  });

  final AppDatabase _db;
  final Clock _clock;

  /// Streams recent attempts ordered newest-first.
  Stream<List<AttemptSummary>> watchRecentAttempts({int limit = 20}) => _db
      .attemptDao
      .watchRecent(limit: limit)
      .map(
        (rows) => rows
            .map(
              (row) => AttemptSummary(
                attemptId: row.attemptId,
                packId: row.packId,
                skill: SkillKind.values.byName(row.skill),
                status: AttemptStatus.values.byName(row.status),
                overallBand: row.overallBand,
                updatedAt: row.updatedAt,
                examId: row.examId,
                durationSeconds: row.durationSeconds,
                usedStudyMode: row.usedStudyMode,
                startedAtUtcMs: row.startedAtUtcMs,
                completedAtUtcMs: row.completedAtUtcMs,
              ),
            )
            .toList(growable: false),
      );

  /// Keyset-cursor paginated query for full history browsing with composite `(updatedAt, attemptId)` cursor (`TD-47`).
  Future<List<AttemptSummary>> fetchHistoryPage({
    DateTime? cursorUpdatedAt,
    String? cursorAttemptId,
    int limit = 20,
    SkillKind? filterSkill,
  }) async {
    final rows = await _db.attemptDao.fetchHistoryPage(
      cursorUpdatedAt: cursorUpdatedAt,
      cursorAttemptId: cursorAttemptId,
      limit: limit,
      filterSkill: filterSkill?.name,
    );
    return rows
        .map(
          (row) => AttemptSummary(
            attemptId: row.attemptId,
            packId: row.packId,
            skill: SkillKind.values.byName(row.skill),
            status: AttemptStatus.values.byName(row.status),
            overallBand: row.overallBand,
            updatedAt: row.updatedAt,
            examId: row.examId,
            durationSeconds: row.durationSeconds,
            usedStudyMode: row.usedStudyMode,
            startedAtUtcMs: row.startedAtUtcMs,
            completedAtUtcMs: row.completedAtUtcMs,
          ),
        )
        .toList(growable: false);
  }

  /// Saves an initial local submission before optional remote AI grading.
  Future<void> saveLocalSubmission({
    required String attemptId,
    required String packId,
    required SkillKind skill,
    required String submissionJson,
    double? overallBand,
    AttemptStatus status = AttemptStatus.submittedLocal,
    String examId = 'ielts_academic',
    int? startedAtUtcMs,
    int? completedAtUtcMs,
    int durationSeconds = 0,
    bool usedStudyMode = false,
  }) {
    final now = _clock.now().toUtc();
    return _db.attemptDao.upsertAttempt(
      ExamAttemptsCompanion.insert(
        attemptId: attemptId,
        packId: packId,
        skill: skill.name,
        status: status.name,
        submissionJson: submissionJson,
        overallBand: Value(overallBand),
        examId: Value(examId),
        startedAtUtcMs: Value(startedAtUtcMs),
        completedAtUtcMs: Value(completedAtUtcMs),
        durationSeconds: Value(durationSeconds),
        usedStudyMode: Value(usedStudyMode),
        createdAt: now,
        updatedAt: now,
      ),
    );
  }

  // --- Writing 500ms Draft Autosave ---

  /// Auto-saves an in-progress writing draft to protect student work.
  Future<void> saveWritingDraft({
    required String attemptId,
    required String packId,
    required String taskType,
    required String draftText,
    required int wordCount,
    required int timerRemainingSec,
  }) async {
    final existingAttempt = await _db.attemptDao.getAttemptById(attemptId);
    if (existingAttempt == null) {
      await saveLocalSubmission(
        attemptId: attemptId,
        packId: packId,
        skill: SkillKind.writing,
        submissionJson: '{}',
        status: AttemptStatus.inProgress,
      );
    }
    final nowMs = _clock.now().toUtc().millisecondsSinceEpoch;
    await _db.attemptDao.upsertWritingDraft(
      WritingDraftsCompanion.insert(
        attemptId: attemptId,
        packId: packId,
        taskType: taskType,
        draftText: draftText,
        wordCount: Value(wordCount),
        timerRemainingSec: Value(timerRemainingSec),
        updatedAtUtcMs: nowMs,
      ),
    );
  }

  /// Retrieves an existing draft for [attemptId] or null if fresh session.
  Future<InProgressWritingDraft?> getWritingDraft(String attemptId) async {
    final row = await _db.attemptDao.getWritingDraft(attemptId);
    if (row == null) return null;
    return InProgressWritingDraft(
      attemptId: row.attemptId,
      packId: row.packId,
      taskType: row.taskType,
      draftText: row.draftText,
      wordCount: row.wordCount,
      timerRemainingSec: row.timerRemainingSec,
      updatedAtUtcMs: row.updatedAtUtcMs,
    );
  }

  /// Fetches a single attempt record by [attemptId], including evaluation JSON.
  Future<ExamAttemptRow?> getAttemptRow(String attemptId) =>
      _db.attemptDao.getAttemptById(attemptId);

  /// Updates an existing attempt with remote job ID, scored JSON, or error status.
  Future<void> updateAttemptEvaluation({
    required String attemptId,
    required AttemptStatus status,
    String? remoteJobId,
    String? evaluationJson,
    double? overallBand,
    String? errorCode,
  }) => _db.attemptDao.updateAttemptStatus(
    attemptId: attemptId,
    status: status.name,
    updatedAt: _clock.now().toUtc(),
    remoteJobId: remoteJobId,
    evaluationJson: evaluationJson,
    overallBand: overallBand,
    errorCode: errorCode,
  );

  /// Records a speaking audio clip chunk locally prior to S3 upload.
  Future<void> saveAudioRecording({
    required String recordingId,
    required String attemptId,
    required int partIndex,
    required String localFilePath,
    required int durationMs,
    String? remoteObjectKey,
  }) {
    final now = _clock.now().toUtc();
    return _db.attemptDao.upsertAudioRecording(
      AudioRecordingsCompanion.insert(
        recordingId: recordingId,
        attemptId: attemptId,
        partIndex: partIndex,
        localFilePath: localFilePath,
        durationMs: durationMs,
        remoteObjectKey: Value(remoteObjectKey),
        createdAt: now,
        updatedAt: now,
      ),
    );
  }

  /// Fetches saved audio recordings for [attemptId].
  Future<List<AudioRecordingRow>> getRecordingsForAttempt(String attemptId) =>
      _db.attemptDao.getRecordingsForAttempt(attemptId);

  /// Atomically persists a new attempt, optional child audio recordings, optional draft cleanup,
  /// and an initial `OutboxSyncQueue` item inside a single SQLite transaction before network I/O.
  Future<int?> saveDurableSubmissionWithOutbox({
    required String attemptId,
    required String packId,
    required SkillKind skill,
    required String submissionJson,
    required String actionType,
    required String outboxPayloadJson,
    String examId = 'ielts_academic',
    int? startedAtUtcMs,
    int durationSeconds = 0,
    bool usedStudyMode = false,
    String? deleteDraftId,
    List<
      ({
        String recordingId,
        int partIndex,
        String localFilePath,
        int durationMs,
        String? remoteObjectKey,
      })
    >
    recordings = const [],
  }) {
    final now = _clock.now().toUtc();
    return _db.transaction(() async {
      await _db.attemptDao.upsertAttempt(
        ExamAttemptsCompanion.insert(
          attemptId: attemptId,
          packId: packId,
          skill: skill.name,
          status: AttemptStatus.submittedLocal.name,
          submissionJson: submissionJson,
          examId: Value(examId),
          startedAtUtcMs: Value(startedAtUtcMs),
          durationSeconds: Value(durationSeconds),
          usedStudyMode: Value(usedStudyMode),
          createdAt: now,
          updatedAt: now,
        ),
      );

      for (final rec in recordings) {
        await _db.attemptDao.upsertAudioRecording(
          AudioRecordingsCompanion.insert(
            recordingId: rec.recordingId,
            attemptId: attemptId,
            partIndex: rec.partIndex,
            localFilePath: rec.localFilePath,
            durationMs: rec.durationMs,
            remoteObjectKey: Value(rec.remoteObjectKey),
            createdAt: now,
            updatedAt: now,
          ),
        );
      }

      if (deleteDraftId != null && deleteDraftId.isNotEmpty) {
        await _db.attemptDao.deleteWritingDraft(deleteDraftId);
      }

      return await _db.attemptDao.enqueueOutbox(
        OutboxSyncQueueCompanion.insert(
          actionType: actionType,
          payloadJson: outboxPayloadJson,
          nextAttemptAt: now,
          createdAt: now,
          updatedAt: now,
        ),
      );
    });
  }

  /// Persists checkpointed [payloadJson] into an existing outbox item [id].
  Future<int> updateOutboxPayload({
    required int id,
    required String payloadJson,
  }) => _db.attemptDao.updateOutboxPayload(
    id: id,
    payloadJson: payloadJson,
    updatedAt: _clock.now().toUtc(),
  );

  /// Updates [remoteObjectKey] on an existing local audio recording row.
  Future<int> updateAudioRecordingRemoteKey({
    required String recordingId,
    required String remoteObjectKey,
  }) => _db.attemptDao.updateAudioRemoteKey(
    recordingId: recordingId,
    remoteObjectKey: remoteObjectKey,
    updatedAt: _clock.now().toUtc(),
  );

  /// Returns earliest scheduled retry timestamp across pending outbox items, or null.
  Future<DateTime?> nextOutboxAttemptTime() =>
      _db.attemptDao.nextOutboxAttemptTime();

  /// Counts total pending items in `OutboxSyncQueue`.
  Future<int> countOutboxItems() => _db.attemptDao.countOutboxItems();

  /// Enqueues an offline sync action (upload/evaluate/feedback) into `OutboxSyncQueue`.
  Future<int> enqueueOutboxAction({
    required String actionType,
    required String payloadJson,
  }) {
    final now = _clock.now().toUtc();
    return _db.attemptDao.enqueueOutbox(
      OutboxSyncQueueCompanion.insert(
        actionType: actionType,
        payloadJson: payloadJson,
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      ),
    );
  }

  /// Fetches ready outbox actions scheduled on or before now.
  Future<List<OutboxSyncItemRow>> fetchReadyOutboxItems({int limit = 10}) =>
      _db.attemptDao.fetchReadyOutboxItems(_clock.now().toUtc(), limit: limit);

  /// Schedules an exponential backoff retry for outbox item [id].
  Future<void> scheduleOutboxRetry({
    required int id,
    required int currentRetryCount,
  }) {
    final now = _clock.now().toUtc();
    final backoffSeconds = 10 * (1 << currentRetryCount.clamp(0, 6));
    return _db.attemptDao.incrementOutboxRetry(
      id: id,
      nextRetryCount: currentRetryCount + 1,
      nextAttemptAt: now.add(Duration(seconds: backoffSeconds)),
      updatedAt: now,
    );
  }

  /// Deletes a completed outbox queue item.
  Future<int> deleteOutboxItem(int id) => _db.attemptDao.deleteOutboxItem(id);

  /// Lists expired local audio recordings older than [retention] for cleanup.
  Future<List<AudioRecordingRow>> findExpiredAudioRecordings({
    Duration retention = const Duration(days: 7),
  }) {
    final cutoff = _clock.now().toUtc().subtract(retention);
    return _db.attemptDao.getExpiredRecordings(cutoff);
  }

  /// Removes an audio recording metadata row after deleting local audio bytes.
  Future<int> deleteAudioRecordingRow(String recordingId) =>
      _db.attemptDao.deleteAudioRecording(recordingId);

  /// Deletes a draft when test is submitted or deliberately discarded,
  /// removing any synthetic `inProgress` placeholder parent attempt row (`TD-39`).
  Future<int> deleteWritingDraft(String attemptId) =>
      _db.transaction(() async {
        final deleted = await _db.attemptDao.deleteWritingDraft(attemptId);
        final parent = await _db.attemptDao.getAttemptById(attemptId);
        if (parent != null && parent.status == AttemptStatus.inProgress.name) {
          await (_db.delete(
            _db.examAttempts,
          )..where((t) => t.attemptId.equals(attemptId))).go();
        }
        return deleted;
      });

  // --- Reading Annotations ---

  /// Streams active reading annotations for a specific reading pack.
  Stream<List<ReadingAnnotationItem>> watchAnnotationsForPack(String packId) =>
      _db.attemptDao
          .watchAnnotationsForPack(packId)
          .map(
            (rows) => rows
                .map(
                  (r) => ReadingAnnotationItem(
                    annotationId: r.annotationId,
                    packId: r.packId,
                    passageIndex: r.passageIndex,
                    startOffset: r.startOffset,
                    endOffset: r.endOffset,
                    colorCode: r.colorCode,
                    noteText: r.noteText,
                  ),
                )
                .toList(growable: false),
          );

  /// Saves or updates a highlight or marginal note.
  Future<void> saveReadingAnnotation({
    required String annotationId,
    required String packId,
    required int passageIndex,
    required int startOffset,
    required int endOffset,
    String colorCode = 'yellow',
    String? noteText,
  }) {
    final now = _clock.now().toUtc();
    return _db.attemptDao.upsertReadingAnnotation(
      ReadingAnnotationsCompanion.insert(
        annotationId: annotationId,
        packId: packId,
        passageIndex: Value(passageIndex),
        startOffset: startOffset,
        endOffset: endOffset,
        colorCode: Value(colorCode),
        noteText: Value(noteText),
        createdAt: now,
        updatedAt: now,
      ),
    );
  }

  /// Soft-deletes a reading annotation.
  Future<int> deleteReadingAnnotation(String annotationId) =>
      _db.attemptDao.softDeleteAnnotation(annotationId, _clock.now().toUtc());

  /// Exports local learner study data (profiles, attempts, study logs, vocab) as portable JSON (`TD-47`).
  Future<String> exportStudyDataJson() async {
    final profiles = await _db.select(_db.userProfiles).get();
    final attempts = await (_db.select(
      _db.examAttempts,
    )..orderBy([(t) => OrderingTerm.desc(t.updatedAt)])).get();
    final vocabCards = await _db.select(_db.vocabCards).get();
    final reviewLogs = await _db.select(_db.vocabReviewLogs).get();
    final studyLogs = await _db.select(_db.dailyStudyLogs).get();

    final payload = <String, Object?>{
      'schemaVersion': 1,
      'exportedAtUtc': _clock.now().toUtc().toIso8601String(),
      'profiles': profiles
          .map(
            (p) => <String, Object?>{
              'deviceId': p.deviceId,
              'examId': p.examId,
              'examModule': p.examModule,
              'targetBand': p.targetBand,
              'targetDateSerial': p.targetDateSerial,
              'onboardingCompleted': p.onboardingCompleted,
              'themeMode': p.themeMode,
            },
          )
          .toList(growable: false),
      'attempts': attempts
          .map(
            (a) => <String, Object?>{
              'attemptId': a.attemptId,
              'packId': a.packId,
              'examId': a.examId,
              'skill': a.skill,
              'status': a.status,
              'overallBand': a.overallBand,
              'durationSeconds': a.durationSeconds,
              'usedStudyMode': a.usedStudyMode,
              'startedAtUtcMs': a.startedAtUtcMs,
              'completedAtUtcMs': a.completedAtUtcMs,
              'submissionJson': a.submissionJson,
              'evaluationJson': a.evaluationJson,
              'updatedAt': a.updatedAt.toUtc().toIso8601String(),
            },
          )
          .toList(growable: false),
      'vocabCards': vocabCards
          .map(
            (v) => <String, Object?>{
              'cardId': v.cardId,
              'headword': v.headword,
              'definition': v.definition,
              'topicTag': v.topicTag,
              'repetitions': v.repetitions,
              'intervalDays': v.intervalDays,
              'easeFactorMilli': v.easeFactorMilli,
              'dueDay': v.dueDay,
              'sourceSkill': v.sourceSkill,
              'sourceAttemptId': v.sourceAttemptId,
            },
          )
          .toList(growable: false),
      'vocabReviewLogs': reviewLogs
          .map(
            (l) => <String, Object?>{
              'logId': l.logId,
              'cardId': l.cardId,
              'rating': l.rating,
              'reviewedDaySerial': l.reviewedDaySerial,
              'reviewedAtUtcMs': l.reviewedAtUtcMs,
            },
          )
          .toList(growable: false),
      'studyLogs': studyLogs
          .map(
            (s) => <String, Object?>{
              'serialDay': s.serialDay,
              'studySeconds': s.studySeconds,
              'completedItems': s.completedItems,
            },
          )
          .toList(growable: false),
    };
    return const JsonEncoder.withIndent('  ').convert(payload);
  }
}

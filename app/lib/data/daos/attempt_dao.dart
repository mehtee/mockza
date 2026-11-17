import 'package:drift/drift.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/data/db/tables/core_tables.dart';

part 'attempt_dao.g.dart';

/// Data access object for reading and persisting [ExamAttempts], [AudioRecordings], [WritingDrafts], [ReadingAnnotations], and [OutboxSyncQueue].
@DriftAccessor(
  tables: [
    ExamAttempts,
    AudioRecordings,
    WritingDrafts,
    ReadingAnnotations,
    OutboxSyncQueue,
    MockSessions,
    DiagnosticSessions,
  ],
)
class AttemptDao extends DatabaseAccessor<AppDatabase> with _$AttemptDaoMixin {
  /// Creates an [AttemptDao].
  new(super.attachedDatabase);

  /// Streams recent exam attempts ordered newest-first.
  Stream<List<ExamAttemptRow>> watchRecent({int limit = 20}) =>
      (select(examAttempts)
            ..orderBy([(t) => OrderingTerm.desc(t.updatedAt)])
            ..limit(limit))
          .watch();

  /// Fetches a keyset-cursor paginated slice of attempts with composite `(updatedAt, attemptId)` tie-breaking (`TD-47`).
  Future<List<ExamAttemptRow>> fetchHistoryPage({
    DateTime? cursorUpdatedAt,
    String? cursorAttemptId,
    int limit = 20,
    String? filterSkill,
  }) {
    final query = select(examAttempts);
    if (filterSkill != null) {
      query.where((t) => t.skill.equals(filterSkill));
    }
    if (cursorUpdatedAt != null) {
      if (cursorAttemptId != null && cursorAttemptId.isNotEmpty) {
        query.where(
          (t) =>
              t.updatedAt.isSmallerThanValue(cursorUpdatedAt) |
              (t.updatedAt.equals(cursorUpdatedAt) &
                  t.attemptId.isSmallerThanValue(cursorAttemptId)),
        );
      } else {
        query.where((t) => t.updatedAt.isSmallerThanValue(cursorUpdatedAt));
      }
    }
    query
      ..orderBy([
        (t) => OrderingTerm.desc(t.updatedAt),
        (t) => OrderingTerm.desc(t.attemptId),
      ])
      ..limit(limit);
    return query.get();
  }

  /// Inserts or replaces an [ExamAttempts] row by primary key.
  Future<void> upsertAttempt(ExamAttemptsCompanion companion) =>
      into(examAttempts).insertOnConflictUpdate(companion);

  /// Retrieves an attempt by its ID.
  Future<ExamAttemptRow?> getAttemptById(String attemptId) => (select(
    examAttempts,
  )..where((t) => t.attemptId.equals(attemptId))).getSingleOrNull();

  /// Returns the latest unfinished `inProgress` attempt matching [packId], [skill], and mode (`RR-07`).
  Future<ExamAttemptRow?> findLatestInProgressAttempt({
    required String packId,
    required String skill,
    required bool usedStudyMode,
    String? mockSessionId,
  }) =>
      (select(examAttempts)
            ..where(
              (t) =>
                  t.packId.equals(packId) &
                  t.skill.equals(skill) &
                  t.status.equals('inProgress') &
                  t.usedStudyMode.equals(usedStudyMode) &
                  (mockSessionId == null
                      ? t.mockSessionId.isNull()
                      : t.mockSessionId.equals(mockSessionId)),
            )
            ..orderBy([(t) => OrderingTerm.desc(t.updatedAt)])
            ..limit(1))
          .getSingleOrNull();

  /// Updates remote job status and optional score snapshot for [attemptId].
  Future<void> updateAttemptStatus({
    required String attemptId,
    required String status,
    required DateTime updatedAt,
    String? remoteJobId,
    String? evaluationJson,
    double? overallBand,
    String? errorCode,
  }) =>
      (update(examAttempts)..where((t) => t.attemptId.equals(attemptId))).write(
        ExamAttemptsCompanion(
          status: Value(status),
          remoteJobId: Value(remoteJobId),
          evaluationJson: Value(evaluationJson),
          overallBand: Value(overallBand),
          errorCode: Value(errorCode),
          updatedAt: Value(updatedAt),
        ),
      );

  // --- Writing Drafts Autosave (500ms) ---

  /// Inserts or updates an in-progress [WritingDrafts] row.
  Future<void> upsertWritingDraft(WritingDraftsCompanion draft) =>
      into(writingDrafts).insertOnConflictUpdate(draft);

  /// Retrieves the active draft text and remaining seconds for [attemptId].
  Future<WritingDraftRow?> getWritingDraft(String attemptId) => (select(
    writingDrafts,
  )..where((t) => t.attemptId.equals(attemptId))).getSingleOrNull();

  /// Discards a draft once an attempt is successfully submitted or cancelled.
  Future<int> deleteWritingDraft(String attemptId) =>
      (delete(writingDrafts)..where((t) => t.attemptId.equals(attemptId))).go();

  // --- Reading Annotations ---

  /// Streams active reading annotations for a specific content pack.
  Stream<List<ReadingAnnotationRow>> watchAnnotationsForPack(String packId) =>
      (select(readingAnnotations)
            ..where((t) => t.packId.equals(packId) & t.isDeleted.equals(false))
            ..orderBy([(t) => OrderingTerm.asc(t.startOffset)]))
          .watch();

  /// Saves or updates a highlight or marginal note.
  Future<void> upsertReadingAnnotation(
    ReadingAnnotationsCompanion annotation,
  ) => into(readingAnnotations).insertOnConflictUpdate(annotation);

  /// Soft-deletes a reading annotation.
  Future<int> softDeleteAnnotation(String annotationId, DateTime now) =>
      (update(
        readingAnnotations,
      )..where((t) => t.annotationId.equals(annotationId))).write(
        ReadingAnnotationsCompanion(
          isDeleted: const Value(true),
          updatedAt: Value(now),
        ),
      );

  // --- Audio Recordings ---

  /// Inserts or replaces an [AudioRecordings] chunk record.
  Future<void> upsertAudioRecording(AudioRecordingsCompanion recording) =>
      into(audioRecordings).insertOnConflictUpdate(recording);

  /// Fetches all audio recordings belonging to [attemptId].
  Future<List<AudioRecordingRow>> getRecordingsForAttempt(String attemptId) =>
      (select(audioRecordings)
            ..where((t) => t.attemptId.equals(attemptId))
            ..orderBy([(t) => OrderingTerm.asc(t.partIndex)]))
          .get();

  /// Lists expired completed audio recordings older than [cutoffUtc] while protecting pending/retryable attempts.
  Future<List<AudioRecordingRow>> getExpiredRecordings(
    DateTime cutoffUtc,
  ) async {
    final candidates = await (select(
      audioRecordings,
    )..where((t) => t.createdAt.isSmallerThanValue(cutoffUtc))).get();
    if (candidates.isEmpty) return const <AudioRecordingRow>[];

    final attemptIds = candidates.map((c) => c.attemptId).toSet().toList();
    final parents = await (select(
      examAttempts,
    )..where((t) => t.attemptId.isIn(attemptIds))).get();
    final statusByAttempt = <String, String>{
      for (final p in parents) p.attemptId: p.status,
    };

    const protectedStatuses = <String>{
      'inProgress',
      'submittedLocal',
      'queuedRemote',
      'failedRetryable',
    };

    return candidates
        .where((rec) {
          final status = statusByAttempt[rec.attemptId];
          // Protect if parent status is unknown or still pending upload/retry.
          if (status == null || protectedStatuses.contains(status)) {
            return false;
          }
          return true;
        })
        .toList(growable: false);
  }

  /// Updates [remoteObjectKey] on an existing audio recording checkpoint.
  Future<int> updateAudioRemoteKey({
    required String recordingId,
    required String remoteObjectKey,
    required DateTime updatedAt,
  }) =>
      (update(
        audioRecordings,
      )..where((t) => t.recordingId.equals(recordingId))).write(
        AudioRecordingsCompanion(
          remoteObjectKey: Value(remoteObjectKey),
          updatedAt: Value(updatedAt),
        ),
      );

  /// Deletes an expired or uploaded audio recording row.
  Future<int> deleteAudioRecording(String recordingId) => (delete(
    audioRecordings,
  )..where((t) => t.recordingId.equals(recordingId))).go();

  // --- Outbox Sync Queue ---

  /// Enqueues an offline upload/evaluation action into [OutboxSyncQueue].
  Future<int> enqueueOutbox(OutboxSyncQueueCompanion item) =>
      into(outboxSyncQueue).insert(item);

  /// Fetches queued actions ready to execute at or before [now].
  Future<List<OutboxSyncItemRow>> fetchReadyOutboxItems(
    DateTime now, {
    int limit = 10,
  }) =>
      (select(outboxSyncQueue)
            ..where((t) => t.nextAttemptAt.isSmallerOrEqualValue(now))
            ..orderBy([(t) => OrderingTerm.asc(t.id)])
            ..limit(limit))
          .get();

  /// Returns the earliest scheduled retry timestamp across pending outbox items, or null if empty.
  Future<DateTime?> nextOutboxAttemptTime() async {
    final row =
        await (select(outboxSyncQueue)
              ..orderBy([(t) => OrderingTerm.asc(t.nextAttemptAt)])
              ..limit(1))
            .getSingleOrNull();
    return row?.nextAttemptAt;
  }

  /// Counts total items currently in [OutboxSyncQueue].
  Future<int> countOutboxItems() async {
    final rows = await select(outboxSyncQueue).get();
    return rows.length;
  }

  /// Persists checkpointed payload updates (e.g. uploaded S3 keys) back into an outbox item.
  Future<int> updateOutboxPayload({
    required int id,
    required String payloadJson,
    required DateTime updatedAt,
  }) => (update(outboxSyncQueue)..where((t) => t.id.equals(id))).write(
    OutboxSyncQueueCompanion(
      payloadJson: Value(payloadJson),
      updatedAt: Value(updatedAt),
    ),
  );

  /// Updates retry counter and exponential backoff timestamp on transient failure.
  Future<void> incrementOutboxRetry({
    required int id,
    required int nextRetryCount,
    required DateTime nextAttemptAt,
    required DateTime updatedAt,
  }) => (update(outboxSyncQueue)..where((t) => t.id.equals(id))).write(
    OutboxSyncQueueCompanion(
      retryCount: Value(nextRetryCount),
      nextAttemptAt: Value(nextAttemptAt),
      updatedAt: Value(updatedAt),
    ),
  );

  /// Deletes a completed or permanently exhausted outbox queue entry.
  Future<int> deleteOutboxItem(int id) =>
      (delete(outboxSyncQueue)..where((t) => t.id.equals(id))).go();

  // --- Full Mock Sessions (RR-11) ---

  /// Retrieves a persisted Full Mock session row by [mockId].
  Future<MockSessionRow?> getMockSession(String mockId) => (select(
    mockSessions,
  )..where((t) => t.mockId.equals(mockId))).getSingleOrNull();

  /// Inserts or updates a Full Mock session row.
  Future<void> upsertMockSession(MockSessionsCompanion session) =>
      into(mockSessions).insertOnConflictUpdate(session);

  /// Deletes a Full Mock session row by [mockId].
  Future<int> deleteMockSession(String mockId) =>
      (delete(mockSessions)..where((t) => t.mockId.equals(mockId))).go();

  // --- Rapid Starting-Level Diagnostic Sessions ---

  /// Retrieves a persisted diagnostic session row by [diagId].
  Future<DiagnosticSessionRow?> getDiagnosticSession(String diagId) => (select(
    diagnosticSessions,
  )..where((t) => t.diagId.equals(diagId))).getSingleOrNull();

  /// Streams the most recently updated diagnostic session, if any.
  Stream<DiagnosticSessionRow?> watchLatestDiagnosticSession() =>
      (select(diagnosticSessions)
            ..orderBy([(t) => OrderingTerm.desc(t.updatedAt)])
            ..limit(1))
          .watchSingleOrNull();

  /// Inserts or updates a diagnostic session row.
  Future<void> upsertDiagnosticSession(
    DiagnosticSessionsCompanion session,
  ) => into(diagnosticSessions).insertOnConflictUpdate(session);
}

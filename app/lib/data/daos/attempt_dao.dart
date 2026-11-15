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

  /// Fetches a keyset-cursor paginated slice of attempts.
  Future<List<ExamAttemptRow>> fetchHistoryPage({
    DateTime? cursorUpdatedAt,
    int limit = 20,
    String? filterSkill,
  }) {
    final query = select(examAttempts);
    if (filterSkill != null) {
      query.where((t) => t.skill.equals(filterSkill));
    }
    if (cursorUpdatedAt != null) {
      query.where((t) => t.updatedAt.isSmallerThanValue(cursorUpdatedAt));
    }
    query
      ..orderBy([(t) => OrderingTerm.desc(t.updatedAt)])
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

  /// Lists recordings older than [cutoffUtc] eligible for retention cleanup.
  Future<List<AudioRecordingRow>> getExpiredRecordings(DateTime cutoffUtc) =>
      (select(
        audioRecordings,
      )..where((t) => t.createdAt.isSmallerThanValue(cutoffUtc))).get();

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
}

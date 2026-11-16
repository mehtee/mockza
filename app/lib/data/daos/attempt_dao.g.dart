// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'attempt_dao.dart';

// ignore_for_file: type=lint
mixin _$AttemptDaoMixin on DatabaseAccessor<AppDatabase> {
  $ExamAttemptsTable get examAttempts => attachedDatabase.examAttempts;
  $AudioRecordingsTable get audioRecordings => attachedDatabase.audioRecordings;
  $WritingDraftsTable get writingDrafts => attachedDatabase.writingDrafts;
  $ReadingAnnotationsTable get readingAnnotations =>
      attachedDatabase.readingAnnotations;
  $OutboxSyncQueueTable get outboxSyncQueue => attachedDatabase.outboxSyncQueue;
  $MockSessionsTable get mockSessions => attachedDatabase.mockSessions;
  AttemptDaoManager get managers => AttemptDaoManager(this);
}

class AttemptDaoManager {
  final _$AttemptDaoMixin _db;
  AttemptDaoManager(this._db);
  $$ExamAttemptsTableTableManager get examAttempts =>
      $$ExamAttemptsTableTableManager(_db.attachedDatabase, _db.examAttempts);
  $$AudioRecordingsTableTableManager get audioRecordings =>
      $$AudioRecordingsTableTableManager(
        _db.attachedDatabase,
        _db.audioRecordings,
      );
  $$WritingDraftsTableTableManager get writingDrafts =>
      $$WritingDraftsTableTableManager(_db.attachedDatabase, _db.writingDrafts);
  $$ReadingAnnotationsTableTableManager get readingAnnotations =>
      $$ReadingAnnotationsTableTableManager(
        _db.attachedDatabase,
        _db.readingAnnotations,
      );
  $$OutboxSyncQueueTableTableManager get outboxSyncQueue =>
      $$OutboxSyncQueueTableTableManager(
        _db.attachedDatabase,
        _db.outboxSyncQueue,
      );
  $$MockSessionsTableTableManager get mockSessions =>
      $$MockSessionsTableTableManager(_db.attachedDatabase, _db.mockSessions);
}

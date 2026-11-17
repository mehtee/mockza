import 'package:drift/drift.dart';
import 'package:mockza/data/daos/attempt_dao.dart';
import 'package:mockza/data/daos/catalog_dao.dart';
import 'package:mockza/data/daos/progress_dao.dart';
import 'package:mockza/data/daos/vocab_dao.dart';
import 'package:mockza/data/db/tables/core_tables.dart';

part 'app_database.g.dart';

/// Single SQLite database for Mockza offline packs, attempts, drafts, audio, and SRS cards.
@DriftDatabase(
  tables: [
    UserProfiles,
    ExamPacks,
    ExamPayloads,
    CachedDrills,
    ExamAttempts,
    AudioRecordings,
    WritingDrafts,
    ReadingAnnotations,
    VocabCards,
    VocabReviewLogs,
    DailyStudyLogs,
    OutboxSyncQueue,
    MockSessions,
    DiagnosticSessions,
  ],
  daos: [AttemptDao, VocabDao, CatalogDao, ProgressDao],
)
class AppDatabase extends _$AppDatabase {
  /// Constructs [AppDatabase] with an explicit [QueryExecutor] (file or in-memory).
  new(super.e);

  @override
  int get schemaVersion => 5;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) => m.createAll(),
    onUpgrade: (m, from, to) async {
      if (from < 2) {
        // New tables added in v2
        await m.createTable(writingDrafts);
        await m.createTable(readingAnnotations);
        await m.createTable(vocabReviewLogs);

        // Added columns in v2
        await m.addColumn(vocabCards, vocabCards.easeFactorMilli);
        await m.addColumn(vocabCards, vocabCards.dueDaySerial);
        await m.addColumn(vocabCards, vocabCards.contextSentence);
        await m.addColumn(vocabCards, vocabCards.paraphraseHintsJson);
        await m.addColumn(vocabCards, vocabCards.usageNote);
        await m.addColumn(vocabCards, vocabCards.sourceSkill);
        await m.addColumn(vocabCards, vocabCards.sourceAttemptId);
        await m.addColumn(vocabCards, vocabCards.sourceRefLabel);

        await m.addColumn(userProfiles, userProfiles.examId);
        await m.addColumn(userProfiles, userProfiles.targetDateSerial);
        await m.addColumn(userProfiles, userProfiles.onboardingCompleted);
        await m.addColumn(userProfiles, userProfiles.freeDiagnosticUsed);
        await m.addColumn(userProfiles, userProfiles.themeMode);
        await m.addColumn(userProfiles, userProfiles.linkedEmail);
        await m.addColumn(userProfiles, userProfiles.appUserId);

        await m.addColumn(examAttempts, examAttempts.examId);
        await m.addColumn(examAttempts, examAttempts.startedAtUtcMs);
        await m.addColumn(examAttempts, examAttempts.completedAtUtcMs);
        await m.addColumn(examAttempts, examAttempts.durationSeconds);
        await m.addColumn(examAttempts, examAttempts.usedStudyMode);
      }
      if (from < 3) {
        await m.addColumn(examPacks, examPacks.track);
        await m.addColumn(examPacks, examPacks.title);
        await m.addColumn(examPacks, examPacks.description);
        await m.addColumn(examPacks, examPacks.durationSeconds);
        await m.addColumn(examPacks, examPacks.questionCount);
        await m.addColumn(examPacks, examPacks.accent);
        await m.addColumn(examPacks, examPacks.mediaUrl);
        await m.createTable(examPayloads);
        await m.createTable(cachedDrills);
      }
      if (from < 4) {
        await m.addColumn(examAttempts, examAttempts.questionCount);
        await m.addColumn(examAttempts, examAttempts.isCalibratedFullPack);
        await m.addColumn(examAttempts, examAttempts.contentVersion);
        await m.addColumn(examAttempts, examAttempts.mockSessionId);
        await m.addColumn(examAttempts, examAttempts.mockStageKey);
        await m.createTable(mockSessions);
      }
      if (from < 5) {
        await m.createTable(diagnosticSessions);
      }
    },
    beforeOpen: (details) async {
      await customStatement('PRAGMA foreign_keys = ON;');
      await customStatement(
        'CREATE INDEX IF NOT EXISTS attempts_updated_idx ON exam_attempts (updated_at, attempt_id);',
      );
      await customStatement(
        'CREATE INDEX IF NOT EXISTS vocab_due_idx ON vocab_cards (due_day, repetitions);',
      );
    },
  );

  /// Atomically erases all user and cached content tables while respecting foreign keys.
  Future<void> wipeAllData() => transaction(() async {
    await delete(outboxSyncQueue).go();
    await delete(audioRecordings).go();
    await delete(writingDrafts).go();
    await delete(readingAnnotations).go();
    await delete(vocabReviewLogs).go();
    await delete(dailyStudyLogs).go();
    await delete(examAttempts).go();
    await delete(examPayloads).go();
    await delete(cachedDrills).go();
    await delete(examPacks).go();
    await delete(vocabCards).go();
    await delete(mockSessions).go();
    await delete(diagnosticSessions).go();
    await delete(userProfiles).go();
  });
}

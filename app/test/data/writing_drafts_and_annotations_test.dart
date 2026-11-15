import 'package:clock/clock.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/vocab/sm2_scheduler.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/data/repositories/profile_repository.dart';
import 'package:mockza/data/repositories/vocab_repository.dart';
import 'package:test/test.dart';

import '../support/fakes.dart';

void main() {
  late AppDatabase db;
  late Clock clock;
  late AttemptRepository attemptRepo;
  late VocabRepository vocabRepo;

  setUp(() {
    db = createTestDatabase();
    clock = fixedTestClock();
    attemptRepo = AttemptRepository(db: db, clock: clock);
    vocabRepo = VocabRepository(db: db, clock: clock);
  });

  tearDown(() async {
    await db.close();
  });

  group('Drift Tier 2 SQLite: WritingDrafts 500ms Autosave & ReadingAnnotations', () {
    test('autosaves writing draft, retrieves active draft, and deletes on submission', () async {
      const attemptId = 'attempt-writing-001';
      const packId = 'ielts-writing-pack-01';

      // First create parent attempt
      await attemptRepo.saveLocalSubmission(
        attemptId: attemptId,
        packId: packId,
        skill: SkillKind.writing,
        submissionJson: '{}',
        status: AttemptStatus.inProgress,
      );

      // Save draft text (simulating 500ms debounce cycle)
      await attemptRepo.saveWritingDraft(
        attemptId: attemptId,
        packId: packId,
        taskType: 'task2Essay',
        draftText: 'In recent decades, artificial intelligence has expanded...',
        wordCount: 8,
        timerRemainingSec: 2350,
      );

      final retrieved = await attemptRepo.getWritingDraft(attemptId);
      expect(retrieved, isNotNull);
      expect(retrieved!.attemptId, attemptId);
      expect(retrieved.taskType, 'task2Essay');
      expect(retrieved.wordCount, 8);
      expect(retrieved.timerRemainingSec, 2350);

      // Overwrite draft with more words
      await attemptRepo.saveWritingDraft(
        attemptId: attemptId,
        packId: packId,
        taskType: 'task2Essay',
        draftText: 'In recent decades, artificial intelligence has expanded exponentially across various industries.',
        wordCount: 11,
        timerRemainingSec: 2340,
      );

      final updated = await attemptRepo.getWritingDraft(attemptId);
      expect(updated!.wordCount, 11);
      expect(updated.timerRemainingSec, 2340);

      // Delete on submission
      final deleted = await attemptRepo.deleteWritingDraft(attemptId);
      expect(deleted, 1);
      final afterDelete = await attemptRepo.getWritingDraft(attemptId);
      expect(afterDelete, isNull);
    });

    test(
      'preserves reading annotations across passages and supports soft-delete',
      () async {
        const packId = 'ielts-reading-acad-01';

        await attemptRepo.saveReadingAnnotation(
          annotationId: 'anno-1',
          packId: packId,
          passageIndex: 0,
          startOffset: 120,
          endOffset: 155,
          noteText: 'Key evidence for question 3',
        );

        await attemptRepo.saveReadingAnnotation(
          annotationId: 'anno-2',
          packId: packId,
          passageIndex: 0,
          startOffset: 200,
          endOffset: 240,
          colorCode: 'green',
        );

        final annotations = await attemptRepo
            .watchAnnotationsForPack(packId)
            .first;
        expect(annotations, hasLength(2));
        expect(annotations[0].annotationId, 'anno-1');
        expect(annotations[0].noteText, 'Key evidence for question 3');
        expect(annotations[1].annotationId, 'anno-2');

        // Soft delete anno-1
        await attemptRepo.deleteReadingAnnotation('anno-1');

        final afterDelete = await attemptRepo
            .watchAnnotationsForPack(packId)
            .first;
        expect(afterDelete, hasLength(1));
        expect(afterDelete.single.annotationId, 'anno-2');
      },
    );

    test(
      'captures mistake to deck and logs review in VocabReviewLogs transaction',
      () async {
        await vocabRepo.captureMistakeToDeck(
          cardId: 'mistake-01',
          headword: 'ubiquitous computing',
          definition: 'Computing integrated seamlessly into everyday objects',
          topicTag: 'technology',
          sourceSkill: 'writing',
          sourceRefLabel: 'Task 2 Essay',
        );

        final dueCards = await vocabRepo.watchDueCards().first;
        expect(dueCards, hasLength(1));
        expect(dueCards.single.cardId, 'mistake-01');
        expect(dueCards.single.sourceSkill, 'writing');
        expect(dueCards.single.schedule.easeFactorMilli, 2500);

        // Review card with Good
        final nextState = await vocabRepo.recordReview(
          card: dueCards.single,
          quality: ReviewQuality.good,
        );
        expect(nextState.repetitions, 1);
        expect(nextState.intervalDays, 1);

        // Verify VocabReviewLogs entry was created
        final logs = await db.select(db.vocabReviewLogs).get();
        expect(logs, hasLength(1));
        expect(logs.single.cardId, 'mistake-01');
        expect(logs.single.rating, ReviewQuality.good.sm2Grade);
      },
    );

    test(
      'persists profile onboarding, themeMode, and standalone writing draft across reloads',
      () async {
        final profileRepo = ProfileRepository(db: db, clock: clock);
        final initial = await profileRepo.loadOrInitializePrimary(
          fallbackDeviceId: 'web-device-001',
        );
        expect(initial.deviceId, 'web-device-001');
        expect(initial.onboardingCompleted, isFalse);

        await profileRepo.saveTargetPreferences(
          deviceId: initial.deviceId,
          targetBand: 8,
          examModule: ExamModuleType.generalTraining,
          examId: 'ielts_general',
          targetDateSerial: 20500,
        );
        await profileRepo.completeOnboarding(initial.deviceId);
        await profileRepo.setThemeMode(initial.deviceId, 'dark');

        // Reload with a different fallbackDeviceId (simulating HTTP web reload)
        final reloaded = await profileRepo.loadOrInitializePrimary(
          fallbackDeviceId: 'web-device-002',
        );
        expect(reloaded.deviceId, 'web-device-001');
        expect(reloaded.targetBand, 8);
        expect(reloaded.examModule, ExamModuleType.generalTraining);
        expect(reloaded.examId, 'ielts_general');
        expect(reloaded.targetDateSerial, 20500);
        expect(reloaded.onboardingCompleted, isTrue);
        expect(reloaded.themeMode, 'dark');

        // Standalone saveWritingDraft auto-creates parent attempt
        await attemptRepo.saveWritingDraft(
          attemptId: 'att-writing-active',
          packId: 'writing-pack-01',
          taskType: 'task2Essay',
          draftText: 'Persistent draft across web reloads.',
          wordCount: 5,
          timerRemainingSec: 1800,
        );
        final draft = await attemptRepo.getWritingDraft('att-writing-active');
        expect(draft, isNotNull);
        expect(draft!.draftText, 'Persistent draft across web reloads.');
      },
    );
  });
}

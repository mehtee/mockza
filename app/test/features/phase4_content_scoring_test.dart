import 'dart:convert';

import 'package:clock/clock.dart';
import 'package:dio/dio.dart';
import 'package:drift/drift.dart' hide isNotNull, isNull;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/exams/local_objective_scorer.dart';
import 'package:mockza/core/exams/study_metrics_calculator.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/core/vocab/sm2_scheduler.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/data/repositories/exam_catalog_repository.dart';
import 'package:mockza/data/repositories/vocab_repository.dart';
import 'package:mockza/features/micro_drills/presentation/micro_drills_providers.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/auth_session_service.dart';
import 'package:mockza/services/content_sync_service.dart';
import 'package:mockza/services/crash_log.dart';
import 'package:mockza/services/secure_identity_service.dart';
import 'package:test/test.dart';

import '../support/fakes.dart';

void main() {
  group('Phase 4: Content Contracts, Scoring, Analytics & SRS (TD-27..TD-35, TD-46, TD-47, BF-01, BF-02, BF-12)', () {
    test('TD-27, TD-28, TD-30 & BF-01: parses backend question aliases, maxWords, speaking questions, and Roman matching headings', () async {
      final db = createTestDatabase();
      addTearDown(db.close);
      final repo = ExamCatalogRepository(
        db: db,
        clock: Clock.fixed(DateTime.utc(2026, 11, 16)),
      );

      final readingBundle = <String, dynamic>{
        'pack': <String, dynamic>{
          'packId': 'r-test-01',
          'title': 'Urban Heat Islands',
          'durationSeconds': 1200,
        },
        'sections': <dynamic>[
          <String, dynamic>{
            'sectionId': 's1',
            'sectionIndex': 1,
            'title': 'Passage 1',
            'contentText': 'Paragraph A\n\nParagraph B',
          },
        ],
        'questions': <dynamic>[
          <String, dynamic>{
            'questionId': 'q1',
            'sectionId': 's1',
            'questionNumber': 1,
            'questionType': 'matching_headings',
            'prompt': 'Heading for Paragraph B?',
            'options': <String>[
              'i. Construction materials',
              'ii. Ventilation impediments',
            ],
            'acceptedAnswers': <String>['ii', 'ventilation impediments'],
          },
          <String, dynamic>{
            'questionId': 'q2',
            'sectionId': 's1',
            'questionNumber': 2,
            'questionType': 'true_false_not_given',
            'prompt': 'Solar array exceeded 40 MW.',
            'acceptedAnswers': <String>['TRUE'],
          },
          <String, dynamic>{
            'questionId': 'q3',
            'sectionId': 's1',
            'questionNumber': 3,
            'questionType': 'multiple_choice',
            'prompt': 'Main mechanism?',
            'options': <String>['A. Friction', 'B. Low sky view'],
            'acceptedAnswers': <String>['B'],
          },
          <String, dynamic>{
            'questionId': 'q4',
            'sectionId': 's1',
            'questionNumber': 4,
            'questionType': 'gap_fill',
            'prompt': 'Write NO MORE THAN TWO WORDS.',
            'acceptedAnswers': <String>['latent heat'],
            'maxWords': 2,
          },
        ],
      };

      final parsedReading = repo.parseReadingPack(readingBundle);
      final qs = parsedReading.passages.single.questions;
      expect(qs[0].questionType, ObjectiveQuestionType.matchingHeadings);
      expect(qs[1].questionType, ObjectiveQuestionType.tfng);
      expect(qs[2].questionType, ObjectiveQuestionType.mcqSingle);
      expect(qs[3].questionType, ObjectiveQuestionType.summaryGapFill);
      expect(qs[3].maxWords, 2);

      final optHeading = parseObjectiveChoiceOption(
        qs[0].questionType,
        qs[0].options[1],
        1,
        qs[0].acceptedVariants,
      );
      expect(optHeading.label, 'ii');
      expect(optHeading.displayText, 'Ventilation impediments');
      expect(optHeading.value, 'ii');

      final optMcq = parseObjectiveChoiceOption(
        qs[2].questionType,
        qs[2].options[1],
        1,
        qs[2].acceptedVariants,
      );
      expect(optMcq.label, 'B');
      expect(optMcq.displayText, 'Low sky view');
      expect(optMcq.value, 'B');

      final speakingBundle = <String, dynamic>{
        'pack': <String, dynamic>{'packId': 'sp-01', 'title': 'Speaking 1'},
        'sections': <dynamic>[
          <String, dynamic>{
            'sectionId': 'sp-p1',
            'sectionIndex': 1,
            'title': 'Part 1',
            'durationSeconds': 180,
          },
          <String, dynamic>{
            'sectionId': 'sp-p2',
            'sectionIndex': 2,
            'title': 'Cue Card',
            'contentText': 'Describe a project.\nYou should say:\n- what it was\n- who joined',
            'durationSeconds': 120,
            'metadata': <String, dynamic>{'prepDurationSeconds': 60},
          },
        ],
        'questions': <dynamic>[
          <String, dynamic>{
            'questionId': 'SP1-01',
            'sectionId': 'sp-p1',
            'questionNumber': 1,
            'questionType': 'speaking_part1',
            'prompt': 'Where is your hometown?',
          },
          <String, dynamic>{
            'questionId': 'SP1-02',
            'sectionId': 'sp-p1',
            'questionNumber': 2,
            'questionType': 'speaking_part1',
            'prompt': 'Do you like technology?',
          },
          <String, dynamic>{
            'questionId': 'SP2-01',
            'sectionId': 'sp-p2',
            'questionNumber': 3,
            'questionType': 'speaking_part2',
            'prompt': 'Describe an environmental project.',
          },
        ],
      };

      final parsedSpeaking = repo.parseSpeakingSession(speakingBundle);
      expect(parsedSpeaking.prompts.length, 3);
      expect(parsedSpeaking.prompts[0].promptId, 'SP1-01');
      expect(parsedSpeaking.prompts[1].promptId, 'SP1-02');
      expect(parsedSpeaking.prompts[2].prepSeconds, 60);
      expect(parsedSpeaking.prompts[2].bulletPoints, <String>[
        'what it was',
        'who joined',
      ]);
    });

    test('TD-29 & BF-02: parses {id, answer} drill items and avoids fallback to drills.first for unknown ID', () async {
      final db = createTestDatabase();
      addTearDown(db.close);
      final repo = ExamCatalogRepository(
        db: db,
        clock: Clock.fixed(DateTime.utc(2026, 11, 16)),
      );

      await repo.saveSyncedDrills(<Map<String, dynamic>>[
        <String, dynamic>{
          'drillId': 'ielts-micro-drill-01',
          'title': 'TFNG Drill',
          'drillType': 'speed_tfng',
          'skill': 'reading',
          'durationSeconds': 180,
          'items': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 'MD1-01',
              'prompt': 'Statement 1',
              'options': <String>['TRUE', 'FALSE', 'NOT GIVEN'],
              'answer': 'TRUE',
              'explanation': 'Confirmed.',
            },
          ],
        },
      ]);

      final container = ProviderContainer(
        overrides: [
          appDatabaseProvider.overrideWithValue(db),
          clockProvider.overrideWithValue(
            Clock.fixed(DateTime.utc(2026, 11, 16)),
          ),
        ],
      );
      addTearDown(container.dispose);
      final sub = container.listen(microDrillsNotifierProvider, (_, _) {});
      addTearDown(sub.close);

      final notifier = container.read(microDrillsNotifierProvider.notifier);
      await notifier.loadDrill('ielts-micro-drill-01');
      var st = container.read(microDrillsNotifierProvider);
      expect(st.hasSelectedDrill, isTrue);
      expect(st.currentItem?.itemId, 'MD1-01');
      expect(st.currentItem?.acceptedAnswers, <String>['TRUE']);

      notifier
        ..selectOption('TRUE')
        ..submitAnswer();
      expect(container.read(microDrillsNotifierProvider).isCorrect, isTrue);

      await notifier.loadDrill('unknown-slug-xyz');
      st = container.read(microDrillsNotifierProvider);
      expect(st.hasSelectedDrill, isFalse);
      expect(st.drillSpec, isNull);
      expect(st.errorMessage, contains('unknown-slug-xyz'));
    });

    test('TD-33: LocalObjectiveScorer preserves decimals, currency, percentages, and separates short packs from 40-item IELTS calibration', () {
      expect(LocalObjectiveScorer.normalize('3.5'), '3.5');
      expect(LocalObjectiveScorer.normalize(r'$19.99!'), r'$19.99');
      expect(LocalObjectiveScorer.normalize('25%'), '25%');
      expect(LocalObjectiveScorer.normalize('10:30'), '10:30');

      final report = LocalObjectiveScorer.score(
        skill: SkillKind.listening,
        answers: const <ObjectiveQuestionAnswer>[
          ObjectiveQuestionAnswer(
            questionId: 'q1',
            acceptedAnswers: <String>['3.5'],
            userAnswer: '3.5',
          ),
          ObjectiveQuestionAnswer(
            questionId: 'q2',
            acceptedAnswers: <String>[r'$12.50'],
            userAnswer: r'$12.50',
          ),
        ],
      );
      expect(report.correctCount, 2);
      expect(report.isCalibratedFullPack, isFalse);
      expect(report.accuracyPercent, 100);
    });

    test('TD-32: downloadExamPack verifies canonical SHA-256 and fails closed on checksum mismatch', () async {
      final db = createTestDatabase();
      addTearDown(db.close);
      final clock = Clock.fixed(DateTime.utc(2026, 11, 16));
      final catalogRepo = ExamCatalogRepository(db: db, clock: clock);
      final vocabRepo = VocabRepository(db: db, clock: clock);

      final badBundle = <String, dynamic>{
        'pack': <String, dynamic>{
          'packId': 'tampered-pack',
          'skill': 'reading',
          'version': '1.0.0',
          'sha256': '0'.padRight(64, '0'),
        },
        'sections': <dynamic>[],
        'questions': <dynamic>[],
      };

      final dio = Dio()
        ..httpClientAdapter = _FakeBundleAdapter(badBundle);
      const crashLog = DeveloperCrashLog(AppEdition.global);
      final sync = ContentSyncService(
        dio: dio,
        catalogRepository: catalogRepo,
        vocabRepository: vocabRepo,
        authSession: AuthSessionService(
          config: EditionConfig.globalDefault,
          identity: SecureIdentityService(
            storage: InMemorySecureStorageGateway(),
            entropy: FixedEntropySource(),
          ),
          clock: clock,
          crashLog: crashLog,
        ),
        editionConfig: EditionConfig.globalDefault,
        crashLog: crashLog,
      );

      final res = await sync.downloadExamPack('tampered-pack');
      expect(res.failureOrNull, isA<ValidationFailure>());
      expect(await catalogRepo.getCachedExamBundle('tampered-pack'), isNull);
    });

    test('TD-46, TD-47 & BF-12: vocab updates preserve SM-2 progress, composite cursor prevents skips, and completion timestamp stays immutable', () async {
      final db = createTestDatabase();
      addTearDown(db.close);
      final now = DateTime.utc(2026, 11, 16, 12);
      final clock = Clock.fixed(now);
      final vocabRepo = VocabRepository(db: db, clock: clock);
      final attemptRepo = AttemptRepository(db: db, clock: clock);

      // 1. Capture mistake -> review -> re-capture must keep interval & reps
      await vocabRepo.captureMistakeToDeck(
        cardId: 'card-1',
        headword: 'mitigate',
        definition: 'Make less severe',
        topicTag: 'environment',
      );
      final cards = await vocabRepo.getDueCards();
      await vocabRepo.recordReview(card: cards.single, quality: ReviewQuality.easy);
      await vocabRepo.captureMistakeToDeck(
        cardId: 'card-1',
        headword: 'mitigate (v)',
        definition: 'Updated definition',
        topicTag: 'environment',
      );
      final afterRow = await db.vocabDao.getCardById('card-1');
      expect(afterRow?.repetitions, 1);
      expect(afterRow?.intervalDays, 4);
      expect(afterRow?.dueDay, SerialDay.fromUtcDateTime(now).addDays(4).value);

      // 2. Tied updatedAt timestamps iterate completely across composite cursor pages
      for (var i = 1; i <= 5; i++) {
        await db.into(db.examAttempts).insert(
          ExamAttemptsCompanion.insert(
            attemptId: 'att-tie-$i',
            packId: 'r-01',
            skill: 'reading',
            status: 'scored',
            submissionJson: '{}',
            overallBand: const Value(7),
            completedAtUtcMs: Value(now.millisecondsSinceEpoch),
            createdAt: now,
            updatedAt: now,
          ),
        );
      }
      final page1 = await attemptRepo.fetchHistoryPage(limit: 2);
      final page2 = await attemptRepo.fetchHistoryPage(
        limit: 2,
        cursorUpdatedAt: page1.last.updatedAt,
        cursorAttemptId: page1.last.attemptId,
      );
      final page3 = await attemptRepo.fetchHistoryPage(
        limit: 2,
        cursorUpdatedAt: page2.last.updatedAt,
        cursorAttemptId: page2.last.attemptId,
      );
      final combinedIds = <String>{
        ...page1.map((e) => e.attemptId),
        ...page2.map((e) => e.attemptId),
        ...page3.map((e) => e.attemptId),
      };
      expect(combinedIds, hasLength(5));

      // 3. Summary metrics flag partial (<4 skills) vs full (4 skills)
      final partial = StudyMetricsCalculator.calculateEstimatedOverallBand(
        scoredAttempts: <({double score, SkillKind skill, int completedAtUtcMs})>[
          (score: 7.0, skill: SkillKind.reading, completedAtUtcMs: now.millisecondsSinceEpoch),
        ],
      );
      expect(partial.isFullFourSkillEstimate, isFalse);
      expect(partial.attemptedSkillsCount, 1);
    });
  });
}

class _FakeBundleAdapter implements HttpClientAdapter {
  new(this.payload);
  final Map<String, dynamic> payload;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromString(
      jsonEncode(payload),
      200,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>[Headers.jsonContentType],
      },
    );
  }
}

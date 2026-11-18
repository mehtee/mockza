import 'package:mockza/core/exams/exam_descriptor.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/exams/local_objective_scorer.dart';
import 'package:mockza/core/exams/study_metrics_calculator.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/writing_evaluation.dart';
import 'package:test/test.dart';

void main() {
  group('Multi-Exam Track Scales & Descriptors (IELTS, TOEFL, PTE, DET)', () {
    test('quantizes and formats all 5 ExamTrack scales accurately', () {
      expect(ExamTrack.ieltsAcademic.quantizeScore(6.76), 7.0);
      expect(ExamTrack.ieltsGeneral.formatScoreWithUnit(7.5), 'Band 7.5');

      expect(ExamTrack.toeflIbt.quantizeScore(4.76), 5.0);
      expect(ExamTrack.toeflIbt.quantizeScore(0.2), 1.0);
      expect(ExamTrack.toeflIbt.quantizeScore(7), 6.0);
      expect(ExamTrack.toeflIbt.formatScore(5), '5.0');
      expect(ExamTrack.toeflIbt.formatScoreWithUnit(5.5), 'Band 5.5');

      expect(ExamTrack.pteAcademic.quantizeScore(64.6), 65.0);
      expect(ExamTrack.pteAcademic.quantizeScore(4), 10.0);
      expect(ExamTrack.pteAcademic.formatScore(72.4), '72');
      expect(ExamTrack.pteAcademic.formatScoreWithUnit(72), 'Score 72');

      expect(ExamTrack.det.quantizeScore(123), 125.0);
      expect(ExamTrack.det.quantizeScore(121), 120.0);
      expect(ExamTrack.det.quantizeScore(165), 160.0);
      expect(ExamTrack.det.formatScore(130), '130');
      expect(ExamTrack.det.formatScoreWithUnit(130), 'Score 130');

      // Switching between distinct exam scales resets target to targetScoreDefault,
      // while switching IELTS Academic <-> General preserves the band target.
      expect(
        ExamTrack.ieltsGeneral.nextTargetWhenSwitchingFrom(
          ExamTrack.ieltsAcademic,
          8,
        ),
        8.0,
      );
      expect(
        ExamTrack.det.nextTargetWhenSwitchingFrom(
          ExamTrack.pteAcademic,
          65,
        ),
        125.0,
      );
      expect(
        ExamTrack.pteAcademic.nextTargetWhenSwitchingFrom(
          ExamTrack.det,
          140,
        ),
        65.0,
      );
      expect(
        ExamTrack.toeflIbt.nextTargetWhenSwitchingFrom(
          ExamTrack.ieltsAcademic,
          7.5,
        ),
        5.0,
      );
    });

    test('computes monotonic scoreFromRatio across exam scales', () {
      expect(ExamTrack.toeflIbt.scoreFromRatio(0), 1.0);
      expect(ExamTrack.toeflIbt.scoreFromRatio(0.5), 3.5);
      expect(ExamTrack.toeflIbt.scoreFromRatio(1), 6.0);

      expect(ExamTrack.pteAcademic.scoreFromRatio(0), 10.0);
      expect(ExamTrack.pteAcademic.scoreFromRatio(0.5), 50.0);
      expect(ExamTrack.pteAcademic.scoreFromRatio(1), 90.0);

      expect(ExamTrack.det.scoreFromRatio(0), 10.0);
      expect(ExamTrack.det.scoreFromRatio(0.5), 85.0);
      expect(ExamTrack.det.scoreFromRatio(1), 160.0);
    });

    test('resolves exam track from packId prefixes and profile fallbacks', () {
      expect(
        ExamTrack.resolveForPackOrProfile(
          packId: 'toefl-reading-pack-01',
          profileExamId: 'ielts_academic',
        ),
        ExamTrack.toeflIbt,
      );
      expect(
        ExamTrack.resolveForPackOrProfile(
          packId: 'pte-speaking-pack-01',
          profileExamId: 'ielts_academic',
        ),
        ExamTrack.pteAcademic,
      );
      expect(
        ExamTrack.resolveForPackOrProfile(
          packId: 'det-writing-pack-01',
          profileExamId: 'ielts_academic',
        ),
        ExamTrack.det,
      );
      expect(
        ExamTrack.resolveForPackOrProfile(
          packId: 'ielts-listening-seed-01',
          profileExamId: 'ielts_general',
        ),
        ExamTrack.ieltsGeneral,
      );
    });

    test(
      'maps TOEFL 2026 1.0-6.0 bands monotonically to 0-120 concordance',
      () {
        expect(ExamSpec.estimateToeflLegacy120(1), 5);
        expect(ExamSpec.estimateToeflLegacy120(4), 78);
        expect(ExamSpec.estimateToeflLegacy120(5), 100);
        expect(ExamSpec.estimateToeflLegacy120(6), 117);
        expect(
          ExamSpec.estimateToeflLegacy120(5.25),
          greaterThan(ExamSpec.estimateToeflLegacy120(5)),
        );
      },
    );

    test(
      'provides descriptor pack bindings, task metadata & DET subscores',
      () {
        final toeflDesc = ExamDescriptor.forTrack(ExamTrack.toeflIbt);
        expect(toeflDesc.writingTasks, const <WritingTaskType>[
          WritingTaskType.toeflSentenceBuild,
          WritingTaskType.toeflEmail,
          WritingTaskType.toeflAcademicDiscussion,
        ]);
        expect(
          toeflDesc.buildScoreInsights(overallScore: 5).first.detail,
          '100 / 120',
        );

        final pteDesc = ExamDescriptor.forTrack(ExamTrack.pteAcademic);
        expect(
          pteDesc.writingTasks.first.requiresSingleSentence,
          isTrue,
        );
        expect(
          pteDesc.scoreObjective(
            skill: SkillKind.reading,
            correctCount: 8,
            totalCount: 10,
            isFullLength: true,
          ),
          74.0,
        );

        final detDesc = ExamDescriptor.forTrack(ExamTrack.det);
        expect(
          ExamDescriptor.forTrack(
            ExamTrack.ieltsAcademic,
          ).minCalibratedObjectiveCount,
          40,
        );
        expect(detDesc.minCalibratedObjectiveCount, 4);
        final subs = ExamDescriptor.computeDetSubscores(
          reading: 140,
          listening: 130,
          writing: 120,
          speaking: 110,
        );
        expect(subs.literacy, 130.0);
        expect(subs.comprehension, 135.0);
        expect(subs.conversation, 120.0);
        expect(subs.production, 115.0);
        expect(
          detDesc
              .buildScoreInsights(
                overallScore: 125,
                reading: 140,
                listening: 130,
                writing: 120,
                speaking: 110,
              )
              .map((e) => e.label),
          const <String>[
            'Literacy',
            'Comprehension',
            'Conversation',
            'Production',
          ],
        );
      },
    );
  });

  group('Multi-Exam LocalObjectiveScorer & StudyMetricsCalculator', () {
    test('normalizes reorder_sequence across separator styles', () {
      expect(LocalObjectiveScorer.normalizeSequence('cab'), 'C|A|B');
      expect(LocalObjectiveScorer.normalizeSequence('c, a, b'), 'C|A|B');
      expect(LocalObjectiveScorer.normalizeSequence(' C | A | B '), 'C|A|B');

      final report = LocalObjectiveScorer.score(
        skill: SkillKind.reading,
        track: ExamTrack.pteAcademic,
        answers: const <ObjectiveQuestionAnswer>[
          ObjectiveQuestionAnswer(
            questionId: 'pte-reorder-1',
            questionType: ObjectiveQuestionType.reorderSequence,
            acceptedAnswers: <String>['C, A, B'],
            userAnswer: 'c|a|b',
          ),
          ObjectiveQuestionAnswer(
            questionId: 'pte-reorder-2',
            questionType: ObjectiveQuestionType.reorderSequence,
            acceptedAnswers: <String>['A, B, C'],
            userAnswer: 'B|A|C',
          ),
        ],
      );

      expect(report.correctCount, 1);
      expect(report.questionCorrectness['pte-reorder-1'], isTrue);
      expect(report.questionCorrectness['pte-reorder-2'], isFalse);
      expect(report.bandScore, 50.0);
    });

    test(
      'scores word_completion, binary_choice & dictation on target exam track',
      () {
        final report = LocalObjectiveScorer.score(
          skill: SkillKind.listening,
          track: ExamTrack.det,
          answers: const <ObjectiveQuestionAnswer>[
            ObjectiveQuestionAnswer(
              questionId: 'det-wc',
              questionType: ObjectiveQuestionType.wordCompletion,
              acceptedAnswers: <String>['circulate'],
              userAnswer: 'Circulate',
              maxWords: 1,
            ),
            ObjectiveQuestionAnswer(
              questionId: 'det-bin',
              questionType: ObjectiveQuestionType.binaryChoice,
              acceptedAnswers: <String>['YES'],
              userAnswer: 'yes',
            ),
            ObjectiveQuestionAnswer(
              questionId: 'det-dict',
              questionType: ObjectiveQuestionType.dictation,
              acceptedAnswers: <String>[
                'Museums inspire curiosity across every generation.',
              ],
              userAnswer: 'museums inspire curiosity across every generation',
              maxWords: 15,
            ),
          ],
        );

        expect(report.correctCount, 3);
        expect(report.bandScore, 160.0);
      },
    );

    test('computes PTE and DET overall metrics without clamping to 9.0', () {
      const baseMs = 20000 * Duration.millisecondsPerDay;
      final pteSummary = StudyMetricsCalculator.calculateEstimatedOverallBand(
        track: ExamTrack.pteAcademic,
        targetBand: 75,
        scoredAttempts:
            const <({double score, SkillKind skill, int completedAtUtcMs})>[
              (score: 68, skill: SkillKind.reading, completedAtUtcMs: baseMs),
              (score: 72, skill: SkillKind.writing, completedAtUtcMs: baseMs),
              (score: 76, skill: SkillKind.speaking, completedAtUtcMs: baseMs),
            ],
      );
      expect(pteSummary.overallBand, 72.0);
      expect(pteSummary.progressToTarget, closeTo(72 / 75, 0.01));

      final detSummary = StudyMetricsCalculator.calculateEstimatedOverallBand(
        track: ExamTrack.det,
        targetBand: 135,
        scoredAttempts:
            const <({double score, SkillKind skill, int completedAtUtcMs})>[
              (score: 120, skill: SkillKind.reading, completedAtUtcMs: baseMs),
              (score: 130, skill: SkillKind.writing, completedAtUtcMs: baseMs),
              (
                score: 140,
                skill: SkillKind.listening,
                completedAtUtcMs: baseMs,
              ),
            ],
      );
      expect(detSummary.overallBand, 130.0);
      expect(detSummary.progressToTarget, closeTo(130 / 135, 0.01));
    });
  });
}

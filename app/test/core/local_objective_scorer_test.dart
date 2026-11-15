import 'package:mockza/core/exams/band_conversion_table.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/exams/local_objective_scorer.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:test/test.dart';

void main() {
  group('ExamSpec & LocalObjectiveScorer Exhaustive Tier 1 Suite', () {
    test(
      'rounds raw IELTS mean to nearest half band with boundary quarters',
      () {
        expect(ExamSpec.roundIeltsBand(6), 6.0);
        expect(ExamSpec.roundIeltsBand(6.12), 6.0);
        expect(ExamSpec.roundIeltsBand(6.25), 6.5);
        expect(ExamSpec.roundIeltsBand(6.5), 6.5);
        expect(ExamSpec.roundIeltsBand(6.74), 6.5);
        expect(ExamSpec.roundIeltsBand(6.75), 7.0);
        expect(ExamSpec.roundIeltsBand(6.88), 7.0);
        expect(ExamSpec.roundIeltsBand(8.9), 9.0);
        expect(ExamSpec.roundIeltsBand(9.5), 9.0);
        expect(ExamSpec.roundIeltsBand(-1), 0.0);
      },
    );

    test('normalizes whitespace, casing, and punctuation trims', () {
      expect(
        LocalObjectiveScorer.normalize('  hello   world  '),
        'hello world',
      );
      expect(LocalObjectiveScorer.normalize('SOLAR   PANELS'), 'solar panels');
      expect(
        LocalObjectiveScorer.normalize('\t15\nGreen\rStreet  '),
        '15 green street',
      );
    });

    test('handles UK vs US spelling equivalence in accepted answers', () {
      final report = LocalObjectiveScorer.score(
        skill: SkillKind.listening,
        answers: const <ObjectiveQuestionAnswer>[
          ObjectiveQuestionAnswer(
            questionId: 'q-uk-us-1',
            acceptedAnswers: <String>['colour', 'color'],
            userAnswer: 'Color',
          ),
          ObjectiveQuestionAnswer(
            questionId: 'q-uk-us-2',
            acceptedAnswers: <String>['theatre', 'theater'],
            userAnswer: 'THEATRE',
          ),
          ObjectiveQuestionAnswer(
            questionId: 'q-uk-us-3',
            acceptedAnswers: <String>['organise', 'organize'],
            userAnswer: '  organize  ',
          ),
        ],
      );

      expect(report.correctCount, 3);
      expect(report.questionCorrectness['q-uk-us-1'], isTrue);
      expect(report.questionCorrectness['q-uk-us-2'], isTrue);
      expect(report.questionCorrectness['q-uk-us-3'], isTrue);
    });

    test('handles numerical digits and written number words', () {
      final report = LocalObjectiveScorer.score(
        skill: SkillKind.listening,
        answers: const <ObjectiveQuestionAnswer>[
          ObjectiveQuestionAnswer(
            questionId: 'q-num-1',
            acceptedAnswers: <String>['50', 'fifty'],
            userAnswer: '50',
          ),
          ObjectiveQuestionAnswer(
            questionId: 'q-num-2',
            acceptedAnswers: <String>['24', 'twenty-four', 'twenty four'],
            userAnswer: 'twenty four',
          ),
          ObjectiveQuestionAnswer(
            questionId: 'q-num-3',
            acceptedAnswers: <String>['13th', '13', 'thirteenth'],
            userAnswer: '13th',
          ),
        ],
      );

      expect(report.correctCount, 3);
      expect(report.questionCorrectness['q-num-1'], isTrue);
      expect(report.questionCorrectness['q-num-2'], isTrue);
      expect(report.questionCorrectness['q-num-3'], isTrue);
    });

    test('handles blank and null submissions without errors', () {
      final report = LocalObjectiveScorer.score(
        skill: SkillKind.reading,
        answers: const <ObjectiveQuestionAnswer>[
          ObjectiveQuestionAnswer(
            questionId: 'q-null',
            acceptedAnswers: <String>['True', 'T'],
            userAnswer: null,
          ),
          ObjectiveQuestionAnswer(
            questionId: 'q-blank',
            acceptedAnswers: <String>['True', 'T'],
            userAnswer: '   ',
          ),
        ],
      );

      expect(report.correctCount, 0);
      expect(report.totalCount, 2);
      expect(report.bandScore, 0.0);
      expect(report.questionCorrectness['q-null'], isFalse);
      expect(report.questionCorrectness['q-blank'], isFalse);
    });

    test(
      'BandConversionTable Listening: exhaustive 0..40 score monotonicity',
      () {
        var previousBand = 0.0;
        for (var raw = 0; raw <= 40; raw++) {
          final band = BandConversionTable.listeningBandFor(raw);
          expect(band, greaterThanOrEqualTo(0.0));
          expect(band, lessThanOrEqualTo(9.0));
          expect(
            band,
            greaterThanOrEqualTo(previousBand),
            reason: 'Listening band must be monotonic for raw=$raw',
          );
          previousBand = band;
        }
        expect(BandConversionTable.listeningBandFor(0), 0.0);
        expect(BandConversionTable.listeningBandFor(1), 2.5);
        expect(BandConversionTable.listeningBandFor(16), 5.0);
        expect(BandConversionTable.listeningBandFor(23), 6.0);
        expect(BandConversionTable.listeningBandFor(30), 7.0);
        expect(BandConversionTable.listeningBandFor(35), 8.0);
        expect(BandConversionTable.listeningBandFor(39), 9.0);
        expect(BandConversionTable.listeningBandFor(40), 9.0);
      },
    );

    test('BandConversionTable Academic Reading: exhaustive 0..40 score monotonicity', () {
      var previousBand = 0.0;
      for (var raw = 0; raw <= 40; raw++) {
        final band = BandConversionTable.readingBandFor(
          raw,
          moduleType: ExamModuleType.academic,
        );
        expect(band, greaterThanOrEqualTo(0.0));
        expect(band, lessThanOrEqualTo(9.0));
        expect(
          band,
          greaterThanOrEqualTo(previousBand),
          reason: 'Academic reading band must be monotonic for raw=$raw',
        );
        previousBand = band;
      }
      expect(
        BandConversionTable.readingBandFor(
          0,
          moduleType: ExamModuleType.academic,
        ),
        0.0,
      );
      expect(
        BandConversionTable.readingBandFor(
          15,
          moduleType: ExamModuleType.academic,
        ),
        5.0,
      );
      expect(
        BandConversionTable.readingBandFor(
          23,
          moduleType: ExamModuleType.academic,
        ),
        6.0,
      );
      expect(
        BandConversionTable.readingBandFor(
          30,
          moduleType: ExamModuleType.academic,
        ),
        7.0,
      );
      expect(
        BandConversionTable.readingBandFor(
          35,
          moduleType: ExamModuleType.academic,
        ),
        8.0,
      );
      expect(
        BandConversionTable.readingBandFor(
          39,
          moduleType: ExamModuleType.academic,
        ),
        9.0,
      );
      expect(
        BandConversionTable.readingBandFor(
          40,
          moduleType: ExamModuleType.academic,
        ),
        9.0,
      );
    });

    test('BandConversionTable General Training Reading: requires higher raw scores', () {
      expect(
        BandConversionTable.readingBandFor(
          30,
          moduleType: ExamModuleType.academic,
        ),
        7.0,
      );
      expect(
        BandConversionTable.readingBandFor(
          30,
          moduleType: ExamModuleType.generalTraining,
        ),
        6.0,
      );

      expect(
        BandConversionTable.readingBandFor(
          34,
          moduleType: ExamModuleType.generalTraining,
        ),
        7.0,
      );
      expect(
        BandConversionTable.readingBandFor(
          37,
          moduleType: ExamModuleType.generalTraining,
        ),
        8.0,
      );
      expect(
        BandConversionTable.readingBandFor(
          40,
          moduleType: ExamModuleType.generalTraining,
        ),
        9.0,
      );
    });

    test('scales short starter packs (<40 items) proportionally to 40-item IELTS scale', () {
      final perfectSix = LocalObjectiveScorer.score(
        skill: SkillKind.reading,
        answers: List<ObjectiveQuestionAnswer>.generate(
          6,
          (index) => ObjectiveQuestionAnswer(
            questionId: 'q-${index + 1}',
            acceptedAnswers: const <String>['True'],
            userAnswer: 'True',
          ),
        ),
      );
      expect(perfectSix.correctCount, 6);
      expect(perfectSix.totalCount, 6);
      expect(perfectSix.bandScore, 9.0);

      final fiveOfSix = LocalObjectiveScorer.score(
        skill: SkillKind.listening,
        answers: <ObjectiveQuestionAnswer>[
          for (var i = 0; i < 5; i++)
            ObjectiveQuestionAnswer(
              questionId: 'q-${i + 1}',
              acceptedAnswers: const <String>['London'],
              userAnswer: 'London',
            ),
          const ObjectiveQuestionAnswer(
            questionId: 'q-6',
            acceptedAnswers: <String>['London'],
            userAnswer: 'Manchester',
          ),
        ],
      );
      expect(fiveOfSix.correctCount, 5);
      expect(fiveOfSix.bandScore, 7.5);
    });
  });
}

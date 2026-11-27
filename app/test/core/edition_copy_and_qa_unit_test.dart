import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/core/advanced/linguistic_graph_math.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/localization/edition_copy.dart';
import 'package:mockza/core/personalization/roadmap_generator.dart';
import 'package:mockza/core/personalization/topic_taxonomy.dart';
import 'package:mockza/core/personalization/topic_weakness_rotator.dart';

void main() {
  group('EditionCopy & QA localization/filtering regressions', () {
    test(
      'targetScoreTitle avoids Score Score duplication and localizes units',
      () {
        expect(
          EditionCopy.targetScoreTitle(ExamTrack.ieltsAcademic, isIran: false),
          'Target Band Score',
        );
        expect(
          EditionCopy.targetScoreTitle(ExamTrack.pteAcademic, isIran: false),
          'Target Score',
        );
        expect(
          EditionCopy.targetScoreTitle(ExamTrack.det, isIran: false),
          'Target Score',
        );
        expect(
          EditionCopy.targetScoreTitle(ExamTrack.ieltsAcademic, isIran: true),
          'نمره هدف (باند)',
        );
        expect(
          EditionCopy.targetScoreTitle(ExamTrack.pteAcademic, isIran: true),
          'نمره هدف',
        );
        expect(
          EditionCopy.formatScoreWithUnitFor(
            ExamTrack.ieltsAcademic,
            7.5,
            isIran: true,
          ),
          'باند ۷.۵',
        );
        expect(
          EditionCopy.formatScoreWithUnitFor(
            ExamTrack.pteAcademic,
            72,
            isIran: true,
          ),
          'نمره ۷۲',
        );
      },
    );

    test('matchesDrillTrack scopes drills to the active ExamTrack', () {
      expect(
        EditionCopy.matchesDrillTrack(
          'ielts-tfng-01',
          ExamTrack.ieltsAcademic,
        ),
        isTrue,
      );
      expect(
        EditionCopy.matchesDrillTrack('ielts-tfng-01', ExamTrack.ieltsGeneral),
        isTrue,
      );
      expect(
        EditionCopy.matchesDrillTrack(
          'det-read-select-01',
          ExamTrack.ieltsAcademic,
        ),
        isFalse,
      );
      expect(
        EditionCopy.matchesDrillTrack('det-read-select-01', ExamTrack.det),
        isTrue,
      );
      expect(
        EditionCopy.matchesDrillTrack('pte-reorder-01', ExamTrack.pteAcademic),
        isTrue,
      );
      expect(
        EditionCopy.matchesDrillTrack('toefl-complete-01', ExamTrack.toeflIbt),
        isTrue,
      );
      expect(
        EditionCopy.matchesDrillTrack(
          'custom-drop-01',
          ExamTrack.ieltsAcademic,
        ),
        isTrue,
      );
    });

    test(
      'localizeDiagnosticAction and level translate IRN diagnostic copy',
      () {
        final action = EditionCopy.localizeDiagnosticAction(
          'Practice Reading: explicit_detail',
          'Targeted short practice based directly on what appeared in your starting check.',
          isIran: true,
        );
        expect(action.title, 'تمرین ریدینگ: جزئیات صریح متن');
        expect(action.description, contains('ارزیابی اولیه'));

        final level = EditionCopy.localizeDiagnosticLevel(
          'Suggested practice: Foundational (A1–A2 focus) — provisional (reduced sampling)',
          isIran: true,
        );
        expect(
          level,
          'سطح پیشنهادی تمرین: پایه (تمرکز A1–A2) — تخمین اولیه (نمونه محدود)',
        );

        expect(
          EditionCopy.localizeWorkerStage(
            'stage.register_shifting',
            isIran: true,
          ),
          'در حال بازنویسی و ارتقای سطح آکادمیک...',
        );
        expect(
          EditionCopy.milestoneChipLabel(1, isIran: true),
          'گام ۱',
        );
        expect(
          EditionCopy.milestoneChipLabel(2, isIran: false, completed: true),
          'M2 ✓',
        );
        expect(
          EditionCopy.localizeDropPolicyReason(
            'off_topic',
            'Off-topic input',
            isIran: true,
          ),
          contains('ساختار تمرین‌های آزمون زبان'),
        );
        expect(
          EditionCopy.localizeDropPolicyReason(
            'off_topic',
            'Off-topic input',
            isIran: false,
          ),
          'Off-topic input',
        );
      },
    );

    test(
      'RoadmapGenerator avoids double ampersand when topic already contains &',
      () {
        final roadmap = RoadmapGenerator.generateOrRecalibrate(
          track: ExamTrack.ieltsAcademic,
          currentBand: 5.5,
          targetBand: 7,
          targetDateSerial: 20500,
          todaySerial: 20470,
          studyFocus: 'both',
          dailyMinutesGoal: 25,
          favoriteTopics: <String>[CanonicalTopicKey.technologyAi.wireKey],
          weaknessNodes: const <LinguisticNodeSummary>[],
          coverage: const <TopicWeaknessCoverageEntry>[],
          packs: const <RoadmapPackInventoryItem>[
            RoadmapPackInventoryItem(
              id: 'ielts-ac-read-01',
              examId: 'ielts_academic',
              skill: 'reading',
              topicKeys: <CanonicalTopicKey>[CanonicalTopicKey.technologyAi],
              weaknessTags: <String>['explicit_detail'],
              cefrMin: AuthoringTier.b1,
              cefrMax: AuthoringTier.b2,
              durationSeconds: 900,
              title: 'Reading Pack 1',
            ),
          ],
          drills: const <RoadmapDrillInventoryItem>[],
          diagnosticDone: true,
          currentVocabWave: 1,
        );

        final vocabStep = roadmap.steps.firstWhere(
          (s) => s.stepKind == RoadmapStepKind.vocabWave,
        );
        expect(vocabStep.titleEn, isNot(contains('& Core Words')));
        expect(vocabStep.titleEn, contains('Technology & AI Core Words'));
      },
    );
  });
}

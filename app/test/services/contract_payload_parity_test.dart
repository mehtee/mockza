import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/personalization/vocab_wave_scheduler.dart';
import 'package:mockza/routing/roadmap_route_resolver.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/personalization_gateway.dart';
import 'package:mockza/services/speech_practice_gateway.dart';

void main() {
  group('Contract payload & personalization engine parity', () {
    test('wire enums match canonical @mockza/contracts literals', () {
      expect(
        StudyFocusMode.values.map((e) => e.wire).toList(),
        equals(<String>['exams', 'coach', 'both', 'speaking_only']),
      );
      expect(
        BandEventSkill.values.map((e) => e.wire).toList(),
        equals(<String>['reading', 'listening', 'writing', 'speaking']),
      );
      expect(
        BandEventSourceKind.values.map((e) => e.wire).toList(),
        equals(<String>[
          'diagnostic',
          'practice_section',
          'full_mock',
          'writing_eval',
          'speaking_eval',
          'micro_drill',
          'mission',
          'pronunciation',
        ]),
      );
      expect(
        TtsSourceContext.values.map((e) => e.wire).toList(),
        equals(<String>[
          'vocab',
          'reading',
          'listening_feedback',
          'speaking_feedback',
          'writing_feedback',
          'coach',
          'pronunciation',
        ]),
      );
      expect(
        PronunciationPracticeKind.values.map((e) => e.wire).toList(),
        equals(<String>[
          'word',
          'sentence',
          'reading_excerpt',
          'feedback_shadow',
        ]),
      );
      expect(
        PronunciationSourceRefType.values.map((e) => e.wire).toList(),
        equals(<String>[
          'vocab_card',
          'reading_passage',
          'listening_feedback',
          'writing_feedback',
          'speaking_feedback',
          'coach',
          'custom',
        ]),
      );
    });

    test('resolveFlutterRoadmapStepRoute resolves every stepKind cleanly', () {
      RoadmapStepDto buildStep(
        String kind, {
        String skill = 'all',
        String? entityId,
        String targetRoute = '/practice',
      }) => RoadmapStepDto(
        stepId: 's-$kind',
        milestoneIndex: 2,
        stepOrder: 1,
        stepKind: kind,
        skill: skill,
        titleEn: 'Title',
        titleFa: 'عنوان',
        reasonEn: 'Reason',
        reasonFa: 'دلیل',
        topicKey: 'technology_ai',
        targetRoute: targetRoute,
        targetEntityId: entityId,
        status: 'active',
        estimatedMinutes: 10,
      );

      expect(
        resolveFlutterRoadmapStepRoute(buildStep('vocab_wave')),
        equals(AppRoutes.vocabulary),
      );
      expect(
        resolveFlutterRoadmapStepRoute(
          buildStep('micro_drill', entityId: 'drill-01'),
        ),
        equals('/micro-drill/drill-01'),
      );
      expect(
        resolveFlutterRoadmapStepRoute(buildStep('daily_mission')),
        equals(AppRoutes.buildDailyMission()),
      );
      expect(
        resolveFlutterRoadmapStepRoute(buildStep('register_shifter')),
        equals(AppRoutes.registerShifter),
      );
      expect(
        resolveFlutterRoadmapStepRoute(buildStep('drop_anything')),
        equals(AppRoutes.dropIngest),
      );
      expect(
        resolveFlutterRoadmapStepRoute(
          buildStep('practice_section', skill: 'listening', entityId: 'pack-l1'),
        ),
        equals('/listening/pack-l1'),
      );
      expect(
        resolveFlutterRoadmapStepRoute(
          buildStep('full_mock', entityId: 'mock-acad-01'),
        ),
        equals('/practice/full-mock/mock-acad-01'),
      );
    });

    test('VocabWaveScheduler enforces unlocked waves & daily new cap', () {
      final cards = List<VocabWaveCardInput>.generate(
        40,
        (i) => VocabWaveCardInput(
          cardId: 'card-$i',
          headword: 'word-$i',
          legacyTopicTag: i < 20 ? 'technology' : 'environment',
          repetitions: i < 3 ? 1 : 0,
          dueSerialDay: 20000,
          baseWaveOrder: i + 1,
        ),
      );
      final waveRes = VocabWaveScheduler.assignWaves<VocabWaveCardInput>(
        cards: cards,
        favoriteTopics: const <String>['technology_ai'],
        track: ExamTrack.ieltsAcademic,
        currentBand: 6,
        targetBand: 7.5,
        activeWeaknessKeys: const <String>[],
        unlockedWave: 1,
      );
      final selection =
          VocabWaveScheduler.selectDailyReviewQueue<VocabWaveCardInput>(
            assigned: waveRes.assigned,
            todaySerialDay: 20000,
            newCardsIntroducedToday: 4,
            unlockedWave: 1,
          );
      // 3 reviewed due + max (10 - 4) = 6 new from wave 1
      expect(selection.summary.dailyNewRemaining, equals(6));
      expect(selection.queue.length, lessThanOrEqualTo(15));
      expect(
        selection.queue.where((q) => q.card.repetitions == 0).length,
        equals(6),
      );
    });
  });
}

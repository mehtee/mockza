import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/features/roadmap/presentation/roadmap_screen.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/personalization_gateway.dart';
import 'package:mockza/services/speech_practice_gateway.dart';
import 'package:mockza/theme/app_theme.dart';
import 'package:mockza/theme/components/inline_listen_button.dart';
import 'package:mockza/theme/components/speech_practice_sheet.dart';
import 'package:mockza/theme/components/trend_chart.dart';
import 'package:mockza/theme/components/vocab_flip_card.dart';
import 'package:mockza/theme/theme_catalog.dart';

import '../support/fakes.dart';

final class _FakePersonalizationGateway implements PersonalizationGateway {
  new({required this.initialState}) : currentState = initialState;

  final PersonalizationStateDto initialState;
  PersonalizationStateDto currentState;
  final List<({String stepId, String status})> stepActions = [];

  @override
  Future<Result<PersonalizationStateDto, Failure>> getState() async =>
      Ok(currentState);

  @override
  Future<Result<PersonalizationStateDto, Failure>> advanceRoadmapStep({
    required String stepId,
    required String status,
  }) async {
    stepActions.add((stepId: stepId, status: status));
    final nextSteps = currentState.steps
        .map(
          (s) => s.stepId == stepId
              ? RoadmapStepDto(
                  stepId: s.stepId,
                  milestoneIndex: s.milestoneIndex,
                  stepOrder: s.stepOrder,
                  stepKind: s.stepKind,
                  titleEn: s.titleEn,
                  titleFa: s.titleFa,
                  reasonEn: s.reasonEn,
                  reasonFa: s.reasonFa,
                  topicKey: s.topicKey,
                  weaknessKey: s.weaknessKey,
                  targetRoute: s.targetRoute,
                  targetEntityId: s.targetEntityId,
                  status: status,
                  estimatedMinutes: s.estimatedMinutes,
                )
              : (s.stepOrder == 2
                    ? RoadmapStepDto(
                        stepId: s.stepId,
                        milestoneIndex: s.milestoneIndex,
                        stepOrder: s.stepOrder,
                        stepKind: s.stepKind,
                        titleEn: s.titleEn,
                        titleFa: s.titleFa,
                        reasonEn: s.reasonEn,
                        reasonFa: s.reasonFa,
                        topicKey: s.topicKey,
                        weaknessKey: s.weaknessKey,
                        targetRoute: s.targetRoute,
                        targetEntityId: s.targetEntityId,
                        status: 'active',
                        estimatedMinutes: s.estimatedMinutes,
                      )
                    : s),
        )
        .toList(growable: false);
    currentState = PersonalizationStateDto(
      rawJson: currentState.rawJson,
      examTrack: currentState.examTrack,
      targetBand: currentState.targetBand,
      favoriteTopics: currentState.favoriteTopics,
      activeWeaknessPhase: currentState.activeWeaknessPhase,
      vocabUnlockedWave: currentState.vocabUnlockedWave,
      dailyNewVocabCap: currentState.dailyNewVocabCap,
      liveBand: currentState.liveBand,
      weaknesses: currentState.weaknesses,
      milestones: currentState.milestones,
      currentStep: nextSteps.where((s) => s.status == 'active').firstOrNull,
      steps: nextSteps,
      vocabWaveSummary: currentState.vocabWaveSummary,
    );
    return Ok(currentState);
  }

  @override
  Future<Result<bool, Failure>> ackBandShift() async => const Ok(true);

  @override
  Future<Result<Map<String, Object?>, Failure>> pullSyncRaw({
    String? sinceIso,
  }) async => const Ok(<String, Object?>{});

  @override
  Future<Result<VocabWaveSummaryDto, Failure>> pushVocabBatch(
    List<Map<String, Object?>> cards,
  ) async => Ok(currentState.vocabWaveSummary);

  @override
  Future<Result<PersonalizationStateDto, Failure>> recordBandEvent({
    required String examTrack,
    required String skill,
    required String sourceKind,
    required String sourceId,
    required double rawScore,
    int? durationSeconds,
    double? accuracyRatio,
    List<String> topicKeys = const <String>[],
    List<Map<String, Object?>>? questionTypeStats,
    String? packId,
    String? attemptId,
    double? scoreBand,
    Map<String, Object?>? answersJson,
    Map<String, Object?>? feedbackJson,
  }) async => Ok(currentState);

  @override
  Future<Result<PersonalizationStateDto, Failure>> updateProfile({
    String? examTrack,
    double? targetBand,
    String? targetDateIso,
    String? studyFocus,
    List<String>? favoriteTopics,
    int? dailyNewVocabCap,
    String? preferredTtsAccent,
    bool? onboardingCompleted,
    bool? unlockNextVocabWave,
  }) async => Ok(currentState);
}

final class _FakeSpeechPracticeGateway implements SpeechPracticeGateway {
  final List<({String text, double speed, String voice, String sourceContext})>
  ttsCalls = [];
  List<PronunciationPracticeItemDto> historyItems = <PronunciationPracticeItemDto>[
    const PronunciationPracticeItemDto(
      practiceId: 'pron_seed_1',
      targetText: 'mitigate environmental impact',
      practiceKind: 'collocation',
      status: 'completed',
      createdAt: '2026-11-22T12:00:00Z',
      accuracyScore: 84,
      fluencyScore: 80,
      intonationScore: 78,
      stressScore: 82,
      overallScore: 81,
      bandImpactLabel: 'Band 7.0 Trajectory',
      summaryEn: 'Clear consonant endings; sharpen primary word stress.',
      summaryFa: 'تلفظ صامت‌های پایانی خوب بود؛ روی تکیه هجای اول دقت کنید.',
      mouthTipEn: 'Relax lips slightly on /ɪ/.',
      mouthTipFa: 'لب‌ها را برای واکه کوتاه کمی رها کنید.',
      actionableRetryEn: 'Stress MIT-i-gate on beat one.',
      actionableRetryFa: 'تاکید را روی هجای اول بگذارید.',
      wordsFeedback: <PronunciationWordFeedbackDto>[
        PronunciationWordFeedbackDto(
          word: 'mitigate',
          status: 'needs_work',
          issueType: 'stress',
          ipaTarget: 'ˈmɪtɪɡeɪt',
          tipEn: 'Stress the first syllable.',
          tipFa: 'هجای اول را بلندتر ادا کنید.',
        ),
      ],
    ),
  ];

  @override
  Future<Result<String, Failure>> fetchPlayableRecordingRef({
    required String practiceId,
    required String relativeAudioPath,
  }) async => const Ok('/tmp/fake_recording.m4a');

  @override
  Future<Result<List<PronunciationPracticeItemDto>, Failure>> listHistory({
    String? sourceRefId,
    int limit = 12,
  }) async => Ok(historyItems);

  @override
  Future<Result<PronunciationHistoryPageDto, Failure>> listHistoryPage({
    String? sourceRefId,
    int limit = 12,
    String? cursor,
  }) async => Ok(
    PronunciationHistoryPageDto(
      items: historyItems,
      remainingDailyQuota: 20,
      dailyQuotaLimit: 20,
    ),
  );

  @override
  Future<Result<PronunciationPracticeItemDto, Failure>> submitPractice({
    required String practiceId,
    required String targetText,
    required String practiceKind,
    required String examTrack,
    required Uint8List audioBytes,
    required String contentType,
    String? sourceRefType,
    String? sourceRefId,
    int? durationMs,
  }) async => Ok(historyItems.first);

  @override
  Future<Result<String, Failure>> synthesizeTtsPlayableRef({
    required String text,
    double speed = 1.0,
    String voice = 'af_bella',
    String sourceContext = 'vocab',
  }) async {
    ttsCalls.add((
      text: text,
      speed: speed,
      voice: voice,
      sourceContext: sourceContext,
    ));
    return Ok('/tmp/kokoro_${ttsCalls.length}.mp3');
  }
}

PersonalizationStateDto _samplePersonalization() => const PersonalizationStateDto(
  rawJson: <String, Object?>{},
  examTrack: 'ielts_academic',
  targetBand: 7.5,
  favoriteTopics: <String>['technology_ai'],
  activeWeaknessPhase: 'favorite_topics',
  vocabUnlockedWave: 1,
  dailyNewVocabCap: 10,
  liveBand: LiveBandProfileDto(
    examTrack: 'ielts_academic',
    currentBand: 6.5,
    targetBand: 7.5,
    bandShift: 0.5,
    confidence: BandConfidenceTier.developing,
    skills: <String, LiveSkillBandStateDto>{},
  ),
  weaknesses: <WeaknessSummaryDto>[
    WeaknessSummaryDto(
      canonicalKey: 'tfng_inference',
      skill: 'reading',
      displayLabelEn: 'True / False / Not Given',
      displayLabelFa: 'تشخیص صحیح / غلط / نامشخص',
      masteryScoreMilli: 420,
      evidenceCount: 3,
      status: 'active',
    ),
  ],
  milestones: <RoadmapMilestoneDto>[
    RoadmapMilestoneDto(
      index: 1,
      titleEn: 'Foundation inside Interests',
      titleFa: 'پایه‌سازی با موضوعات دلخواه',
      phaseLabelEn: 'Favorite Topics',
      phaseLabelFa: 'موضوعات مورد علاقه',
      targetBandDelta: 0.5,
      status: 'active',
    ),
    RoadmapMilestoneDto(
      index: 2,
      titleEn: 'Transfer Across Contexts',
      titleFa: 'تثبیت نقاط ضعف در موضوعات جدید',
      phaseLabelEn: 'Weakness Transfer',
      phaseLabelFa: 'انتقال نقاط ضعف',
      targetBandDelta: 0.5,
      status: 'locked',
    ),
  ],
  currentStep: RoadmapStepDto(
    stepId: 'step_1',
    milestoneIndex: 1,
    stepOrder: 1,
    stepKind: 'vocab_wave',
    titleEn: 'Wave 1 Academic Words (Tech)',
    titleFa: 'موج اول واژگان فناوری',
    reasonEn: 'Starts inside Technology & AI while strengthening precision.',
    reasonFa: 'شروع از موضوع فناوری برای تثبیت دقت واژگان.',
    topicKey: 'technology_ai',
    weaknessKey: 'tfng_inference',
    targetRoute: '/vocabulary',
    status: 'active',
    estimatedMinutes: 8,
  ),
  steps: <RoadmapStepDto>[
    RoadmapStepDto(
      stepId: 'step_1',
      milestoneIndex: 1,
      stepOrder: 1,
      stepKind: 'vocab_wave',
      titleEn: 'Wave 1 Academic Words (Tech)',
      titleFa: 'موج اول واژگان فناوری',
      reasonEn: 'Starts inside Technology & AI while strengthening precision.',
      reasonFa: 'شروع از موضوع فناوری برای تثبیت دقت واژگان.',
      topicKey: 'technology_ai',
      weaknessKey: 'tfng_inference',
      targetRoute: '/vocabulary',
      status: 'active',
      estimatedMinutes: 8,
    ),
    RoadmapStepDto(
      stepId: 'step_2',
      milestoneIndex: 1,
      stepOrder: 2,
      stepKind: 'micro_drill',
      titleEn: 'TFNG Precision Drill',
      titleFa: 'تمرین دقت صحیح/غلط',
      reasonEn: 'Targets your #1 reading weakness.',
      reasonFa: 'هدف‌گیری مهم‌ترین نقطه‌ضعف ریدینگ.',
      topicKey: 'science_climate',
      weaknessKey: 'tfng_inference',
      targetRoute: '/micro-drill',
      status: 'locked',
      estimatedMinutes: 6,
    ),
  ],
  vocabWaveSummary: VocabWaveSummaryDto(
    unlockedWave: 1,
    totalWaves: 3,
    currentWaveTotal: 15,
    currentWaveLearned: 4,
    readyToUnlockNext: false,
    dailyNewRemaining: 7,
  ),
);

Widget _wrapTestWidget(
  Widget child, {
  required EditionConfig edition,
  required List<Override> overrides,
}) {
  final isIrn = edition.edition == AppEdition.iran;
  return ProviderScope(
    overrides: [
      editionConfigProvider.overrideWithValue(edition),
      clockProvider.overrideWithValue(fixedTestClock()),
      ...overrides,
    ],
    child: MaterialApp(
      locale: isIrn ? const Locale('fa') : const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: AppTheme.build(
        preset: MzThemeCatalog.allPresets.first,
        brightness: Brightness.dark,
        persian: isIrn,
      ),
      home: Directionality(
        textDirection: isIrn ? TextDirection.rtl : TextDirection.ltr,
        child: child,
      ),
    ),
  );
}

void main() {
  testWidgets(
    'RoadmapScreen renders Durnama milestones + advances step on GLB and IRN',
    (tester) async {
      final db = createTestDatabase();
      final pGateway = _FakePersonalizationGateway(
        initialState: _samplePersonalization(),
      );

      await tester.pumpWidget(
        _wrapTestWidget(
          const RoadmapScreen(),
          edition: EditionConfig.globalDefault,
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            personalizationGatewayProvider.overrideWithValue(pGateway),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Your Learning Roadmap'), findsOneWidget);
      expect(find.text('M1'), findsOneWidget);
      expect(find.text('M2'), findsOneWidget);
      expect(find.text('Wave 1 Academic Words (Tech)'), findsOneWidget);
      expect(find.text('TFNG Precision Drill'), findsNothing);

      await tester.ensureVisible(find.text('Mark Step Done'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Mark Step Done'));
      await tester.pumpAndSettle();

      expect(pGateway.stepActions, hasLength(1));
      expect(pGateway.stepActions.first.stepId, 'step_1');
      expect(find.text('TFNG Precision Drill'), findsOneWidget);

      await tester.pumpWidget(
        _wrapTestWidget(
          const RoadmapScreen(),
          edition: EditionConfig.iranDefault,
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            personalizationGatewayProvider.overrideWithValue(pGateway),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('نقشه راه یادگیری شما'), findsOneWidget);
      expect(find.text('تمرین دقت صحیح/غلط'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 1));
      await tester.runAsync(db.close);
    },
  );

  testWidgets(
    'InlineListenButton invokes Kokoro API at 1.0x and 0.8x speed via AudioPlayerGateway',
    (tester) async {
      final player = FakeAudioPlayerGateway();
      final speechGw = _FakeSpeechPracticeGateway();

      await tester.pumpWidget(
        _wrapTestWidget(
          const Scaffold(
            body: Center(
              child: InlineListenButton(
                text: 'paradigm shift',
                sourceContext: 'vocab_card',
              ),
            ),
          ),
          edition: EditionConfig.globalDefault,
          overrides: [
            audioPlayerGatewayProvider.overrideWithValue(player),
            speechPracticeGatewayProvider.overrideWithValue(speechGw),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Listen'));
      await tester.pumpAndSettle();

      expect(speechGw.ttsCalls, hasLength(1));
      expect(speechGw.ttsCalls.first.text, 'paradigm shift');
      expect(speechGw.ttsCalls.first.speed, 1.0);
      expect(player.currentFilePath, '/tmp/kokoro_1.mp3');

      await tester.tap(find.text('0.8×'));
      await tester.pumpAndSettle();

      expect(speechGw.ttsCalls, hasLength(2));
      expect(speechGw.ttsCalls[1].speed, 0.8);
      expect(player.currentFilePath, '/tmp/kokoro_2.mp3');
    },
  );

  testWidgets(
    'SpeechPracticeSheet & VocabFlipCard render pronunciation score, IPA word chip & listen controls',
    (tester) async {
      final db = createTestDatabase();
      final player = FakeAudioPlayerGateway();
      final recorder = FakeAudioRecorderGateway();
      final speechGw = _FakeSpeechPracticeGateway();

      await tester.pumpWidget(
        _wrapTestWidget(
          Scaffold(
            body: ListView(
              children: <Widget>[
                VocabFlipCard(
                  cardId: 'card_1',
                  headword: 'mitigate',
                  definition: 'To make less severe or painful.',
                  contextSentence: 'Clean energy policies mitigate emissions.',
                  isRevealed: true,
                  onTapFlip: () {},
                  onSelectRating: (_) {},
                ),
                const SizedBox(height: 16),
                const SizedBox(
                  height: 460,
                  child: SpeechPracticeSheet(
                    targetText: 'mitigate environmental impact',
                    practiceKind: 'collocation',
                    sourceRefType: 'vocab_card',
                    sourceRefId: 'card_1',
                  ),
                ),
              ],
            ),
          ),
          edition: EditionConfig.globalDefault,
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            audioPlayerGatewayProvider.overrideWithValue(player),
            audioRecorderGatewayProvider.overrideWithValue(recorder),
            speechPracticeGatewayProvider.overrideWithValue(speechGw),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('81%'), findsOneWidget);
      expect(find.text('Band 7.0 Trajectory'), findsOneWidget);
      expect(find.text('/ˈmɪtɪɡeɪt/'), findsOneWidget);
      expect(find.text('Practice Pronunciation'), findsWidgets);

      const today = SerialDay(20200);
      expect(today.value, 20200);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 1));
      await tester.runAsync(db.close);
    },
  );

  testWidgets(
    'InlineListenButton respects preferredTtsAccentProvider (uk -> bf_emma) & TrendChart differentiates calibrated/provisional points',
    (tester) async {
      final player = FakeAudioPlayerGateway();
      final speechGw = _FakeSpeechPracticeGateway();

      await tester.pumpWidget(
        _wrapTestWidget(
          Scaffold(
            body: Consumer(
              builder: (context, ref, _) => Column(
                children: <Widget>[
                  TextButton(
                    onPressed: () => ref
                        .read(preferredTtsAccentProvider.notifier)
                        .setAccent('uk'),
                    child: const Text('Switch UK'),
                  ),
                  const InlineListenButton(text: 'coherence'),
                  const TrendChart(
                    points: <ScoreTrendPoint>[
                      ScoreTrendPoint(
                        dateLabel: '11/20',
                        score: 6,
                        timestampUtcMs: 1700000000000,
                        isCalibrated: false,
                      ),
                      ScoreTrendPoint(
                        dateLabel: '11/22',
                        score: 7,
                        timestampUtcMs: 1700100000000,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          edition: EditionConfig.globalDefault,
          overrides: [
            audioPlayerGatewayProvider.overrideWithValue(player),
            speechPracticeGatewayProvider.overrideWithValue(speechGw),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Listen'));
      await tester.pumpAndSettle();
      expect(speechGw.ttsCalls, hasLength(1));
      expect(speechGw.ttsCalls.last.voice, 'af_bella');

      await tester.tap(find.text('Switch UK'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('0.8×'));
      await tester.pumpAndSettle();
      expect(speechGw.ttsCalls, hasLength(2));
      expect(speechGw.ttsCalls.last.voice, 'bf_emma');
      expect(speechGw.ttsCalls.last.speed, 0.8);

      expect(
        find.bySemanticsLabel(RegExp('Provisional.*Calibrated')),
        findsOneWidget,
      );
    },
  );
}

import 'package:clock/clock.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/app.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_intro_screen.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_notifier.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_providers.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_results_screen.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_session_screen.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/diagnostic_gateway.dart';
import 'package:mockza/theme/app_theme.dart';

import '../support/fakes.dart';

class _MutableClock {
  new(this.now);
  DateTime now;

  Clock asClock() => Clock(() => now);
}

class _PollingDiagnosticGateway extends FakeDiagnosticGateway {
  int fetchCalls = 0;
  bool returnPendingFirst = true;

  @override
  Future<Result<DiagnosticSessionSnapshot, Failure>> submitSession({
    required String diagId,
    required String examId,
    required DiagnosticMode mode,
    required List<BlockAttemptRecord> readingHistory,
    required DiagnosticStopReason? readingStopReason,
    required bool readingSkipped,
    required List<BlockAttemptRecord> listeningHistory,
    required DiagnosticStopReason? listeningStopReason,
    required bool listeningSkipped,
    String? writingAttemptId,
    String? writingPromptTitle,
    String? writingBasePrompt,
    String? writingFollowUpPrompt,
    String? writingBaseResponse,
    String? writingFollowUpResponse,
    bool writingSkipped = false,
    String? speakingAttemptId,
    String? speakingBasePrompt,
    String? speakingFollowUpPrompt,
    List<
          ({
            int partIndex,
            String promptText,
            String objectKey,
            int? durationMs,
          })
        >
        speakingTurns =
        const [],
    bool speakingSkipped = false,
    NoEvidenceReason? speakingNoEvidenceReason,
  }) async => Ok(
    DiagnosticSessionSnapshot(
      diagId: diagId,
      examId: examId,
      mode: mode,
      policyVersion: '2026-11-17.v1',
      contentVersion: 'diag-2026-11-17.v1',
      status: returnPendingFirst ? 'submitted' : 'completed',
      startedAtIso: '2026-11-17T14:00:00.000Z',
      collectionDeadlineAtIso: '2026-11-17T14:15:00.000Z',
      resultsDeadlineAtIso: '2026-11-17T14:16:30.000Z',
      resultRevision: 1,
      reading: const DiagnosticSkillOutcomeSnapshot(
        skill: 'reading',
        status: DiagnosticSkillStatus.provisional,
        suggestedPracticeLevel:
            'Suggested practice: Intermediate (B1–B2 focus)',
        suggestedTier: AuthoringTier.b2,
        observations: ['Reading placement ready immediately.'],
      ),
      listening: const DiagnosticSkillOutcomeSnapshot(
        skill: 'listening',
        status: DiagnosticSkillStatus.provisional,
        suggestedPracticeLevel:
            'Suggested practice: Intermediate (B1–B2 focus)',
        suggestedTier: AuthoringTier.b1,
        observations: ['Listening placement ready immediately.'],
      ),
      writing: DiagnosticSkillOutcomeSnapshot(
        skill: 'writing',
        status: returnPendingFirst
            ? DiagnosticSkillStatus.pending
            : DiagnosticSkillStatus.provisional,
        suggestedPracticeLevel: returnPendingFirst
            ? null
            : 'Suggested practice: Intermediate (B1–B2 focus)',
        observations: returnPendingFirst
            ? const <String>[]
            : const <String>['Clear everyday sentences.'],
      ),
      speaking: DiagnosticSkillOutcomeSnapshot(
        skill: 'speaking',
        status: speakingSkipped
            ? DiagnosticSkillStatus.skipped
            : DiagnosticSkillStatus.unscorable,
        quotaRefunded: !speakingSkipped,
        observations: const ['Clip was silent or unclear.'],
      ),
      recommendedActionTitle: 'Build everyday Reading stamina',
      recommendedActionDescription:
          'Practice short 3-question Reading tasks first.',
      recommendedTargetSkill: 'reading',
    ),
  );

  @override
  Future<Result<DiagnosticSessionSnapshot, Failure>> fetchSession({
    required String diagId,
  }) {
    fetchCalls += 1;
    if (fetchCalls >= 2) {
      returnPendingFirst = false;
    }
    return submitSession(
      diagId: diagId,
      examId: 'ielts_academic',
      mode: DiagnosticMode.standard,
      readingHistory: const [],
      readingStopReason: DiagnosticStopReason.samplingComplete,
      readingSkipped: false,
      listeningHistory: const [],
      listeningStopReason: DiagnosticStopReason.samplingComplete,
      listeningSkipped: false,
    );
  }
}

void main() {
  group('Diagnostic Notifier Lifecycle, Routing & Budget Tests', () {
    test(
      'intro preflight handles denied mic cleanly & "I don\'t know" steps down without guessing penalty',
      () async {
        final db = createTestDatabase();
        addTearDown(db.close);
        final recorder = FakeAudioRecorderGateway()..permissionGranted = false;
        final player = FakeAudioPlayerGateway();
        final gateway = FakeDiagnosticGateway();
        final mutableClock = _MutableClock(DateTime.utc(2026, 11, 17, 14));

        final container = ProviderContainer(
          overrides: [
            editionConfigProvider.overrideWithValue(
              EditionConfig.globalDefault,
            ),
            clockProvider.overrideWithValue(mutableClock.asClock()),
            appDatabaseProvider.overrideWithValue(db),
            entropySourceProvider.overrideWithValue(FixedEntropySource()),
            secureStorageGatewayProvider.overrideWithValue(
              InMemorySecureStorageGateway(),
            ),
            billingGatewayProvider.overrideWithValue(
              const FakeBillingGateway(),
            ),
            gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
            audioRecorderGatewayProvider.overrideWithValue(recorder),
            audioPlayerGatewayProvider.overrideWithValue(player),
            diagnosticGatewayProvider.overrideWithValue(gateway),
          ],
        );
        addTearDown(container.dispose);

        final notifier = container.read(diagnosticNotifierProvider.notifier);
        await notifier.prepareIntro(examIdOverride: 'toefl');
        expect(container.read(diagnosticNotifierProvider).examId, 'toefl');
        expect(container.read(diagnosticNotifierProvider).bank, isNotNull);

        await notifier.runMicPreflightCheck();
        expect(
          container.read(diagnosticNotifierProvider).micStatus,
          MicPreflightStatus.permissionDenied,
        );

        notifier.setSpeakingOptOut(
          optOut: true,
          reason: NoEvidenceReason.micDenied,
        );
        final diagId = await notifier.startDiagnosticSession();
        expect(diagId, isNotNull);
        expect(
          container.read(diagnosticNotifierProvider).stage,
          DiagnosticFlowStage.readingExample,
        );

        // Start live Reading -> begins at B1.
        notifier.startLiveReadingBlocks();
        final block1 = container.read(diagnosticNotifierProvider).activeBlock!;
        expect(block1.tier, AuthoringTier.b1);

        // Marking "I don't know" records noEvidence(dontKnow) and steps to A2 cleanly.
        notifier.markCurrentBlockDontKnow();
        final stateAfterDontKnow = container.read(diagnosticNotifierProvider);
        expect(stateAfterDontKnow.readingHistory, hasLength(1));
        expect(
          stateAfterDontKnow.readingHistory.first.noEvidenceReason,
          NoEvidenceReason.dontKnow,
        );
        expect(stateAfterDontKnow.activeBlock?.tier, AuthoringTier.a2);
      },
    );

    test(
      'listening playback failure records playbackFailed & writing draft flushes immediately',
      () async {
        final db = createTestDatabase();
        addTearDown(db.close);
        final player = FakeAudioPlayerGateway();
        final gateway = FakeDiagnosticGateway();
        final mutableClock = _MutableClock(DateTime.utc(2026, 11, 17, 14));

        final container = ProviderContainer(
          overrides: [
            editionConfigProvider.overrideWithValue(
              EditionConfig.globalDefault,
            ),
            clockProvider.overrideWithValue(mutableClock.asClock()),
            appDatabaseProvider.overrideWithValue(db),
            entropySourceProvider.overrideWithValue(FixedEntropySource()),
            secureStorageGatewayProvider.overrideWithValue(
              InMemorySecureStorageGateway(),
            ),
            billingGatewayProvider.overrideWithValue(
              const FakeBillingGateway(),
            ),
            gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
            audioRecorderGatewayProvider.overrideWithValue(
              FakeAudioRecorderGateway(),
            ),
            audioPlayerGatewayProvider.overrideWithValue(player),
            diagnosticGatewayProvider.overrideWithValue(gateway),
          ],
        );
        addTearDown(container.dispose);

        final notifier = container.read(diagnosticNotifierProvider.notifier);
        await notifier.prepareIntro();
        final diagId = await notifier.startDiagnosticSession();
        expect(diagId, isNotNull);

        // Simulate media failure on Part 1 load.
        player.failure = const NetworkFailure('Media stream unreachable');
        notifier
          ..skipObjectiveStage() // Skip reading -> transitionToListening
          ..skipTransitionNow() // -> listeningExample
          ..startLiveListeningBlocks(); // -> listeningBlock (B1)
        await Future<void>.delayed(Duration.zero);
        expect(container.read(diagnosticNotifierProvider).audioFailed, isTrue);

        // Recover gracefully via "Continue without Listening" -> records playbackFailed.
        notifier.abandonListeningDueToPlaybackFailure();
        final afterFail = container.read(diagnosticNotifierProvider);
        expect(
          afterFail.listeningHistory.last.noEvidenceReason,
          NoEvidenceReason.playbackFailed,
        );

        // Advance to Writing and flush draft to Drift immediately.
        notifier
          ..skipObjectiveStage()
          ..skipTransitionNow();
        expect(
          container.read(diagnosticNotifierProvider).stage,
          DiagnosticFlowStage.writingBase,
        );

        notifier.updateWritingBaseText(
          'I visit neighborhood libraries twice a week to borrow quiet study books.',
        );
        await notifier.flushPendingDraft();

        final persisted = await db.attemptDao.getDiagnosticSession(diagId!);
        expect(persisted, isNotNull);
        expect(
          persisted!.stateJson,
          contains('borrow quiet study books'),
        );
      },
    );

    test(
      'results async polling updates pending Writing & single-skill retake preserves other 3 skills',
      () async {
        final db = createTestDatabase();
        addTearDown(db.close);
        final gateway = _PollingDiagnosticGateway();

        final container = ProviderContainer(
          overrides: [
            editionConfigProvider.overrideWithValue(
              EditionConfig.globalDefault,
            ),
            clockProvider.overrideWithValue(
              Clock.fixed(DateTime.utc(2026, 11, 17, 14)),
            ),
            appDatabaseProvider.overrideWithValue(db),
            entropySourceProvider.overrideWithValue(FixedEntropySource()),
            secureStorageGatewayProvider.overrideWithValue(
              InMemorySecureStorageGateway(),
            ),
            billingGatewayProvider.overrideWithValue(
              const FakeBillingGateway(),
            ),
            gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
            audioRecorderGatewayProvider.overrideWithValue(
              FakeAudioRecorderGateway(),
            ),
            audioPlayerGatewayProvider.overrideWithValue(
              FakeAudioPlayerGateway(),
            ),
            diagnosticGatewayProvider.overrideWithValue(gateway),
          ],
        );
        addTearDown(container.dispose);

        final notifier = container.read(diagnosticNotifierProvider.notifier);
        await notifier.prepareIntro();
        await notifier.startDiagnosticSession();

        final initialSnap = await notifier.submitAllAndGoResults();
        expect(
          container.read(diagnosticNotifierProvider).sessionSnapshot,
          isNotNull,
        );
        // Launching with fixed clock sets resultsRemainingSeconds = 90.
        expect(
          container.read(diagnosticNotifierProvider).resultsRemainingSeconds,
          90,
        );
        expect(initialSnap!.writing.status, DiagnosticSkillStatus.pending);
        expect(initialSnap.speaking.status, DiagnosticSkillStatus.unscorable);
        expect(initialSnap.speaking.quotaRefunded, isTrue);

        // Subsequent poll completes Writing cleanly while Speaking remains unscorable.
        await notifier.refreshResults();
        await notifier.refreshResults();
        final updatedSnap = container
            .read(diagnosticNotifierProvider)
            .sessionSnapshot!;
        expect(updatedSnap.writing.status, DiagnosticSkillStatus.provisional);
        expect(updatedSnap.speaking.status, DiagnosticSkillStatus.unscorable);

        // Launch single-skill alternate retake for Speaking only.
        await notifier.startSingleSkillRetake('speaking');
        final retakeState = container.read(diagnosticNotifierProvider);
        expect(retakeState.retakeSkill, 'speaking');
        expect(retakeState.isAlternateForm, isTrue);
        expect(retakeState.stage, DiagnosticFlowStage.speakingPrep);
      },
    );

    test(
      'listening auto-plays Part 1 & Part 2 cleanly and unlocks button after completion or blocked autoplay',
      () async {
        final db = createTestDatabase();
        addTearDown(db.close);
        final player = FakeAudioPlayerGateway();
        final gateway = FakeDiagnosticGateway();

        final container = ProviderContainer(
          overrides: [
            editionConfigProvider.overrideWithValue(
              EditionConfig.globalDefault,
            ),
            clockProvider.overrideWithValue(fixedTestClock()),
            appDatabaseProvider.overrideWithValue(db),
            entropySourceProvider.overrideWithValue(FixedEntropySource()),
            secureStorageGatewayProvider.overrideWithValue(
              InMemorySecureStorageGateway(),
            ),
            billingGatewayProvider.overrideWithValue(
              const FakeBillingGateway(),
            ),
            gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
            audioRecorderGatewayProvider.overrideWithValue(
              FakeAudioRecorderGateway(),
            ),
            audioPlayerGatewayProvider.overrideWithValue(player),
            diagnosticGatewayProvider.overrideWithValue(gateway),
          ],
        );
        addTearDown(container.dispose);

        final notifier = container.read(diagnosticNotifierProvider.notifier);
        await notifier.prepareIntro();
        await notifier.startDiagnosticSession();

        // Advance into Listening Part 1: audio auto-plays and completes without getting stuck.
        notifier
          ..skipObjectiveStage()
          ..skipTransitionNow()
          ..startLiveListeningBlocks();
        await Future<void>.delayed(Duration.zero);

        final part1State = container.read(diagnosticNotifierProvider);
        expect(part1State.stage, DiagnosticFlowStage.listeningBlock);
        expect(part1State.isAudioPlaying, isFalse);
        expect(part1State.audioCompleted, isTrue);
        expect(part1State.audioPlayCount, 1);

        // Simulate browser blocking autoplay on Part 2: button stays enabled (count == 0, no error).
        player.playFailure = const StorageFailure('NotAllowedError');
        notifier
          ..selectBlockOption(questionIndex: 0, optionIndex: 1)
          ..selectBlockOption(questionIndex: 1, optionIndex: 0)
          ..submitCurrentObjectiveBlock();
        await Future<void>.delayed(Duration.zero);

        final part2BlockedState = container.read(diagnosticNotifierProvider);
        expect(part2BlockedState.listeningHistory, hasLength(1));
        expect(part2BlockedState.isAudioPlaying, isFalse);
        expect(part2BlockedState.audioPlayCount, 0);
        expect(part2BlockedState.audioFailed, isFalse);

        // Clearing browser block allows manual tap on Play clip to succeed & finish cleanly.
        player.playFailure = null;
        await notifier.playCurrentListeningBlockAudio();
        await Future<void>.delayed(Duration.zero);

        final part2PlayedState = container.read(diagnosticNotifierProvider);
        expect(part2PlayedState.isAudioPlaying, isFalse);
        expect(part2PlayedState.audioCompleted, isTrue);
        expect(part2PlayedState.audioPlayCount, 1);
      },
    );
  });

  group('Diagnostic Screens Widget, Narrow Viewport & Text Scaling Tests', () {
    testWidgets(
      'onboarding CTA navigates to /diagnostic/intro cleanly',
      (tester) async {
        final db = createTestDatabase();
        final gateway = FakeDiagnosticGateway();

        await tester.pumpWidget(
          ProviderScope(
            retry: (count, error) => null,
            overrides: [
              editionConfigProvider.overrideWithValue(
                EditionConfig.globalDefault,
              ),
              clockProvider.overrideWithValue(fixedTestClock()),
              appDatabaseProvider.overrideWithValue(db),
              entropySourceProvider.overrideWithValue(FixedEntropySource()),
              secureStorageGatewayProvider.overrideWithValue(
                InMemorySecureStorageGateway(),
              ),
              billingGatewayProvider.overrideWithValue(
                const FakeBillingGateway(),
              ),
              gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
              audioRecorderGatewayProvider.overrideWithValue(
                FakeAudioRecorderGateway(),
              ),
              audioPlayerGatewayProvider.overrideWithValue(
                FakeAudioPlayerGateway(),
              ),
              diagnosticGatewayProvider.overrideWithValue(gateway),
            ],
            child: const MockzaApp(),
          ),
        );

        await tester.pumpAndSettle();

        await tester.scrollUntilVisible(find.text('Continue'), 200);
        await tester.tap(find.text('Continue'));
        await tester.pumpAndSettle();

        expect(find.text('Start with a Free ~10–15 Min Check'), findsOneWidget);
        await tester.scrollUntilVisible(find.text('Get Started'), 200);
        await tester.tap(find.text('Get Started'));
        await tester.pumpAndSettle();

        expect(find.text('Quick Starting Check'), findsOneWidget);
        expect(find.text('Start check'), findsOneWidget);
        expect(find.text('Continue without Speaking'), findsOneWidget);
        expect(find.text('Do this later'), findsOneWidget);
        expect(tester.takeException(), isNull);

        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump(const Duration(milliseconds: 1));
        await tester.runAsync(db.close);
      },
    );

    testWidgets(
      'intro screen renders without overflow at 320dp and 2.0x text scale',
      (tester) async {
        tester.view.physicalSize = const Size(320, 720);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        final db = createTestDatabase();
        await tester.pumpWidget(
          ProviderScope(
            retry: (count, error) => null,
            overrides: [
              editionConfigProvider.overrideWithValue(
                EditionConfig.globalDefault,
              ),
              clockProvider.overrideWithValue(fixedTestClock()),
              appDatabaseProvider.overrideWithValue(db),
              entropySourceProvider.overrideWithValue(FixedEntropySource()),
              secureStorageGatewayProvider.overrideWithValue(
                InMemorySecureStorageGateway(),
              ),
              billingGatewayProvider.overrideWithValue(
                const FakeBillingGateway(),
              ),
              gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
              audioRecorderGatewayProvider.overrideWithValue(
                FakeAudioRecorderGateway(),
              ),
              audioPlayerGatewayProvider.overrideWithValue(
                FakeAudioPlayerGateway(),
              ),
              diagnosticGatewayProvider.overrideWithValue(
                FakeDiagnosticGateway(),
              ),
            ],
            child: MediaQuery(
              data: const MediaQueryData(
                size: Size(320, 720),
                textScaler: TextScaler.linear(2),
              ),
              child: MaterialApp(
                theme: AppTheme.light(),
                home: const DiagnosticIntroScreen(),
              ),
            ),
          ),
        );

        await tester.pumpAndSettle();
        expect(find.text('Start check'), findsOneWidget);
        expect(tester.takeException(), isNull);

        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump(const Duration(milliseconds: 1));
        await tester.runAsync(db.close);
      },
    );

    testWidgets(
      "results screen renders non-zero failure states & opens About Your Exam's Scores",
      (tester) async {
        final db = createTestDatabase();
        final gateway = _PollingDiagnosticGateway();

        final container = ProviderContainer(
          overrides: [
            editionConfigProvider.overrideWithValue(
              EditionConfig.globalDefault,
            ),
            clockProvider.overrideWithValue(fixedTestClock()),
            appDatabaseProvider.overrideWithValue(db),
            entropySourceProvider.overrideWithValue(FixedEntropySource()),
            secureStorageGatewayProvider.overrideWithValue(
              InMemorySecureStorageGateway(),
            ),
            billingGatewayProvider.overrideWithValue(
              const FakeBillingGateway(),
            ),
            gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
            audioRecorderGatewayProvider.overrideWithValue(
              FakeAudioRecorderGateway(),
            ),
            audioPlayerGatewayProvider.overrideWithValue(
              FakeAudioPlayerGateway(),
            ),
            diagnosticGatewayProvider.overrideWithValue(gateway),
          ],
        );

        await tester.runAsync(() async {
          final n = container.read(diagnosticNotifierProvider.notifier);
          await n.prepareIntro();
          await n.startDiagnosticSession();
          await n.submitAllAndGoResults();
        });

        await tester.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: MaterialApp(
              theme: AppTheme.light(),
              home: DiagnosticResultsScreen(
                diagId: container.read(diagnosticNotifierProvider).diagId,
              ),
            ),
          ),
        );

        await tester.pumpAndSettle();

        expect(find.text('Your Starting Practice Placement'), findsOneWidget);
        expect(find.text('Audio/response unclear'), findsOneWidget);
        expect(find.text('Credit refunded'), findsOneWidget);
        expect(find.text("About Your Exam's Scores"), findsOneWidget);

        await tester.scrollUntilVisible(
          find.text("About Your Exam's Scores"),
          200,
        );
        await tester.tap(find.text("About Your Exam's Scores"));
        await tester.pumpAndSettle();

        expect(find.text("About Your Exam's Scores"), findsAtLeastNWidgets(2));
        expect(tester.takeException(), isNull);

        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump(const Duration(milliseconds: 1));
        await tester.runAsync(db.close);
        container.dispose();
      },
    );

    testWidgets(
      'session screen displays worked example and live objective block',
      (tester) async {
        final db = createTestDatabase();
        final gateway = FakeDiagnosticGateway();

        final container = ProviderContainer(
          overrides: [
            editionConfigProvider.overrideWithValue(
              EditionConfig.globalDefault,
            ),
            clockProvider.overrideWithValue(fixedTestClock()),
            appDatabaseProvider.overrideWithValue(db),
            entropySourceProvider.overrideWithValue(FixedEntropySource()),
            secureStorageGatewayProvider.overrideWithValue(
              InMemorySecureStorageGateway(),
            ),
            billingGatewayProvider.overrideWithValue(
              const FakeBillingGateway(),
            ),
            gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
            audioRecorderGatewayProvider.overrideWithValue(
              FakeAudioRecorderGateway(),
            ),
            audioPlayerGatewayProvider.overrideWithValue(
              FakeAudioPlayerGateway(),
            ),
            diagnosticGatewayProvider.overrideWithValue(gateway),
          ],
        );

        late String diagId;
        await tester.runAsync(() async {
          final n = container.read(diagnosticNotifierProvider.notifier);
          await n.prepareIntro();
          diagId = (await n.startDiagnosticSession())!;
        });

        await tester.pumpWidget(
          UncontrolledProviderScope(
            container: container,
            child: MaterialApp(
              theme: AppTheme.light(),
              home: DiagnosticSessionScreen(diagId: diagId),
            ),
          ),
        );

        await tester.pumpAndSettle();
        expect(
          find.text('Example — does not affect your level'),
          findsOneWidget,
        );
        await tester.scrollUntilVisible(find.text('Start Reading'), 200);
        await tester.tap(find.text('Start Reading'));
        await tester.pumpAndSettle();

        expect(find.text("I don't know"), findsOneWidget);
        expect(tester.takeException(), isNull);

        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump(const Duration(milliseconds: 1));
        await tester.runAsync(db.close);
        container.dispose();
      },
    );

    testWidgets(
      'intro screen fits single 390x844 viewport with zero scroll & opens mode sheet',
      (tester) async {
        tester.view.physicalSize = const Size(390, 844);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        final db = createTestDatabase();
        await tester.pumpWidget(
          ProviderScope(
            retry: (count, error) => null,
            overrides: [
              editionConfigProvider.overrideWithValue(
                EditionConfig.globalDefault,
              ),
              clockProvider.overrideWithValue(fixedTestClock()),
              appDatabaseProvider.overrideWithValue(db),
              entropySourceProvider.overrideWithValue(FixedEntropySource()),
              secureStorageGatewayProvider.overrideWithValue(
                InMemorySecureStorageGateway(),
              ),
              billingGatewayProvider.overrideWithValue(
                const FakeBillingGateway(),
              ),
              gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
              audioRecorderGatewayProvider.overrideWithValue(
                FakeAudioRecorderGateway(),
              ),
              audioPlayerGatewayProvider.overrideWithValue(
                FakeAudioPlayerGateway(),
              ),
              diagnosticGatewayProvider.overrideWithValue(
                FakeDiagnosticGateway(),
              ),
            ],
            child: MaterialApp(
              theme: AppTheme.dark(),
              home: const DiagnosticIntroScreen(),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.text('Quick Sound & Mic Check'), findsOneWidget);
        expect(find.text('Test sound'), findsOneWidget);
        expect(find.text('Test mic'), findsOneWidget);
        expect(find.text('Standard (15m) ▾'), findsOneWidget);
        expect(find.text('Start check'), findsOneWidget);

        final scrollable = tester.state<ScrollableState>(
          find.byType(Scrollable).first,
        );
        expect(scrollable.position.maxScrollExtent, 0.0);

        await tester.tap(find.text('Standard (15m) ▾'));
        await tester.pumpAndSettle();
        expect(find.text('Accessibility & Timing Options'), findsOneWidget);
        expect(tester.takeException(), isNull);

        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump(const Duration(milliseconds: 1));
        await tester.runAsync(db.close);
      },
    );
  });
}

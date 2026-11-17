import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/core/diagnostic/diagnostic_budget.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_notifier.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_providers.dart';

import '../harness/e2e_app_harness.dart';

/// Page-object Robot driving the full 4-skill Quick Starting Check workflow.
final class DiagnosticRobot {
  /// Creates a [DiagnosticRobot] bound to [harness].
  const new(this.harness);

  /// Active E2E test harness.
  final E2eAppHarness harness;

  /// Verifies `DiagnosticIntroScreen` is active and bank is loaded.
  void expectIntroVisible() {
    expect(find.text('Quick Starting Check'), findsWidgets);
    expect(find.text('Start check'), findsOneWidget);
  }

  /// Taps `'Start check'` to open the active diagnostic workspace.
  Future<void> tapStartCheck(WidgetTester tester) async {
    await harness.tapVisible(tester, find.text('Start check'));
    await harness.pumpFrames(tester, count: 6);
  }

  /// Reads current [DiagnosticState] from the live container.
  DiagnosticState readState() =>
      harness.container.read(diagnosticNotifierProvider);

  /// Completes a Reading worked example while verifying timer stays paused.
  Future<void> verifyWorkedExampleDoesNotDrainTimer(WidgetTester tester) async {
    expect(find.text('Example — does not affect your level'), findsOneWidget);
    final beforeGlobal = readState().globalRemainingSeconds;
    expect(beforeGlobal, DiagnosticBudget.collectionTotalSeconds);

    // Advance simulated clock 10 seconds during unscored example; budget must stay untouched.
    harness.clock.advance(const Duration(seconds: 10));
    harness.container
        .read(diagnosticNotifierProvider.notifier)
        .tickCollectionClockForTesting();
    await tester.pump();
    expect(readState().globalRemainingSeconds, beforeGlobal);
  }

  /// Taps `'Start Reading'` on the Reading worked example.
  Future<void> startReadingFromExample(WidgetTester tester) async {
    await harness.tapVisible(tester, find.text('Start Reading'));
    await harness.pumpFrames(tester, count: 4);
  }

  /// Answers both questions in the current objective block (mobile or tablet)
  /// and taps `'Next'`.
  Future<void> answerCurrentObjectiveBlockAndAdvance(
    WidgetTester tester,
  ) async {
    final state = readState();
    final block = state.activeBlock;
    expect(block, isNotNull);
    final q0FirstOpt = block!.questions[0].options.first;
    await harness.scrollToAndTap(tester, find.text(q0FirstOpt));

    // Wait frame for auto-advance to Q2 on compact phones; ensure Q2 pill clicked if needed.
    await tester.pump(const Duration(milliseconds: 50));
    if (find.text('Question 2').evaluate().isNotEmpty &&
        readState().selectedOptionQ0 != null) {
      final q2State = readState();
      if (q2State.selectedOptionQ1 == null) {
        final q1Opt = q2State.activeBlock!.questions[1].options.first;
        if (find.text(q1Opt).evaluate().isEmpty) {
          await harness.tapVisible(tester, find.text('Question 2'));
        }
        await harness.scrollToAndTap(
          tester,
          find.text(q2State.activeBlock!.questions[1].options.first),
        );
      }
    } else {
      final q1FirstOpt = readState().activeBlock!.questions[1].options.first;
      await harness.scrollToAndTap(tester, find.text(q1FirstOpt));
    }

    await harness.tapVisible(tester, find.text('Next'));
    await harness.pumpFrames(tester, count: 4);
  }

  /// Skips remaining blocks in the active Reading or Listening stage if still in it.
  Future<void> skipActiveObjectiveStage(WidgetTester tester) async {
    final skipReading = find.text('Skip Reading');
    if (skipReading.evaluate().isNotEmpty) {
      await harness.tapVisible(tester, skipReading);
      await harness.pumpFrames(tester, count: 4);
      return;
    }
    final skipListening = find.text('Skip Listening');
    if (skipListening.evaluate().isNotEmpty) {
      await harness.tapVisible(tester, skipListening);
      await harness.pumpFrames(tester, count: 4);
    }
  }

  /// Skips interstitial countdown screen immediately using `'Continue now'`.
  Future<void> continueThroughTransition(WidgetTester tester) async {
    if (find.text('Continue now').evaluate().isNotEmpty) {
      await harness.tapVisible(tester, find.text('Continue now'));
      await harness.pumpFrames(tester, count: 4);
    }
  }

  /// Taps `'Start Listening'` on the Listening worked example.
  Future<void> startListeningFromExample(WidgetTester tester) async {
    await harness.tapVisible(tester, find.text('Start Listening'));
    await harness.pumpFrames(tester);
  }

  /// Enters base Writing text, continues to follow-up, verifies fresh 75s timer,
  /// enters follow-up text, and advances to Speaking transition.
  Future<void> completeWritingWithFreshFollowUpClock(
    WidgetTester tester,
  ) async {
    final baseField = find.byType(TextField).first;
    await tester.ensureVisible(baseField);
    await tester.enterText(
      baseField,
      'Cities with reliable public transit let residents commute cleanly without daily traffic delays.',
    );
    await tester.pump();
    await harness.tapVisible(tester, find.text('Continue'));
    await harness.pumpFrames(tester, count: 4);

    // Follow-up Writing must always receive a fresh dedicated 75s clock.
    expect(readState().stage, DiagnosticFlowStage.writingFollowUp);
    expect(
      readState().stageRemainingSeconds,
      DiagnosticBudget.writingFollowUpMaxSeconds,
    );

    final followField = find.byType(TextField).first;
    await tester.ensureVisible(followField);
    await tester.enterText(
      followField,
      'Expanding evening bus frequency makes late shifts safer and easier.',
    );
    await tester.pump();
    await harness.tapVisible(tester, find.text('Next skill'));
    await harness.pumpFrames(tester, count: 4);
  }

  /// Records Part 1 & Part 2 Speaking turns and submits the full 4-skill check.
  Future<void> completeSpeakingAndSubmit(WidgetTester tester) async {
    expect(find.text('Start speaking now'), findsOneWidget);
    await harness.tapVisible(tester, find.text('Start speaking now'));
    await harness.pumpFrames(tester, count: 4);

    expect(find.text('Done speaking'), findsOneWidget);
    await harness.tapVisible(tester, find.text('Done speaking'));
    await harness.pumpFrames(tester, count: 6);

    // If follow-up speaking appeared, record or submit cleanly.
    final recordFollow = find.textContaining('Record follow-up');
    if (recordFollow.evaluate().isNotEmpty) {
      await harness.tapVisible(tester, recordFollow);
      await harness.pumpFrames(tester, count: 4);
      await harness.tapVisible(tester, find.text('Done speaking'));
      await harness.pumpFrames(tester, count: 10);
    }

    final finishBtn = find.text('Finish & See Results');
    if (finishBtn.evaluate().isNotEmpty) {
      await harness.tapVisible(tester, finishBtn);
      await harness.pumpFrames(tester, count: 10);
    }
  }

  /// Verifies `DiagnosticResultsScreen` displays placement outcomes and triggers
  /// single-skill retake for Reading cleanly.
  Future<void> verifyResultsAndTriggerRetake(WidgetTester tester) async {
    expect(find.text('Your Starting Practice Placement'), findsOneWidget);
    expect(find.text('Skill Breakdown'), findsOneWidget);

    await harness.scrollToAndTap(
      tester,
      find.text('Check this skill again').first,
    );
    await harness.pumpFrames(tester, count: 6);
    expect(readState().retakeSkill, 'reading');
  }
}

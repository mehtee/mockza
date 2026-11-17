import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../harness/e2e_app_harness.dart';

/// Page-object Robot driving Practice Hub, Simulators, Micro-Drills, Full Mock,
/// and Evaluation Review workflows.
final class PracticeAndSimsRobot {
  /// Creates a [PracticeAndSimsRobot] bound to [harness].
  const new(this.harness);

  /// Active E2E test harness.
  final E2eAppHarness harness;

  /// Verifies Practice Hub is visible and selects `'Exam Mode'` or `'Study Mode'`.
  Future<void> selectPracticeMode(
    WidgetTester tester, {
    required bool examMode,
  }) async {
    expect(find.text('Practice Hub'), findsOneWidget);
    await harness.scrollToAndTap(
      tester,
      find.text(examMode ? 'Exam Mode' : 'Study Mode'),
      delta: -250,
    );
  }

  /// Launches a simulator card from Practice Hub by its card title.
  Future<void> openSimulator(WidgetTester tester, String cardTitle) async {
    await harness.scrollToAndTap(tester, find.text(cardTitle));
    await harness.pumpFrames(tester, count: 6);
  }

  /// Filters Practice Hub by skill chip and opens `PracticeSetupScreen`.
  Future<void> openSetupForSkill(WidgetTester tester, String skillChip) async {
    await harness.scrollToAndTap(
      tester,
      find.text(skillChip),
      delta: -250,
    );
    await harness.scrollToAndTap(
      tester,
      find.text('Browse & Configure ${skillChip.toUpperCase()} Packs'),
    );
    await harness.pumpFrames(tester);
    expect(
      find.text('${skillChip.toUpperCase()} Practice Setup'),
      findsOneWidget,
    );
  }

  /// Drives `ReadingSimScreen` through Focused + All modes, 44dp palette, and submission.
  Future<void> completeReadingSimAndSaveMistake(WidgetTester tester) async {
    // Switch to Questions tab on narrow phones if Passage tab is shown.
    final questionsTab = find.textContaining('Questions (');
    if (questionsTab.evaluate().isNotEmpty) {
      await harness.tapVisible(tester, questionsTab);
    }

    // Q1 TFNG in Focused mode -> select TRUE, tap Next -> Q2.
    expect(find.text('TRUE'), findsOneWidget);
    await harness.tapVisible(tester, find.text('TRUE'));
    await harness.tapVisible(tester, find.text('Next'));

    // Intentionally miss Q2 (`A.` instead of `B.`) so Mistake Capture is tested on Review.
    await harness.tapVisible(
      tester,
      find.textContaining('Underground tunnels'),
    );

    // Verify 44dp palette pill jump to Q3, then test 'All' mode toggle and back.
    await harness.tapVisible(tester, find.text('3'));
    await harness.tapVisible(tester, find.text('All'));
    expect(find.text('All 3 questions'), findsOneWidget);
    await harness.tapVisible(tester, find.text('Focused'));

    // Answer Q3 gap fill.
    final gapField = find.byType(TextField).first;
    await tester.ensureVisible(gapField);
    await tester.enterText(gapField, 'demand');
    await tester.pump();

    // Submit Reading test.
    await harness.tapVisible(tester, find.text('Submit Test'));
    await harness.pumpFrames(tester, count: 8);

    // On Evaluation Review: switch to Questions tab & Save missed item to Vocab Deck.
    expect(find.text('Evaluation Review'), findsOneWidget);
    await harness.tapVisible(tester, find.text('Questions'));
    await harness.pumpFrames(tester, count: 4);
    await harness.scrollToAndTap(tester, find.text('Save to Deck'));
    await harness.pumpFrames(tester, count: 4);
    expect(find.text('Saved'), findsWidgets);
  }

  /// Drives `ListeningSimScreen` (Study transcript toggle, audio play, Focused Q nav, submit).
  Future<void> completeListeningSim(
    WidgetTester tester, {
    required bool expectStudyTranscriptToggle,
  }) async {
    if (find.text('Start Audio').evaluate().isNotEmpty) {
      await harness.tapVisible(tester, find.text('Start Audio'));
    } else {
      await harness.tapVisible(tester, find.byTooltip('Play audio'));
    }

    if (expectStudyTranscriptToggle) {
      await harness.tapVisible(tester, find.byTooltip('Toggle transcript'));
      expect(find.textContaining('second floor'), findsOneWidget);
      await harness.tapVisible(tester, find.byTooltip('Toggle transcript'));
    }

    // Answer Q1 in Focused mode, advance to Q2, fill answer, and submit.
    await harness.tapVisible(tester, find.textContaining('Second floor'));
    await harness.tapVisible(tester, find.text('Next'));
    final gapField = find.byType(TextField).first;
    await tester.ensureVisible(gapField);
    await tester.enterText(gapField, '8:30');
    await tester.pump();

    await harness.tapVisible(tester, find.text('Submit Test'));
    await harness.pumpFrames(tester, count: 8);
    expect(find.text('Evaluation Review'), findsOneWidget);
  }

  /// Completes the 2-item seeded Micro-Drill workout end-to-end.
  Future<void> completeMicroDrill(WidgetTester tester) async {
    await harness.scrollToAndTap(tester, find.text('TFNG Precision Sprint'));
    await harness.pumpFrames(tester, count: 6);

    for (var step = 0; step < 2; step += 1) {
      await harness.scrollToAndTap(tester, find.text('TRUE'));
      await harness.tapVisible(tester, find.text('Check Answer'));
      final nextLabel = step == 0 ? 'Next Exercise' : 'Complete Workout';
      await harness.tapVisible(tester, find.text(nextLabel));
    }

    expect(find.textContaining('Workout Complete'), findsOneWidget);
  }

  /// Drives `WritingSimScreen` (prompt collapse, Task 2 switch, essay entry, AI evaluation review).
  Future<void> completeWritingSimToAiReview(WidgetTester tester) async {
    // Collapse and re-expand prompt card.
    await harness.tapVisible(tester, find.text('Hide prompt'));
    expect(find.text('Show prompt'), findsOneWidget);
    await harness.tapVisible(tester, find.text('Show prompt'));

    // Switch to Task 2 tab.
    await harness.tapVisible(tester, find.textContaining('Task 2'));

    final essayField = find.byType(TextField).first;
    await tester.ensureVisible(essayField);
    await tester.enterText(
      essayField,
      'Cities benefit tremendously when municipal planners prioritize rapid rail lines over expanding multi-lane highways because public transit moves far more commuters efficiently while reducing urban carbon emissions and street congestion every single day.',
    );
    await tester.pump();

    await harness.tapVisible(tester, find.text('Submit for AI Evaluation'));
    await harness.pumpFrames(tester, count: 10);

    expect(find.text('Evaluation Review'), findsOneWidget);
    expect(find.text('7.0'), findsWidgets);
  }

  /// Drives `SpeakingSimScreen` (record turn 1, stop, submit -> AI Rubric Review).
  Future<void> completeSpeakingSimToAiReview(WidgetTester tester) async {
    expect(find.text('Start Recording Answer'), findsOneWidget);
    await harness.tapVisible(tester, find.text('Start Recording Answer'));
    await harness.pumpFrames(tester, count: 4);

    expect(find.text('Finish Recording Turn'), findsOneWidget);
    await harness.tapVisible(tester, find.text('Finish Recording Turn'));
    await harness.pumpFrames(tester);

    final submitBtn = find.textContaining('Submit');
    await harness.tapVisible(tester, submitBtn);
    await harness.pumpFrames(tester, count: 12);

    expect(find.text('Evaluation Review'), findsOneWidget);
    expect(find.text('7.0'), findsWidgets);
  }

  /// Opens `FullMockScreen` from Practice Hub and verifies stage list.
  Future<void> openAndVerifyFullMockPlanner(WidgetTester tester) async {
    await harness.scrollToAndTap(tester, find.text('Open Full Mock Planner'));
    await harness.pumpFrames(tester, count: 6);
    expect(find.text('1. Listening Test'), findsOneWidget);
    expect(find.text('2. Reading Test'), findsOneWidget);
    expect(find.text('3. Writing Task 1'), findsOneWidget);
    await harness.scrollToVisible(tester, find.text('4. Writing Task 2'));
    expect(find.text('4. Writing Task 2'), findsOneWidget);
    await harness.scrollToVisible(tester, find.text('5. Speaking Interview'));
    expect(find.text('5. Speaking Interview'), findsOneWidget);
  }
}

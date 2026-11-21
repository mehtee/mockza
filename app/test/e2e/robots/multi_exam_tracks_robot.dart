import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../harness/e2e_app_harness.dart';
import 'practice_and_sims_robot.dart';
import 'shell_and_home_robot.dart';

/// Page-object Robot driving cross-exam track switching and simulator workflows
/// across TOEFL iBT (2026), PTE Academic, and Duolingo English Test (DET).
final class MultiExamTracksRobot {
  /// Creates a [MultiExamTracksRobot] bound to [harness], [shell], and [practice].
  const new(this.harness, this.shell, this.practice);

  /// Active E2E test harness.
  final E2eAppHarness harness;

  /// Shell & Home navigation robot.
  final ShellAndHomeRobot shell;

  /// Practice Hub & Simulator robot.
  final PracticeAndSimsRobot practice;

  /// Opens the Home track switcher bottom sheet and selects [targetTrackLabel].
  Future<void> switchTrackFromHome(
    WidgetTester tester, {
    required String currentTrackLabel,
    required String targetTrackLabel,
  }) async {
    await harness.tapVisible(tester, find.text(currentTrackLabel).first);
    await harness.pumpFrames(tester, count: 4);
    expect(find.text('Switch Exam Track'), findsOneWidget);
    harness.expectNoOverflow(tester);

    await harness.scrollToAndTap(tester, find.text(targetTrackLabel).first);
    await harness.pumpFrames(tester, count: 6);
    expect(find.text(targetTrackLabel), findsWidgets);
    harness.expectNoOverflow(tester);
  }

  /// Completes TOEFL iBT Reading (`word_completion` + MCQ) and Writing (3 tasks).
  Future<void> runToeflIbtJourney(WidgetTester tester) async {
    expect(find.text('Target 5.0'), findsOneWidget);

    await shell.openTab(tester, 'Exams');
    await practice.openSimulator(tester, 'Reading Simulator');

    final qTab = find.textContaining('Questions (');
    if (qTab.evaluate().isNotEmpty) {
      await harness.tapVisible(tester, qTab);
    }

    final wcField = find.byType(TextField).first;
    await tester.ensureVisible(wcField);
    await tester.enterText(wcField, 'circulate');
    await tester.pump();
    await harness.tapVisible(tester, find.text('Next'));

    await harness.tapVisible(
      tester,
      find.textContaining('Roots grow directly in nutrient solution'),
    );
    await harness.tapVisible(tester, find.text('Submit Test'));
    await harness.pumpFrames(tester, count: 8);

    expect(find.text('Evaluation Review'), findsOneWidget);
    expect(find.text('6.0'), findsWidgets);
    expect(find.textContaining('/ 120 Legacy Scale'), findsOneWidget);
    harness.expectNoOverflow(tester);

    await _returnToPracticeHub(tester);
    await practice.openSimulator(tester, 'Writing Simulator');

    expect(find.textContaining('Task 1 · Build'), findsOneWidget);
    expect(find.textContaining('Task 2 · Email'), findsOneWidget);
    expect(find.textContaining('Task 3 · Discuss'), findsOneWidget);
    await harness.tapVisible(tester, find.textContaining('Task 3 · Discuss'));

    final essayField = find.byType(TextField).first;
    await tester.ensureVisible(essayField);
    await tester.enterText(
      essayField,
      'Hybrid seminars balance accessibility with collaborative in-person dialogue so students from varied schedules engage deeply with academic research discussions.',
    );
    await tester.pump();
    await harness.tapVisible(tester, find.text('Submit for AI Evaluation'));
    await harness.pumpFrames(tester, count: 10);

    expect(find.text('Evaluation Review'), findsOneWidget);
    expect(find.text('5.0'), findsWidgets);
    expect(find.text('DEV'), findsOneWidget);
    expect(find.textContaining('/ 120 Legacy Scale'), findsOneWidget);
    harness.expectNoOverflow(tester);
  }

  /// Completes PTE Academic Reading (`reorder_sequence`), Listening (`dictation`),
  /// and Speaking (`Describe Image` with prep + chart SVG).
  Future<void> runPteAcademicJourney(WidgetTester tester) async {
    expect(find.text('Target 65'), findsOneWidget);

    await shell.openTab(tester, 'Exams');
    await practice.openSimulator(tester, 'Reading Simulator');

    final qTab = find.textContaining('Questions (');
    if (qTab.evaluate().isNotEmpty) {
      await harness.tapVisible(tester, qTab);
    }

    await harness.tapVisible(
      tester,
      find.textContaining('Biofouling slows unprotected rotors.'),
    );
    await harness.tapVisible(
      tester,
      find.textContaining('Engineers test turbine coatings in seawater.'),
    );
    await harness.tapVisible(
      tester,
      find.textContaining('Clean blades sustain steady power output.'),
    );
    expect(find.text('Your order: C → A → B'), findsOneWidget);

    await harness.tapVisible(tester, find.text('Submit Test'));
    await harness.pumpFrames(tester, count: 8);
    expect(find.text('Evaluation Review'), findsOneWidget);
    expect(find.text('90'), findsWidgets);
    harness.expectNoOverflow(tester);

    await _returnToPracticeHub(tester);
    await practice.openSimulator(tester, 'Listening Simulator');

    if (find.text('Start Audio').evaluate().isNotEmpty) {
      await harness.tapVisible(tester, find.text('Start Audio'));
    } else {
      await harness.tapVisible(tester, find.byTooltip('Play audio'));
    }
    final dictField = find.byType(TextField).first;
    await tester.ensureVisible(dictField);
    await tester.enterText(
      dictField,
      'Solar arrays lower peak afternoon grid demand.',
    );
    await tester.pump();
    await harness.tapVisible(tester, find.text('Submit Test'));
    await harness.pumpFrames(tester, count: 8);
    expect(find.text('Evaluation Review'), findsOneWidget);
    expect(find.text('90'), findsWidgets);
    harness.expectNoOverflow(tester);

    await _returnToPracticeHub(tester);
    await practice.openSimulator(tester, 'Speaking Simulator');

    expect(find.text('Skip Prep & Start Recording'), findsOneWidget);
    await harness.tapVisible(tester, find.text('Skip Prep & Start Recording'));
    await harness.pumpFrames(tester, count: 4);
    await harness.tapVisible(tester, find.text('Finish Recording Turn'));
    await harness.pumpFrames(tester);
    await harness.tapVisible(tester, find.textContaining('Submit'));
    await harness.pumpFrames(tester, count: 12);

    expect(find.text('Evaluation Review'), findsOneWidget);
    expect(find.text('72'), findsWidgets);
    expect(find.text('FLU'), findsOneWidget);
    harness.expectNoOverflow(tester);
  }

  /// Completes DET Reading (5-item `binary_choice`), Writing (photo SVG),
  /// zero-prep Speaking, and verifies integrated DET subscores & `320x640` layout.
  Future<void> runDetJourney(WidgetTester tester) async {
    expect(find.text('Target 125'), findsOneWidget);

    await shell.openTab(tester, 'Exams');
    await practice.openSimulator(tester, 'Reading Simulator');

    final qTab = find.textContaining('Questions (');
    if (qTab.evaluate().isNotEmpty) {
      await harness.tapVisible(tester, qTab);
    }
    const detAnswers = <String>['YES', 'YES', 'NO', 'YES', 'YES'];
    for (var i = 0; i < detAnswers.length; i++) {
      await harness.tapVisible(tester, find.text(detAnswers[i]));
      if (i < detAnswers.length - 1) {
        await harness.tapVisible(tester, find.text('Next'));
      }
    }
    await harness.tapVisible(tester, find.text('Submit Test'));
    await harness.pumpFrames(tester, count: 8);

    expect(find.text('Evaluation Review'), findsOneWidget);
    expect(find.text('160'), findsWidgets);
    harness.expectNoOverflow(tester);

    await _returnToPracticeHub(tester);
    await practice.openSimulator(tester, 'Writing Simulator');

    expect(find.textContaining('Task 1 · Photo'), findsOneWidget);
    final writingField = find.byType(TextField).first;
    await tester.ensureVisible(writingField);
    await tester.enterText(
      writingField,
      'Three rising colored bars illustrate steady measurable progression across the displayed categories in clear detail.',
    );
    await tester.pump();
    await harness.tapVisible(tester, find.text('Submit for AI Evaluation'));
    await harness.pumpFrames(tester, count: 10);

    expect(find.text('Evaluation Review'), findsOneWidget);
    expect(find.text('130'), findsWidgets);
    expect(find.text('LIT'), findsOneWidget);
    harness.expectNoOverflow(tester);

    await _returnToPracticeHub(tester);
    await practice.openSimulator(tester, 'Speaking Simulator');

    expect(find.text('Start Recording Answer'), findsOneWidget);
    await harness.tapVisible(tester, find.text('Start Recording Answer'));
    await harness.pumpFrames(tester, count: 4);
    await harness.tapVisible(tester, find.text('Finish Recording Turn'));
    await harness.pumpFrames(tester);
    await harness.tapVisible(tester, find.textContaining('Submit'));
    await harness.pumpFrames(tester, count: 12);

    expect(find.text('Evaluation Review'), findsOneWidget);
    expect(find.text('130'), findsWidgets);
    harness.expectNoOverflow(tester);

    await _returnToPracticeHub(tester);
    await shell.openTab(tester, 'Home');

    await tester.scrollUntilVisible(find.textContaining('Literacy:'), 200);
    expect(find.textContaining('Literacy:'), findsOneWidget);
    expect(find.textContaining('Comprehension:'), findsOneWidget);
    expect(find.textContaining('Conversation:'), findsOneWidget);
    expect(find.textContaining('Production:'), findsOneWidget);
    harness.expectNoOverflow(tester);

    await shell.openTab(tester, 'Progress');
    expect(find.text('Progress & Analytics'), findsOneWidget);
    harness.expectNoOverflow(tester);

    await harness.setViewportSize(tester, const Size(320, 640));
    await shell.openTab(tester, 'Home');
    harness.expectNoOverflow(tester);
    await harness.tapVisible(tester, find.text('Duolingo English Test').first);
    await harness.pumpFrames(tester, count: 4);
    expect(find.text('Switch Exam Track'), findsOneWidget);
    harness.expectNoOverflow(tester);
    await harness.tapVisible(tester, find.text('Duolingo English Test').last);
    await harness.pumpFrames(tester, count: 4);

    await shell.openTab(tester, 'Exams');
    harness.expectNoOverflow(tester);
  }

  Future<void> _returnToPracticeHub(WidgetTester tester) async {
    await harness.scrollToAndTap(tester, find.text('Practice Again'));
    await harness.pumpFrames(tester, count: 6);
    await shell.openTab(tester, 'Exams');
  }
}

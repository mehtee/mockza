import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'harness/e2e_app_harness.dart';
import 'robots/practice_and_sims_robot.dart';
import 'robots/shell_and_home_robot.dart';
import 'robots/vocab_progress_settings_robot.dart';

void main() {
  testWidgets(
    'E2E 2: Practice Setup -> Reading Simulator (Focused & All) -> Evaluation Review -> Mistake Capture -> Vocabulary SRS',
    (tester) async {
      final harness = E2eAppHarness.create();
      await harness.seedStarterCatalog(tester);
      await harness.completeOnboardingSeed(tester);
      await harness.mountApp(tester);

      final shell = ShellAndHomeRobot(harness);
      final practice = PracticeAndSimsRobot(harness);
      final vocab = VocabProgressSettingsRobot(harness);

      shell.expectHomeVisible();
      await shell.openTab(tester, 'Exams');

      await practice.selectPracticeMode(tester, examMode: false);
      await practice.openSetupForSkill(tester, 'Reading');
      harness.expectNoOverflow(tester);

      await practice.openSimulator(tester, 'Urban Canopy Cooling');
      await practice.completeReadingSimAndSaveMistake(tester);
      harness.expectNoOverflow(tester);

      // Navigate back to Vocabulary tab, inspect Word Detail, and complete SRS review
      await harness.tapVisible(tester, find.byTooltip('Back').first);
      await harness.pumpFrames(tester, count: 4);
      // Pop back out of Practice Setup -> Practice Hub shell
      final backBtns = find.byType(IconButton);
      if (backBtns.evaluate().isNotEmpty &&
          find.text('Vocab').evaluate().isEmpty) {
        await harness.tapVisible(tester, backBtns.first);
        await harness.pumpFrames(tester, count: 4);
      }

      await shell.openTab(tester, 'Vocab');
      await vocab.inspectDetailAndReviewVocab(tester);
      harness.expectNoOverflow(tester);

      await harness.dispose(tester);
    },
  );
}

import 'package:flutter_test/flutter_test.dart';

import 'harness/e2e_app_harness.dart';
import 'robots/practice_and_sims_robot.dart';
import 'robots/shell_and_home_robot.dart';

void main() {
  testWidgets(
    'E2E 4: Writing Sim (AI Rubric) -> Speaking Sim (Record & AI Rubric) -> Full Mock 5-Stage Planner',
    (tester) async {
      final harness = E2eAppHarness.create();
      await harness.seedStarterCatalog(tester);
      await harness.completeOnboardingSeed(tester);
      await harness.mountApp(tester);

      final shell = ShellAndHomeRobot(harness);
      final practice = PracticeAndSimsRobot(harness);

      // 1. Writing Simulator -> submit -> AI Rubric Review
      await shell.openTab(tester, 'Exams');
      await practice.selectPracticeMode(tester, examMode: false);
      await practice.openSimulator(tester, 'Writing Simulator');
      await practice.completeWritingSimToAiReview(tester);
      harness.expectNoOverflow(tester);

      // Return to Practice Hub for Speaking Simulator
      await harness.scrollToAndTap(tester, find.text('Practice Again'));
      await harness.pumpFrames(tester, count: 6);
      await shell.openTab(tester, 'Exams');
      await practice.openSimulator(tester, 'Speaking Simulator');
      await practice.completeSpeakingSimToAiReview(tester);
      harness.expectNoOverflow(tester);

      // Return to Practice Hub and open Full Mock 5-stage planner
      await harness.scrollToAndTap(tester, find.text('Practice Again'));
      await harness.pumpFrames(tester, count: 6);
      await shell.openTab(tester, 'Exams');
      await practice.openAndVerifyFullMockPlanner(tester);
      harness.expectNoOverflow(tester);

      await harness.dispose(tester);
    },
  );
}

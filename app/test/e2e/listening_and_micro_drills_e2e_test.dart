import 'package:flutter_test/flutter_test.dart';

import 'harness/e2e_app_harness.dart';
import 'robots/practice_and_sims_robot.dart';
import 'robots/shell_and_home_robot.dart';

void main() {
  testWidgets(
    'E2E 3: Listening Simulator (Study transcript & Focused Q nav) -> Micro-Drills workout',
    (tester) async {
      final harness = E2eAppHarness.create();
      await harness.seedStarterCatalog(tester);
      await harness.completeOnboardingSeed(tester);
      await harness.mountApp(tester);

      final shell = ShellAndHomeRobot(harness);
      final practice = PracticeAndSimsRobot(harness);

      await shell.openTab(tester, 'Practice');
      await practice.selectPracticeMode(tester, examMode: false);
      await practice.openSimulator(tester, 'Listening Simulator');
      await practice.completeListeningSim(
        tester,
        expectStudyTranscriptToggle: true,
      );
      harness.expectNoOverflow(tester);

      // Return to Practice Hub and complete seeded Micro-Drill workout
      await harness.scrollToAndTap(tester, find.text('Practice Again'));
      await harness.pumpFrames(tester, count: 6);
      await shell.openTab(tester, 'Practice');
      await practice.completeMicroDrill(tester);
      harness.expectNoOverflow(tester);

      await harness.dispose(tester);
    },
  );
}

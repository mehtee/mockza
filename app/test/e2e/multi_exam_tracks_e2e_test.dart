import 'package:flutter_test/flutter_test.dart';

import 'harness/e2e_app_harness.dart';
import 'robots/multi_exam_tracks_robot.dart';
import 'robots/practice_and_sims_robot.dart';
import 'robots/shell_and_home_robot.dart';

void main() {
  testWidgets(
    'E2E 7: Multi-Exam Tracks (TOEFL iBT 2026, PTE Academic & Duolingo English Test)',
    (tester) async {
      final harness = E2eAppHarness.create();
      await harness.seedStarterCatalog(tester);
      await harness.completeOnboardingSeed(tester);
      await harness.mountApp(tester);

      final shell = ShellAndHomeRobot(harness);
      final practice = PracticeAndSimsRobot(harness);
      final multiExam = MultiExamTracksRobot(harness, shell, practice);

      shell.expectHomeVisible();
      await multiExam.switchTrackFromHome(
        tester,
        currentTrackLabel: 'IELTS Academic',
        targetTrackLabel: 'TOEFL iBT',
      );
      await multiExam.runToeflIbtJourney(tester);

      await harness.scrollToAndTap(tester, find.text('Practice Again'));
      await harness.pumpFrames(tester, count: 6);
      await shell.openTab(tester, 'Home');
      await multiExam.switchTrackFromHome(
        tester,
        currentTrackLabel: 'TOEFL iBT',
        targetTrackLabel: 'PTE Academic',
      );
      await multiExam.runPteAcademicJourney(tester);

      await harness.scrollToAndTap(tester, find.text('Practice Again'));
      await harness.pumpFrames(tester, count: 6);
      await shell.openTab(tester, 'Home');
      await multiExam.switchTrackFromHome(
        tester,
        currentTrackLabel: 'PTE Academic',
        targetTrackLabel: 'Duolingo English Test',
      );
      await multiExam.runDetJourney(tester);

      await harness.dispose(tester);
    },
  );
}

import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_notifier.dart';

import 'harness/e2e_app_harness.dart';
import 'robots/diagnostic_robot.dart';
import 'robots/onboarding_robot.dart';

void main() {
  testWidgets(
    'E2E 1: Onboarding -> 4-skill Quick Starting Check -> Results & single-skill retake',
    (tester) async {
      final harness = E2eAppHarness.create();
      await harness.seedStarterCatalog(tester);
      await harness.mountApp(tester);

      final onboarding = OnboardingRobot(harness);
      final diagnostic = DiagnosticRobot(harness);

      // Step 1 & 2 of Onboarding leading cleanly into Diagnostic Intro
      onboarding.expectStepOneVisible();
      await onboarding.selectTrack(tester);
      await onboarding.tapContinueToGoals(tester);
      await onboarding.selectTimeframe(tester, '1 Month');
      expect(find.text('Start with a Free ~10-Min Check'), findsOneWidget);
      await onboarding.submitGetStarted(tester);
      harness.expectNoOverflow(tester);

      // Diagnostic Intro -> Start check
      diagnostic.expectIntroVisible();
      await diagnostic.tapStartCheck(tester);
      harness.expectNoOverflow(tester);

      // Worked Reading Example must NOT drain the global countdown timer
      await diagnostic.verifyWorkedExampleDoesNotDrainTimer(tester);
      await diagnostic.startReadingFromExample(tester);

      // Answer first adaptive Reading block via focused phone step pills, then skip remaining
      await diagnostic.answerCurrentObjectiveBlockAndAdvance(tester);
      await diagnostic.skipActiveObjectiveStage(tester);
      await diagnostic.continueThroughTransition(tester);

      // Listening worked example -> Listening block -> transition
      expect(
        diagnostic.readState().stage,
        DiagnosticFlowStage.listeningExample,
      );
      await diagnostic.startListeningFromExample(tester);
      await diagnostic.skipActiveObjectiveStage(tester);
      await diagnostic.continueThroughTransition(tester);

      // Writing base -> follow-up must reset to a fresh 75s timer -> transition
      expect(diagnostic.readState().stage, DiagnosticFlowStage.writingBase);
      await diagnostic.completeWritingWithFreshFollowUpClock(tester);
      await diagnostic.continueThroughTransition(tester);

      // Speaking prep -> recording -> submit -> Results -> single-skill retake
      expect(diagnostic.readState().stage, DiagnosticFlowStage.speakingPrep);
      await diagnostic.completeSpeakingAndSubmit(tester);
      await diagnostic.verifyResultsAndTriggerRetake(tester);
      harness.expectNoOverflow(tester);

      await harness.dispose(tester);
    },
  );
}

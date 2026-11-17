import 'package:flutter_test/flutter_test.dart';

import '../harness/e2e_app_harness.dart';

/// Page-object Robot driving the 2-step learner `OnboardingScreen` journey.
final class OnboardingRobot {
  /// Creates an [OnboardingRobot] bound to [harness].
  const new(this.harness);

  /// Active E2E test harness.
  final E2eAppHarness harness;

  /// Verifies Step 1 of Onboarding is visible.
  void expectStepOneVisible() {
    expect(find.text('Welcome to Mockza'), findsOneWidget);
    expect(find.text('Choose your target exam'), findsOneWidget);
  }

  /// Selects Academic or General Training on Step 1.
  Future<void> selectTrack(
    WidgetTester tester, {
    bool academic = true,
  }) async {
    final label = academic ? 'IELTS Academic' : 'IELTS General Training';
    await harness.tapVisible(tester, find.text(label));
  }

  /// Advances from Step 1 to Step 2 (`Set your target score`).
  Future<void> tapContinueToGoals(WidgetTester tester) async {
    await harness.tapVisible(tester, find.text('Continue'));
    expect(find.text('Set your target score'), findsOneWidget);
  }

  /// Selects a test timeframe pill on Step 2 (e.g. `'1 Month'`, `'3 Months'`).
  Future<void> selectTimeframe(WidgetTester tester, String label) async {
    await harness.scrollToAndTap(tester, find.text(label));
  }

  /// Toggles the `'Start with a Free ~10-Min Check'` option on Step 2.
  Future<void> toggleStartingCheckCard(WidgetTester tester) async {
    await harness.scrollToAndTap(
      tester,
      find.text('Start with a Free ~10-Min Check'),
    );
  }

  /// Taps `'Get Started'` and pumps transitions to Home or Diagnostic Intro.
  Future<void> submitGetStarted(WidgetTester tester) async {
    await harness.tapVisible(tester, find.text('Get Started'));
    await harness.pumpFrames(tester, count: 8);
  }
}

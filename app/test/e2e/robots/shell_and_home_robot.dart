import 'package:flutter_test/flutter_test.dart';

import '../harness/e2e_app_harness.dart';

/// Page-object Robot navigating top-level shell tabs, Home & Settings links.
final class ShellAndHomeRobot {
  /// Creates a [ShellAndHomeRobot] bound to [harness].
  const new(this.harness);

  /// Active E2E test harness.
  final E2eAppHarness harness;

  /// Verifies Home dashboard is visible.
  void expectHomeVisible() {
    expect(find.text('Your study room'), findsOneWidget);
  }

  /// Opens one of the 5 bottom tabs: `'Home'`, `'Exams'`, `'Coach'`, `'Vocab'`, `'Progress'`.
  Future<void> openTab(WidgetTester tester, String tabLabel) async {
    await harness.tapVisible(tester, find.text(tabLabel).last);
    await harness.pumpFrames(tester, count: 6);
  }

  /// Opens top-right Settings screen from any shell tab.
  Future<void> openSettings(WidgetTester tester) async {
    await harness.scrollToAndTap(
      tester,
      find.byTooltip('Settings'),
      delta: -250,
    );
    await harness.pumpFrames(tester, count: 6);
    expect(find.text('Settings'), findsWidgets);
  }
}

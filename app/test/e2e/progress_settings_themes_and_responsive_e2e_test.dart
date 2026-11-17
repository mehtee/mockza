import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/theme/theme_catalog.dart';
import 'package:mockza/theme/theme_preset.dart';

import 'harness/e2e_app_harness.dart';
import 'robots/shell_and_home_robot.dart';
import 'robots/vocab_progress_settings_robot.dart';

void main() {
  testWidgets(
    'E2E 5: Compact 360x640 responsive sweep, Progress analytics, OCP Theme Presets & Wipe to Onboarding',
    (tester) async {
      // Verify Open-Closed extensibility: registering a custom preset exposes it cleanly
      const customId = 'e2e_custom_preset';
      MzThemeCatalog.registerPreset(
        MzThemePreset(
          id: customId,
          displayName: 'E2E Custom Palette',
          description: 'Runtime registered OCP theme verification.',
          previewPrimary: MzThemeCatalog.midnightIndigo.previewPrimary,
          previewAccent: MzThemeCatalog.midnightIndigo.previewAccent,
          previewBackgroundDark:
              MzThemeCatalog.midnightIndigo.previewBackgroundDark,
          darkColors: MzThemeCatalog.midnightIndigo.darkColors,
          lightColors: MzThemeCatalog.midnightIndigo.lightColors,
          darkGradients: MzThemeCatalog.midnightIndigo.darkGradients,
          lightGradients: MzThemeCatalog.midnightIndigo.lightGradients,
        ),
      );
      expect(MzThemeCatalog.resolvePreset(customId).id, customId);

      final harness = E2eAppHarness.create();
      await harness.seedStarterCatalog(tester);
      await harness.completeOnboardingSeed(tester);
      await harness.mountApp(tester, surfaceSize: const Size(360, 640));

      final shell = ShellAndHomeRobot(harness);
      final robot = VocabProgressSettingsRobot(harness);

      // Compact phone 360x640 overflow sweep across all 4 bottom tabs
      shell.expectHomeVisible();
      harness.expectNoOverflow(tester);

      await shell.openTab(tester, 'Practice');
      harness.expectNoOverflow(tester);

      await shell.openTab(tester, 'Vocabulary');
      harness.expectNoOverflow(tester);

      await shell.openTab(tester, 'Progress');
      await robot.inspectProgressAndAttempts(tester);
      harness.expectNoOverflow(tester);

      // Open Settings, test live OCP presets + Light/Dark switch + Paywall + Wipe Data
      await shell.openSettings(tester);
      expect(find.text('E2E Custom Palette'), findsOneWidget);
      await robot.exerciseThemePresetsAndSettings(tester);
      harness.expectNoOverflow(tester);

      await robot.wipeAllDataBackToOnboarding(tester);
      harness.expectNoOverflow(tester);

      await harness.dispose(tester);
    },
  );
}

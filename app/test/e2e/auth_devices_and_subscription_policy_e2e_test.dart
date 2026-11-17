import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/theme/components/mz_buttons.dart';

import 'harness/e2e_app_harness.dart';
import 'robots/auth_and_devices_robot.dart';
import 'robots/shell_and_home_robot.dart';

void main() {
  testWidgets(
    'E2E 6: Multi-surface Auth (Email, Google & Apple Dev Sandbox), strict 1-Phone + 1-Desktop-Web slot conflict, Settings device management & Paywall policy consent',
    (tester) async {
      final harness = E2eAppHarness.create();
      await harness.seedStarterCatalog(tester);
      // Boot un-onboarded at compact 360x640 phone viewport.
      await harness.mountApp(tester, surfaceSize: const Size(360, 640));

      final authRobot = AuthAndDevicesRobot(harness);
      final shell = ShellAndHomeRobot(harness);

      // 1. Onboarding -> Auth Screen -> Email/Password Register
      await authRobot.openAuthFromOnboarding(tester);
      await authRobot.registerWithEmail(
        tester,
        name: 'Mahdi',
        email: 'mahdi@mockza.test',
        password: 'StrongPassword#2026',
      );
      shell.expectHomeVisible();
      harness.expectNoOverflow(tester);

      // Seed a simulated concurrent Desktop Web browser session on this account.
      harness.httpAdapter.remoteSessions.add(<String, Object?>{
        'sessionId': '00000000-0000-4000-8000-000000000202',
        'deviceId': '00000000-0000-4000-8000-000000000202',
        'deviceIdShort': '00000000...',
        'slotKind': 'desktop_web',
        'platform': 'web_desktop',
        'appSurface': 'web_app',
        'deviceName': 'Chrome on macOS',
        'locationLabel': 'Berlin, DE',
        'ipMasked': '198.51.100.***',
        'authMethod': 'google',
        'isCurrentDevice': false,
        'createdAt': '2026-11-17T14:00:00Z',
        'lastSeenAt': '2026-11-17T14:06:00Z',
      });

      // 2. Open Settings -> Inspect Gemini/ChatGPT-style Active Devices -> Terminate remote web device
      await shell.openSettings(tester);
      await authRobot.verifyAndManageDevicesInSettings(
        tester,
        expectedEmail: 'mahdi@mockza.test',
        remoteDeviceName: 'Chrome on macOS',
      );

      // 3. Sign out current device -> re-open Auth from Settings
      await authRobot.signOutCurrentDeviceFromSettings(tester);
      await harness.scrollToAndTap(
        tester,
        find.text('Sign In or Create Account'),
      );
      await harness.pumpFrames(tester, count: 6);

      // 4. Arm strict 1-Phone slot conflict (`409 device_slot_limit_reached`) and verify banner UI
      harness.httpAdapter.forcedSlotConflict = <String, Object?>{
        'slotKind': 'mobile',
        'occupyingDevice': <String, Object?>{
          'deviceId': '99999999-0000-4000-8000-000000000001',
          'deviceIdShort': '99999999...',
          'deviceName': 'Pixel 8 Pro',
          'locationLabel': 'Tehran, IR',
          'lastSeenAt': '2026-11-17T14:00:00Z',
        },
      };
      final fields = find.byType(TextField);
      await tester.enterText(fields.at(0), 'mahdi@mockza.test');
      await tester.enterText(fields.at(1), 'StrongPassword#2026');
      await harness.scrollToAndTap(
        tester,
        find.widgetWithText(PrimaryButton, 'Sign In'),
      );
      await harness.pumpFrames(tester, count: 6);

      expect(find.text('Mobile Phone Slot In Use'), findsOneWidget);
      expect(find.text('Active device: Pixel 8 Pro'), findsOneWidget);
      expect(find.textContaining('Location: Tehran, IR'), findsOneWidget);
      harness.expectNoOverflow(tester);

      // 5. Clear slot conflict -> test Dev Sandbox Google Sign-In
      harness.httpAdapter.forcedSlotConflict = null;
      await authRobot.signInWithDevSandbox(
        tester,
        buttonLabel: 'Continue with Google',
        personaTitle: 'Alex (Google)',
      );
      await harness.pumpFrames(tester, count: 6);

      // Back in Settings at 390x844: refresh devices and test Apple Sign-In after sign out
      await harness.setViewportSize(tester, const Size(390, 844));
      await harness.tapVisible(
        tester,
        find.byTooltip('Refresh active devices'),
      );
      await harness.pumpFrames(tester, count: 6);
      expect(find.text('alex.google@mockza.test'), findsOneWidget);

      await authRobot.signOutCurrentDeviceFromSettings(tester);
      await harness.scrollToAndTap(
        tester,
        find.text('Sign In or Create Account'),
      );
      await harness.pumpFrames(tester, count: 6);
      await authRobot.signInWithDevSandbox(
        tester,
        buttonLabel: 'Continue with Apple',
        personaTitle: 'Sara (Apple)',
      );
      await harness.pumpFrames(tester, count: 6);

      // 6. Paywall strict 1+1 policy notice + consent toggle gate + Pro purchase
      await authRobot.verifyPaywallStrictDevicePolicy(tester);

      await harness.dispose(tester);
    },
  );
}

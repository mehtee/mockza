import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/theme/components/mz_buttons.dart';

import '../harness/e2e_app_harness.dart';

/// Page-object Robot driving Email/Google/Apple Auth, Dev Sandbox sign-in,
/// strict 1-Phone + 1-Desktop-Web device session management, and Paywall ToS consent.
final class AuthAndDevicesRobot {
  /// Creates an [AuthAndDevicesRobot] bound to [harness].
  const new(this.harness);

  /// Active E2E test harness.
  final E2eAppHarness harness;

  /// Opens Auth from Onboarding Step 0 via `Already have an account? Sign in`.
  Future<void> openAuthFromOnboarding(WidgetTester tester) async {
    expect(find.text('Welcome to Mockza'), findsOneWidget);
    await harness.scrollToAndTap(
      tester,
      find.text('Already have an account? Sign in'),
    );
    await harness.pumpFrames(tester, count: 6);
    expect(find.text('Sign in to Mockza'), findsOneWidget);
  }

  /// Registers a new account using Email & Password.
  Future<void> registerWithEmail(
    WidgetTester tester, {
    required String email,
    required String password,
    String? name,
  }) async {
    await harness.tapVisible(tester, find.text('Create Account').first);
    await harness.pumpFrames(tester, count: 4);
    harness.expectNoOverflow(tester);

    expect(find.text('Continue with Google'), findsOneWidget);
    expect(find.text('Continue with Apple'), findsOneWidget);
    expect(find.textContaining('DEV'), findsWidgets);

    final fields = find.byType(TextField);
    if (name != null) {
      await tester.enterText(fields.at(0), name);
      await tester.enterText(fields.at(1), email);
      await tester.enterText(fields.at(2), password);
    } else {
      await tester.enterText(fields.at(0), email);
      await tester.enterText(fields.at(1), password);
    }
    await harness.pumpFrames(tester, count: 2);

    final submitBtn = find.widgetWithText(PrimaryButton, 'Create Account');
    await harness.scrollToAndTap(tester, submitBtn);
    await harness.pumpFrames(tester, count: 8);
  }

  /// Verifies active signed-in devices list in Settings and terminates a remote Desktop Web session.
  Future<void> verifyAndManageDevicesInSettings(
    WidgetTester tester, {
    required String expectedEmail,
    required String remoteDeviceName,
  }) async {
    await harness.scrollToVisible(
      tester,
      find.text('Account & Signed-In Devices'),
    );
    expect(find.text(expectedEmail), findsOneWidget);

    await harness.scrollToVisible(tester, find.text('Mobile Phone'));
    expect(find.text('Desktop Web'), findsOneWidget);
    expect(find.text('1 / 1 Active'), findsNWidgets(2));
    expect(find.text('E2E Android Phone'), findsOneWidget);
    expect(find.text(remoteDeviceName), findsOneWidget);
    harness.expectNoOverflow(tester);

    // Remotely terminate Desktop Web session.
    await harness.scrollToAndTap(tester, find.text('Terminate').first);
    await harness.pumpFrames(tester, count: 4);
    expect(find.text('Terminate Session'), findsOneWidget);
    await harness.tapVisible(tester, find.text('Terminate Session'));
    await harness.pumpFrames(tester, count: 6);

    expect(find.text(remoteDeviceName), findsNothing);
    expect(find.text('0 / 1 Open'), findsOneWidget);
  }

  /// Signs out the current device from Settings.
  Future<void> signOutCurrentDeviceFromSettings(WidgetTester tester) async {
    await harness.scrollToAndTap(tester, find.text('Sign Out').first);
    await harness.pumpFrames(tester, count: 4);
    expect(find.text('Sign Out This Device?'), findsOneWidget);
    await harness.tapVisible(
      tester,
      find.widgetWithText(FilledButton, 'Sign Out'),
    );
    await harness.pumpFrames(tester, count: 6);

    await harness.scrollToVisible(
      tester,
      find.text('Sign In or Create Account'),
    );
    expect(find.text('Sign In or Create Account'), findsOneWidget);
  }

  /// Signs in via Google or Apple Dev Sandbox persona picker sheet.
  Future<void> signInWithDevSandbox(
    WidgetTester tester, {
    required String buttonLabel,
    required String personaTitle,
  }) async {
    await harness.scrollToAndTap(tester, find.text(buttonLabel));
    await harness.pumpFrames(tester, count: 6);
    expect(find.textContaining(personaTitle), findsOneWidget);
    await harness.tapVisible(tester, find.textContaining(personaTitle).first);
    await harness.pumpFrames(tester, count: 8);
  }

  /// Opens Paywall from Settings, verifies strict 1+1 consent gating, then subscribes cleanly.
  Future<void> verifyPaywallStrictDevicePolicy(WidgetTester tester) async {
    await harness.scrollToAndTap(tester, find.text('Upgrade ->'));
    await harness.pumpFrames(tester, count: 6);
    harness.expectNoOverflow(tester);

    expect(
      find.text('Strict 1-Phone + 1-Desktop-Web Subscription Rule'),
      findsOneWidget,
    );

    // Attempt subscribe WITHOUT checking strict policy consent -> must block!
    await harness.scrollToAndTap(tester, find.text('Subscribe to Mockza Pro'));
    await harness.pumpFrames(tester, count: 4);
    expect(
      find.textContaining(
        'Please confirm the strict 1 Mobile Phone + 1 Desktop Web personal-use policy',
      ),
      findsOneWidget,
    );

    // Accept strict 1+1 personal-use policy -> subscribe succeeds cleanly!
    await harness.scrollToAndTap(
      tester,
      find.textContaining('I understand and agree that my subscription'),
    );
    await harness.scrollToAndTap(tester, find.text('Subscribe to Mockza Pro'));
    await harness.pumpFrames(tester, count: 6);
    expect(find.text('Welcome to Mockza Pro!'), findsOneWidget);
    harness.expectNoOverflow(tester);
  }
}

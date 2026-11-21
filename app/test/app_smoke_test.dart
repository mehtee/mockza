import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/app.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/providers.dart';

import 'support/fakes.dart';

void main() {
  testWidgets(
    'redirects first-run profile to OnboardingScreen before entering Home',
    (tester) async {
      final db = createTestDatabase();

      await tester.pumpWidget(
        ProviderScope(
          retry: (count, error) => null,
          overrides: [
            editionConfigProvider.overrideWithValue(
              EditionConfig.globalDefault,
            ),
            clockProvider.overrideWithValue(fixedTestClock()),
            appDatabaseProvider.overrideWithValue(db),
            entropySourceProvider.overrideWithValue(FixedEntropySource()),
            secureStorageGatewayProvider.overrideWithValue(
              InMemorySecureStorageGateway(),
            ),
            billingGatewayProvider.overrideWithValue(
              const FakeBillingGateway(),
            ),
            gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
          ],
          child: const MockzaApp(),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Welcome to Mockza'), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 1));
      await tester.runAsync(db.close);
    },
  );

  testWidgets(
    'mounts MockzaApp after onboarding, renders 5 bottom tabs, and opens Settings',
    (tester) async {
      final db = createTestDatabase();

      final container = ProviderContainer(
        overrides: [
          editionConfigProvider.overrideWithValue(EditionConfig.globalDefault),
          clockProvider.overrideWithValue(fixedTestClock()),
          appDatabaseProvider.overrideWithValue(db),
          entropySourceProvider.overrideWithValue(FixedEntropySource()),
          secureStorageGatewayProvider.overrideWithValue(
            InMemorySecureStorageGateway(),
          ),
          billingGatewayProvider.overrideWithValue(const FakeBillingGateway()),
          gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
        ],
      );

      final profileRepo = container.read(profileRepositoryProvider);
      final identity = container.read(secureIdentityServiceProvider);
      await tester.runAsync(() async {
        final devId =
            (await identity.getOrCreateDeviceId()).valueOrNull ?? 'dev-test';
        await profileRepo.loadOrInitializePrimary(fallbackDeviceId: devId);
        await profileRepo.completeOnboarding(devId);
      });

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MockzaApp(),
        ),
      );

      await tester.pumpAndSettle();

      final navBar = find.byType(NavigationBar);
      expect(navBar, findsOneWidget);
      expect(
        find.descendant(of: navBar, matching: find.text('Home')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: navBar, matching: find.text('Exams')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: navBar, matching: find.text('Coach')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: navBar, matching: find.text('Vocab')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: navBar, matching: find.text('Progress')),
        findsOneWidget,
      );

      await tester.tap(
        find.descendant(of: navBar, matching: find.text('Exams')),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Speaking Simulator'), findsOneWidget);

      await tester.tap(find.text('Home'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      await tester.tap(find.byTooltip('Settings'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Settings'), findsWidgets);
      expect(find.textContaining('Edition: glb'), findsOneWidget);

      // Unmount widget tree, dispose container, and elapse 10ms so Drift's QueryStream close timers fire cleanly.
      await tester.pumpWidget(const SizedBox.shrink());
      container.dispose();
      await tester.pump(const Duration(milliseconds: 10));
      await tester.runAsync(db.close);
    },
  );
}

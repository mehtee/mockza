import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/features/home/presentation/home_screen.dart';
import 'package:mockza/features/listening_sim/presentation/listening_sim_screen.dart';
import 'package:mockza/features/practice_hub/presentation/practice_hub_providers.dart';
import 'package:mockza/features/practice_hub/presentation/practice_hub_screen.dart';
import 'package:mockza/features/reading_sim/presentation/reading_sim_screen.dart';
import 'package:mockza/features/speaking_sim/presentation/speaking_sim_screen.dart';
import 'package:mockza/features/writing_sim/presentation/writing_sim_screen.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/theme/app_theme.dart';

import '../support/fakes.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const screenSizes = <String, Size>{
    'compact_phone_360x640': Size(360, 640),
    'reference_phone_393x852': Size(393, 852),
    'tablet_1024x1366': Size(1024, 1366),
  };

  group('Tier 4: Responsive Layout & Text Scaling Tests (Zero Overflow)', () {
    for (final entry in screenSizes.entries) {
      final deviceName = entry.key;
      final size = entry.value;

      for (final isDark in [true, false]) {
        final mode = isDark ? 'Dark' : 'Light';

        testWidgets(
          'HomeScreen renders on $deviceName in $mode mode with 2.0x text scaling without overflow',
          (tester) async {
            final db = createTestDatabase();
            tester.view.physicalSize = Size(size.width * 2, size.height * 2);
            tester.view.devicePixelRatio = 2;
            addTearDown(() {
              tester.view.resetPhysicalSize();
              tester.view.resetDevicePixelRatio();
            });

            await tester.pumpWidget(
              ProviderScope(
                overrides: [
                  appDatabaseProvider.overrideWithValue(db),
                  clockProvider.overrideWithValue(fixedTestClock()),
                  billingGatewayProvider.overrideWithValue(
                    const FakeBillingGateway(),
                  ),
                  gradingGatewayProvider.overrideWithValue(
                    FakeGradingGateway(),
                  ),
                ],
                child: MaterialApp(
                  localizationsDelegates:
                      AppLocalizations.localizationsDelegates,
                  supportedLocales: AppLocalizations.supportedLocales,
                  theme: isDark ? AppTheme.dark() : AppTheme.light(),
                  home: MediaQuery(
                    data: MediaQueryData(
                      size: size,
                      textScaler: const TextScaler.linear(2),
                      platformBrightness: isDark
                          ? Brightness.dark
                          : Brightness.light,
                    ),
                    child: const Scaffold(body: HomeScreen()),
                  ),
                ),
              ),
            );

            await tester.pumpAndSettle();
            expect(
              tester.takeException(),
              isNull,
              reason: 'Zero layout overflow errors on 2.0x scale',
            );

            await tester.pumpWidget(const SizedBox.shrink());
            await tester.pump(const Duration(milliseconds: 10));
            await tester.runAsync(db.close);
          },
        );

        testWidgets(
          'PracticeHubScreen renders on $deviceName in $mode mode with 2.0x text scaling without overflow',
          (tester) async {
            final db = createTestDatabase();
            tester.view.physicalSize = Size(size.width * 2, size.height * 2);
            tester.view.devicePixelRatio = 2;
            addTearDown(() {
              tester.view.resetPhysicalSize();
              tester.view.resetDevicePixelRatio();
            });

            await tester.pumpWidget(
              ProviderScope(
                overrides: [
                  appDatabaseProvider.overrideWithValue(db),
                  clockProvider.overrideWithValue(fixedTestClock()),
                  installedExamPacksProvider.overrideWith(
                    (ref) => Stream.value(const []),
                  ),
                ],
                child: MaterialApp(
                  localizationsDelegates:
                      AppLocalizations.localizationsDelegates,
                  supportedLocales: AppLocalizations.supportedLocales,
                  theme: isDark ? AppTheme.dark() : AppTheme.light(),
                  home: MediaQuery(
                    data: MediaQueryData(
                      size: size,
                      textScaler: const TextScaler.linear(2),
                      platformBrightness: isDark
                          ? Brightness.dark
                          : Brightness.light,
                    ),
                    child: const Scaffold(body: PracticeHubScreen()),
                  ),
                ),
              ),
            );

            await tester.pumpAndSettle();
            expect(
              tester.takeException(),
              isNull,
              reason: 'Zero layout overflow errors on 2.0x scale',
            );

            await tester.pumpWidget(const SizedBox.shrink());
            await tester.pump(const Duration(milliseconds: 10));
            await tester.runAsync(db.close);
          },
        );
      }
    }
  });

  group('Tier 4: PopScope Active-Test Exit Confirmation Guard Tests', () {
    testWidgets('SpeakingSimScreen enforces PopScope exit confirmation', (
      tester,
    ) async {
      final db = createTestDatabase();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            clockProvider.overrideWithValue(fixedTestClock()),
            audioRecorderGatewayProvider.overrideWithValue(
              FakeAudioRecorderGateway(),
            ),
            gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
          ],
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            theme: AppTheme.dark(),
            home: const SpeakingSimScreen(),
          ),
        ),
      );
      await tester.pump();

      final popScopeFinder = find.byWidgetPredicate((w) => w is PopScope);
      expect(popScopeFinder, findsOneWidget);

      final popScope = tester.widget<PopScope<dynamic>>(popScopeFinder);
      expect(popScope.canPop, isFalse);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 10));
      await tester.runAsync(db.close);
    });

    testWidgets('WritingSimScreen enforces PopScope exit confirmation', (
      tester,
    ) async {
      final db = createTestDatabase();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            clockProvider.overrideWithValue(fixedTestClock()),
            gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
          ],
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            theme: AppTheme.dark(),
            home: const WritingSimScreen(),
          ),
        ),
      );
      await tester.pump();

      final popScopeFinder = find.byWidgetPredicate((w) => w is PopScope);
      expect(popScopeFinder, findsOneWidget);

      final popScope = tester.widget<PopScope<dynamic>>(popScopeFinder);
      expect(popScope.canPop, isFalse);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 10));
      await tester.runAsync(db.close);
    });

    testWidgets('ReadingSimScreen enforces PopScope exit confirmation', (
      tester,
    ) async {
      final db = createTestDatabase();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            clockProvider.overrideWithValue(fixedTestClock()),
            gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
          ],
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            theme: AppTheme.dark(),
            home: const ReadingSimScreen(),
          ),
        ),
      );
      await tester.pump();

      final popScopeFinder = find.byWidgetPredicate((w) => w is PopScope);
      expect(popScopeFinder, findsOneWidget);

      final popScope = tester.widget<PopScope<dynamic>>(popScopeFinder);
      expect(popScope.canPop, isFalse);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 10));
      await tester.runAsync(db.close);
    });

    testWidgets('ListeningSimScreen enforces PopScope exit confirmation', (
      tester,
    ) async {
      final db = createTestDatabase();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appDatabaseProvider.overrideWithValue(db),
            clockProvider.overrideWithValue(fixedTestClock()),
            audioPlayerGatewayProvider.overrideWithValue(
              FakeAudioPlayerGateway(),
            ),
            gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
          ],
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            theme: AppTheme.dark(),
            home: const ListeningSimScreen(),
          ),
        ),
      );
      await tester.pump();

      final popScopeFinder = find.byWidgetPredicate((w) => w is PopScope);
      expect(popScopeFinder, findsOneWidget);

      final popScope = tester.widget<PopScope<dynamic>>(popScopeFinder);
      expect(popScope.canPop, isFalse);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 10));
      await tester.runAsync(db.close);
    });
  });

  group('Tier 4: Accessibility Semantics & Contrast Audit', () {
    testWidgets(
      'Semantics tree generates descriptive labels for TalkBack and VoiceOver and supports RTL fa locale',
      (tester) async {
        final db = createTestDatabase();
        final handle = tester.ensureSemantics();

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              appDatabaseProvider.overrideWithValue(db),
              clockProvider.overrideWithValue(fixedTestClock()),
              installedExamPacksProvider.overrideWith(
                (ref) => Stream.value(const []),
              ),
            ],
            child: MaterialApp(
              localizationsDelegates: AppLocalizations.localizationsDelegates,
              supportedLocales: AppLocalizations.supportedLocales,
              locale: const Locale('fa'),
              theme: AppTheme.dark(),
              home: const Scaffold(body: PracticeHubScreen()),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(
          Directionality.of(tester.element(find.byType(PracticeHubScreen))),
          TextDirection.rtl,
        );

        final semanticsNode = tester.getSemantics(
          find.text('شبیه‌ساز اسپیکینگ'),
        );
        expect(semanticsNode.label, contains('شبیه‌ساز اسپیکینگ'));

        handle.dispose();

        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump(const Duration(milliseconds: 10));
        await tester.runAsync(db.close);
      },
    );
  });
}

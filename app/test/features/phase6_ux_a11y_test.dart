import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/features/onboarding/presentation/onboarding_screen.dart';
import 'package:mockza/features/paywall/presentation/paywall_screen.dart';
import 'package:mockza/features/speaking_sim/presentation/speaking_sim_screen.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/theme/app_theme.dart';
import 'package:mockza/theme/components/annotated_text.dart';
import 'package:mockza/theme/components/audio_player_bar.dart';

import '../support/fakes.dart';

void main() {
  group('Phase 6: UX, Layout, Contrast & Accessibility Regressions', () {
    testWidgets(
      'BF-04 & UX-07: AudioPlayerBar in exam mode renders interactive Start Audio button',
      (tester) async {
        var tapped = false;
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.dark(),
            home: Scaffold(
              body: AudioPlayerBar(
                position: Duration.zero,
                duration: const Duration(minutes: 5),
                isPlaying: false,
                policy: AudioPlaybackPolicy.examLinearLock,
                onTapPlayPause: () => tapped = true,
              ),
            ),
          ),
        );

        final startFinder = find.text('Start Audio');
        expect(startFinder, findsOneWidget);
        await tester.tap(startFinder);
        expect(tapped, isTrue);
      },
    );

    testWidgets(
      'UX-10: AnnotatedText handles overlapping spans without duplicating text or throwing',
      (tester) async {
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light(),
            home: const Scaffold(
              body: AnnotatedText(
                rawText: 'The quick brown fox jumps over.',
                edits: <InlineEditAnnotation>[
                  InlineEditAnnotation(
                    editId: 'e1',
                    startOffset: 4,
                    endOffset: 15,
                    originalText: 'quick brown',
                    suggestedText: 'agile red',
                    criterionCode: 'LR',
                    rationale: 'Collocation upgrade',
                  ),
                  InlineEditAnnotation(
                    editId: 'e2',
                    startOffset: 10,
                    endOffset: 19,
                    originalText: 'brown fox',
                    suggestedText: 'amber hound',
                    criterionCode: 'GRA',
                    rationale: 'Overlap guard check',
                  ),
                ],
              ),
            ),
          ),
        );
        await tester.pump();
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'BF-06, BF-07 & BF-13: narrow 320px phone and 1280px desktop render Speaking, Onboarding, and Paywall without overflow',
      (tester) async {
        final db = createTestDatabase();
        addTearDown(db.close);

        final recorder = FakeAudioRecorderGateway()..permissionGranted = false;
        final player = FakeAudioPlayerGateway();

        for (final size in const <Size>[
          Size(320, 640),
          Size(393, 852),
          Size(1280, 800),
        ]) {
          tester.view.physicalSize = size;
          tester.view.devicePixelRatio = 1.0;

          await tester.pumpWidget(
            ProviderScope(
              key: ValueKey('onboarding_$size'),
              overrides: [
                appDatabaseProvider.overrideWithValue(db),
                audioRecorderGatewayProvider.overrideWithValue(recorder),
                audioPlayerGatewayProvider.overrideWithValue(player),
                gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
                billingGatewayProvider.overrideWithValue(
                  const FakeBillingGateway(),
                ),
              ],
              child: MaterialApp(
                theme: AppTheme.light(),
                localizationsDelegates: AppLocalizations.localizationsDelegates,
                supportedLocales: AppLocalizations.supportedLocales,
                home: const OnboardingScreen(),
              ),
            ),
          );
          await tester.pump(const Duration(milliseconds: 50));
          expect(
            tester.takeException(),
            isNull,
            reason: 'OnboardingScreen overflow on $size',
          );

          await tester.pumpWidget(
            ProviderScope(
              key: ValueKey('paywall_$size'),
              overrides: [
                appDatabaseProvider.overrideWithValue(db),
                gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
                billingGatewayProvider.overrideWithValue(
                  const FakeBillingGateway(),
                ),
              ],
              child: MaterialApp(
                theme: AppTheme.light(),
                localizationsDelegates: AppLocalizations.localizationsDelegates,
                supportedLocales: AppLocalizations.supportedLocales,
                home: const PaywallScreen(),
              ),
            ),
          );
          await tester.pump(const Duration(milliseconds: 50));
          expect(
            tester.takeException(),
            isNull,
            reason: 'PaywallScreen overflow on $size',
          );

          await tester.pumpWidget(
            ProviderScope(
              key: ValueKey('speaking_$size'),
              overrides: [
                appDatabaseProvider.overrideWithValue(db),
                audioRecorderGatewayProvider.overrideWithValue(recorder),
                audioPlayerGatewayProvider.overrideWithValue(player),
              ],
              child: MaterialApp(
                theme: AppTheme.dark(),
                localizationsDelegates: AppLocalizations.localizationsDelegates,
                supportedLocales: AppLocalizations.supportedLocales,
                home: const SpeakingSimScreen(),
              ),
            ),
          );
          await tester.pump(const Duration(milliseconds: 50));
          expect(
            tester.takeException(),
            isNull,
            reason: 'SpeakingSimScreen overflow on $size',
          );
        }

        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      },
    );
  });
}

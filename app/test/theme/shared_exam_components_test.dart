import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_theme.dart';
import 'package:mockza/theme/components/audio_level_meter.dart';
import 'package:mockza/theme/components/collapsible_prompt_card.dart';
import 'package:mockza/theme/components/exam_exit_guard.dart';
import 'package:mockza/theme/components/exam_question_controls.dart';
import 'package:mockza/theme/components/mic_preflight_card.dart';
import 'package:mockza/theme/theme_catalog.dart';

void main() {
  group('QuestionIndicatorColors.resolve (OCP theme invariants)', () {
    test('uses single-hue semantics across every built-in preset and mode', () {
      for (final preset in MzThemeCatalog.allPresets) {
        for (final colors in <AppColors>[
          preset.darkColors,
          preset.lightColors,
        ]) {
          final active = QuestionIndicatorColors.resolve(
            colors,
            isSelected: true,
            isAnswered: true,
          );
          final answered = QuestionIndicatorColors.resolve(
            colors,
            isSelected: false,
            isAnswered: true,
          );
          final idle = QuestionIndicatorColors.resolve(
            colors,
            isSelected: false,
            isAnswered: false,
          );

          expect(active.background, colors.primary);
          expect(active.foreground, colors.onPrimary);
          expect(active.icon, colors.onPrimary);

          // Never mix success green with primary accent on ungraded questions.
          expect(active.icon, isNot(colors.success));
          expect(answered.icon, colors.primary);
          expect(answered.icon, isNot(colors.success));
          expect(answered.background, colors.blueBg);

          expect(idle.background, colors.surfaceAlt);
          expect(idle.border, colors.borderSubtle);
        }
      }
    });
  });

  group('ExamExitGuard', () {
    testWidgets('canceling keeps route open and confirming invokes callback', (
      tester,
    ) async {
      var exitCalls = 0;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.dark(),
          home: Scaffold(
            body: ExamExitGuard(
              dialogTitle: 'Leave Session?',
              dialogMessage: 'Unsaved state warning.',
              onConfirmedExit: () => exitCalls += 1,
              child: Builder(
                builder: (ctx) => Center(
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(ctx).maybePop(),
                    child: const Text('Trigger Back'),
                  ),
                ),
              ),
            ),
          ),
        ),
      );

      final popScope = tester.widget<PopScope<dynamic>>(
        find.byWidgetPredicate((w) => w is PopScope),
      );
      expect(popScope.canPop, isFalse);

      // Cancel keeps screen intact without firing callback.
      await tester.tap(find.text('Trigger Back'));
      await tester.pumpAndSettle();
      expect(find.text('Leave Session?'), findsOneWidget);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(exitCalls, 0);

      // Confirm invokes callback.
      await tester.tap(find.text('Trigger Back'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Exit'));
      await tester.pumpAndSettle();
      expect(exitCalls, 1);
    });
  });

  group('CollapsiblePromptCard', () {
    testWidgets('toggles body & attachment while preserving title and footer', (
      tester,
    ) async {
      var collapsed = false;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.dark(),
          home: Scaffold(
            body: StatefulBuilder(
              builder: (context, setState) => CollapsiblePromptCard(
                overline: 'Task 2',
                title: 'Public Transit Investment',
                promptBody: 'Should municipalities fund transit over highways?',
                isCollapsed: collapsed,
                onToggleCollapsed: () => setState(() => collapsed = !collapsed),
                expandedAttachment: const Text('Mock Chart Attachment'),
                footer: const Text('120 words'),
              ),
            ),
          ),
        ),
      );

      expect(find.text('Public Transit Investment'), findsOneWidget);
      expect(
        find.text('Should municipalities fund transit over highways?'),
        findsOneWidget,
      );
      expect(find.text('Mock Chart Attachment'), findsOneWidget);
      expect(find.text('120 words'), findsOneWidget);

      await tester.tap(find.text('Hide prompt'));
      await tester.pumpAndSettle();

      expect(find.text('Show prompt'), findsOneWidget);
      expect(find.text('Public Transit Investment'), findsOneWidget);
      expect(
        find.text('Should municipalities fund transit over highways?'),
        findsNothing,
      );
      expect(find.text('Mock Chart Attachment'), findsNothing);
      expect(find.text('120 words'), findsOneWidget);
    });
  });

  group('MicPreflightCard', () {
    testWidgets(
      'uses progressive disclosure for live meter and supports both modes',
      (
        tester,
      ) async {
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.dark(),
            home: Scaffold(
              body: SingleChildScrollView(
                child: Column(
                  children: <Widget>[
                    MicPreflightCard(
                      title: 'Quick Sound & Mic Check',
                      trailingLabel: 'Optional',
                      soundButtonLabel: 'Test sound',
                      soundButtonGlyph: LucideGlyph.volume2,
                      onTapSoundCheck: () {},
                      micButtonLabel: 'Test mic',
                      micButtonGlyph: LucideGlyph.mic,
                      onTapMicCheck: () {},
                      showLiveMeter: false,
                    ),
                    MicPreflightCard(
                      title: 'Live Microphone Check',
                      micButtonLabel: 'Pause Check',
                      micButtonGlyph: LucideGlyph.pause,
                      onTapMicCheck: () {},
                      showLiveMeter: true,
                      normalizedLevel: 0.45,
                      isPreviewing: true,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );

        expect(find.text('Test sound'), findsOneWidget);
        expect(find.text('Test mic'), findsOneWidget);
        expect(find.text('Pause Check'), findsOneWidget);
        // Only the card with showLiveMeter: true mounts an AudioLevelMeter.
        expect(find.byType(AudioLevelMeter), findsOneWidget);
      },
    );
  });
}

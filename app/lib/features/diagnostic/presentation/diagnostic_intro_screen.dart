import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_help_sheet.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_notifier.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/routing/safe_pop.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/audio_level_meter.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mz_bottom_sheet.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/mz_sticky_bottom_bar.dart';
import 'package:mockza/theme/components/status_banner.dart';
import 'package:mockza/theme/primitives.dart';

/// Step 0 (`/diagnostic/intro`): beginner-safe orientation, sound/mic check,
/// mode choice, consent note, and skip/later options before the 15-minute timer starts.
class DiagnosticIntroScreen extends ConsumerStatefulWidget {
  /// Creates a [DiagnosticIntroScreen].
  const new({
    this.examId,
    this.initialMode,
    super.key,
  });

  /// Optional target exam identifier from route query parameters.
  final String? examId;

  /// Optional initial timing/accessibility mode wire string.
  final String? initialMode;

  @override
  ConsumerState<DiagnosticIntroScreen> createState() =>
      _DiagnosticIntroScreenState();
}

class _DiagnosticIntroScreenState extends ConsumerState<DiagnosticIntroScreen> {
  @override
  void initState() {
    super.initState();
    final mode = widget.initialMode != null
        ? DiagnosticMode.fromWire(widget.initialMode!)
        : null;
    unawaited(
      Future<void>.microtask(() {
        if (!mounted) return;
        unawaited(
          ref
              .read(diagnosticNotifierProvider.notifier)
              .prepareIntro(
                examIdOverride: widget.examId,
                modeOverride: mode,
              ),
        );
      }),
    );
  }

  void _exitSafe() => context.safePopOrGo(AppRoutes.home);

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(diagnosticNotifierProvider);
    final notifier = ref.read(diagnosticNotifierProvider.notifier);
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final modeLabel = switch (state.mode) {
      DiagnosticMode.standard => 'Standard (15m) ▾',
      DiagnosticMode.extended => 'Untimed Help ▾',
      DiagnosticMode.accessible => 'Accessible Audio ▾',
    };

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Close',
          onPressed: _exitSafe,
          icon: const AppIcon(LucideGlyph.x, size: 22),
        ),
        title: const Text('Quick Starting Check'),
        actions: <Widget>[
          IconButton(
            tooltip: 'How this works',
            onPressed: () {
              unawaited(
                showDiagnosticHelpSheet(
                  context,
                  isTimedSession: state.isTimed,
                  isActiveSession: false,
                  onSwitchToExtendedHelp: () =>
                      notifier.setMode(DiagnosticMode.extended),
                ),
              );
            },
            icon: const AppIcon(LucideGlyph.info, size: 22),
          ),
        ],
      ),
      bottomBar: MzStickyBottomBar(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            PrimaryButton(
              label: state.isLoadingBank
                  ? 'Preparing questions...'
                  : 'Start check',
              onPressed: state.isLoadingBank || state.bank == null
                  ? null
                  : () async {
                      final router = GoRouter.of(context);
                      final diagId = await notifier.startDiagnosticSession();
                      if (diagId != null) {
                        router.go(AppRoutes.buildDiagnosticSession(diagId));
                      }
                    },
            ),
            const SizedBox(height: SpacingTokens.xs),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: SpacingTokens.md,
              children: <Widget>[
                if (!state.speakingOptOut)
                  TextButton(
                    onPressed: state.isLoadingBank || state.bank == null
                        ? null
                        : () async {
                            notifier.setSpeakingOptOut(
                              optOut: true,
                              reason: NoEvidenceReason.skipped,
                            );
                            final router = GoRouter.of(context);
                            final diagId = await notifier
                                .startDiagnosticSession();
                            if (diagId != null) {
                              router.go(
                                AppRoutes.buildDiagnosticSession(diagId),
                              );
                            }
                          },
                    child: const Text('Continue without Speaking'),
                  ),
                TextButton(
                  onPressed: () => context.go(AppRoutes.home),
                  child: const Text('Do this later'),
                ),
              ],
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.symmetric(
          vertical: SpacingTokens.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            // Compact orientation hero + 1-tap Timing & Accessibility mode chip
            MzCard(
              variant: MzCardVariant.hero,
              padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      const IconWell(
                        glyph: LucideGlyph.sparkles,
                        tint: IconWellTint.blue,
                        size: 36,
                        iconSize: 18,
                      ),
                      const SizedBox(width: SpacingTokens.sm),
                      Expanded(
                        child: Text(
                          'Find Your Starting Level (~10–15 Min)',
                          style: typography.cardTitle,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  Text(
                    '4 short checks • unscored examples • skip any skill.',
                    style: typography.secondary.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: MzChip(
                      label: modeLabel,
                      glyph: LucideGlyph.slidersHorizontal,
                      variant: state.mode == DiagnosticMode.standard
                          ? MzChipVariant.target
                          : MzChipVariant.positive,
                      onTap: () => _openHelpOptions(context, state, notifier),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: SpacingTokens.sm),

            if (state.bankLoadError != null) ...<Widget>[
              StatusBanner(
                message:
                    'Could not load check questions: ${state.bankLoadError}',
                variant: StatusBannerVariant.error,
                actionLabel: 'Retry',
                onTapAction: notifier.retryLoadBank,
              ),
              const SizedBox(height: SpacingTokens.sm),
            ],

            // Compact side-by-side Sound & Microphone check card
            _DeviceCheckCard(state: state, notifier: notifier),
            const SizedBox(height: SpacingTokens.sm),

            // Scannable 3-item beginner guidelines
            const _CompactDoDontSummary(),
            const SizedBox(height: SpacingTokens.xs),

            // Compact privacy & audio consent link
            InkWell(
              onTap: () => _showPrivacySheet(context),
              borderRadius: shapes.controlRadius,
              child: Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  vertical: SpacingTokens.xs,
                  horizontal: SpacingTokens.xs,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    AppIcon(
                      LucideGlyph.info,
                      size: 14,
                      color: colors.textTertiary,
                    ),
                    const SizedBox(width: SpacingTokens.xs),
                    Flexible(
                      child: Text(
                        'Audio & privacy notice',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: typography.caption.copyWith(
                          color: colors.textSecondary,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openHelpOptions(
    BuildContext context,
    DiagnosticState state,
    DiagnosticNotifier notifier,
  ) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    unawaited(
      showMzBottomSheet<void>(
        context: context,
        title: 'Accessibility & Timing Options',
        child: Builder(
          builder: (sheetCtx) => Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              SpacingTokens.lg,
              SpacingTokens.md,
              SpacingTokens.lg,
              SpacingTokens.xl,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                _ModeChoiceTile(
                  title: 'Standard 15-Minute Check',
                  subtitle:
                      'Paced 4-skill flow with automatic stage transitions.',
                  selected: state.mode == DiagnosticMode.standard,
                  onTap: () {
                    notifier.setMode(DiagnosticMode.standard);
                    Navigator.of(sheetCtx).pop();
                  },
                ),
                const SizedBox(height: SpacingTokens.sm),
                _ModeChoiceTile(
                  title: 'Extended Help (Untimed)',
                  subtitle: 'Removes strict countdown limits so you can work without rush.',
                  selected: state.mode == DiagnosticMode.extended,
                  onTap: () {
                    notifier.setMode(DiagnosticMode.extended);
                    Navigator.of(sheetCtx).pop();
                  },
                ),
                const SizedBox(height: SpacingTokens.sm),
                _ModeChoiceTile(
                  title: 'Accessible Audio Mode',
                  subtitle: 'Allows audio replay and post-audio transcript if needed.',
                  selected: state.mode == DiagnosticMode.accessible,
                  onTap: () {
                    notifier.setMode(DiagnosticMode.accessible);
                    Navigator.of(sheetCtx).pop();
                  },
                ),
                const SizedBox(height: SpacingTokens.md),
                Text(
                  'Your selected mode is shown alongside your starting placement.',
                  style: typography.caption.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showPrivacySheet(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    unawaited(
      showMzBottomSheet<void>(
        context: context,
        title: 'Audio & Privacy Notice',
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            SpacingTokens.lg,
            SpacingTokens.md,
            SpacingTokens.lg,
            SpacingTokens.xl,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                '• The 3-second microphone check runs locally and deletes its temporary test audio right away.\n'
                '• During the live Speaking step, your spoken answer is uploaded securely to calculate fluency and clarity feedback.\n'
                '• You can remove all local data anytime in Settings.',
                style: typography.body.copyWith(color: colors.textSecondary),
              ),
              const SizedBox(height: SpacingTokens.lg),
              PrimaryButton(
                label: 'Close',
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CompactDoDontSummary extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return MzCard(
      variant: MzCardVariant.surfaceAlt,
      padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _GuidelineRow(
            glyph: LucideGlyph.check,
            iconColor: colors.success,
            text: 'Own words only — no translators or AI.',
          ),
          const SizedBox(height: SpacingTokens.xs),
          _GuidelineRow(
            glyph: LucideGlyph.shieldCheck,
            iconColor: colors.primary,
            text: 'Unsure? Tap "I don\'t know" anytime.',
          ),
          const SizedBox(height: SpacingTokens.xs),
          _GuidelineRow(
            glyph: LucideGlyph.headphones,
            iconColor: colors.listeningAccent,
            text: 'Audio plays once in Standard mode.',
          ),
        ],
      ),
    );
  }
}

class _GuidelineRow extends StatelessWidget {
  const new({
    required this.glyph,
    required this.iconColor,
    required this.text,
  });

  final LucideGlyph glyph;
  final Color iconColor;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        AppIcon(glyph, size: 16, color: iconColor),
        const SizedBox(width: SpacingTokens.sm),
        Expanded(
          child: Text(
            text,
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
        ),
      ],
    );
  }
}

class _DeviceCheckCard extends StatelessWidget {
  const new({required this.state, required this.notifier});

  final DiagnosticState state;
  final DiagnosticNotifier notifier;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    final micHasPermission =
        state.micStatus != MicPreflightStatus.permissionDenied &&
        state.micStatus != MicPreflightStatus.unavailable;

    final soundLabel = state.isPlayingPreflightAudio
        ? 'Playing...'
        : (state.soundConfirmed ? 'Sound OK' : 'Test sound');
    final micLabel = state.micStatus == MicPreflightStatus.checking
        ? 'Speak (3s)...'
        : (state.micStatus == MicPreflightStatus.ready
              ? 'Mic OK'
              : (state.speakingOptOut ? 'Mic skipped' : 'Test mic'));

    return MzCard(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: SpacingTokens.sm,
            runSpacing: SpacingTokens.xs,
            children: <Widget>[
              Text('Quick Sound & Mic Check', style: typography.cardTitle),
              Text(
                'Optional',
                style: typography.caption.copyWith(color: colors.textTertiary),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.sm),
          LayoutBuilder(
            builder: (ctx, constraints) {
              final stackVertically =
                  constraints.maxWidth < 300 ||
                  MediaQuery.textScalerOf(ctx).scale(1) > 1.35;
              final soundBtn = SecondaryButton(
                label: soundLabel,
                glyph: state.soundConfirmed
                    ? LucideGlyph.checkCircle2
                    : LucideGlyph.volume2,
                onPressed: state.bank == null || state.isPlayingPreflightAudio
                    ? null
                    : notifier.playPreflightSampleSound,
              );
              final micBtn = SecondaryButton(
                label: micLabel,
                glyph: state.micStatus == MicPreflightStatus.ready
                    ? LucideGlyph.checkCircle2
                    : (state.speakingOptOut
                          ? LucideGlyph.micOff
                          : LucideGlyph.mic),
                onPressed: state.micStatus == MicPreflightStatus.checking
                    ? null
                    : notifier.runMicPreflightCheck,
              );

              if (stackVertically) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    soundBtn,
                    const SizedBox(height: SpacingTokens.xs),
                    micBtn,
                  ],
                );
              }
              return Row(
                children: <Widget>[
                  Expanded(child: soundBtn),
                  const SizedBox(width: SpacingTokens.sm),
                  Expanded(child: micBtn),
                ],
              );
            },
          ),
          if (state.micStatus == MicPreflightStatus.checking) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            AudioLevelMeter(
              normalizedLevel: state.micLevel,
              isPreviewing: true,
              hasPermission: micHasPermission,
            ),
          ],
          if (state.preflightAudioError != null) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            StatusBanner(
              message: state.preflightAudioError!,
              actionLabel: 'I can hear',
              onTapAction: notifier.confirmSoundReady,
            ),
          ],
          if (state.micStatusMessage != null &&
              state.micStatus != MicPreflightStatus.ready) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            StatusBanner(
              message: state.micStatusMessage!,
              actionLabel: !state.speakingOptOut
                  ? 'Continue without Speaking'
                  : null,
              onTapAction: !state.speakingOptOut
                  ? () => notifier.setSpeakingOptOut(
                      optOut: true,
                      reason:
                          state.micStatus == MicPreflightStatus.noisyOrSilent
                          ? NoEvidenceReason.unusableAudio
                          : NoEvidenceReason.micDenied,
                    )
                  : null,
            ),
          ],
          if (state.speakingOptOut) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            StatusBanner(
              message: 'Speaking will be skipped in this check. Reading, Listening, and Writing still run normally.',
              variant: StatusBannerVariant.offline,
              actionLabel: 'Include Speaking',
              onTapAction: () => notifier.setSpeakingOptOut(optOut: false),
            ),
          ],
        ],
      ),
    );
  }
}

class _ModeChoiceTile extends StatelessWidget {
  const new({
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
        decoration: BoxDecoration(
          color: selected ? colors.surfaceAlt : colors.surface,
          borderRadius: shapes.cardRadius,
          border: Border.all(
            color: selected ? colors.primary : colors.borderSubtle,
            width: shapes.strokeWidth,
          ),
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(title, style: typography.cardTitle),
                  const SizedBox(height: SpacingTokens.xs / 2),
                  Text(
                    subtitle,
                    style: typography.secondary.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            AppIcon(
              selected ? LucideGlyph.checkCircle2 : LucideGlyph.chevronRight,
              size: 20,
              color: selected ? colors.primary : colors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }
}

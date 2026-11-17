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
    final typography = AppTypography.of(context);

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
          vertical: SpacingTokens.md,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            // Reassuring orientation hero card
            MzCard(
              variant: MzCardVariant.hero,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      const IconWell(
                        glyph: LucideGlyph.sparkles,
                        tint: IconWellTint.blue,
                      ),
                      const SizedBox(width: SpacingTokens.md),
                      Expanded(
                        child: Text(
                          'Find Your Starting Level in ~10–15 Min',
                          style: typography.cardTitle,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  Text(
                    'Not a pass/fail test. Quick samples across Reading, Listening, Writing, and Speaking calibrate your starting practice.',
                    style: typography.secondary.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  Wrap(
                    spacing: SpacingTokens.sm,
                    runSpacing: SpacingTokens.xs,
                    children: <Widget>[
                      const MzChip(
                        label: 'Unscored examples first',
                        glyph: LucideGlyph.timer,
                      ),
                      const MzChip(
                        label: 'Skip any skill',
                        glyph: LucideGlyph.shieldCheck,
                      ),
                      if (state.mode == DiagnosticMode.extended)
                        const MzChip(
                          label: 'Extended Help (Untimed)',
                          variant: MzChipVariant.positive,
                        )
                      else if (state.mode == DiagnosticMode.accessible)
                        const MzChip(
                          label: 'Accessible Audio',
                          variant: MzChipVariant.positive,
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: SpacingTokens.md),

            if (state.bankLoadError != null) ...<Widget>[
              StatusBanner(
                message:
                    'Could not load check questions: ${state.bankLoadError}',
                variant: StatusBannerVariant.error,
                actionLabel: 'Retry',
                onTapAction: notifier.retryLoadBank,
              ),
              const SizedBox(height: SpacingTokens.md),
            ],

            // Sound & Microphone preflight card
            _DeviceCheckCard(state: state, notifier: notifier),
            const SizedBox(height: SpacingTokens.md),

            // Beginner Do / Don't card
            const _CompactDoDontSummary(),
            const SizedBox(height: SpacingTokens.md),

            // Help / Accessibility options link
            MzCard(
              onTap: () => _openHelpOptions(context, state, notifier),
              child: Row(
                children: <Widget>[
                  const IconWell(
                    glyph: LucideGlyph.slidersHorizontal,
                    tint: IconWellTint.amber,
                    size: 36,
                    iconSize: 18,
                  ),
                  const SizedBox(width: SpacingTokens.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          'Timing & Accessibility Options',
                          style: typography.cardTitle,
                        ),
                        Text(
                          'Untimed Extended Help or replayable Accessible Audio.',
                          style: typography.caption.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  AppIcon(
                    LucideGlyph.chevronRight,
                    size: 20,
                    color: colors.textTertiary,
                  ),
                ],
              ),
            ),
            const SizedBox(height: SpacingTokens.sm),

            // Privacy & audio consent note
            GestureDetector(
              onTap: () => _showPrivacySheet(context),
              child: Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  vertical: SpacingTokens.xs,
                ),
                child: Text(
                  'By tapping Start check, you agree to evaluate your short Writing & Speaking samples. Tap for audio & privacy notice.',
                  style: typography.caption.copyWith(
                    color: colors.textSecondary,
                    decoration: TextDecoration.underline,
                  ),
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
    final typography = AppTypography.of(context);
    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text('Before you begin', style: typography.cardTitle),
          const SizedBox(height: SpacingTokens.sm),
          Text(
            '• Do answer naturally in your own words.\n'
            '• Do tap "I don\'t know" if a passage feels too difficult — it helps calibrate faster.\n'
            "• Don't use dictionaries, translators, or external AI helpers.\n"
            '• Listening clips play once in standard mode.',
            style: typography.secondary.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
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

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text('Quick Sound & Mic Check', style: typography.cardTitle),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            'Optional 15-second check before your timer starts.',
            style: typography.secondary.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.md),

          // Sound Check Row
          Row(
            children: <Widget>[
              Expanded(
                child: SecondaryButton(
                  label: state.isPlayingPreflightAudio
                      ? 'Playing test clip...'
                      : (state.soundConfirmed
                            ? 'Sound ready ✓'
                            : 'Play test sound'),
                  onPressed: state.bank == null || state.isPlayingPreflightAudio
                      ? null
                      : notifier.playPreflightSampleSound,
                ),
              ),
              if (!state.soundConfirmed) ...<Widget>[
                const SizedBox(width: SpacingTokens.sm),
                TextButton(
                  onPressed: notifier.confirmSoundReady,
                  child: const Text('Skip'),
                ),
              ],
            ],
          ),
          if (state.preflightAudioError != null) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            StatusBanner(
              message: state.preflightAudioError!,
              actionLabel: 'I can hear',
              onTapAction: notifier.confirmSoundReady,
            ),
          ],

          const SizedBox(height: SpacingTokens.md),
          Divider(color: colors.borderSubtle, height: 1),
          const SizedBox(height: SpacingTokens.md),

          // Live Mic Check (3 seconds, discarded)
          AudioLevelMeter(
            normalizedLevel: state.micLevel,
            isPreviewing: state.micStatus == MicPreflightStatus.checking,
            hasPermission: micHasPermission,
            isSilent: state.micStatus == MicPreflightStatus.noisyOrSilent,
          ),
          const SizedBox(height: SpacingTokens.sm),
          Row(
            children: <Widget>[
              Expanded(
                child: SecondaryButton(
                  label: state.micStatus == MicPreflightStatus.checking
                      ? 'Listening (3s)...'
                      : (state.micStatus == MicPreflightStatus.ready
                            ? 'Mic ready ✓'
                            : 'Test mic (3s)'),
                  onPressed: state.micStatus == MicPreflightStatus.checking
                      ? null
                      : notifier.runMicPreflightCheck,
                ),
              ),
              const SizedBox(width: SpacingTokens.sm),
              TextButton(
                onPressed: () => notifier.setSpeakingOptOut(
                  optOut: !state.speakingOptOut,
                  reason: NoEvidenceReason.micDenied,
                ),
                child: Text(
                  state.speakingOptOut ? 'Include Speaking' : 'No mic',
                ),
              ),
            ],
          ),
          if (state.micStatusMessage != null) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            StatusBanner(
              message: state.micStatusMessage!,
              variant: state.micStatus == MicPreflightStatus.ready
                  ? StatusBannerVariant.success
                  : StatusBannerVariant.warning,
              actionLabel:
                  state.micStatus != MicPreflightStatus.ready &&
                      !state.speakingOptOut
                  ? 'Continue without Speaking'
                  : null,
              onTapAction:
                  state.micStatus != MicPreflightStatus.ready &&
                      !state.speakingOptOut
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
            const StatusBanner(
              message: 'Speaking will be skipped in this check. Reading, Listening, and Writing still run normally.',
              variant: StatusBannerVariant.offline,
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

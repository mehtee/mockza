import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/exams/exam_descriptor.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/features/onboarding/presentation/onboarding_notifier.dart';
import 'package:mockza/features/onboarding/presentation/onboarding_providers.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_motion.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/mz_sticky_bottom_bar.dart';
import 'package:mockza/theme/primitives.dart';
import 'package:mockza/theme/responsive_layout.dart';

/// High-fidelity 2-step learner onboarding wizard with pinned bottom actions (Screens 23 & 24).
class OnboardingScreen extends ConsumerWidget {
  /// Creates an [OnboardingScreen].
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(onboardingNotifierProvider);
    final notifier = ref.read(onboardingNotifierProvider.notifier);
    final disableAnimations =
        MediaQuery.maybeDisableAnimationsOf(context) ?? false;

    return MzScaffold(
      mode: MzScaffoldMode.onboarding,
      centerOnWide: false,
      padding: EdgeInsetsDirectional.zero,
      body: AnimatedSwitcher(
        duration: disableAnimations
            ? Duration.zero
            : AppMotion.standard.sheetDuration,
        child: state.step == 0
            ? _ExamSelectionStep(
                key: const ValueKey('step_0'),
                state: state,
                notifier: notifier,
              )
            : _GoalSetupStep(
                key: const ValueKey('step_1'),
                state: state,
                notifier: notifier,
              ),
      ),
    );
  }
}

class _ExamSelectionStep extends StatelessWidget {
  const new({
    required this.state,
    required this.notifier,
    super.key,
  });

  final OnboardingState state;
  final OnboardingNotifier notifier;

  @override
  Widget build(BuildContext context) {
    final typography = AppTypography.of(context);
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final gutter = MzResponsive.horizontalGutterOf(context);
    final isTight = MzResponsive.isTightPhoneOf(context);

    return Column(
      children: <Widget>[
        Expanded(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                maxWidth: SpacingTokens.maxContentWidth,
              ),
              child: SingleChildScrollView(
                padding: EdgeInsetsDirectional.symmetric(
                  horizontal: gutter,
                  vertical: isTight ? SpacingTokens.md : SpacingTokens.lg,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    SizedBox(
                      height: isTight ? SpacingTokens.xs : SpacingTokens.md,
                    ),
                    Center(child: MockzaMark(size: isTight ? 36 : 44)),
                    const SizedBox(height: SpacingTokens.md),
                    Text(
                      l10n.onboardingTitle,
                      textAlign: TextAlign.center,
                      style: typography.sectionHeading,
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      'Offline-first exam prep with AI rubric feedback across IELTS, TOEFL iBT, PTE, and Duolingo.',
                      textAlign: TextAlign.center,
                      style: typography.secondary.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.lg),
                    Text(
                      'Choose your target exam',
                      style: typography.cardTitle,
                    ),
                    const SizedBox(height: SpacingTokens.sm),
                    for (final track in ExamTrack.values) ...<Widget>[
                      _ExamCard(
                        title: track.displayName,
                        description: ExamDescriptor.forTrack(track).subtitle,
                        isSelected: state.selectedTrack == track,
                        onTap: () => notifier.selectTrack(track),
                      ),
                      const SizedBox(height: SpacingTokens.sm),
                    ],
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      'Mockza is independent and not affiliated with IELTS, Cambridge, IDP, British Council, PTE, Duolingo, or ETS.',
                      textAlign: TextAlign.center,
                      style: typography.caption.copyWith(
                        color: colors.textTertiary,
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                    Center(
                      child: TextButton(
                        onPressed: () => context.push(
                          AppRoutes.buildAuth(returnTo: AppRoutes.home),
                        ),
                        child: const Text('Already have an account? Sign in'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        MzStickyBottomBar(
          child: PrimaryButton(
            label: 'Continue',
            trailingGlyph: LucideGlyph.arrowRight,
            onPressed: notifier.nextStep,
          ),
        ),
      ],
    );
  }
}

class _ExamCard extends StatelessWidget {
  const new({
    required this.title,
    required this.description,
    required this.isSelected,
    required this.onTap,
  });

  final String title;
  final String description;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);

    return Semantics(
      button: true,
      selected: isSelected,
      excludeSemantics: true,
      label: '$title. $description',
      child: InkWell(
        onTap: onTap,
        borderRadius: shapes.cardRadius,
        child: AnimatedContainer(
          duration: AppMotion.standard.standardDuration,
          padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
          decoration: BoxDecoration(
            color: isSelected ? colors.surfaceAlt : colors.surface,
            borderRadius: shapes.cardRadius,
            border: Border.all(
              color: isSelected ? colors.primary : colors.borderSubtle,
              width: isSelected ? 2 : shapes.strokeWidth,
            ),
          ),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(title, style: typography.cardTitle),
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      description,
                      style: typography.secondary.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: SpacingTokens.sm),
              AppIcon(
                isSelected ? LucideGlyph.checkCircle2 : LucideGlyph.circle,
                color: isSelected ? colors.primary : colors.textTertiary,
                size: 20,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GoalSetupStep extends ConsumerWidget {
  const new({
    required this.state,
    required this.notifier,
    super.key,
  });

  final OnboardingState state;
  final OnboardingNotifier notifier;

  String _bandMeaningLabel(ExamTrack track, double score) {
    final ratio = track.normalizeScoreRatio(score);
    final cefr = switch (ratio) {
      >= 0.82 => 'Expert / Very Advanced (C1–C2)',
      >= 0.65 => 'Strong · Top Universities (C1)',
      >= 0.45 => 'Competent · Study & Work (B2)',
      _ => 'Foundation Builder (B1+)',
    };
    if (track == ExamTrack.toeflIbt) {
      return '$cefr · ~${ExamSpec.estimateToeflLegacy120(score)}/120';
    }
    return cefr;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final typography = AppTypography.of(context);
    final colors = AppColors.of(context);
    final gutter = MzResponsive.horizontalGutterOf(context);

    return Column(
      children: <Widget>[
        Expanded(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                maxWidth: SpacingTokens.maxContentWidth,
              ),
              child: SingleChildScrollView(
                padding: EdgeInsetsDirectional.symmetric(
                  horizontal: gutter,
                  vertical: SpacingTokens.md,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: IconButton(
                        tooltip: 'Back to exam selection',
                        icon: const AppIcon(LucideGlyph.arrowLeft, size: 20),
                        onPressed: notifier.previousStep,
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      'Set your target score',
                      style: typography.sectionHeading,
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      'Personalizes feedback & daily goals — easy to change anytime.',
                      style: typography.secondary.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.lg),
                    Center(
                      child: Column(
                        children: <Widget>[
                          Text(
                            state.formattedTargetScore,
                            style: typography.heroScore.copyWith(
                              color: colors.primary,
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.xs),
                          MzChip(
                            label: _bandMeaningLabel(
                              state.selectedTrack,
                              state.targetBand,
                            ),
                            variant: MzChipVariant.target,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.sm),
                    Semantics(
                      label: 'Target IELTS band score',
                      value: state.formattedTargetScore,
                      child: Slider(
                        value: state.targetBand.clamp(
                          state.selectedTrack.minScore,
                          state.selectedTrack.maxScore,
                        ),
                        min: state.selectedTrack.minScore,
                        max: state.selectedTrack.maxScore,
                        divisions:
                            ((state.selectedTrack.maxScore -
                                        state.selectedTrack.minScore) /
                                    state.selectedTrack.scoreStep)
                                .round(),
                        semanticFormatterCallback:
                            state.selectedTrack.formatScoreWithUnit,
                        activeColor: colors.primary,
                        onChanged: notifier.selectTargetBand,
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.lg),
                    Text(
                      'When is your test date?',
                      style: typography.cardTitle,
                    ),
                    const SizedBox(height: SpacingTokens.sm),
                    Wrap(
                      spacing: SpacingTokens.sm,
                      runSpacing: SpacingTokens.sm,
                      children: <Widget>[
                        _TimeframeChip(
                          label: '2 Weeks',
                          isSelected: state.targetDays == 14,
                          onTap: () => notifier.selectTargetDays(14),
                        ),
                        _TimeframeChip(
                          label: '1 Month',
                          isSelected: state.targetDays == 30,
                          onTap: () => notifier.selectTargetDays(30),
                        ),
                        _TimeframeChip(
                          label: '3 Months',
                          isSelected: state.targetDays == 90,
                          onTap: () => notifier.selectTargetDays(90),
                        ),
                        _TimeframeChip(
                          label: 'Unset',
                          isSelected: state.targetDays == null,
                          onTap: () => notifier.selectTargetDays(null),
                        ),
                      ],
                    ),
                    const SizedBox(height: SpacingTokens.lg),
                    MzCard(
                      onTap: () => notifier.toggleDiagnostic(
                        want: !state.wantDiagnostic,
                      ),
                      child: Row(
                        children: <Widget>[
                          AppIcon(
                            state.wantDiagnostic
                                ? LucideGlyph.checkCircle2
                                : LucideGlyph.circle,
                            color: state.wantDiagnostic
                                ? colors.primary
                                : colors.textTertiary,
                          ),
                          const SizedBox(width: SpacingTokens.md),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(
                                  'Start with a Free ~10–15 Min Check',
                                  style: typography.cardTitle,
                                ),
                                const SizedBox(height: SpacingTokens.xs),
                                Text(
                                  'Checks all 4 skills briefly so we recommend the best starting drills.',
                                  style: typography.secondary.copyWith(
                                    color: colors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (state.errorMessage != null) ...<Widget>[
                      const SizedBox(height: SpacingTokens.md),
                      Text(
                        state.errorMessage!,
                        textAlign: TextAlign.center,
                        style: typography.secondary.copyWith(
                          color: colors.error,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
        MzStickyBottomBar(
          child: PrimaryButton(
            label: state.isSaving
                ? 'Setting up your workspace...'
                : 'Get Started',
            isLoading: state.isSaving,
            onPressed: state.isSaving
                ? null
                : () async {
                    final router = GoRouter.of(context);
                    final destination = await notifier.completeOnboarding();
                    if (destination != null) {
                      router.go(destination);
                    }
                  },
          ),
        ),
      ],
    );
  }
}

class _TimeframeChip extends StatelessWidget {
  const new({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: SpacingTokens.md,
          vertical: SpacingTokens.sm,
        ),
        decoration: BoxDecoration(
          color: isSelected ? colors.surfaceAlt : colors.surface,
          borderRadius: shapes.pillRadius,
          border: Border.all(
            color: isSelected ? colors.primary : colors.borderSubtle,
            width: 1.5,
          ),
        ),
        child: Text(
          label,
          style: typography.secondary.copyWith(
            color: isSelected ? colors.primary : colors.textPrimary,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}

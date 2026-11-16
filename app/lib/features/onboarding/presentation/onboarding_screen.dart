import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/features/onboarding/presentation/onboarding_notifier.dart';
import 'package:mockza/features/onboarding/presentation/onboarding_providers.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_motion.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/primitives.dart';

/// High-fidelity 2-step learner onboarding wizard (Screens 23 & 24).
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
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 600),
          child: AnimatedSwitcher(
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

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const SizedBox(height: SpacingTokens.xl),
          const Center(child: MockzaMark(size: 48)),
          const SizedBox(height: SpacingTokens.lg),
          Text(
            l10n.onboardingTitle,
            textAlign: TextAlign.center,
            style: typography.headline,
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            'Offline-first IELTS preparation with structured AI rubric feedback and local Reading & Listening practice.',
            textAlign: TextAlign.center,
            style: typography.body.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.xl),
          Text(
            'Choose your target exam',
            style: typography.cardTitle,
          ),
          const SizedBox(height: SpacingTokens.sm),
          _ExamCard(
            title: 'IELTS Academic',
            description:
                'For university admissions and professional licensing.',
            isSelected: state.selectedTrack == ExamTrack.ieltsAcademic,
            onTap: () => notifier.selectTrack(ExamTrack.ieltsAcademic),
          ),
          const SizedBox(height: SpacingTokens.sm),
          _ExamCard(
            title: 'IELTS General Training',
            description:
                'Letters, workplace passages, and migration preparation.',
            isSelected: state.selectedTrack == ExamTrack.ieltsGeneral,
            onTap: () => notifier.selectTrack(ExamTrack.ieltsGeneral),
          ),
          const SizedBox(height: SpacingTokens.sm),
          _ExamCard(
            title: 'PTE Academic',
            description: 'Coming soon — 10–90 automated PTE scoring packs are in development.',
            isSelected: false,
            isComingSoon: true,
            onTap: () {},
          ),
          const SizedBox(height: SpacingTokens.sm),
          _ExamCard(
            title: 'TOEFL iBT',
            description: 'Coming soon — 0–120 TOEFL iBT full simulations are in development.',
            isSelected: false,
            isComingSoon: true,
            onTap: () {},
          ),
          const SizedBox(height: SpacingTokens.xl),
          PrimaryButton(
            label: 'Continue',
            trailingGlyph: LucideGlyph.arrowRight,
            onPressed: notifier.nextStep,
          ),
          const SizedBox(height: SpacingTokens.md),
          Text(
            'Mockza is independent and not affiliated with IELTS, Cambridge, IDP, or British Council.',
            textAlign: TextAlign.center,
            style: typography.caption.copyWith(color: colors.textTertiary),
          ),
          const SizedBox(height: SpacingTokens.lg),
        ],
      ),
    );
  }
}

class _ExamCard extends StatelessWidget {
  const new({
    required this.title,
    required this.description,
    required this.isSelected,
    required this.onTap,
    this.isComingSoon = false,
  });

  final String title;
  final String description;
  final bool isSelected;
  final VoidCallback onTap;
  final bool isComingSoon;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);

    return Semantics(
      button: !isComingSoon,
      enabled: !isComingSoon,
      excludeSemantics: true,
      label: isComingSoon
          ? '$title, Coming soon. $description'
          : '$title. $description',
      child: GestureDetector(
        onTap: isComingSoon ? null : onTap,
        child: Opacity(
          opacity: isComingSoon ? 0.65 : 1.0,
          child: AnimatedContainer(
            duration: AppMotion.standard.standardDuration,
            padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
            decoration: BoxDecoration(
              color: isSelected ? colors.surfaceAlt : colors.surface,
              borderRadius: shapes.cardRadius,
              border: Border.all(
                color: isSelected ? colors.primary : colors.borderSubtle,
                width: isSelected ? 2 : 1,
              ),
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Flexible(
                            child: Text(title, style: typography.cardTitle),
                          ),
                          if (isComingSoon) ...<Widget>[
                            const SizedBox(width: SpacingTokens.xs),
                            Container(
                              padding: const EdgeInsetsDirectional.symmetric(
                                horizontal: SpacingTokens.xs,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: colors.surfaceAlt,
                                borderRadius: shapes.pillRadius,
                                border: Border.all(color: colors.borderSubtle),
                              ),
                              child: Text(
                                'Soon',
                                style: typography.caption.copyWith(
                                  color: colors.textSecondary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
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
                if (!isComingSoon)
                  AppIcon(
                    isSelected ? LucideGlyph.check : LucideGlyph.chevronRight,
                    color: isSelected ? colors.primary : colors.textTertiary,
                    size: 20,
                  ),
              ],
            ),
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final typography = AppTypography.of(context);
    final colors = AppColors.of(context);

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const SizedBox(height: SpacingTokens.md),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: IconButton(
              tooltip: 'Back to exam selection',
              icon: const AppIcon(LucideGlyph.arrowLeft, size: 20),
              onPressed: notifier.previousStep,
            ),
          ),
          const SizedBox(height: SpacingTokens.sm),
          Text(
            'Set your target score',
            style: typography.headline,
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            'We personalize AI feedback and micro-drills to bridge your score gap.',
            style: typography.body.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.xl),
          Center(
            child: Text(
              state.formattedTargetScore,
              style: typography.heroScore.copyWith(color: colors.primary),
            ),
          ),
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
              divisions: state.isIeltsScale
                  ? ((state.selectedTrack.maxScore -
                                state.selectedTrack.minScore) *
                            2)
                        .toInt()
                  : (state.selectedTrack.maxScore -
                            state.selectedTrack.minScore)
                        .toInt(),
              semanticFormatterCallback: (val) => state.isIeltsScale
                  ? 'Band ${val.toStringAsFixed(1)}'
                  : '${val.round()} pts',
              activeColor: colors.primary,
              onChanged: notifier.selectTargetBand,
            ),
          ),
          const SizedBox(height: SpacingTokens.xl),
          Text(
            'When is your test date?',
            style: typography.cardTitle,
          ),
          const SizedBox(height: SpacingTokens.sm),
          Row(
            children: <Widget>[
              _TimeframeChip(
                label: '2 Weeks',
                isSelected: state.targetDays == 14,
                onTap: () => notifier.selectTargetDays(14),
              ),
              const SizedBox(width: SpacingTokens.sm),
              _TimeframeChip(
                label: '1 Month',
                isSelected: state.targetDays == 30,
                onTap: () => notifier.selectTargetDays(30),
              ),
              const SizedBox(width: SpacingTokens.sm),
              _TimeframeChip(
                label: '3 Months',
                isSelected: state.targetDays == 90,
                onTap: () => notifier.selectTargetDays(90),
              ),
              const SizedBox(width: SpacingTokens.sm),
              _TimeframeChip(
                label: 'Unset',
                isSelected: state.targetDays == null,
                onTap: () => notifier.selectTargetDays(null),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.xl),
          GestureDetector(
            onTap: () => notifier.toggleDiagnostic(want: !state.wantDiagnostic),
            child: MzCard(
              child: Row(
                children: <Widget>[
                  AppIcon(
                    state.wantDiagnostic
                        ? LucideGlyph.checkCircle2
                        : LucideGlyph.x,
                    color: state.wantDiagnostic
                        ? colors.primary
                        : colors.textTertiary,
                  ),
                  const SizedBox(width: SpacingTokens.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          'Start with a Free Baseline Test',
                          style: typography.cardTitle,
                        ),
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          'Opens the Speaking baseline simulator right away so Mockza can estimate your starting band.',
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
          ),
          if (state.errorMessage != null) ...<Widget>[
            const SizedBox(height: SpacingTokens.md),
            Text(
              state.errorMessage!,
              textAlign: TextAlign.center,
              style: typography.secondary.copyWith(color: colors.error),
            ),
          ],
          const SizedBox(height: SpacingTokens.xxl),
          PrimaryButton(
            label: state.isSaving
                ? 'Setting up your workspace...'
                : 'Get Started',
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
          const SizedBox(height: SpacingTokens.lg),
        ],
      ),
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

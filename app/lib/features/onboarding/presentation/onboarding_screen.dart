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

    return MzScaffold(
      mode: MzScaffoldMode.onboarding,
      body: AnimatedSwitcher(
        duration: AppMotion.standard.sheetDuration,
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
            'AI-powered IELTS preparation calibrated to official examiner standards.',
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
            description: '10–90 automated scoring calibration powered by IELTS core modules.',
            isSelected: state.selectedTrack == ExamTrack.pteAcademic,
            onTap: () => notifier.selectTrack(ExamTrack.pteAcademic),
          ),
          const SizedBox(height: SpacingTokens.sm),
          _ExamCard(
            title: 'TOEFL iBT',
            description:
                '0–120 target scale calibration using shared academic drills.',
            isSelected: state.selectedTrack == ExamTrack.toeflIbt,
            onTap: () => notifier.selectTrack(ExamTrack.toeflIbt),
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
      label: '$title. $description',
      child: GestureDetector(
        onTap: onTap,
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
                isSelected ? LucideGlyph.check : LucideGlyph.chevronRight,
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
          Slider(
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
                : (state.selectedTrack.maxScore - state.selectedTrack.minScore)
                      .toInt(),
            activeColor: colors.primary,
            onChanged: notifier.selectTargetBand,
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
                          'Start with a 15-min Diagnostic Test',
                          style: typography.cardTitle,
                        ),
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          'Evaluates Speaking & Writing immediately to calibrate your baseline.',
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
                    final destination = await notifier.completeOnboarding();
                    if (destination != null && context.mounted) {
                      context.go(destination);
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

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/exams/exam_descriptor.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/formatting/jalali_edge_formatter.dart';
import 'package:mockza/core/personalization/topic_taxonomy.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/features/onboarding/presentation/onboarding_notifier.dart';
import 'package:mockza/features/onboarding/presentation/onboarding_providers.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_motion.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_jalali_date_picker.dart';
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

class _ExamSelectionStep extends ConsumerWidget {
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
    final l10n = AppLocalizations.of(context);
    final gutter = MzResponsive.horizontalGutterOf(context);
    final isTight = MzResponsive.isTightPhoneOf(context);
    final isIran = ref.watch(editionConfigProvider).edition == AppEdition.iran;

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
                    Center(
                      child: EditionBrandMark(
                        size: isTight ? 36 : 44,
                        isIran: isIran,
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.md),
                    Text(
                      isIran ? l10n.onboardingTitle : 'Welcome to Mockza',
                      textAlign: TextAlign.center,
                      style: typography.sectionHeading,
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      isIran
                          ? 'آمادگی آفلاین آزمون‌های آیلتس، تافل، پی‌تی‌ای و دولینگو با تصحیح و بازخورد هوشمند هوش مصنوعی.'
                          : 'Offline-first exam prep with AI rubric feedback across IELTS, TOEFL iBT, PTE, and Duolingo.',
                      textAlign: TextAlign.center,
                      style: typography.secondary.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.lg),
                    Text(
                      isIran
                          ? 'آزمون هدف خود را انتخاب کنید'
                          : 'Choose your target exam',
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
                      isIran
                          ? 'سنجیا یک ابزار مستقل آمادگی آزمون است و وابستگی رسمی به IELTS، Cambridge، British Council، PTE، Duolingo یا ETS ندارد.'
                          : 'Mockza is independent and not affiliated with IELTS, Cambridge, IDP, British Council, PTE, Duolingo, or ETS.',
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
                        child: Text(
                          isIran
                              ? 'قبلاً حساب داشته‌اید؟ ورود'
                              : 'Already have an account? Sign in',
                        ),
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
            label: isIran ? 'ادامه' : 'Continue',
            trailingGlyph: isIran
                ? LucideGlyph.arrowLeft
                : LucideGlyph.arrowRight,
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
                child: LtrExamBoundary(
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

  String _bandMeaningLabel(
    ExamTrack track,
    double score, {
    required bool isIran,
  }) {
    final ratio = track.normalizeScoreRatio(score);
    final cefr = isIran
        ? switch (ratio) {
            >= 0.82 => 'سطح حرفه‌ای / بسیار پیشرفته (C1–C2)',
            >= 0.65 => 'قوی · مناسب دانشگاه‌های برتر (C1)',
            >= 0.45 => 'کارآمد · تحصیل و مهاجرت کاری (B2)',
            _ => 'ساخت پایه زبان (B1+)',
          }
        : switch (ratio) {
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
    final editionConfig = ref.watch(editionConfigProvider);
    final isIran = editionConfig.edition == AppEdition.iran;
    final todaySerial = SerialDay.fromUtcDateTime(
      ref.watch(clockProvider).now(),
    );

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
                        tooltip: isIran
                            ? 'بازگشت به انتخاب آزمون'
                            : 'Back to exam selection',
                        icon: AppIcon(
                          isIran
                              ? LucideGlyph.arrowRight
                              : LucideGlyph.arrowLeft,
                          size: 20,
                        ),
                        onPressed: notifier.previousStep,
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.md),
                    Text(
                      AppLocalizations.of(context).learningModeLabel,
                      style: typography.cardTitle,
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      AppLocalizations.of(context).learningModeSectionSubtitle,
                      style: typography.caption.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.sm),
                    for (final option
                        in <({String key, String title, String subtitle})>[
                          (
                            key: 'both',
                            title: AppLocalizations.of(
                              context,
                            ).learningModeBoth,
                            subtitle: AppLocalizations.of(
                              context,
                            ).learningModeBothSubtitle,
                          ),
                          (
                            key: 'exams',
                            title: AppLocalizations.of(
                              context,
                            ).learningModeExams,
                            subtitle: AppLocalizations.of(
                              context,
                            ).learningModeExamsSubtitle,
                          ),
                          (
                            key: 'coach',
                            title: AppLocalizations.of(
                              context,
                            ).learningModeCoach,
                            subtitle: AppLocalizations.of(
                              context,
                            ).learningModeCoachSubtitle,
                          ),
                        ]) ...<Widget>[
                      KeyedSubtree(
                        key: ValueKey<String>(
                          'onboarding_focus_${option.key}',
                        ),
                        child: _ExamCard(
                          title: option.title,
                          description: option.subtitle,
                          isSelected: state.studyFocus == option.key,
                          onTap: () => notifier.selectStudyFocus(option.key),
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.xs),
                    ],
                    const SizedBox(height: SpacingTokens.md),
                    Text(
                      isIran
                          ? 'موضوعات مورد علاقه برای مربی هوشمند (اختیاری)'
                          : 'Favorite topics for Smart Coach (optional)',
                      style: typography.cardTitle,
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      isIran
                          ? 'تمرین‌های ۱۰ دقیقه‌ای روزانه حول همین موضوعات ساخته می‌شوند.'
                          : 'Daily 10-minute prompts adapt around the topics you tap.',
                      style: typography.caption.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.sm),
                    Wrap(
                      spacing: SpacingTokens.sm,
                      runSpacing: SpacingTokens.xs,
                      children: CanonicalTopicKey.values
                          .map((topic) {
                            final key = topic.wireKey;
                            final label = topic.labelFor(isIran: isIran);
                            final selected = state.selectedTopics.contains(key);
                            return FilterChip(
                              key: ValueKey<String>('onboarding_topic_$key'),
                              label: Text(label),
                              selected: selected,
                              onSelected: (_) => notifier.toggleTopic(key),
                            );
                          })
                          .toList(growable: false),
                    ),
                    const SizedBox(height: SpacingTokens.lg),
                    Text(
                      isIran
                          ? 'نمره هدف خود را تعیین کنید'
                          : 'Set your target score',
                      style: typography.sectionHeading,
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      isIran
                          ? 'بازخوردها و برنامه تمرین روزانه بر این اساس تنظیم می‌شود (هر زمان قابل تغییر است).'
                          : 'Personalizes feedback & daily goals — easy to change anytime.',
                      style: typography.secondary.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.lg),
                    Center(
                      child: Column(
                        children: <Widget>[
                          LtrExamBoundary(
                            child: Text(
                              state.formattedTargetScore,
                              style: typography.heroScore.copyWith(
                                color: colors.primary,
                              ),
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.xs),
                          MzChip(
                            label: _bandMeaningLabel(
                              state.selectedTrack,
                              state.targetBand,
                              isIran: isIran,
                            ),
                            variant: MzChipVariant.target,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.sm),
                    Semantics(
                      label: isIran
                          ? 'نمره هدف آزمون'
                          : 'Target IELTS band score',
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
                      isIran
                          ? 'تاریخ آزمون شما کی است؟'
                          : 'When is your test date?',
                      style: typography.cardTitle,
                    ),
                    const SizedBox(height: SpacingTokens.sm),
                    Wrap(
                      spacing: SpacingTokens.sm,
                      runSpacing: SpacingTokens.sm,
                      children: <Widget>[
                        _TimeframeChip(
                          label: isIran ? '۲ هفته دیگر' : '2 Weeks',
                          isSelected:
                              state.targetDateSerial == null &&
                              state.targetDays == 14,
                          onTap: () => notifier.selectTargetDays(14),
                        ),
                        _TimeframeChip(
                          label: isIran ? '۱ ماه دیگر' : '1 Month',
                          isSelected:
                              state.targetDateSerial == null &&
                              state.targetDays == 30,
                          onTap: () => notifier.selectTargetDays(30),
                        ),
                        _TimeframeChip(
                          label: isIran ? '۳ ماه دیگر' : '3 Months',
                          isSelected:
                              state.targetDateSerial == null &&
                              state.targetDays == 90,
                          onTap: () => notifier.selectTargetDays(90),
                        ),
                        _TimeframeChip(
                          label: isIran ? 'نامشخص' : 'Unset',
                          isSelected:
                              state.targetDateSerial == null &&
                              state.targetDays == null,
                          onTap: () => notifier.selectTargetDays(null),
                        ),
                        if (isIran)
                          _TimeframeChip(
                            label: state.targetDateSerial != null
                                ? 'تاریخ: ${JalaliEdgeFormatter.formatSerialDay(SerialDay(state.targetDateSerial!), AppEdition.iran)}'
                                : 'انتخاب از تقویم شمسی',
                            isSelected: state.targetDateSerial != null,
                            onTap: () async {
                              final picked = await showMzJalaliDatePickerSheet(
                                context,
                                today: todaySerial,
                                initialSelectedDay:
                                    state.targetDateSerial != null
                                    ? SerialDay(state.targetDateSerial!)
                                    : null,
                              );
                              if (picked == null) return;
                              notifier.selectTargetDateSerial(
                                picked.cleared ? null : picked.day?.value,
                              );
                            },
                          ),
                      ],
                    ),
                    if (isIran && state.targetDateSerial != null) ...<Widget>[
                      const SizedBox(height: SpacingTokens.xs),
                      Text(
                        '${EdgeNumerals.formatChromeNumber(state.targetDays ?? 0, AppEdition.iran)} روز تا تاریخ انتخاب‌شده',
                        style: typography.caption.copyWith(
                          color: colors.primary,
                        ),
                      ),
                    ],
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
                                  isIran
                                      ? 'شروع با تعیین سطح رایگان (~۱۰ تا ۱۵ دقیقه)'
                                      : 'Start with a Free ~10–15 Min Check',
                                  style: typography.cardTitle,
                                ),
                                const SizedBox(height: SpacingTokens.xs),
                                Text(
                                  isIran
                                      ? 'هر ۴ مهارت را کوتاه می‌سنجد تا بهترین تمرین‌های شروع را پیشنهاد دهیم.'
                                      : 'Checks all 4 skills briefly so we recommend the best starting drills.',
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
                ? (isIran
                      ? 'در حال آماده‌سازی فضای مطالعه...'
                      : 'Setting up your workspace...')
                : (isIran ? 'شروع یادگیری' : 'Get Started'),
            isLoading: state.isSaving,
            onPressed: state.isSaving
                ? null
                : () async {
                    final router = GoRouter.of(context);
                    final destination = await notifier.completeOnboarding();
                    if (destination != null) {
                      if (destination == AppRoutes.buildDailyMission()) {
                        router.go(AppRoutes.coach);
                        unawaited(router.push(destination));
                      } else {
                        router.go(destination);
                      }
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

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/localization/edition_copy.dart';
import 'package:mockza/features/micro_drills/presentation/micro_drills_notifier.dart';
import 'package:mockza/features/micro_drills/presentation/micro_drills_providers.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/routing/safe_pop.dart';
import 'package:mockza/services/personalization_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/empty_state.dart';
import 'package:mockza/theme/components/exam_exit_guard.dart';
import 'package:mockza/theme/components/exam_question_controls.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/mz_sticky_bottom_bar.dart';
import 'package:mockza/theme/components/score_meter.dart';
import 'package:mockza/theme/components/timer_bar.dart';
import 'package:mockza/theme/primitives.dart';

/// Targeted Postgres-synced exam micro-drills workout screen.
class MicroDrillsScreen extends ConsumerStatefulWidget {
  /// Creates a [MicroDrillsScreen].
  const new({
    this.drillId = '',
    super.key,
  });

  /// Drill identifier parameter; empty shows the synced drill selector.
  final String drillId;

  @override
  ConsumerState<MicroDrillsScreen> createState() => _MicroDrillsScreenState();
}

class _MicroDrillsScreenState extends ConsumerState<MicroDrillsScreen> {
  bool _pathOnly = true;
  PersonalizationStateDto? _personalization;

  bool _isFa(BuildContext context) =>
      Localizations.localeOf(context).languageCode == 'fa' ||
      ref.watch(editionConfigProvider).edition == AppEdition.iran;

  @override
  void initState() {
    super.initState();
    unawaited(_loadPersonalization());
    unawaited(
      Future.microtask(
        () => ref
            .read(microDrillsNotifierProvider.notifier)
            .loadDrill(widget.drillId),
      ),
    );
  }

  Future<void> _loadPersonalization() async {
    try {
      final cached = await ref
          .read(personalizationRepositoryProvider)
          .getCachedState();
      if (mounted && cached != null) {
        setState(() => _personalization = cached);
      }
      final remote = await ref.read(personalizationGatewayProvider).getState();
      if (mounted && remote.valueOrNull != null) {
        setState(() => _personalization = remote.valueOrNull);
      }
    } on Object {
      // Offline safe.
    }
  }

  @override
  void didUpdateWidget(covariant MicroDrillsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.drillId != widget.drillId) {
      unawaited(
        Future.microtask(
          () => ref
              .read(microDrillsNotifierProvider.notifier)
              .loadDrill(widget.drillId),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(microDrillsNotifierProvider);
    final notifier = ref.read(microDrillsNotifierProvider.notifier);
    final colors = AppColors.of(context);
    final isFa = _isFa(context);

    final activeSpec = state.drillSpec;
    final canPopSafely =
        !state.hasSelectedDrill || state.isFinished || activeSpec == null;

    return ExamExitGuard(
      enabled: !canPopSafely,
      dialogTitle: isFa ? 'خروج از تمرین سریع؟' : 'Exit Micro-Drill?',
      dialogMessage: isFa
          ? 'پیشرفت شما در این جلسه تمرینی ذخیره نخواهد شد.'
          : 'Your progress in this workout session will be discarded.',
      cancelLabel: isFa ? 'ادامه تمرین' : 'Stay',
      onConfirmedExit: () => context.safePopOrGo(AppRoutes.practice),
      child: MzScaffold(
        appBar: AppBar(
          backgroundColor: colors.background,
          elevation: 0,
          leading: IconButton(
            tooltip: isFa ? 'بازگشت' : 'Back',
            icon: const AppIcon(LucideGlyph.x, size: 20),
            onPressed: () async {
              final popped = await Navigator.of(context).maybePop();
              if (!popped && canPopSafely && context.mounted) {
                context.safePopOrGo(AppRoutes.practice);
              }
            },
          ),
          title: Text(
            activeSpec?.title ?? (isFa ? 'تمرین‌های سریع' : 'Micro-Drills'),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          actions: <Widget>[
            if (activeSpec != null && !state.isFinished)
              Padding(
                padding: const EdgeInsetsDirectional.only(
                  end: SpacingTokens.sm,
                ),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 140),
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    child: TimerBar(
                      remainingSeconds: state.remainingSeconds,
                      totalSeconds: activeSpec.durationSeconds,
                    ),
                  ),
                ),
              ),
          ],
        ),
        body: _buildBody(context, state, notifier, isFa: isFa),
        bottomBar:
            (!state.isLoading &&
                state.hasSelectedDrill &&
                activeSpec != null &&
                !state.isFinished &&
                state.currentItem != null)
            ? MzStickyBottomBar(
                child: _buildBottomAction(
                  context,
                  state,
                  activeSpec,
                  notifier,
                  isFa: isFa,
                ),
              )
            : null,
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    MicroDrillsState state,
    MicroDrillsNotifier notifier, {
    required bool isFa,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    if (state.isLoading) {
      return Center(
        child: CircularProgressIndicator(color: colors.primary),
      );
    }

    if (state.availableDrills.isEmpty) {
      return EmptyState(
        title: isFa
            ? 'هنوز تمرینی همگام‌سازی نشده است'
            : 'No drills synced yet',
        description:
            state.errorMessage ??
            (isFa
                ? 'تمرین‌های کوتاه از کاتالوگ سرور دریافت می‌شوند.'
                : 'Micro-drills are downloaded from the server catalog.'),
        actionLabel: isFa ? 'همگام‌سازی تمرین‌ها' : 'Sync Drills',
        onTapAction: () =>
            unawaited(notifier.loadDrill(widget.drillId, forceSync: true)),
      );
    }

    if (!state.hasSelectedDrill || state.drillSpec == null) {
      final l10n = AppLocalizations.of(context);
      final recIds =
          _personalization?.recommendedDrills.map((d) => d.id).toSet() ??
          const <String>{};
      final trackMatched = state.availableDrills
          .where(
            (d) => EditionCopy.matchesDrillTrack(d.drillId, state.examTrack),
          )
          .toList(growable: false);
      final trackBase = trackMatched.isNotEmpty
          ? trackMatched
          : state.availableDrills;
      final recAndTrack = recIds.isEmpty
          ? trackBase
          : trackBase
                .where((d) => recIds.contains(d.drillId))
                .toList(growable: false);
      final pathList = recAndTrack.isNotEmpty ? recAndTrack : trackBase;
      final listToRender = _pathOnly ? pathList : trackBase;
      final hasFilterToggle =
          recAndTrack.isNotEmpty && recAndTrack.length < trackBase.length;

      return ListView(
        padding: const EdgeInsetsDirectional.symmetric(
          vertical: SpacingTokens.lg,
        ),
        children: <Widget>[
          Text(
            isFa ? 'تمرین‌های متمرکز ۳ دقیقه‌ای' : 'Focused 3-Minute Workouts',
            style: typography.sectionHeading.copyWith(
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            isFa
                ? 'تقویت معیارهای نمره‌دهی ${state.examTrack.shortName} با تمرین‌های کوتاه و پربازده.'
                : 'Target specific ${state.examTrack.shortName} grading criteria with short high-yield exercises.',
            style: typography.body.copyWith(color: colors.textSecondary),
          ),
          if (hasFilterToggle) ...<Widget>[
            const SizedBox(height: SpacingTokens.md),
            Wrap(
              spacing: SpacingTokens.xs,
              children: <Widget>[
                ChoiceChip(
                  label: Text(l10n.practiceTabForYourPath),
                  selected: _pathOnly,
                  onSelected: (_) => setState(() => _pathOnly = true),
                ),
                ChoiceChip(
                  label: Text(l10n.practiceTabAllTests),
                  selected: !_pathOnly,
                  onSelected: (_) => setState(() => _pathOnly = false),
                ),
              ],
            ),
          ],
          const SizedBox(height: SpacingTokens.lg),
          ...listToRender.map((drill) {
            final itemCount = isFa
                ? EdgeNumerals.toPersianDigits(drill.items.length)
                : '${drill.items.length}';
            final mins = (drill.durationSeconds / 60).ceil();
            final minsText = isFa
                ? EdgeNumerals.toPersianDigits(mins)
                : '$mins';
            return Padding(
              padding: const EdgeInsetsDirectional.only(
                bottom: SpacingTokens.md,
              ),
              child: MzCard(
                onTap: () => notifier.startSelectedDrill(drill),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          MzChip(
                            label: EditionCopy.localizeMicroDrillCategory(
                              drill.weaknessCode,
                              isIran: isFa,
                            ),
                            variant: MzChipVariant.target,
                          ),
                          const SizedBox(height: SpacingTokens.sm),
                          Text(
                            drill.title,
                            style: typography.cardTitle.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.xs),
                          Text(
                            isFa
                                ? '$itemCount پرسش · $minsText دقیقه · ${drill.subtitle}'
                                : '$itemCount items · $minsText min · ${drill.subtitle}',
                            style: typography.secondary.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: SpacingTokens.md),
                    const AppIcon(LucideGlyph.chevronRight, size: 18),
                  ],
                ),
              ),
            );
          }),
        ],
      );
    }

    final spec = state.drillSpec!;
    if (state.isFinished) {
      return _buildCompletionView(context, state, spec, isFa: isFa);
    }

    final currentItem = state.currentItem;
    if (currentItem == null) {
      return EmptyState(
        glyph: LucideGlyph.info,
        title: isFa ? 'این تمرین پرسشی ندارد' : 'Drill has no questions',
        description: isFa
            ? 'تمرین دیگری را برای شروع انتخاب کنید.'
            : 'Choose another workout to begin.',
        actionLabel: isFa ? 'بازگشت به بخش تمرین' : 'Back to Practice Hub',
        onTapAction: () => context.go(AppRoutes.practice),
      );
    }

    final currentNum = isFa
        ? EdgeNumerals.toPersianDigits(state.currentIndex + 1)
        : '${state.currentIndex + 1}';
    final totalNum = isFa
        ? EdgeNumerals.toPersianDigits(spec.items.length)
        : '${spec.items.length}';

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.symmetric(
        vertical: SpacingTokens.lg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _buildProgressHeader(context, state),
          const SizedBox(height: SpacingTokens.md),
          Row(
            children: <Widget>[
              Flexible(
                child: MzChip(
                  label: EditionCopy.localizeMicroDrillCategory(
                    spec.weaknessCode,
                    isIran: isFa,
                  ),
                  variant: MzChipVariant.target,
                ),
              ),
              const SizedBox(width: SpacingTokens.sm),
              Text(
                isFa
                    ? 'پرسش $currentNum از $totalNum'
                    : 'Question $currentNum of $totalNum',
                style: typography.caption.copyWith(
                  color: colors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          MzCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  EditionCopy.localizeMicroDrillHeader(
                    spec.weaknessCode,
                    isIran: isFa,
                  ),
                  style: typography.cardTitle.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.sm),
                Text(
                  currentItem.prompt,
                  textDirection: TextDirection.ltr,
                  style: typography.body.copyWith(
                    color: colors.textPrimary,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: SpacingTokens.lg),
          Text(
            isFa ? 'بهترین گزینه را انتخاب کنید:' : 'Select the best option:',
            style: typography.secondary.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.sm),
          ...currentItem.options.map(
            (option) => _buildOptionTile(
              context,
              option,
              state,
              currentItem,
              notifier,
            ),
          ),
          if (state.isSubmitted) ...<Widget>[
            const SizedBox(height: SpacingTokens.md),
            _buildFeedbackCard(context, state, currentItem, isFa: isFa),
          ],
          const SizedBox(height: SpacingTokens.md),
        ],
      ),
    );
  }

  Widget _buildProgressHeader(BuildContext context, MicroDrillsState state) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    return ClipRRect(
      borderRadius: shapes.pillRadius,
      child: LinearProgressIndicator(
        value: state.progress,
        minHeight: 6,
        backgroundColor: colors.surfaceAlt,
        valueColor: AlwaysStoppedAnimation<Color>(colors.primary),
      ),
    );
  }

  Widget _buildOptionTile(
    BuildContext context,
    String option,
    MicroDrillsState state,
    MicroDrillItemSpec currentItem,
    MicroDrillsNotifier notifier,
  ) {
    final isSelected = state.selectedOption == option;
    final MzOptionFeedback feedback;
    if (state.isSubmitted) {
      final isCorrectAnswer = currentItem.acceptedAnswers.contains(option);
      if (isCorrectAnswer) {
        feedback = MzOptionFeedback.correct;
      } else if (isSelected) {
        feedback = MzOptionFeedback.incorrectSelected;
      } else {
        feedback = MzOptionFeedback.none;
      }
    } else {
      feedback = MzOptionFeedback.none;
    }

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.sm),
      child: MzChoiceOptionTile(
        text: option,
        isSelected: isSelected,
        leadingStyle: MzOptionLeadingStyle.radio,
        feedback: feedback,
        onTap: state.isSubmitted ? null : () => notifier.selectOption(option),
      ),
    );
  }

  Widget _buildFeedbackCard(
    BuildContext context,
    MicroDrillsState state,
    MicroDrillItemSpec item, {
    required bool isFa,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);
    final isCorrect = state.isCorrect;

    return Container(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
      decoration: BoxDecoration(
        color: isCorrect ? colors.mintBg : colors.dangerBg,
        borderRadius: shapes.controlRadius,
        border: Border.all(
          color: isCorrect ? colors.success : colors.error,
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          AppIcon(
            isCorrect ? LucideGlyph.checkCircle2 : LucideGlyph.x,
            color: isCorrect ? colors.success : colors.error,
            size: 22,
          ),
          const SizedBox(width: SpacingTokens.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  isCorrect
                      ? (isFa ? 'آفرین! پاسخ درست است.' : 'Well done! Correct.')
                      : (isFa ? 'پاسخ نادرست.' : 'Incorrect variant.'),
                  style: typography.secondary.copyWith(
                    color: isCorrect ? colors.success : colors.error,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: SpacingTokens.xs),
                Text(
                  item.explanation,
                  textDirection: TextDirection.ltr,
                  style: typography.body.copyWith(color: colors.textPrimary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomAction(
    BuildContext context,
    MicroDrillsState state,
    MicroDrillSpec spec,
    MicroDrillsNotifier notifier, {
    required bool isFa,
  }) {
    if (!state.isSubmitted) {
      return PrimaryButton(
        label: isFa ? 'بررسی پاسخ' : 'Check Answer',
        onPressed: state.selectedOption == null ? null : notifier.submitAnswer,
      );
    }

    final isLast = state.currentIndex + 1 >= spec.items.length;
    return PrimaryButton(
      label: isLast
          ? (isFa ? 'پایان تمرین' : 'Complete Workout')
          : (isFa ? 'تمرین بعدی' : 'Next Exercise'),
      trailingGlyph: isFa ? LucideGlyph.arrowLeft : LucideGlyph.arrowRight,
      onPressed: notifier.nextItem,
    );
  }

  Widget _buildCompletionView(
    BuildContext context,
    MicroDrillsState state,
    MicroDrillSpec spec, {
    required bool isFa,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final total = spec.items.isEmpty ? 1 : spec.items.length;
    final percentage = ((state.score / total) * 100).round();
    final minsLabel = (spec.durationSeconds / 60).ceil();
    final minsDisplay = isFa
        ? EdgeNumerals.toPersianDigits(minsLabel)
        : '$minsLabel';
    final scoreDisplay = isFa
        ? EdgeNumerals.toPersianDigits(state.score)
        : '${state.score}';
    final totalDisplay = isFa
        ? EdgeNumerals.toPersianDigits(spec.items.length)
        : '${spec.items.length}';
    final pctDisplay = isFa
        ? EdgeNumerals.toPersianDigits(percentage)
        : '$percentage';
    final categoryLabel = EditionCopy.localizeMicroDrillCategory(
      spec.weaknessCode,
      isIran: isFa,
    );

    return Padding(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Center(
            child: ScoreMeter(
              score: state.effectiveExamTrack.scoreFromRatio(
                state.score / total,
              ),
              minScore: state.effectiveExamTrack.minScore,
              maxScore: state.effectiveExamTrack.maxScore,
              targetScore: state.effectiveExamTrack.targetScoreDefault,
              label: isFa
                  ? 'برآورد اثر تمرین (${EditionCopy.unitLabelFor(state.effectiveExamTrack, isIran: true)})'
                  : 'Drill ${state.effectiveExamTrack.unitLabel} Impact',
            ),
          ),
          const SizedBox(height: SpacingTokens.lg),
          Text(
            isFa
                ? 'تمرین $minsDisplay دقیقه‌ای کامل شد!'
                : '$minsLabel-Minute Workout Complete!',
            textAlign: TextAlign.center,
            style: typography.sectionHeading.copyWith(
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            isFa
                ? '$scoreDisplay از $totalDisplay پاسخ درست ($pctDisplay٪) · $categoryLabel'
                : '${state.score} of ${spec.items.length} correct ($percentage%) · $categoryLabel',
            textAlign: TextAlign.center,
            style: typography.body.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.xl),
          MzCard(
            child: Row(
              children: <Widget>[
                AppIcon(LucideGlyph.flame, color: colors.warning, size: 28),
                const SizedBox(width: SpacingTokens.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        isFa
                            ? 'فعالیت مطالعه ثبت شد'
                            : 'Study Activity Recorded',
                        style: typography.cardTitle.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                      Text(
                        isFa
                            ? 'تمرین تکمیل‌شده شما در گزارش پیشرفت امروز ثبت شد.'
                            : "Your completed drill has been logged to today's study progress.",
                        style: typography.caption.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: SpacingTokens.xxl),
          PrimaryButton(
            label: isFa ? 'بازگشت به بخش تمرین' : 'Back to Practice Hub',
            onPressed: () => context.go(AppRoutes.practice),
          ),
        ],
      ),
    );
  }
}

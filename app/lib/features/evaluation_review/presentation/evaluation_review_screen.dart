import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/localization/edition_copy.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/evaluation_models.dart';
import 'package:mockza/core/models/speaking_evaluation.dart';
import 'package:mockza/features/evaluation_review/presentation/evaluation_review_notifier.dart';
import 'package:mockza/features/evaluation_review/presentation/evaluation_review_providers.dart';
import 'package:mockza/features/evaluation_review/presentation/widgets/listening_evidence_sheet.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/compare_attempts.dart';
import 'package:mockza/theme/components/empty_state.dart';
import 'package:mockza/theme/components/inline_listen_button.dart';
import 'package:mockza/theme/components/mz_bottom_sheet.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_form_field.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/mz_toast.dart';
import 'package:mockza/theme/components/plan_impact_card.dart';
import 'package:mockza/theme/components/score_meter.dart';
import 'package:mockza/theme/components/section_header.dart';
import 'package:mockza/theme/components/speech_practice_sheet.dart';
import 'package:mockza/theme/components/status_banner.dart';
import 'package:mockza/theme/primitives.dart';
import 'package:share_plus/share_plus.dart';

/// Displays complete AI rubric evaluation or objective score review for an attempt.
class EvaluationReviewScreen extends ConsumerStatefulWidget {
  /// Creates an [EvaluationReviewScreen].
  const new({this.attemptId = '', super.key});

  /// Identifier of the attempt to inspect and/or poll.
  final String attemptId;

  @override
  ConsumerState<EvaluationReviewScreen> createState() =>
      _EvaluationReviewScreenState();
}

class _EvaluationReviewScreenState
    extends ConsumerState<EvaluationReviewScreen> {
  @override
  void initState() {
    super.initState();
    unawaited(
      Future.microtask(
        () => ref
            .read(evaluationReviewNotifierProvider.notifier)
            .loadAttempt(widget.attemptId),
      ),
    );
  }

  @override
  void didUpdateWidget(covariant EvaluationReviewScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.attemptId != widget.attemptId) {
      unawaited(
        Future.microtask(
          () => ref
              .read(evaluationReviewNotifierProvider.notifier)
              .loadAttempt(widget.attemptId),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(evaluationReviewNotifierProvider);
    final notifier = ref.read(evaluationReviewNotifierProvider.notifier);
    final isIran =
        ref.watch(editionConfigProvider).edition == AppEdition.iran ||
        Localizations.localeOf(context).languageCode == 'fa';
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzScaffold(
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        leading: MzIconButton(
          glyph: LucideGlyph.chevronLeft,
          semanticLabel: isIran ? 'بازگشت' : 'Back',
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go(AppRoutes.home);
            }
          },
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              isIran ? 'تحلیل و کارنامه' : 'Evaluation Review',
              style: typography.cardTitle.copyWith(fontWeight: FontWeight.w700),
            ),
            Text(
              state.packTitle,
              style: typography.caption.copyWith(color: colors.textSecondary),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        actions: <Widget>[
          if (!state.notFound && !state.isLoading) ...<Widget>[
            MzIconButton(
              glyph: LucideGlyph.alertTriangle,
              semanticLabel: isIran
                  ? 'گزارش خطای سؤال یا نمره'
                  : 'Flag question or score issue',
              onPressed: () =>
                  _openFlagSheet(context, notifier, state, isIran: isIran),
            ),
            MzIconButton(
              glyph: LucideGlyph.cloudUpload,
              semanticLabel: isIran
                  ? 'اشتراک‌گذاری خلاصه کارنامه'
                  : 'Share evaluation summary',
              onPressed: () => _shareResults(context, notifier, isIran: isIran),
            ),
          ],
        ],
      ),
      body: _buildBody(context, state, notifier, isIran: isIran),
    );
  }

  Widget _buildBody(
    BuildContext context,
    EvaluationReviewState state,
    EvaluationReviewNotifier notifier, {
    required bool isIran,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    if (state.isLoading) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            CircularProgressIndicator(color: colors.primary),
            const SizedBox(height: SpacingTokens.md),
            Text(
              isIran ? 'در حال بارگذاری کارنامه...' : 'Loading evaluation...',
              style: typography.body.copyWith(color: colors.textSecondary),
            ),
          ],
        ),
      );
    }

    if (state.notFound) {
      return EmptyState(
        glyph: LucideGlyph.alertCircle,
        title: isIran ? 'آزمون یافت نشد' : 'Attempt not found',
        description:
            state.errorMessage ??
            (isIran
                ? 'ممکن است اطلاعات این آزمون پاک شده باشد.'
                : 'This attempt may have been cleared.'),
        actionLabel: isIran ? 'بازگشت به خانه' : 'Back to Home',
        onTapAction: () => context.go(AppRoutes.home),
      );
    }

    final isObjective =
        state.skill == SkillKind.reading || state.skill == SkillKind.listening;
    final thirdTabLabel = isObjective
        ? (isIran ? 'پاسخ‌نامه' : 'Answer Key')
        : (state.skill == SkillKind.speaking
              ? (isIran ? 'متن پیاده‌شده' : 'Transcript')
              : (isIran ? 'بازنویسی' : 'Rewrite'));

    final overviewLabel = isIran ? 'نمای کلی' : 'Overview';
    final secondTabLabel = isObjective
        ? (isIran ? 'پرسش‌ها' : 'Questions')
        : (isIran ? 'معیارها' : 'Rubric');
    final compareLabel = isIran ? 'مقایسه' : 'Compare';

    final tabs = <String>[
      overviewLabel,
      secondTabLabel,
      thirdTabLabel,
      compareLabel,
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsetsDirectional.only(
            bottom: SpacingTokens.md,
          ),
          child: Row(
            children: <Widget>[
              for (var i = 0; i < tabs.length; i++) ...<Widget>[
                MzChip(
                  label: tabs[i],
                  isSelected: state.selectedTabIndex == i,
                  onTap: () => notifier.selectTab(i),
                ),
                if (i < tabs.length - 1)
                  const SizedBox(width: SpacingTokens.sm),
              ],
            ],
          ),
        ),
        Expanded(
          child: switch (state.selectedTabIndex) {
            0 => _OverviewTab(
              state: state,
              notifier: notifier,
              isIran: isIran,
            ),
            1 => _RubricOrQuestionsTab(
              state: state,
              notifier: notifier,
              isIran: isIran,
              onFlagQuestion: (qId) => _openFlagSheet(
                context,
                notifier,
                state,
                isIran: isIran,
                questionId: qId,
              ),
            ),
            2 => _RewriteTranscriptKeyTab(
              state: state,
              notifier: notifier,
              isIran: isIran,
            ),
            3 => _CompareTab(state: state, isIran: isIran),
            _ => _OverviewTab(
              state: state,
              notifier: notifier,
              isIran: isIran,
            ),
          },
        ),
      ],
    );
  }

  Future<void> _shareResults(
    BuildContext context,
    EvaluationReviewNotifier notifier, {
    required bool isIran,
  }) async {
    final summary = notifier.buildShareSummary();
    try {
      await SharePlus.instance.share(
        ShareParams(
          text: summary,
          subject: isIran ? 'کارنامه ارزیابی سنجیا' : 'Mockza IELTS Evaluation',
        ),
      );
    } on Object {
      if (context.mounted) {
        showMzToast(
          context,
          message: isIran
              ? 'اشتراک‌گذاری در این مرورگر در دسترس نیست.'
              : 'Share sheet unavailable on this browser.',
          glyph: LucideGlyph.info,
        );
      }
    }
  }

  Future<void> _openFlagSheet(
    BuildContext context,
    EvaluationReviewNotifier notifier,
    EvaluationReviewState state, {
    required bool isIran,
    String? questionId,
  }) async {
    final noteController = TextEditingController();
    final reasons = isIran
        ? <String>[
            'نمره‌دهی دقیق به نظر نمی‌رسد',
            'عدم تطابق متن یا پیاده‌سازی صوت',
            'ایراد در صورت سؤال یا پاسخ‌نامه',
            'سایر موارد',
          ]
        : <String>[
            'Scoring feels inaccurate',
            'Transcript or text mismatch',
            'Question prompt / answer key issue',
            'Other feedback',
          ];
    var selectedReason = reasons.first;

    try {
      await showMzBottomSheet<void>(
        context: context,
        title: isIran ? 'گزارش خطای کیفیت' : 'Flag Quality Issue',
        child: StatefulBuilder(
          builder: (sheetCtx, setSheetState) {
            final typography = AppTypography.of(sheetCtx);
            final colors = AppColors.of(sheetCtx);
            return SingleChildScrollView(
              padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text(
                    isIran
                        ? 'موردی را که با آن روبه‌رو شدید انتخاب کنید تا تیم علمی ما آن را بررسی کند:'
                        : 'Select the issue you encountered so our academic team can inspect this item:',
                    style: typography.secondary.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.md),
                  Wrap(
                    spacing: SpacingTokens.sm,
                    runSpacing: SpacingTokens.sm,
                    children: reasons
                        .map(
                          (r) => MzChip(
                            label: r,
                            isSelected: selectedReason == r,
                            onTap: () =>
                                setSheetState(() => selectedReason = r),
                          ),
                        )
                        .toList(growable: false),
                  ),
                  const SizedBox(height: SpacingTokens.md),
                  MzFormField(
                    label: isIran ? 'توضیحات اختیاری' : 'Optional details',
                    hintText: isIran
                        ? 'توضیح دهید چه بخشی نادرست بود...'
                        : 'Describe what looked off...',
                    controller: noteController,
                    maxLines: 3,
                  ),
                  const SizedBox(height: SpacingTokens.lg),
                  PrimaryButton(
                    label: isIran ? 'ارسال گزارش' : 'Submit Flag',
                    glyph: LucideGlyph.alertTriangle,
                    onPressed: () async {
                      final targetQ = questionId ?? state.packId;
                      final sentOnline = await notifier.flagQuestion(
                        questionId: targetQ,
                        reason: selectedReason,
                        note: noteController.text,
                      );
                      if (sheetCtx.mounted) {
                        Navigator.of(sheetCtx).pop();
                      }
                      if (context.mounted) {
                        showMzToast(
                          context,
                          message: sentOnline
                              ? (isIran
                                    ? 'گزارش شما ثبت شد. سپاسگزاریم!'
                                    : 'Issue reported. Thank you!')
                              : (isIran
                                    ? 'آفلاین ذخیره شد — به‌محض اتصال ارسال می‌شود.'
                                    : 'Saved offline — flag will sync automatically.'),
                        );
                      }
                    },
                  ),
                ],
              ),
            );
          },
        ),
      );
    } finally {
      noteController.dispose();
    }
  }
}

class _OverviewTab extends StatelessWidget {
  const new({
    required this.state,
    required this.notifier,
    required this.isIran,
  });

  final EvaluationReviewState state;
  final EvaluationReviewNotifier notifier;
  final bool isIran;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    final isAiSkill =
        state.skill == SkillKind.speaking || state.skill == SkillKind.writing;
    final nextStep =
        state.writingResult?.actionableNextStep ??
        state.speakingResult?.actionableNextStep ??
        '';
    final drill =
        state.writingResult?.recommendedDrill ??
        state.speakingResult?.recommendedDrill;
    final criteria =
        state.writingResult?.criteria ??
        state.speakingResult?.criteria ??
        const <CriterionScore>[];
    final skillLabel = EditionCopy.skillName(state.skill.name, isIran: isIran);

    return ListView(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.xxl),
      children: <Widget>[
        if (state.status == AttemptStatus.failedRetryable) ...<Widget>[
          StatusBanner(
            variant: StatusBannerVariant.error,
            message: state.quotaRefunded
                ? (isIran
                      ? '${state.errorMessage ?? 'ارزیابی ناموفق بود.'} سهمیه روزانه بازگردانده شد.'
                      : '${state.errorMessage ?? 'Evaluation failed.'} Daily quota credit refunded.')
                : (state.errorMessage ??
                      (isIran
                          ? 'ارزیابی ناموفق بود. پاسخ شما به‌صورت امن روی دستگاه ذخیره شده است.'
                          : 'Evaluation failed. Your response is saved safely on this device.')),
          ),
          const SizedBox(height: SpacingTokens.md),
          PrimaryButton(
            label: state.isRetrying
                ? (isIran ? 'در حال تلاش مجدد...' : 'Retrying...')
                : (isIran ? 'تلاش مجدد ارزیابی هوشمند' : 'Retry AI Evaluation'),
            isLoading: state.isRetrying,
            onPressed: state.isRetrying ? null : notifier.retryEvaluation,
          ),
          const SizedBox(height: SpacingTokens.lg),
        ] else if (state.isPendingRemote) ...<Widget>[
          StatusBanner(
            variant: StatusBannerVariant.uploading,
            message: state.pollStageLabel != null
                ? EditionCopy.localizeWorkerStage(
                    state.pollStageLabel,
                    isIran: isIran,
                  )
                : (isIran
                      ? 'ارزیاب هوشمند در حال بررسی پاسخ شماست...'
                      : 'AI examiner is grading your submission...'),
            actionLabel: isIran ? 'بررسی اکنون' : 'Check Now',
            onTapAction: state.remoteJobId != null
                ? () => unawaited(notifier.pollNow(state.remoteJobId!))
                : () => unawaited(notifier.retryEvaluation()),
          ),
          const SizedBox(height: SpacingTokens.md),
        ],
        MzCard(
          variant: MzCardVariant.hero,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                spacing: SpacingTokens.sm,
                runSpacing: SpacingTokens.xs,
                children: <Widget>[
                  MzChip(
                    label: skillLabel,
                    variant: MzChipVariant.target,
                  ),
                  MzChip(
                    label: isAiSkill
                        ? (state.usedStudyMode
                              ? (isIran
                                    ? 'تخمین حالت مطالعه هوشمند'
                                    : 'AI Study Mode Estimate')
                              : (isIran
                                    ? 'تخمین هوش مصنوعی (${EditionCopy.scaleLabelFor(state.examTrack, isIran: true)})'
                                    : 'AI ${state.examTrack.scaleLabel}'))
                        : (!state.isCalibratedFullPack || state.usedStudyMode)
                        ? (isIran
                              ? 'تخمین تمرینی (${EdgeNumerals.toPersianDigits(state.objectiveTotalCount)} پرسش)'
                              : 'Practice Estimate (${state.objectiveTotalCount} items)')
                        : (isIran
                              ? 'پاسخ‌نامه (${EdgeNumerals.toPersianDigits(state.objectiveTotalCount)} پرسش)'
                              : 'Answer Key (${state.objectiveTotalCount} items)'),
                    glyph: isAiSkill
                        ? LucideGlyph.sparkles
                        : LucideGlyph.checkCircle2,
                  ),
                ],
              ),
              const SizedBox(height: SpacingTokens.lg),
              if (state.overallBand != null) ...<Widget>[
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: <Widget>[
                    Text(
                      EditionCopy.formatScoreFor(
                        state.examTrack,
                        state.overallBand!,
                        isIran: isIran,
                      ),
                      style: typography.heroScore.copyWith(
                        color: colors.textPrimary,
                      ),
                    ),
                    const SizedBox(width: SpacingTokens.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            (state.isCalibratedFullPack && !state.usedStudyMode)
                                ? (isIran
                                      ? '${EditionCopy.scaleLabelFor(state.examTrack, isIran: true)} ${state.examTrack.shortName}'
                                      : 'Estimated ${state.examTrack.shortName} ${state.examTrack.unitLabel}')
                                : (isIran
                                      ? 'تخمین غیرکالیبره تمرینی'
                                      : 'Uncalibrated Practice Estimate'),
                            style: typography.cardTitle.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            state.objectiveTotalCount > 0
                                ? (isIran
                                      ? '${EdgeNumerals.toPersianDigits(state.objectiveCorrectCount)} از ${EdgeNumerals.toPersianDigits(state.objectiveTotalCount)} صحیح · هدف ${EditionCopy.formatScoreFor(state.examTrack, state.targetBandScore, isIran: true)}'
                                      : '${state.objectiveCorrectCount}/${state.objectiveTotalCount} correct · Target ${state.examTrack.formatScore(state.targetBandScore)}')
                                : (isIran
                                      ? 'هدف ${EditionCopy.formatScoreFor(state.examTrack, state.targetBandScore, isIran: true)}'
                                      : 'Target ${state.examTrack.formatScore(state.targetBandScore)}'),
                            style: typography.secondary.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                          if (state.examTrack ==
                              ExamTrack.toeflIbt) ...<Widget>[
                            const SizedBox(height: SpacingTokens.xs),
                            MzChip(
                              label: isIran
                                  ? '≈ ${EdgeNumerals.toPersianDigits(ExamSpec.estimateToeflLegacy120(state.overallBand!))} از ۱۲۰ (مقیاس پیشین)'
                                  : '≈ ${ExamSpec.estimateToeflLegacy120(state.overallBand!)} / 120 Legacy Scale',
                            ),
                          ],
                          if (!state.isCalibratedFullPack ||
                              state.usedStudyMode) ...<Widget>[
                            const SizedBox(height: SpacingTokens.xs),
                            Text(
                              state.usedStudyMode
                                  ? (isIran
                                        ? 'آزمون‌های حالت مطالعه در میانگین کالیبره داشبورد لحاظ نمی‌شوند.'
                                        : 'Study Mode attempts are excluded from calibrated dashboard estimates.')
                                  : (isIran
                                        ? 'تخمین بر اساس تمرین ${EdgeNumerals.toPersianDigits(state.objectiveTotalCount)} پرسشی است و در میانگین آزمون کامل لحاظ نمی‌شود.'
                                        : 'Scaled from a ${state.objectiveTotalCount}-item practice passage; excluded from calibrated full-test averages.'),
                              style: typography.caption.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: SpacingTokens.lg),
                ScoreMeter(
                  bandScore: state.overallBand,
                  targetScore: state.targetBandScore,
                  minScore: state.examTrack.minScore,
                  maxScore: state.examTrack.maxScore,
                  label: isIran
                      ? 'پیشرفت ${EditionCopy.unitLabelFor(state.examTrack, isIran: true)}'
                      : '${state.examTrack.unitLabel} Progress',
                ),
              ] else ...<Widget>[
                Text(
                  isIran ? 'در حال نمره‌دهی...' : 'Scoring in Progress',
                  style: typography.sectionHeading.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: SpacingTokens.xs),
                Text(
                  isIran
                      ? 'پاسخ $skillLabel شما با موفقیت ذخیره شد. نتیجه به محض پایان تصحیح نمایش داده می‌شود.'
                      : 'Your ${state.skill.name} response is safely stored. Results appear automatically as soon as grading completes.',
                  style: typography.body.copyWith(color: colors.textSecondary),
                ),
                if (state.isPendingRemote) ...<Widget>[
                  const SizedBox(height: SpacingTokens.md),
                  LinearProgressIndicator(color: colors.primary),
                ],
              ],
            ],
          ),
        ),
        if (!isAiSkill &&
            state.objectiveTotalCount >
                state.objectiveCorrectCount) ...<Widget>[
          PrimaryButton(
            label: AppLocalizations.of(context).objectiveReviewMissed,
            onPressed: () => notifier.selectTab(1),
          ),
          SecondaryButton(
            label: AppLocalizations.of(context).objectiveNextDrill,
            onPressed: () => context.push(
              state.examTrack.isIelts
                  ? AppRoutes.buildMicroDrill(
                      state.skill == SkillKind.listening
                          ? 'ielts-micro-drill-03'
                          : 'ielts-micro-drill-04',
                    )
                  : AppRoutes.practice,
            ),
          ),
        ],
        if (nextStep.isNotEmpty) ...<Widget>[
          SectionHeader(
            title: isIran ? 'اقدام اولویت‌دار بعدی' : 'Priority Next Step',
          ),
          MzCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                AppIcon(
                  LucideGlyph.info,
                  size: 20,
                  color: colors.primary,
                ),
                const SizedBox(width: SpacingTokens.md),
                Expanded(
                  child: Text(
                    nextStep,
                    style: typography.body,
                  ),
                ),
              ],
            ),
          ),
        ],
        if (criteria.isNotEmpty) ...<Widget>[
          SectionHeader(
            title: isIran ? 'خلاصه معیارها' : 'Criterion Snapshot',
          ),
          MzCard(
            child: Column(
              children: criteria
                  .map(
                    (c) => Padding(
                      padding: const EdgeInsetsDirectional.only(
                        bottom: SpacingTokens.sm,
                      ),
                      child: Row(
                        children: <Widget>[
                          SizedBox(
                            width: 48,
                            child: Text(
                              c.criterionCode,
                              style: typography.secondary.copyWith(
                                fontWeight: FontWeight.w700,
                                color: colors.primary,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Text(
                              c.criterionLabel,
                              style: typography.body,
                            ),
                          ),
                          Text(
                            EditionCopy.formatScoreFor(
                              state.examTrack,
                              c.band,
                              isIran: isIran,
                            ),
                            style: typography.cardTitle.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                  .toList(growable: false),
            ),
          ),
        ],
        const SizedBox(height: SpacingTokens.md),
        PlanImpactCard(
          skill: state.skill.name,
          scoreBand: state.overallBand,
        ),
        if (drill != null) ...<Widget>[
          SectionHeader(
            title: isIran ? 'ریزتمرین پیشنهادی' : 'Recommended Micro-Drill',
          ),
          MzCard(
            variant: MzCardVariant.action,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  drill.title,
                  style: typography.cardTitle.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: SpacingTokens.xs),
                Text(
                  isIran
                      ? '${EdgeNumerals.toPersianDigits(drill.durationMinutes)} دقیقه · کد تمرکز ${drill.weaknessCode}'
                      : '${drill.durationMinutes} min · Focus code ${drill.weaknessCode}',
                  style: typography.secondary.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.md),
                PrimaryButton(
                  label: isIran ? 'شروع تمرین هدفمند' : 'Start Targeted Drill',
                  trailingGlyph: isIran
                      ? LucideGlyph.arrowLeft
                      : LucideGlyph.arrowRight,
                  onPressed: () => context.push(
                    AppRoutes.buildMicroDrill(drill.drillId),
                  ),
                ),
              ],
            ),
          ),
        ],
        if (isAiSkill) ...<Widget>[
          const SizedBox(height: SpacingTokens.lg),
          Builder(
            builder: (context) {
              CriterionScore? weakest;
              for (final c in criteria) {
                if (weakest == null || c.band < weakest.band) {
                  weakest = c;
                }
              }
              return MzCard(
                key: const ValueKey<String>('eval_coach_bridge_card'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        AppIcon(
                          LucideGlyph.sparkles,
                          size: 18,
                          color: colors.primary,
                        ),
                        const SizedBox(width: SpacingTokens.xs),
                        Expanded(
                          child: Text(
                            isIran
                                ? 'تبدیل این بازخورد به عادت روزانه'
                                : 'Turn This Feedback Into Daily Habits',
                            style: typography.cardTitle.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      weakest != null
                          ? (isIran
                                ? 'ضعیف‌ترین بخش: ${weakest.criterionLabel} (${EditionCopy.formatScoreFor(state.examTrack, weakest.band, isIran: true)}). در ۱۰ دقیقه ساختارهای قوی‌تر را تثبیت کنید.'
                                : 'Lowest area: ${weakest.criterionLabel} (${state.examTrack.formatScore(weakest.band)}). Lock in stronger phrasing in 10 minutes.')
                          : (isIran
                                ? 'عبارات ضعیف‌تر این آزمون را با مربی هوشمند تقویت کنید.'
                                : 'Reinforce weaker expressions from this attempt with Smart Coach.'),
                      style: typography.secondary.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.md),
                    PrimaryButton(
                      key: const ValueKey<String>('eval_bridge_coach_btn'),
                      label: isIran
                          ? 'رفع ضعف در مأموریت ۱۰ دقیقه‌ای امروز'
                          : "Fix in Today's 10-Min Coach",
                      glyph: LucideGlyph.flame,
                      onPressed: () =>
                          context.push(AppRoutes.buildDailyMission()),
                    ),
                    const SizedBox(height: SpacingTokens.sm),
                    SecondaryButton(
                      key: const ValueKey<String>('eval_bridge_shifter_btn'),
                      label: isIran
                          ? 'ارتقای جملات ضعیف'
                          : 'Upgrade Weak Sentences',
                      glyph: LucideGlyph.slidersHorizontal,
                      onPressed: () => context.push(AppRoutes.registerShifter),
                    ),
                  ],
                ),
              );
            },
          ),
        ],
        const SizedBox(height: SpacingTokens.lg),
        SecondaryButton(
          label: isIran ? 'تمرین مجدد' : 'Practice Again',
          glyph: LucideGlyph.rotateCcw,
          onPressed: () => context.go(AppRoutes.practice),
        ),
      ],
    );
  }
}

class _RubricOrQuestionsTab extends StatefulWidget {
  const new({
    required this.state,
    required this.notifier,
    required this.isIran,
    required this.onFlagQuestion,
  });

  final EvaluationReviewState state;
  final EvaluationReviewNotifier notifier;
  final bool isIran;
  final void Function(String questionId) onFlagQuestion;

  @override
  State<_RubricOrQuestionsTab> createState() => _RubricOrQuestionsTabState();
}

class _RubricOrQuestionsTabState extends State<_RubricOrQuestionsTab> {
  String _filter = 'all';

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);
    final state = widget.state;
    final isIran = widget.isIran;
    final l10n = AppLocalizations.of(context);

    if (state.skill == SkillKind.reading ||
        state.skill == SkillKind.listening) {
      final firstMiss = state.objectiveQuestions
          .where((q) => !q.isCorrect)
          .firstOrNull;
      final ordered = [
        ?firstMiss,
        ...state.objectiveQuestions.where((q) => q != firstMiss),
      ];
      final filtered = ordered
          .where((q) {
            if (_filter == 'missed') return !q.isCorrect;
            if (_filter == 'correct') return q.isCorrect;
            return true;
          })
          .toList(growable: false);

      final missedCount =
          state.objectiveTotalCount - state.objectiveCorrectCount;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Wrap(
            spacing: SpacingTokens.sm,
            runSpacing: SpacingTokens.xs,
            children: <Widget>[
              MzChip(
                label: isIran
                    ? 'همه (${EdgeNumerals.toPersianDigits(state.objectiveQuestions.length)})'
                    : 'All (${state.objectiveQuestions.length})',
                isSelected: _filter == 'all',
                onTap: () => setState(() => _filter = 'all'),
              ),
              MzChip(
                label: isIran
                    ? 'غلط / نزده (${EdgeNumerals.toPersianDigits(missedCount)})'
                    : 'Missed ($missedCount)',
                isSelected: _filter == 'missed',
                onTap: () => setState(() => _filter = 'missed'),
              ),
              MzChip(
                label: isIran
                    ? 'صحیح (${EdgeNumerals.toPersianDigits(state.objectiveCorrectCount)})'
                    : 'Correct (${state.objectiveCorrectCount})',
                isSelected: _filter == 'correct',
                onTap: () => setState(() => _filter = 'correct'),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          Expanded(
            child: filtered.isEmpty
                ? EmptyState(
                    glyph: LucideGlyph.checkCircle2,
                    title: isIran
                        ? 'موردی در این فیلتر نیست'
                        : 'Nothing in this filter',
                    description: isIran
                        ? 'برای مشاهده بقیه پرسش‌ها، فیلتر بالا را تغییر دهید.'
                        : 'Switch filters above to view other questions.',
                  )
                : ListView.separated(
                    padding: const EdgeInsetsDirectional.only(
                      bottom: SpacingTokens.xxl,
                    ),
                    itemCount: filtered.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: SpacingTokens.md),
                    itemBuilder: (ctx, i) {
                      final q = filtered[i];
                      final cardId =
                          'err-${state.attemptId}-${q.questionNumber}';
                      final isSaved = state.savedCardIds.contains(cardId);
                      return MzCard(
                        borderColor: q.isCorrect
                            ? colors.success.withValues(alpha: 0.35)
                            : colors.error.withValues(alpha: 0.45),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Row(
                              children: <Widget>[
                                Expanded(
                                  child: Text(
                                    isIran
                                        ? 'پرسش ${EdgeNumerals.toPersianDigits(q.questionNumber)}'
                                        : 'Question ${q.questionNumber}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: typography.cardTitle.copyWith(
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: SpacingTokens.sm),
                                MzChip(
                                  label: q.isCorrect
                                      ? (isIran ? 'صحیح' : 'Correct')
                                      : (isIran ? 'نیاز به مرور' : 'Missed'),
                                  glyph: q.isCorrect
                                      ? LucideGlyph.checkCircle2
                                      : LucideGlyph.alertCircle,
                                  variant: q.isCorrect
                                      ? MzChipVariant.positive
                                      : MzChipVariant.warning,
                                ),
                              ],
                            ),
                            if (q.prompt.isNotEmpty) ...<Widget>[
                              const SizedBox(height: SpacingTokens.sm),
                              Text(
                                q.prompt,
                                textDirection: TextDirection.ltr,
                                style: typography.body,
                              ),
                            ],
                            const SizedBox(height: SpacingTokens.sm),
                            Text(
                              isIran
                                  ? 'پاسخ شما: ${q.userAnswer.isEmpty ? "(خالی)" : q.userAnswer}'
                                  : 'Your answer: ${q.userAnswer.isEmpty ? "(blank)" : q.userAnswer}',
                              style: typography.secondary.copyWith(
                                color: q.isCorrect
                                    ? colors.success
                                    : colors.error,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (!q.isCorrect &&
                                q.acceptedAnswers.isNotEmpty) ...<Widget>[
                              const SizedBox(height: SpacingTokens.xs),
                              Text(
                                isIran
                                    ? 'پاسخ صحیح: ${q.acceptedAnswers.join(' / ')}'
                                    : 'Accepted: ${q.acceptedAnswers.join(' / ')}',
                                style: typography.secondary.copyWith(
                                  color: colors.success,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                            if (q.distractorExplanation.isNotEmpty) ...<Widget>[
                              const SizedBox(height: SpacingTokens.sm),
                              Container(
                                padding: const EdgeInsetsDirectional.all(
                                  SpacingTokens.sm,
                                ),
                                decoration: BoxDecoration(
                                  color: colors.surfaceAlt,
                                  borderRadius: shapes.controlRadius,
                                ),
                                child: Text(
                                  q.distractorExplanation,
                                  textDirection: TextDirection.ltr,
                                  style: typography.secondary.copyWith(
                                    color: colors.textSecondary,
                                  ),
                                ),
                              ),
                            ],
                            if (q.evidenceQuote != null &&
                                q.evidenceQuote!.isNotEmpty) ...<Widget>[
                              const SizedBox(height: SpacingTokens.sm),
                              if (q.paragraphIndex != null) ...<Widget>[
                                Text(
                                  isIran
                                      ? 'پاراگراف ${EdgeNumerals.toPersianDigits(q.paragraphIndex! + 1)}:'
                                      : 'Paragraph ${q.paragraphIndex! + 1}:',
                                  style: typography.caption.copyWith(
                                    color: colors.primary,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                const SizedBox(height: 2),
                              ],
                              Text(
                                '"${q.evidenceQuote}"',
                                textDirection: TextDirection.ltr,
                                style: typography.caption.copyWith(
                                  color: colors.primary,
                                  fontStyle: FontStyle.italic,
                                ),
                              ),
                              const SizedBox(height: SpacingTokens.xs),
                              Wrap(
                                spacing: SpacingTokens.xs,
                                runSpacing: SpacingTokens.xs,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: <Widget>[
                                  InlineListenButton(
                                    text: q.evidenceQuote!,
                                    sourceContext:
                                        state.skill == SkillKind.listening
                                        ? 'listening_feedback'
                                        : 'reading_feedback',
                                  ),
                                  ActionChip(
                                    avatar: AppIcon(
                                      LucideGlyph.mic,
                                      size: 14,
                                      color: colors.primary,
                                    ),
                                    label: Text(l10n.practiceSpeechCta),
                                    onPressed: () => unawaited(
                                      SpeechPracticeSheet.show(
                                        ctx,
                                        targetText: q.evidenceQuote!,
                                        sourceRefType: 'evaluation_quote',
                                        sourceRefId: cardId,
                                        sourceContext:
                                            state.skill == SkillKind.listening
                                            ? 'listening_feedback'
                                            : 'reading_feedback',
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                            if (state.skill == SkillKind.listening &&
                                state.contentVersion != null &&
                                q.sectionId != null &&
                                q.cueTimestampMs != null &&
                                q.cueTimestampMs! >= 0)
                              TextButton.icon(
                                icon: const AppIcon(LucideGlyph.play, size: 16),
                                label: Text(l10n.objectiveAudioReplay),
                                onPressed: () => unawaited(
                                  showMzBottomSheet<void>(
                                    context: ctx,
                                    title: l10n.objectiveAudioReplay,
                                    child: ListeningEvidenceSheet(
                                      packId: state.packId,
                                      contentVersion: state.contentVersion!,
                                      sectionId: q.sectionId!,
                                      cueTimestampMs: q.cueTimestampMs!,
                                    ),
                                  ),
                                ),
                              ),
                            const SizedBox(height: SpacingTokens.sm),
                            Wrap(
                              alignment: WrapAlignment.end,
                              children: <Widget>[
                                if (q.acceptedAnswers.isNotEmpty)
                                  TextButton.icon(
                                    onPressed: isSaved
                                        ? null
                                        : () => unawaited(
                                            widget.notifier.saveMistakeToDeck(
                                              cardId: cardId,
                                              headword: q.acceptedAnswers.first,
                                              definition:
                                                  q
                                                      .distractorExplanation
                                                      .isNotEmpty
                                                  ? q.distractorExplanation
                                                  : q.prompt,
                                              topicTag: state.skill.name,
                                              contextSentence: q.evidenceQuote,
                                            ),
                                          ),
                                    icon: AppIcon(
                                      isSaved
                                          ? LucideGlyph.checkCircle2
                                          : LucideGlyph.bookmarkPlus,
                                      size: 16,
                                      color: colors.primary,
                                    ),
                                    label: Text(
                                      isSaved
                                          ? (isIran ? 'ذخیره شد' : 'Saved')
                                          : (isIran
                                                ? 'ذخیره در واژگان'
                                                : 'Save to Deck'),
                                      style: typography.caption.copyWith(
                                        color: colors.primary,
                                      ),
                                    ),
                                  ),
                                TextButton.icon(
                                  onPressed: () =>
                                      widget.onFlagQuestion(q.questionId),
                                  icon: AppIcon(
                                    LucideGlyph.alertTriangle,
                                    size: 16,
                                    color: colors.textSecondary,
                                  ),
                                  label: Text(
                                    isIran ? 'گزارش' : 'Flag',
                                    style: typography.caption.copyWith(
                                      color: colors.textSecondary,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      );
    }

    final criteria =
        state.writingResult?.criteria ??
        state.speakingResult?.criteria ??
        const <CriterionScore>[];

    if (criteria.isEmpty) {
      return EmptyState(
        title: isIran ? 'نمرات معیارها در انتظار است' : 'Rubric scores pending',
        description: isIran
            ? 'جزئیات هر معیار بلافاصله پس از پایان ارزیابی نمایش داده می‌شود.'
            : 'Individual criterion breakdowns appear once evaluation completes.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.xxl),
      itemCount: criteria.length,
      separatorBuilder: (_, _) => const SizedBox(height: SpacingTokens.md),
      itemBuilder: (ctx, i) {
        final c = criteria[i];
        return MzCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Expanded(
                    child: Text(
                      '${c.criterionCode} · ${c.criterionLabel}',
                      style: typography.cardTitle.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  MzChip(
                    label: EditionCopy.formatScoreWithUnitFor(
                      state.examTrack,
                      c.band,
                      isIran: isIran,
                    ),
                    variant: MzChipVariant.target,
                  ),
                ],
              ),
              const SizedBox(height: SpacingTokens.sm),
              ScoreMeter(
                bandScore: c.band,
                targetScore: state.targetBandScore,
                minScore: state.examTrack.minScore,
                maxScore: state.examTrack.maxScore,
                showLabels: false,
              ),
              if (c.evidenceExcerpt.isNotEmpty) ...<Widget>[
                const SizedBox(height: SpacingTokens.md),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
                  decoration: BoxDecoration(
                    color: colors.surfaceAlt,
                    borderRadius: shapes.controlRadius,
                  ),
                  child: Text(
                    '"${c.evidenceExcerpt}"',
                    style: typography.secondary.copyWith(
                      fontStyle: FontStyle.italic,
                      color: colors.textPrimary,
                    ),
                  ),
                ),
              ],
              if (c.feedbackNote.isNotEmpty) ...<Widget>[
                const SizedBox(height: SpacingTokens.md),
                Text(c.feedbackNote, style: typography.body),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _RewriteTranscriptKeyTab extends StatelessWidget {
  const new({
    required this.state,
    required this.notifier,
    required this.isIran,
  });

  final EvaluationReviewState state;
  final EvaluationReviewNotifier notifier;
  final bool isIran;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    if (state.skill == SkillKind.writing) {
      final res = state.writingResult;
      if (res == null) {
        return ListView(
          padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.xxl),
          children: <Widget>[
            MzCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    isIran ? 'پاسخ ارسالی شما' : 'Your Submitted Response',
                    style: typography.cardTitle.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  Text(
                    state.submittedEssayText.isNotEmpty
                        ? state.submittedEssayText
                        : (isIran
                              ? 'متن رایتینگ به‌صورت محلی ذخیره شد.'
                              : 'Essay text saved locally.'),
                    style: typography.body,
                  ),
                ],
              ),
            ),
          ],
        );
      }

      return ListView(
        padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.xxl),
        children: <Widget>[
          if (state.submittedEssayText.isNotEmpty) ...<Widget>[
            SectionHeader(
              title: isIran
                  ? 'متن ارسالی (${EdgeNumerals.toPersianDigits(res.wordCount)} واژه)'
                  : 'Submitted Essay (${res.wordCount} words)',
            ),
            MzCard(
              child: SelectableText(
                state.submittedEssayText,
                style: typography.body,
              ),
            ),
          ],
          if (res.inlineEdits.isNotEmpty) ...<Widget>[
            SectionHeader(
              title: isIran
                  ? 'اصلاحات آموزشی درون‌متنی'
                  : 'Inline Coaching Edits',
            ),
            ...res.inlineEdits.map(
              (edit) => Padding(
                padding: const EdgeInsetsDirectional.only(
                  bottom: SpacingTokens.sm,
                ),
                child: MzCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      MzChip(
                        label: edit.criterionCode,
                        variant: MzChipVariant.warning,
                      ),
                      const SizedBox(height: SpacingTokens.sm),
                      Text(
                        isIran
                            ? 'متن اولیه: "${edit.originalText}"'
                            : 'Original: "${edit.originalText}"',
                        style: typography.secondary.copyWith(
                          color: colors.error,
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.xs),
                      Text(
                        isIran
                            ? 'پیشنهاد ارتقا: "${edit.suggestedText}"'
                            : 'Upgrade: "${edit.suggestedText}"',
                        style: typography.secondary.copyWith(
                          color: colors.success,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (edit.rationale.isNotEmpty) ...<Widget>[
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          edit.rationale,
                          style: typography.caption.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
          if ((res.modelRewrite ?? res.upgradedExcerpt).isNotEmpty) ...<Widget>[
            SectionHeader(
              title: _modelRewriteHeading(state.examTrack, isIran: isIran),
            ),
            MzCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  SelectableText(
                    res.modelRewrite ?? res.upgradedExcerpt,
                    style: typography.body,
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  Wrap(
                    spacing: SpacingTokens.xs,
                    runSpacing: SpacingTokens.xs,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: <Widget>[
                      InlineListenButton(
                        text: res.modelRewrite ?? res.upgradedExcerpt,
                        sourceContext: 'evaluation_rewrite',
                      ),
                      ActionChip(
                        avatar: AppIcon(
                          LucideGlyph.mic,
                          size: 14,
                          color: colors.primary,
                        ),
                        label: Text(
                          AppLocalizations.of(context).practiceSpeechCta,
                        ),
                        onPressed: () => unawaited(
                          SpeechPracticeSheet.show(
                            context,
                            targetText: res.modelRewrite ?? res.upgradedExcerpt,
                            sourceRefType: 'evaluation_rewrite',
                            sourceRefId: state.attemptId,
                            sourceContext: 'evaluation_rewrite',
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
          if (res.vocabUpgrades.isNotEmpty) ...<Widget>[
            SectionHeader(
              title: isIran
                  ? 'پیشنهادهای ارتقای واژگان'
                  : 'Vocabulary Upgrades',
            ),
            ..._buildVocabUpgradeCards(
              context,
              res.vocabUpgrades,
              state,
              notifier,
              isIran: isIran,
            ),
          ],
        ],
      );
    }

    if (state.skill == SkillKind.speaking) {
      final res = state.speakingResult;
      if (res == null) {
        return EmptyState(
          glyph: LucideGlyph.headphones,
          title: isIran
              ? 'در حال پیاده‌سازی متن گفتار'
              : 'Transcript in progress',
          description: isIran
              ? 'متن گفتار شما به همراه نکات روانی کلام بلافاصله پس از پایان ارزیابی نمایش داده می‌شود.'
              : 'Your spoken audio will appear transcribed with fluency annotations once AI scoring completes.',
        );
      }

      return ListView(
        padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.xxl),
        children: <Widget>[
          SectionHeader(
            title: isIran
                ? 'متن پیاده‌شده زمان‌بندی‌شده'
                : 'Timestamped Transcript',
          ),
          if (res.transcriptSegments.isNotEmpty)
            ...res.transcriptSegments.map(
              (seg) => Padding(
                padding: const EdgeInsetsDirectional.only(
                  bottom: SpacingTokens.md,
                ),
                child: MzCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: <Widget>[
                          Text(
                            seg.speaker,
                            style: typography.secondary.copyWith(
                              color: colors.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            '${seg.startSec.toStringAsFixed(1)}s - ${seg.endSec.toStringAsFixed(1)}s',
                            style: typography.caption.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: SpacingTokens.sm),
                      SelectableText(seg.text, style: typography.body),
                      if (seg.annotations.isNotEmpty) ...<Widget>[
                        const SizedBox(height: SpacingTokens.sm),
                        ...seg.annotations.map(
                          (ann) => Container(
                            margin: const EdgeInsetsDirectional.only(
                              top: SpacingTokens.xs,
                            ),
                            padding: const EdgeInsetsDirectional.all(
                              SpacingTokens.sm,
                            ),
                            decoration: BoxDecoration(
                              color: colors.surfaceAlt,
                              borderRadius: shapes.controlRadius,
                            ),
                            child: Text(
                              '${ann.kind.name.toUpperCase()}: "${ann.originalText}" -> "${ann.suggestion}" (${ann.rationale})',
                              style: typography.caption.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            )
          else
            MzCard(
              child: SelectableText(
                res.transcript.isNotEmpty
                    ? res.transcript
                    : (isIran
                          ? 'متن پیاده‌شده‌ای در دسترس نیست.'
                          : 'No transcript text available.'),
                style: typography.body,
              ),
            ),
          if (res.vocabUpgrades.isNotEmpty) ...<Widget>[
            SectionHeader(
              title: isIran
                  ? 'واژگان پیشنهادی اسپیکینگ'
                  : 'Speaking Vocabulary Upgrades',
            ),
            ..._buildVocabUpgradeCards(
              context,
              res.vocabUpgrades,
              state,
              notifier,
              isIran: isIran,
            ),
          ],
        ],
      );
    }

    // Objective Reading / Listening compact Answer Key view
    if (state.objectiveQuestions.isEmpty) {
      return EmptyState(
        glyph: LucideGlyph.bookOpen,
        title: isIran ? 'پاسخ‌نامه در دسترس نیست' : 'No answer key available',
        description: isIran
            ? 'پاسخ‌های تشریحی برای این آزمون در دسترس نیست.'
            : 'Objective answers are unavailable for this attempt.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.xxl),
      itemCount: state.objectiveQuestions.length,
      separatorBuilder: (_, _) => const SizedBox(height: SpacingTokens.sm),
      itemBuilder: (ctx, i) {
        final q = state.objectiveQuestions[i];
        return MzCard(
          child: Row(
            children: <Widget>[
              SizedBox(
                width: 44,
                child: Text(
                  isIran
                      ? '#${EdgeNumerals.toPersianDigits(q.questionNumber)}'
                      : '#${q.questionNumber}',
                  style: typography.cardTitle.copyWith(
                    fontWeight: FontWeight.w700,
                    color: colors.primary,
                  ),
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      q.acceptedAnswers.isNotEmpty
                          ? q.acceptedAnswers.join(' / ')
                          : '—',
                      style: typography.body.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (!q.isCorrect)
                      Text(
                        isIran
                            ? 'پاسخ شما: ${q.userAnswer.isEmpty ? "(خالی)" : q.userAnswer}'
                            : 'Your answer: ${q.userAnswer.isEmpty ? "(blank)" : q.userAnswer}',
                        style: typography.caption.copyWith(color: colors.error),
                      ),
                  ],
                ),
              ),
              AppIcon(
                q.isCorrect
                    ? LucideGlyph.checkCircle2
                    : LucideGlyph.alertCircle,
                size: 20,
                color: q.isCorrect ? colors.success : colors.error,
              ),
            ],
          ),
        );
      },
    );
  }

  List<Widget> _buildVocabUpgradeCards(
    BuildContext context,
    List<VocabUpgrade> upgrades,
    EvaluationReviewState state,
    EvaluationReviewNotifier notifier, {
    required bool isIran,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return upgrades
        .map((up) {
          final cardId =
              'upg-${state.attemptId}-${up.upgraded.toLowerCase().replaceAll(' ', '-')}';
          final saved = state.savedCardIds.contains(cardId);
          return Padding(
            padding: const EdgeInsetsDirectional.only(
              bottom: SpacingTokens.sm,
            ),
            child: MzCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: <Widget>[
                      Expanded(
                        child: Text(
                          '${up.original} -> ${up.upgraded}',
                          style: typography.cardTitle.copyWith(
                            fontWeight: FontWeight.w700,
                            color: colors.primary,
                          ),
                        ),
                      ),
                      TextButton.icon(
                        onPressed: saved
                            ? null
                            : () {
                                unawaited(
                                  notifier.saveMistakeToDeck(
                                    cardId: cardId,
                                    headword: up.upgraded,
                                    definition: up.definition,
                                    glossFa: up.glossFa,
                                    topicTag: state.skill.name,
                                    contextSentence: up.collocation,
                                    usageNote: 'Upgraded from "${up.original}"',
                                  ),
                                );
                                showMzToast(
                                  context,
                                  message: isIran
                                      ? 'عبارت «${up.upgraded}» به دفترچه واژگان اضافه شد.'
                                      : 'Added "${up.upgraded}" to Vocabulary SRS deck',
                                );
                              },
                        icon: AppIcon(
                          saved
                              ? LucideGlyph.checkCircle2
                              : LucideGlyph.bookmarkPlus,
                          size: 16,
                          color: colors.primary,
                        ),
                        label: Text(
                          saved
                              ? (isIran ? 'ذخیره شد' : 'Saved')
                              : (isIran ? 'ذخیره در واژگان' : 'Save to Deck'),
                          style: typography.caption.copyWith(
                            color: colors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  if (up.glossFa != null &&
                      up.glossFa!.trim().isNotEmpty) ...<Widget>[
                    Text(
                      up.glossFa!.trim(),
                      style: typography.body.copyWith(
                        color: colors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                  ],
                  Text(up.definition, style: typography.body),
                  if (up.collocation.isNotEmpty) ...<Widget>[
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      isIran
                          ? 'همنشینی واژگانی: "${up.collocation}"'
                          : 'Collocation: "${up.collocation}"',
                      style: typography.caption.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        })
        .toList(growable: false);
  }
}

class _CompareTab extends StatelessWidget {
  const new({required this.state, required this.isIran});

  final EvaluationReviewState state;
  final bool isIran;

  @override
  Widget build(BuildContext context) {
    final comp = state.comparison;
    if (comp == null) {
      final skillLabel = EditionCopy.skillName(
        state.skill.name,
        isIran: isIran,
      );
      return EmptyState(
        glyph: LucideGlyph.gitCompare,
        title: isIran ? 'هنوز آزمون قبلی ثبت نشده' : 'No baseline attempt yet',
        description: isIran
            ? 'یک آزمون $skillLabel دیگر در مسیر ${state.examTrack.shortName} انجام دهید تا پیشرفت نمرات را کنار هم مقایسه کنید.'
            : 'Complete another $skillLabel attempt in ${state.examTrack.shortName} to compare ${state.examTrack.unitLabel.toLowerCase()} progression side-by-side.',
        actionLabel: isIran
            ? 'مشاهده آزمون‌های تمرینی'
            : 'Browse Practice Tests',
        onTapAction: () => context.go(AppRoutes.practice),
      );
    }

    return ListView(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.xxl),
      children: <Widget>[
        CompareAttempts(
          attempt1Title: isIran
              ? 'قبلی · ${comp.previousTitle}'
              : 'Previous · ${comp.previousTitle}',
          attempt2Title: isIran
              ? 'فعلی · ${comp.currentTitle}'
              : 'Current · ${comp.currentTitle}',
          attempt1Overall: comp.previousOverallBand,
          attempt2Overall: comp.currentOverallBand,
          criteriaDeltas: comp.deltas,
        ),
      ],
    );
  }
}

String _modelRewriteHeading(ExamTrack track, {required bool isIran}) =>
    switch (track) {
      ExamTrack.ieltsAcademic || ExamTrack.ieltsGeneral =>
        isIran ? 'بازنویسی نمونه نمره ۸.۵+' : 'Band 8.5+ Model Rewrite',
      ExamTrack.toeflIbt =>
        isIran ? 'بازنویسی نمونه نمره ۵.۵–۶.۰' : 'Band 5.5–6.0 Model Rewrite',
      ExamTrack.pteAcademic =>
        isIran ? 'بازنویسی نمونه نمره ۸۵+' : '85+ Model Rewrite',
      ExamTrack.det =>
        isIran ? 'بازنویسی نمونه نمره ۱۴۵+' : '145+ Model Rewrite',
    };

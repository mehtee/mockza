import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/evaluation_models.dart';
import 'package:mockza/core/models/speaking_evaluation.dart';
import 'package:mockza/features/evaluation_review/presentation/evaluation_review_notifier.dart';
import 'package:mockza/features/evaluation_review/presentation/evaluation_review_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/compare_attempts.dart';
import 'package:mockza/theme/components/empty_state.dart';
import 'package:mockza/theme/components/mz_bottom_sheet.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_form_field.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/mz_toast.dart';
import 'package:mockza/theme/components/score_meter.dart';
import 'package:mockza/theme/components/section_header.dart';
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
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzScaffold(
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        leading: MzIconButton(
          glyph: LucideGlyph.chevronLeft,
          semanticLabel: 'Back',
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
              'Evaluation Review',
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
              semanticLabel: 'Flag question or score issue',
              onPressed: () => _openFlagSheet(context, notifier, state),
            ),
            MzIconButton(
              glyph: LucideGlyph.cloudUpload,
              semanticLabel: 'Share evaluation summary',
              onPressed: () => _shareResults(context, notifier),
            ),
          ],
        ],
      ),
      body: _buildBody(context, state, notifier),
    );
  }

  Widget _buildBody(
    BuildContext context,
    EvaluationReviewState state,
    EvaluationReviewNotifier notifier,
  ) {
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
              'Loading evaluation...',
              style: typography.body.copyWith(color: colors.textSecondary),
            ),
          ],
        ),
      );
    }

    if (state.notFound) {
      return EmptyState(
        glyph: LucideGlyph.alertCircle,
        title: 'Attempt not found',
        description:
            state.errorMessage ?? 'This attempt may have been cleared.',
        actionLabel: 'Back to Home',
        onTapAction: () => context.go(AppRoutes.home),
      );
    }

    final isObjective =
        state.skill == SkillKind.reading || state.skill == SkillKind.listening;
    final thirdTabLabel = isObjective
        ? 'Answer Key'
        : (state.skill == SkillKind.speaking ? 'Transcript' : 'Rewrite');

    final tabs = <String>[
      'Overview',
      if (isObjective) 'Questions' else 'Rubric',
      thirdTabLabel,
      'Compare',
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
            0 => _OverviewTab(state: state, notifier: notifier),
            1 => _RubricOrQuestionsTab(
              state: state,
              notifier: notifier,
              onFlagQuestion: (qId) =>
                  _openFlagSheet(context, notifier, state, questionId: qId),
            ),
            2 => _RewriteTranscriptKeyTab(state: state, notifier: notifier),
            3 => _CompareTab(state: state),
            _ => _OverviewTab(state: state, notifier: notifier),
          },
        ),
      ],
    );
  }

  Future<void> _shareResults(
    BuildContext context,
    EvaluationReviewNotifier notifier,
  ) async {
    final summary = notifier.buildShareSummary();
    try {
      await SharePlus.instance.share(
        ShareParams(
          text: summary,
          subject: 'Mockza IELTS Evaluation',
        ),
      );
    } on Object {
      if (context.mounted) {
        showMzToast(
          context,
          message: 'Share sheet unavailable on this browser.',
          glyph: LucideGlyph.info,
        );
      }
    }
  }

  Future<void> _openFlagSheet(
    BuildContext context,
    EvaluationReviewNotifier notifier,
    EvaluationReviewState state, {
    String? questionId,
  }) async {
    final noteController = TextEditingController();
    final reasons = <String>[
      'Scoring feels inaccurate',
      'Transcript or text mismatch',
      'Question prompt / answer key issue',
      'Other feedback',
    ];
    var selectedReason = reasons.first;

    try {
      await showMzBottomSheet<void>(
        context: context,
        title: 'Flag Quality Issue',
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
                    'Select the issue you encountered so our academic team can inspect this item:',
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
                    label: 'Optional details',
                    hintText: 'Describe what looked off...',
                    controller: noteController,
                    maxLines: 3,
                  ),
                  const SizedBox(height: SpacingTokens.lg),
                  PrimaryButton(
                    label: 'Submit Flag',
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
                              ? 'Issue reported. Thank you!'
                              : 'Saved offline — flag will sync automatically.',
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
  const new({required this.state, required this.notifier});

  final EvaluationReviewState state;
  final EvaluationReviewNotifier notifier;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    final isAiSkill =
        state.skill == SkillKind.speaking || state.skill == SkillKind.writing;
    final nextStep =
        state.writingResult?.actionableNextStep ??
        state.speakingResult?.actionableNextStep ??
        (state.objectiveTotalCount > 0
            ? 'Review missed answers (${state.objectiveTotalCount - state.objectiveCorrectCount} remaining) and inspect distractor notes.'
            : '');
    final drill =
        state.writingResult?.recommendedDrill ??
        state.speakingResult?.recommendedDrill;
    final criteria =
        state.writingResult?.criteria ??
        state.speakingResult?.criteria ??
        const <CriterionScore>[];

    return ListView(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.xxl),
      children: <Widget>[
        if (state.status == AttemptStatus.failedRetryable) ...<Widget>[
          StatusBanner(
            variant: StatusBannerVariant.error,
            message: state.quotaRefunded
                ? '${state.errorMessage ?? 'Evaluation failed.'} Daily quota credit refunded.'
                : (state.errorMessage ??
                      'Evaluation failed. Your response is saved safely on this device.'),
          ),
          const SizedBox(height: SpacingTokens.md),
          PrimaryButton(
            label: state.isRetrying ? 'Retrying...' : 'Retry AI Evaluation',
            isLoading: state.isRetrying,
            onPressed: state.isRetrying ? null : notifier.retryEvaluation,
          ),
          const SizedBox(height: SpacingTokens.lg),
        ] else if (state.isPendingRemote) ...<Widget>[
          StatusBanner(
            variant: StatusBannerVariant.uploading,
            message:
                state.pollStageLabel ??
                'AI examiner is grading your submission...',
            actionLabel: 'Check Now',
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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  MzChip(
                    label: _skillTitle(state.skill),
                    variant: MzChipVariant.target,
                  ),
                  MzChip(
                    label: isAiSkill
                        ? (state.usedStudyMode
                              ? 'AI Study Mode Estimate'
                              : 'AI Estimated Band')
                        : (!state.isCalibratedFullPack || state.usedStudyMode)
                        ? 'Practice Estimate (${state.objectiveTotalCount} items)'
                        : 'Answer Key (${state.objectiveTotalCount} items)',
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
                      state.overallBand!.toStringAsFixed(1),
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
                                ? 'Estimated IELTS Band'
                                : 'Uncalibrated Practice Estimate',
                            style: typography.cardTitle.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            state.objectiveTotalCount > 0
                                ? '${state.objectiveCorrectCount}/${state.objectiveTotalCount} correct · Target ${state.targetBandScore.toStringAsFixed(1)}'
                                : 'Target ${state.targetBandScore.toStringAsFixed(1)}',
                            style: typography.secondary.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                          if (!state.isCalibratedFullPack ||
                              state.usedStudyMode) ...<Widget>[
                            const SizedBox(height: SpacingTokens.xs),
                            Text(
                              state.usedStudyMode
                                  ? 'Study Mode attempts are excluded from calibrated dashboard band estimates.'
                                  : 'Scaled from a ${state.objectiveTotalCount}-item practice passage; excluded from calibrated 40-item IELTS averages.',
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
                  label: 'Band Progress',
                ),
              ] else ...<Widget>[
                Text(
                  'Scoring in Progress',
                  style: typography.sectionHeading.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: SpacingTokens.xs),
                Text(
                  'Your ${state.skill.name} response is safely stored. Results appear automatically as soon as grading completes.',
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
        if (nextStep.isNotEmpty) ...<Widget>[
          const SectionHeader(title: 'Priority Next Step'),
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
          const SectionHeader(title: 'Criterion Snapshot'),
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
                            c.band.toStringAsFixed(1),
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
        if (drill != null) ...<Widget>[
          const SectionHeader(title: 'Recommended Micro-Drill'),
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
                  '${drill.durationMinutes} min · Focus code ${drill.weaknessCode}',
                  style: typography.secondary.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.md),
                PrimaryButton(
                  label: 'Start Targeted Drill',
                  trailingGlyph: LucideGlyph.arrowRight,
                  onPressed: () => context.push(
                    AppRoutes.buildMicroDrill(drill.drillId),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: SpacingTokens.lg),
        SecondaryButton(
          label: 'Practice Again',
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
    required this.onFlagQuestion,
  });

  final EvaluationReviewState state;
  final EvaluationReviewNotifier notifier;
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

    if (state.skill == SkillKind.reading ||
        state.skill == SkillKind.listening) {
      final filtered = state.objectiveQuestions
          .where((q) {
            if (_filter == 'missed') return !q.isCorrect;
            if (_filter == 'correct') return q.isCorrect;
            return true;
          })
          .toList(growable: false);

      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              MzChip(
                label: 'All (${state.objectiveQuestions.length})',
                isSelected: _filter == 'all',
                onTap: () => setState(() => _filter = 'all'),
              ),
              const SizedBox(width: SpacingTokens.sm),
              MzChip(
                label:
                    'Missed (${state.objectiveTotalCount - state.objectiveCorrectCount})',
                isSelected: _filter == 'missed',
                onTap: () => setState(() => _filter = 'missed'),
              ),
              const SizedBox(width: SpacingTokens.sm),
              MzChip(
                label: 'Correct (${state.objectiveCorrectCount})',
                isSelected: _filter == 'correct',
                onTap: () => setState(() => _filter = 'correct'),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          Expanded(
            child: filtered.isEmpty
                ? const EmptyState(
                    glyph: LucideGlyph.checkCircle2,
                    title: 'Nothing in this filter',
                    description:
                        'Switch filters above to view other questions.',
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
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: <Widget>[
                                Text(
                                  'Question ${q.questionNumber}',
                                  style: typography.cardTitle.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                MzChip(
                                  label: q.isCorrect ? 'Correct' : 'Missed',
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
                              Text(q.prompt, style: typography.body),
                            ],
                            const SizedBox(height: SpacingTokens.sm),
                            Text(
                              'Your answer: ${q.userAnswer.isEmpty ? "(blank)" : q.userAnswer}',
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
                                'Accepted: ${q.acceptedAnswers.join(' / ')}',
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
                                  style: typography.secondary.copyWith(
                                    color: colors.textSecondary,
                                  ),
                                ),
                              ),
                            ],
                            if (q.evidenceQuote != null &&
                                q.evidenceQuote!.isNotEmpty) ...<Widget>[
                              const SizedBox(height: SpacingTokens.sm),
                              Text(
                                q.paragraphIndex != null
                                    ? 'Paragraph ${q.paragraphIndex! + 1}: "${q.evidenceQuote}"'
                                    : '"${q.evidenceQuote}"',
                                style: typography.caption.copyWith(
                                  color: colors.primary,
                                  fontStyle: FontStyle.italic,
                                ),
                              ),
                            ],
                            const SizedBox(height: SpacingTokens.sm),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
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
                                      isSaved ? 'Saved' : 'Save to Deck',
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
                                    'Flag',
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
      return const EmptyState(
        title: 'Rubric scores pending',
        description: 'Individual IELTS criterion breakdowns appear once evaluation completes.',
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
                    label: 'Band ${c.band.toStringAsFixed(1)}',
                    variant: MzChipVariant.target,
                  ),
                ],
              ),
              const SizedBox(height: SpacingTokens.sm),
              ScoreMeter(
                bandScore: c.band,
                targetScore: state.targetBandScore,
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
  const new({required this.state, required this.notifier});

  final EvaluationReviewState state;
  final EvaluationReviewNotifier notifier;

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
                    'Your Submitted Response',
                    style: typography.cardTitle.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  Text(
                    state.submittedEssayText.isNotEmpty
                        ? state.submittedEssayText
                        : 'Essay text saved locally.',
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
              title: 'Submitted Essay (${res.wordCount} words)',
            ),
            MzCard(
              child: SelectableText(
                state.submittedEssayText,
                style: typography.body,
              ),
            ),
          ],
          if (res.inlineEdits.isNotEmpty) ...<Widget>[
            const SectionHeader(title: 'Inline Coaching Edits'),
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
                        'Original: "${edit.originalText}"',
                        style: typography.secondary.copyWith(
                          color: colors.error,
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.xs),
                      Text(
                        'Upgrade: "${edit.suggestedText}"',
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
            const SectionHeader(title: 'Band 8.5+ Model Rewrite'),
            MzCard(
              child: SelectableText(
                res.modelRewrite ?? res.upgradedExcerpt,
                style: typography.body,
              ),
            ),
          ],
          if (res.vocabUpgrades.isNotEmpty) ...<Widget>[
            const SectionHeader(title: 'Vocabulary Upgrades'),
            ..._buildVocabUpgradeCards(
              context,
              res.vocabUpgrades,
              state,
              notifier,
            ),
          ],
        ],
      );
    }

    if (state.skill == SkillKind.speaking) {
      final res = state.speakingResult;
      if (res == null) {
        return const EmptyState(
          glyph: LucideGlyph.headphones,
          title: 'Transcript in progress',
          description: 'Your spoken audio will appear transcribed with fluency annotations once AI scoring completes.',
        );
      }

      return ListView(
        padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.xxl),
        children: <Widget>[
          const SectionHeader(title: 'Timestamped Transcript'),
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
                    : 'No transcript text available.',
                style: typography.body,
              ),
            ),
          if (res.vocabUpgrades.isNotEmpty) ...<Widget>[
            const SectionHeader(title: 'Speaking Vocabulary Upgrades'),
            ..._buildVocabUpgradeCards(
              context,
              res.vocabUpgrades,
              state,
              notifier,
            ),
          ],
        ],
      );
    }

    // Objective Reading / Listening compact Answer Key view
    if (state.objectiveQuestions.isEmpty) {
      return const EmptyState(
        glyph: LucideGlyph.bookOpen,
        title: 'No answer key available',
        description: 'Objective answers are unavailable for this attempt.',
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
                  '#${q.questionNumber}',
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
                        'Your answer: ${q.userAnswer.isEmpty ? "(blank)" : q.userAnswer}',
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
    EvaluationReviewNotifier notifier,
  ) {
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
                                    topicTag: state.skill.name,
                                    contextSentence: up.collocation,
                                    usageNote: 'Upgraded from "${up.original}"',
                                  ),
                                );
                                showMzToast(
                                  context,
                                  message:
                                      'Added "${up.upgraded}" to Vocabulary SRS deck',
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
                          saved ? 'Saved' : 'Save to Deck',
                          style: typography.caption.copyWith(
                            color: colors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  Text(up.definition, style: typography.body),
                  if (up.collocation.isNotEmpty) ...<Widget>[
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      'Collocation: "${up.collocation}"',
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
  const new({required this.state});

  final EvaluationReviewState state;

  @override
  Widget build(BuildContext context) {
    final comp = state.comparison;
    if (comp == null) {
      return EmptyState(
        glyph: LucideGlyph.gitCompare,
        title: 'No baseline attempt yet',
        description:
            'Complete another ${_skillTitle(state.skill)} attempt to compare band progression side-by-side.',
        actionLabel: 'Browse Practice Tests',
        onTapAction: () => context.go(AppRoutes.practice),
      );
    }

    return ListView(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.xxl),
      children: <Widget>[
        CompareAttempts(
          attempt1Title: 'Previous · ${comp.previousTitle}',
          attempt2Title: 'Current · ${comp.currentTitle}',
          attempt1Overall: comp.previousOverallBand,
          attempt2Overall: comp.currentOverallBand,
          criteriaDeltas: comp.deltas,
        ),
      ],
    );
  }
}

String _skillTitle(SkillKind skill) {
  switch (skill) {
    case SkillKind.speaking:
      return 'Speaking';
    case SkillKind.writing:
      return 'Writing';
    case SkillKind.reading:
      return 'Reading';
    case SkillKind.listening:
      return 'Listening';
    case SkillKind.vocabulary:
      return 'Vocabulary';
  }
}

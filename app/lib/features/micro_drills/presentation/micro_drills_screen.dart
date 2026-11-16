import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/features/micro_drills/presentation/micro_drills_notifier.dart';
import 'package:mockza/features/micro_drills/presentation/micro_drills_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/empty_state.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/score_meter.dart';
import 'package:mockza/theme/components/timer_bar.dart';
import 'package:mockza/theme/primitives.dart';

/// Targeted Postgres-synced IELTS micro-drills workout screen.
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
  @override
  void initState() {
    super.initState();
    unawaited(
      Future.microtask(
        () => ref
            .read(microDrillsNotifierProvider.notifier)
            .loadDrill(widget.drillId),
      ),
    );
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

    final activeSpec = state.drillSpec;
    final canPopSafely =
        !state.hasSelectedDrill || state.isFinished || activeSpec == null;

    return PopScope(
      canPop: canPopSafely,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          _showExitDialog(context);
        }
      },
      child: MzScaffold(
        appBar: AppBar(
          backgroundColor: colors.background,
          elevation: 0,
          leading: IconButton(
            icon: const AppIcon(LucideGlyph.x, size: 20),
            onPressed: () {
              if (canPopSafely) {
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go(AppRoutes.practice);
                }
              } else {
                _showExitDialog(context);
              }
            },
          ),
          title: Text(activeSpec?.title ?? 'Micro-Drills'),
          actions: <Widget>[
            if (activeSpec != null && !state.isFinished)
              Padding(
                padding: const EdgeInsetsDirectional.only(
                  end: SpacingTokens.md,
                ),
                child: TimerBar(
                  remainingSeconds: state.remainingSeconds,
                  totalSeconds: activeSpec.durationSeconds,
                ),
              ),
          ],
        ),
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 680),
            child: _buildBody(context, state, notifier),
          ),
        ),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    MicroDrillsState state,
    MicroDrillsNotifier notifier,
  ) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    if (state.isLoading) {
      return Center(
        child: CircularProgressIndicator(color: colors.primary),
      );
    }

    if (state.availableDrills.isEmpty) {
      return EmptyState(
        title: 'No drills synced yet',
        description:
            state.errorMessage ??
            'Micro-drills are downloaded from the server catalog.',
        actionLabel: 'Sync Drills',
        onTapAction: () =>
            unawaited(notifier.loadDrill(widget.drillId, forceSync: true)),
      );
    }

    if (!state.hasSelectedDrill || state.drillSpec == null) {
      return ListView(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
        children: <Widget>[
          Text(
            'Focused 3-Minute Workouts',
            style: typography.sectionHeading.copyWith(
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            'Target specific IELTS grading criteria with short high-yield exercises.',
            style: typography.body.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.lg),
          ...state.availableDrills.map(
            (drill) => Padding(
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
                            label: drill.weaknessCode,
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
                            '${drill.items.length} items · ${(drill.durationSeconds / 60).ceil()} min · ${drill.subtitle}',
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
            ),
          ),
        ],
      );
    }

    final spec = state.drillSpec!;
    if (state.isFinished) {
      return _buildCompletionView(context, state, spec);
    }

    final currentItem = state.currentItem;
    if (currentItem == null) {
      return EmptyState(
        glyph: LucideGlyph.info,
        title: 'Drill has no questions',
        description: 'Choose another workout to begin.',
        actionLabel: 'Back to Practice Hub',
        onTapAction: () => context.go(AppRoutes.practice),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          _buildProgressHeader(context, state),
          const SizedBox(height: SpacingTokens.md),
          Row(
            children: <Widget>[
              MzChip(label: spec.weaknessCode, variant: MzChipVariant.target),
              const Spacer(),
              Text(
                'Question ${state.currentIndex + 1} of ${spec.items.length}',
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
                  'Complete the Sentence',
                  style: typography.cardTitle.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.sm),
                Text(
                  currentItem.prompt,
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
            'Select the best option:',
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
            _buildFeedbackCard(context, state, currentItem),
          ],
          const SizedBox(height: SpacingTokens.xl),
          _buildBottomAction(context, state, spec, notifier),
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
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);
    final isSelected = state.selectedOption == option;

    var borderColor = colors.borderSubtle;
    var bgColor = colors.surface;

    if (state.isSubmitted) {
      final isCorrectAnswer = currentItem.acceptedAnswers.contains(option);
      if (isCorrectAnswer) {
        borderColor = colors.success;
        bgColor = colors.mintBg;
      } else if (isSelected) {
        borderColor = colors.error;
        bgColor = colors.dangerBg;
      }
    } else if (isSelected) {
      borderColor = colors.primary;
      bgColor = colors.primary.withValues(alpha: 0.08);
    }

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.sm),
      child: InkWell(
        onTap: state.isSubmitted ? null : () => notifier.selectOption(option),
        borderRadius: shapes.controlRadius,
        child: Container(
          padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: shapes.controlRadius,
            border: Border.all(
              color: borderColor,
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: <Widget>[
              Icon(
                isSelected
                    ? Icons.radio_button_checked
                    : Icons.radio_button_off,
                size: 20,
                color: isSelected ? colors.primary : colors.textTertiary,
              ),
              const SizedBox(width: SpacingTokens.md),
              Expanded(
                child: Text(
                  option,
                  style: typography.body.copyWith(
                    color: colors.textPrimary,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFeedbackCard(
    BuildContext context,
    MicroDrillsState state,
    MicroDrillItemSpec item,
  ) {
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
                  isCorrect ? 'Well done! Correct.' : 'Incorrect variant.',
                  style: typography.secondary.copyWith(
                    color: isCorrect ? colors.success : colors.error,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: SpacingTokens.xs),
                Text(
                  item.explanation,
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
    MicroDrillsNotifier notifier,
  ) {
    if (!state.isSubmitted) {
      return PrimaryButton(
        label: 'Check Answer',
        onPressed: state.selectedOption == null ? null : notifier.submitAnswer,
      );
    }

    final isLast = state.currentIndex + 1 >= spec.items.length;
    return PrimaryButton(
      label: isLast ? 'Complete Workout' : 'Next Exercise',
      trailingGlyph: LucideGlyph.arrowRight,
      onPressed: notifier.nextItem,
    );
  }

  Widget _buildCompletionView(
    BuildContext context,
    MicroDrillsState state,
    MicroDrillSpec spec,
  ) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final total = spec.items.isEmpty ? 1 : spec.items.length;
    final percentage = ((state.score / total) * 100).round();
    final minsLabel = (spec.durationSeconds / 60).ceil();

    return Padding(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Center(
            child: ScoreMeter(
              score: (state.score / total) * 9.0,
              label: 'Drill Band Impact',
            ),
          ),
          const SizedBox(height: SpacingTokens.lg),
          Text(
            '$minsLabel-Minute Workout Complete!',
            textAlign: TextAlign.center,
            style: typography.sectionHeading.copyWith(
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            '${state.score} of ${spec.items.length} correct ($percentage%) · ${spec.weaknessCode}',
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
                        'Study Activity Recorded',
                        style: typography.cardTitle.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                      Text(
                        "Your completed drill has been logged to today's study progress.",
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
            label: 'Back to Practice Hub',
            onPressed: () => context.go(AppRoutes.practice),
          ),
        ],
      ),
    );
  }

  void _showExitDialog(BuildContext context) {
    unawaited(
      showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Exit Micro-Drill?'),
          content: const Text(
            'Your progress in this workout session will be discarded.',
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Stay'),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(dialogContext).pop();
                if (context.canPop()) {
                  context.pop();
                } else {
                  context.go(AppRoutes.practice);
                }
              },
              child: const Text('Exit'),
            ),
          ],
        ),
      ),
    );
  }
}

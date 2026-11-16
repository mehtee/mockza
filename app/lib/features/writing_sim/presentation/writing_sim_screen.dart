import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/models/writing_evaluation.dart';
import 'package:mockza/features/writing_sim/presentation/writing_sim_providers.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/chart_stage_card.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/status_banner.dart';
import 'package:mockza/theme/components/timer_bar.dart';
import 'package:mockza/theme/primitives.dart';

/// Fullscreen writing exam simulator with live SeaweedFS SVG charts,
/// per-task debounced Drift autosave, Exam/Study Mode enforcement, and
/// `/v1/evaluate/writing` submission (Screens 06 & 07).
class WritingSimScreen extends ConsumerStatefulWidget {
  /// Creates a [WritingSimScreen].
  const new({
    this.taskId = 'ielts-writing-seed-01',
    this.isExamMode = true,
    this.mockSessionId,
    this.mockStageKey,
    this.initialTaskIndex = 0,
    super.key,
  });

  /// The Postgres Writing pack identifier.
  final String taskId;

  /// Exam Mode (disables autocorrect & timer pause) vs Study Mode.
  final bool isExamMode;

  /// Optional parent Full Mock session ID.
  final String? mockSessionId;

  /// Optional stage key (`writing_task1` or `writing_task2`) within the Full Mock session.
  final String? mockStageKey;

  /// Initial task tab index when launching a single task (`0` = Task 1, `1` = Task 2).
  final int initialTaskIndex;

  @override
  ConsumerState<WritingSimScreen> createState() => _WritingSimScreenState();
}

class _WritingSimScreenState extends ConsumerState<WritingSimScreen>
    with WidgetsBindingObserver {
  late final TextEditingController _controller;
  int _lastSyncedNonce = -1;
  bool _isPromptCollapsed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _controller = TextEditingController();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(
        ref
            .read(writingSimNotifierProvider.notifier)
            .initialize(
              widget.taskId,
              isExamMode: widget.isExamMode,
              mockSessionId: widget.mockSessionId,
              mockStageKey: widget.mockStageKey,
              initialTaskIndex: widget.initialTaskIndex,
            ),
      );
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final notifier = ref.read(writingSimNotifierProvider.notifier);
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.detached) {
      unawaited(notifier.flushAutosaveNow());
    } else if (state == AppLifecycleState.resumed) {
      notifier.reconcileTimer();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(writingSimNotifierProvider);
    final notifier = ref.read(writingSimNotifierProvider.notifier);

    if (state.draftSyncNonce != _lastSyncedNonce) {
      _lastSyncedNonce = state.draftSyncNonce;
      if (_controller.text != state.draftText) {
        _controller.value = TextEditingValue(
          text: state.draftText,
          selection: TextSelection.collapsed(offset: state.draftText.length),
        );
      }
    }

    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);
    final editionConfig = ref.watch(editionConfigProvider);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final shouldExit = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: colors.surface,
            shape: RoundedRectangleBorder(borderRadius: shapes.cardRadius),
            title: Text('Exit Writing Session?', style: typography.cardTitle),
            content: Text(
              state.isEphemeralStorage
                  ? 'Browser storage is running in volatile memory mode. Exiting or reloading before submitting may lose your unsubmitted draft.'
                  : 'Your essay draft is saved locally. You can resume anytime.',
              style: typography.body.copyWith(color: colors.textSecondary),
            ),
            actions: <Widget>[
              SecondaryButton(
                label: 'Cancel',
                onPressed: () => Navigator.of(ctx).pop(false),
              ),
              PrimaryButton(
                label: 'Exit',
                onPressed: () => Navigator.of(ctx).pop(true),
              ),
            ],
          ),
        );
        if (shouldExit ?? false) {
          await notifier.flushAutosaveNow();
          if (context.mounted) {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go(AppRoutes.home);
            }
          }
        }
      },
      child: MzScaffold(
        mode: MzScaffoldMode.immersive,
        body: Column(
          children: <Widget>[
            // Immersive Top Bar
            Padding(
              padding: const EdgeInsetsDirectional.only(
                top: SpacingTokens.md,
                start: SpacingTokens.md,
                end: SpacingTokens.md,
                bottom: SpacingTokens.xs,
              ),
              child: Row(
                children: <Widget>[
                  IconButton(
                    icon: const AppIcon(LucideGlyph.x, size: 20),
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                  const Spacer(),
                  if (state.tasks.isNotEmpty)
                    Container(
                      padding: const EdgeInsetsDirectional.all(2),
                      decoration: BoxDecoration(
                        color: colors.surfaceAlt,
                        borderRadius: shapes.pillRadius,
                        border: Border.all(color: colors.borderSubtle),
                      ),
                      child: Row(
                        children: List.generate(state.tasks.length, (i) {
                          final taskSpec = state.tasks[i];
                          final isTask1 = !taskSpec.taskType.contains('2');
                          return _TaskTabButton(
                            label:
                                '${isTask1 ? 'Task 1' : 'Task 2'} (${taskSpec.minWords}w)',
                            isSelected: state.activeTaskIndex == i,
                            onTap: () => notifier.selectTaskIndex(i),
                          );
                        }),
                      ),
                    ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: SpacingTokens.sm,
                      vertical: SpacingTokens.xs,
                    ),
                    decoration: BoxDecoration(
                      color: state.meetsWordMinimum
                          ? colors.mintBg
                          : colors.surfaceAlt,
                      borderRadius: shapes.pillRadius,
                      border: Border.all(
                        color: state.meetsWordMinimum
                            ? colors.success
                            : colors.borderSubtle,
                      ),
                    ),
                    child: Text(
                      '${state.wordCount} / ${state.minimumWordCount}w',
                      style: typography.caption.copyWith(
                        color: state.meetsWordMinimum
                            ? colors.success
                            : colors.textSecondary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Timer Bar (with Study Mode pause/resume)
            TimerBar(
              remainingSeconds: state.remainingSeconds,
              totalSeconds: state.totalSeconds > 0 ? state.totalSeconds : 2400,
              phase: state.isPaused
                  ? TimerPhase.paused
                  : (state.remainingSeconds == 0
                        ? TimerPhase.expired
                        : TimerPhase.response),
              isStudyMode: !state.isExamMode,
              onTapPauseResume: state.isExamMode ? null : notifier.togglePause,
            ),
            const SizedBox(height: SpacingTokens.sm),

            // Main Workspace
            Expanded(
              child: state.isLoadingPack
                  ? const Center(child: CircularProgressIndicator())
                  : state.tasks.isEmpty && state.errorMessage != null
                  ? Center(
                      child: Padding(
                        padding: const EdgeInsetsDirectional.all(
                          SpacingTokens.lg,
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: <Widget>[
                            AppIcon(
                              LucideGlyph.alertCircle,
                              size: 36,
                              color: colors.error,
                            ),
                            const SizedBox(height: SpacingTokens.md),
                            Text(
                              state.errorMessage!,
                              textAlign: TextAlign.center,
                              style: typography.body.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                            const SizedBox(height: SpacingTokens.lg),
                            PrimaryButton(
                              label: 'Retry Loading Pack',
                              onPressed: () => notifier.initialize(
                                widget.taskId,
                                isExamMode: widget.isExamMode,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView(
                      padding: const EdgeInsetsDirectional.symmetric(
                        horizontal: SpacingTokens.md,
                      ),
                      children: <Widget>[
                        if (state.isEphemeralStorage) ...<Widget>[
                          const StatusBanner(
                            variant: StatusBannerVariant.offline,
                            message: 'Browser storage is unavailable (volatile memory mode). Drafts will not survive a page reload.',
                          ),
                          const SizedBox(height: SpacingTokens.sm),
                        ],
                        // Prompt Card (collapsible on compact screens so the editor stays reachable `UX-06`)
                        MzCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Row(
                                children: <Widget>[
                                  Expanded(
                                    child: Text(
                                      _headingForTaskType(state.taskType),
                                      style: typography.caption.copyWith(
                                        color: colors.textSecondary,
                                      ),
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: () => setState(
                                      () => _isPromptCollapsed =
                                          !_isPromptCollapsed,
                                    ),
                                    child: Text(
                                      _isPromptCollapsed
                                          ? 'Show prompt'
                                          : 'Hide prompt',
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: SpacingTokens.xs),
                              Text(
                                state.promptTitle,
                                style: typography.cardTitle,
                              ),
                              if (!_isPromptCollapsed) ...<Widget>[
                                const SizedBox(height: SpacingTokens.xs),
                                Text(
                                  state.promptDescription,
                                  style: typography.body.copyWith(
                                    color: colors.textPrimary,
                                    height: 1.5,
                                  ),
                                ),
                                if (state.chartSvg != null &&
                                    state.chartSvg!.isNotEmpty) ...<Widget>[
                                  const SizedBox(height: SpacingTokens.md),
                                  _TaskChartView(
                                    chartSvgOrPath: state.chartSvg!,
                                    resolvedUrl: editionConfig.resolveMediaUrl(
                                      state.chartSvg!,
                                    ),
                                    caption: state.chartCaption,
                                  ),
                                ],
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(height: SpacingTokens.md),

                        // Essay Editor Box
                        Container(
                          decoration: BoxDecoration(
                            color: colors.surface,
                            borderRadius: shapes.cardRadius,
                            border: Border.all(color: colors.borderSubtle),
                          ),
                          padding: const EdgeInsetsDirectional.all(
                            SpacingTokens.md,
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: <Widget>[
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: <Widget>[
                                  Text(
                                    'Your Response',
                                    style: typography.caption.copyWith(
                                      color: colors.textTertiary,
                                    ),
                                  ),
                                  Text(
                                    state.lastSavedText,
                                    style: typography.caption.copyWith(
                                      color: colors.textTertiary,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: SpacingTokens.xs),
                              TextField(
                                controller: _controller,
                                readOnly: state.isTimeExpired,
                                maxLines: 15,
                                autocorrect: !state.isExamMode,
                                enableSuggestions: !state.isExamMode,
                                style: typography.readingPassage,
                                decoration: InputDecoration(
                                  border: InputBorder.none,
                                  hintText: state.isTimeExpired
                                      ? 'Time expired — submit your response below.'
                                      : (state.isEphemeralStorage
                                            ? 'Begin typing your response here (memory-only session)...'
                                            : 'Begin typing your response here... Drafts autosave locally.'),
                                  hintStyle: typography.body.copyWith(
                                    color: colors.textTertiary,
                                  ),
                                ),
                                onChanged: notifier.updateDraft,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: SpacingTokens.xl),
                      ],
                    ),
            ),

            if (state.errorMessage != null && state.tasks.isNotEmpty)
              Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: SpacingTokens.md,
                ),
                child: Text(
                  state.errorMessage!,
                  style: typography.caption.copyWith(color: colors.error),
                ),
              ),

            if (state.tasks.isNotEmpty)
              Padding(
                padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
                child: PrimaryButton(
                  label: state.isSubmitting
                      ? 'Submitting to Examiner AI...'
                      : 'Submit for AI Evaluation',
                  onPressed: state.isSubmitting
                      ? null
                      : () async {
                          final attemptId = await notifier.submitWriting();
                          if (attemptId != null && context.mounted) {
                            context.go(
                              AppRoutes.buildAttemptReview(attemptId),
                            );
                          }
                        },
                ),
              ),
          ],
        ),
      ),
    );
  }

  static String _headingForTaskType(WritingTaskType type) => switch (type) {
    WritingTaskType.task1Academic => 'Academic Writing Task 1 (Chart/Diagram)',
    WritingTaskType.task1General => 'General Training Writing Task 1 (Letter)',
    WritingTaskType.task2Essay => 'IELTS Writing Task 2 (Essay)',
  };
}

class _TaskTabButton extends StatelessWidget {
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
          horizontal: SpacingTokens.sm,
          vertical: SpacingTokens.xs,
        ),
        decoration: BoxDecoration(
          color: isSelected
              ? colors.surface
              : colors.surface.withValues(alpha: 0),
          borderRadius: shapes.pillRadius,
        ),
        child: Text(
          label,
          style: typography.caption.copyWith(
            color: isSelected ? colors.textPrimary : colors.textSecondary,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}

class _TaskChartView extends StatelessWidget {
  const new({
    required this.chartSvgOrPath,
    required this.resolvedUrl,
    this.caption,
  });

  final String chartSvgOrPath;
  final String resolvedUrl;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final isInlineSvg = chartSvgOrPath.trimLeft().startsWith('<svg');

    Widget buildSvgWidget(BuildContext _) => isInlineSvg
        ? SvgPicture.string(chartSvgOrPath)
        : SvgPicture.network(
            resolvedUrl,
            placeholderBuilder: (_) => const Center(
              child: CircularProgressIndicator(),
            ),
          );

    return ChartStageCard(chartBuilder: buildSvgWidget, caption: caption);
  }
}

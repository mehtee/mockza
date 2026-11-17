import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/features/speaking_sim/presentation/speaking_sim_notifier.dart';
import 'package:mockza/features/speaking_sim/presentation/speaking_sim_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/routing/safe_pop.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/audio_level_meter.dart';
import 'package:mockza/theme/components/exam_exit_guard.dart';
import 'package:mockza/theme/components/mic_preflight_card.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/status_banner.dart';
import 'package:mockza/theme/components/timer_bar.dart';
import 'package:mockza/theme/primitives.dart';

/// Speaking simulator screen with live mic waveform preview, Part 1–3 navigation,
/// cue card scratchpad, clip playback check, and SeaweedFS upload (Screens 04 & 05).
class SpeakingSimScreen extends ConsumerStatefulWidget {
  /// Creates a [SpeakingSimScreen].
  const new({
    this.examId = 'ielts-speaking-seed-01',
    this.isExamMode = true,
    this.mockSessionId,
    this.mockStageKey,
    super.key,
  });

  /// The Speaking exam pack identifier.
  final String examId;

  /// Exam Mode (strict countdowns & single recording) vs Study Mode.
  final bool isExamMode;

  /// Optional parent Full Mock session ID.
  final String? mockSessionId;

  /// Optional stage key within the Full Mock session.
  final String? mockStageKey;

  @override
  ConsumerState<SpeakingSimScreen> createState() => _SpeakingSimScreenState();
}

class _SpeakingSimScreenState extends ConsumerState<SpeakingSimScreen> {
  late final TextEditingController _notesController;

  @override
  void initState() {
    super.initState();
    _notesController = TextEditingController();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(
        ref
            .read(speakingSimNotifierProvider.notifier)
            .initialize(
              widget.examId,
              isExamMode: widget.isExamMode,
              mockSessionId: widget.mockSessionId,
              mockStageKey: widget.mockStageKey,
            ),
      );
    });
  }

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(speakingSimNotifierProvider);
    final notifier = ref.read(speakingSimNotifierProvider.notifier);
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);

    final currentPrompt = state.currentPrompt;
    final hasClipForCurrent =
        currentPrompt != null &&
        state.recordedTurns.containsKey(currentPrompt.promptId);
    final isLastTurn =
        state.prompts.isNotEmpty &&
        state.currentTurnIndex >= state.prompts.length - 1;

    return ExamExitGuard(
      dialogTitle: 'Exit Speaking Session?',
      dialogMessage: 'Recorded turns stay cached locally only while this session is active. Exit now?',
      onConfirmedExit: () async {
        await notifier.stopMicPreview();
        if (context.mounted) {
          context.safePopOrGo(AppRoutes.home);
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
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  IconButton(
                    icon: const AppIcon(LucideGlyph.x, size: 20),
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                  const SizedBox(width: SpacingTokens.xs),
                  Flexible(
                    child: Container(
                      padding: const EdgeInsetsDirectional.symmetric(
                        horizontal: SpacingTokens.md,
                        vertical: SpacingTokens.xs,
                      ),
                      decoration: BoxDecoration(
                        color: colors.surfaceAlt,
                        borderRadius: shapes.pillRadius,
                        border: Border.all(color: colors.borderSubtle),
                      ),
                      child: Text(
                        'Part ${state.activePart} • Turn ${state.currentTurnIndex + 1}/${state.prompts.isEmpty ? 1 : state.prompts.length}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: typography.caption.copyWith(
                          color: colors.primary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: SpacingTokens.xs),
                  MzChip(
                    label: widget.isExamMode ? 'Exam' : 'Study',
                  ),
                ],
              ),
            ),

            // Timer Bar
            TimerBar(
              remainingSeconds: state.remainingSeconds,
              totalSeconds: state.totalSeconds > 0 ? state.totalSeconds : 60,
              phase: state.isPreparing
                  ? TimerPhase.prep
                  : (state.phase == SpeakingPhase.recorded
                        ? TimerPhase.paused
                        : TimerPhase.response),
            ),
            const SizedBox(height: SpacingTokens.sm),

            // Content Area
            Expanded(
              child: state.isLoadingPack
                  ? const Center(child: CircularProgressIndicator())
                  : state.prompts.isEmpty
                  ? _LoadErrorView(
                      errorMessage:
                          state.errorMessage ??
                          'Could not load Speaking prompts.',
                      onRetry: () => notifier.initialize(
                        widget.examId,
                        isExamMode: widget.isExamMode,
                      ),
                    )
                  : state.isRecording
                  ? _ActiveRecordingView(
                      state: state,
                      notesText: _notesController.text,
                    )
                  : _PromptAndMicCheckView(
                      state: state,
                      notifier: notifier,
                      notesController: _notesController,
                      hasClipForCurrent: hasClipForCurrent,
                    ),
            ),

            // Privacy, Ephemeral Storage Warning & Error Strip + Bottom Actions
            if (state.isEphemeralStorage || state.hasStorageWarning)
              Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: SpacingTokens.md,
                  vertical: SpacingTokens.xs,
                ),
                child: StatusBanner(
                  variant: StatusBannerVariant.offline,
                  message: state.isEphemeralStorage
                      ? 'Browser storage is unavailable (volatile memory mode). Submit before reloading or closing this tab.'
                      : 'Browser storage could not durably save your clip. Submit before closing this tab.',
                ),
              ),
            if (state.errorMessage != null && state.prompts.isNotEmpty)
              Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: SpacingTokens.md,
                ),
                child: Text(
                  state.errorMessage!,
                  style: typography.caption.copyWith(color: colors.error),
                ),
              ),
            if (state.recordedTurns.isNotEmpty && !state.isRecording)
              Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: SpacingTokens.md,
                  vertical: SpacingTokens.xs,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    AppIcon(
                      LucideGlyph.shieldCheck,
                      size: 14,
                      color: colors.textTertiary,
                    ),
                    const SizedBox(width: SpacingTokens.xs),
                    Flexible(
                      child: Text(
                        'Uploaded turns are analyzed by AI and auto-purged after 7 days.',
                        style: typography.caption.copyWith(
                          color: colors.textTertiary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (state.prompts.isNotEmpty)
              Padding(
                padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
                child: _buildBottomActions(
                  context,
                  state: state,
                  notifier: notifier,
                  hasClipForCurrent: hasClipForCurrent,
                  isLastTurn: isLastTurn,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomActions(
    BuildContext context, {
    required SpeakingSimState state,
    required SpeakingSimNotifier notifier,
    required bool hasClipForCurrent,
    required bool isLastTurn,
  }) {
    if (state.isRecording) {
      return SecondaryButton(
        label: 'Finish Recording Turn',
        onPressed: notifier.finishResponse,
      );
    }

    if (state.isPreparing) {
      return PrimaryButton(
        label: 'Skip Prep & Start Recording',
        onPressed: notifier.startSpeaking,
      );
    }

    if (!hasClipForCurrent) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          PrimaryButton(
            label: 'Start Recording Answer',
            onPressed: notifier.startSpeaking,
          ),
          if (state.recordedTurns.isNotEmpty) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            SecondaryButton(
              label: state.isSubmitting
                  ? 'Uploading & Submitting...'
                  : 'Submit Recorded Turns (${state.recordedTurns.length})',
              onPressed: state.isSubmitting
                  ? null
                  : () => _handleSubmit(context, notifier),
            ),
          ],
        ],
      );
    }

    // Current turn already recorded: allow moving to next turn OR submitting.
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (!isLastTurn) ...<Widget>[
          PrimaryButton(
            label:
                'Continue to Turn ${state.currentTurnIndex + 2} of ${state.prompts.length}',
            onPressed: () => notifier.goToTurn(state.currentTurnIndex + 1),
          ),
          const SizedBox(height: SpacingTokens.sm),
          SecondaryButton(
            label: state.isSubmitting
                ? 'Uploading & Submitting...'
                : 'Submit Now (${state.recordedTurns.length}/${state.prompts.length} turns)',
            onPressed: state.isSubmitting
                ? null
                : () => _handleSubmit(context, notifier),
          ),
        ] else
          PrimaryButton(
            label: state.isSubmitting
                ? 'Uploading Audio to AI...'
                : 'Submit for AI Evaluation',
            onPressed: state.isSubmitting
                ? null
                : () => _handleSubmit(context, notifier),
          ),
      ],
    );
  }

  Future<void> _handleSubmit(
    BuildContext context,
    SpeakingSimNotifier notifier,
  ) async {
    final attemptId = await notifier.submitSession();
    if (attemptId != null && context.mounted) {
      context.go(AppRoutes.buildAttemptReview(attemptId));
    }
  }
}

class _LoadErrorView extends StatelessWidget {
  const new({
    required this.errorMessage,
    required this.onRetry,
  });

  final String errorMessage;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Center(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            AppIcon(LucideGlyph.alertCircle, size: 40, color: colors.error),
            const SizedBox(height: SpacingTokens.md),
            Text(
              errorMessage,
              textAlign: TextAlign.center,
              style: typography.body.copyWith(color: colors.textSecondary),
            ),
            const SizedBox(height: SpacingTokens.lg),
            PrimaryButton(label: 'Retry Loading Pack', onPressed: onRetry),
          ],
        ),
      ),
    );
  }
}

class _PromptAndMicCheckView extends StatelessWidget {
  const new({
    required this.state,
    required this.notifier,
    required this.notesController,
    required this.hasClipForCurrent,
  });

  final SpeakingSimState state;
  final SpeakingSimNotifier notifier;
  final TextEditingController notesController;
  final bool hasClipForCurrent;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);
    final currentPrompt = state.currentPrompt;
    final turnClip = currentPrompt != null
        ? state.recordedTurns[currentPrompt.promptId]
        : null;

    return ListView(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: SpacingTokens.md,
      ),
      children: <Widget>[
        // Turn Selector Dots (free jump in Study Mode, visual indicator in Exam)
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: List.generate(state.prompts.length, (idx) {
              final prompt = state.prompts[idx];
              final isDone = state.recordedTurns.containsKey(prompt.promptId);
              final isCurrent = idx == state.currentTurnIndex;
              return Padding(
                padding: const EdgeInsetsDirectional.only(
                  end: SpacingTokens.xs,
                ),
                child: GestureDetector(
                  onTap: state.isExamMode ? null : () => notifier.goToTurn(idx),
                  child: Container(
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: SpacingTokens.sm,
                      vertical: SpacingTokens.xs,
                    ),
                    decoration: BoxDecoration(
                      color: isCurrent
                          ? colors.primary
                          : (isDone ? colors.mintBg : colors.surfaceAlt),
                      borderRadius: shapes.pillRadius,
                      border: Border.all(
                        color: isCurrent
                            ? colors.primary
                            : (isDone ? colors.success : colors.borderSubtle),
                      ),
                    ),
                    child: Text(
                      'P${prompt.partIndex}.${idx + 1}',
                      style: typography.caption.copyWith(
                        color: isCurrent
                            ? colors.onPrimary
                            : (isDone ? colors.success : colors.textSecondary),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
        const SizedBox(height: SpacingTokens.md),

        // Examiner Prompt / Cue Card
        MzCard(
          variant: MzCardVariant.hero,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                state.activePart == 2
                    ? 'Part 2 Candidate Cue Card'
                    : (state.activePart == 1
                          ? 'Part 1 Examiner Question'
                          : 'Part 3 Follow-Up Discussion'),
                style: typography.caption.copyWith(color: colors.textSecondary),
              ),
              const SizedBox(height: SpacingTokens.xs),
              Text(state.promptTitle, style: typography.sectionHeading),
              if (state.cueCardBullets.isNotEmpty) ...<Widget>[
                const SizedBox(height: SpacingTokens.md),
                Text(
                  'You should say:',
                  style: typography.secondary.copyWith(
                    fontWeight: FontWeight.w600,
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.xs),
                ...state.cueCardBullets.map(
                  (bullet) => Padding(
                    padding: const EdgeInsetsDirectional.only(
                      bottom: SpacingTokens.xs,
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Container(
                          margin: const EdgeInsetsDirectional.only(
                            top: 7,
                            end: SpacingTokens.xs,
                          ),
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: colors.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                        Expanded(
                          child: Text(
                            bullet,
                            style: typography.body.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),

        // Optional Scratchpad for Part 2
        if (state.activePart == 2) ...<Widget>[
          const SizedBox(height: SpacingTokens.md),
          MzCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text('Prep Notes Scratchpad', style: typography.cardTitle),
                const SizedBox(height: SpacingTokens.xs),
                TextField(
                  controller: notesController,
                  maxLines: 3,
                  style: typography.body,
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    hintText: 'Jot quick keywords while preparing...',
                    hintStyle: typography.secondary.copyWith(
                      color: colors.textTertiary,
                    ),
                  ),
                  onChanged: notifier.updateCueCardNotes,
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: SpacingTokens.md),

        // Recorded Clip Playback Preview + Optional Study Mode Re-record
        if (hasClipForCurrent &&
            turnClip != null &&
            currentPrompt != null) ...<Widget>[
          MzCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    AppIcon(
                      LucideGlyph.checkCircle2,
                      color: colors.success,
                      size: 18,
                    ),
                    const SizedBox(width: SpacingTokens.xs),
                    Expanded(
                      child: Text(
                        'Recorded ${(turnClip.durationMs / 1000).toStringAsFixed(1)}s clip',
                        style: typography.cardTitle,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: SpacingTokens.sm),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: SecondaryButton(
                        label:
                            state.isPlayingBack &&
                                state.playingPromptId == currentPrompt.promptId
                            ? 'Pause Playback'
                            : 'Play Back Clip',
                        onPressed: () =>
                            notifier.togglePlayback(currentPrompt.promptId),
                      ),
                    ),
                    if (!state.isExamMode) ...<Widget>[
                      const SizedBox(width: SpacingTokens.sm),
                      Expanded(
                        child: SecondaryButton(
                          label: 'Re-record Turn',
                          onPressed: notifier.startSpeaking,
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: SpacingTokens.md),
        ] else ...<Widget>[
          // Live Pre-Flight Microphone Waveform Test (progressive disclosure)
          MicPreflightCard(
            title: 'Live Microphone Check',
            micButtonLabel: !state.hasMicPermission
                ? 'Allow Mic'
                : (state.isPreviewingMic ? 'Pause Check' : 'Test Mic'),
            micButtonGlyph: !state.hasMicPermission
                ? LucideGlyph.micOff
                : (state.isPreviewingMic ? LucideGlyph.pause : LucideGlyph.mic),
            onTapMicCheck: state.hasMicPermission
                ? (state.isPreviewingMic
                      ? notifier.stopMicPreview
                      : notifier.startMicPreview)
                : notifier.retryMicPermission,
            showLiveMeter: state.isPreviewingMic || !state.hasMicPermission,
            normalizedLevel: state.amplitude,
            isPreviewing: state.isPreviewingMic,
            hasPermission: state.hasMicPermission,
            isClipping: state.isClipping,
            isSilent: state.isSilent,
            statusFooter: !state.hasMicPermission
                ? LayoutBuilder(
                    builder: (ctx, constraints) {
                      if (constraints.maxWidth < 340) {
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: <Widget>[
                            SecondaryButton(
                              label: 'Retry Permission',
                              onPressed: notifier.retryMicPermission,
                            ),
                            const SizedBox(height: SpacingTokens.xs),
                            SecondaryButton(
                              label: 'Open Settings',
                              onPressed: notifier.openMicSettings,
                            ),
                          ],
                        );
                      }
                      return Row(
                        children: <Widget>[
                          Expanded(
                            child: SecondaryButton(
                              label: 'Retry Permission',
                              onPressed: notifier.retryMicPermission,
                            ),
                          ),
                          const SizedBox(width: SpacingTokens.sm),
                          Expanded(
                            child: SecondaryButton(
                              label: 'Open Settings',
                              onPressed: notifier.openMicSettings,
                            ),
                          ),
                        ],
                      );
                    },
                  )
                : null,
          ),
          const SizedBox(height: SpacingTokens.lg),
        ],
      ],
    );
  }
}

class _ActiveRecordingView extends StatelessWidget {
  const new({
    required this.state,
    required this.notesText,
  });

  final SpeakingSimState state;
  final String notesText;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    final minutes = state.remainingSeconds ~/ 60;
    final seconds = state.remainingSeconds % 60;
    final timeStr =
        '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: <Widget>[
          Container(
            width: 112,
            height: 112,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: colors.speakingAccent.withValues(alpha: 0.15),
              border: Border.all(color: colors.speakingAccent, width: 2),
            ),
            child: Center(
              child: AppIcon(
                LucideGlyph.mic,
                color: colors.speakingAccent,
                size: 44,
              ),
            ),
          ),
          const SizedBox(height: SpacingTokens.md),
          Text(
            timeStr,
            style: typography.heroScore.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            state.promptTitle,
            style: typography.cardTitle,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            'Recording in progress... speak clearly into the microphone',
            style: typography.secondary.copyWith(color: colors.textSecondary),
            textAlign: TextAlign.center,
          ),
          if (notesText.trim().isNotEmpty) ...<Widget>[
            const SizedBox(height: SpacingTokens.md),
            MzCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text('Your Prep Notes', style: typography.caption),
                  const SizedBox(height: SpacingTokens.xs),
                  Text(notesText, style: typography.secondary),
                ],
              ),
            ),
          ],
          const SizedBox(height: SpacingTokens.lg),
          AudioLevelMeter(
            normalizedLevel: state.amplitude,
            isRecording: true,
            hasPermission: state.hasMicPermission,
            isClipping: state.isClipping,
            isSilent: state.isSilent,
          ),
        ],
      ),
    );
  }
}

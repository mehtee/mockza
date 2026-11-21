import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/diagnostic/diagnostic_budget.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_help_sheet.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_notifier.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/diagnostic_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/audio_level_meter.dart';
import 'package:mockza/theme/components/collapsible_prompt_card.dart';
import 'package:mockza/theme/components/exam_question_controls.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/mz_sticky_bottom_bar.dart';
import 'package:mockza/theme/components/status_banner.dart';
import 'package:mockza/theme/primitives.dart';
import 'package:mockza/theme/responsive_layout.dart';

/// Active 4-skill rapid diagnostic workspace (`/diagnostic/session/:diagId`).
class DiagnosticSessionScreen extends ConsumerStatefulWidget {
  /// Creates a [DiagnosticSessionScreen].
  const new({
    required this.diagId,
    super.key,
  });

  /// Diagnostic session UUID from route parameter.
  final String diagId;

  @override
  ConsumerState<DiagnosticSessionScreen> createState() =>
      _DiagnosticSessionScreenState();
}

class _DiagnosticSessionScreenState
    extends ConsumerState<DiagnosticSessionScreen>
    with WidgetsBindingObserver {
  final TextEditingController _writingBaseController = TextEditingController();
  final TextEditingController _writingFollowUpController =
      TextEditingController();
  bool _navigatedToResults = false;
  int _focusedQuestionIndex = 0;
  bool _writingPromptCollapsed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(
      Future<void>.microtask(() async {
        if (!mounted) return;
        final notifier = ref.read(diagnosticNotifierProvider.notifier)
          ..onAutoSubmitted = _navigateToResults;
        await notifier.openOrResumeSession(widget.diagId);
        if (!mounted) return;
        final s = ref.read(diagnosticNotifierProvider);
        if (s.writingBaseText.isNotEmpty &&
            _writingBaseController.text.isEmpty) {
          _writingBaseController.text = s.writingBaseText;
        }
        if (s.writingFollowUpText.isNotEmpty &&
            _writingFollowUpController.text.isEmpty) {
          _writingFollowUpController.text = s.writingFollowUpText;
        }
      }),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden) {
      unawaited(
        ref.read(diagnosticNotifierProvider.notifier).flushPendingDraft(),
      );
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _writingBaseController.dispose();
    _writingFollowUpController.dispose();
    super.dispose();
  }

  void _navigateToResults(String diagId) {
    if (!mounted || _navigatedToResults) return;
    _navigatedToResults = true;
    context.go(AppRoutes.buildDiagnosticResults(diagId));
  }

  Future<void> _confirmExit() async {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shouldLeave = await showDialog<bool>(
      context: context,
      builder: (dlgCtx) => AlertDialog(
        title: const Text('Pause Starting Check?'),
        content: Text(
          'Your saved answers stay on this device, and you can finish or start again later from Home.',
          style: typography.body.copyWith(color: colors.textSecondary),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(dlgCtx).pop(false),
            child: const Text('Stay'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dlgCtx).pop(true),
            child: const Text('Leave to Home'),
          ),
        ],
      ),
    );
    if (!mounted || shouldLeave != true) return;
    await ref.read(diagnosticNotifierProvider.notifier).flushPendingDraft();
    if (!mounted) return;
    context.go(AppRoutes.home);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(diagnosticNotifierProvider);
    final notifier = ref.read(diagnosticNotifierProvider.notifier);

    ref.listen<DiagnosticState>(diagnosticNotifierProvider, (prev, next) {
      if (next.stage == DiagnosticFlowStage.results &&
          next.diagId.isNotEmpty &&
          !_navigatedToResults) {
        _navigateToResults(next.diagId);
      }
      if (prev?.activeBlock?.blockId != next.activeBlock?.blockId &&
          _focusedQuestionIndex != 0) {
        setState(() => _focusedQuestionIndex = 0);
      }
      if (prev?.stage != next.stage && _writingPromptCollapsed) {
        setState(() => _writingPromptCollapsed = false);
      }
      if (next.writingBaseText != _writingBaseController.text &&
          next.stage != DiagnosticFlowStage.writingBase) {
        _writingBaseController.text = next.writingBaseText;
      }
      if (next.writingFollowUpText != _writingFollowUpController.text &&
          next.stage != DiagnosticFlowStage.writingFollowUp) {
        _writingFollowUpController.text = next.writingFollowUpText;
      }
    });

    final bottomBar = _buildStickyBottomBar(context, state, notifier);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          unawaited(_confirmExit());
        }
      },
      child: MzScaffold(
        appBar: AppBar(
          toolbarHeight: 48,
          leading: IconButton(
            tooltip: 'Exit check',
            onPressed: _confirmExit,
            icon: const AppIcon(LucideGlyph.x, size: 22),
          ),
          title: Text(
            state.retakeSkill != null
                ? 'Retake ${_skillTitle(state.retakeSkill!)}'
                : 'Quick Starting Check',
          ),
          actions: <Widget>[
            IconButton(
              tooltip: 'Help',
              onPressed: () {
                unawaited(
                  showDiagnosticHelpSheet(
                    context,
                    isTimedSession: state.isTimed,
                    isActiveSession: true,
                    onSwitchToExtendedHelp: notifier.switchToExtendedHelpMode,
                  ),
                );
              },
              icon: const AppIcon(LucideGlyph.info, size: 22),
            ),
          ],
        ),
        bottomBar: bottomBar,
        body: Column(
          children: <Widget>[
            _CompactProgressHeader(state: state),
            Expanded(
              child: SingleChildScrollView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsetsDirectional.symmetric(
                  vertical: SpacingTokens.sm,
                ),
                child: _buildStageContent(context, state, notifier),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget? _buildStickyBottomBar(
    BuildContext context,
    DiagnosticState state,
    DiagnosticNotifier notifier,
  ) {
    final bank = state.bank;
    if (state.isLoadingBank || bank == null) return null;

    switch (state.stage) {
      case DiagnosticFlowStage.intro:
        return MzStickyBottomBar(
          child: PrimaryButton(
            label: 'Begin Reading Check',
            onPressed: notifier.startLiveReadingBlocks,
          ),
        );

      case DiagnosticFlowStage.readingExample:
        return MzStickyBottomBar(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              PrimaryButton(
                label: 'Start Reading',
                trailingGlyph: LucideGlyph.arrowRight,
                onPressed: notifier.startLiveReadingBlocks,
              ),
              Align(
                child: TextButton(
                  onPressed: notifier.skipObjectiveStage,
                  child: const Text('Skip Reading'),
                ),
              ),
            ],
          ),
        );

      case DiagnosticFlowStage.listeningExample:
        return MzStickyBottomBar(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              PrimaryButton(
                label: 'Start Listening',
                trailingGlyph: LucideGlyph.arrowRight,
                onPressed: notifier.startLiveListeningBlocks,
              ),
              Align(
                child: TextButton(
                  onPressed: notifier.skipObjectiveStage,
                  child: const Text('Skip Listening'),
                ),
              ),
            ],
          ),
        );

      case DiagnosticFlowStage.readingBlock:
      case DiagnosticFlowStage.listeningBlock:
        if (state.activeBlock == null) return null;
        final isListening = state.stage == DiagnosticFlowStage.listeningBlock;
        final bothSelected =
            state.selectedOptionQ0 != null && state.selectedOptionQ1 != null;
        return MzStickyBottomBar(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              PrimaryButton(
                label: 'Next',
                trailingGlyph: LucideGlyph.arrowRight,
                onPressed: bothSelected
                    ? notifier.submitCurrentObjectiveBlock
                    : null,
              ),
              const SizedBox(height: SpacingTokens.xs),
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: SpacingTokens.sm,
                children: <Widget>[
                  TextButton(
                    onPressed: notifier.markCurrentBlockDontKnow,
                    child: const Text("I don't know"),
                  ),
                  TextButton(
                    onPressed: notifier.skipObjectiveStage,
                    child: Text(
                      isListening ? 'Skip Listening' : 'Skip Reading',
                    ),
                  ),
                ],
              ),
            ],
          ),
        );

      case DiagnosticFlowStage.transitionToListening:
      case DiagnosticFlowStage.transitionToWriting:
      case DiagnosticFlowStage.transitionToSpeaking:
        return MzStickyBottomBar(
          child: PrimaryButton(
            label: 'Continue now',
            trailingGlyph: LucideGlyph.arrowRight,
            onPressed: notifier.skipTransitionNow,
          ),
        );

      case DiagnosticFlowStage.writingBase:
        return MzStickyBottomBar(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              PrimaryButton(
                label: 'Continue',
                trailingGlyph: LucideGlyph.arrowRight,
                onPressed: () => unawaited(notifier.completeWritingBase()),
              ),
              const SizedBox(height: SpacingTokens.xs),
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: SpacingTokens.sm,
                children: <Widget>[
                  TextButton(
                    onPressed: () => unawaited(
                      notifier.completeWritingBase(
                        forceSupportiveHelper: true,
                      ),
                    ),
                    child: const Text('Simpler prompt'),
                  ),
                  TextButton(
                    onPressed: () =>
                        unawaited(notifier.completeWritingStage(skipped: true)),
                    child: const Text('Skip Writing'),
                  ),
                ],
              ),
            ],
          ),
        );

      case DiagnosticFlowStage.writingFollowUp:
        return MzStickyBottomBar(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              PrimaryButton(
                label: 'Next skill',
                trailingGlyph: LucideGlyph.arrowRight,
                onPressed: () => unawaited(notifier.completeWritingStage()),
              ),
              Align(
                child: TextButton(
                  onPressed: () => unawaited(notifier.completeWritingStage()),
                  child: const Text('Finish Writing now'),
                ),
              ),
            ],
          ),
        );

      case DiagnosticFlowStage.speakingPrep:
        return MzStickyBottomBar(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              PrimaryButton(
                label: 'Start speaking now',
                glyph: LucideGlyph.mic,
                onPressed: () => unawaited(notifier.startSpeakingRecording()),
              ),
              Align(
                child: TextButton(
                  onPressed: () => unawaited(notifier.skipSpeakingAndSubmit()),
                  child: const Text('Skip Speaking'),
                ),
              ),
            ],
          ),
        );

      case DiagnosticFlowStage.speakingRecording:
      case DiagnosticFlowStage.speakingFollowUp:
        if (state.isUploadingSpeaking) return null;
        final isFollowUp = state.stage == DiagnosticFlowStage.speakingFollowUp;
        if (state.isSpeakingRecording) {
          return MzStickyBottomBar(
            child: PrimaryButton(
              label: 'Done speaking',
              glyph: LucideGlyph.check,
              onPressed: () => unawaited(
                notifier.stopSpeakingRecordingAndUpload(
                  partIndex: isFollowUp ? 2 : 1,
                  autoSubmitAfter: isFollowUp,
                ),
              ),
            ),
          );
        }
        if (isFollowUp) {
          return MzStickyBottomBar(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                PrimaryButton(
                  label:
                      'Record follow-up (up to ${DiagnosticBudget.speakingFollowUpMaxSeconds}s)',
                  glyph: LucideGlyph.mic,
                  onPressed: () =>
                      unawaited(notifier.startSpeakingRecording(partIndex: 2)),
                ),
                const SizedBox(height: SpacingTokens.xs),
                SecondaryButton(
                  label: 'Finish & See Results',
                  onPressed: () => unawaited(notifier.submitAllAndGoResults()),
                ),
              ],
            ),
          );
        }
        return MzStickyBottomBar(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              PrimaryButton(
                label: 'Start speaking',
                glyph: LucideGlyph.mic,
                onPressed: () => unawaited(notifier.startSpeakingRecording()),
              ),
              Align(
                child: TextButton(
                  onPressed: () => unawaited(
                    notifier.skipSpeakingAndSubmit(
                      reason:
                          state.speakingNoEvidenceReason ??
                          NoEvidenceReason.skipped,
                    ),
                  ),
                  child: const Text('Finish without Speaking'),
                ),
              ),
            ],
          ),
        );

      case DiagnosticFlowStage.submitting:
      case DiagnosticFlowStage.results:
        return null;
    }
  }

  Widget _buildStageContent(
    BuildContext context,
    DiagnosticState state,
    DiagnosticNotifier notifier,
  ) {
    final bank = state.bank;
    if (state.isLoadingBank || bank == null) {
      if (state.bankLoadError != null) {
        return StatusBanner(
          message: state.bankLoadError!,
          variant: StatusBannerVariant.error,
          actionLabel: 'Retry',
          onTapAction: notifier.retryLoadBank,
        );
      }
      return const Padding(
        padding: EdgeInsetsDirectional.all(SpacingTokens.xxl),
        child: Center(child: CircularProgressIndicator()),
      );
    }

    switch (state.stage) {
      case DiagnosticFlowStage.intro:
        return const SizedBox.shrink();
      case DiagnosticFlowStage.readingExample:
        return _WorkedExampleView(
          skillLabel: 'Reading',
          example: bank.workedReading,
          selectedOption: state.workedExampleOption,
          revealed: state.workedExampleRevealed,
          isAudioPlaying: false,
          onPlayAudio: null,
          onSelectOption: notifier.selectWorkedExampleOption,
        );
      case DiagnosticFlowStage.readingBlock:
        return _ObjectiveBlockView(
          isListening: false,
          state: state,
          notifier: notifier,
          focusedQuestionIndex: _focusedQuestionIndex,
          onSelectFocusedQuestion: (idx) =>
              setState(() => _focusedQuestionIndex = idx),
        );
      case DiagnosticFlowStage.transitionToListening:
        return const _TransitionView(
          glyph: LucideGlyph.headphones,
          title: 'Next: Short Listening',
          description: 'You will hear 2 or 3 short clips. Each clip plays once in standard mode.',
        );
      case DiagnosticFlowStage.listeningExample:
        return _WorkedExampleView(
          skillLabel: 'Listening',
          example: bank.workedListening,
          selectedOption: state.workedExampleOption,
          revealed: state.workedExampleRevealed,
          isAudioPlaying: state.isAudioPlaying,
          onPlayAudio: notifier.playWorkedListeningExample,
          onSelectOption: notifier.selectWorkedExampleOption,
        );
      case DiagnosticFlowStage.listeningBlock:
        return _ObjectiveBlockView(
          isListening: true,
          state: state,
          notifier: notifier,
          focusedQuestionIndex: _focusedQuestionIndex,
          onSelectFocusedQuestion: (idx) =>
              setState(() => _focusedQuestionIndex = idx),
        );
      case DiagnosticFlowStage.transitionToWriting:
        return const _TransitionView(
          glyph: LucideGlyph.pencil,
          title: 'Next: Short Writing',
          description:
              'Write a short response (~35–55 words) in your own words.',
        );
      case DiagnosticFlowStage.writingBase:
        return _WritingStageView(
          title: bank.writingPrompt.title,
          promptText: bank.writingPrompt.basePrompt,
          guidanceLabel: bank.writingPrompt.suggestedWordsLabel,
          controller: _writingBaseController,
          isFollowUp: false,
          isPromptCollapsed: _writingPromptCollapsed,
          onTogglePromptCollapsed: () => setState(
            () => _writingPromptCollapsed = !_writingPromptCollapsed,
          ),
          onChanged: notifier.updateWritingBaseText,
        );
      case DiagnosticFlowStage.writingFollowUp:
        return _WritingStageView(
          title: 'Quick Writing Follow-up',
          promptText:
              state.writingFollowUpPrompt ??
              bank.writingPrompt.supportiveFollowUp,
          guidanceLabel: 'Suggested: 15–30 words (optional extra sentence)',
          controller: _writingFollowUpController,
          isFollowUp: true,
          isPromptCollapsed: _writingPromptCollapsed,
          onTogglePromptCollapsed: () => setState(
            () => _writingPromptCollapsed = !_writingPromptCollapsed,
          ),
          onChanged: notifier.updateWritingFollowUpText,
        );
      case DiagnosticFlowStage.transitionToSpeaking:
        return const _TransitionView(
          glyph: LucideGlyph.mic,
          title: 'Final Step: Short Speaking',
          description:
              '${DiagnosticBudget.speakingPrepMaxSeconds}s to think, then up to ${DiagnosticBudget.speakingMainMaxSeconds}s speaking naturally.',
        );
      case DiagnosticFlowStage.speakingPrep:
      case DiagnosticFlowStage.speakingRecording:
      case DiagnosticFlowStage.speakingFollowUp:
        return _SpeakingStageView(
          prompt: bank.speakingPrompt,
          state: state,
        );
      case DiagnosticFlowStage.submitting:
      case DiagnosticFlowStage.results:
        return _SubmittingView(state: state, notifier: notifier);
    }
  }

  String _skillTitle(String skill) => switch (skill) {
    'reading' => 'Reading',
    'listening' => 'Listening',
    'writing' => 'Writing',
    'speaking' => 'Speaking',
    _ => 'Skill',
  };
}

class _CompactProgressHeader extends StatelessWidget {
  const new({required this.state});

  final DiagnosticState state;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final activeIdx = switch (state.stage) {
      DiagnosticFlowStage.intro ||
      DiagnosticFlowStage.readingExample ||
      DiagnosticFlowStage.readingBlock => 0,
      DiagnosticFlowStage.transitionToListening ||
      DiagnosticFlowStage.listeningExample ||
      DiagnosticFlowStage.listeningBlock => 1,
      DiagnosticFlowStage.transitionToWriting ||
      DiagnosticFlowStage.writingBase ||
      DiagnosticFlowStage.writingFollowUp => 2,
      DiagnosticFlowStage.transitionToSpeaking ||
      DiagnosticFlowStage.speakingPrep ||
      DiagnosticFlowStage.speakingRecording ||
      DiagnosticFlowStage.speakingFollowUp ||
      DiagnosticFlowStage.submitting ||
      DiagnosticFlowStage.results => 3,
    };

    const labels = <String>['Reading', 'Listening', 'Writing', 'Speaking'];
    final activeLabel = state.retakeSkill != null
        ? 'Single-Skill Retake'
        : '${activeIdx + 1}/4 ${labels[activeIdx]}';

    final String timerLabel;
    final Color timerColor;
    if (!state.isTimed) {
      timerLabel = 'Untimed';
      timerColor = colors.success;
    } else if (state.isUnscoredStage) {
      timerLabel = 'Unscored';
      timerColor = colors.textSecondary;
    } else if (state.stage == DiagnosticFlowStage.listeningBlock &&
        (state.isAudioLoading || state.isAudioPlaying)) {
      timerLabel = 'Audio playing';
      timerColor = colors.listeningAccent;
    } else if (state.stage == DiagnosticFlowStage.speakingFollowUp &&
        !state.isSpeakingRecording) {
      timerLabel = 'Ready';
      timerColor = colors.textSecondary;
    } else {
      timerLabel = _formatClock(state.stageRemainingSeconds);
      timerColor = state.stageRemainingSeconds <= 20
          ? colors.error
          : colors.textPrimary;
    }

    return Padding(
      padding: const EdgeInsetsDirectional.only(
        top: SpacingTokens.xs,
        bottom: SpacingTokens.xs,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (state.retakeSkill == null)
            Row(
              children: <Widget>[
                for (var i = 0; i < 4; i += 1) ...<Widget>[
                  Expanded(
                    child: Container(
                      height: 4,
                      decoration: BoxDecoration(
                        color: i < activeIdx
                            ? colors.success
                            : (i == activeIdx ? colors.primary : colors.track),
                        borderRadius: shapes.pillRadius,
                      ),
                    ),
                  ),
                  if (i < 3) const SizedBox(width: SpacingTokens.xs),
                ],
              ],
            ),
          const SizedBox(height: SpacingTokens.xs),
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  activeLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: typography.secondary.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: SpacingTokens.sm,
                  vertical: SpacingTokens.xs,
                ),
                decoration: BoxDecoration(
                  color: colors.surfaceAlt,
                  borderRadius: shapes.pillRadius,
                  border: Border.all(
                    color:
                        state.isTimed &&
                            state.stageRemainingSeconds <= 20 &&
                            !state.isTimerPaused
                        ? colors.error
                        : colors.borderSubtle,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    AppIcon(
                      LucideGlyph.timer,
                      size: 14,
                      color: timerColor,
                    ),
                    const SizedBox(width: SpacingTokens.xs),
                    Text(
                      timerLabel,
                      style: typography.caption.copyWith(
                        color: timerColor,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatClock(int totalSec) {
    final m = (totalSec ~/ 60).toString().padLeft(2, '0');
    final s = (totalSec % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }
}

class _WorkedExampleView extends StatelessWidget {
  const new({
    required this.skillLabel,
    required this.example,
    required this.selectedOption,
    required this.revealed,
    required this.isAudioPlaying,
    required this.onPlayAudio,
    required this.onSelectOption,
  });

  final String skillLabel;
  final DiagnosticWorkedExampleSnapshot example;
  final int? selectedOption;
  final bool revealed;
  final bool isAudioPlaying;
  final VoidCallback? onPlayAudio;
  final ValueChanged<int> onSelectOption;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        const Align(
          alignment: AlignmentDirectional.centerStart,
          child: MzChip(
            label: 'Example — does not affect your level',
            glyph: LucideGlyph.info,
          ),
        ),
        const SizedBox(height: SpacingTokens.sm),
        MzCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text('Sample $skillLabel', style: typography.cardTitle),
              const SizedBox(height: SpacingTokens.xs),
              if (onPlayAudio != null) ...<Widget>[
                SecondaryButton(
                  label: isAudioPlaying
                      ? 'Playing sample...'
                      : 'Play sample clip',
                  onPressed: isAudioPlaying ? null : onPlayAudio,
                ),
                const SizedBox(height: SpacingTokens.xs),
              ],
              Text(
                example.passageOrTranscript,
                style: typography.secondary.copyWith(
                  color: colors.textPrimary,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: SpacingTokens.sm),
        MzCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(example.questionPrompt, style: typography.cardTitle),
              const SizedBox(height: SpacingTokens.sm),
              for (var i = 0; i < example.options.length; i += 1) ...<Widget>[
                MzChoiceOptionTile(
                  text: example.options[i],
                  isSelected: selectedOption == i,
                  leadingStyle: MzOptionLeadingStyle.checkChevron,
                  onTap: () => onSelectOption(i),
                ),
                if (i < example.options.length - 1)
                  const SizedBox(height: SpacingTokens.xs),
              ],
              if (revealed) ...<Widget>[
                const SizedBox(height: SpacingTokens.sm),
                StatusBanner(
                  message: example.explanation,
                  variant: selectedOption == example.correctIndex
                      ? StatusBannerVariant.success
                      : StatusBannerVariant.warning,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _ObjectiveBlockView extends StatelessWidget {
  const new({
    required this.isListening,
    required this.state,
    required this.notifier,
    required this.focusedQuestionIndex,
    required this.onSelectFocusedQuestion,
  });

  final bool isListening;
  final DiagnosticState state;
  final DiagnosticNotifier notifier;
  final int focusedQuestionIndex;
  final ValueChanged<int> onSelectFocusedQuestion;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final block = state.activeBlock;
    final isCompact = MzResponsive.isCompactOf(context);

    if (block == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final canPlayAudio =
        state.audioPlayCount == 0 ||
        state.mode == DiagnosticMode.accessible ||
        state.audioFailed;

    final clampedFocus = focusedQuestionIndex.clamp(
      0,
      block.questions.length - 1,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: Text(
                block.title,
                style: typography.cardTitle.copyWith(
                  fontWeight: FontWeight.w700,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: SpacingTokens.sm),
            MzChip(
              label:
                  'Part ${state.currentBlockNumber}/${state.currentBlockLimit}',
            ),
          ],
        ),
        const SizedBox(height: SpacingTokens.sm),

        if (!isListening && block.passageText != null)
          LtrExamBoundary(
            child: MzCard(
              child: SelectableText(
                block.passageText!,
                style: typography.body.copyWith(
                  color: colors.textPrimary,
                  height: 1.5,
                ),
              ),
            ),
          ),

        if (isListening)
          MzCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    const IconWell(
                      glyph: LucideGlyph.headphones,
                      tint: IconWellTint.blue,
                      size: 32,
                      iconSize: 16,
                    ),
                    const SizedBox(width: SpacingTokens.sm),
                    Expanded(
                      child: Text(
                        state.mode == DiagnosticMode.accessible
                            ? 'Audio Clip (Replay available)'
                            : 'Audio Clip (Plays once)',
                        style: typography.secondary.copyWith(
                          color: colors.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: SpacingTokens.sm),
                PrimaryButton(
                  label: state.isAudioLoading
                      ? 'Loading audio...'
                      : (state.isAudioPlaying
                            ? 'Playing clip...'
                            : (state.audioFailed
                                  ? 'Retry clip'
                                  : (state.audioPlayCount >= 1 && !canPlayAudio
                                        ? 'Clip played once'
                                        : (state.audioPlayCount >= 1
                                              ? 'Replay clip'
                                              : 'Play clip')))),
                  onPressed:
                      state.isAudioLoading ||
                          state.isAudioPlaying ||
                          !canPlayAudio
                      ? null
                      : () => unawaited(
                          notifier.playCurrentListeningBlockAudio(),
                        ),
                ),
                if (state.audioPlayCount == 0 &&
                    !state.isAudioLoading &&
                    !state.isAudioPlaying &&
                    !state.audioFailed) ...<Widget>[
                  const SizedBox(height: SpacingTokens.xs),
                  Text(
                    'Tap Play clip if your browser paused auto-play.',
                    style: typography.caption.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
                if (state.audioFailed &&
                    state.audioErrorMessage != null) ...<Widget>[
                  const SizedBox(height: SpacingTokens.sm),
                  StatusBanner(
                    message: state.audioErrorMessage!,
                    variant: StatusBannerVariant.error,
                    actionLabel: 'Continue without Listening',
                    onTapAction: notifier.abandonListeningDueToPlaybackFailure,
                  ),
                ],
                if (state.mode == DiagnosticMode.accessible &&
                    state.audioCompleted &&
                    block.scriptText != null) ...<Widget>[
                  const SizedBox(height: SpacingTokens.xs),
                  TextButton(
                    onPressed: notifier.toggleAccessibleTranscript,
                    child: Text(
                      state.showAccessibleTranscript
                          ? 'Hide transcript'
                          : 'Show transcript',
                    ),
                  ),
                  if (state.showAccessibleTranscript)
                    Padding(
                      padding: const EdgeInsetsDirectional.only(
                        top: SpacingTokens.xs,
                      ),
                      child: Text(
                        block.scriptText!,
                        style: typography.secondary.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ),
                ],
              ],
            ),
          ),

        const SizedBox(height: SpacingTokens.sm),

        if (isCompact && block.questions.length == 2) ...<Widget>[
          Row(
            children: <Widget>[
              for (var i = 0; i < 2; i += 1) ...<Widget>[
                Expanded(
                  child: MzQuestionStepPill(
                    label: 'Question ${i + 1}',
                    isSelected: clampedFocus == i,
                    isAnswered: i == 0
                        ? state.selectedOptionQ0 != null
                        : state.selectedOptionQ1 != null,
                    onTap: () => onSelectFocusedQuestion(i),
                  ),
                ),
                if (i == 0) const SizedBox(width: SpacingTokens.sm),
              ],
            ],
          ),
          const SizedBox(height: SpacingTokens.sm),
          _QuestionCard(
            questionIndex: clampedFocus,
            question: block.questions[clampedFocus],
            selectedIndex: clampedFocus == 0
                ? state.selectedOptionQ0
                : state.selectedOptionQ1,
            onSelect: (optIdx) {
              notifier.selectBlockOption(
                questionIndex: clampedFocus,
                optionIndex: optIdx,
              );
              if (clampedFocus == 0 && state.selectedOptionQ1 == null) {
                onSelectFocusedQuestion(1);
              }
            },
          ),
        ] else ...<Widget>[
          for (
            var qIdx = 0;
            qIdx < block.questions.length;
            qIdx += 1
          ) ...<Widget>[
            _QuestionCard(
              questionIndex: qIdx,
              question: block.questions[qIdx],
              selectedIndex: qIdx == 0
                  ? state.selectedOptionQ0
                  : state.selectedOptionQ1,
              onSelect: (optIdx) => notifier.selectBlockOption(
                questionIndex: qIdx,
                optionIndex: optIdx,
              ),
            ),
            if (qIdx < block.questions.length - 1)
              const SizedBox(height: SpacingTokens.sm),
          ],
        ],
      ],
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const new({
    required this.questionIndex,
    required this.question,
    required this.selectedIndex,
    required this.onSelect,
  });

  final int questionIndex;
  final DiagnosticQuestionDef question;
  final int? selectedIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final typography = AppTypography.of(context);
    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            'Q${questionIndex + 1}. ${question.prompt}',
            style: typography.cardTitle,
          ),
          const SizedBox(height: SpacingTokens.sm),
          for (var i = 0; i < question.options.length; i += 1) ...<Widget>[
            MzChoiceOptionTile(
              text: question.options[i],
              isSelected: selectedIndex == i,
              leadingStyle: MzOptionLeadingStyle.checkChevron,
              onTap: () => onSelect(i),
            ),
            if (i < question.options.length - 1)
              const SizedBox(height: SpacingTokens.xs),
          ],
        ],
      ),
    );
  }
}

class _TransitionView extends StatelessWidget {
  const new({
    required this.glyph,
    required this.title,
    required this.description,
  });

  final LucideGlyph glyph;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      variant: MzCardVariant.hero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Center(
            child: IconWell(
              glyph: glyph,
              tint: IconWellTint.blue,
              size: 52,
              iconSize: 26,
            ),
          ),
          const SizedBox(height: SpacingTokens.md),
          Text(
            title,
            textAlign: TextAlign.center,
            style: typography.sectionHeading,
          ),
          const SizedBox(height: SpacingTokens.sm),
          Text(
            description,
            textAlign: TextAlign.center,
            style: typography.body.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _WritingStageView extends StatelessWidget {
  const new({
    required this.title,
    required this.promptText,
    required this.guidanceLabel,
    required this.controller,
    required this.isFollowUp,
    required this.isPromptCollapsed,
    required this.onTogglePromptCollapsed,
    required this.onChanged,
  });

  final String title;
  final String promptText;
  final String guidanceLabel;
  final TextEditingController controller;
  final bool isFollowUp;
  final bool isPromptCollapsed;
  final VoidCallback onTogglePromptCollapsed;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) {
        final wordCount = value.text
            .trim()
            .split(RegExp(r'\s+'))
            .where((w) => w.isNotEmpty)
            .length;
        return LtrExamBoundary(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              CollapsiblePromptCard(
                title: title,
                promptBody: promptText,
                isCollapsed: isPromptCollapsed,
                onToggleCollapsed: onTogglePromptCollapsed,
                hideLabel: 'Hide',
                footer: Wrap(
                  spacing: SpacingTokens.sm,
                  runSpacing: SpacingTokens.xs,
                  children: <Widget>[
                    MzChip(label: guidanceLabel),
                    MzChip(label: '$wordCount words'),
                  ],
                ),
              ),
              const SizedBox(height: SpacingTokens.sm),
              TextField(
                controller: controller,
                onChanged: onChanged,
                minLines: 6,
                maxLines: 10,
                textInputAction: TextInputAction.newline,
                decoration: InputDecoration(
                  hintText: isFollowUp
                      ? 'Add 1 or 2 short sentences here...'
                      : 'Write a short answer in your own words...',
                  filled: true,
                  fillColor: colors.surface,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SpeakingStageView extends StatelessWidget {
  const new({
    required this.prompt,
    required this.state,
  });

  final DiagnosticSpeakingPromptSpec prompt;
  final DiagnosticState state;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    final isFollowUp = state.stage == DiagnosticFlowStage.speakingFollowUp;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        MzCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                isFollowUp ? 'Quick Follow-up Question' : prompt.title,
                style: typography.cardTitle,
              ),
              const SizedBox(height: SpacingTokens.sm),
              Text(
                isFollowUp
                    ? (state.speakingFollowUpPrompt ?? prompt.extensionFollowUp)
                    : prompt.basePrompt,
                style: typography.body,
              ),
              if (!isFollowUp) ...<Widget>[
                const SizedBox(height: SpacingTokens.sm),
                Wrap(
                  spacing: SpacingTokens.xs,
                  runSpacing: SpacingTokens.xs,
                  children: <Widget>[
                    for (final cue in prompt.cueLabels) MzChip(label: cue),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: SpacingTokens.md),
        AudioLevelMeter(
          normalizedLevel: state.speakingAmplitude,
          isRecording: state.isSpeakingRecording,
          hasPermission:
              state.speakingNoEvidenceReason != NoEvidenceReason.micDenied,
        ),
        if (state.speakingStatusMessage != null) ...<Widget>[
          const SizedBox(height: SpacingTokens.sm),
          Text(
            state.speakingStatusMessage!,
            textAlign: TextAlign.center,
            style: typography.secondary.copyWith(color: colors.textSecondary),
          ),
        ],
        if (state.isUploadingSpeaking) ...<Widget>[
          const SizedBox(height: SpacingTokens.md),
          const Center(child: CircularProgressIndicator()),
        ],
      ],
    );
  }
}

class _SubmittingView extends StatelessWidget {
  const new({required this.state, required this.notifier});

  final DiagnosticState state;
  final DiagnosticNotifier notifier;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    if (state.submitError != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          StatusBanner(
            message: 'Could not submit diagnostic: ${state.submitError}',
            variant: StatusBannerVariant.error,
          ),
          const SizedBox(height: SpacingTokens.md),
          PrimaryButton(
            label: 'Retry submit',
            onPressed: () => unawaited(notifier.submitAllAndGoResults()),
          ),
          const SizedBox(height: SpacingTokens.sm),
          SecondaryButton(
            label: 'Back to Home',
            onPressed: () => context.go(AppRoutes.home),
          ),
        ],
      );
    }

    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(
        vertical: SpacingTokens.xxl,
      ),
      child: Column(
        children: <Widget>[
          const CircularProgressIndicator(),
          const SizedBox(height: SpacingTokens.md),
          Text('Saving your responses...', style: typography.cardTitle),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            'Preparing your 4-skill starting check results.',
            style: typography.secondary.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}

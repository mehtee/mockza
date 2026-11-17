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
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/status_banner.dart';
import 'package:mockza/theme/components/timer_bar.dart';
import 'package:mockza/theme/primitives.dart';

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
      if (next.writingBaseText != _writingBaseController.text &&
          next.stage != DiagnosticFlowStage.writingBase) {
        _writingBaseController.text = next.writingBaseText;
      }
      if (next.writingFollowUpText != _writingFollowUpController.text &&
          next.stage != DiagnosticFlowStage.writingFollowUp) {
        _writingFollowUpController.text = next.writingFollowUpText;
      }
    });

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          unawaited(_confirmExit());
        }
      },
      child: MzScaffold(
        appBar: AppBar(
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
        body: SafeArea(
          child: Column(
            children: <Widget>[
              _HeaderProgressStrip(state: state),
              Expanded(
                child: SingleChildScrollView(
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsetsDirectional.fromSTEB(
                    SpacingTokens.lg,
                    SpacingTokens.sm,
                    SpacingTokens.lg,
                    SpacingTokens.xxl,
                  ),
                  child: _buildStageContent(context, state, notifier),
                ),
              ),
            ],
          ),
        ),
      ),
    );
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
        return PrimaryButton(
          label: 'Begin Reading Check',
          onPressed: notifier.startLiveReadingBlocks,
        );
      case DiagnosticFlowStage.readingExample:
        return _WorkedExampleView(
          skillLabel: 'Reading',
          example: bank.workedReading,
          selectedOption: state.workedExampleOption,
          revealed: state.workedExampleRevealed,
          isAudioPlaying: false,
          onPlayAudio: null,
          onSelectOption: notifier.selectWorkedExampleOption,
          onStartSkill: notifier.startLiveReadingBlocks,
          onSkipSkill: notifier.skipObjectiveStage,
        );
      case DiagnosticFlowStage.readingBlock:
        return _ObjectiveBlockView(
          isListening: false,
          state: state,
          notifier: notifier,
        );
      case DiagnosticFlowStage.transitionToListening:
        return _TransitionView(
          glyph: LucideGlyph.headphones,
          title: 'Next: Short Listening',
          description: 'You will hear 2 or 3 everyday clips. Each clip plays once in standard mode.',
          onContinue: notifier.skipTransitionNow,
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
          onStartSkill: notifier.startLiveListeningBlocks,
          onSkipSkill: notifier.skipObjectiveStage,
        );
      case DiagnosticFlowStage.listeningBlock:
        return _ObjectiveBlockView(
          isListening: true,
          state: state,
          notifier: notifier,
        );
      case DiagnosticFlowStage.transitionToWriting:
        return _TransitionView(
          glyph: LucideGlyph.pencil,
          title: 'Next: Short Writing',
          description: 'Write a short everyday response (~35–55 words) in your own words.',
          onContinue: notifier.skipTransitionNow,
        );
      case DiagnosticFlowStage.writingBase:
        return _WritingStageView(
          title: bank.writingPrompt.title,
          promptText: bank.writingPrompt.basePrompt,
          guidanceLabel: bank.writingPrompt.suggestedWordsLabel,
          controller: _writingBaseController,
          isFollowUp: false,
          onChanged: notifier.updateWritingBaseText,
          onSubmit: () => unawaited(notifier.completeWritingBase()),
          onNeedStarter: () => unawaited(
            notifier.completeWritingBase(forceSupportiveHelper: true),
          ),
          onSkip: () => unawaited(notifier.completeWritingStage(skipped: true)),
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
          onChanged: notifier.updateWritingFollowUpText,
          onSubmit: () => unawaited(notifier.completeWritingStage()),
          onNeedStarter: null,
          onSkip: () => unawaited(notifier.completeWritingStage()),
        );
      case DiagnosticFlowStage.transitionToSpeaking:
        return _TransitionView(
          glyph: LucideGlyph.mic,
          title: 'Final Step: Short Speaking',
          description:
              '15 seconds to think, then up to 45 seconds speaking naturally.',
          onContinue: notifier.skipTransitionNow,
        );
      case DiagnosticFlowStage.speakingPrep:
      case DiagnosticFlowStage.speakingRecording:
      case DiagnosticFlowStage.speakingFollowUp:
        return _SpeakingStageView(
          prompt: bank.speakingPrompt,
          state: state,
          notifier: notifier,
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

class _HeaderProgressStrip extends StatelessWidget {
  const new({required this.state});

  final DiagnosticState state;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
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

    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(
        SpacingTokens.lg,
        SpacingTokens.xs,
        SpacingTokens.lg,
        SpacingTokens.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (state.retakeSkill == null)
            Wrap(
              spacing: SpacingTokens.xs,
              runSpacing: SpacingTokens.xs,
              children: <Widget>[
                for (var i = 0; i < labels.length; i += 1)
                  MzChip(
                    label: '${i + 1}. ${labels[i]}',
                    variant: i == activeIdx
                        ? MzChipVariant.target
                        : (i < activeIdx
                              ? MzChipVariant.positive
                              : MzChipVariant.neutral),
                  ),
              ],
            ),
          const SizedBox(height: SpacingTokens.sm),
          if (state.isTimed) ...<Widget>[
            TimerBar(
              remainingSeconds: state.stageRemainingSeconds,
              totalSeconds: _totalForStage(state.stage),
              phase: state.stage == DiagnosticFlowStage.speakingPrep
                  ? TimerPhase.prep
                  : TimerPhase.response,
            ),
            const SizedBox(height: SpacingTokens.xs),
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: Text(
                'Check total left: ${_formatClock(state.globalRemainingSeconds)}',
                style: typography.caption.copyWith(color: colors.textSecondary),
              ),
            ),
          ] else
            const StatusBanner(
              message: 'Extended Help (Untimed) — work at your own pace.',
              variant: StatusBannerVariant.offline,
            ),
        ],
      ),
    );
  }

  int _totalForStage(DiagnosticFlowStage stage) => switch (stage) {
    DiagnosticFlowStage.readingExample ||
    DiagnosticFlowStage.readingBlock => DiagnosticBudget.readingMaxSeconds,
    DiagnosticFlowStage.listeningExample ||
    DiagnosticFlowStage.listeningBlock => DiagnosticBudget.listeningMaxSeconds,
    DiagnosticFlowStage.writingBase ||
    DiagnosticFlowStage.writingFollowUp => DiagnosticBudget.writingMaxSeconds,
    DiagnosticFlowStage.speakingPrep => 15,
    DiagnosticFlowStage.speakingRecording => 45,
    DiagnosticFlowStage.speakingFollowUp => 25,
    _ => DiagnosticBudget.collectionTotalSeconds,
  };

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
    required this.onStartSkill,
    required this.onSkipSkill,
  });

  final String skillLabel;
  final DiagnosticWorkedExampleSnapshot example;
  final int? selectedOption;
  final bool revealed;
  final bool isAudioPlaying;
  final VoidCallback? onPlayAudio;
  final ValueChanged<int> onSelectOption;
  final VoidCallback onStartSkill;
  final VoidCallback onSkipSkill;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        const MzChip(
          label: 'Example — does not affect your level',
          glyph: LucideGlyph.info,
        ),
        const SizedBox(height: SpacingTokens.md),
        MzCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                'Sample $skillLabel',
                style: typography.cardTitle,
              ),
              const SizedBox(height: SpacingTokens.sm),
              if (onPlayAudio != null) ...<Widget>[
                SecondaryButton(
                  label: isAudioPlaying
                      ? 'Playing sample...'
                      : 'Play sample clip',
                  onPressed: isAudioPlaying ? null : onPlayAudio,
                ),
                const SizedBox(height: SpacingTokens.sm),
              ],
              Text(
                example.passageOrTranscript,
                style: typography.body.copyWith(color: colors.textPrimary),
              ),
            ],
          ),
        ),
        const SizedBox(height: SpacingTokens.md),
        MzCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(example.questionPrompt, style: typography.cardTitle),
              const SizedBox(height: SpacingTokens.sm),
              for (var i = 0; i < example.options.length; i += 1) ...<Widget>[
                _OptionButton(
                  label: example.options[i],
                  isSelected: selectedOption == i,
                  onTap: () => onSelectOption(i),
                ),
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
        const SizedBox(height: SpacingTokens.lg),
        PrimaryButton(
          label: 'Start $skillLabel',
          onPressed: onStartSkill,
        ),
        const SizedBox(height: SpacingTokens.sm),
        TextButton(
          onPressed: onSkipSkill,
          child: Text('Skip $skillLabel'),
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
  });

  final bool isListening;
  final DiagnosticState state;
  final DiagnosticNotifier notifier;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final block = state.activeBlock;

    if (block == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final bothSelected =
        state.selectedOptionQ0 != null && state.selectedOptionQ1 != null;
    final canPlayAudio =
        state.audioPlayCount == 0 ||
        state.mode == DiagnosticMode.accessible ||
        state.audioFailed;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: Text(
                block.title,
                style: typography.sectionHeading,
              ),
            ),
            MzChip(
              label:
                  'Part ${state.currentBlockNumber} of up to ${state.currentBlockLimit}',
            ),
          ],
        ),
        const SizedBox(height: SpacingTokens.md),

        if (!isListening && block.passageText != null)
          MzCard(
            child: SelectableText(
              block.passageText!,
              style: typography.body.copyWith(color: colors.textPrimary),
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
                      size: 36,
                      iconSize: 18,
                    ),
                    const SizedBox(width: SpacingTokens.sm),
                    Expanded(
                      child: Text(
                        state.mode == DiagnosticMode.accessible
                            ? 'Audio Clip (Replay available)'
                            : 'Audio Clip (Plays once)',
                        style: typography.cardTitle,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: SpacingTokens.md),
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
                    'Audio plays automatically; tap Play clip if your browser paused playback.',
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
                  const SizedBox(height: SpacingTokens.sm),
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

        const SizedBox(height: SpacingTokens.md),

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
          const SizedBox(height: SpacingTokens.md),
        ],

        PrimaryButton(
          label: 'Next',
          onPressed: bothSelected ? notifier.submitCurrentObjectiveBlock : null,
        ),
        const SizedBox(height: SpacingTokens.sm),
        SecondaryButton(
          label: "I don't know",
          onPressed: notifier.markCurrentBlockDontKnow,
        ),
        const SizedBox(height: SpacingTokens.xs),
        Text(
          "Too hard? Tapping \"I don't know\" helps adjust without guessing.",
          textAlign: TextAlign.center,
          style: typography.caption.copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: SpacingTokens.sm),
        TextButton(
          onPressed: notifier.skipObjectiveStage,
          child: Text(isListening ? 'Skip Listening' : 'Skip Reading'),
        ),
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
            _OptionButton(
              label: question.options[i],
              isSelected: selectedIndex == i,
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

class _OptionButton extends StatelessWidget {
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
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 44),
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: SpacingTokens.md,
          vertical: SpacingTokens.sm,
        ),
        decoration: BoxDecoration(
          color: isSelected ? colors.blueBg : colors.surfaceAlt,
          borderRadius: shapes.controlRadius,
          border: Border.all(
            color: isSelected ? colors.primary : colors.borderSubtle,
            width: isSelected ? 1.5 : shapes.strokeWidth,
          ),
        ),
        child: Row(
          children: <Widget>[
            AppIcon(
              isSelected ? LucideGlyph.checkCircle2 : LucideGlyph.chevronRight,
              size: 16,
              color: isSelected ? colors.primary : colors.textTertiary,
            ),
            const SizedBox(width: SpacingTokens.sm),
            Expanded(
              child: Text(
                label,
                style: typography.body.copyWith(
                  color: colors.textPrimary,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TransitionView extends StatelessWidget {
  const new({
    required this.glyph,
    required this.title,
    required this.description,
    required this.onContinue,
  });

  final LucideGlyph glyph;
  final String title;
  final String description;
  final VoidCallback onContinue;

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
          const SizedBox(height: SpacingTokens.lg),
          PrimaryButton(
            label: 'Continue now',
            onPressed: onContinue,
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
    required this.onChanged,
    required this.onSubmit,
    required this.onNeedStarter,
    required this.onSkip,
  });

  final String title;
  final String promptText;
  final String guidanceLabel;
  final TextEditingController controller;
  final bool isFollowUp;
  final ValueChanged<String> onChanged;
  final VoidCallback onSubmit;
  final VoidCallback? onNeedStarter;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) {
        final wordCount = value.text
            .trim()
            .split(RegExp(r'\s+'))
            .where((w) => w.isNotEmpty)
            .length;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            MzCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(title, style: typography.cardTitle),
                  const SizedBox(height: SpacingTokens.sm),
                  Text(promptText, style: typography.body),
                  const SizedBox(height: SpacingTokens.sm),
                  Wrap(
                    spacing: SpacingTokens.sm,
                    runSpacing: SpacingTokens.xs,
                    children: <Widget>[
                      MzChip(label: guidanceLabel),
                      MzChip(label: '$wordCount words'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: SpacingTokens.md),
            TextField(
              controller: controller,
              onChanged: onChanged,
              minLines: 5,
              maxLines: 9,
              textInputAction: TextInputAction.newline,
              decoration: InputDecoration(
                hintText: isFollowUp
                    ? 'Add 1 or 2 short sentences here...'
                    : 'Write a short answer in your own words...',
                filled: true,
                fillColor: colors.surface,
              ),
            ),
            const SizedBox(height: SpacingTokens.lg),
            PrimaryButton(
              label: isFollowUp ? 'Next skill' : 'Continue',
              onPressed: onSubmit,
            ),
            if (!isFollowUp && onNeedStarter != null) ...<Widget>[
              const SizedBox(height: SpacingTokens.sm),
              SecondaryButton(
                label: 'Show a simpler follow-up question',
                onPressed: onNeedStarter,
              ),
            ],
            const SizedBox(height: SpacingTokens.sm),
            TextButton(
              onPressed: onSkip,
              child: Text(isFollowUp ? 'Finish Writing now' : 'Skip Writing'),
            ),
          ],
        );
      },
    );
  }
}

class _SpeakingStageView extends StatelessWidget {
  const new({
    required this.prompt,
    required this.state,
    required this.notifier,
  });

  final DiagnosticSpeakingPromptSpec prompt;
  final DiagnosticState state;
  final DiagnosticNotifier notifier;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    final isPrep = state.stage == DiagnosticFlowStage.speakingPrep;
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
        const SizedBox(height: SpacingTokens.lg),

        if (state.isUploadingSpeaking)
          const Center(child: CircularProgressIndicator())
        else if (isPrep) ...<Widget>[
          PrimaryButton(
            label: 'Start speaking now',
            onPressed: () => unawaited(notifier.startSpeakingRecording()),
          ),
          const SizedBox(height: SpacingTokens.sm),
          TextButton(
            onPressed: () => unawaited(notifier.skipSpeakingAndSubmit()),
            child: const Text('Skip Speaking'),
          ),
        ] else if (state.isSpeakingRecording) ...<Widget>[
          PrimaryButton(
            label: 'Done speaking',
            onPressed: () => unawaited(
              notifier.stopSpeakingRecordingAndUpload(
                partIndex: isFollowUp ? 2 : 1,
                autoSubmitAfter: isFollowUp,
              ),
            ),
          ),
        ] else if (isFollowUp) ...<Widget>[
          PrimaryButton(
            label: 'Record follow-up (up to 25s)',
            onPressed: () =>
                unawaited(notifier.startSpeakingRecording(partIndex: 2)),
          ),
          const SizedBox(height: SpacingTokens.sm),
          SecondaryButton(
            label: 'Finish & See Results',
            onPressed: () => unawaited(notifier.submitAllAndGoResults()),
          ),
        ] else ...<Widget>[
          PrimaryButton(
            label: 'Start speaking',
            onPressed: () => unawaited(notifier.startSpeakingRecording()),
          ),
          const SizedBox(height: SpacingTokens.sm),
          SecondaryButton(
            label: 'Finish without Speaking',
            onPressed: () => unawaited(
              notifier.skipSpeakingAndSubmit(
                reason:
                    state.speakingNoEvidenceReason ?? NoEvidenceReason.skipped,
              ),
            ),
          ),
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
          Text(
            'Saving your responses...',
            style: typography.cardTitle,
          ),
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

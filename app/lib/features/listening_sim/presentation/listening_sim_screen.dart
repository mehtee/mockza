import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/exams/question_progress_item.dart';
import 'package:mockza/features/listening_sim/presentation/listening_sim_notifier.dart';
import 'package:mockza/features/listening_sim/presentation/listening_sim_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/routing/safe_pop.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/audio_player_bar.dart';
import 'package:mockza/theme/components/exam_exit_guard.dart';
import 'package:mockza/theme/components/exam_question_controls.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/timer_bar.dart';
import 'package:mockza/theme/components/transcript_segment.dart';
import 'package:mockza/theme/primitives.dart';

/// Listening exam simulator screen playing SeaweedFS `.m4a` tracks via
/// `AudioPlayerGateway`, enforcing Exam Linear Lock vs Study Interactive
/// playback, synced transcript seek, and deterministic `LocalObjectiveScorer`
/// grading (Screens 10 & 11).
class ListeningSimScreen extends ConsumerStatefulWidget {
  /// Creates a [ListeningSimScreen].
  const new({
    this.packId = 'ielts-listening-seed-01',
    this.isExamMode = true,
    this.mockSessionId,
    this.mockStageKey,
    super.key,
  });

  /// Postgres Listening pack identifier.
  final String packId;

  /// Exam Mode (linear locked audio, no transcript) vs Study Mode.
  final bool isExamMode;

  /// Optional parent Full Mock session ID.
  final String? mockSessionId;

  /// Optional stage key within the Full Mock session.
  final String? mockStageKey;

  @override
  ConsumerState<ListeningSimScreen> createState() => _ListeningSimScreenState();
}

class _ListeningSimScreenState extends ConsumerState<ListeningSimScreen> {
  bool _focusedMode = true;
  int _focusedQuestionNumber = 1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(
        ref
            .read(listeningSimNotifierProvider.notifier)
            .initialize(
              widget.packId,
              isExamMode: widget.isExamMode,
              mockSessionId: widget.mockSessionId,
              mockStageKey: widget.mockStageKey,
            ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(listeningSimNotifierProvider);
    final notifier = ref.read(listeningSimNotifierProvider.notifier);
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    final sections = state.pack?.sections ?? const <ListeningSectionSpec>[];
    final activeSection = state.activeSection;

    return ExamExitGuard(
      dialogTitle: 'Exit Listening Test?',
      dialogMessage: 'Exit now? Unsubmitted answers will not be scored.',
      onConfirmedExit: () {
        if (context.mounted) {
          context.safePopOrGo(AppRoutes.home);
        }
      },
      child: MzScaffold(
        mode: MzScaffoldMode.immersive,
        centerOnWide: false,
        padding: EdgeInsetsDirectional.zero,
        body: Column(
          children: <Widget>[
            // Top Control Bar
            Padding(
              padding: const EdgeInsetsDirectional.only(
                top: SpacingTokens.md,
                start: SpacingTokens.md,
                end: SpacingTokens.md,
                bottom: SpacingTokens.xs,
              ),
              child: Row(
                children: <Widget>[
                  MzIconButton(
                    glyph: LucideGlyph.x,
                    semanticLabel: 'Exit listening test',
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                  const SizedBox(width: SpacingTokens.xs),
                  if (sections.isNotEmpty)
                    Expanded(
                      child: Align(
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: MzSegmentedPillStrip(
                            items: sections
                                .map(
                                  (sec) => (
                                    label: 'Sec ${sec.sectionIndex}',
                                    isSelected:
                                        state.sectionIndex == sec.sectionIndex,
                                    onTap: () => notifier.selectSection(
                                      sec.sectionIndex,
                                    ),
                                  ),
                                )
                                .toList(growable: false),
                          ),
                        ),
                      ),
                    )
                  else
                    const Spacer(),
                  const SizedBox(width: SpacingTokens.xs),
                  if (!state.isExamMode)
                    MzIconButton(
                      glyph: state.showTranscript
                          ? LucideGlyph.bookOpen
                          : LucideGlyph.audioLines,
                      semanticLabel: 'Toggle transcript',
                      onPressed: notifier.toggleTranscript,
                    )
                  else
                    const MzChip(label: 'Exam'),
                ],
              ),
            ),

            // Session Timer Bar
            Padding(
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: SpacingTokens.md,
              ),
              child: Align(
                child: TimerBar(
                  remainingSeconds: state.remainingSeconds,
                  totalSeconds: state.totalSeconds > 0
                      ? state.totalSeconds
                      : 1800,
                  phase: state.isPaused
                      ? TimerPhase.paused
                      : (state.remainingSeconds == 0
                            ? TimerPhase.expired
                            : TimerPhase.response),
                  isStudyMode: !state.isExamMode,
                  onTapPauseResume: state.isExamMode
                      ? null
                      : notifier.toggleTimerPause,
                ),
              ),
            ),
            const SizedBox(height: SpacingTokens.xs),

            // Persistent Audio Player Bar
            Padding(
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: SpacingTokens.md,
                vertical: SpacingTokens.xs,
              ),
              child: AudioPlayerBar(
                position: state.currentPosition,
                duration: state.totalDuration,
                isPlaying: state.isPlaying,
                policy: state.isExamMode
                    ? AudioPlaybackPolicy.examLinearLock
                    : AudioPlaybackPolicy.studyInteractive,
                playbackSpeed: state.playbackSpeed,
                onTapPlayPause: () => unawaited(notifier.togglePlay()),
                onSeek: state.isExamMode
                    ? null
                    : (pos) => unawaited(notifier.seek(pos)),
                onTapSpeed: state.isExamMode
                    ? null
                    : () {
                        final nextSpeed = switch (state.playbackSpeed) {
                          1.0 => 1.25,
                          1.25 => 0.85,
                          _ => 1.0,
                        };
                        unawaited(notifier.setSpeed(nextSpeed));
                      },
              ),
            ),
            const SizedBox(height: SpacingTokens.xs),

            // Main Content Area
            Expanded(
              child: state.isLoadingPack
                  ? const Center(child: CircularProgressIndicator())
                  : activeSection == null
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
                              state.errorMessage ??
                                  'Listening pack unavailable.',
                              textAlign: TextAlign.center,
                              style: typography.body.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                            const SizedBox(height: SpacingTokens.lg),
                            PrimaryButton(
                              label: 'Retry Loading Pack',
                              onPressed: () => notifier.initialize(
                                widget.packId,
                                isExamMode: widget.isExamMode,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  : state.showTranscript && !state.isExamMode
                  ? _SyncedTranscriptView(
                      entries: state.transcriptEntries,
                      currentPosition: state.currentPosition,
                      onTapSeekMs: (ms) => unawaited(
                        notifier.seek(Duration(microseconds: ms * 1000)),
                      ),
                    )
                  : _QuestionsFormView(
                      section: activeSection,
                      answers: state.answers,
                      focusedMode: _focusedMode,
                      activeQuestionNumber: _focusedQuestionNumber,
                      onToggleFocusedMode: (val) =>
                          setState(() => _focusedMode = val),
                      onSelectQuestionNumber: (numVal) =>
                          setState(() => _focusedQuestionNumber = numVal),
                      onAnswer: notifier.setAnswer,
                      onToggleMulti: notifier.toggleMultiAnswer,
                    ),
            ),

            if (state.errorMessage != null && activeSection != null)
              Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: SpacingTokens.md,
                ),
                child: Text(
                  state.errorMessage!,
                  style: typography.caption.copyWith(color: colors.error),
                ),
              ),

            // Bottom Question Indicator & Submit Bar
            if (activeSection != null)
              ExamQuestionPaletteBar(
                items: activeSection.questions
                    .map(
                      (q) => QuestionProgressSnapshot(
                        number: q.number,
                        isAnswered: (state.answers[q.number] ?? '')
                            .trim()
                            .isNotEmpty,
                      ),
                    )
                    .toList(growable: false),
                activeQuestionNumber: _focusedQuestionNumber,
                onSelectQuestionNumber: (qNum) {
                  setState(() => _focusedQuestionNumber = qNum);
                  if (state.showTranscript) {
                    notifier.toggleTranscript();
                  }
                },
                submitLabel: 'Submit Test',
                submittingLabel: 'Grading...',
                isSubmitting: state.isSubmitting,
                onSubmit: () async {
                  final attemptId = await notifier.submitListening();
                  if (attemptId != null && context.mounted) {
                    context.go(
                      AppRoutes.buildAttemptReview(attemptId),
                    );
                  }
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _QuestionsFormView extends StatelessWidget {
  const new({
    required this.section,
    required this.answers,
    required this.focusedMode,
    required this.activeQuestionNumber,
    required this.onToggleFocusedMode,
    required this.onSelectQuestionNumber,
    required this.onAnswer,
    required this.onToggleMulti,
  });

  final ListeningSectionSpec section;
  final Map<int, String> answers;
  final bool focusedMode;
  final int activeQuestionNumber;
  final ValueChanged<bool> onToggleFocusedMode;
  final ValueChanged<int> onSelectQuestionNumber;
  final void Function(int qNum, String ans) onAnswer;
  final void Function(int qNum, String letter) onToggleMulti;

  @override
  Widget build(BuildContext context) {
    final typography = AppTypography.of(context);
    final colors = AppColors.of(context);

    final questions = section.questions;
    final resolvedIdx = questions.indexWhere(
      (q) => q.number == activeQuestionNumber,
    );
    final activeIdx = resolvedIdx >= 0 ? resolvedIdx : 0;
    final visibleQuestions = (focusedMode && questions.isNotEmpty)
        ? <QuestionSpec>[questions[activeIdx]]
        : questions;

    return ListView(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
      children: <Widget>[
        MzCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Expanded(
                    child: Text(section.title, style: typography.cardTitle),
                  ),
                  const SizedBox(width: SpacingTokens.sm),
                  MzChip(label: section.accent),
                ],
              ),
              const SizedBox(height: SpacingTokens.xs),
              Text(
                'Answer based on the recording.',
                style: typography.secondary.copyWith(
                  color: colors.textSecondary,
                ),
              ),
              if (questions.isNotEmpty) ...<Widget>[
                const SizedBox(height: SpacingTokens.sm),
                FocusedQuestionHeader(
                  focusedMode: focusedMode,
                  activeQuestionNumber: questions[activeIdx].number,
                  activePositionIndex: activeIdx,
                  totalCount: questions.length,
                  onToggleFocusedMode: onToggleFocusedMode,
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: SpacingTokens.md),
        ...visibleQuestions.map((q) {
          final current = answers[q.number];
          final isChoice = q.options.isNotEmpty;
          final isMulti = q.questionType == ObjectiveQuestionType.mcqMulti;
          final selectedMulti = (current ?? '')
              .split(',')
              .map((s) => s.trim())
              .toSet();

          return Padding(
            padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.md),
            child: MzCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    '${q.number}. ${q.prompt}',
                    style: typography.body.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  if (isChoice)
                    ...List.generate(q.options.length, (idx) {
                      final rawOpt = q.options[idx];
                      final parsed = parseObjectiveChoiceOption(
                        q.questionType,
                        rawOpt,
                        idx,
                        q.acceptedVariants,
                      );
                      final selected = isMulti
                          ? (selectedMulti.contains(parsed.value) ||
                                selectedMulti.contains(parsed.label) ||
                                selectedMulti.contains(rawOpt))
                          : (current == parsed.value ||
                                current == parsed.label ||
                                current == rawOpt);
                      return Padding(
                        padding: const EdgeInsetsDirectional.only(
                          bottom: SpacingTokens.xs,
                        ),
                        child: MzChoiceOptionTile(
                          badgeLabel: parsed.label,
                          text: parsed.displayText,
                          isSelected: selected,
                          onTap: () => isMulti
                              ? onToggleMulti(q.number, parsed.value)
                              : onAnswer(q.number, parsed.value),
                        ),
                      );
                    })
                  else
                    MzControlledAnswerField(
                      value: current ?? '',
                      hint:
                          'Max ${q.maxWords} word${q.maxWords == 1 ? '' : 's'}',
                      onChanged: (val) => onAnswer(q.number, val),
                    ),
                ],
              ),
            ),
          );
        }),
        if (focusedMode && questions.length > 1)
          QuestionStepNavRow(
            canGoPrevious: activeIdx > 0,
            canGoNext: activeIdx + 1 < questions.length,
            onPrevious: () =>
                onSelectQuestionNumber(questions[activeIdx - 1].number),
            onNext: () =>
                onSelectQuestionNumber(questions[activeIdx + 1].number),
          ),
      ],
    );
  }
}

class _SyncedTranscriptView extends StatelessWidget {
  const new({
    required this.entries,
    required this.currentPosition,
    required this.onTapSeekMs,
  });

  final List<ListeningTranscriptEntry> entries;
  final Duration currentPosition;
  final ValueChanged<int> onTapSeekMs;

  @override
  Widget build(BuildContext context) {
    final typography = AppTypography.of(context);
    final colors = AppColors.of(context);
    final posMs = currentPosition.inMilliseconds;

    if (entries.isEmpty) {
      return Center(
        child: Text(
          'Transcript unavailable for this section.',
          style: typography.secondary.copyWith(color: colors.textSecondary),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
      itemCount: entries.length,
      separatorBuilder: (_, _) => const SizedBox(height: SpacingTokens.sm),
      itemBuilder: (context, idx) {
        final entry = entries[idx];
        final isActive = posMs >= entry.startMs && posMs < entry.endMs;
        return TranscriptSegmentWidget(
          text: '${entry.speaker}: ${entry.text}',
          startMs: entry.startMs,
          endMs: entry.endMs,
          isActive: isActive,
          onTapPlaySegment: () => onTapSeekMs(entry.startMs),
        );
      },
    );
  }
}

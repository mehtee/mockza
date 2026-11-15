import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/features/listening_sim/presentation/listening_sim_notifier.dart';
import 'package:mockza/features/listening_sim/presentation/listening_sim_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/audio_player_bar.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
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
    super.key,
  });

  /// Postgres Listening pack identifier.
  final String packId;

  /// Exam Mode (linear locked audio, no transcript) vs Study Mode.
  final bool isExamMode;

  @override
  ConsumerState<ListeningSimScreen> createState() => _ListeningSimScreenState();
}

class _ListeningSimScreenState extends ConsumerState<ListeningSimScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(
        ref
            .read(listeningSimNotifierProvider.notifier)
            .initialize(widget.packId, isExamMode: widget.isExamMode),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(listeningSimNotifierProvider);
    final notifier = ref.read(listeningSimNotifierProvider.notifier);
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final sections = state.pack?.sections ?? const <ListeningSectionSpec>[];
    final activeSection = state.activeSection;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final shouldExit = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: colors.surface,
            shape: RoundedRectangleBorder(borderRadius: shapes.cardRadius),
            title: Text('Exit Listening Test?', style: typography.cardTitle),
            content: Text(
              'Exit now? Unsubmitted answers will not be scored.',
              style: typography.body.copyWith(color: colors.textSecondary),
            ),
            actions: <Widget>[
              SecondaryButton(
                label: 'Cancel',
                isFullWidth: false,
                onPressed: () => Navigator.of(ctx).pop(false),
              ),
              PrimaryButton(
                label: 'Exit',
                isFullWidth: false,
                onPressed: () => Navigator.of(ctx).pop(true),
              ),
            ],
          ),
        );
        if (shouldExit ?? false) {
          if (context.mounted) {
            context.pop();
          }
        }
      },
      child: MzScaffold(
        mode: MzScaffoldMode.immersive,
        body: SafeArea(
          child: Column(
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
                    const Spacer(),
                    if (sections.isNotEmpty)
                      Flexible(
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Container(
                            padding: const EdgeInsetsDirectional.all(2),
                            decoration: BoxDecoration(
                              color: colors.surfaceAlt,
                              borderRadius: shapes.pillRadius,
                              border: Border.all(color: colors.borderSubtle),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: sections.map((sec) {
                                final isSelected =
                                    state.sectionIndex == sec.sectionIndex;
                                return GestureDetector(
                                  onTap: () =>
                                      notifier.selectSection(sec.sectionIndex),
                                  child: Container(
                                    padding:
                                        const EdgeInsetsDirectional.symmetric(
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
                                      'Sec ${sec.sectionIndex}',
                                      style: typography.caption.copyWith(
                                        color: isSelected
                                            ? colors.textPrimary
                                            : colors.textSecondary,
                                        fontWeight: isSelected
                                            ? FontWeight.w600
                                            : FontWeight.w400,
                                      ),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                        ),
                      ),
                    const Spacer(),
                    if (!state.isExamMode)
                      MzIconButton(
                        glyph: state.showTranscript
                            ? LucideGlyph.bookOpen
                            : LucideGlyph.audioLines,
                        semanticLabel: 'Toggle transcript',
                        onPressed: notifier.toggleTranscript,
                      )
                    else
                      const MzChip(
                        label: 'Exam',
                      ),
                  ],
                ),
              ),

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
                Container(
                  padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
                  decoration: BoxDecoration(
                    color: colors.surface,
                    border: Border(top: BorderSide(color: colors.borderSubtle)),
                  ),
                  child: Row(
                    children: <Widget>[
                      Expanded(
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: activeSection.questions.map((q) {
                              final isAnswered = (state.answers[q.number] ?? '')
                                  .trim()
                                  .isNotEmpty;
                              return Container(
                                margin: const EdgeInsetsDirectional.only(
                                  end: SpacingTokens.xs,
                                ),
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: isAnswered
                                      ? colors.primary
                                      : colors.surfaceAlt,
                                  border: Border.all(
                                    color: isAnswered
                                        ? colors.primary
                                        : colors.borderSubtle,
                                  ),
                                ),
                                child: Center(
                                  child: Text(
                                    '${q.number}',
                                    style: typography.caption.copyWith(
                                      color: isAnswered
                                          ? colors.background
                                          : colors.textSecondary,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              );
                            }).toList(),
                          ),
                        ),
                      ),
                      const SizedBox(width: SpacingTokens.md),
                      PrimaryButton(
                        label: state.isSubmitting
                            ? 'Grading...'
                            : 'Submit Test',
                        isFullWidth: false,
                        onPressed: state.isSubmitting
                            ? null
                            : () async {
                                final attemptId = await notifier
                                    .submitListening();
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
            ],
          ),
        ),
      ),
    );
  }
}

class _QuestionsFormView extends StatelessWidget {
  const new({
    required this.section,
    required this.answers,
    required this.onAnswer,
    required this.onToggleMulti,
  });

  final ListeningSectionSpec section;
  final Map<int, String> answers;
  final void Function(int qNum, String ans) onAnswer;
  final void Function(int qNum, String letter) onToggleMulti;

  @override
  Widget build(BuildContext context) {
    final typography = AppTypography.of(context);
    final colors = AppColors.of(context);

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
                  MzChip(label: section.accent),
                ],
              ),
              const SizedBox(height: SpacingTokens.xs),
              Text(
                'Answer all questions based on the recording.',
                style: typography.secondary.copyWith(
                  color: colors.textSecondary,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: SpacingTokens.md),
        ...section.questions.map((q) {
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
                      final letter = String.fromCharCode(65 + idx);
                      final optText = q.options[idx];
                      final selected = isMulti
                          ? (selectedMulti.contains(letter) ||
                                selectedMulti.contains(optText))
                          : (current == letter || current == optText);
                      return Padding(
                        padding: const EdgeInsetsDirectional.only(
                          bottom: SpacingTokens.xs,
                        ),
                        child: _ChoiceOption(
                          letter: letter,
                          text: optText,
                          isSelected: selected,
                          onTap: () => isMulti
                              ? onToggleMulti(q.number, letter)
                              : onAnswer(q.number, letter),
                        ),
                      );
                    })
                  else
                    _ListeningGapField(
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
      ],
    );
  }
}

class _ChoiceOption extends StatelessWidget {
  const new({
    required this.letter,
    required this.text,
    required this.isSelected,
    required this.onTap,
  });

  final String letter;
  final String text;
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
        padding: const EdgeInsetsDirectional.all(SpacingTokens.sm),
        decoration: BoxDecoration(
          color: isSelected
              ? colors.surfaceAlt
              : colors.surface.withValues(alpha: 0),
          borderRadius: shapes.compactRadius,
          border: Border.all(
            color: isSelected ? colors.primary : colors.borderSubtle,
          ),
        ),
        child: Row(
          children: <Widget>[
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected ? colors.primary : colors.surfaceAlt,
              ),
              child: Center(
                child: Text(
                  letter,
                  style: typography.caption.copyWith(
                    color: isSelected ? colors.background : colors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(width: SpacingTokens.sm),
            Expanded(child: Text(text, style: typography.secondary)),
          ],
        ),
      ),
    );
  }
}

class _ListeningGapField extends StatefulWidget {
  const new({
    required this.value,
    required this.hint,
    required this.onChanged,
  });

  final String value;
  final String hint;
  final ValueChanged<String> onChanged;

  @override
  State<_ListeningGapField> createState() => _ListeningGapFieldState();
}

class _ListeningGapFieldState extends State<_ListeningGapField> {
  late final TextEditingController _controller;
  late final FocusNode _focusNode;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value);
    _focusNode = FocusNode();
  }

  @override
  void didUpdateWidget(covariant _ListeningGapField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_focusNode.hasFocus && _controller.text != widget.value) {
      _controller.text = widget.value;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceAlt,
        borderRadius: shapes.compactRadius,
        border: Border.all(color: colors.borderSubtle),
      ),
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: SpacingTokens.sm,
      ),
      child: TextField(
        controller: _controller,
        focusNode: _focusNode,
        style: typography.body,
        decoration: InputDecoration(
          border: InputBorder.none,
          hintText: widget.hint,
          hintStyle: typography.secondary.copyWith(color: colors.textTertiary),
        ),
        onChanged: widget.onChanged,
      ),
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

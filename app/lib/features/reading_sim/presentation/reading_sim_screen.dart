import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/exams/question_progress_item.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/features/reading_sim/presentation/reading_sim_notifier.dart';
import 'package:mockza/features/reading_sim/presentation/reading_sim_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/routing/safe_pop.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/evidence_link.dart';
import 'package:mockza/theme/components/exam_exit_guard.dart';
import 'package:mockza/theme/components/exam_question_controls.dart';
import 'package:mockza/theme/components/mz_bottom_sheet.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/timer_bar.dart';
import 'package:mockza/theme/primitives.dart';

/// Reading simulator screen backed by Postgres Reading packs, real passage
/// highlighting/notes in Drift, deterministic `LocalObjectiveScorer`, and
/// Study Mode AI explanation (Screens 08 & 09).
class ReadingSimScreen extends ConsumerStatefulWidget {
  /// Creates a [ReadingSimScreen].
  const new({
    this.packId = 'ielts-acad-reading-seed-01',
    this.isExamMode = true,
    this.mockSessionId,
    this.mockStageKey,
    super.key,
  });

  /// Postgres Reading pack identifier.
  final String packId;

  /// Exam Mode (timer running, no AI hints) vs Study Mode.
  final bool isExamMode;

  /// Optional parent Full Mock session ID.
  final String? mockSessionId;

  /// Optional stage key within the Full Mock session.
  final String? mockStageKey;

  @override
  ConsumerState<ReadingSimScreen> createState() => _ReadingSimScreenState();
}

class _ReadingSimScreenState extends ConsumerState<ReadingSimScreen> {
  bool _focusedQuestionMode = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(
        ref
            .read(readingSimNotifierProvider.notifier)
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
    final state = ref.watch(readingSimNotifierProvider);
    final notifier = ref.read(readingSimNotifierProvider.notifier);
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final pack = state.pack;
    final passages = pack?.passages ?? const <ReadingPassageSpec>[];
    final currentPassage =
        (state.passageIndex >= 0 && state.passageIndex < passages.length)
        ? passages[state.passageIndex]
        : null;
    final totalQuestions = state.totalQuestions;

    return ExamExitGuard(
      dialogTitle: 'Exit Reading Test?',
      dialogMessage:
          'Your highlighted passages remain saved locally. Exit this session?',
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
                    semanticLabel: 'Exit reading test',
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                  const SizedBox(width: SpacingTokens.xs),
                  if (passages.isNotEmpty)
                    Expanded(
                      child: Align(
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: MzSegmentedPillStrip(
                            items: List.generate(passages.length, (i) {
                              return (
                                label: 'Passage ${i + 1}',
                                isSelected: state.passageIndex == i,
                                onTap: () => notifier.selectPassage(i),
                              );
                            }),
                          ),
                        ),
                      ),
                    )
                  else
                    const Spacer(),
                  const SizedBox(width: SpacingTokens.xs),
                  Container(
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: SpacingTokens.sm,
                      vertical: SpacingTokens.xs,
                    ),
                    decoration: BoxDecoration(
                      color: colors.surfaceAlt,
                      borderRadius: shapes.pillRadius,
                    ),
                    child: Text(
                      '${state.answeredCount}/${totalQuestions > 0 ? totalQuestions : '-'} answered',
                      style: typography.caption.copyWith(
                        color: colors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Timer Bar
            TimerBar(
              remainingSeconds: state.remainingSeconds,
              totalSeconds: state.totalSeconds > 0 ? state.totalSeconds : 3600,
              phase: state.isPaused
                  ? TimerPhase.paused
                  : (state.remainingSeconds == 0
                        ? TimerPhase.expired
                        : TimerPhase.response),
              isStudyMode: !state.isExamMode,
              onTapPauseResume: state.isExamMode ? null : notifier.togglePause,
            ),
            const SizedBox(height: SpacingTokens.xs),

            // Responsive Passage + Questions Body
            Expanded(
              child: state.isLoadingPack
                  ? const Center(child: CircularProgressIndicator())
                  : currentPassage == null
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
                              state.errorMessage ?? 'Reading pack unavailable.',
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
                  : LayoutBuilder(
                      builder: (context, constraints) {
                        final isWide = constraints.maxWidth >= 768;
                        final passagePane = _PassagePane(
                          passage: currentPassage,
                          passageIndex: state.passageIndex,
                          activeColor: state.activeHighlightColor,
                          annotations: state.annotations,
                          stagedSelection: state.stagedSelection,
                          highlightedParagraphIndex:
                              state.highlightedParagraphIndex,
                          onSelectColor: notifier.setHighlightColor,
                          onSelectionChanged: (pIdx, sel, text) =>
                              notifier.stageTextSelection(
                                paragraphIndex: pIdx,
                                selection: sel,
                                paragraphText: text,
                              ),
                          onTapHighlightSelection:
                              notifier.saveStagedAnnotation,
                          onTapAddNote: () => _openAddNoteDialog(
                            context,
                            notifier,
                          ),
                          onDeleteAnnotation: notifier.removeAnnotation,
                        );
                        final questionsPane = _QuestionsPane(
                          questions: currentPassage.questions,
                          answers: state.answers,
                          allowAiExplain: !state.isExamMode,
                          focusedMode: _focusedQuestionMode,
                          activeQuestionNumber: state.currentQuestionIndex,
                          onToggleFocusedMode: (val) =>
                              setState(() => _focusedQuestionMode = val),
                          onSelectQuestionNumber: notifier.selectQuestion,
                          onAnswer: notifier.setAnswer,
                          onToggleMulti: notifier.toggleMultiAnswer,
                          onAskAi: (q) => _showAskAiSheet(context, notifier, q),
                        );

                        if (isWide) {
                          return Row(
                            children: <Widget>[
                              Expanded(child: passagePane),
                              VerticalDivider(
                                width: 1,
                                color: colors.borderSubtle,
                              ),
                              Expanded(child: questionsPane),
                            ],
                          );
                        }

                        return Column(
                          children: <Widget>[
                            Padding(
                              padding: const EdgeInsetsDirectional.symmetric(
                                horizontal: SpacingTokens.md,
                                vertical: SpacingTokens.xs,
                              ),
                              child: Row(
                                children: <Widget>[
                                  Expanded(
                                    child: _ViewTabButton(
                                      label: 'Passage',
                                      glyph: LucideGlyph.bookOpen,
                                      isSelected: state.activeTab == 0,
                                      onTap: () => notifier.selectTab(0),
                                    ),
                                  ),
                                  const SizedBox(width: SpacingTokens.sm),
                                  Expanded(
                                    child: _ViewTabButton(
                                      label:
                                          'Questions (${state.answeredCount}/$totalQuestions)',
                                      glyph: LucideGlyph.checkCircle2,
                                      isSelected: state.activeTab == 1,
                                      onTap: () => notifier.selectTab(1),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: state.activeTab == 0
                                  ? passagePane
                                  : questionsPane,
                            ),
                          ],
                        );
                      },
                    ),
            ),

            if (state.errorMessage != null && currentPassage != null)
              Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: SpacingTokens.md,
                ),
                child: Text(
                  state.errorMessage!,
                  style: typography.caption.copyWith(color: colors.error),
                ),
              ),

            // Bottom Question Palette & Submit Bar
            if (currentPassage != null)
              ExamQuestionPaletteBar(
                items: currentPassage.questions
                    .map(
                      (q) => QuestionProgressSnapshot(
                        number: q.number,
                        isAnswered: (state.answers[q.number] ?? '')
                            .trim()
                            .isNotEmpty,
                      ),
                    )
                    .toList(growable: false),
                activeQuestionNumber: state.currentQuestionIndex,
                onSelectQuestionNumber: (qNum) {
                  notifier
                    ..selectQuestion(qNum)
                    ..selectTab(1);
                },
                submitLabel: 'Submit Test',
                submittingLabel: 'Grading...',
                isSubmitting: state.isSubmitting,
                onSubmit: () async {
                  final attemptId = await notifier.submitReading();
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

  Future<void> _openAddNoteDialog(
    BuildContext context,
    ReadingSimNotifier notifier,
  ) async {
    final controller = TextEditingController();
    final note = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Save Passage Note'),
        content: TextField(
          controller: controller,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'Write a quick reminder for this quote...',
          ),
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(controller.text),
            child: const Text('Save Highlight'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (note != null) {
      await notifier.saveStagedAnnotation(noteText: note);
    }
  }

  void _showAskAiSheet(
    BuildContext context,
    ReadingSimNotifier notifier,
    QuestionSpec question,
  ) {
    final typography = AppTypography.of(context);
    final futureExplanation = notifier.fetchAiExplanation(question);

    unawaited(
      showMzBottomSheet<void>(
        context: context,
        title: 'AI Question Tutor',
        child: Builder(
          builder: (sheetCtx) => FutureBuilder<String>(
            future: futureExplanation,
            builder: (ctx, snap) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'Question ${question.number}',
                    style: typography.cardTitle,
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  if (snap.connectionState == ConnectionState.waiting)
                    const Padding(
                      padding: EdgeInsetsDirectional.symmetric(
                        vertical: SpacingTokens.lg,
                      ),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else
                    Text(
                      snap.data ?? 'Explanation unavailable.',
                      style: typography.body,
                    ),
                  if (question.evidenceSpan != null) ...<Widget>[
                    const SizedBox(height: SpacingTokens.lg),
                    EvidenceLink(
                      paragraphIndex: question.evidenceSpan!.paragraphIndex,
                      exactQuote: question.evidenceSpan!.exactQuote,
                      onTapJump: () {
                        Navigator.of(sheetCtx).pop();
                        notifier.jumpToEvidenceParagraph(
                          question.evidenceSpan!.paragraphIndex,
                        );
                      },
                    ),
                  ],
                  const SizedBox(height: SpacingTokens.lg),
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

class _PassagePane extends StatelessWidget {
  const new({
    required this.passage,
    required this.passageIndex,
    required this.activeColor,
    required this.annotations,
    required this.onSelectColor,
    required this.onSelectionChanged,
    required this.onTapHighlightSelection,
    required this.onTapAddNote,
    required this.onDeleteAnnotation,
    this.stagedSelection,
    this.highlightedParagraphIndex,
  });

  final ReadingPassageSpec passage;
  final int passageIndex;
  final String activeColor;
  final List<ReadingAnnotationItem> annotations;
  final StagedTextSelection? stagedSelection;
  final int? highlightedParagraphIndex;
  final ValueChanged<String> onSelectColor;
  final void Function(int pIdx, TextSelection sel, String text)
  onSelectionChanged;
  final VoidCallback onTapHighlightSelection;
  final VoidCallback onTapAddNote;
  final ValueChanged<String> onDeleteAnnotation;

  @override
  Widget build(BuildContext context) {
    final typography = AppTypography.of(context);
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);

    final passageAnnotations = annotations
        .where((a) => (a.passageIndex ~/ 100) == passageIndex)
        .toList(growable: false);

    return ListView(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
      children: <Widget>[
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: <Widget>[
            Expanded(
              child: Text(passage.title, style: typography.sectionHeading),
            ),
            Row(
              children: <Widget>[
                _HighlightColorDot(
                  color: colors.warning,
                  label: 'Yellow highlight',
                  isSelected: activeColor == 'yellow',
                  onTap: () => onSelectColor('yellow'),
                ),
                const SizedBox(width: SpacingTokens.xs),
                _HighlightColorDot(
                  color: colors.success,
                  label: 'Green highlight',
                  isSelected: activeColor == 'green',
                  onTap: () => onSelectColor('green'),
                ),
                const SizedBox(width: SpacingTokens.xs),
                _HighlightColorDot(
                  color: colors.error,
                  label: 'Pink highlight',
                  isSelected: activeColor == 'pink',
                  onTap: () => onSelectColor('pink'),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: SpacingTokens.xs),
        Text(
          'Select any text below to highlight or attach a note.',
          style: typography.caption.copyWith(color: colors.textTertiary),
        ),
        if (stagedSelection != null) ...<Widget>[
          const SizedBox(height: SpacingTokens.sm),
          MzCard(
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    '"${stagedSelection!.selectedText}"',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: typography.caption,
                  ),
                ),
                const SizedBox(width: SpacingTokens.sm),
                SecondaryButton(
                  label: 'Highlight',
                  isFullWidth: false,
                  onPressed: onTapHighlightSelection,
                ),
                const SizedBox(width: SpacingTokens.xs),
                PrimaryButton(
                  label: 'Note',
                  isFullWidth: false,
                  onPressed: onTapAddNote,
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: SpacingTokens.md),
        ...List.generate(passage.paragraphs.length, (pIdx) {
          final text = passage.paragraphs[pIdx];
          final letter = String.fromCharCode(65 + (pIdx % 26));
          final isJumped = highlightedParagraphIndex == pIdx;
          return Padding(
            padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.md),
            child: Container(
              padding: const EdgeInsetsDirectional.all(SpacingTokens.sm),
              decoration: BoxDecoration(
                color: isJumped
                    ? colors.mintBg
                    : colors.surface.withValues(alpha: 0),
                borderRadius: shapes.compactRadius,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Container(
                    width: 24,
                    height: 24,
                    margin: const EdgeInsetsDirectional.only(
                      end: SpacingTokens.sm,
                      top: 2,
                    ),
                    decoration: BoxDecoration(
                      color: colors.surfaceAlt,
                      shape: BoxShape.circle,
                      border: Border.all(color: colors.borderSubtle),
                    ),
                    child: Center(
                      child: Text(
                        letter,
                        style: typography.caption.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: SelectableText(
                      text,
                      style: typography.readingPassage,
                      onSelectionChanged: (sel, _) =>
                          onSelectionChanged(pIdx, sel, text),
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
        if (passageAnnotations.isNotEmpty) ...<Widget>[
          const SizedBox(height: SpacingTokens.md),
          Text('Saved Highlights & Notes', style: typography.cardTitle),
          const SizedBox(height: SpacingTokens.xs),
          ...passageAnnotations.map((ann) {
            final tint = switch (ann.colorCode) {
              'green' => colors.success,
              'pink' => colors.error,
              _ => colors.warning,
            };
            final pNum = (ann.passageIndex % 100) + 1;
            return Padding(
              padding: const EdgeInsetsDirectional.only(
                bottom: SpacingTokens.xs,
              ),
              child: MzCard(
                child: Row(
                  children: <Widget>[
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: tint,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: SpacingTokens.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            'Paragraph $pNum',
                            style: typography.caption.copyWith(
                              color: colors.textTertiary,
                            ),
                          ),
                          Text(
                            ann.noteText ?? 'Highlighted text span',
                            style: typography.secondary,
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Delete note',
                      icon: AppIcon(
                        LucideGlyph.trash2,
                        size: 16,
                        color: colors.textTertiary,
                      ),
                      onPressed: () => onDeleteAnnotation(ann.annotationId),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ],
    );
  }
}

class _QuestionsPane extends StatelessWidget {
  const new({
    required this.questions,
    required this.answers,
    required this.allowAiExplain,
    required this.focusedMode,
    required this.activeQuestionNumber,
    required this.onToggleFocusedMode,
    required this.onSelectQuestionNumber,
    required this.onAnswer,
    required this.onToggleMulti,
    required this.onAskAi,
  });

  final List<QuestionSpec> questions;
  final Map<int, String> answers;
  final bool allowAiExplain;
  final bool focusedMode;
  final int activeQuestionNumber;
  final ValueChanged<bool> onToggleFocusedMode;
  final ValueChanged<int> onSelectQuestionNumber;
  final void Function(int questionNumber, String answer) onAnswer;
  final void Function(int questionNumber, String optionLetter) onToggleMulti;
  final ValueChanged<QuestionSpec> onAskAi;

  @override
  Widget build(BuildContext context) {
    final typography = AppTypography.of(context);
    final colors = AppColors.of(context);

    if (questions.isEmpty) {
      return Center(
        child: Text(
          'No questions in this passage.',
          style: typography.secondary.copyWith(color: colors.textSecondary),
        ),
      );
    }

    final resolvedIdx = questions.indexWhere(
      (q) => q.number == activeQuestionNumber,
    );
    final activeIdx = resolvedIdx >= 0 ? resolvedIdx : 0;
    final activeQuestion = questions[activeIdx];
    final visibleQuestions = focusedMode
        ? <QuestionSpec>[activeQuestion]
        : questions;

    return ListView(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
      children: <Widget>[
        FocusedQuestionHeader(
          focusedMode: focusedMode,
          activeQuestionNumber: activeQuestion.number,
          activePositionIndex: activeIdx,
          totalCount: questions.length,
          onToggleFocusedMode: onToggleFocusedMode,
        ),
        const SizedBox(height: SpacingTokens.md),
        ...visibleQuestions.map(
          (q) => Padding(
            padding: const EdgeInsetsDirectional.only(
              bottom: SpacingTokens.md,
            ),
            child: _buildQuestionCard(context, q),
          ),
        ),
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

  Widget _buildQuestionCard(BuildContext context, QuestionSpec q) {
    final typography = AppTypography.of(context);
    final current = answers[q.number];

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: Text(
                  '${q.number}. ${q.prompt}',
                  style: typography.body.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
              if (allowAiExplain)
                MzIconButton(
                  glyph: LucideGlyph.info,
                  semanticLabel: 'Ask AI why',
                  onPressed: () => onAskAi(q),
                ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          MzObjectiveAnswerInput(
            question: q,
            currentAnswer: current,
            onAnswer: onAnswer,
            onToggleMulti: onToggleMulti,
          ),
        ],
      ),
    );
  }
}

class _ViewTabButton extends StatelessWidget {
  const new({
    required this.label,
    required this.glyph,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final LucideGlyph glyph;
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
          horizontal: SpacingTokens.sm,
          vertical: SpacingTokens.xs,
        ),
        decoration: BoxDecoration(
          color: isSelected ? colors.surfaceAlt : colors.surface,
          borderRadius: shapes.pillRadius,
          border: Border.all(
            color: isSelected ? colors.primary : colors.borderSubtle,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            AppIcon(
              glyph,
              size: 16,
              color: isSelected ? colors.primary : colors.textSecondary,
            ),
            const SizedBox(width: SpacingTokens.xs),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: typography.secondary.copyWith(
                  color: isSelected ? colors.primary : colors.textSecondary,
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

class _HighlightColorDot extends StatelessWidget {
  const new({
    required this.color,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final Color color;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Semantics(
      button: true,
      selected: isSelected,
      label: label,
      child: Tooltip(
        message: label,
        child: InkResponse(
          onTap: onTap,
          radius: 18,
          child: Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: Border.all(
                color: isSelected
                    ? colors.onPrimary
                    : colors.surface.withValues(alpha: 0),
                width: 2,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

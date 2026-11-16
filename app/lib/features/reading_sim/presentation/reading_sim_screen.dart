import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/features/reading_sim/presentation/reading_sim_notifier.dart';
import 'package:mockza/features/reading_sim/presentation/reading_sim_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/evidence_link.dart';
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
    super.key,
  });

  /// Postgres Reading pack identifier.
  final String packId;

  /// Exam Mode (timer running, no AI hints) vs Study Mode.
  final bool isExamMode;

  @override
  ConsumerState<ReadingSimScreen> createState() => _ReadingSimScreenState();
}

class _ReadingSimScreenState extends ConsumerState<ReadingSimScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(
        ref
            .read(readingSimNotifierProvider.notifier)
            .initialize(widget.packId, isExamMode: widget.isExamMode),
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

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final shouldExit = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: colors.surface,
            shape: RoundedRectangleBorder(borderRadius: shapes.cardRadius),
            title: Text('Exit Reading Test?', style: typography.cardTitle),
            content: Text(
              'Your highlighted passages remain saved locally. Exit this session?',
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
                      semanticLabel: 'Exit reading test',
                      onPressed: () => Navigator.of(context).maybePop(),
                    ),
                    const Spacer(),
                    if (passages.isNotEmpty)
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
                              children: List.generate(passages.length, (i) {
                                return _PassageTab(
                                  label: 'Passage ${i + 1}',
                                  isSelected: state.passageIndex == i,
                                  onTap: () => notifier.selectPassage(i),
                                );
                              }),
                            ),
                          ),
                        ),
                      ),
                    const Spacer(),
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
                totalSeconds: state.totalSeconds > 0
                    ? state.totalSeconds
                    : 3600,
                phase: state.isPaused
                    ? TimerPhase.paused
                    : (state.remainingSeconds == 0
                          ? TimerPhase.expired
                          : TimerPhase.response),
                isStudyMode: !state.isExamMode,
                onTapPauseResume: state.isExamMode
                    ? null
                    : notifier.togglePause,
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
                                state.errorMessage ??
                                    'Reading pack unavailable.',
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
                            onAnswer: notifier.setAnswer,
                            onToggleMulti: notifier.toggleMultiAnswer,
                            onAskAi: (q) =>
                                _showAskAiSheet(context, notifier, q),
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
                            children: currentPassage.questions.map((q) {
                              final isAnswered = (state.answers[q.number] ?? '')
                                  .trim()
                                  .isNotEmpty;
                              return GestureDetector(
                                onTap: () {
                                  notifier
                                    ..selectQuestion(q.number)
                                    ..selectTab(1);
                                },
                                child: Container(
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
                                    .submitReading();
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
                  isSelected: activeColor == 'yellow',
                  onTap: () => onSelectColor('yellow'),
                ),
                const SizedBox(width: SpacingTokens.xs),
                _HighlightColorDot(
                  color: colors.success,
                  isSelected: activeColor == 'green',
                  onTap: () => onSelectColor('green'),
                ),
                const SizedBox(width: SpacingTokens.xs),
                _HighlightColorDot(
                  color: colors.error,
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
    required this.onAnswer,
    required this.onToggleMulti,
    required this.onAskAi,
  });

  final List<QuestionSpec> questions;
  final Map<int, String> answers;
  final bool allowAiExplain;
  final void Function(int questionNumber, String answer) onAnswer;
  final void Function(int questionNumber, String optionLetter) onToggleMulti;
  final ValueChanged<QuestionSpec> onAskAi;

  @override
  Widget build(BuildContext context) {
    final typography = AppTypography.of(context);
    final colors = AppColors.of(context);

    return ListView.separated(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
      itemCount: questions.length,
      separatorBuilder: (_, _) => const SizedBox(height: SpacingTokens.md),
      itemBuilder: (context, idx) {
        final q = questions[idx];
        final current = answers[q.number];

        if (q.questionType == ObjectiveQuestionType.tfng ||
            q.questionType == ObjectiveQuestionType.ynng) {
          final labels = q.questionType == ObjectiveQuestionType.ynng
              ? const <String>['YES', 'NO', 'NOT GIVEN']
              : const <String>['TRUE', 'FALSE', 'NOT GIVEN'];
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
                        style: typography.body.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
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
                Row(
                  children: labels.map((lbl) {
                    return Expanded(
                      child: Padding(
                        padding: const EdgeInsetsDirectional.only(end: 4),
                        child: _ChoicePill(
                          label: lbl,
                          isSelected: current?.toUpperCase() == lbl,
                          onTap: () => onAnswer(q.number, lbl),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          );
        }

        if ((q.questionType == ObjectiveQuestionType.mcqSingle ||
                q.questionType == ObjectiveQuestionType.mcqMulti ||
                q.questionType == ObjectiveQuestionType.matchingHeadings) &&
            q.options.isNotEmpty) {
          final isMulti = q.questionType == ObjectiveQuestionType.mcqMulti;
          final selectedMulti = (current ?? '')
              .split(',')
              .map((s) => s.trim())
              .toSet();
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
                        style: typography.body.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
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
                const SizedBox(height: SpacingTokens.sm),
                ...List.generate(q.options.length, (oIdx) {
                  final rawOpt = q.options[oIdx];
                  final parsed = parseObjectiveChoiceOption(
                    q.questionType,
                    rawOpt,
                    oIdx,
                    q.acceptedVariants,
                  );
                  final isSel = isMulti
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
                    child: _McqOption(
                      label: parsed.label,
                      text: parsed.displayText,
                      isSelected: isSel,
                      onTap: () => isMulti
                          ? onToggleMulti(q.number, parsed.value)
                          : onAnswer(q.number, parsed.value),
                    ),
                  );
                }),
              ],
            ),
          );
        }

        // Gap-fill / short-answer with stateful controller
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
                      style: typography.body.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
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
              const SizedBox(height: SpacingTokens.xs),
              Text(
                'Max ${q.maxWords} word${q.maxWords == 1 ? '' : 's'}',
                style: typography.caption.copyWith(
                  color: colors.textTertiary,
                ),
              ),
              const SizedBox(height: SpacingTokens.sm),
              _StatefulAnswerField(
                value: current ?? '',
                hint: 'Type answer...',
                onChanged: (val) => onAnswer(q.number, val),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _StatefulAnswerField extends StatefulWidget {
  const new({
    required this.value,
    required this.hint,
    required this.onChanged,
  });

  final String value;
  final String hint;
  final ValueChanged<String> onChanged;

  @override
  State<_StatefulAnswerField> createState() => _StatefulAnswerFieldState();
}

class _StatefulAnswerFieldState extends State<_StatefulAnswerField> {
  late final TextEditingController _controller;
  late final FocusNode _focusNode;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value);
    _focusNode = FocusNode();
  }

  @override
  void didUpdateWidget(covariant _StatefulAnswerField oldWidget) {
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

class _ChoicePill extends StatelessWidget {
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
        padding: const EdgeInsetsDirectional.symmetric(
          vertical: SpacingTokens.sm,
        ),
        decoration: BoxDecoration(
          color: isSelected ? colors.primary : colors.surfaceAlt,
          borderRadius: shapes.compactRadius,
          border: Border.all(
            color: isSelected ? colors.primary : colors.borderSubtle,
          ),
        ),
        child: Center(
          child: Text(
            label,
            style: typography.caption.copyWith(
              color: isSelected ? colors.background : colors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

class _McqOption extends StatelessWidget {
  const new({
    required this.label,
    required this.text,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
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
                  label,
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

class _PassageTab extends StatelessWidget {
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
        padding: const EdgeInsetsDirectional.symmetric(
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
            Text(
              label,
              style: typography.secondary.copyWith(
                color: isSelected ? colors.primary : colors.textSecondary,
                fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
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
    required this.isSelected,
    required this.onTap,
  });

  final Color color;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 20,
        height: 20,
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
    );
  }
}

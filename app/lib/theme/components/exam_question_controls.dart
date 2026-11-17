import 'package:flutter/material.dart';
import 'package:mockza/core/exams/question_progress_item.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/primitives.dart';

/// Semantic colors resolved from [AppColors] for question navigation pills and palettes (`OCP`).
@immutable
class QuestionIndicatorColors {
  /// Creates a [QuestionIndicatorColors] bundle.
  const new({
    required this.background,
    required this.border,
    required this.foreground,
    required this.icon,
    required this.fontWeight,
  });

  /// Resolves coherent single-hue indicator tokens from [colors].
  factory resolve(
    AppColors colors, {
    required bool isSelected,
    required bool isAnswered,
  }) {
    if (isSelected) {
      return QuestionIndicatorColors(
        background: colors.primary,
        border: colors.primary,
        foreground: colors.onPrimary,
        icon: colors.onPrimary,
        fontWeight: FontWeight.w700,
      );
    }
    if (isAnswered) {
      return QuestionIndicatorColors(
        background: colors.blueBg,
        border: colors.primary.withValues(alpha: 0.5),
        foreground: colors.textPrimary,
        icon: colors.primary,
        fontWeight: FontWeight.w600,
      );
    }
    return QuestionIndicatorColors(
      background: colors.surfaceAlt,
      border: colors.borderSubtle,
      foreground: colors.textSecondary,
      icon: colors.textSecondary,
      fontWeight: FontWeight.w500,
    );
  }

  /// Pill / circle surface color.
  final Color background;

  /// Pill / circle stroke color.
  final Color border;

  /// Question number or label ink color.
  final Color foreground;

  /// Leading checkmark/status icon ink color.
  final Color icon;

  /// Typographic weight for the indicator label.
  final FontWeight fontWeight;
}

/// Compact pill segment strip for passage/section/task switching and `Focused | All` toggles.
class MzSegmentedPillStrip extends StatelessWidget {
  /// Creates an [MzSegmentedPillStrip].
  const new({
    required this.items,
    super.key,
  });

  /// Segment descriptors in left-to-right visual order.
  final List<({String label, bool isSelected, VoidCallback onTap})> items;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(2),
      decoration: BoxDecoration(
        color: colors.surfaceAlt,
        borderRadius: shapes.pillRadius,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: items
            .map((item) {
              return GestureDetector(
                onTap: item.onTap,
                child: Container(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: SpacingTokens.sm,
                    vertical: SpacingTokens.xs,
                  ),
                  decoration: BoxDecoration(
                    color: item.isSelected
                        ? colors.surface
                        : colors.surface.withValues(alpha: 0),
                    borderRadius: shapes.pillRadius,
                  ),
                  child: Text(
                    item.label,
                    style: typography.caption.copyWith(
                      color: item.isSelected
                          ? colors.textPrimary
                          : colors.textSecondary,
                      fontWeight: item.isSelected
                          ? FontWeight.w600
                          : FontWeight.w400,
                    ),
                  ),
                ),
              );
            })
            .toList(growable: false),
      ),
    );
  }
}

/// Header row pairing question progress text with the shared `Focused | All` strip.
class FocusedQuestionHeader extends StatelessWidget {
  /// Creates a [FocusedQuestionHeader].
  const new({
    required this.focusedMode,
    required this.activeQuestionNumber,
    required this.activePositionIndex,
    required this.totalCount,
    required this.onToggleFocusedMode,
    super.key,
  });

  /// Whether one-question-at-a-time focused mode is active.
  final bool focusedMode;

  /// Active 1-based question number.
  final int activeQuestionNumber;

  /// Zero-based position inside the current section/passage.
  final int activePositionIndex;

  /// Total question count inside the current section/passage.
  final int totalCount;

  /// Callback toggling focused (`true`) vs all-questions (`false`) mode.
  final ValueChanged<bool> onToggleFocusedMode;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Row(
      children: <Widget>[
        Expanded(
          child: Text(
            focusedMode
                ? 'Question $activeQuestionNumber (${activePositionIndex + 1} of $totalCount)'
                : 'All $totalCount questions',
            style: typography.caption.copyWith(
              color: colors.textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        MzSegmentedPillStrip(
          items: <({String label, bool isSelected, VoidCallback onTap})>[
            (
              label: 'Focused',
              isSelected: focusedMode,
              onTap: () => onToggleFocusedMode(true),
            ),
            (
              label: 'All',
              isSelected: !focusedMode,
              onTap: () => onToggleFocusedMode(false),
            ),
          ],
        ),
      ],
    );
  }
}

/// Shared `Previous` / `Next` step navigation row for focused question traversal.
class QuestionStepNavRow extends StatelessWidget {
  /// Creates a [QuestionStepNavRow].
  const new({
    required this.canGoPrevious,
    required this.canGoNext,
    required this.onPrevious,
    required this.onNext,
    super.key,
  });

  /// Whether a preceding question exists.
  final bool canGoPrevious;

  /// Whether a subsequent question exists.
  final bool canGoNext;

  /// Handler for `Previous` button tap.
  final VoidCallback? onPrevious;

  /// Handler for `Next` button tap.
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) => Row(
    children: <Widget>[
      Expanded(
        child: SecondaryButton(
          label: 'Previous',
          onPressed: canGoPrevious ? onPrevious : null,
        ),
      ),
      const SizedBox(width: SpacingTokens.sm),
      Expanded(
        child: SecondaryButton(
          label: 'Next',
          onPressed: canGoNext ? onNext : null,
        ),
      ),
    ],
  );
}

/// Rectangular 44px min-height question step pill (used in adaptive diagnostic blocks).
class MzQuestionStepPill extends StatelessWidget {
  /// Creates an [MzQuestionStepPill].
  const new({
    required this.label,
    required this.isSelected,
    required this.isAnswered,
    required this.onTap,
    super.key,
  });

  /// Pill text label (e.g. "Question 1").
  final String label;

  /// Whether this question is currently focused.
  final bool isSelected;

  /// Whether this question currently has a selected answer.
  final bool isAnswered;

  /// Tap callback switching focus to this question.
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);
    final palette = QuestionIndicatorColors.resolve(
      colors,
      isSelected: isSelected,
      isAnswered: isAnswered,
    );

    return Semantics(
      button: true,
      selected: isSelected,
      label: '$label${isAnswered ? ', answered' : ''}',
      child: InkWell(
        onTap: onTap,
        borderRadius: shapes.controlRadius,
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: SpacingTokens.sm,
            vertical: SpacingTokens.xs,
          ),
          decoration: BoxDecoration(
            color: palette.background,
            borderRadius: shapes.controlRadius,
            border: Border.all(
              color: palette.border,
              width: isSelected ? 1.5 : shapes.strokeWidth,
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              if (isAnswered) ...<Widget>[
                AppIcon(
                  LucideGlyph.checkCircle2,
                  size: 16,
                  color: palette.icon,
                ),
                const SizedBox(width: SpacingTokens.xs),
              ],
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: typography.secondary.copyWith(
                    color: palette.foreground,
                    fontWeight: palette.fontWeight,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Shared bottom bar with a 44×44 circular question jump strip and primary Submit CTA (`DIP`).
class ExamQuestionPaletteBar extends StatelessWidget {
  /// Creates an [ExamQuestionPaletteBar].
  const new({
    required this.items,
    required this.activeQuestionNumber,
    required this.onSelectQuestionNumber,
    required this.submitLabel,
    required this.submittingLabel,
    required this.isSubmitting,
    required this.onSubmit,
    super.key,
  });

  /// Ordered question progress items rendered as circular palette chips.
  final List<QuestionProgressItem> items;

  /// Currently focused 1-based question number.
  final int activeQuestionNumber;

  /// Callback triggered when tapping a question circle.
  final ValueChanged<int> onSelectQuestionNumber;

  /// Primary submit CTA text when idle.
  final String submitLabel;

  /// Primary submit CTA text while submission is in flight.
  final String submittingLabel;

  /// Whether submission is currently active.
  final bool isSubmitting;

  /// Submit button handler.
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return Container(
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
                children: items
                    .map((item) {
                      final isCurrent = item.number == activeQuestionNumber;
                      final palette = QuestionIndicatorColors.resolve(
                        colors,
                        isSelected: item.isAnswered,
                        isAnswered: item.isAnswered,
                      );
                      final circleColor = item.isAnswered
                          ? colors.primary
                          : colors.surfaceAlt;
                      final borderColor = item.isAnswered || isCurrent
                          ? colors.primary
                          : palette.border;
                      final textColor = item.isAnswered
                          ? colors.onPrimary
                          : (isCurrent ? colors.primary : colors.textSecondary);

                      return Semantics(
                        button: true,
                        selected: isCurrent,
                        label:
                            'Question ${item.number}${item.isAnswered ? ', answered' : ''}',
                        child: GestureDetector(
                          onTap: () => onSelectQuestionNumber(item.number),
                          child: Container(
                            margin: const EdgeInsetsDirectional.only(
                              end: SpacingTokens.xs,
                            ),
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: circleColor,
                              border: Border.all(
                                color: borderColor,
                                width: isCurrent ? 2 : shapes.strokeWidth,
                              ),
                            ),
                            child: Center(
                              child: Text(
                                '${item.number}',
                                style: typography.caption.copyWith(
                                  color: textColor,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    })
                    .toList(growable: false),
              ),
            ),
          ),
          const SizedBox(width: SpacingTokens.md),
          PrimaryButton(
            label: isSubmitting ? submittingLabel : submitLabel,
            isFullWidth: false,
            onPressed: isSubmitting ? null : onSubmit,
          ),
        ],
      ),
    );
  }
}

/// Leading visual indicator mode for [MzChoiceOptionTile] (`OCP`).
enum MzOptionLeadingStyle {
  /// Circular letter badge (e.g. "A", "B", "C") used in MCQ / Matching Headings.
  badge,

  /// Check-circle when selected or chevron when idle (used in Diagnostic MCQs).
  checkChevron,

  /// Radio circle dot when selected or empty circle when idle (used in Micro-Drills).
  radio,
}

/// Post-submission evaluation state for [MzChoiceOptionTile] (`OCP`).
enum MzOptionFeedback {
  /// Pre-submission interactive state.
  none,

  /// Highlighted as the verified correct answer after submission.
  correct,

  /// Selected by the learner but incorrect after submission.
  incorrectSelected,
}

/// Shared accessible selectable option tile supporting badge, check/chevron, and radio styles (`SRP` / `OCP`).
class MzChoiceOptionTile extends StatelessWidget {
  /// Creates an [MzChoiceOptionTile].
  const new({
    required this.text,
    required this.isSelected,
    required this.onTap,
    this.badgeLabel,
    this.leadingStyle = MzOptionLeadingStyle.badge,
    this.feedback = MzOptionFeedback.none,
    super.key,
  });

  /// Main option text displayed to the learner.
  final String text;

  /// Whether this option is currently selected.
  final bool isSelected;

  /// Tap callback (`null` disables interaction, e.g. after drill submission).
  final VoidCallback? onTap;

  /// Letter or short token shown when [leadingStyle] is [MzOptionLeadingStyle.badge].
  final String? badgeLabel;

  /// Leading indicator style.
  final MzOptionLeadingStyle leadingStyle;

  /// Optional post-submission grading state.
  final MzOptionFeedback feedback;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final Color bgColor;
    final Color borderColor;
    final double borderWidth;

    switch (feedback) {
      case MzOptionFeedback.correct:
        bgColor = colors.mintBg;
        borderColor = colors.success;
        borderWidth = 1.5;
      case MzOptionFeedback.incorrectSelected:
        bgColor = colors.dangerBg;
        borderColor = colors.error;
        borderWidth = 1.5;
      case MzOptionFeedback.none:
        borderWidth = isSelected ? 1.5 : shapes.strokeWidth;
        if (isSelected) {
          borderColor = colors.primary;
          bgColor = switch (leadingStyle) {
            MzOptionLeadingStyle.checkChevron => colors.blueBg,
            MzOptionLeadingStyle.radio => colors.primary.withValues(
              alpha: 0.08,
            ),
            MzOptionLeadingStyle.badge => colors.surfaceAlt,
          };
        } else {
          borderColor = colors.borderSubtle;
          bgColor = leadingStyle == MzOptionLeadingStyle.checkChevron
              ? colors.surfaceAlt
              : colors.surface;
        }
    }

    final Widget leadingWidget;
    switch (leadingStyle) {
      case MzOptionLeadingStyle.badge:
        leadingWidget = Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isSelected ? colors.primary : colors.surfaceAlt,
          ),
          child: Center(
            child: Text(
              badgeLabel ?? '',
              style: typography.caption.copyWith(
                color: isSelected ? colors.onPrimary : colors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        );
      case MzOptionLeadingStyle.checkChevron:
        leadingWidget = AppIcon(
          isSelected ? LucideGlyph.checkCircle2 : LucideGlyph.chevronRight,
          size: 16,
          color: isSelected ? colors.primary : colors.textTertiary,
        );
      case MzOptionLeadingStyle.radio:
        leadingWidget = AppIcon(
          isSelected ? LucideGlyph.circleDot : LucideGlyph.circle,
          size: 20,
          color: switch (feedback) {
            MzOptionFeedback.correct => colors.success,
            MzOptionFeedback.incorrectSelected => colors.error,
            MzOptionFeedback.none =>
              isSelected ? colors.primary : colors.textTertiary,
          },
        );
    }

    return Semantics(
      button: true,
      selected: isSelected,
      child: InkWell(
        onTap: onTap,
        borderRadius: shapes.controlRadius,
        child: Container(
          constraints: const BoxConstraints(minHeight: 44),
          padding: const EdgeInsetsDirectional.symmetric(
            horizontal: SpacingTokens.md,
            vertical: SpacingTokens.sm,
          ),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: shapes.controlRadius,
            border: Border.all(color: borderColor, width: borderWidth),
          ),
          child: Row(
            children: <Widget>[
              leadingWidget,
              const SizedBox(width: SpacingTokens.sm),
              Expanded(
                child: Text(
                  text,
                  style: leadingStyle == MzOptionLeadingStyle.badge
                      ? typography.secondary.copyWith(
                          color: colors.textPrimary,
                          fontWeight: isSelected
                              ? FontWeight.w600
                              : FontWeight.w400,
                        )
                      : typography.body.copyWith(
                          color: colors.textPrimary,
                          fontWeight: isSelected
                              ? FontWeight.w600
                              : FontWeight.w400,
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Shared row of equal-width 44px choice pills (e.g. TRUE / FALSE / NOT GIVEN).
class MzBinaryChoiceRow extends StatelessWidget {
  /// Creates an [MzBinaryChoiceRow].
  const new({
    required this.labels,
    required this.selectedLabel,
    required this.onSelect,
    super.key,
  });

  /// Choice labels displayed horizontally.
  final List<String> labels;

  /// Currently selected choice label, matched case-insensitively.
  final String? selectedLabel;

  /// Called with the tapped option label.
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);
    final normalizedSelected = selectedLabel?.toUpperCase();

    return Row(
      children: labels
          .map((lbl) {
            final isSelected = normalizedSelected == lbl.toUpperCase();
            return Expanded(
              child: Padding(
                padding: const EdgeInsetsDirectional.only(end: 4),
                child: Semantics(
                  button: true,
                  selected: isSelected,
                  child: GestureDetector(
                    onTap: () => onSelect(lbl),
                    child: Container(
                      constraints: const BoxConstraints(minHeight: 44),
                      padding: const EdgeInsetsDirectional.symmetric(
                        horizontal: SpacingTokens.xs,
                        vertical: SpacingTokens.sm,
                      ),
                      decoration: BoxDecoration(
                        color: isSelected ? colors.primary : colors.surfaceAlt,
                        borderRadius: shapes.compactRadius,
                        border: Border.all(
                          color: isSelected
                              ? colors.primary
                              : colors.borderSubtle,
                        ),
                      ),
                      child: Center(
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            lbl,
                            maxLines: 1,
                            style: typography.caption.copyWith(
                              color: isSelected
                                  ? colors.onPrimary
                                  : colors.textPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            );
          })
          .toList(growable: false),
    );
  }
}

/// Stateful controlled text field preserving cursor placement when external answers update (`SRP`).
class MzControlledAnswerField extends StatefulWidget {
  /// Creates an [MzControlledAnswerField].
  const new({
    required this.value,
    required this.hint,
    required this.onChanged,
    super.key,
  });

  /// Current external string value.
  final String value;

  /// Hint placeholder text.
  final String hint;

  /// Callback invoked on learner input changes.
  final ValueChanged<String> onChanged;

  @override
  State<MzControlledAnswerField> createState() =>
      _MzControlledAnswerFieldState();
}

class _MzControlledAnswerFieldState extends State<MzControlledAnswerField> {
  late final TextEditingController _controller;
  late final FocusNode _focusNode;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value);
    _focusNode = FocusNode();
  }

  @override
  void didUpdateWidget(covariant MzControlledAnswerField oldWidget) {
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

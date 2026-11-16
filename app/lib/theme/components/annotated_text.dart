import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_typography.dart';

/// Single inline edit annotation in written essays.
class InlineEditAnnotation {
  /// Creates an [InlineEditAnnotation].
  const new({
    required this.editId,
    required this.startOffset,
    required this.endOffset,
    required this.originalText,
    required this.suggestedText,
    required this.criterionCode,
    required this.rationale,
  });

  /// Unique identifier.
  final String editId;

  /// Start UTF-16 character index in raw text.
  final int startOffset;

  /// End UTF-16 character index in raw text.
  final int endOffset;

  /// Original student text snippet.
  final String originalText;

  /// AI-suggested band-8+ replacement.
  final String suggestedText;

  /// IELTS criterion code (`TA`, `TR`, `CC`, `LR`, `GRA`).
  final String criterionCode;

  /// Educational rationale for this upgrade.
  final String rationale;
}

/// Essay and passage renderer with interactive annotated span highlights (design.md Sec. 5, Screenshot 12).
class AnnotatedText extends StatelessWidget {
  /// Creates an [AnnotatedText].
  const new({
    required this.rawText,
    this.edits = const <InlineEditAnnotation>[],
    this.onTapEdit,
    this.textStyle,
    super.key,
  });

  /// Full essay or passage content string.
  final String rawText;

  /// List of sorted non-overlapping inline annotations.
  final List<InlineEditAnnotation> edits;

  /// Callback when user taps an annotated span.
  final ValueChanged<InlineEditAnnotation>? onTapEdit;

  /// Optional base typography override.
  final TextStyle? textStyle;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    final baseStyle =
        textStyle ??
        typography.readingPassage.copyWith(color: colors.textPrimary);

    if (edits.isEmpty) {
      return Text(rawText, style: baseStyle);
    }

    final spans = <InlineSpan>[];
    var currentIndex = 0;

    // Sort edits by start offset defensively
    final sortedEdits = List<InlineEditAnnotation>.from(edits)
      ..sort((a, b) => a.startOffset.compareTo(b.startOffset));

    for (final edit in sortedEdits) {
      final rawStart = edit.startOffset.clamp(0, rawText.length);
      final rawEnd = edit.endOffset.clamp(rawStart, rawText.length);
      final start = math.max(rawStart, currentIndex);
      final end = math.max(start, rawEnd);
      if (end <= start) {
        continue;
      }

      // Preceding unannotated text
      if (start > currentIndex) {
        spans.add(
          TextSpan(
            text: rawText.substring(currentIndex, start),
            style: baseStyle,
          ),
        );
      }

      // Highlighted annotation span with accessible button semantics (`UX-10`)
      final highlightedText = rawText.substring(start, end);
      spans.add(
        WidgetSpan(
          alignment: PlaceholderAlignment.baseline,
          baseline: TextBaseline.alphabetic,
          child: Semantics(
            button: onTapEdit != null,
            label:
                '${edit.criterionCode} feedback: $highlightedText. Suggestion: ${edit.suggestedText}',
            child: InkWell(
              onTap: onTapEdit != null ? () => onTapEdit!(edit) : null,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                decoration: BoxDecoration(
                  color: colors.writingAccent.withValues(alpha: 0.18),
                  border: Border(
                    bottom: BorderSide(
                      color: colors.writingAccent,
                      width: 2,
                    ),
                  ),
                ),
                child: Text(
                  highlightedText,
                  style: baseStyle.copyWith(
                    fontWeight: FontWeight.w600,
                    color: colors.writingAccent,
                  ),
                ),
              ),
            ),
          ),
        ),
      );

      currentIndex = end;
    }

    // Remaining trailing text
    if (currentIndex < rawText.length) {
      spans.add(
        TextSpan(
          text: rawText.substring(currentIndex),
          style: baseStyle,
        ),
      );
    }

    return Text.rich(
      TextSpan(children: spans),
      style: baseStyle,
    );
  }
}

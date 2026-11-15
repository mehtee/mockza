import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Type of speech hesitation or grammar annotation.
enum SpeechAnnotationType {
  /// Unnatural or prolonged silence/pause (e.g. `[2.1s pause]`).
  pause,

  /// Filler words (e.g. `um`, `uh`, `like`).
  filler,

  /// Grammatical inaccuracy.
  grammar,

  /// Unnatural phrasing or collocation.
  phrasing,
}

/// Single speech annotation token.
class SpeechAnnotation {
  /// Creates a [SpeechAnnotation].
  const new({
    required this.type,
    required this.startOffset,
    required this.endOffset,
    required this.originalText,
    required this.suggestion,
    required this.rationale,
  });

  /// The annotation category.
  final SpeechAnnotationType type;

  /// Start character offset in segment text.
  final int startOffset;

  /// End character offset in segment text.
  final int endOffset;

  /// Highlighted phrase.
  final String originalText;

  /// Suggested correction or upgrade.
  final String suggestion;

  /// Explanatory feedback rationale.
  final String rationale;
}

/// Spoken transcript segment with accessible non-color-only annotations (design.md Sec. 5, Screenshot 13).
class TranscriptSegmentWidget extends StatelessWidget {
  /// Creates a [TranscriptSegmentWidget].
  const new({
    required this.text,
    required this.startMs,
    required this.endMs,
    this.annotations = const <SpeechAnnotation>[],
    this.isActive = false,
    this.onTapPlaySegment,
    this.onTapAnnotation,
    super.key,
  });

  /// Verbatim speech segment text.
  final String text;

  /// Start timestamp in track.
  final int startMs;

  /// End timestamp in track.
  final int endMs;

  /// Speech annotations in this segment.
  final List<SpeechAnnotation> annotations;

  /// Whether audio is actively playing this segment.
  final bool isActive;

  /// Tap callback to play audio for this segment.
  final VoidCallback? onTapPlaySegment;

  /// Tap callback when selecting an annotation.
  final ValueChanged<SpeechAnnotation>? onTapAnnotation;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    String formatMs(int ms) {
      final s = ms ~/ 1000;
      final m = s ~/ 60;
      final remS = s % 60;
      return '${m.toString().padLeft(2, '0')}:${remS.toString().padLeft(2, '0')}';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: SpacingTokens.md),
      padding: const EdgeInsets.all(SpacingTokens.md),
      decoration: BoxDecoration(
        color: isActive ? colors.surfaceAlt : colors.surface,
        borderRadius: shapes.controlRadius,
        border: Border.all(
          color: isActive ? colors.primary : colors.borderSubtle,
          width: isActive ? 1.5 : shapes.strokeWidth,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          // Header: Timestamp badge + play button
          Row(
            children: <Widget>[
              Text(
                '${formatMs(startMs)} – ${formatMs(endMs)}',
                style: typography.caption.copyWith(
                  color: colors.textSecondary,
                  fontFeatures: const <FontFeature>[
                    FontFeature.tabularFigures(),
                  ],
                ),
              ),
              const Spacer(),
              if (onTapPlaySegment != null)
                InkWell(
                  onTap: onTapPlaySegment,
                  child: AppIcon(
                    LucideGlyph.play,
                    size: 16,
                    color: colors.textSecondary,
                  ),
                ),
            ],
          ),
          const SizedBox(height: SpacingTokens.sm),
          // Segment text with underline annotation styling
          Text(
            text,
            style: typography.body.copyWith(
              height: 1.6,
              color: colors.textPrimary,
            ),
          ),
          if (annotations.isNotEmpty) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            Wrap(
              spacing: SpacingTokens.sm,
              runSpacing: SpacingTokens.xs,
              children: annotations.map((ann) {
                final (LucideGlyph glyph, Color tintColor) = switch (ann.type) {
                  SpeechAnnotationType.pause => (
                    LucideGlyph.timer,
                    colors.vocabAccent,
                  ),
                  SpeechAnnotationType.filler => (
                    LucideGlyph.alertCircle,
                    colors.warning,
                  ),
                  SpeechAnnotationType.grammar => (
                    LucideGlyph.pencil,
                    colors.error,
                  ),
                  SpeechAnnotationType.phrasing => (
                    LucideGlyph.sparkles,
                    colors.speakingAccent,
                  ),
                };

                return InkWell(
                  onTap: onTapAnnotation != null
                      ? () => onTapAnnotation!(ann)
                      : null,
                  borderRadius: shapes.compactRadius,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: SpacingTokens.sm,
                      vertical: SpacingTokens.xs,
                    ),
                    decoration: BoxDecoration(
                      color: colors.surfaceAlt,
                      borderRadius: shapes.compactRadius,
                      border: Border.all(
                        color: tintColor.withValues(alpha: 0.5),
                        width: shapes.strokeWidth,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        AppIcon(glyph, size: 12, color: tintColor),
                        const SizedBox(width: SpacingTokens.xs),
                        Text(
                          ann.originalText,
                          style: typography.caption.copyWith(
                            color: colors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          ' → ${ann.suggestion}',
                          style: typography.caption.copyWith(
                            color: colors.success,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ],
      ),
    );
  }
}

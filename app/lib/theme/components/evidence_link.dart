import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Clickable evidence quote anchor linking questions to passage text (design.md Sec. 5, Screenshot 09).
class EvidenceLink extends StatelessWidget {
  /// Creates an [EvidenceLink].
  const new({
    required this.paragraphIndex,
    required this.exactQuote,
    required this.onTapJump,
    super.key,
  });

  /// Paragraph index (1-based for learner presentation).
  final int paragraphIndex;

  /// Verbatim evidence quote excerpt from passage.
  final String exactQuote;

  /// Callback when user taps anchor to jump to passage.
  final VoidCallback onTapJump;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final paragraphLabel = (paragraphIndex >= 1 && paragraphIndex <= 26)
        ? 'Paragraph ${String.fromCharCode(64 + paragraphIndex)} (Section $paragraphIndex)'
        : 'Paragraph $paragraphIndex';
    return InkWell(
      onTap: onTapJump,
      borderRadius: shapes.controlRadius,
      child: Container(
        padding: const EdgeInsets.all(SpacingTokens.md),
        decoration: BoxDecoration(
          color: colors.mintBg,
          borderRadius: shapes.controlRadius,
          border: Border.all(
            color: colors.readingAccent.withValues(alpha: 0.35),
            width: shapes.strokeWidth,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Row(
              children: <Widget>[
                AppIcon(
                  LucideGlyph.bookOpen,
                  size: 14,
                  color: colors.readingAccent,
                ),
                const SizedBox(width: SpacingTokens.xs),
                Expanded(
                  child: Text(
                    'Evidence in $paragraphLabel',
                    style: typography.caption.copyWith(
                      color: colors.readingAccent,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: SpacingTokens.xs),
                Text(
                  'Jump to text →',
                  style: typography.caption.copyWith(
                    color: colors.readingAccent,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: SpacingTokens.xs),
            Text(
              '“$exactQuote”',
              style: typography.caption.copyWith(
                color: colors.textPrimary,
                fontStyle: FontStyle.italic,
              ),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

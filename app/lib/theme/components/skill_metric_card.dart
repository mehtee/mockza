import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/primitives.dart';

/// 2-column skill card from dashboard grid (design.md Sec. 4.3 & 5, Screenshot 01).
/// Displays skill icon well, title, numeric score, and thin progress bar.
class SkillMetricCard extends StatelessWidget {
  /// Creates a [SkillMetricCard].
  const new({
    String? skillTitle,
    String? title,
    this.statusLabel,
    this.accent,
    LucideGlyph? glyph,
    IconWellTint? tint,
    this.score,
    this.maxScore = 9.0,
    this.onTap,
    super.key,
  }) : skillTitle = skillTitle ?? title ?? '',
       glyph = glyph ?? LucideGlyph.layers3,
       tint = tint ?? IconWellTint.blue;

  /// Skill display title (e.g. "Speaking", "Writing").
  final String skillTitle;

  /// Optional sub-label description.
  final String? statusLabel;

  /// Optional accent color override.
  final Color? accent;

  /// Skill vector glyph.
  final LucideGlyph glyph;

  /// Semantic icon well tint.
  final IconWellTint tint;

  /// Current evaluated band score (or null if unattempted).
  final double? score;

  /// Scale maximum (9.0 for IELTS).
  final double maxScore;

  /// Tap callback opening skill analytics.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final hasScore = score != null && score! > 0.0;
    final fraction = hasScore ? (score! / maxScore).clamp(0.0, 1.0) : 0.0;

    final accentColor = switch (tint) {
      IconWellTint.blue => colors.speakingAccent,
      IconWellTint.violet => colors.writingAccent,
      IconWellTint.mint => colors.readingAccent,
      IconWellTint.amber => colors.vocabAccent,
      IconWellTint.danger => colors.error,
      IconWellTint.neutral => colors.primary,
    };

    return MzCard(
      onTap: onTap,
      padding: const EdgeInsets.all(SpacingTokens.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          // Top row: Icon well + skill title
          Row(
            children: <Widget>[
              IconWell(
                glyph: glyph,
                tint: tint,
                size: 36,
                iconSize: 18,
              ),
              const SizedBox(width: SpacingTokens.sm),
              Expanded(
                child: Text(
                  skillTitle,
                  style: typography.cardTitle.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          // Score display
          Text(
            hasScore ? score!.toStringAsFixed(1) : '—',
            style: typography.cardScore.copyWith(
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: SpacingTokens.sm),
          // Thin progress bar
          Container(
            height: 4,
            decoration: BoxDecoration(
              color: colors.track,
              borderRadius: shapes.pillRadius,
            ),
            child: FractionallySizedBox(
              alignment: AlignmentDirectional.centerStart,
              widthFactor: fraction,
              child: Container(
                decoration: BoxDecoration(
                  color: accentColor,
                  borderRadius: shapes.pillRadius,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

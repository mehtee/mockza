import 'package:flutter/material.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/score_meter.dart';
import 'package:mockza/theme/primitives.dart';

/// Hero score card displayed prominently on dashboard (design.md Sec. 4.3 & 5, Screenshot 01).
/// Honest data: displays "Not yet estimated" + diagnostic CTA when insufficient history exists.
class MetricHero extends StatelessWidget {
  /// Creates a [MetricHero].
  const new({
    this.estimatedScore,
    this.targetScore = 7.5,
    this.minScore = 0,
    this.maxScore = 9,
    this.scoreDeltaText,
    this.scaleLabel = 'Estimated Band',
    this.unestimatedTitle = 'Not yet estimated',
    this.unestimatedSubtitle =
        'Complete your free diagnostic to calculate your baseline band score.',
    this.diagnosticCtaLabel = 'Start Free Diagnostic',
    this.targetPrefix = 'Target',
    this.usePersianDigits = false,
    this.onTapDiagnostic,
    this.onTapCard,
    super.key,
  });

  /// Evaluated score, or null if no attempts exist yet.
  final double? estimatedScore;

  /// Target band score (e.g. 7.5).
  final double targetScore;

  /// Scale floor for this track (`0`, `1`, or `10`).
  final double minScore;

  /// Scale ceiling for this track (`9`, `6`, `90`, or `160`).
  final double maxScore;

  /// Optional change pill text (e.g. "+0.5 this month").
  /// Rule #6: ONLY show when supported by sufficient attempts.
  final String? scoreDeltaText;

  /// Scale metric label (e.g. "Estimated Band" for IELTS, "Estimated Score" for PTE/DET).
  final String scaleLabel;

  /// Empty-state headline shown when no evaluated attempts exist yet.
  final String unestimatedTitle;

  /// Empty-state subtitle shown when no evaluated attempts exist yet.
  final String unestimatedSubtitle;

  /// Call-to-action button label for launching diagnostic.
  final String diagnosticCtaLabel;

  /// Prefix word before target score value inside [ScoreMeter].
  final String targetPrefix;

  /// Whether to render numerals using Persian digits.
  final bool usePersianDigits;

  /// Callback when tapping diagnostic CTA.
  final VoidCallback? onTapDiagnostic;

  /// Optional card tap handler.
  final VoidCallback? onTapCard;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    final hasScore = estimatedScore != null && estimatedScore! > 0.0;
    final rawHeroScore = hasScore
        ? ((maxScore > 10 || estimatedScore! > 9.5)
              ? estimatedScore!.round().toString()
              : estimatedScore!.toStringAsFixed(1))
        : '';
    final displayHeroScore = usePersianDigits
        ? EdgeNumerals.toPersianDigits(rawHeroScore)
        : rawHeroScore;

    return MzCard(
      variant: MzCardVariant.hero,
      onTap: onTapCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          // Header row: Scale label + delta pill
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Expanded(
                child: Text(
                  scaleLabel,
                  style: typography.secondary.copyWith(
                    color: colors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (hasScore && scoreDeltaText != null) ...<Widget>[
                const SizedBox(width: SpacingTokens.sm),
                MzChip(
                  label: scoreDeltaText!,
                  glyph: LucideGlyph.trendingUp,
                  variant: MzChipVariant.positive,
                ),
              ],
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          if (hasScore) ...<Widget>[
            // Big 72pt tabular score
            Text(
              displayHeroScore,
              style: typography.heroScore.copyWith(
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: SpacingTokens.lg),
            // Progress meter
            ScoreMeter(
              score: estimatedScore,
              targetScore: targetScore,
              minScore: minScore,
              maxScore: maxScore,
              targetPrefix: targetPrefix,
              usePersianDigits: usePersianDigits,
            ),
          ] else ...<Widget>[
            // Honest unestimated state (Rule #6)
            Text(
              unestimatedTitle,
              style: typography.headline.copyWith(
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: SpacingTokens.xs),
            Text(
              unestimatedSubtitle,
              style: typography.secondary.copyWith(
                color: colors.textSecondary,
              ),
            ),
            const SizedBox(height: SpacingTokens.lg),
            PrimaryButton(
              label: diagnosticCtaLabel,
              trailingGlyph: Directionality.of(context) == TextDirection.rtl
                  ? LucideGlyph.arrowLeft
                  : LucideGlyph.arrowRight,
              onPressed: onTapDiagnostic,
            ),
          ],
        ],
      ),
    );
  }
}

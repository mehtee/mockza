import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/primitives.dart';

/// Criterion comparison model for [CompareAttempts].
class CriterionDelta {
  /// Creates a [CriterionDelta].
  const new({
    required this.code,
    required this.label,
    required this.previousBand,
    required this.currentBand,
  });

  /// Short code (e.g. "TA", "CC", "FC").
  final String code;

  /// Full criterion name (e.g. "Task Achievement").
  final String label;

  /// Score in first attempt.
  final double previousBand;

  /// Score in second attempt.
  final double currentBand;

  /// Numeric score difference.
  double get delta => currentBand - previousBand;
}

/// Comparison widget displaying deltas between two attempts (design.md Sec. 5, Screenshots 12 & 14).
class CompareAttempts extends StatelessWidget {
  /// Creates a [CompareAttempts].
  const new({
    required this.attempt1Title,
    required this.attempt2Title,
    required this.attempt1Overall,
    required this.attempt2Overall,
    required this.criteriaDeltas,
    super.key,
  });

  /// Label for baseline attempt (e.g. "Attempt 1 · Oct 10").
  final String attempt1Title;

  /// Label for comparison attempt (e.g. "Attempt 2 · Oct 14").
  final String attempt2Title;

  /// Baseline overall band score.
  final double attempt1Overall;

  /// Current overall band score.
  final double attempt2Overall;

  /// Per-criterion comparison points.
  final List<CriterionDelta> criteriaDeltas;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final overallDelta = attempt2Overall - attempt1Overall;
    final isPositive = overallDelta > 0;

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          // Header summary: Overall band change
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'Overall Band Comparison',
                    style: typography.cardTitle.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  Text(
                    '$attempt1Title vs $attempt2Title',
                    style: typography.caption.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
              MzChip(
                label:
                    '${isPositive ? "+" : ""}${(attempt1Overall > 9.5 || attempt2Overall > 9.5) ? overallDelta.round().toString() : overallDelta.toStringAsFixed(1)}',
                glyph: isPositive ? LucideGlyph.trendingUp : null,
                variant: isPositive
                    ? MzChipVariant.positive
                    : MzChipVariant.neutral,
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.lg),
          // Large side-by-side band comparison
          Container(
            padding: const EdgeInsets.all(SpacingTokens.md),
            decoration: BoxDecoration(
              color: colors.surfaceAlt,
              borderRadius: shapes.controlRadius,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: <Widget>[
                Column(
                  children: <Widget>[
                    Text(
                      'Attempt 1',
                      style: typography.caption.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      attempt1Overall > 9.5
                          ? attempt1Overall.round().toString()
                          : attempt1Overall.toStringAsFixed(1),
                      style: typography.cardScore.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
                AppIcon(
                  LucideGlyph.arrowRight,
                  size: 20,
                  color: colors.textTertiary,
                ),
                Column(
                  children: <Widget>[
                    Text(
                      'Attempt 2',
                      style: typography.caption.copyWith(
                        color: colors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      attempt2Overall > 9.5
                          ? attempt2Overall.round().toString()
                          : attempt2Overall.toStringAsFixed(1),
                      style: typography.cardScore.copyWith(
                        color: colors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: SpacingTokens.lg),
          // Per-criterion rows
          ...criteriaDeltas.map((criterion) {
            final cDelta = criterion.delta;
            final isCDiff = cDelta != 0.0;
            final isCPositive = cDelta > 0;
            final isIntScale =
                criterion.previousBand > 9.5 ||
                criterion.currentBand > 9.5 ||
                attempt1Overall > 9.5 ||
                attempt2Overall > 9.5;
            String fmt(double v) =>
                isIntScale ? v.round().toString() : v.toStringAsFixed(1);

            return Padding(
              padding: const EdgeInsets.symmetric(vertical: SpacingTokens.sm),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      criterion.label,
                      style: typography.body.copyWith(
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  Text(
                    '${fmt(criterion.previousBand)} → ${fmt(criterion.currentBand)}',
                    style: typography.secondary.copyWith(
                      color: colors.textSecondary,
                      fontFeatures: const <FontFeature>[
                        FontFeature.tabularFigures(),
                      ],
                    ),
                  ),
                  const SizedBox(width: SpacingTokens.md),
                  SizedBox(
                    width: 54,
                    child: Align(
                      alignment: AlignmentDirectional.centerEnd,
                      child: isCDiff
                          ? Text(
                              '${isCPositive ? "+" : ""}${fmt(cDelta)}',
                              style: typography.caption.copyWith(
                                color: isCPositive
                                    ? colors.success
                                    : colors.warning,
                                fontWeight: FontWeight.w700,
                              ),
                            )
                          : Text(
                              isIntScale ? '0' : '0.0',
                              style: typography.caption.copyWith(
                                color: colors.textTertiary,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

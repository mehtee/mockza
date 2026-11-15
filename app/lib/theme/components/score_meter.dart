import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_gradients.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Scale-aware progress meter with target tick (design.md Sec. 4.4 & 5).
class ScoreMeter extends StatelessWidget {
  /// Creates a [ScoreMeter].
  const new({
    double? score,
    double? bandScore,
    double? targetScore,
    this.label,
    this.minScore = 0.0,
    this.maxScore = 9.0,
    this.trackHeight = 8.0,
    this.showLabels = true,
    super.key,
  }) : score = score ?? bandScore ?? 0.0,
       targetScore = targetScore ?? 7.0;

  /// Current evaluated score.
  final double score;

  /// Optional custom label text.
  final String? label;

  /// Target band score.
  final double targetScore;

  /// Minimum scale floor (0.0 for IELTS).
  final double minScore;

  /// Maximum scale ceiling (9.0 for IELTS).
  final double maxScore;

  /// Height of the track in logical pixels (7–10px per spec).
  final double trackHeight;

  /// Whether to render min/max and target text labels below the meter.
  final bool showLabels;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final gradients = AppGradients.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final range = maxScore - minScore;
    final scoreFraction = range > 0
        ? ((score - minScore) / range).clamp(0.0, 1.0)
        : 0.0;
    final targetFraction = range > 0
        ? ((targetScore - minScore) / range).clamp(0.0, 1.0)
        : 0.0;

    return Semantics(
      label:
          'Score progress ${score.toStringAsFixed(1)} of ${maxScore.toStringAsFixed(1)}, target ${targetScore.toStringAsFixed(1)}',
      value: score.toStringAsFixed(1),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          LayoutBuilder(
            builder: (context, constraints) {
              final totalWidth = constraints.maxWidth;
              final targetX = (totalWidth * targetFraction).clamp(
                0.0,
                totalWidth,
              );

              return Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.centerLeft,
                children: <Widget>[
                  // Track background
                  Container(
                    height: trackHeight,
                    decoration: BoxDecoration(
                      color: colors.track,
                      borderRadius: shapes.pillRadius,
                    ),
                  ),
                  // Score gradient fill
                  FractionallySizedBox(
                    widthFactor: scoreFraction,
                    child: Container(
                      height: trackHeight,
                      decoration: BoxDecoration(
                        gradient: gradients.scoreFill,
                        borderRadius: shapes.pillRadius,
                      ),
                    ),
                  ),
                  // Target tick marker line
                  Positioned(
                    left: targetX - 1.5,
                    child: Container(
                      width: 3,
                      height: trackHeight + 6,
                      decoration: BoxDecoration(
                        color: colors.textPrimary,
                        borderRadius: shapes.pillRadius,
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
          if (showLabels) ...<Widget>[
            const SizedBox(height: SpacingTokens.xs),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[
                Text(
                  minScore.toStringAsFixed(0),
                  style: typography.caption.copyWith(
                    color: colors.textTertiary,
                  ),
                ),
                Text(
                  'Target ${targetScore.toStringAsFixed(1)}',
                  style: typography.caption.copyWith(
                    color: colors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  maxScore.toStringAsFixed(0),
                  style: typography.caption.copyWith(
                    color: colors.textTertiary,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

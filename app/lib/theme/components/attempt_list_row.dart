import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/primitives.dart';

/// Single attempt row in history list (design.md Sec. 5, Screenshot 22).
/// Displays skill icon, attempt title, date, score badge, and inline retry when pending/failed.
class AttemptListRow extends StatelessWidget {
  /// Creates an [AttemptListRow].
  const new({
    required this.attemptId,
    required this.title,
    required this.dateLabel,
    required this.glyph,
    required this.tint,
    this.overallBand,
    this.statusLabel,
    this.isPending = false,
    this.isFailed = false,
    this.onTap,
    this.onTapRetry,
    super.key,
  });

  /// Unique attempt identifier.
  final String attemptId;

  /// Attempt title (e.g. "Speaking Part 2 - Environment").
  final String title;

  /// Formatted date/duration metadata (e.g. "Oct 14 · 12m").
  final String dateLabel;

  /// Skill vector glyph.
  final LucideGlyph glyph;

  /// Icon well tint.
  final IconWellTint tint;

  /// Evaluated overall band score.
  final double? overallBand;

  /// Status description when not scored yet.
  final String? statusLabel;

  /// Whether attempt is currently uploading or evaluating.
  final bool isPending;

  /// Whether attempt encountered a network or evaluation failure.
  final bool isFailed;

  /// Tap callback opening attempt results.
  final VoidCallback? onTap;

  /// Inline retry callback.
  final VoidCallback? onTapRetry;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    Widget trailingWidget;

    if (isFailed) {
      trailingWidget = InkWell(
        onTap: onTapRetry,
        borderRadius: shapes.controlRadius,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: SpacingTokens.sm,
            vertical: SpacingTokens.xs,
          ),
          decoration: BoxDecoration(
            color: colors.dangerBg,
            borderRadius: shapes.controlRadius,
            border: Border.all(
              color: colors.error.withValues(alpha: 0.5),
              width: shapes.strokeWidth,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              AppIcon(LucideGlyph.refreshCw, size: 14, color: colors.error),
              const SizedBox(width: SpacingTokens.xs),
              Text(
                'Retry',
                style: typography.caption.copyWith(
                  color: colors.error,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      );
    } else if (isPending) {
      trailingWidget = MzChip(
        label: statusLabel ?? 'Evaluating...',
        glyph: LucideGlyph.loaderCircle,
      );
    } else if (overallBand != null) {
      trailingWidget = Container(
        padding: const EdgeInsets.symmetric(
          horizontal: SpacingTokens.md,
          vertical: SpacingTokens.xs + 2,
        ),
        decoration: BoxDecoration(
          color: colors.surfaceAlt,
          borderRadius: shapes.pillRadius,
          border: Border.all(
            color: colors.borderStrong,
            width: shapes.strokeWidth,
          ),
        ),
        child: Text(
          overallBand!.toStringAsFixed(1),
          style: typography.cardTitle.copyWith(
            fontWeight: FontWeight.w700,
            color: colors.textPrimary,
          ),
        ),
      );
    } else {
      trailingWidget = const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: SpacingTokens.md),
      child: MzCard(
        onTap: onTap,
        padding: const EdgeInsets.all(SpacingTokens.lg),
        child: Row(
          children: <Widget>[
            IconWell(glyph: glyph, tint: tint, size: 40, iconSize: 20),
            const SizedBox(width: SpacingTokens.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text(
                    title,
                    style: typography.body.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  Text(
                    dateLabel,
                    style: typography.caption.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: SpacingTokens.md),
            trailingWidget,
          ],
        ),
      ),
    );
  }
}

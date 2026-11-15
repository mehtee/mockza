import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Semantic role for [MzChip].
enum MzChipVariant {
  /// Default informational or neutral pill.
  neutral,

  /// Target score highlight.
  target,

  /// Positive progress / completed state.
  positive,

  /// Warning / attention state.
  warning,

  /// Quota allowance remaining.
  quota,
}

/// Standard 36–40px pill chip conforming to design.md Sec. 5.
class MzChip extends StatelessWidget {
  /// Creates an [MzChip].
  const new({
    required this.label,
    this.glyph,
    this.variant = MzChipVariant.neutral,
    this.isSelected = false,
    this.onTap,
    super.key,
  });

  /// Chip display label.
  final String label;

  /// Optional leading vector icon.
  final LucideGlyph? glyph;

  /// Semantic visual style.
  final MzChipVariant variant;

  /// Whether chip is in active selected toggle state.
  final bool isSelected;

  /// Optional tap handler for filter/selection chips.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    Color textColor;
    Color borderColor;
    Color bgColor;

    if (isSelected) {
      textColor = colors.onPrimary;
      borderColor = colors.primary;
      bgColor = colors.primary;
    } else {
      switch (variant) {
        case MzChipVariant.neutral:
          textColor = colors.textSecondary;
          borderColor = colors.borderSubtle;
          bgColor = colors.surfaceAlt;
        case MzChipVariant.target:
          textColor = colors.primary;
          borderColor = colors.primary.withValues(alpha: 0.4);
          bgColor = colors.surfaceAlt;
        case MzChipVariant.positive:
          textColor = colors.success;
          borderColor = colors.success.withValues(alpha: 0.3);
          bgColor = colors.mintBg;
        case MzChipVariant.warning:
          textColor = colors.warning;
          borderColor = colors.warning.withValues(alpha: 0.3);
          bgColor = colors.amberBg;
        case MzChipVariant.quota:
          textColor = colors.textPrimary;
          borderColor = colors.borderStrong;
          bgColor = colors.surfaceAlt;
      }
    }

    Widget chipContent = Container(
      constraints: const BoxConstraints(minHeight: 36),
      padding: const EdgeInsets.symmetric(
        horizontal: SpacingTokens.md,
        vertical: SpacingTokens.xs + 2,
      ),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: shapes.pillRadius,
        border: Border.all(color: borderColor, width: shapes.strokeWidth),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (glyph != null) ...<Widget>[
            AppIcon(glyph!, size: 14, color: textColor),
            const SizedBox(width: SpacingTokens.xs + 2),
          ],
          Text(
            label,
            style: typography.caption.copyWith(
              color: textColor,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );

    if (onTap != null) {
      chipContent = InkWell(
        onTap: onTap,
        borderRadius: shapes.pillRadius,
        child: chipContent,
      );
    }

    return chipContent;
  }
}

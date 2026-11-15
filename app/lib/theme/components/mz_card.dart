import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_gradients.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/primitives.dart';

/// Card style variant.
enum MzCardVariant {
  /// Default card with surface background and 1px border.
  standard,

  /// Hero card with gradient background.
  hero,

  /// Action card with recommendation gradient.
  action,

  /// Nested panel with surfaceAlt background.
  surfaceAlt,
}

/// Standardized card component adhering to design.md Sec. 2.3 & 5.
class MzCard extends StatelessWidget {
  /// Creates an [MzCard].
  const new({
    required this.child,
    this.variant = MzCardVariant.standard,
    this.padding,
    this.onTap,
    this.borderColor,
    this.borderRadius,
    super.key,
  });

  /// Card body content.
  final Widget child;

  /// Card style variant.
  final MzCardVariant variant;

  /// Internal padding override. Default is 20dp.
  final EdgeInsetsGeometry? padding;

  /// Optional tap callback for interactive cards.
  final VoidCallback? onTap;

  /// Custom border stroke color override.
  final Color? borderColor;

  /// Custom corner radius override.
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final gradients = AppGradients.of(context);
    final shapes = AppShapes.of(context);

    final radius = borderRadius ?? shapes.cardRadius;
    final strokeColor = borderColor ?? colors.borderSubtle;

    final decoration = switch (variant) {
      MzCardVariant.standard => BoxDecoration(
        color: colors.surface,
        borderRadius: radius,
        border: Border.all(color: strokeColor, width: shapes.strokeWidth),
      ),
      MzCardVariant.hero => BoxDecoration(
        gradient: gradients.heroCard,
        borderRadius: radius,
        border: Border.all(color: strokeColor, width: shapes.strokeWidth),
      ),
      MzCardVariant.action => BoxDecoration(
        gradient: gradients.recommendationCard,
        borderRadius: radius,
        border: Border.all(color: strokeColor, width: shapes.strokeWidth),
      ),
      MzCardVariant.surfaceAlt => BoxDecoration(
        color: colors.surfaceAlt,
        borderRadius: radius,
        border: Border.all(color: strokeColor, width: shapes.strokeWidth),
      ),
    };

    Widget content = Padding(
      padding: padding ?? const EdgeInsets.all(SpacingTokens.pageInset),
      child: child,
    );

    if (onTap != null) {
      content = InkWell(
        onTap: onTap,
        borderRadius: radius,
        splashColor: colors.surfaceHover,
        highlightColor: colors.surfaceHover.withValues(alpha: 0.5),
        child: content,
      );
    }

    return Container(
      decoration: decoration,
      child: ClipRRect(
        borderRadius: radius,
        child: content,
      ),
    );
  }
}

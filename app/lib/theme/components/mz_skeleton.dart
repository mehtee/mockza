import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_shapes.dart';

/// Low-contrast placeholder skeleton (design.md Sec. 5).
class MzSkeleton extends StatelessWidget {
  /// Creates an [MzSkeleton].
  const new({
    this.width,
    this.height = 16,
    this.borderRadius,
    super.key,
  });

  /// Placeholder width (null expands).
  final double? width;

  /// Placeholder height.
  final double height;

  /// Corner radius override.
  final BorderRadius? borderRadius;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);

    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: colors.surfaceAlt,
        borderRadius: borderRadius ?? shapes.controlRadius,
      ),
    );
  }
}

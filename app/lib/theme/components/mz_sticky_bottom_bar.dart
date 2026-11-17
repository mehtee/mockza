import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/primitives.dart';
import 'package:mockza/theme/responsive_layout.dart';

/// Thumb-zone sticky bottom action surface with hairline top divider,
/// `SafeArea(top: false)`, and responsive centering on tablets/desktops.
class MzStickyBottomBar extends StatelessWidget {
  /// Creates an [MzStickyBottomBar].
  const new({
    required this.child,
    this.padding,
    this.maxWidth = SpacingTokens.maxContentWidth,
    this.showTopBorder = true,
    super.key,
  });

  /// Action row/column placed inside the bottom surface.
  final Widget child;

  /// Optional custom padding inside the centered container.
  final EdgeInsetsGeometry? padding;

  /// Maximum width on wide viewports (default `680dp`).
  final double maxWidth;

  /// Whether to paint the 1px top separator line.
  final bool showTopBorder;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final gutter = MzResponsive.horizontalGutterOf(context);
    final viewBottom = MediaQuery.viewInsetsOf(context).bottom;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.bgRaised,
        border: showTopBorder
            ? Border(
                top: BorderSide(
                  color: colors.borderSubtle,
                  width: shapes.strokeWidth,
                ),
              )
            : null,
      ),
      padding: EdgeInsetsDirectional.only(bottom: viewBottom > 0 ? 0 : 0),
      child: SafeArea(
        top: false,
        child: Center(
          widthFactor: 1,
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxWidth),
            child: Padding(
              padding:
                  padding ??
                  EdgeInsetsDirectional.symmetric(
                    horizontal: gutter,
                    vertical: SpacingTokens.sm,
                  ),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

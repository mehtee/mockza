import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';

/// Semantic tint category for icon wells.
enum IconWellTint {
  /// Speaking & Listening blue accent.
  blue,

  /// Writing violet accent.
  violet,

  /// Reading mint accent.
  mint,

  /// Vocabulary & warning amber accent.
  amber,

  /// Danger / error red accent.
  danger,

  /// Neutral / subtle surface.
  neutral,
}

/// Standard 40–48px icon well with 12–14px radius and tinted background (design.md Sec. 5).
class IconWell extends StatelessWidget {
  /// Creates an [IconWell].
  const new({
    required this.glyph,
    this.tint = IconWellTint.neutral,
    this.size = 44,
    this.iconSize = 22,
    this.customIconColor,
    this.customBgColor,
    super.key,
  });

  /// The vector icon to display.
  final LucideGlyph glyph;

  /// Semantic tint category.
  final IconWellTint tint;

  /// Outer container box dimension (default 44px).
  final double size;

  /// Icon stroke box dimension (default 22px).
  final double iconSize;

  /// Custom icon color override.
  final Color? customIconColor;

  /// Custom background color override.
  final Color? customBgColor;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);

    final (Color iconColor, Color bgColor) = switch (tint) {
      IconWellTint.blue => (colors.speakingAccent, colors.blueBg),
      IconWellTint.violet => (colors.writingAccent, colors.violetBg),
      IconWellTint.mint => (colors.readingAccent, colors.mintBg),
      IconWellTint.amber => (colors.vocabAccent, colors.amberBg),
      IconWellTint.danger => (colors.error, colors.dangerBg),
      IconWellTint.neutral => (colors.textSecondary, colors.surfaceAlt),
    };

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: customBgColor ?? bgColor,
        borderRadius: shapes.controlRadius,
        border: Border.all(
          color: colors.borderSubtle,
          width: shapes.strokeWidth,
        ),
      ),
      child: Center(
        child: AppIcon(
          glyph,
          size: iconSize,
          color: customIconColor ?? iconColor,
        ),
      ),
    );
  }
}

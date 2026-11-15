import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_gradients.dart';
import 'package:mockza/theme/app_motion.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Builds Mockza's hand-authored Material 3 light and dark themes (no `fromSeed`).
/// Aligned strictly with design.md Sec. 2 & 12.
abstract final class AppTheme {
  /// Returns the hand-authored light [ThemeData].
  static ThemeData light() => _build(
    colors: AppColors.light,
    gradients: AppGradients.light,
    colorScheme: ColorScheme.light(
      primary: AppColors.light.primary,
      onPrimary: AppColors.light.onPrimary,
      secondary: AppColors.light.speakingAccent,
      onSecondary: AppColors.light.onPrimary,
      surface: AppColors.light.surface,
      onSurface: AppColors.light.textPrimary,
      error: AppColors.light.error,
      onError: AppColors.light.onPrimary,
      outline: AppColors.light.borderSubtle,
    ),
  );

  /// Returns the hand-authored dark [ThemeData] (canonical primary product mode).
  static ThemeData dark() => _build(
    colors: AppColors.dark,
    gradients: AppGradients.dark,
    colorScheme: ColorScheme.dark(
      primary: AppColors.dark.primary,
      onPrimary: AppColors.dark.onPrimary,
      secondary: AppColors.dark.speakingAccent,
      onSecondary: AppColors.dark.onPrimary,
      surface: AppColors.dark.surface,
      onSurface: AppColors.dark.textPrimary,
      error: AppColors.dark.error,
      onError: AppColors.dark.onPrimary,
      outline: AppColors.dark.borderSubtle,
    ),
  );

  static ThemeData _build({
    required AppColors colors,
    required AppGradients gradients,
    required ColorScheme colorScheme,
  }) {
    final typography = AppTypography.fromColors(
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      textTertiary: colors.textTertiary,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: colors.background,
      fontFamily: AppTypography.sansFamily,
      appBarTheme: AppBarTheme(
        backgroundColor: colors.background,
        foregroundColor: colors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: colors.surface,
        indicatorColor: colors.surfaceAlt,
        height: SpacingTokens.bottomNavHeight,
        labelTextStyle: WidgetStatePropertyAll<TextStyle>(typography.caption),
      ),
      cardTheme: CardThemeData(
        color: colors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: AppShapes.standard.cardRadius,
          side: BorderSide(
            color: colors.borderSubtle,
            width: AppShapes.standard.strokeWidth,
          ),
        ),
      ),
      dividerTheme: DividerThemeData(
        color: colors.borderSubtle,
        thickness: AppShapes.standard.strokeWidth,
        space: 1,
      ),
      extensions: <ThemeExtension<dynamic>>[
        colors,
        gradients,
        typography,
        AppShapes.standard,
        AppMotion.standard,
      ],
    );
  }
}

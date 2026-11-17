import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_gradients.dart';
import 'package:mockza/theme/app_motion.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';
import 'package:mockza/theme/theme_catalog.dart';
import 'package:mockza/theme/theme_preset.dart';

/// Builds Mockza's hand-authored Material 3 light and dark themes (no `fromSeed`).
/// Parameterized via [MzThemePreset] for Open-Closed palette customization.
abstract final class AppTheme {
  /// Builds a complete [ThemeData] for [preset] and [brightness].
  static ThemeData build({
    required MzThemePreset preset,
    required Brightness brightness,
  }) {
    final isDark = brightness == Brightness.dark;
    final colors = isDark ? preset.darkColors : preset.lightColors;
    final gradients = isDark ? preset.darkGradients : preset.lightGradients;

    final colorScheme = isDark
        ? ColorScheme.dark(
            primary: colors.primary,
            onPrimary: colors.onPrimary,
            secondary: colors.speakingAccent,
            onSecondary: colors.onPrimary,
            surface: colors.surface,
            onSurface: colors.textPrimary,
            error: colors.error,
            onError: colors.onPrimary,
            outline: colors.borderSubtle,
          )
        : ColorScheme.light(
            primary: colors.primary,
            onPrimary: colors.onPrimary,
            secondary: colors.speakingAccent,
            onSecondary: colors.onPrimary,
            surface: colors.surface,
            onSurface: colors.textPrimary,
            error: colors.error,
            onError: colors.onPrimary,
            outline: colors.borderSubtle,
          );

    return _buildTheme(
      colors: colors,
      gradients: gradients,
      colorScheme: colorScheme,
    );
  }

  /// Returns the default light [ThemeData].
  static ThemeData light() => build(
    preset: MzThemeCatalog.midnightIndigo,
    brightness: Brightness.light,
  );

  /// Returns the default dark [ThemeData] (canonical primary product mode).
  static ThemeData dark() => build(
    preset: MzThemeCatalog.midnightIndigo,
    brightness: Brightness.dark,
  );

  static ThemeData _buildTheme({
    required AppColors colors,
    required AppGradients gradients,
    required ColorScheme colorScheme,
  }) {
    final typography = AppTypography.fromColors(
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      textTertiary: colors.textTertiary,
    );

    const shapes = AppShapes.standard;

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
        titleTextStyle: typography.cardTitle.copyWith(
          color: colors.textPrimary,
          fontWeight: FontWeight.w700,
        ),
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
          borderRadius: shapes.cardRadius,
          side: BorderSide(
            color: colors.borderSubtle,
            width: shapes.strokeWidth,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colors.surface,
        hintStyle: typography.body.copyWith(color: colors.textTertiary),
        labelStyle: typography.secondary.copyWith(color: colors.textSecondary),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: SpacingTokens.lg,
          vertical: SpacingTokens.md,
        ),
        border: OutlineInputBorder(
          borderRadius: shapes.controlRadius,
          borderSide: BorderSide(color: colors.borderSubtle),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: shapes.controlRadius,
          borderSide: BorderSide(color: colors.borderSubtle),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: shapes.controlRadius,
          borderSide: BorderSide(color: colors.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: shapes.controlRadius,
          borderSide: BorderSide(color: colors.error),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: colors.bgRaised,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: typography.sectionHeading.copyWith(
          color: colors.textPrimary,
        ),
        contentTextStyle: typography.body.copyWith(
          color: colors.textSecondary,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: shapes.sheetRadius,
          side: BorderSide(color: colors.borderSubtle),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: colors.bgRaised,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: shapes.sheetRadius,
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: colors.surfaceAlt,
        contentTextStyle: typography.secondary.copyWith(
          color: colors.textPrimary,
        ),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: shapes.controlRadius,
          side: BorderSide(color: colors.borderStrong),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: colors.primary,
          textStyle: typography.secondary.copyWith(fontWeight: FontWeight.w600),
          minimumSize: const Size(0, SpacingTokens.minTouchTarget),
        ),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return colors.onPrimary;
          return colors.textSecondary;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return colors.primary;
          return colors.surfaceAlt;
        }),
        trackOutlineColor: WidgetStateProperty.all(colors.borderSubtle),
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: colors.primary,
        inactiveTrackColor: colors.track,
        thumbColor: colors.primary,
        overlayColor: colors.primary.withValues(alpha: 0.16),
      ),
      dividerTheme: DividerThemeData(
        color: colors.borderSubtle,
        thickness: shapes.strokeWidth,
        space: 1,
      ),
      extensions: <ThemeExtension<dynamic>>[
        colors,
        gradients,
        typography,
        shapes,
        AppMotion.standard,
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:mockza/theme/primitives.dart';

/// Semantic color slots resolved via `AppColors.of(context)`.
/// Aligned strictly with design.md Sec. 2.1 & 12.
@immutable
class AppColors extends ThemeExtension<AppColors> {
  /// Creates an [AppColors] semantic palette.
  const new({
    required this.background,
    required this.bgRaised,
    required this.surface,
    required this.surfaceAlt,
    required this.surfaceHover,
    required this.borderSubtle,
    required this.borderStrong,
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.primary,
    required this.primaryPressed,
    required this.onPrimary,
    required this.focus,
    required this.speakingAccent,
    required this.writingAccent,
    required this.readingAccent,
    required this.listeningAccent,
    required this.vocabAccent,
    required this.success,
    required this.warning,
    required this.error,
    required this.track,
    required this.mintBg,
    required this.amberBg,
    required this.dangerBg,
    required this.blueBg,
    required this.violetBg,
  });

  /// Canonical Dark semantic color set (primary product mode).
  static const dark = AppColors(
    background: PalettePrimitives.darkBg,
    bgRaised: PalettePrimitives.darkBgRaised,
    surface: PalettePrimitives.darkSurface,
    surfaceAlt: PalettePrimitives.darkSurfaceAlt,
    surfaceHover: PalettePrimitives.darkSurfaceHover,
    borderSubtle: PalettePrimitives.darkBorder,
    borderStrong: PalettePrimitives.darkBorderStrong,
    textPrimary: PalettePrimitives.darkText,
    textSecondary: PalettePrimitives.darkTextSecondary,
    textTertiary: PalettePrimitives.darkTextTertiary,
    primary: PalettePrimitives.darkAccent,
    primaryPressed: PalettePrimitives.darkAccentPressed,
    onPrimary: PalettePrimitives.darkAccentContrast,
    focus: PalettePrimitives.darkFocus,
    speakingAccent: PalettePrimitives.blue,
    writingAccent: PalettePrimitives.violet,
    readingAccent: PalettePrimitives.mint,
    listeningAccent: PalettePrimitives.blue,
    vocabAccent: PalettePrimitives.amber,
    success: PalettePrimitives.success,
    warning: PalettePrimitives.warning,
    error: PalettePrimitives.danger,
    track: PalettePrimitives.track,
    mintBg: PalettePrimitives.mintBg,
    amberBg: PalettePrimitives.amberBg,
    dangerBg: PalettePrimitives.dangerBg,
    blueBg: PalettePrimitives.blueBg,
    violetBg: PalettePrimitives.violetBg,
  );

  /// Canonical Light semantic color set.
  static const light = AppColors(
    background: PalettePrimitives.lightBg,
    bgRaised: PalettePrimitives.lightBgRaised,
    surface: PalettePrimitives.lightSurface,
    surfaceAlt: PalettePrimitives.lightSurfaceAlt,
    surfaceHover: PalettePrimitives.lightSurfaceHover,
    borderSubtle: PalettePrimitives.lightBorder,
    borderStrong: PalettePrimitives.lightBorderStrong,
    textPrimary: PalettePrimitives.lightText,
    textSecondary: PalettePrimitives.lightTextSecondary,
    textTertiary: PalettePrimitives.lightTextTertiary,
    primary: PalettePrimitives.lightAccent,
    primaryPressed: PalettePrimitives.lightAccentPressed,
    onPrimary: PalettePrimitives.lightAccentContrast,
    focus: PalettePrimitives.lightFocus,
    speakingAccent: PalettePrimitives.lightBlue,
    writingAccent: PalettePrimitives.lightViolet,
    readingAccent: PalettePrimitives.lightMint,
    listeningAccent: PalettePrimitives.lightBlue,
    vocabAccent: PalettePrimitives.lightAmber,
    success: PalettePrimitives.lightSuccess,
    warning: PalettePrimitives.lightWarning,
    error: PalettePrimitives.lightDanger,
    track: PalettePrimitives.lightTrack,
    mintBg: PalettePrimitives.lightMintBg,
    amberBg: PalettePrimitives.lightAmberBg,
    dangerBg: PalettePrimitives.lightDangerBg,
    blueBg: PalettePrimitives.lightBlueBg,
    violetBg: PalettePrimitives.lightVioletBg,
  );

  /// Primary canvas background.
  final Color background;

  /// Raised surface (bottom sheets, modals).
  final Color bgRaised;

  /// Default card, toolbar, input surface.
  final Color surface;

  /// Nested panel, pill, icon well surface.
  final Color surfaceAlt;

  /// Hover and press feedback surface.
  final Color surfaceHover;

  /// Hairline 1px border.
  final Color borderSubtle;

  /// Selected / prominent border.
  final Color borderStrong;

  /// High-contrast primary text.
  final Color textPrimary;

  /// Secondary description and metadata ink.
  final Color textSecondary;

  /// Tertiary hint ink.
  final Color textTertiary;

  /// Primary interactive brand accent.
  final Color primary;

  /// Pressed brand accent.
  final Color primaryPressed;

  /// Ink rendered on top of [primary].
  final Color onPrimary;

  /// Keyboard focus ring outline color.
  final Color focus;

  /// Speaking module accent color.
  final Color speakingAccent;

  /// Writing module accent color.
  final Color writingAccent;

  /// Reading module accent color.
  final Color readingAccent;

  /// Listening module accent color.
  final Color listeningAccent;

  /// Vocabulary SRS accent color.
  final Color vocabAccent;

  /// Confirmed success state.
  final Color success;

  /// Caution / warning state.
  final Color warning;

  /// Destructive / validation error state.
  final Color error;

  /// Empty progress and slider track fill.
  final Color track;

  /// Mint tinted background fill.
  final Color mintBg;

  /// Amber tinted background fill.
  final Color amberBg;

  /// Danger tinted background fill.
  final Color dangerBg;

  /// Blue tinted background fill.
  final Color blueBg;

  /// Violet tinted background fill.
  final Color violetBg;

  /// Resolves [AppColors] from [context], asserting the theme registered it.
  static AppColors of(BuildContext context) {
    final ext = Theme.of(context).extension<AppColors>();
    assert(ext != null, 'AppColors ThemeExtension is missing from ThemeData');
    return ext!;
  }

  @override
  AppColors copyWith({
    Color? background,
    Color? bgRaised,
    Color? surface,
    Color? surfaceAlt,
    Color? surfaceHover,
    Color? borderSubtle,
    Color? borderStrong,
    Color? textPrimary,
    Color? textSecondary,
    Color? textTertiary,
    Color? primary,
    Color? primaryPressed,
    Color? onPrimary,
    Color? focus,
    Color? speakingAccent,
    Color? writingAccent,
    Color? readingAccent,
    Color? listeningAccent,
    Color? vocabAccent,
    Color? success,
    Color? warning,
    Color? error,
    Color? track,
    Color? mintBg,
    Color? amberBg,
    Color? dangerBg,
    Color? blueBg,
    Color? violetBg,
  }) => AppColors(
    background: background ?? this.background,
    bgRaised: bgRaised ?? this.bgRaised,
    surface: surface ?? this.surface,
    surfaceAlt: surfaceAlt ?? this.surfaceAlt,
    surfaceHover: surfaceHover ?? this.surfaceHover,
    borderSubtle: borderSubtle ?? this.borderSubtle,
    borderStrong: borderStrong ?? this.borderStrong,
    textPrimary: textPrimary ?? this.textPrimary,
    textSecondary: textSecondary ?? this.textSecondary,
    textTertiary: textTertiary ?? this.textTertiary,
    primary: primary ?? this.primary,
    primaryPressed: primaryPressed ?? this.primaryPressed,
    onPrimary: onPrimary ?? this.onPrimary,
    focus: focus ?? this.focus,
    speakingAccent: speakingAccent ?? this.speakingAccent,
    writingAccent: writingAccent ?? this.writingAccent,
    readingAccent: readingAccent ?? this.readingAccent,
    listeningAccent: listeningAccent ?? this.listeningAccent,
    vocabAccent: vocabAccent ?? this.vocabAccent,
    success: success ?? this.success,
    warning: warning ?? this.warning,
    error: error ?? this.error,
    track: track ?? this.track,
    mintBg: mintBg ?? this.mintBg,
    amberBg: amberBg ?? this.amberBg,
    dangerBg: dangerBg ?? this.dangerBg,
    blueBg: blueBg ?? this.blueBg,
    violetBg: violetBg ?? this.violetBg,
  );

  @override
  AppColors lerp(covariant ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return AppColors(
      background: Color.lerp(background, other.background, t)!,
      bgRaised: Color.lerp(bgRaised, other.bgRaised, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceAlt: Color.lerp(surfaceAlt, other.surfaceAlt, t)!,
      surfaceHover: Color.lerp(surfaceHover, other.surfaceHover, t)!,
      borderSubtle: Color.lerp(borderSubtle, other.borderSubtle, t)!,
      borderStrong: Color.lerp(borderStrong, other.borderStrong, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textTertiary: Color.lerp(textTertiary, other.textTertiary, t)!,
      primary: Color.lerp(primary, other.primary, t)!,
      primaryPressed: Color.lerp(primaryPressed, other.primaryPressed, t)!,
      onPrimary: Color.lerp(onPrimary, other.onPrimary, t)!,
      focus: Color.lerp(focus, other.focus, t)!,
      speakingAccent: Color.lerp(speakingAccent, other.speakingAccent, t)!,
      writingAccent: Color.lerp(writingAccent, other.writingAccent, t)!,
      readingAccent: Color.lerp(readingAccent, other.readingAccent, t)!,
      listeningAccent: Color.lerp(listeningAccent, other.listeningAccent, t)!,
      vocabAccent: Color.lerp(vocabAccent, other.vocabAccent, t)!,
      success: Color.lerp(success, other.success, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      error: Color.lerp(error, other.error, t)!,
      track: Color.lerp(track, other.track, t)!,
      mintBg: Color.lerp(mintBg, other.mintBg, t)!,
      amberBg: Color.lerp(amberBg, other.amberBg, t)!,
      dangerBg: Color.lerp(dangerBg, other.dangerBg, t)!,
      blueBg: Color.lerp(blueBg, other.blueBg, t)!,
      violetBg: Color.lerp(violetBg, other.violetBg, t)!,
    );
  }
}

import 'package:flutter/material.dart';

/// Semantic typography extension implementing Inter typography scale from design.md Sec. 2.2.
@immutable
class AppTypography extends ThemeExtension<AppTypography> {
  /// Creates an [AppTypography] set.
  const new({
    required this.heroScore,
    required this.headline,
    required this.sectionHeading,
    required this.cardTitle,
    required this.cardScore,
    required this.body,
    required this.secondary,
    required this.caption,
    required this.readingPassage,
    required this.timerMono,
  });

  /// Creates typography scaled with semantic [textPrimary], [textSecondary], and [textTertiary].
  factory fromColors({
    required Color textPrimary,
    required Color textSecondary,
    required Color textTertiary,
  }) => AppTypography(
    heroScore: TextStyle(
      fontFamily: sansFamily,
      fontSize: 72,
      fontWeight: FontWeight.w700,
      height: 0.95,
      letterSpacing: -1,
      fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
      color: textPrimary,
    ),
    headline: TextStyle(
      fontFamily: sansFamily,
      fontSize: 34,
      fontWeight: FontWeight.w700,
      height: 1.12,
      letterSpacing: -1.36, // -0.04em
      color: textPrimary,
    ),
    sectionHeading: TextStyle(
      fontFamily: sansFamily,
      fontSize: 24,
      fontWeight: FontWeight.w700,
      height: 1.18,
      letterSpacing: -0.84, // -0.035em
      color: textPrimary,
    ),
    cardTitle: TextStyle(
      fontFamily: sansFamily,
      fontSize: 18,
      fontWeight: FontWeight.w600,
      height: 1.30,
      letterSpacing: -0.2,
      color: textPrimary,
    ),
    cardScore: TextStyle(
      fontFamily: sansFamily,
      fontSize: 29,
      fontWeight: FontWeight.w700,
      height: 1.12,
      fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
      color: textPrimary,
    ),
    body: TextStyle(
      fontFamily: sansFamily,
      fontSize: 16,
      fontWeight: FontWeight.w400,
      height: 1.50,
      color: textPrimary,
    ),
    secondary: TextStyle(
      fontFamily: sansFamily,
      fontSize: 14,
      fontWeight: FontWeight.w500,
      height: 1.45,
      color: textSecondary,
    ),
    caption: TextStyle(
      fontFamily: sansFamily,
      fontSize: 12,
      fontWeight: FontWeight.w500,
      height: 1.45,
      color: textTertiary,
    ),
    readingPassage: TextStyle(
      fontFamily: sansFamily,
      fontSize: 16.5,
      fontWeight: FontWeight.w400,
      height: 1.70,
      color: textPrimary,
    ),
    timerMono: TextStyle(
      fontFamily: sansFamily,
      fontSize: 16,
      fontWeight: FontWeight.w700,
      height: 1.20,
      fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
      color: textPrimary,
    ),
  );

  /// Primary font family identifier (`Inter`, with platform fallback).
  static const String sansFamily = 'Inter';

  /// Hero dominant band score (72 / 0.95 tabular).
  final TextStyle heroScore;

  /// Page headline (34 / 1.12).
  final TextStyle headline;

  /// Section heading (24 / 1.18).
  final TextStyle sectionHeading;

  /// Card/row title (18 / 1.30).
  final TextStyle cardTitle;

  /// Card score readout (29 / 1.12 tabular).
  final TextStyle cardScore;

  /// Standard readable UI body (16 / 1.50).
  final TextStyle body;

  /// Controls and secondary metadata (14 / 1.45).
  final TextStyle secondary;

  /// Caption and small hints (12 / 1.45).
  final TextStyle caption;

  /// Long-form essay and reading passage typography (16.5 / 1.70).
  final TextStyle readingPassage;

  /// Monospace tabular timer and countdown (16 / 1.20).
  final TextStyle timerMono;

  /// Backward-compatible alias for [heroScore].
  TextStyle get bandDisplay => heroScore;

  /// Backward-compatible alias for [cardTitle].
  TextStyle get title => cardTitle;

  /// Resolves [AppTypography] from [context].
  static AppTypography of(BuildContext context) {
    final ext = Theme.of(context).extension<AppTypography>();
    assert(
      ext != null,
      'AppTypography ThemeExtension is missing from ThemeData',
    );
    return ext!;
  }

  @override
  AppTypography copyWith({
    TextStyle? heroScore,
    TextStyle? headline,
    TextStyle? sectionHeading,
    TextStyle? cardTitle,
    TextStyle? cardScore,
    TextStyle? body,
    TextStyle? secondary,
    TextStyle? caption,
    TextStyle? readingPassage,
    TextStyle? timerMono,
  }) => AppTypography(
    heroScore: heroScore ?? this.heroScore,
    headline: headline ?? this.headline,
    sectionHeading: sectionHeading ?? this.sectionHeading,
    cardTitle: cardTitle ?? this.cardTitle,
    cardScore: cardScore ?? this.cardScore,
    body: body ?? this.body,
    secondary: secondary ?? this.secondary,
    caption: caption ?? this.caption,
    readingPassage: readingPassage ?? this.readingPassage,
    timerMono: timerMono ?? this.timerMono,
  );

  @override
  AppTypography lerp(covariant ThemeExtension<AppTypography>? other, double t) {
    if (other is! AppTypography) return this;
    return AppTypography(
      heroScore: TextStyle.lerp(heroScore, other.heroScore, t)!,
      headline: TextStyle.lerp(headline, other.headline, t)!,
      sectionHeading: TextStyle.lerp(sectionHeading, other.sectionHeading, t)!,
      cardTitle: TextStyle.lerp(cardTitle, other.cardTitle, t)!,
      cardScore: TextStyle.lerp(cardScore, other.cardScore, t)!,
      body: TextStyle.lerp(body, other.body, t)!,
      secondary: TextStyle.lerp(secondary, other.secondary, t)!,
      caption: TextStyle.lerp(caption, other.caption, t)!,
      readingPassage: TextStyle.lerp(readingPassage, other.readingPassage, t)!,
      timerMono: TextStyle.lerp(timerMono, other.timerMono, t)!,
    );
  }
}

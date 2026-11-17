import 'package:flutter/material.dart';
import 'package:mockza/core/preferences/appearance_settings.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_gradients.dart';
import 'package:mockza/theme/primitives.dart';
import 'package:mockza/theme/theme_preset.dart';

/// Open-Closed registry of built-in and custom [MzThemePreset] skins.
/// Registering or modifying a palette here automatically propagates across
/// all screens via `Theme.of(context)` extensions without touching widgets.
abstract final class MzThemeCatalog {
  /// Canonical default preset (`Midnight Indigo`).
  static const MzThemePreset midnightIndigo = MzThemePreset(
    id: AppearanceSettings.defaultPresetId,
    displayName: 'Midnight Indigo',
    description: 'Calm obsidian navy & electric indigo contrast.',
    previewPrimary: PalettePrimitives.darkAccent,
    previewAccent: PalettePrimitives.blue,
    previewBackgroundDark: PalettePrimitives.darkBg,
    darkColors: AppColors.dark,
    lightColors: AppColors.light,
    darkGradients: AppGradients.dark,
    lightGradients: AppGradients.light,
  );

  /// Nordic Emerald preset (`Forest Obsidian` / `Sage Ivory`).
  static const MzThemePreset nordicEmerald = MzThemePreset(
    id: 'nordic_emerald',
    displayName: 'Nordic Emerald',
    description: 'Deep forest slate & restorative emerald-teal accents.',
    previewPrimary: PalettePrimitives.emeraldDarkAccent,
    previewAccent: PalettePrimitives.emeraldDarkBtnEnd,
    previewBackgroundDark: PalettePrimitives.emeraldDarkBg,
    darkColors: AppColors(
      background: PalettePrimitives.emeraldDarkBg,
      bgRaised: PalettePrimitives.emeraldDarkRaised,
      surface: PalettePrimitives.emeraldDarkSurface,
      surfaceAlt: PalettePrimitives.emeraldDarkSurfaceAlt,
      surfaceHover: PalettePrimitives.emeraldDarkSurfaceHover,
      borderSubtle: PalettePrimitives.emeraldDarkBorder,
      borderStrong: PalettePrimitives.emeraldDarkBorderStrong,
      textPrimary: PalettePrimitives.darkText,
      textSecondary: PalettePrimitives.darkTextSecondary,
      textTertiary: PalettePrimitives.darkTextTertiary,
      primary: PalettePrimitives.emeraldDarkAccent,
      primaryPressed: PalettePrimitives.emeraldDarkAccentPressed,
      onPrimary: PalettePrimitives.emeraldDarkOnPrimary,
      focus: PalettePrimitives.emeraldDarkAccent,
      speakingAccent: PalettePrimitives.blue,
      writingAccent: PalettePrimitives.violet,
      readingAccent: PalettePrimitives.mint,
      listeningAccent: PalettePrimitives.emeraldDarkBtnEnd,
      vocabAccent: PalettePrimitives.amber,
      success: PalettePrimitives.success,
      warning: PalettePrimitives.warning,
      error: PalettePrimitives.danger,
      track: PalettePrimitives.emeraldDarkBorder,
      mintBg: PalettePrimitives.mintBg,
      amberBg: PalettePrimitives.amberBg,
      dangerBg: PalettePrimitives.dangerBg,
      blueBg: PalettePrimitives.blueBg,
      violetBg: PalettePrimitives.violetBg,
    ),
    lightColors: AppColors(
      background: PalettePrimitives.emeraldLightBg,
      bgRaised: PalettePrimitives.lightBgRaised,
      surface: PalettePrimitives.lightSurface,
      surfaceAlt: PalettePrimitives.emeraldLightSurfaceAlt,
      surfaceHover: PalettePrimitives.emeraldLightSurfaceHover,
      borderSubtle: PalettePrimitives.emeraldLightBorder,
      borderStrong: PalettePrimitives.emeraldLightBorderStrong,
      textPrimary: PalettePrimitives.lightText,
      textSecondary: PalettePrimitives.lightTextSecondary,
      textTertiary: PalettePrimitives.lightTextTertiary,
      primary: PalettePrimitives.emeraldLightAccent,
      primaryPressed: PalettePrimitives.emeraldLightAccentPressed,
      onPrimary: PalettePrimitives.white,
      focus: PalettePrimitives.emeraldLightAccent,
      speakingAccent: PalettePrimitives.lightBlue,
      writingAccent: PalettePrimitives.lightViolet,
      readingAccent: PalettePrimitives.lightMint,
      listeningAccent: PalettePrimitives.emeraldLightAccent,
      vocabAccent: PalettePrimitives.lightAmber,
      success: PalettePrimitives.lightSuccess,
      warning: PalettePrimitives.lightWarning,
      error: PalettePrimitives.lightDanger,
      track: PalettePrimitives.emeraldLightBorder,
      mintBg: PalettePrimitives.lightMintBg,
      amberBg: PalettePrimitives.lightAmberBg,
      dangerBg: PalettePrimitives.lightDangerBg,
      blueBg: PalettePrimitives.lightBlueBg,
      violetBg: PalettePrimitives.lightVioletBg,
    ),
    darkGradients: AppGradients(
      primaryButton: LinearGradient(
        begin: Alignment(-0.8, -0.6),
        end: Alignment(0.8, 0.6),
        colors: <Color>[
          PalettePrimitives.emeraldDarkAccentPressed,
          PalettePrimitives.emeraldDarkBtnEnd,
        ],
      ),
      scoreFill: LinearGradient(
        colors: <Color>[
          PalettePrimitives.mint,
          PalettePrimitives.emeraldDarkBtnEnd,
        ],
      ),
      heroCard: LinearGradient(
        begin: Alignment(-0.8, -0.6),
        end: Alignment(0.8, 0.6),
        stops: <double>[0, 0.63, 1],
        colors: <Color>[
          PalettePrimitives.emeraldDarkSurface,
          PalettePrimitives.emeraldDarkSurfaceAlt,
          PalettePrimitives.emeraldDarkHeroEnd,
        ],
      ),
      recommendationCard: LinearGradient(
        begin: Alignment(-0.7, -0.7),
        end: Alignment(0.7, 0.7),
        colors: <Color>[
          PalettePrimitives.emeraldDarkSurfaceAlt,
          PalettePrimitives.emeraldDarkSurface,
        ],
      ),
    ),
    lightGradients: AppGradients(
      primaryButton: LinearGradient(
        begin: Alignment(-0.8, -0.6),
        end: Alignment(0.8, 0.6),
        colors: <Color>[
          PalettePrimitives.emeraldLightAccent,
          PalettePrimitives.lightMint,
        ],
      ),
      scoreFill: LinearGradient(
        colors: <Color>[
          PalettePrimitives.lightMint,
          PalettePrimitives.lightBlue,
        ],
      ),
      heroCard: LinearGradient(
        begin: Alignment(-0.8, -0.6),
        end: Alignment(0.8, 0.6),
        colors: <Color>[
          PalettePrimitives.emeraldLightSurfaceAlt,
          PalettePrimitives.emeraldLightSurfaceHover,
        ],
      ),
      recommendationCard: LinearGradient(
        begin: Alignment(-0.7, -0.7),
        end: Alignment(0.7, 0.7),
        colors: <Color>[
          PalettePrimitives.emeraldLightSurfaceAlt,
          PalettePrimitives.emeraldLightSurfaceHover,
        ],
      ),
    ),
  );

  /// Editorial Amber preset (`Warm Charcoal` / `Paper Sand`).
  static const MzThemePreset editorialAmber = MzThemePreset(
    id: 'editorial_amber',
    displayName: 'Editorial Amber',
    description: 'Focused warm paper contrast ideal for long reading.',
    previewPrimary: PalettePrimitives.amberDarkAccent,
    previewAccent: PalettePrimitives.amberDarkBtnEnd,
    previewBackgroundDark: PalettePrimitives.amberDarkBg,
    darkColors: AppColors(
      background: PalettePrimitives.amberDarkBg,
      bgRaised: PalettePrimitives.amberDarkRaised,
      surface: PalettePrimitives.amberDarkSurface,
      surfaceAlt: PalettePrimitives.amberDarkSurfaceAlt,
      surfaceHover: PalettePrimitives.amberDarkSurfaceHover,
      borderSubtle: PalettePrimitives.amberDarkBorder,
      borderStrong: PalettePrimitives.amberDarkBorderStrong,
      textPrimary: PalettePrimitives.darkText,
      textSecondary: PalettePrimitives.darkTextSecondary,
      textTertiary: PalettePrimitives.darkTextTertiary,
      primary: PalettePrimitives.amberDarkAccent,
      primaryPressed: PalettePrimitives.amberDarkAccentPressed,
      onPrimary: PalettePrimitives.amberDarkOnPrimary,
      focus: PalettePrimitives.amberDarkAccent,
      speakingAccent: PalettePrimitives.blue,
      writingAccent: PalettePrimitives.violet,
      readingAccent: PalettePrimitives.mint,
      listeningAccent: PalettePrimitives.blue,
      vocabAccent: PalettePrimitives.amber,
      success: PalettePrimitives.success,
      warning: PalettePrimitives.warning,
      error: PalettePrimitives.danger,
      track: PalettePrimitives.amberDarkBorder,
      mintBg: PalettePrimitives.mintBg,
      amberBg: PalettePrimitives.amberBg,
      dangerBg: PalettePrimitives.dangerBg,
      blueBg: PalettePrimitives.blueBg,
      violetBg: PalettePrimitives.violetBg,
    ),
    lightColors: AppColors(
      background: PalettePrimitives.amberLightBg,
      bgRaised: PalettePrimitives.lightBgRaised,
      surface: PalettePrimitives.lightSurface,
      surfaceAlt: PalettePrimitives.amberLightSurfaceAlt,
      surfaceHover: PalettePrimitives.amberLightSurfaceHover,
      borderSubtle: PalettePrimitives.amberLightBorder,
      borderStrong: PalettePrimitives.amberLightBorderStrong,
      textPrimary: PalettePrimitives.lightText,
      textSecondary: PalettePrimitives.lightTextSecondary,
      textTertiary: PalettePrimitives.lightTextTertiary,
      primary: PalettePrimitives.amberLightAccent,
      primaryPressed: PalettePrimitives.amberLightAccentPressed,
      onPrimary: PalettePrimitives.white,
      focus: PalettePrimitives.amberLightAccent,
      speakingAccent: PalettePrimitives.lightBlue,
      writingAccent: PalettePrimitives.lightViolet,
      readingAccent: PalettePrimitives.lightMint,
      listeningAccent: PalettePrimitives.lightBlue,
      vocabAccent: PalettePrimitives.amberLightAccent,
      success: PalettePrimitives.lightSuccess,
      warning: PalettePrimitives.lightWarning,
      error: PalettePrimitives.lightDanger,
      track: PalettePrimitives.amberLightBorder,
      mintBg: PalettePrimitives.lightMintBg,
      amberBg: PalettePrimitives.lightAmberBg,
      dangerBg: PalettePrimitives.lightDangerBg,
      blueBg: PalettePrimitives.lightBlueBg,
      violetBg: PalettePrimitives.lightVioletBg,
    ),
    darkGradients: AppGradients(
      primaryButton: LinearGradient(
        begin: Alignment(-0.8, -0.6),
        end: Alignment(0.8, 0.6),
        colors: <Color>[
          PalettePrimitives.amberDarkAccentPressed,
          PalettePrimitives.amberDarkBtnEnd,
        ],
      ),
      scoreFill: LinearGradient(
        colors: <Color>[
          PalettePrimitives.amberDarkAccent,
          PalettePrimitives.mint,
        ],
      ),
      heroCard: LinearGradient(
        begin: Alignment(-0.8, -0.6),
        end: Alignment(0.8, 0.6),
        stops: <double>[0, 0.63, 1],
        colors: <Color>[
          PalettePrimitives.amberDarkSurface,
          PalettePrimitives.amberDarkSurfaceAlt,
          PalettePrimitives.amberDarkHeroEnd,
        ],
      ),
      recommendationCard: LinearGradient(
        begin: Alignment(-0.7, -0.7),
        end: Alignment(0.7, 0.7),
        colors: <Color>[
          PalettePrimitives.amberDarkSurfaceAlt,
          PalettePrimitives.amberDarkSurface,
        ],
      ),
    ),
    lightGradients: AppGradients(
      primaryButton: LinearGradient(
        begin: Alignment(-0.8, -0.6),
        end: Alignment(0.8, 0.6),
        colors: <Color>[
          PalettePrimitives.amberLightAccent,
          PalettePrimitives.lightAmber,
        ],
      ),
      scoreFill: LinearGradient(
        colors: <Color>[
          PalettePrimitives.amberLightAccent,
          PalettePrimitives.lightMint,
        ],
      ),
      heroCard: LinearGradient(
        begin: Alignment(-0.8, -0.6),
        end: Alignment(0.8, 0.6),
        colors: <Color>[
          PalettePrimitives.amberLightSurfaceAlt,
          PalettePrimitives.amberLightSurfaceHover,
        ],
      ),
      recommendationCard: LinearGradient(
        begin: Alignment(-0.7, -0.7),
        end: Alignment(0.7, 0.7),
        colors: <Color>[
          PalettePrimitives.amberLightSurfaceAlt,
          PalettePrimitives.amberLightSurfaceHover,
        ],
      ),
    ),
  );

  /// Oceanic Cobalt preset (`Marine Slate` / `Ice Mist`).
  static const MzThemePreset oceanicCobalt = MzThemePreset(
    id: 'oceanic_cobalt',
    displayName: 'Oceanic Cobalt',
    description: 'Crisp marine slate & clear coastal sky accents.',
    previewPrimary: PalettePrimitives.cobaltDarkAccent,
    previewAccent: PalettePrimitives.cobaltDarkBtnEnd,
    previewBackgroundDark: PalettePrimitives.cobaltDarkBg,
    darkColors: AppColors(
      background: PalettePrimitives.cobaltDarkBg,
      bgRaised: PalettePrimitives.cobaltDarkRaised,
      surface: PalettePrimitives.cobaltDarkSurface,
      surfaceAlt: PalettePrimitives.cobaltDarkSurfaceAlt,
      surfaceHover: PalettePrimitives.cobaltDarkSurfaceHover,
      borderSubtle: PalettePrimitives.cobaltDarkBorder,
      borderStrong: PalettePrimitives.cobaltDarkBorderStrong,
      textPrimary: PalettePrimitives.darkText,
      textSecondary: PalettePrimitives.darkTextSecondary,
      textTertiary: PalettePrimitives.darkTextTertiary,
      primary: PalettePrimitives.cobaltDarkAccent,
      primaryPressed: PalettePrimitives.cobaltDarkAccentPressed,
      onPrimary: PalettePrimitives.cobaltDarkOnPrimary,
      focus: PalettePrimitives.cobaltDarkAccent,
      speakingAccent: PalettePrimitives.cobaltDarkAccent,
      writingAccent: PalettePrimitives.violet,
      readingAccent: PalettePrimitives.mint,
      listeningAccent: PalettePrimitives.cobaltDarkBtnEnd,
      vocabAccent: PalettePrimitives.amber,
      success: PalettePrimitives.success,
      warning: PalettePrimitives.warning,
      error: PalettePrimitives.danger,
      track: PalettePrimitives.cobaltDarkBorder,
      mintBg: PalettePrimitives.mintBg,
      amberBg: PalettePrimitives.amberBg,
      dangerBg: PalettePrimitives.dangerBg,
      blueBg: PalettePrimitives.blueBg,
      violetBg: PalettePrimitives.violetBg,
    ),
    lightColors: AppColors(
      background: PalettePrimitives.cobaltLightBg,
      bgRaised: PalettePrimitives.lightBgRaised,
      surface: PalettePrimitives.lightSurface,
      surfaceAlt: PalettePrimitives.cobaltLightSurfaceAlt,
      surfaceHover: PalettePrimitives.cobaltLightSurfaceHover,
      borderSubtle: PalettePrimitives.cobaltLightBorder,
      borderStrong: PalettePrimitives.cobaltLightBorderStrong,
      textPrimary: PalettePrimitives.lightText,
      textSecondary: PalettePrimitives.lightTextSecondary,
      textTertiary: PalettePrimitives.lightTextTertiary,
      primary: PalettePrimitives.cobaltLightAccent,
      primaryPressed: PalettePrimitives.cobaltLightAccentPressed,
      onPrimary: PalettePrimitives.white,
      focus: PalettePrimitives.cobaltLightAccent,
      speakingAccent: PalettePrimitives.cobaltLightAccent,
      writingAccent: PalettePrimitives.lightViolet,
      readingAccent: PalettePrimitives.lightMint,
      listeningAccent: PalettePrimitives.lightBlue,
      vocabAccent: PalettePrimitives.lightAmber,
      success: PalettePrimitives.lightSuccess,
      warning: PalettePrimitives.lightWarning,
      error: PalettePrimitives.lightDanger,
      track: PalettePrimitives.cobaltLightBorder,
      mintBg: PalettePrimitives.lightMintBg,
      amberBg: PalettePrimitives.lightAmberBg,
      dangerBg: PalettePrimitives.lightDangerBg,
      blueBg: PalettePrimitives.lightBlueBg,
      violetBg: PalettePrimitives.lightVioletBg,
    ),
    darkGradients: AppGradients(
      primaryButton: LinearGradient(
        begin: Alignment(-0.8, -0.6),
        end: Alignment(0.8, 0.6),
        colors: <Color>[
          PalettePrimitives.cobaltDarkBtnEnd,
          PalettePrimitives.cobaltDarkAccentPressed,
        ],
      ),
      scoreFill: LinearGradient(
        colors: <Color>[
          PalettePrimitives.cobaltDarkAccent,
          PalettePrimitives.cobaltDarkBtnEnd,
        ],
      ),
      heroCard: LinearGradient(
        begin: Alignment(-0.8, -0.6),
        end: Alignment(0.8, 0.6),
        stops: <double>[0, 0.63, 1],
        colors: <Color>[
          PalettePrimitives.cobaltDarkSurface,
          PalettePrimitives.cobaltDarkSurfaceAlt,
          PalettePrimitives.cobaltDarkHeroEnd,
        ],
      ),
      recommendationCard: LinearGradient(
        begin: Alignment(-0.7, -0.7),
        end: Alignment(0.7, 0.7),
        colors: <Color>[
          PalettePrimitives.cobaltDarkSurfaceAlt,
          PalettePrimitives.cobaltDarkSurface,
        ],
      ),
    ),
    lightGradients: AppGradients(
      primaryButton: LinearGradient(
        begin: Alignment(-0.8, -0.6),
        end: Alignment(0.8, 0.6),
        colors: <Color>[
          PalettePrimitives.cobaltLightAccent,
          PalettePrimitives.lightBlue,
        ],
      ),
      scoreFill: LinearGradient(
        colors: <Color>[
          PalettePrimitives.cobaltLightAccent,
          PalettePrimitives.lightMint,
        ],
      ),
      heroCard: LinearGradient(
        begin: Alignment(-0.8, -0.6),
        end: Alignment(0.8, 0.6),
        colors: <Color>[
          PalettePrimitives.cobaltLightSurfaceAlt,
          PalettePrimitives.cobaltLightSurfaceHover,
        ],
      ),
      recommendationCard: LinearGradient(
        begin: Alignment(-0.7, -0.7),
        end: Alignment(0.7, 0.7),
        colors: <Color>[
          PalettePrimitives.cobaltLightSurfaceAlt,
          PalettePrimitives.cobaltLightSurfaceHover,
        ],
      ),
    ),
  );

  /// Built-in presets in display order.
  static const List<MzThemePreset> builtInPresets = <MzThemePreset>[
    midnightIndigo,
    nordicEmerald,
    editorialAmber,
    oceanicCobalt,
  ];

  static final List<MzThemePreset> _customPresets = <MzThemePreset>[];

  /// All available presets (built-in plus any dynamically registered extensions).
  static List<MzThemePreset> get allPresets => <MzThemePreset>[
    ...builtInPresets,
    ..._customPresets,
  ];

  /// Registers an additional preset at runtime without modifying existing screens.
  static void registerPreset(MzThemePreset preset) {
    _customPresets
      ..removeWhere((p) => p.id == preset.id)
      ..add(preset);
  }

  /// Resolves a preset by [id], falling back to [midnightIndigo].
  static MzThemePreset resolvePreset(String id) {
    for (final preset in allPresets) {
      if (preset.id == id) return preset;
    }
    return midnightIndigo;
  }
}

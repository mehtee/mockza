import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_gradients.dart';

/// Open-Closed visual palette specification consumed by `AppTheme.build`.
/// Add new themes by registering an instance in `MzThemeCatalog` with zero
/// edits to screens or components.
@immutable
class MzThemePreset {
  /// Creates an [MzThemePreset].
  const new({
    required this.id,
    required this.displayName,
    required this.description,
    required this.previewPrimary,
    required this.previewAccent,
    required this.previewBackgroundDark,
    required this.darkColors,
    required this.lightColors,
    required this.darkGradients,
    required this.lightGradients,
  });

  /// Stable preset identifier persisted in settings (`midnight_indigo`, etc.).
  final String id;

  /// Human-friendly palette title displayed in Settings.
  final String displayName;

  /// Concise description of the palette mood.
  final String description;

  /// Primary swatch dot color shown in preset picker tiles.
  final Color previewPrimary;

  /// Secondary swatch dot color shown in preset picker tiles.
  final Color previewAccent;

  /// Background swatch dot shown in preset picker tiles.
  final Color previewBackgroundDark;

  /// Semantic dark-mode colors for this preset.
  final AppColors darkColors;

  /// Semantic light-mode colors for this preset.
  final AppColors lightColors;

  /// Dark-mode gradients for this preset.
  final AppGradients darkGradients;

  /// Light-mode gradients for this preset.
  final AppGradients lightGradients;
}

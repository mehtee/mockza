import 'package:mockza/theme/generated_tokens.dart';
import 'package:mockza/theme/theme_preset.dart';

/// Open-Closed registry of built-in and custom [MzThemePreset] skins.
/// Registering or modifying a palette here automatically propagates across
/// all screens via `Theme.of(context)` extensions without touching widgets.
abstract final class MzThemeCatalog {
  /// Canonical default preset (`Midnight Indigo`).
  static const MzThemePreset midnightIndigo =
      GeneratedPresetCatalog.midnightIndigo;

  /// Nordic Emerald preset (`Forest Obsidian` / `Sage Ivory`).
  static const MzThemePreset nordicEmerald =
      GeneratedPresetCatalog.nordicEmerald;

  /// Editorial Amber preset (`Warm Charcoal` / `Paper Sand`).
  static const MzThemePreset editorialAmber =
      GeneratedPresetCatalog.editorialAmber;

  /// Oceanic Cobalt preset (`Marine Slate` / `Ice Mist`).
  static const MzThemePreset oceanicCobalt =
      GeneratedPresetCatalog.oceanicCobalt;

  /// Built-in presets in display order.
  static const List<MzThemePreset> builtInPresets =
      GeneratedPresetCatalog.builtInPresets;

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

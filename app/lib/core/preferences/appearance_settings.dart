import 'package:meta/meta.dart';
import 'package:mockza/core/preferences/generated_appearance_defaults.dart';

/// Immutable user visual theme & palette preset preferences (`lib/core/`).
@immutable
class AppearanceSettings {
  /// Creates an [AppearanceSettings] value object.
  const new({
    this.themeModeKey = defaultThemeModeKey,
    this.presetId = defaultPresetId,
  });

  /// Default brightness for installations without a saved choice.
  static const String defaultThemeModeKey = GeneratedAppearanceDefaults.mode;

  /// Default palette for installations without a saved choice.
  static const String defaultPresetId = GeneratedAppearanceDefaults.presetId;

  /// Visual brightness preference (`dark`, `light`, or `system`).
  final String themeModeKey;

  /// Active Open-Closed theme preset identifier in `MzThemeCatalog`.
  final String presetId;

  /// Returns an updated copy of [AppearanceSettings].
  AppearanceSettings copyWith({
    String? themeModeKey,
    String? presetId,
  }) => AppearanceSettings(
    themeModeKey: themeModeKey ?? this.themeModeKey,
    presetId: presetId ?? this.presetId,
  );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is AppearanceSettings &&
          other.themeModeKey == themeModeKey &&
          other.presetId == presetId);

  @override
  int get hashCode => Object.hash(themeModeKey, presetId);
}

import 'package:meta/meta.dart';

/// Immutable user visual theme & palette preset preferences (`lib/core/`).
@immutable
class AppearanceSettings {
  /// Creates an [AppearanceSettings] value object.
  const new({
    this.themeModeKey = defaultThemeModeKey,
    this.presetId = defaultPresetId,
  });

  /// Canonical dark primary mode per `docs/design.md`.
  static const String defaultThemeModeKey = 'dark';

  /// Default palette preset identifier (`midnight_indigo`).
  static const String defaultPresetId = 'midnight_indigo';

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

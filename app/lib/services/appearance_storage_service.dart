import 'package:mockza/core/preferences/appearance_settings.dart';
import 'package:mockza/services/secure_identity_service.dart';

/// Reads and persists [AppearanceSettings] via [SecureStorageGateway]
/// so the chosen palette and brightness render from frame 1.
final class AppearanceStorageService {
  /// Creates an [AppearanceStorageService].
  const new(this._storage);

  static const String _themeModeStorageKey = 'mockza_appearance_mode_v1';
  static const String _presetIdStorageKey = 'mockza_appearance_preset_v1';

  final SecureStorageGateway _storage;

  /// Loads persisted appearance preferences or returns defaults.
  Future<AppearanceSettings> load() async {
    final modeRes = await _storage.read(key: _themeModeStorageKey);
    final presetRes = await _storage.read(key: _presetIdStorageKey);

    final rawMode = modeRes.valueOrNull;
    final normalizedMode = switch (rawMode) {
      'light' || 'dark' || 'system' => rawMode!,
      _ => AppearanceSettings.defaultThemeModeKey,
    };

    final rawPreset = presetRes.valueOrNull;
    final normalizedPreset = (rawPreset != null && rawPreset.trim().isNotEmpty)
        ? rawPreset.trim()
        : AppearanceSettings.defaultPresetId;

    return AppearanceSettings(
      themeModeKey: normalizedMode,
      presetId: normalizedPreset,
    );
  }

  /// Persists the active theme mode (`dark`, `light`, or `system`).
  Future<void> saveThemeMode(String modeKey) =>
      _storage.write(key: _themeModeStorageKey, value: modeKey);

  /// Persists the active theme preset identifier.
  Future<void> savePresetId(String presetId) =>
      _storage.write(key: _presetIdStorageKey, value: presetId);

  /// Clears stored appearance customizations back to defaults.
  Future<void> reset() async {
    await _storage.delete(key: _themeModeStorageKey);
    await _storage.delete(key: _presetIdStorageKey);
  }
}

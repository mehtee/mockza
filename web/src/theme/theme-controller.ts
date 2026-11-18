import {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PRESET_ID,
  THEME_PRESETS,
  THEME_PRESET_IDS,
  type ThemeMode,
  type ThemePresetId,
  type ThemePresetMeta,
  isThemePresetId,
  resolveThemePreset,
} from './generated-presets';

export const APPEARANCE_MODE_STORAGE_KEY = 'mockza_appearance_mode_v1';
export const APPEARANCE_PRESET_STORAGE_KEY = 'mockza_appearance_preset_v1';

export type ThemeModePreference = ThemeMode | 'system';

export interface AppearanceState {
  readonly modePreference: ThemeModePreference;
  readonly resolvedMode: ThemeMode;
  readonly presetId: ThemePresetId;
  readonly preset: ThemePresetMeta;
}

export function isThemeModePreference(value: string): value is ThemeModePreference {
  return value === 'dark' || value === 'light' || value === 'system';
}

export function resolveSystemThemeMode(): ThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DEFAULT_THEME_MODE;
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  return media ? (media.matches ? 'dark' : 'light') : DEFAULT_THEME_MODE;
}

export function resolveThemeMode(preference: ThemeModePreference): ThemeMode {
  if (preference === 'system') {
    return resolveSystemThemeMode();
  }
  return preference;
}

export function readStoredAppearance(): AppearanceState {
  let modePreference: ThemeModePreference = DEFAULT_THEME_MODE;
  let presetId: ThemePresetId = DEFAULT_THEME_PRESET_ID;

  if (typeof window !== 'undefined') {
    try {
      const rawMode = window.localStorage.getItem(APPEARANCE_MODE_STORAGE_KEY);
      if (rawMode !== null && isThemeModePreference(rawMode)) {
        modePreference = rawMode;
      }
      const rawPreset = window.localStorage.getItem(APPEARANCE_PRESET_STORAGE_KEY);
      if (rawPreset !== null && isThemePresetId(rawPreset)) {
        presetId = rawPreset;
      }
    } catch {
      // Fall back to canonical defaults if localStorage is blocked.
    }
  }

  return {
    modePreference,
    resolvedMode: resolveThemeMode(modePreference),
    presetId,
    preset: resolveThemePreset(presetId),
  };
}

export function applyAppearanceToDocument(
  presetId: ThemePresetId,
  resolvedMode: ThemeMode,
): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  root.dataset['theme'] = presetId;
  root.dataset['mode'] = resolvedMode;
}

export function applyAndPersistAppearance(input: {
  readonly presetId?: string;
  readonly modePreference?: string;
}): AppearanceState {
  const current = readStoredAppearance();
  const nextPresetId: ThemePresetId =
    input.presetId !== undefined && isThemePresetId(input.presetId)
      ? input.presetId
      : current.presetId;
  const nextModePreference: ThemeModePreference =
    input.modePreference !== undefined && isThemeModePreference(input.modePreference)
      ? input.modePreference
      : current.modePreference;
  const resolvedMode = resolveThemeMode(nextModePreference);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(APPEARANCE_PRESET_STORAGE_KEY, nextPresetId);
      window.localStorage.setItem(APPEARANCE_MODE_STORAGE_KEY, nextModePreference);
    } catch {
      // Ignore storage quota / privacy mode errors; DOM update still applies.
    }
  }

  applyAppearanceToDocument(nextPresetId, resolvedMode);

  return {
    modePreference: nextModePreference,
    resolvedMode,
    presetId: nextPresetId,
    preset: resolveThemePreset(nextPresetId),
  };
}

export function syncAppearanceFromStorage(): AppearanceState {
  const state = readStoredAppearance();
  applyAppearanceToDocument(state.presetId, state.resolvedMode);
  return state;
}

export function subscribeSystemThemeChange(
  onResolvedChange: (state: AppearanceState) => void,
): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  if (!media || typeof media.addEventListener !== 'function') {
    return () => {};
  }
  const listener = () => {
    const state = readStoredAppearance();
    if (state.modePreference === 'system') {
      applyAppearanceToDocument(state.presetId, state.resolvedMode);
      onResolvedChange(state);
    }
  };
  media.addEventListener('change', listener);
  return () => {
    media.removeEventListener('change', listener);
  };
}

export function buildZeroFoucThemeScript(): string {
  const validPresetsJson = JSON.stringify(THEME_PRESET_IDS);
  return `(function(){try{var p=${validPresetsJson};var m=localStorage.getItem(${JSON.stringify(APPEARANCE_MODE_STORAGE_KEY)});var t=localStorage.getItem(${JSON.stringify(APPEARANCE_PRESET_STORAGE_KEY)});var preset=t&&p.indexOf(t)!==-1?t:${JSON.stringify(DEFAULT_THEME_PRESET_ID)};var mode=m==='light'||m==='dark'?m:m==='system'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):${JSON.stringify(DEFAULT_THEME_MODE)};document.documentElement.dataset.theme=preset;document.documentElement.dataset.mode=mode;}catch(_e){document.documentElement.dataset.theme=${JSON.stringify(DEFAULT_THEME_PRESET_ID)};document.documentElement.dataset.mode=${JSON.stringify(DEFAULT_THEME_MODE)};}})();`;
}

export const ZERO_FOUC_THEME_BOOT_SCRIPT = buildZeroFoucThemeScript();

export {
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_PRESET_ID,
  THEME_PRESETS,
  THEME_PRESET_IDS,
  isThemePresetId,
  resolveThemePreset,
  type ThemeMode,
  type ThemePresetId,
  type ThemePresetMeta,
};

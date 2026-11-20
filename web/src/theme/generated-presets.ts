// GENERATED FILE - DO NOT EDIT BY HAND.
// Source: packages/design-tokens/tokens.json
// Regenerate: pnpm tokens:sync

export const THEME_PRESET_IDS = [
  'midnight_indigo',
  'nordic_emerald',
  'editorial_amber',
  'oceanic_cobalt',
  'editorial_green',
] as const;

export type ThemePresetId = (typeof THEME_PRESET_IDS)[number];

export type ThemeMode = 'dark' | 'light';

export interface ThemePresetPreview {
  readonly primary: string;
  readonly accent: string;
  readonly backgroundDark: string;
}

export interface ThemePresetMeta {
  readonly id: ThemePresetId;
  readonly displayName: string;
  readonly description: string;
  readonly preview: ThemePresetPreview;
}

export const DEFAULT_THEME_PRESET_ID: ThemePresetId = 'editorial_green';
export const DEFAULT_THEME_MODE: ThemeMode = 'light';

const DEFAULT_THEME_PRESET: ThemePresetMeta = {
  id: 'editorial_green',
  displayName: 'Editorial Green',
  description: 'Warm paper and forest green',
  preview: {
    primary: '#A9C9A7',
    accent: '#B1D1E0',
    backgroundDark: '#17231C',
  },
};

export const THEME_PRESETS: readonly ThemePresetMeta[] = [
  {
    id: 'midnight_indigo',
    displayName: 'Midnight Indigo',
    description: 'Calm obsidian navy & electric indigo contrast.',
    preview: {
      primary: '#9580FF',
      accent: '#70BEFF',
      backgroundDark: '#0C0F19',
    },
  },
  {
    id: 'nordic_emerald',
    displayName: 'Nordic Emerald',
    description: 'Deep forest slate & restorative emerald-teal accents.',
    preview: {
      primary: '#34D399',
      accent: '#14B8A6',
      backgroundDark: '#081210',
    },
  },
  {
    id: 'editorial_amber',
    displayName: 'Editorial Amber',
    description: 'Focused warm paper contrast ideal for long reading.',
    preview: {
      primary: '#F5B749',
      accent: '#E07A5F',
      backgroundDark: '#11100E',
    },
  },
  {
    id: 'oceanic_cobalt',
    displayName: 'Oceanic Cobalt',
    description: 'Crisp marine slate & clear coastal sky accents.',
    preview: {
      primary: '#56CCF2',
      accent: '#4F8DFD',
      backgroundDark: '#07111C',
    },
  },
  {
    id: 'editorial_green',
    displayName: 'Editorial Green',
    description: 'Warm paper and forest green',
    preview: {
      primary: '#A9C9A7',
      accent: '#B1D1E0',
      backgroundDark: '#17231C',
    },
  },
];

export function isThemePresetId(value: string): value is ThemePresetId {
  return (THEME_PRESET_IDS as readonly string[]).includes(value);
}

export function resolveThemePreset(id?: string): ThemePresetMeta {
  if (id !== undefined) {
    for (const preset of THEME_PRESETS) {
      if (preset.id === id) {
        return preset;
      }
    }
  }
  return DEFAULT_THEME_PRESET;
}

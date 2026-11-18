export const DESIGN_TOKENS_PRESET_IDS = [
  'midnight_indigo',
  'nordic_emerald',
  'editorial_amber',
  'oceanic_cobalt',
] as const;

export type ThemePresetId = (typeof DESIGN_TOKENS_PRESET_IDS)[number];

export interface DesignTokensSkeletonInfo {
  readonly schemaVersion: '0.1.0';
  readonly presets: typeof DESIGN_TOKENS_PRESET_IDS;
}

export const DESIGN_TOKENS_SKELETON: DesignTokensSkeletonInfo = {
  schemaVersion: '0.1.0',
  presets: DESIGN_TOKENS_PRESET_IDS,
};

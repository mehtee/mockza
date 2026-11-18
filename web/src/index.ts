import { DESIGN_TOKENS_SKELETON, type ThemePresetId } from '@mockza/design-tokens';

export interface WebWorkspacePlaceholder {
  readonly packageName: '@mockza/web';
  readonly defaultTheme: ThemePresetId;
}

export const WEB_WORKSPACE_PLACEHOLDER: WebWorkspacePlaceholder = {
  packageName: '@mockza/web',
  defaultTheme: DESIGN_TOKENS_SKELETON.presets[0],
};

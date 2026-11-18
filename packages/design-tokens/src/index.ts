import rawTokens from '../tokens.json' with { type: 'json' };

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

export type ThemeMode = 'dark' | 'light';

export type HexColor = `#${string}`;

export const SEMANTIC_COLOR_KEYS = [
  'background',
  'bgRaised',
  'surface',
  'surfaceAlt',
  'surfaceHover',
  'borderSubtle',
  'borderStrong',
  'textPrimary',
  'textSecondary',
  'textTertiary',
  'primary',
  'primaryPressed',
  'onPrimary',
  'focus',
  'speakingAccent',
  'writingAccent',
  'readingAccent',
  'listeningAccent',
  'vocabAccent',
  'success',
  'warning',
  'error',
  'track',
  'mintBg',
  'amberBg',
  'dangerBg',
  'blueBg',
  'violetBg',
] as const;

export type SemanticColorKey = (typeof SEMANTIC_COLOR_KEYS)[number];

export type SemanticColors = {
  readonly [K in SemanticColorKey]: HexColor;
};

export const GRADIENT_NAMES = [
  'primaryButton',
  'scoreFill',
  'heroCard',
  'recommendationCard',
] as const;

export type GradientName = (typeof GRADIENT_NAMES)[number];

export interface GradientToken {
  readonly colors: readonly HexColor[];
  readonly stops: readonly number[];
  readonly begin: readonly [number, number];
  readonly end: readonly [number, number];
  readonly cssAngleDeg: number;
}

export interface ModePalette {
  readonly colors: SemanticColors;
  readonly gradients: {
    readonly [K in GradientName]: GradientToken;
  };
}

export interface ThemePresetPreview {
  readonly primary: HexColor;
  readonly accent: HexColor;
  readonly backgroundDark: HexColor;
}

export interface ThemePresetToken {
  readonly id: ThemePresetId;
  readonly displayName: string;
  readonly description: string;
  readonly preview: ThemePresetPreview;
  readonly modes: {
    readonly [M in ThemeMode]: ModePalette;
  };
}

export interface ThemePresetMeta {
  readonly id: ThemePresetId;
  readonly displayName: string;
  readonly description: string;
  readonly preview: ThemePresetPreview;
}

export type TypographyFontRole = 'sans' | 'mono';

export type TypographyColorToken = 'textPrimary' | 'textSecondary' | 'textTertiary';

export const TYPOGRAPHY_ROLE_NAMES = [
  'heroScore',
  'headline',
  'sectionHeading',
  'cardTitle',
  'cardScore',
  'body',
  'secondary',
  'caption',
  'readingPassage',
  'timerMono',
] as const;

export type TypographyRoleName = (typeof TYPOGRAPHY_ROLE_NAMES)[number];

export interface TypographyRoleToken {
  readonly fontRole: TypographyFontRole;
  readonly fontSize: number;
  readonly fontWeight: number;
  readonly lineHeight: number;
  readonly letterSpacingPx: number | null;
  readonly tabularNums: boolean;
  readonly colorToken: TypographyColorToken;
}

export interface TypographyFontFamilies {
  readonly flutterSans: string;
  readonly sansEn: string;
  readonly sansFa: string;
  readonly monoExam: string;
}

export interface TypographyTokens {
  readonly fontFamilies: TypographyFontFamilies;
  readonly roles: {
    readonly [R in TypographyRoleName]: TypographyRoleToken;
  };
  readonly aliases: {
    readonly bandDisplay: TypographyRoleName;
    readonly title: TypographyRoleName;
  };
}

export interface SpacingTokens {
  readonly xs: number;
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly pageInset: number;
  readonly xl: number;
  readonly sectionSep: number;
  readonly xxl: number;
  readonly heroSep: number;
  readonly minTouchTarget: number;
  readonly bottomNavHeight: number;
  readonly maxContentWidth: number;
}

export interface ShapeTokens {
  readonly cardRadius: number;
  readonly controlRadius: number;
  readonly compactRadius: number;
  readonly pillRadius: number;
  readonly sheetRadius: number;
  readonly strokeWidth: number;
}

export interface ElevationShadows {
  readonly surface: string;
  readonly toastDark: string;
  readonly toastLight: string;
}

export interface ElevationTokens {
  readonly appBar: 0;
  readonly surface: 0;
  readonly card: 0;
  readonly toast: 4;
  readonly borderRule: string;
  readonly shadows: ElevationShadows;
}

export interface MotionCurveToken {
  readonly name: string;
  readonly flutter: string;
  readonly cubicBezier: readonly [number, number, number, number];
}

export interface MotionBundleToken {
  readonly microDurationMs: number;
  readonly standardDurationMs: number;
  readonly sheetDurationMs: number;
  readonly emphasisDurationMs: number;
  readonly standardCurve: MotionCurveToken;
  readonly decelerateCurve: MotionCurveToken;
}

export interface MotionTokens {
  readonly standard: MotionBundleToken;
  readonly reduced: MotionBundleToken;
}

export interface BreakpointTokens {
  readonly tightPhoneThreshold: number;
  readonly medium: number;
  readonly expanded: number;
  readonly desktopMin: number;
  readonly desktopMax: number;
}

export interface DesignTokensDefaults {
  readonly presetId: ThemePresetId;
  readonly mode: ThemeMode;
}

export interface DesignTokensDocument {
  readonly $schema?: string;
  readonly schemaVersion: string;
  readonly defaults: DesignTokensDefaults;
  readonly primitives: Readonly<Record<string, HexColor>>;
  readonly presets: readonly ThemePresetToken[];
  readonly typography: TypographyTokens;
  readonly spacing: SpacingTokens;
  readonly shapes: ShapeTokens;
  readonly elevation: ElevationTokens;
  readonly motion: MotionTokens;
  readonly breakpoints: BreakpointTokens;
}

export const DESIGN_TOKENS: DesignTokensDocument = rawTokens as unknown as DesignTokensDocument;

export function isThemePresetId(id: string): id is ThemePresetId {
  return (DESIGN_TOKENS_PRESET_IDS as readonly string[]).includes(id);
}

export function resolveThemePreset(id?: string): ThemePresetToken {
  if (id !== undefined) {
    const matched = DESIGN_TOKENS.presets.find((preset) => preset.id === id);
    if (matched !== undefined) {
      return matched;
    }
  }
  const defaultPreset = DESIGN_TOKENS.presets.find(
    (preset) => preset.id === DESIGN_TOKENS.defaults.presetId,
  );
  if (defaultPreset !== undefined) {
    return defaultPreset;
  }
  const firstPreset = DESIGN_TOKENS.presets[0];
  if (firstPreset === undefined) {
    throw new Error('Design tokens document contains no presets');
  }
  return firstPreset;
}

export function resolveModePalette(
  presetId?: string,
  mode: ThemeMode = DESIGN_TOKENS.defaults.mode,
): ModePalette {
  const safeMode: ThemeMode =
    mode === 'dark' || mode === 'light' ? mode : DESIGN_TOKENS.defaults.mode;
  return resolveThemePreset(presetId).modes[safeMode];
}

export function validateDesignTokensSemantics(doc: DesignTokensDocument): string[] {
  const errors: string[] = [];

  if (doc.presets.length !== DESIGN_TOKENS_PRESET_IDS.length) {
    errors.push(
      `Expected exact ${DESIGN_TOKENS_PRESET_IDS.length} presets, found ${doc.presets.length}`,
    );
  }

  const seenPresetIds = new Set<string>();
  for (const preset of doc.presets) {
    if (!isThemePresetId(preset.id)) {
      errors.push(`Unknown preset ID: "${preset.id}"`);
    }
    if (seenPresetIds.has(preset.id)) {
      errors.push(`Duplicate preset ID: "${preset.id}"`);
    }
    seenPresetIds.add(preset.id);

    for (const mode of ['dark', 'light'] as const) {
      const palette = preset.modes[mode];
      for (const gradientName of GRADIENT_NAMES) {
        const gradient = palette.gradients[gradientName];
        const gradientPath = `presets.${preset.id}.modes.${mode}.gradients.${gradientName}`;

        if (gradient.colors.length !== gradient.stops.length) {
          errors.push(
            `${gradientPath}: colors.length (${gradient.colors.length}) must equal stops.length (${gradient.stops.length})`,
          );
        }

        if (gradient.stops.length < 2) {
          errors.push(`${gradientPath}: expected at least 2 stops, found ${gradient.stops.length}`);
        } else {
          const firstStop = gradient.stops[0];
          const lastStop = gradient.stops[gradient.stops.length - 1];
          if (firstStop !== 0) {
            errors.push(`${gradientPath}: stops[0] must be 0, found ${String(firstStop)}`);
          }
          if (lastStop !== 1) {
            errors.push(`${gradientPath}: stops[last] must be 1, found ${String(lastStop)}`);
          }
          for (let i = 1; i < gradient.stops.length; i++) {
            const prev = gradient.stops[i - 1];
            const curr = gradient.stops[i];
            if (prev === undefined || curr === undefined || !(curr > prev)) {
              errors.push(
                `${gradientPath}: stops must be strictly increasing at index ${i} (${String(prev)} -> ${String(curr)})`,
              );
            }
          }
        }

        const dx = gradient.end[0] - gradient.begin[0];
        const dy = gradient.end[1] - gradient.begin[1];
        const rawAngle = Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360);
        const expectedAngle = rawAngle === 0 ? 0 : rawAngle;
        if (gradient.cssAngleDeg !== expectedAngle) {
          errors.push(
            `${gradientPath}: cssAngleDeg (${gradient.cssAngleDeg}) must match computed angle (${expectedAngle})`,
          );
        }
      }
    }
  }

  for (const requiredId of DESIGN_TOKENS_PRESET_IDS) {
    if (!seenPresetIds.has(requiredId)) {
      errors.push(`Missing required preset ID: "${requiredId}"`);
    }
  }

  for (const [aliasName, roleName] of Object.entries(doc.typography.aliases)) {
    if (!Object.hasOwn(doc.typography.roles, roleName)) {
      errors.push(
        `typography.aliases.${aliasName} ("${roleName}") does not resolve to a key in typography.roles`,
      );
    }
  }

  return errors;
}

export function gradientToCss(gradient: GradientToken): string {
  const stops = gradient.colors.map((color, index) => {
    const stopValue = gradient.stops[index];
    if (stopValue === undefined) {
      return color;
    }
    const percent = Math.round(stopValue * 1000) / 10;
    return `${color} ${percent}%`;
  });
  return `linear-gradient(${gradient.cssAngleDeg}deg, ${stops.join(', ')})`;
}

export function cubicBezierToCss(curve: MotionCurveToken): string {
  return `cubic-bezier(${curve.cubicBezier.join(', ')})`;
}

export function presetMetaList(): readonly ThemePresetMeta[] {
  return DESIGN_TOKENS.presets.map((preset) => ({
    id: preset.id,
    displayName: preset.displayName,
    description: preset.description,
    preview: preset.preview,
  }));
}

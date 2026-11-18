import { type Schema, Validator } from '@cfworker/json-schema';
import { describe, expect, it } from 'vitest';
import rawTokens from '../../tokens.json' with { type: 'json' };
import tokensSchema from '../../tokens.schema.json' with { type: 'json' };
import {
  cubicBezierToCss,
  DESIGN_TOKENS,
  DESIGN_TOKENS_PRESET_IDS,
  DESIGN_TOKENS_SKELETON,
  type DesignTokensDocument,
  GRADIENT_NAMES,
  gradientToCss,
  isThemePresetId,
  presetMetaList,
  resolveModePalette,
  resolveThemePreset,
  SEMANTIC_COLOR_KEYS,
  type ThemeMode,
  TYPOGRAPHY_ROLE_NAMES,
  validateDesignTokensSemantics,
} from '../index.js';

const validator = new Validator(tokensSchema as Schema, '2020-12', false);

describe('@mockza/design-tokens', () => {
  it('validates tokens.json cleanly against Draft 2020-12 tokens.schema.json', () => {
    const result = validator.validate(rawTokens);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('preserves backward-compatible skeleton exports for @mockza/web', () => {
    expect(DESIGN_TOKENS_SKELETON.schemaVersion).toBe('0.1.0');
    expect(DESIGN_TOKENS_SKELETON.presets).toEqual(DESIGN_TOKENS_PRESET_IDS);
    expect(DESIGN_TOKENS.presets.map((preset) => preset.id)).toEqual([...DESIGN_TOKENS_PRESET_IDS]);
  });

  it('has unique preset IDs and valid default preset & mode', () => {
    const ids = DESIGN_TOKENS.presets.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['midnight_indigo', 'nordic_emerald', 'editorial_amber', 'oceanic_cobalt']);
    expect(DESIGN_TOKENS.defaults.presetId).toBe('midnight_indigo');
    expect(DESIGN_TOKENS.defaults.mode).toBe('dark');
    expect(ids).toContain(DESIGN_TOKENS.defaults.presetId);
  });

  it('aligns every preset preview swatch with its dark mode palette', () => {
    for (const preset of DESIGN_TOKENS.presets) {
      const darkColors = preset.modes.dark.colors;
      expect(preset.preview.primary).toBe(darkColors.primary);
      expect(preset.preview.backgroundDark).toBe(darkColors.background);

      if (preset.id === 'editorial_amber') {
        expect(preset.preview.accent).toBe(preset.modes.dark.gradients.primaryButton.colors[1]);
      } else if (preset.id === 'midnight_indigo') {
        expect(preset.preview.accent).toBe(darkColors.speakingAccent);
      } else {
        expect(preset.preview.accent).toBe(darkColors.listeningAccent);
      }
    }
  });

  it('defines all 28 semantic colors and valid monotonic gradients per preset and mode', () => {
    for (const preset of DESIGN_TOKENS.presets) {
      for (const mode of ['dark', 'light'] as const) {
        const palette = preset.modes[mode];
        expect(Object.keys(palette.colors).sort()).toEqual([...SEMANTIC_COLOR_KEYS].sort());
        expect(Object.keys(palette.gradients).sort()).toEqual([...GRADIENT_NAMES].sort());

        for (const gradientName of GRADIENT_NAMES) {
          const gradient = palette.gradients[gradientName];
          expect(gradient.colors.length).toBe(gradient.stops.length);
          expect(gradient.colors.length).toBeGreaterThanOrEqual(2);
          expect(gradient.colors.length).toBeLessThanOrEqual(3);
          expect(gradient.stops[0]).toBe(0);
          expect(gradient.stops[gradient.stops.length - 1]).toBe(1);

          for (let i = 1; i < gradient.stops.length; i++) {
            const prev = gradient.stops[i - 1];
            const curr = gradient.stops[i];
            expect(prev).toBeDefined();
            expect(curr).toBeDefined();
            if (prev === undefined || curr === undefined) {
              throw new Error('Expected gradient stop to be defined');
            }
            expect(curr).toBeGreaterThan(prev);
          }

          const dx = gradient.end[0] - gradient.begin[0];
          const dy = gradient.end[1] - gradient.begin[1];
          const expectedAngle = Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360);
          expect(gradient.cssAngleDeg).toBe(expectedAngle);
        }
      }
    }
  });

  it('matches Flutter AppShapes, Elevation, AppMotion, SpacingTokens, Typography, and Breakpoints', () => {
    expect(DESIGN_TOKENS.shapes).toEqual({
      cardRadius: 22,
      controlRadius: 14,
      compactRadius: 10,
      pillRadius: 999,
      sheetRadius: 26,
      strokeWidth: 1,
    });

    expect(DESIGN_TOKENS.elevation).toEqual({
      appBar: 0,
      surface: 0,
      card: 0,
      toast: 4,
      borderRule: '1px solid borderSubtle',
      shadows: {
        surface: 'none',
        toastDark: '0 8px 28px rgba(0, 0, 0, 0.36)',
        toastLight: '0 8px 28px rgba(26, 36, 74, 0.08)',
      },
    });

    expect(DESIGN_TOKENS.motion.standard.microDurationMs).toBe(150);
    expect(DESIGN_TOKENS.motion.standard.standardDurationMs).toBe(200);
    expect(DESIGN_TOKENS.motion.standard.sheetDurationMs).toBe(240);
    expect(DESIGN_TOKENS.motion.standard.emphasisDurationMs).toBe(240);
    expect(DESIGN_TOKENS.motion.reduced.microDurationMs).toBe(0);
    expect(DESIGN_TOKENS.motion.reduced.standardDurationMs).toBe(0);
    expect(DESIGN_TOKENS.motion.reduced.sheetDurationMs).toBe(0);
    expect(DESIGN_TOKENS.motion.reduced.emphasisDurationMs).toBe(0);

    expect(DESIGN_TOKENS.spacing).toEqual({
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      pageInset: 20,
      xl: 24,
      sectionSep: 28,
      xxl: 32,
      heroSep: 40,
      minTouchTarget: 48,
      bottomNavHeight: 76,
      maxContentWidth: 680,
    });

    expect(DESIGN_TOKENS.typography.fontFamilies.flutterSans).toBe('Inter');
    expect(DESIGN_TOKENS.typography.fontFamilies.sansEn).toContain('Inter');
    expect(DESIGN_TOKENS.typography.fontFamilies.sansFa).toContain('Vazirmatn');
    expect(DESIGN_TOKENS.typography.fontFamilies.monoExam).toContain('JetBrains Mono');
    expect(Object.keys(DESIGN_TOKENS.typography.roles).sort()).toEqual(
      [...TYPOGRAPHY_ROLE_NAMES].sort(),
    );
    expect(DESIGN_TOKENS.typography.aliases).toEqual({
      bandDisplay: 'heroScore',
      title: 'cardTitle',
    });

    expect(DESIGN_TOKENS.breakpoints).toEqual({
      tightPhoneThreshold: 380,
      medium: 600,
      expanded: 840,
      desktopMin: 1280,
      desktopMax: 2560,
    });
  });

  it('provides deterministic pure CSS and preset resolution helpers', () => {
    expect(isThemePresetId('nordic_emerald')).toBe(true);
    expect(isThemePresetId('unknown_preset')).toBe(false);

    expect(resolveThemePreset('nordic_emerald').id).toBe('nordic_emerald');
    expect(resolveThemePreset('non_existent').id).toBe('midnight_indigo');
    expect(resolveThemePreset(undefined).id).toBe('midnight_indigo');

    const lightPalette = resolveModePalette('oceanic_cobalt', 'light');
    expect(lightPalette.colors.primary).toBe('#0B69A3');

    const heroCss = gradientToCss(resolveModePalette('midnight_indigo', 'dark').gradients.heroCard);
    expect(heroCss).toBe('linear-gradient(127deg, #222840 0%, #1C2036 63%, #28234C 100%)');

    expect(cubicBezierToCss(DESIGN_TOKENS.motion.standard.standardCurve)).toBe(
      'cubic-bezier(0, 0, 0.58, 1)',
    );
    expect(cubicBezierToCss(DESIGN_TOKENS.motion.standard.decelerateCurve)).toBe(
      'cubic-bezier(0.215, 0.61, 0.355, 1)',
    );

    const fallbackModePalette = resolveModePalette(
      'nordic_emerald',
      'sepia' as unknown as ThemeMode,
    );
    expect(fallbackModePalette).toEqual(resolveModePalette('nordic_emerald', 'dark'));

    expect(validateDesignTokensSemantics(DESIGN_TOKENS)).toEqual([]);

    const metas = presetMetaList();
    expect(metas).toHaveLength(4);
    expect(metas.map((meta) => meta.id)).toEqual([...DESIGN_TOKENS_PRESET_IDS]);
  });

  it('accepts valid 2-, 3-, and 4-stop gradients in schema validation', () => {
    const clone = structuredClone(rawTokens) as Record<string, unknown> & {
      presets: Array<{
        modes: { dark: { gradients: { heroCard: { colors: string[]; stops: number[] } } } };
      }>;
    };
    const [firstPreset] = clone.presets;
    if (!firstPreset) throw new Error('Expected preset[0]');

    firstPreset.modes.dark.gradients.heroCard.colors = ['#111111', '#222222'];
    firstPreset.modes.dark.gradients.heroCard.stops = [0, 1];
    expect(validator.validate(clone).valid).toBe(true);

    firstPreset.modes.dark.gradients.heroCard.colors = ['#111111', '#222222', '#333333'];
    firstPreset.modes.dark.gradients.heroCard.stops = [0, 0.5, 1];
    expect(validator.validate(clone).valid).toBe(true);

    firstPreset.modes.dark.gradients.heroCard.colors = ['#111111', '#222222', '#333333', '#444444'];
    firstPreset.modes.dark.gradients.heroCard.stops = [0, 0.3, 0.7, 1];
    expect(validator.validate(clone).valid).toBe(true);
  });

  describe('negative schema validation checks', () => {
    it('rejects an invalid hex color string', () => {
      const clone = structuredClone(rawTokens) as Record<string, unknown> & {
        presets: Array<{ modes: { dark: { colors: Record<string, string> } } }>;
      };
      const [firstPreset] = clone.presets;
      if (!firstPreset) throw new Error('Expected preset[0]');
      firstPreset.modes.dark.colors['primary'] = '#GGGGGG';
      const result = validator.validate(clone);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects a missing required semantic color slot', () => {
      const clone = structuredClone(rawTokens) as Record<string, unknown> & {
        presets: Array<{ modes: { light: { colors: Record<string, string | undefined> } } }>;
      };
      const [firstPreset] = clone.presets;
      if (!firstPreset) throw new Error('Expected preset[0]');
      delete firstPreset.modes.light.colors['borderSubtle'];
      const result = validator.validate(clone);
      expect(result.valid).toBe(false);
    });

    it('rejects an unknown extra property at top level or inside semantic colors', () => {
      const cloneTop = structuredClone(rawTokens) as Record<string, unknown>;
      cloneTop['unexpectedRootKey'] = true;
      expect(validator.validate(cloneTop).valid).toBe(false);

      const cloneColor = structuredClone(rawTokens) as Record<string, unknown> & {
        presets: Array<{ modes: { dark: { colors: Record<string, string> } } }>;
      };
      const [, secondPreset] = cloneColor.presets;
      if (!secondPreset) throw new Error('Expected preset[1]');
      secondPreset.modes.dark.colors['unexpectedAccent'] = '#FFFFFF';
      expect(validator.validate(cloneColor).valid).toBe(false);
    });

    it('rejects non-zero surface/card elevation', () => {
      const clone = structuredClone(rawTokens) as Record<string, unknown> & {
        elevation: { card: number };
      };
      clone.elevation.card = 2;
      expect(validator.validate(clone).valid).toBe(false);
    });

    it('rejects invalid gradient stops or fewer than 2 colors', () => {
      const clone = structuredClone(rawTokens) as Record<string, unknown> & {
        presets: Array<{
          modes: { dark: { gradients: { scoreFill: { colors: string[]; stops: number[] } } } };
        }>;
      };
      const [firstPreset] = clone.presets;
      if (!firstPreset) throw new Error('Expected preset[0]');
      firstPreset.modes.dark.gradients.scoreFill.colors = ['#6CCEFF'];
      firstPreset.modes.dark.gradients.scoreFill.stops = [1.5];
      expect(validator.validate(clone).valid).toBe(false);
    });

    it('rejects unknown defaults.presetId, duplicate presets, and bogus 4th preset IDs', () => {
      const cloneDefault = structuredClone(rawTokens) as Record<string, unknown> & {
        defaults: { presetId: string };
      };
      cloneDefault.defaults.presetId = 'unknown_preset';
      expect(validator.validate(cloneDefault).valid).toBe(false);

      const cloneDuplicate = structuredClone(rawTokens) as Record<string, unknown> & {
        presets: Array<Record<string, unknown>>;
      };
      const [firstPreset] = cloneDuplicate.presets;
      if (!firstPreset) throw new Error('Expected preset[0]');
      cloneDuplicate.presets[1] = structuredClone(firstPreset);
      expect(validator.validate(cloneDuplicate).valid).toBe(false);

      const cloneBogus = structuredClone(rawTokens) as Record<string, unknown> & {
        presets: Array<{ id: string }>;
      };
      const fourthPreset = cloneBogus.presets[3];
      if (!fourthPreset) throw new Error('Expected preset[3]');
      fourthPreset.id = 'bogus_theme';
      expect(validator.validate(cloneBogus).valid).toBe(false);
    });

    it('rejects mismatched gradient colors/stops lengths and unanchored stops', () => {
      const cloneMismatch = structuredClone(rawTokens) as Record<string, unknown> & {
        presets: Array<{
          modes: { dark: { gradients: { heroCard: { colors: string[]; stops: number[] } } } };
        }>;
      };
      const [firstPreset] = cloneMismatch.presets;
      if (!firstPreset) throw new Error('Expected preset[0]');
      firstPreset.modes.dark.gradients.heroCard.colors = ['#111111', '#222222'];
      firstPreset.modes.dark.gradients.heroCard.stops = [0, 0.5, 1];
      expect(validator.validate(cloneMismatch).valid).toBe(false);

      const cloneUnanchored = structuredClone(rawTokens) as Record<string, unknown> & {
        presets: Array<{
          modes: { dark: { gradients: { scoreFill: { colors: string[]; stops: number[] } } } };
        }>;
      };
      const [preset0] = cloneUnanchored.presets;
      if (!preset0) throw new Error('Expected preset[0]');
      preset0.modes.dark.gradients.scoreFill.colors = ['#111111', '#222222'];
      preset0.modes.dark.gradients.scoreFill.stops = [0.2, 0.8];
      expect(validator.validate(cloneUnanchored).valid).toBe(false);
    });

    it('rejects invalid typography.aliases role names', () => {
      const clone = structuredClone(rawTokens) as Record<string, unknown> & {
        typography: { aliases: { bandDisplay: string; title: string } };
      };
      clone.typography.aliases.bandDisplay = 'nonexistentRole';
      expect(validator.validate(clone).valid).toBe(false);

      const cloneTitle = structuredClone(rawTokens) as Record<string, unknown> & {
        typography: { aliases: { bandDisplay: string; title: string } };
      };
      cloneTitle.typography.aliases.title = 'missingTitleRole';
      expect(validator.validate(cloneTitle).valid).toBe(false);
    });
  });

  describe('semantic validation checks (validateDesignTokensSemantics)', () => {
    it('detects non-monotonic gradient stops', () => {
      const cloneReversed = structuredClone(DESIGN_TOKENS) as unknown as {
        presets: Array<{
          modes: { dark: { gradients: { scoreFill: { colors: string[]; stops: number[] } } } };
        }>;
      };
      const [firstPreset] = cloneReversed.presets;
      if (!firstPreset) throw new Error('Expected preset[0]');
      firstPreset.modes.dark.gradients.scoreFill.colors = ['#111111', '#222222'];
      firstPreset.modes.dark.gradients.scoreFill.stops = [0.8, 0.2];
      const errorsReversed = validateDesignTokensSemantics(
        cloneReversed as unknown as DesignTokensDocument,
      );
      expect(errorsReversed.length).toBeGreaterThan(0);

      const cloneEqualStops = structuredClone(DESIGN_TOKENS) as unknown as {
        presets: Array<{
          modes: { dark: { gradients: { heroCard: { colors: string[]; stops: number[] } } } };
        }>;
      };
      const [preset0] = cloneEqualStops.presets;
      if (!preset0) throw new Error('Expected preset[0]');
      preset0.modes.dark.gradients.heroCard.colors = ['#111111', '#222222', '#333333'];
      preset0.modes.dark.gradients.heroCard.stops = [0, 0.5, 0.5];
      const errorsEqual = validateDesignTokensSemantics(
        cloneEqualStops as unknown as DesignTokensDocument,
      );
      expect(errorsEqual.some((msg) => msg.includes('strictly increasing'))).toBe(true);
    });

    it('detects cssAngleDeg mismatch, duplicate presets, and invalid typography aliases', () => {
      const clone = structuredClone(DESIGN_TOKENS) as unknown as {
        presets: Array<{
          id: string;
          modes: { dark: { gradients: { scoreFill: { cssAngleDeg: number } } } };
        }>;
        typography: { aliases: { bandDisplay: string } };
      };
      const [firstPreset, secondPreset] = clone.presets;
      if (!firstPreset || !secondPreset) throw new Error('Expected presets[0..1]');
      firstPreset.modes.dark.gradients.scoreFill.cssAngleDeg = 45;
      secondPreset.id = firstPreset.id;
      clone.typography.aliases.bandDisplay = 'nonexistentRole';

      const errors = validateDesignTokensSemantics(clone as unknown as DesignTokensDocument);
      expect(errors.some((msg) => msg.includes('cssAngleDeg'))).toBe(true);
      expect(errors.some((msg) => msg.includes('Duplicate preset ID'))).toBe(true);
      expect(errors.some((msg) => msg.includes('Missing required preset ID'))).toBe(true);
      expect(errors.some((msg) => msg.includes('typography.aliases.bandDisplay'))).toBe(true);
    });
  });
});

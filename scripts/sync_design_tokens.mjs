#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const TOKENS_PATH = path.join(ROOT_DIR, 'packages/design-tokens/tokens.json');
const DART_OUT_PATH = path.join(ROOT_DIR, 'app/lib/theme/generated_tokens.dart');
const CSS_OUT_PATH = path.join(ROOT_DIR, 'web/src/styles/generated-tokens.css');
const TS_OUT_PATH = path.join(ROOT_DIR, 'web/src/theme/generated-presets.ts');

const HEX6_RE = /^#[0-9A-Fa-f]{6}$/;
const HEX6_OR_8_RE = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const PRESET_ID_RE = /^[a-z][a-z0-9_]*$/;
const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

const REQUIRED_PRESET_IDS = [
  'midnight_indigo',
  'nordic_emerald',
  'editorial_amber',
  'oceanic_cobalt',
  'editorial_green',
];

const SEMANTIC_COLOR_KEYS = [
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
];

const CSS_COLOR_VAR_MAP = {
  background: '--mz-bg-canvas',
  bgRaised: '--mz-bg-raised',
  surface: '--mz-surface',
  surfaceAlt: '--mz-surface-alt',
  surfaceHover: '--mz-surface-hover',
  borderSubtle: '--mz-border-subtle',
  borderStrong: '--mz-border-strong',
  textPrimary: '--mz-text-primary',
  textSecondary: '--mz-text-secondary',
  textTertiary: '--mz-text-tertiary',
  primary: '--mz-primary',
  primaryPressed: '--mz-primary-pressed',
  onPrimary: '--mz-on-primary',
  focus: '--mz-focus',
  speakingAccent: '--mz-skill-speaking',
  writingAccent: '--mz-skill-writing',
  readingAccent: '--mz-skill-reading',
  listeningAccent: '--mz-skill-listening',
  vocabAccent: '--mz-skill-vocab',
  success: '--mz-success',
  warning: '--mz-warning',
  error: '--mz-error',
  track: '--mz-track',
  mintBg: '--mz-mint-bg',
  amberBg: '--mz-amber-bg',
  dangerBg: '--mz-danger-bg',
  blueBg: '--mz-blue-bg',
  violetBg: '--mz-violet-bg',
};

const TAILWIND_COLOR_MAP = {
  '--color-canvas': '--mz-bg-canvas',
  '--color-bg-raised': '--mz-bg-raised',
  '--color-surface': '--mz-surface',
  '--color-surface-alt': '--mz-surface-alt',
  '--color-surface-hover': '--mz-surface-hover',
  '--color-border-subtle': '--mz-border-subtle',
  '--color-border-strong': '--mz-border-strong',
  '--color-text-primary': '--mz-text-primary',
  '--color-text-secondary': '--mz-text-secondary',
  '--color-text-tertiary': '--mz-text-tertiary',
  '--color-primary': '--mz-primary',
  '--color-primary-pressed': '--mz-primary-pressed',
  '--color-on-primary': '--mz-on-primary',
  '--color-focus': '--mz-focus',
  '--color-skill-speaking': '--mz-skill-speaking',
  '--color-skill-writing': '--mz-skill-writing',
  '--color-skill-reading': '--mz-skill-reading',
  '--color-skill-listening': '--mz-skill-listening',
  '--color-skill-vocab': '--mz-skill-vocab',
  '--color-success': '--mz-success',
  '--color-warning': '--mz-warning',
  '--color-error': '--mz-error',
  '--color-track': '--mz-track',
  '--color-mint-bg': '--mz-mint-bg',
  '--color-amber-bg': '--mz-amber-bg',
  '--color-danger-bg': '--mz-danger-bg',
  '--color-blue-bg': '--mz-blue-bg',
  '--color-violet-bg': '--mz-violet-bg',
};

const GRADIENT_KEYS = ['primaryButton', 'scoreFill', 'heroCard', 'recommendationCard'];

const CSS_GRADIENT_VAR_MAP = {
  primaryButton: '--mz-gradient-primary',
  scoreFill: '--mz-gradient-score',
  heroCard: '--mz-gradient-hero',
  recommendationCard: '--mz-gradient-recommendation',
};

const TYPOGRAPHY_ROLE_KEYS = [
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
];

const SPACING_KEYS = [
  'xs',
  'sm',
  'md',
  'lg',
  'pageInset',
  'xl',
  'sectionSep',
  'xxl',
  'heroSep',
  'minTouchTarget',
  'bottomNavHeight',
  'maxContentWidth',
];

const SPACING_CSS_VAR_MAP = {
  xs: '--mz-space-xs',
  sm: '--mz-space-sm',
  md: '--mz-space-md',
  lg: '--mz-space-lg',
  pageInset: '--mz-space-page-inset',
  xl: '--mz-space-xl',
  sectionSep: '--mz-space-section-sep',
  xxl: '--mz-space-xxl',
  heroSep: '--mz-space-hero-sep',
  minTouchTarget: '--mz-min-touch-target',
  bottomNavHeight: '--mz-bottom-nav-height',
  maxContentWidth: '--mz-max-content-width',
};

const SHAPE_KEYS = [
  'cardRadius',
  'controlRadius',
  'compactRadius',
  'pillRadius',
  'sheetRadius',
  'strokeWidth',
];

const BREAKPOINT_KEYS = ['tightPhoneThreshold', 'medium', 'expanded', 'desktopMin', 'desktopMax'];

const APP_COLORS_DARK_PRIMITIVES = {
  background: 'darkBg',
  bgRaised: 'darkBgRaised',
  surface: 'darkSurface',
  surfaceAlt: 'darkSurfaceAlt',
  surfaceHover: 'darkSurfaceHover',
  borderSubtle: 'darkBorder',
  borderStrong: 'darkBorderStrong',
  textPrimary: 'darkText',
  textSecondary: 'darkTextSecondary',
  textTertiary: 'darkTextTertiary',
  primary: 'darkAccent',
  primaryPressed: 'darkAccentPressed',
  onPrimary: 'darkAccentContrast',
  focus: 'darkFocus',
  speakingAccent: 'blue',
  writingAccent: 'violet',
  readingAccent: 'mint',
  listeningAccent: 'blue',
  vocabAccent: 'amber',
  success: 'success',
  warning: 'warning',
  error: 'danger',
  track: 'track',
  mintBg: 'mintBg',
  amberBg: 'amberBg',
  dangerBg: 'dangerBg',
  blueBg: 'blueBg',
  violetBg: 'violetBg',
};

const APP_COLORS_LIGHT_PRIMITIVES = {
  background: 'lightBg',
  bgRaised: 'lightBgRaised',
  surface: 'lightSurface',
  surfaceAlt: 'lightSurfaceAlt',
  surfaceHover: 'lightSurfaceHover',
  borderSubtle: 'lightBorder',
  borderStrong: 'lightBorderStrong',
  textPrimary: 'lightText',
  textSecondary: 'lightTextSecondary',
  textTertiary: 'lightTextTertiary',
  primary: 'lightAccent',
  primaryPressed: 'lightAccentPressed',
  onPrimary: 'lightAccentContrast',
  focus: 'lightFocus',
  speakingAccent: 'lightBlue',
  writingAccent: 'lightViolet',
  readingAccent: 'lightMint',
  listeningAccent: 'lightBlue',
  vocabAccent: 'lightAmber',
  success: 'lightSuccess',
  warning: 'lightWarning',
  error: 'lightDanger',
  track: 'lightTrack',
  mintBg: 'lightMintBg',
  amberBg: 'lightAmberBg',
  dangerBg: 'lightDangerBg',
  blueBg: 'lightBlueBg',
  violetBg: 'lightVioletBg',
};

const APP_GRADIENTS_DARK_PRIMITIVES = {
  primaryButton: {
    begin: [-0.8, -0.6],
    end: [0.8, 0.6],
    stops: [0, 1],
    colors: ['indigoBtnStart', 'indigoBtnEnd'],
  },
  scoreFill: {
    begin: [-1, 0],
    end: [1, 0],
    stops: [0, 1],
    colors: ['indigoScoreStart', 'indigoScoreEnd'],
  },
  heroCard: {
    begin: [-0.8, -0.6],
    end: [0.8, 0.6],
    stops: [0, 0.63, 1],
    colors: ['indigoHero1', 'indigoHero2', 'indigoHero3'],
  },
  recommendationCard: {
    begin: [-0.7, -0.7],
    end: [0.7, 0.7],
    stops: [0, 1],
    colors: ['indigoRecStart', 'indigoRecEnd'],
  },
};

const APP_GRADIENTS_LIGHT_PRIMITIVES = {
  primaryButton: {
    begin: [-0.8, -0.6],
    end: [0.8, 0.6],
    stops: [0, 1],
    colors: ['lightAccent', 'darkAccentPressed'],
  },
  scoreFill: {
    begin: [-1, 0],
    end: [1, 0],
    stops: [0, 1],
    colors: ['lightBlue', 'lightViolet'],
  },
  heroCard: {
    begin: [-0.8, -0.6],
    end: [0.8, 0.6],
    stops: [0, 0.63, 1],
    colors: ['lightSurfaceAlt', 'lightHeroMid', 'lightHeroEnd'],
  },
  recommendationCard: {
    begin: [-0.7, -0.7],
    end: [0.7, 0.7],
    stops: [0, 1],
    colors: ['lightSurfaceAlt', 'lightSurfaceHover'],
  },
};

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertExactKeys(obj, requiredKeys, optionalKeys, pathLabel, errors) {
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of requiredKeys) {
    if (!Object.hasOwn(obj, key)) {
      errors.push(`${pathLabel}: missing required key "${key}"`);
    }
  }
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      errors.push(`${pathLabel}: unexpected key "${key}"`);
    }
  }
}

function computeExpectedCssAngleDeg(begin, end) {
  const dx = end[0] - begin[0];
  const dy = end[1] - begin[1];
  const rawAngle = Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360);
  return rawAngle === 0 ? 0 : rawAngle;
}

function validatePoint2D(point, pathLabel, errors) {
  if (!Array.isArray(point) || point.length !== 2) {
    errors.push(`${pathLabel}: expected 2-element array`);
    return false;
  }
  let valid = true;
  for (let i = 0; i < 2; i++) {
    const coord = point[i];
    if (!isFiniteNumber(coord) || coord < -1 || coord > 1) {
      errors.push(`${pathLabel}[${i}]: expected number in [-1, 1], found ${String(coord)}`);
      valid = false;
    }
  }
  return valid;
}

function validateMotionCurve(curve, pathLabel, errors) {
  if (!isPlainObject(curve)) {
    errors.push(`${pathLabel}: expected object`);
    return;
  }
  assertExactKeys(curve, ['name', 'flutter', 'cubicBezier'], [], pathLabel, errors);
  if (!isNonEmptyString(curve.name)) {
    errors.push(`${pathLabel}.name: expected non-empty string`);
  }
  if (!isNonEmptyString(curve.flutter)) {
    errors.push(`${pathLabel}.flutter: expected non-empty string`);
  }
  if (!Array.isArray(curve.cubicBezier) || curve.cubicBezier.length !== 4) {
    errors.push(`${pathLabel}.cubicBezier: expected 4-element number array`);
  } else {
    for (let i = 0; i < 4; i++) {
      const value = curve.cubicBezier[i];
      if (!isFiniteNumber(value) || value < 0 || value > 1) {
        errors.push(
          `${pathLabel}.cubicBezier[${i}]: expected number in [0, 1], found ${String(value)}`,
        );
      }
    }
  }
}

function validateTokens(tokens) {
  const errors = [];
  if (!isPlainObject(tokens)) {
    return ['Root tokens document must be a JSON object'];
  }

  assertExactKeys(
    tokens,
    [
      'schemaVersion',
      'defaults',
      'primitives',
      'presets',
      'typography',
      'spacing',
      'shapes',
      'elevation',
      'motion',
      'breakpoints',
    ],
    ['$schema'],
    'root',
    errors,
  );

  if (typeof tokens.schemaVersion !== 'string' || !SEMVER_RE.test(tokens.schemaVersion)) {
    errors.push(`schemaVersion: expected semver string, found ${String(tokens.schemaVersion)}`);
  }

  // defaults
  if (!isPlainObject(tokens.defaults)) {
    errors.push('defaults: expected object');
  } else {
    assertExactKeys(tokens.defaults, ['presetId', 'mode'], [], 'defaults', errors);
    if (
      typeof tokens.defaults.presetId !== 'string' ||
      !PRESET_ID_RE.test(tokens.defaults.presetId)
    ) {
      errors.push(`defaults.presetId: invalid preset id ${String(tokens.defaults.presetId)}`);
    }
    if (tokens.defaults.mode !== 'dark' && tokens.defaults.mode !== 'light') {
      errors.push(
        `defaults.mode: expected "dark" or "light", found ${String(tokens.defaults.mode)}`,
      );
    }
  }

  // primitives
  if (!isPlainObject(tokens.primitives) || Object.keys(tokens.primitives).length === 0) {
    errors.push('primitives: expected non-empty object');
  } else {
    for (const [key, value] of Object.entries(tokens.primitives)) {
      if (!IDENT_RE.test(key)) {
        errors.push(`primitives.${key}: invalid identifier`);
      }
      if (typeof value !== 'string' || !HEX6_OR_8_RE.test(value)) {
        errors.push(`primitives.${key}: invalid hex color ${String(value)}`);
      }
    }
  }

  // presets
  const seenPresetIds = new Set();
  if (!Array.isArray(tokens.presets) || tokens.presets.length === 0) {
    errors.push('presets: expected non-empty array');
  } else {
    for (let idx = 0; idx < tokens.presets.length; idx++) {
      const preset = tokens.presets[idx];
      const presetLabel = `presets[${idx}]`;
      if (!isPlainObject(preset)) {
        errors.push(`${presetLabel}: expected object`);
        continue;
      }
      assertExactKeys(
        preset,
        ['id', 'displayName', 'description', 'preview', 'modes'],
        [],
        presetLabel,
        errors,
      );
      if (typeof preset.id !== 'string' || !PRESET_ID_RE.test(preset.id)) {
        errors.push(`${presetLabel}.id: invalid preset id ${String(preset.id)}`);
      } else {
        if (seenPresetIds.has(preset.id)) {
          errors.push(`presets: duplicate preset id "${preset.id}"`);
        }
        seenPresetIds.add(preset.id);
      }

      if (!isNonEmptyString(preset.displayName)) {
        errors.push(`${presetLabel}.displayName: expected non-empty string`);
      }
      if (!isNonEmptyString(preset.description)) {
        errors.push(`${presetLabel}.description: expected non-empty string`);
      }

      if (!isPlainObject(preset.preview)) {
        errors.push(`${presetLabel}.preview: expected object`);
      } else {
        assertExactKeys(
          preset.preview,
          ['primary', 'accent', 'backgroundDark'],
          [],
          `${presetLabel}.preview`,
          errors,
        );
        for (const field of ['primary', 'accent', 'backgroundDark']) {
          const val = preset.preview[field];
          if (typeof val !== 'string' || !HEX6_RE.test(val)) {
            errors.push(`${presetLabel}.preview.${field}: expected #RRGGBB, found ${String(val)}`);
          }
        }
      }

      if (!isPlainObject(preset.modes)) {
        errors.push(`${presetLabel}.modes: expected object`);
      } else {
        assertExactKeys(preset.modes, ['dark', 'light'], [], `${presetLabel}.modes`, errors);
        for (const mode of ['dark', 'light']) {
          const modeLabel = `${presetLabel}.modes.${mode}`;
          const palette = preset.modes[mode];
          if (!isPlainObject(palette)) {
            errors.push(`${modeLabel}: expected object`);
            continue;
          }
          assertExactKeys(palette, ['colors', 'gradients'], [], modeLabel, errors);

          if (!isPlainObject(palette.colors)) {
            errors.push(`${modeLabel}.colors: expected object`);
          } else {
            assertExactKeys(palette.colors, SEMANTIC_COLOR_KEYS, [], `${modeLabel}.colors`, errors);
            for (const colorKey of SEMANTIC_COLOR_KEYS) {
              const colorVal = palette.colors[colorKey];
              if (typeof colorVal !== 'string' || !HEX6_RE.test(colorVal)) {
                errors.push(
                  `${modeLabel}.colors.${colorKey}: expected #RRGGBB, found ${String(colorVal)}`,
                );
              }
            }
          }

          if (!isPlainObject(palette.gradients)) {
            errors.push(`${modeLabel}.gradients: expected object`);
          } else {
            assertExactKeys(palette.gradients, GRADIENT_KEYS, [], `${modeLabel}.gradients`, errors);
            for (const gradKey of GRADIENT_KEYS) {
              const gradLabel = `${modeLabel}.gradients.${gradKey}`;
              const grad = palette.gradients[gradKey];
              if (!isPlainObject(grad)) {
                errors.push(`${gradLabel}: expected object`);
                continue;
              }
              assertExactKeys(
                grad,
                ['colors', 'stops', 'begin', 'end', 'cssAngleDeg'],
                [],
                gradLabel,
                errors,
              );

              if (!Array.isArray(grad.colors) || grad.colors.length < 2 || grad.colors.length > 4) {
                errors.push(`${gradLabel}.colors: expected 2..4 hex colors`);
              } else {
                for (let ci = 0; ci < grad.colors.length; ci++) {
                  const hex = grad.colors[ci];
                  if (typeof hex !== 'string' || !HEX6_RE.test(hex)) {
                    errors.push(
                      `${gradLabel}.colors[${ci}]: expected #RRGGBB, found ${String(hex)}`,
                    );
                  }
                }
              }

              if (!Array.isArray(grad.stops) || grad.stops.length < 2 || grad.stops.length > 4) {
                errors.push(`${gradLabel}.stops: expected 2..4 numeric stops`);
              } else {
                if (Array.isArray(grad.colors) && grad.colors.length !== grad.stops.length) {
                  errors.push(
                    `${gradLabel}: colors.length (${grad.colors.length}) must equal stops.length (${grad.stops.length})`,
                  );
                }
                for (let si = 0; si < grad.stops.length; si++) {
                  const stop = grad.stops[si];
                  if (!isFiniteNumber(stop) || stop < 0 || stop > 1) {
                    errors.push(
                      `${gradLabel}.stops[${si}]: expected number in [0, 1], found ${String(stop)}`,
                    );
                  }
                }
                if (grad.stops[0] !== 0) {
                  errors.push(`${gradLabel}.stops[0]: expected 0, found ${String(grad.stops[0])}`);
                }
                if (grad.stops[grad.stops.length - 1] !== 1) {
                  errors.push(
                    `${gradLabel}.stops[last]: expected 1, found ${String(grad.stops[grad.stops.length - 1])}`,
                  );
                }
                for (let si = 1; si < grad.stops.length; si++) {
                  if (!(grad.stops[si] > grad.stops[si - 1])) {
                    errors.push(
                      `${gradLabel}.stops: must be strictly monotonic at index ${si} (${String(grad.stops[si - 1])} -> ${String(grad.stops[si])})`,
                    );
                  }
                }
              }

              const validBegin = validatePoint2D(grad.begin, `${gradLabel}.begin`, errors);
              const validEnd = validatePoint2D(grad.end, `${gradLabel}.end`, errors);
              if (
                !isFiniteNumber(grad.cssAngleDeg) ||
                grad.cssAngleDeg < 0 ||
                grad.cssAngleDeg > 360
              ) {
                errors.push(
                  `${gradLabel}.cssAngleDeg: expected number in [0, 360], found ${String(grad.cssAngleDeg)}`,
                );
              } else if (validBegin && validEnd) {
                const expectedAngle = computeExpectedCssAngleDeg(grad.begin, grad.end);
                if (grad.cssAngleDeg !== expectedAngle) {
                  errors.push(
                    `${gradLabel}.cssAngleDeg (${grad.cssAngleDeg}) must match begin/end angle (${expectedAngle})`,
                  );
                }
              }
            }
          }
        }
      }
    }

    for (const requiredId of REQUIRED_PRESET_IDS) {
      if (!seenPresetIds.has(requiredId)) {
        errors.push(`presets: missing required preset "${requiredId}"`);
      }
    }
    if (isPlainObject(tokens.defaults) && !seenPresetIds.has(tokens.defaults.presetId)) {
      errors.push(`defaults.presetId "${String(tokens.defaults.presetId)}" not found in presets`);
    }
  }

  // typography
  if (!isPlainObject(tokens.typography)) {
    errors.push('typography: expected object');
  } else {
    assertExactKeys(
      tokens.typography,
      ['fontFamilies', 'roles', 'aliases'],
      [],
      'typography',
      errors,
    );

    if (!isPlainObject(tokens.typography.fontFamilies)) {
      errors.push('typography.fontFamilies: expected object');
    } else {
      assertExactKeys(
        tokens.typography.fontFamilies,
        ['flutterSans', 'sansEn', 'sansFa', 'monoExam'],
        [],
        'typography.fontFamilies',
        errors,
      );
      for (const familyKey of ['flutterSans', 'sansEn', 'sansFa', 'monoExam']) {
        if (!isNonEmptyString(tokens.typography.fontFamilies[familyKey])) {
          errors.push(`typography.fontFamilies.${familyKey}: expected non-empty string`);
        }
      }
    }

    if (!isPlainObject(tokens.typography.roles)) {
      errors.push('typography.roles: expected object');
    } else {
      assertExactKeys(
        tokens.typography.roles,
        TYPOGRAPHY_ROLE_KEYS,
        [],
        'typography.roles',
        errors,
      );
      for (const roleKey of TYPOGRAPHY_ROLE_KEYS) {
        const roleLabel = `typography.roles.${roleKey}`;
        const role = tokens.typography.roles[roleKey];
        if (!isPlainObject(role)) {
          errors.push(`${roleLabel}: expected object`);
          continue;
        }
        assertExactKeys(
          role,
          [
            'fontRole',
            'fontSize',
            'fontWeight',
            'lineHeight',
            'letterSpacingPx',
            'tabularNums',
            'colorToken',
          ],
          [],
          roleLabel,
          errors,
        );
        if (role.fontRole !== 'sans' && role.fontRole !== 'mono') {
          errors.push(`${roleLabel}.fontRole: expected "sans" or "mono"`);
        }
        if (!isFiniteNumber(role.fontSize) || role.fontSize <= 0) {
          errors.push(`${roleLabel}.fontSize: expected > 0`);
        }
        if (!Number.isInteger(role.fontWeight) || role.fontWeight < 100 || role.fontWeight > 900) {
          errors.push(`${roleLabel}.fontWeight: expected integer in [100, 900]`);
        }
        if (!isFiniteNumber(role.lineHeight) || role.lineHeight <= 0) {
          errors.push(`${roleLabel}.lineHeight: expected > 0`);
        }
        if (role.letterSpacingPx !== null && !isFiniteNumber(role.letterSpacingPx)) {
          errors.push(`${roleLabel}.letterSpacingPx: expected number or null`);
        }
        if (typeof role.tabularNums !== 'boolean') {
          errors.push(`${roleLabel}.tabularNums: expected boolean`);
        }
        if (
          role.colorToken !== 'textPrimary' &&
          role.colorToken !== 'textSecondary' &&
          role.colorToken !== 'textTertiary'
        ) {
          errors.push(`${roleLabel}.colorToken: invalid color token ${String(role.colorToken)}`);
        }
      }
    }

    if (!isPlainObject(tokens.typography.aliases)) {
      errors.push('typography.aliases: expected object');
    } else {
      assertExactKeys(
        tokens.typography.aliases,
        ['bandDisplay', 'title'],
        [],
        'typography.aliases',
        errors,
      );
      for (const [aliasKey, roleName] of Object.entries(tokens.typography.aliases)) {
        if (
          typeof roleName !== 'string' ||
          !isPlainObject(tokens.typography.roles) ||
          !Object.hasOwn(tokens.typography.roles, roleName)
        ) {
          errors.push(
            `typography.aliases.${aliasKey} ("${String(roleName)}") does not resolve to typography.roles`,
          );
        }
      }
    }
  }

  // spacing
  if (!isPlainObject(tokens.spacing)) {
    errors.push('spacing: expected object');
  } else {
    assertExactKeys(tokens.spacing, SPACING_KEYS, [], 'spacing', errors);
    for (const key of SPACING_KEYS) {
      const val = tokens.spacing[key];
      if (!Number.isInteger(val) || val < 0) {
        errors.push(`spacing.${key}: expected integer >= 0, found ${String(val)}`);
      }
    }
  }

  // shapes
  if (!isPlainObject(tokens.shapes)) {
    errors.push('shapes: expected object');
  } else {
    assertExactKeys(tokens.shapes, SHAPE_KEYS, [], 'shapes', errors);
    for (const key of SHAPE_KEYS) {
      const val = tokens.shapes[key];
      if (!isFiniteNumber(val) || val < 0) {
        errors.push(`shapes.${key}: expected number >= 0, found ${String(val)}`);
      }
    }
  }

  // elevation
  if (!isPlainObject(tokens.elevation)) {
    errors.push('elevation: expected object');
  } else {
    assertExactKeys(
      tokens.elevation,
      ['appBar', 'surface', 'card', 'toast', 'borderRule', 'shadows'],
      [],
      'elevation',
      errors,
    );
    if (tokens.elevation.appBar !== 0) {
      errors.push(`elevation.appBar: expected 0, found ${String(tokens.elevation.appBar)}`);
    }
    if (tokens.elevation.surface !== 0) {
      errors.push(`elevation.surface: expected 0, found ${String(tokens.elevation.surface)}`);
    }
    if (tokens.elevation.card !== 0) {
      errors.push(`elevation.card: expected 0, found ${String(tokens.elevation.card)}`);
    }
    if (tokens.elevation.toast !== 4) {
      errors.push(`elevation.toast: expected 4, found ${String(tokens.elevation.toast)}`);
    }
    if (!isNonEmptyString(tokens.elevation.borderRule)) {
      errors.push('elevation.borderRule: expected non-empty string');
    }
    if (!isPlainObject(tokens.elevation.shadows)) {
      errors.push('elevation.shadows: expected object');
    } else {
      assertExactKeys(
        tokens.elevation.shadows,
        ['surface', 'toastDark', 'toastLight'],
        [],
        'elevation.shadows',
        errors,
      );
      for (const shadowKey of ['surface', 'toastDark', 'toastLight']) {
        if (!isNonEmptyString(tokens.elevation.shadows[shadowKey])) {
          errors.push(`elevation.shadows.${shadowKey}: expected non-empty string`);
        }
      }
    }
  }

  // motion
  if (!isPlainObject(tokens.motion)) {
    errors.push('motion: expected object');
  } else {
    assertExactKeys(tokens.motion, ['standard', 'reduced'], [], 'motion', errors);
    for (const bundleName of ['standard', 'reduced']) {
      const bundleLabel = `motion.${bundleName}`;
      const bundle = tokens.motion[bundleName];
      if (!isPlainObject(bundle)) {
        errors.push(`${bundleLabel}: expected object`);
        continue;
      }
      assertExactKeys(
        bundle,
        [
          'microDurationMs',
          'standardDurationMs',
          'sheetDurationMs',
          'emphasisDurationMs',
          'standardCurve',
          'decelerateCurve',
        ],
        [],
        bundleLabel,
        errors,
      );
      for (const durKey of [
        'microDurationMs',
        'standardDurationMs',
        'sheetDurationMs',
        'emphasisDurationMs',
      ]) {
        const dur = bundle[durKey];
        if (!Number.isInteger(dur) || dur < 0) {
          errors.push(`${bundleLabel}.${durKey}: expected integer >= 0, found ${String(dur)}`);
        }
      }
      validateMotionCurve(bundle.standardCurve, `${bundleLabel}.standardCurve`, errors);
      validateMotionCurve(bundle.decelerateCurve, `${bundleLabel}.decelerateCurve`, errors);
    }
  }

  // breakpoints
  if (!isPlainObject(tokens.breakpoints)) {
    errors.push('breakpoints: expected object');
  } else {
    assertExactKeys(tokens.breakpoints, BREAKPOINT_KEYS, [], 'breakpoints', errors);
    for (const key of BREAKPOINT_KEYS) {
      const val = tokens.breakpoints[key];
      if (!Number.isInteger(val) || val <= 0) {
        errors.push(`breakpoints.${key}: expected integer > 0, found ${String(val)}`);
      }
    }
  }

  return errors;
}

function toCamelCase(snake) {
  return snake.replace(/_([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

function toDartColor(hex) {
  const upper = hex.slice(1).toUpperCase();
  if (upper.length === 8) {
    const rgb = upper.slice(0, 6);
    const alpha = upper.slice(6, 8);
    return `Color(0x${alpha}${rgb})`;
  }
  return `Color(0xFF${upper})`;
}

function toCssHex(hex) {
  return `#${hex.slice(1).toUpperCase()}`;
}

function toDartNum(num) {
  const normalized = Object.is(num, -0) ? 0 : num;
  return String(normalized);
}

function toDartString(str) {
  const escaped = str.replace(/\\/g, '\\\\').replace(/\$/g, '\\$').replace(/'/g, "\\'");
  return `'${escaped}'`;
}

function toTsString(str) {
  const escaped = str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `'${escaped}'`;
}

function gradientToCss(gradient) {
  const stops = gradient.colors.map((color, index) => {
    const stopValue = gradient.stops[index];
    const percent = Math.round(stopValue * 1000) / 10;
    return `${toCssHex(color)} ${percent}%`;
  });
  return `linear-gradient(${gradient.cssAngleDeg}deg, ${stops.join(', ')})`;
}

function formatDartAppColors(colors, indent) {
  const pad = ' '.repeat(indent);
  const lines = [`${pad}AppColors(`];
  for (const key of SEMANTIC_COLOR_KEYS) {
    lines.push(`${pad}  ${key}: ${toDartColor(colors[key])},`);
  }
  lines.push(`${pad})`);
  return lines.join('\n');
}

function formatDartLinearGradient(gradient, indent) {
  const pad = ' '.repeat(indent);
  const lines = [`${pad}LinearGradient(`];
  const [bx, by] = gradient.begin;
  const [ex, ey] = gradient.end;
  const isDefaultBegin = bx === -1 && by === 0;
  const isDefaultEnd = ex === 1 && ey === 0;
  const isDefaultStops =
    gradient.stops.length === 2 && gradient.stops[0] === 0 && gradient.stops[1] === 1;

  if (!isDefaultBegin) {
    lines.push(`${pad}  begin: Alignment(${toDartNum(bx)}, ${toDartNum(by)}),`);
  }
  if (!isDefaultEnd) {
    lines.push(`${pad}  end: Alignment(${toDartNum(ex)}, ${toDartNum(ey)}),`);
  }
  if (!isDefaultStops) {
    const stopLiterals = gradient.stops.map((s) => toDartNum(s)).join(', ');
    lines.push(`${pad}  stops: <double>[${stopLiterals}],`);
  }
  lines.push(`${pad}  colors: <Color>[`);
  for (const hex of gradient.colors) {
    lines.push(`${pad}    ${toDartColor(hex)},`);
  }
  lines.push(`${pad}  ],`);
  lines.push(`${pad})`);
  return lines.join('\n');
}

function colorsMatchPrimitiveMap(colors, primitiveMap, primitives) {
  for (const key of SEMANTIC_COLOR_KEYS) {
    const primKey = primitiveMap[key];
    const primHex = primitives[primKey];
    if (typeof primHex !== 'string' || toCssHex(colors[key]) !== toCssHex(primHex)) {
      return false;
    }
  }
  return true;
}

function arraysEqual(a, b) {
  return a.length === b.length && a.every((val, idx) => val === b[idx]);
}

function gradientsMatchPrimitiveMap(gradients, primitiveMap, primitives) {
  for (const key of GRADIENT_KEYS) {
    const grad = gradients[key];
    const spec = primitiveMap[key];
    if (
      !arraysEqual(grad.begin, spec.begin) ||
      !arraysEqual(grad.end, spec.end) ||
      !arraysEqual(grad.stops, spec.stops) ||
      grad.colors.length !== spec.colors.length
    ) {
      return false;
    }
    for (let i = 0; i < spec.colors.length; i++) {
      const primHex = primitives[spec.colors[i]];
      if (typeof primHex !== 'string' || toCssHex(grad.colors[i]) !== toCssHex(primHex)) {
        return false;
      }
    }
  }
  return true;
}

function formatDartAppGradients(gradients, indent) {
  const pad = ' '.repeat(indent);
  const lines = [`${pad}AppGradients(`];
  for (const key of GRADIENT_KEYS) {
    const gradExpr = formatDartLinearGradient(gradients[key], indent + 2).trimStart();
    lines.push(`${pad}  ${key}: ${gradExpr},`);
  }
  lines.push(`${pad})`);
  return lines.join('\n');
}

function generateDart(tokens) {
  const lines = [
    '// GENERATED CODE - DO NOT EDIT BY HAND.',
    '// Source: packages/design-tokens/tokens.json',
    '// Regenerate: pnpm tokens:sync',
    '',
    "import 'package:flutter/material.dart';",
    "import 'package:mockza/theme/app_colors.dart';",
    "import 'package:mockza/theme/app_gradients.dart';",
    "import 'package:mockza/theme/theme_preset.dart';",
    '',
    '/// Auto-generated raw palette color primitives from `tokens.json`.',
    'abstract final class GeneratedPaletteTokens {',
  ];

  const primitiveEntries = Object.entries(tokens.primitives);
  for (let i = 0; i < primitiveEntries.length; i++) {
    const [key, hex] = primitiveEntries[i];
    if (i > 0) {
      lines.push('');
    }
    lines.push(`  /// Primitive color token \`${key}\` (\`${toCssHex(hex)}\`).`);
    lines.push(`  static const Color ${key} = ${toDartColor(hex)};`);
  }
  lines.push('}');
  lines.push('');

  lines.push('/// Auto-generated spacing scale tokens from `tokens.json`.');
  lines.push('abstract final class GeneratedSpacingTokens {');
  for (let i = 0; i < SPACING_KEYS.length; i++) {
    const key = SPACING_KEYS[i];
    const val = tokens.spacing[key];
    if (i > 0) {
      lines.push('');
    }
    lines.push(`  /// Spacing token \`${key}\` (\`${val}dp\`).`);
    lines.push(`  static const double ${key} = ${toDartNum(val)};`);
  }
  lines.push('}');
  lines.push('');

  lines.push('/// Auto-generated shape radius and stroke tokens from `tokens.json`.');
  lines.push('abstract final class GeneratedShapeTokens {');
  for (let i = 0; i < SHAPE_KEYS.length; i++) {
    const key = SHAPE_KEYS[i];
    const val = tokens.shapes[key];
    if (i > 0) {
      lines.push('');
    }
    lines.push(`  /// Shape token \`${key}\` (\`${val}dp\`).`);
    lines.push(`  static const double ${key} = ${toDartNum(val)};`);
  }
  lines.push('}');
  lines.push('');

  lines.push('/// Auto-generated motion duration tokens from `tokens.json`.');
  lines.push('abstract final class GeneratedMotionTokens {');
  const motionEntries = [
    ['microDurationMs', tokens.motion.standard.microDurationMs, 'Standard micro interaction'],
    [
      'standardDurationMs',
      tokens.motion.standard.standardDurationMs,
      'Standard navigation/state transition',
    ],
    ['sheetDurationMs', tokens.motion.standard.sheetDurationMs, 'Standard sheet/dialog reveal'],
    [
      'emphasisDurationMs',
      tokens.motion.standard.emphasisDurationMs,
      'Standard emphasis transition',
    ],
    [
      'reducedMicroDurationMs',
      tokens.motion.reduced.microDurationMs,
      'Reduced-motion micro interaction',
    ],
    [
      'reducedStandardDurationMs',
      tokens.motion.reduced.standardDurationMs,
      'Reduced-motion navigation/state transition',
    ],
    [
      'reducedSheetDurationMs',
      tokens.motion.reduced.sheetDurationMs,
      'Reduced-motion sheet/dialog reveal',
    ],
    [
      'reducedEmphasisDurationMs',
      tokens.motion.reduced.emphasisDurationMs,
      'Reduced-motion emphasis transition',
    ],
  ];
  for (let i = 0; i < motionEntries.length; i++) {
    const [key, val, desc] = motionEntries[i];
    if (i > 0) {
      lines.push('');
    }
    lines.push(`  /// ${desc} duration in milliseconds (\`${val}\`).`);
    lines.push(`  static const int ${key} = ${toDartNum(val)};`);
  }
  lines.push('}');
  lines.push('');

  lines.push('/// Auto-generated typography family tokens from `tokens.json`.');
  lines.push('abstract final class GeneratedTypographyTokens {');
  lines.push(
    `  /// Primary Flutter sans font family (\`${tokens.typography.fontFamilies.flutterSans}\`).`,
  );
  lines.push(
    `  static const String flutterSans = ${toDartString(tokens.typography.fontFamilies.flutterSans)};`,
  );
  lines.push('');
  lines.push('  /// Compatibility alias for [flutterSans].');
  lines.push('  static const String sansFamily = flutterSans;');
  lines.push('}');
  lines.push('');

  lines.push('/// Auto-generated built-in [MzThemePreset] catalog from `tokens.json`.');
  lines.push('abstract final class GeneratedPresetCatalog {');
  lines.push(`  /// Default theme preset identifier (\`${tokens.defaults.presetId}\`).`);
  lines.push(`  static const String defaultPresetId = ${toDartString(tokens.defaults.presetId)};`);
  lines.push('');
  lines.push(`  /// Default theme brightness mode (\`${tokens.defaults.mode}\`).`);
  lines.push(`  static const String defaultMode = ${toDartString(tokens.defaults.mode)};`);

  const presetFieldNames = [];
  for (const preset of tokens.presets) {
    const fieldName = toCamelCase(preset.id);
    presetFieldNames.push(fieldName);
    lines.push('');
    lines.push(`  /// ${preset.displayName} preset (${preset.description})`);
    lines.push(`  static const MzThemePreset ${fieldName} = MzThemePreset(`);
    lines.push(`    id: ${toDartString(preset.id)},`);
    lines.push(`    displayName: ${toDartString(preset.displayName)},`);
    lines.push(`    description: ${toDartString(preset.description)},`);
    lines.push(`    previewPrimary: ${toDartColor(preset.preview.primary)},`);
    lines.push(`    previewAccent: ${toDartColor(preset.preview.accent)},`);
    lines.push(`    previewBackgroundDark: ${toDartColor(preset.preview.backgroundDark)},`);
    const darkColorsExpr = colorsMatchPrimitiveMap(
      preset.modes.dark.colors,
      APP_COLORS_DARK_PRIMITIVES,
      tokens.primitives,
    )
      ? 'AppColors.dark'
      : formatDartAppColors(preset.modes.dark.colors, 4).trimStart();
    const lightColorsExpr = colorsMatchPrimitiveMap(
      preset.modes.light.colors,
      APP_COLORS_LIGHT_PRIMITIVES,
      tokens.primitives,
    )
      ? 'AppColors.light'
      : formatDartAppColors(preset.modes.light.colors, 4).trimStart();
    const darkGradientsExpr = gradientsMatchPrimitiveMap(
      preset.modes.dark.gradients,
      APP_GRADIENTS_DARK_PRIMITIVES,
      tokens.primitives,
    )
      ? 'AppGradients.dark'
      : formatDartAppGradients(preset.modes.dark.gradients, 4).trimStart();
    const lightGradientsExpr = gradientsMatchPrimitiveMap(
      preset.modes.light.gradients,
      APP_GRADIENTS_LIGHT_PRIMITIVES,
      tokens.primitives,
    )
      ? 'AppGradients.light'
      : formatDartAppGradients(preset.modes.light.gradients, 4).trimStart();

    lines.push(`    darkColors: ${darkColorsExpr},`);
    lines.push(`    lightColors: ${lightColorsExpr},`);
    lines.push(`    darkGradients: ${darkGradientsExpr},`);
    lines.push(`    lightGradients: ${lightGradientsExpr},`);
    lines.push('  );');
  }

  lines.push('');
  lines.push('  /// All built-in presets in canonical catalog order.');
  lines.push('  static const List<MzThemePreset> builtInPresets = <MzThemePreset>[');
  for (const fieldName of presetFieldNames) {
    lines.push(`    ${fieldName},`);
  }
  lines.push('  ];');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

function generateCss(tokens) {
  const lines = [
    '/* GENERATED FILE - DO NOT EDIT BY HAND. */',
    '/* Source: packages/design-tokens/tokens.json */',
    '/* Regenerate: pnpm tokens:sync */',
    '',
    ':root {',
    '  /* Typography Families */',
    `  --mz-font-sans-en: ${tokens.typography.fontFamilies.sansEn};`,
    `  --mz-font-sans-fa: ${tokens.typography.fontFamilies.sansFa};`,
    `  --mz-font-mono: ${tokens.typography.fontFamilies.monoExam};`,
    '',
    '  /* Spacing Scale */',
  ];

  for (const key of SPACING_KEYS) {
    lines.push(`  ${SPACING_CSS_VAR_MAP[key]}: ${tokens.spacing[key]}px;`);
  }

  lines.push('');
  lines.push('  /* Shape Radii & Stroke */');
  lines.push(`  --mz-radius-card: ${tokens.shapes.cardRadius}px;`);
  lines.push(`  --mz-radius-control: ${tokens.shapes.controlRadius}px;`);
  lines.push(`  --mz-radius-compact: ${tokens.shapes.compactRadius}px;`);
  lines.push(`  --mz-radius-pill: ${tokens.shapes.pillRadius}px;`);
  lines.push(`  --mz-radius-sheet: ${tokens.shapes.sheetRadius}px;`);
  lines.push(`  --mz-stroke-width: ${tokens.shapes.strokeWidth}px;`);

  lines.push('');
  lines.push('  /* Motion Durations & Easings */');
  lines.push(`  --mz-duration-micro: ${tokens.motion.standard.microDurationMs}ms;`);
  lines.push(`  --mz-duration-standard: ${tokens.motion.standard.standardDurationMs}ms;`);
  lines.push(`  --mz-duration-sheet: ${tokens.motion.standard.sheetDurationMs}ms;`);
  lines.push(`  --mz-duration-emphasis: ${tokens.motion.standard.emphasisDurationMs}ms;`);
  lines.push(
    `  --mz-ease-standard: cubic-bezier(${tokens.motion.standard.standardCurve.cubicBezier.join(', ')});`,
  );
  lines.push(
    `  --mz-ease-decelerate: cubic-bezier(${tokens.motion.standard.decelerateCurve.cubicBezier.join(', ')});`,
  );

  lines.push('');
  lines.push('  /* Elevation & Shadows */');
  lines.push(`  --mz-shadow-surface: ${tokens.elevation.shadows.surface};`);
  lines.push(`  --mz-shadow-toast-dark: ${tokens.elevation.shadows.toastDark};`);
  lines.push(`  --mz-shadow-toast-light: ${tokens.elevation.shadows.toastLight};`);
  if (Object.hasOwn(tokens.primitives, 'scrimBarrier')) {
    lines.push(`  --mz-scrim-barrier: ${toCssHex(tokens.primitives.scrimBarrier)};`);
  }
  lines.push('}');
  lines.push('');

  lines.push('@media (prefers-reduced-motion: reduce) {');
  lines.push('  :root {');
  lines.push(`    --mz-duration-micro: ${tokens.motion.reduced.microDurationMs}ms;`);
  lines.push(`    --mz-duration-standard: ${tokens.motion.reduced.standardDurationMs}ms;`);
  lines.push(`    --mz-duration-sheet: ${tokens.motion.reduced.sheetDurationMs}ms;`);
  lines.push(`    --mz-duration-emphasis: ${tokens.motion.reduced.emphasisDurationMs}ms;`);
  lines.push(
    `    --mz-ease-standard: cubic-bezier(${tokens.motion.reduced.standardCurve.cubicBezier.join(', ')});`,
  );
  lines.push(
    `    --mz-ease-decelerate: cubic-bezier(${tokens.motion.reduced.decelerateCurve.cubicBezier.join(', ')});`,
  );
  lines.push('  }');
  lines.push('}');

  for (const preset of tokens.presets) {
    for (const mode of ['dark', 'light']) {
      const palette = preset.modes[mode];
      const isDefault = preset.id === tokens.defaults.presetId && mode === tokens.defaults.mode;

      lines.push('');
      if (isDefault) {
        lines.push(':root,');
      }
      lines.push(`:root[data-theme="${preset.id}"][data-mode="${mode}"] {`);
      lines.push(`  color-scheme: ${mode};`);

      for (const colorKey of SEMANTIC_COLOR_KEYS) {
        lines.push(`  ${CSS_COLOR_VAR_MAP[colorKey]}: ${toCssHex(palette.colors[colorKey])};`);
      }
      for (const gradKey of GRADIENT_KEYS) {
        lines.push(
          `  ${CSS_GRADIENT_VAR_MAP[gradKey]}: ${gradientToCss(palette.gradients[gradKey])};`,
        );
      }
      const toastShadow =
        mode === 'dark' ? tokens.elevation.shadows.toastDark : tokens.elevation.shadows.toastLight;
      lines.push(`  --mz-shadow-toast: ${toastShadow};`);
      lines.push('}');
    }
  }

  lines.push('');
  lines.push('@theme inline {');
  for (const [twVar, mzVar] of Object.entries(TAILWIND_COLOR_MAP)) {
    lines.push(`  ${twVar}: var(${mzVar});`);
  }
  lines.push('');
  lines.push('  --radius-card: var(--mz-radius-card);');
  lines.push('  --radius-control: var(--mz-radius-control);');
  lines.push('  --radius-compact: var(--mz-radius-compact);');
  lines.push('  --radius-pill: var(--mz-radius-pill);');
  lines.push('  --radius-sheet: var(--mz-radius-sheet);');
  lines.push('');
  lines.push('  --font-sans: var(--mz-font-sans-en);');
  lines.push('  --font-sans-fa: var(--mz-font-sans-fa);');
  lines.push('  --font-mono: var(--mz-font-mono);');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

function generateTs(tokens) {
  const defaultPreset =
    tokens.presets.find((preset) => preset.id === tokens.defaults.presetId) ?? tokens.presets[0];

  const lines = [
    '// GENERATED FILE - DO NOT EDIT BY HAND.',
    '// Source: packages/design-tokens/tokens.json',
    '// Regenerate: pnpm tokens:sync',
    '',
    'export const THEME_PRESET_IDS = [',
  ];

  for (const preset of tokens.presets) {
    lines.push(`  ${toTsString(preset.id)},`);
  }
  lines.push('] as const;');
  lines.push('');
  lines.push('export type ThemePresetId = (typeof THEME_PRESET_IDS)[number];');
  lines.push('');
  lines.push("export type ThemeMode = 'dark' | 'light';");
  lines.push('');
  lines.push('export interface ThemePresetPreview {');
  lines.push('  readonly primary: string;');
  lines.push('  readonly accent: string;');
  lines.push('  readonly backgroundDark: string;');
  lines.push('}');
  lines.push('');
  lines.push('export interface ThemePresetMeta {');
  lines.push('  readonly id: ThemePresetId;');
  lines.push('  readonly displayName: string;');
  lines.push('  readonly description: string;');
  lines.push('  readonly preview: ThemePresetPreview;');
  lines.push('}');
  lines.push('');
  lines.push(
    `export const DEFAULT_THEME_PRESET_ID: ThemePresetId = ${toTsString(tokens.defaults.presetId)};`,
  );
  lines.push(`export const DEFAULT_THEME_MODE: ThemeMode = ${toTsString(tokens.defaults.mode)};`);
  lines.push('');
  lines.push('const DEFAULT_THEME_PRESET: ThemePresetMeta = {');
  lines.push(`  id: ${toTsString(defaultPreset.id)},`);
  lines.push(`  displayName: ${toTsString(defaultPreset.displayName)},`);
  lines.push(`  description: ${toTsString(defaultPreset.description)},`);
  lines.push('  preview: {');
  lines.push(`    primary: ${toTsString(toCssHex(defaultPreset.preview.primary))},`);
  lines.push(`    accent: ${toTsString(toCssHex(defaultPreset.preview.accent))},`);
  lines.push(`    backgroundDark: ${toTsString(toCssHex(defaultPreset.preview.backgroundDark))},`);
  lines.push('  },');
  lines.push('};');
  lines.push('');
  lines.push('export const THEME_PRESETS: readonly ThemePresetMeta[] = [');
  for (const preset of tokens.presets) {
    lines.push('  {');
    lines.push(`    id: ${toTsString(preset.id)},`);
    lines.push(`    displayName: ${toTsString(preset.displayName)},`);
    lines.push(`    description: ${toTsString(preset.description)},`);
    lines.push('    preview: {');
    lines.push(`      primary: ${toTsString(toCssHex(preset.preview.primary))},`);
    lines.push(`      accent: ${toTsString(toCssHex(preset.preview.accent))},`);
    lines.push(`      backgroundDark: ${toTsString(toCssHex(preset.preview.backgroundDark))},`);
    lines.push('    },');
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');
  lines.push('export function isThemePresetId(value: string): value is ThemePresetId {');
  lines.push('  return (THEME_PRESET_IDS as readonly string[]).includes(value);');
  lines.push('}');
  lines.push('');
  lines.push('export function resolveThemePreset(id?: string): ThemePresetMeta {');
  lines.push('  if (id !== undefined) {');
  lines.push('    for (const preset of THEME_PRESETS) {');
  lines.push('      if (preset.id === id) {');
  lines.push('        return preset;');
  lines.push('      }');
  lines.push('    }');
  lines.push('  }');
  lines.push('  return DEFAULT_THEME_PRESET;');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

function findFirstDiffLine(actual, expected) {
  const actualLines = actual.split('\n');
  const expectedLines = expected.split('\n');
  const maxLen = Math.max(actualLines.length, expectedLines.length);
  for (let i = 0; i < maxLen; i++) {
    if (actualLines[i] !== expectedLines[i]) {
      return i + 1;
    }
  }
  return 1;
}

function main() {
  const args = process.argv.slice(2);
  let checkMode = false;
  if (args.length === 1 && args[0] === '--check') {
    checkMode = true;
  } else if (args.length !== 0) {
    console.error('Usage: node scripts/sync_design_tokens.mjs [--check]');
    process.exit(2);
  }

  let rawJson;
  try {
    rawJson = fs.readFileSync(TOKENS_PATH, 'utf8');
  } catch (err) {
    console.error(`Failed to read ${TOKENS_PATH}: ${err.message}`);
    process.exit(1);
  }

  let tokens;
  try {
    tokens = JSON.parse(rawJson);
  } catch (err) {
    console.error(`Invalid JSON in ${TOKENS_PATH}: ${err.message}`);
    process.exit(1);
  }

  const validationErrors = validateTokens(tokens);
  if (validationErrors.length > 0) {
    console.error(`Design tokens validation failed (${validationErrors.length} error(s)):`);
    for (const msg of validationErrors) {
      console.error(`  - ${msg}`);
    }
    process.exit(1);
  }

  const targets = [
    {
      path: path.join(ROOT_DIR, 'app/lib/core/preferences/generated_appearance_defaults.dart'),
      content: [
        '// Generated by scripts/sync_design_tokens.mjs.',
        '',
        '/// Appearance preference defaults shared with the web build.',
        'abstract final class GeneratedAppearanceDefaults {',
        '  /// Default theme preset.',
        `  static const presetId = ${toDartString(tokens.defaults.presetId)};`,
        '',
        '  /// Default theme mode.',
        `  static const mode = ${toDartString(tokens.defaults.mode)};`,
        '}',
        '',
      ].join('\n'),
    },
    { path: DART_OUT_PATH, content: generateDart(tokens) },
    { path: CSS_OUT_PATH, content: generateCss(tokens) },
    { path: TS_OUT_PATH, content: generateTs(tokens) },
  ];

  if (checkMode) {
    let drifted = false;
    for (const target of targets) {
      const relPath = path.relative(ROOT_DIR, target.path);
      if (!fs.existsSync(target.path)) {
        console.error(`DRIFT: ${relPath} is missing (run: pnpm tokens:sync)`);
        drifted = true;
        continue;
      }
      const existing = fs.readFileSync(target.path, 'utf8');
      if (existing !== target.content) {
        const diffLine = findFirstDiffLine(existing, target.content);
        console.error(`DRIFT: ${relPath} differs at line ${diffLine} (run: pnpm tokens:sync)`);
        drifted = true;
      }
    }
    if (drifted) {
      process.exit(1);
    }
    console.log('Design tokens in sync across Flutter, CSS, and TypeScript.');
    return;
  }

  for (const target of targets) {
    const relPath = path.relative(ROOT_DIR, target.path);
    fs.mkdirSync(path.dirname(target.path), { recursive: true });
    const prev = fs.existsSync(target.path) ? fs.readFileSync(target.path, 'utf8') : null;
    if (prev === target.content) {
      console.log(`Unchanged: ${relPath}`);
    } else {
      fs.writeFileSync(target.path, target.content, 'utf8');
      console.log(`Updated:   ${relPath}`);
    }
  }
}

main();

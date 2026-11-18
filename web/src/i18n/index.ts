import { type EditionCode, getActiveEditionCode } from '@/edition/edition-config';
import { enMessages } from './en';
import { faMessages } from './fa';
import type { TranslationDictionary, TranslationKey, TranslationVars } from './types';

export { BdiLtr, type BdiLtrProps } from './BdiLtr';
export type { TranslationDictionary, TranslationKey, TranslationVars } from './types';

// Compile-time bidirectional parity guard: missing or extra keys in `faMessages` fail `tsc --noEmit`.
type MissingInFa = Exclude<keyof typeof enMessages, keyof typeof faMessages>;
type ExtraInFa = Exclude<keyof typeof faMessages, keyof typeof enMessages>;
const _assertNoMissingInFa: MissingInFa extends never ? true : never = true;
const _assertNoExtraInFa: ExtraInFa extends never ? true : never = true;
void _assertNoMissingInFa;
void _assertNoExtraInFa;

export const UNICODE_LRI = '\u2066';
export const UNICODE_PDI = '\u2069';

function isAlreadyDirectionallyIsolated(value: string): boolean {
  if (value.length < 2) {
    return false;
  }
  const first = value.charCodeAt(0);
  const last = value.charCodeAt(value.length - 1);
  const startsWithIsolate = first === 0x2066 || first === 0x2067 || first === 0x2068;
  return startsWithIsolate && last === 0x2069;
}

function getDictionaryForEdition(edition: EditionCode): TranslationDictionary {
  if (edition === 'irn' && import.meta.env.PUBLIC_EDITION !== 'glb') {
    return faMessages;
  }
  if (edition === 'glb' && import.meta.env.PUBLIC_EDITION !== 'irn') {
    return enMessages;
  }
  return import.meta.env.PUBLIC_EDITION === 'irn' ? faMessages : enMessages;
}

function interpolateTemplate(
  template: string,
  edition: EditionCode,
  vars?: TranslationVars,
): string {
  if (!vars) {
    return template;
  }
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    if (!Object.hasOwn(vars, key)) {
      return match;
    }
    const rawValue = vars[key];
    if (rawValue === undefined) {
      return match;
    }
    const str = String(rawValue);
    if (edition === 'irn' && !isAlreadyDirectionallyIsolated(str)) {
      return `${UNICODE_LRI}${str}${UNICODE_PDI}`;
    }
    return str;
  });
}

export function translate(
  edition: EditionCode,
  key: TranslationKey,
  vars?: TranslationVars,
): string {
  const dictionary = getDictionaryForEdition(edition);
  const template = dictionary[key];
  return interpolateTemplate(template, edition, vars);
}

export type TranslatorFn = (key: TranslationKey, vars?: TranslationVars) => string;

export function createTranslator(
  edition: EditionCode = getActiveEditionCode(),
): TranslatorFn {
  return (key, vars) => translate(edition, key, vars);
}

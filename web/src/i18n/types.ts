import type { enMessages } from './en';

export type TranslationKey = keyof typeof enMessages;

export type TranslationDictionary = Readonly<Record<TranslationKey, string>>;

export type TranslationVars = Readonly<Record<string, string | number>>;

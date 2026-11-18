export type EditionCode = 'glb' | 'irn';

export interface EditionFeatures {
  readonly oauthGoogleApple: boolean;
  readonly smsOtp: boolean;
  readonly localPaymentGateway: boolean;
  readonly ecosystemHandoff: boolean;
}

export interface EditionConfig {
  readonly edition: EditionCode;
  readonly brandName: string;
  readonly domain: string;
  readonly apiBaseUrl: string;
  readonly cdnBaseUrl: string;
  readonly locale: 'en-US' | 'fa-IR';
  readonly dir: 'ltr' | 'rtl';
  readonly calendar: 'gregorian' | 'jalali';
  readonly currency: 'USD' | 'IRR';
  readonly features: EditionFeatures;
}

function createGlbEditionConfig(): EditionConfig {
  return {
    edition: 'glb',
    brandName: 'Mockza',
    domain: 'mockza.com',
    apiBaseUrl: 'https://api.mockza.com',
    cdnBaseUrl: 'https://cdn.mockza.com',
    locale: 'en-US',
    dir: 'ltr',
    calendar: 'gregorian',
    currency: 'USD',
    features: {
      oauthGoogleApple: true,
      smsOtp: false,
      localPaymentGateway: false,
      ecosystemHandoff: false,
    },
  };
}

function createIrnEditionConfig(): EditionConfig {
  return {
    edition: 'irn',
    brandName: 'سنجیا',
    domain: 'sanjia.ir',
    apiBaseUrl: 'https://api.sanjia.ir',
    cdnBaseUrl: 'https://cdn.sanjia.ir',
    locale: 'fa-IR',
    dir: 'rtl',
    calendar: 'jalali',
    currency: 'IRR',
    features: {
      oauthGoogleApple: false,
      smsOtp: true,
      localPaymentGateway: true,
      ecosystemHandoff: true,
    },
  };
}

export function getActiveEditionCode(): EditionCode {
  return import.meta.env.PUBLIC_EDITION === 'irn' ? 'irn' : 'glb';
}

export function getActiveEditionDir(): 'ltr' | 'rtl' {
  return import.meta.env.PUBLIC_EDITION === 'irn' ? 'rtl' : 'ltr';
}

export function getActiveEditionConfig(): EditionConfig {
  if (import.meta.env.PUBLIC_EDITION === 'irn') {
    return createIrnEditionConfig();
  }
  return createGlbEditionConfig();
}

export function getEditionConfig(edition: EditionCode): EditionConfig {
  if (edition === 'irn' && import.meta.env.PUBLIC_EDITION !== 'glb') {
    return createIrnEditionConfig();
  }
  if (edition === 'glb' && import.meta.env.PUBLIC_EDITION !== 'irn') {
    return createGlbEditionConfig();
  }
  return getActiveEditionConfig();
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getActiveEditionCode,
  getActiveEditionConfig,
  getEditionConfig,
} from '@/edition/edition-config';

describe('W1.4 EditionConfig (GLB vs IRN)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to glb when PUBLIC_EDITION is unset or glb', () => {
    vi.stubEnv('PUBLIC_EDITION', '');
    expect(getActiveEditionCode()).toBe('glb');

    const glb = getActiveEditionConfig();
    expect(glb).toEqual({
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
        zarinpal: false,
        naviaHandoff: false,
      },
    });
  });

  it('switches cleanly to irn when PUBLIC_EDITION=irn', () => {
    vi.stubEnv('PUBLIC_EDITION', 'irn');
    expect(getActiveEditionCode()).toBe('irn');

    const irn = getActiveEditionConfig();
    expect(irn).toEqual({
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
        zarinpal: true,
        naviaHandoff: true,
      },
    });
  });

  it('exposes explicit per-edition lookup for tests and diagnostics', () => {
    const glb = getEditionConfig('glb');
    const irn = getEditionConfig('irn');
    expect(glb.dir).toBe('ltr');
    expect(glb.currency).toBe('USD');
    expect(irn.dir).toBe('rtl');
    expect(irn.currency).toBe('IRR');
  });
});

import { IrnOtpAuthAdapter } from '@/adapters/irn/otp-auth.adapter';
import { ZarinpalBillingAdapter } from '@/adapters/irn/zarinpal-billing.adapter';
import { createEditionDependencies } from './bootstrap-shared';
import type { AppDependencies } from './container';

export const IRN_API_BASE_URL = 'https://api.sanjia.ir' as const;
export const IRN_CDN_BASE_URL = 'https://cdn.sanjia.ir' as const;

export interface BootstrapIrnRuntimeOptions {
  readonly apiBaseUrl?: string;
  readonly cdnBaseUrl?: string;
  readonly dbName?: string;
  readonly fetchFn?: typeof fetch;
  readonly allowDevAuth?: boolean;
}

export function createIrnDependencies(options: BootstrapIrnRuntimeOptions = {}): AppDependencies {
  return createEditionDependencies({
    ...options,
    edition: 'irn',
    defaultApiBaseUrl: IRN_API_BASE_URL,
    defaultCdnBaseUrl: IRN_CDN_BASE_URL,
    createAuthAdapter: (deps) => new IrnOtpAuthAdapter(deps),
    createBillingAdapter: (deps) => new ZarinpalBillingAdapter(deps),
  });
}

import { GlbOAuthAuthAdapter } from '@/adapters/glb/oauth.adapter';
import { StripeBillingAdapter } from '@/adapters/glb/stripe-billing.adapter';
import { createEditionDependencies } from './bootstrap-shared';
import type { AppDependencies } from './container';

export const GLB_API_BASE_URL = 'https://api.mockza.com' as const;
export const GLB_CDN_BASE_URL = 'https://cdn.mockza.com' as const;

export interface BootstrapRuntimeOptions {
  readonly apiBaseUrl?: string;
  readonly cdnBaseUrl?: string;
  readonly dbName?: string;
  readonly fetchFn?: typeof fetch;
  readonly allowDevAuth?: boolean;
}

export function createGlbDependencies(options: BootstrapRuntimeOptions = {}): AppDependencies {
  return createEditionDependencies({
    ...options,
    edition: 'glb',
    defaultApiBaseUrl: GLB_API_BASE_URL,
    defaultCdnBaseUrl: GLB_CDN_BASE_URL,
    createAuthAdapter: (deps) => new GlbOAuthAuthAdapter(deps),
    createBillingAdapter: (deps) => new StripeBillingAdapter(deps),
  });
}

import { createGlbDependencies } from './bootstrap-glb';
import { createIrnDependencies } from './bootstrap-irn';
import type { AppDependencies } from './container';

export interface AppBootstrapOptions {
  readonly apiBaseUrl?: string;
  readonly cdnBaseUrl?: string;
  readonly dbName?: string;
  readonly fetchFn?: typeof fetch;
  readonly allowDevAuth?: boolean;
}

/**
 * Selects the edition-specific DI composition root via static `import.meta.env.PUBLIC_EDITION`
 * comparison so Vite/Rollup dead-code-eliminates the inactive edition from production bundles.
 */
export function createAppDependencies(options: AppBootstrapOptions = {}): AppDependencies {
  if (import.meta.env.PUBLIC_EDITION === 'irn') {
    return createIrnDependencies(options);
  }
  return createGlbDependencies(options);
}

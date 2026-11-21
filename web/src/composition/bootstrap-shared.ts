import { DexieLinguisticCache } from '@/adapters/dexie/dexie-linguistic.adapter';
import { DexieOutboxAdapter } from '@/adapters/dexie/dexie-outbox.adapter';
import { DexieStorageAdapter } from '@/adapters/dexie/dexie-storage.adapter';
import { MockzaDexieDb } from '@/adapters/dexie/mockza-db';
import { ApiClient, createHttpOutboxTransport } from '@/adapters/http/api-client';
import { HttpDiagnosticAdapter } from '@/adapters/http/http-diagnostic.adapter';
import { HttpEvaluationAdapter } from '@/adapters/http/http-evaluation.adapter';
import { HttpLinguisticAdapter } from '@/adapters/http/http-linguistic.adapter';
import type { HttpAuthAdapter } from '@/adapters/http/http-auth.adapter';
import { HttpTelemetryAdapter, SystemClock } from '@/adapters/http/http-telemetry.adapter';
import { OpfsCatalogAdapter } from '@/adapters/media/opfs-catalog.adapter';
import {
  WebAudioPlayerAdapter,
  WebAudioRecorderAdapter,
} from '@/adapters/media/web-audio.adapter';
import type { EditionCode } from '@/edition/edition-config';
import type { IBillingGateway } from '@/gateways/billing.gateway';
import type { AppDependencies } from './container';

export interface EditionBootstrapOptions {
  readonly edition: EditionCode;
  readonly defaultApiBaseUrl: string;
  readonly defaultCdnBaseUrl: string;
  readonly apiBaseUrl?: string;
  readonly cdnBaseUrl?: string;
  readonly dbName?: string;
  readonly fetchFn?: typeof fetch;
  readonly allowDevAuth?: boolean;
  readonly createAuthAdapter: (deps: {
    readonly apiClient: ApiClient;
    readonly db: MockzaDexieDb;
    readonly clock: SystemClock;
    readonly allowDevAuth: boolean;
  }) => HttpAuthAdapter;
  readonly createBillingAdapter: (deps: {
    readonly apiClient: ApiClient;
    readonly allowDevAuth: boolean;
  }) => IBillingGateway;
}

/**
 * DRY shared composition builder for live GLB and IRN runtime containers.
 * Keeps IndexedDB, OPFS, API client refresh wiring, Web Audio, and telemetry
 * single-sourced while delegating edition-specific auth and billing via factories.
 */
export function createEditionDependencies(options: EditionBootstrapOptions): AppDependencies {
  const isLocalHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');
  const apiBaseUrl =
    options.apiBaseUrl ??
    import.meta.env?.['PUBLIC_API_BASE_URL'] ??
    (isLocalHost
      ? `${window.location.protocol}//${window.location.hostname}:45281`
      : options.defaultApiBaseUrl);
  const cdnBaseUrl = options.cdnBaseUrl ?? options.defaultCdnBaseUrl;
  const allowDevAuth =
    options.allowDevAuth ?? (import.meta.env?.['PUBLIC_ALLOW_DEV_AUTH'] === 'true' || isLocalHost);

  const clock = new SystemClock();
  const db = new MockzaDexieDb(options.dbName);
  const storageAdapter = new DexieStorageAdapter({ db, clock });

  let authAdapter: HttpAuthAdapter | null = null;

  const apiClient = new ApiClient({
    apiBaseUrl,
    edition: options.edition,
    fetchFn: options.fetchFn,
    readAccessToken: () => authAdapter?.getCurrentAccessToken() ?? null,
    refreshAccessToken: async () => {
      if (!authAdapter) return null;
      const current = await authAdapter.getSession();
      const wasAuthenticated = current.ok && Boolean(current.value?.isAuthenticated);
      const res = await authAdapter.ensureAuthenticated(true);
      if (!res.ok) return null;
      if (wasAuthenticated && !res.value.isAuthenticated) {
        return null;
      }
      return res.value.accessToken;
    },
    onSessionRevoked: () => {
      authAdapter?.handleRemoteSessionRevoked();
    },
  });

  authAdapter = options.createAuthAdapter({
    apiClient,
    db,
    clock,
    allowDevAuth,
  });

  const catalogAdapter = new OpfsCatalogAdapter({
    db,
    edition: options.edition,
    clock,
    apiClient,
    fetchFn: options.fetchFn,
    apiBaseUrl,
    cdnBaseUrl,
    getAuthHeaders: (): Record<string, string> => {
      const token = authAdapter?.getCurrentAccessToken();
      if (token) {
        return { authorization: `Bearer ${token}` };
      }
      return {};
    },
  });

  const syncOutbox = new DexieOutboxAdapter({
    db,
    catalogMedia: catalogAdapter,
    transport: createHttpOutboxTransport(apiClient),
    clock,
    fetchFn: options.fetchFn,
  });

  const billing = options.createBillingAdapter({ apiClient, allowDevAuth });
  const audioRecorder = new WebAudioRecorderAdapter();
  const audioPlayer = new WebAudioPlayerAdapter({
    resolveMediaUrl: async (src) => {
      const res = await catalogAdapter.getCachedMediaUrl(src);
      if (res.ok) return res;
      return {
        ok: false,
        error: {
          kind: 'audio',
          code: 'PLAYBACK_FAILED',
          message: res.error.message,
        },
      };
    },
  });
  const diagnostic = new HttpDiagnosticAdapter({ apiClient, fetchFn: options.fetchFn });
  const evaluation = new HttpEvaluationAdapter({ apiClient, fetchFn: options.fetchFn });
  const linguistic = new HttpLinguisticAdapter({
    apiClient,
    edition: options.edition,
    fetchFn: options.fetchFn,
    cache: new DexieLinguisticCache(db),
  });
  const telemetry = new HttpTelemetryAdapter({ apiClient, clock });

  return {
    edition: options.edition,
    auth: authAdapter,
    deviceSlots: authAdapter,
    billing,
    audioRecorder,
    audioPlayer,
    attemptStore: storageAdapter,
    syncOutbox,
    vocabStore: storageAdapter,
    catalog: catalogAdapter,
    diagnostic,
    evaluation,
    linguistic,
    telemetry,
    clock,
  };
}

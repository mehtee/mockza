import type {
  IPersonalizationGateway,
  PersonalizationGatewayError,
  PersonalizationStateDto,
  RecordBandEventInput,
  SyncPullDto,
  UpdatePersonalizationProfileInput,
  VocabBatchSyncInput,
  VocabWaveSummaryDto,
} from '@/gateways/personalization.gateway';
import { err, ok, type Result } from '@/gateways/result';
import type { MockzaDexieDb } from '../dexie/mockza-db';
import type { ApiClient, ApiClientError } from './api-client';

function mapApiError(error: ApiClientError): PersonalizationGatewayError {
  switch (error.kind) {
    case 'network':
    case 'unauthorized':
    case 'validation':
      return error;
    default:
      return {
        kind: 'unexpected',
        message: error.message,
        cause: error,
      };
  }
}

const STATE_MEMORY_TTL_MS = 10_000;

export class HttpPersonalizationAdapter implements IPersonalizationGateway {
  private readonly apiClient: ApiClient;
  private readonly db?: MockzaDexieDb;
  private stateInFlight: Promise<
    Result<PersonalizationStateDto, PersonalizationGatewayError>
  > | null = null;
  private cachedMemoryState: {
    readonly value: PersonalizationStateDto;
    readonly fetchedAtMs: number;
  } | null = null;

  constructor(options: { readonly apiClient: ApiClient; readonly db?: MockzaDexieDb }) {
    this.apiClient = options.apiClient;
    this.db = options.db;
  }

  async getState(): Promise<Result<PersonalizationStateDto, PersonalizationGatewayError>> {
    if (
      this.cachedMemoryState &&
      Date.now() - this.cachedMemoryState.fetchedAtMs < STATE_MEMORY_TTL_MS
    ) {
      return ok(this.cachedMemoryState.value);
    }
    if (this.stateInFlight) {
      return this.stateInFlight;
    }

    const request = (async (): Promise<
      Result<PersonalizationStateDto, PersonalizationGatewayError>
    > => {
      const res = await this.apiClient.get<PersonalizationStateDto>('/v1/personalization/state');
      if (res.ok) {
        this.cachedMemoryState = { value: res.value, fetchedAtMs: Date.now() };
        await this.cacheState(res.value).catch(() => {});
        return ok(res.value);
      }
      const isTransientOrRateLimited =
        res.error.kind === 'network' || res.error.kind === 'quota_exceeded';
      if (isTransientOrRateLimited) {
        if (this.cachedMemoryState) {
          return ok(this.cachedMemoryState.value);
        }
        if (this.db) {
          const cached = await this.readCachedState().catch(() => null);
          if (cached) {
            this.cachedMemoryState = { value: cached, fetchedAtMs: Date.now() };
            return ok(cached);
          }
        }
      }
      return err(mapApiError(res.error));
    })().finally(() => {
      if (this.stateInFlight === request) {
        this.stateInFlight = null;
      }
    });

    this.stateInFlight = request;
    return request;
  }

  async updateProfile(
    input: UpdatePersonalizationProfileInput,
  ): Promise<Result<PersonalizationStateDto, PersonalizationGatewayError>> {
    this.cachedMemoryState = null;
    const res = await this.apiClient.put<PersonalizationStateDto>(
      '/v1/personalization/profile',
      input,
    );
    if (res.ok) {
      this.cachedMemoryState = { value: res.value, fetchedAtMs: Date.now() };
      await this.cacheState(res.value).catch(() => {});
      return ok(res.value);
    }
    return err(mapApiError(res.error));
  }

  async recordBandEvent(
    input: RecordBandEventInput,
  ): Promise<Result<PersonalizationStateDto, PersonalizationGatewayError>> {
    this.cachedMemoryState = null;
    const res = await this.apiClient.post<PersonalizationStateDto>(
      '/v1/personalization/band-event',
      input,
    );
    if (res.ok) {
      this.cachedMemoryState = { value: res.value, fetchedAtMs: Date.now() };
      await this.cacheState(res.value).catch(() => {});
      return ok(res.value);
    }
    return err(mapApiError(res.error));
  }

  async advanceRoadmapStep(
    stepId: string,
    status: 'completed' | 'skipped' | 'active',
  ): Promise<Result<PersonalizationStateDto, PersonalizationGatewayError>> {
    this.cachedMemoryState = null;
    const res = await this.apiClient.post<PersonalizationStateDto>(
      `/v1/personalization/roadmap/steps/${encodeURIComponent(stepId)}/action`,
      { status },
    );
    if (res.ok) {
      this.cachedMemoryState = { value: res.value, fetchedAtMs: Date.now() };
      await this.cacheState(res.value).catch(() => {});
      return ok(res.value);
    }
    return err(mapApiError(res.error));
  }

  async ackBandShift(): Promise<
    Result<{ readonly ok: boolean; readonly bandShift: number }, PersonalizationGatewayError>
  > {
    this.cachedMemoryState = null;
    const res = await this.apiClient.post<{ readonly ok: boolean; readonly bandShift: number }>(
      '/v1/personalization/band-shift/ack',
      {},
    );
    return res.ok ? ok(res.value) : err(mapApiError(res.error));
  }

  async pullSync(sinceIso?: string): Promise<Result<SyncPullDto, PersonalizationGatewayError>> {
    const path = sinceIso ? `/v1/sync/pull?since=${encodeURIComponent(sinceIso)}` : '/v1/sync/pull';
    const res = await this.apiClient.get<SyncPullDto>(path, { timeoutMs: 25_000 });
    return res.ok ? ok(res.value) : err(mapApiError(res.error));
  }

  async pushVocabBatch(
    input: VocabBatchSyncInput,
  ): Promise<Result<VocabWaveSummaryDto, PersonalizationGatewayError>> {
    const res = await this.apiClient.post<VocabWaveSummaryDto>('/v1/sync/vocab-batch', input);
    return res.ok ? ok(res.value) : err(mapApiError(res.error));
  }

  private async cacheState(state: PersonalizationStateDto): Promise<void> {
    if (!this.db) return;
    await this.db.personalizationState.put({
      key: 'current',
      payloadJson: JSON.stringify(state),
      updatedAtMs: Date.now(),
    });
  }

  private async readCachedState(): Promise<PersonalizationStateDto | null> {
    if (!this.db) return null;
    const row = await this.db.personalizationState.get('current');
    if (!row?.payloadJson) return null;
    return JSON.parse(row.payloadJson) as PersonalizationStateDto;
  }
}

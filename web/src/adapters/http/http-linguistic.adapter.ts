import type { EditionCode } from '@/edition/edition-config';
import type { RecordedClip } from '@/gateways/audio.gateway';
import type {
  CompleteDailyMissionInput,
  DailyMissionSnapshot,
  DropHistoryPage,
  DropIngestInput,
  DropMediaContentType,
  DroppedContentItem,
  DropPresignMediaResponse,
  ILinguisticGateway,
  LinguisticGatewayError,
  LinguisticGraphSnapshot,
  RefreshDailyMissionInput,
  UpdateGraphInterestsInput,
  VerifyRepeatAloudResponse,
} from '@/gateways/linguistic.gateway';
import type { ISyncOutboxGateway } from '@/gateways/storage.gateway';
import type { IClock } from '@/gateways/telemetry.gateway';
import { err, ok, type Result } from '@/gateways/result';
import type { DexieLinguisticCache } from '../dexie/dexie-linguistic.adapter';
import type { ApiClient, ApiClientError } from './api-client';
import { uploadPresignedAudioClip } from './presigned-audio-upload';

function mapApiError(error: ApiClientError): LinguisticGatewayError {
  switch (error.kind) {
    case 'network':
    case 'unauthorized':
    case 'entitlement_required':
    case 'quota_exceeded':
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

export class HttpLinguisticAdapter implements ILinguisticGateway {
  private readonly apiClient: ApiClient;
  private readonly edition: EditionCode;
  private readonly fetchFn: typeof fetch;
  private readonly cache?: DexieLinguisticCache;
  private readonly outbox?: Pick<ISyncOutboxGateway, 'enqueue'>;
  private readonly clock?: Pick<IClock, 'todaySerialDay'>;

  constructor(options: {
    readonly apiClient: ApiClient;
    readonly edition: EditionCode;
    readonly fetchFn?: typeof fetch;
    readonly cache?: DexieLinguisticCache;
    readonly outbox?: Pick<ISyncOutboxGateway, 'enqueue'>;
    readonly clock?: Pick<IClock, 'todaySerialDay'>;
  }) {
    this.apiClient = options.apiClient;
    this.edition = options.edition;
    this.fetchFn =
      options.fetchFn ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
    this.cache = options.cache;
    this.outbox = options.outbox;
    this.clock = options.clock;
  }

  async getMyGraph(): Promise<Result<LinguisticGraphSnapshot, LinguisticGatewayError>> {
    const res = await this.apiClient.get<LinguisticGraphSnapshot>('/v1/graph/me');
    if (res.ok) {
      await this.cache?.cacheGraph(res.value, this.edition).catch(() => {});
      return ok(res.value);
    }
    if (this.cache && res.error.kind === 'network') {
      const cached = await this.cache.readCachedGraph(this.edition);
      if (cached.totalEvidenceCount > 0) {
        return ok(cached);
      }
    }
    return err(mapApiError(res.error));
  }

  async updateInterests(
    input: UpdateGraphInterestsInput,
  ): Promise<Result<LinguisticGraphSnapshot, LinguisticGatewayError>> {
    const res = await this.apiClient.request<LinguisticGraphSnapshot>('/v1/graph/interests', {
      method: 'PATCH',
      body: input,
    });
    if (res.ok) {
      await this.cache?.cacheGraph(res.value, this.edition).catch(() => {});
      return ok(res.value);
    }
    return err(mapApiError(res.error));
  }

  async getTodayMission(params?: {
    readonly examTrack?: string;
    readonly dueWords?: readonly string[];
  }): Promise<Result<DailyMissionSnapshot, LinguisticGatewayError>> {
    const qs = new URLSearchParams();
    if (params?.examTrack) qs.set('examTrack', params.examTrack);
    if (params?.dueWords?.length) qs.set('dueWords', params.dueWords.slice(0, 5).join(','));
    const path = qs.toString() ? `/v1/missions/today?${qs.toString()}` : '/v1/missions/today';
    const res = await this.apiClient.get<DailyMissionSnapshot>(path);
    if (res.ok) {
      await this.cache?.cacheDailyMission(res.value).catch(() => {});
      return ok(res.value);
    }
    if (this.cache && res.error.kind === 'network') {
      const today = this.clock?.todaySerialDay() ?? Math.floor(Date.now() / 86_400_000);
      const cached = await this.cache.readCachedDailyMission(this.edition, today);
      if (cached) return ok(cached);
    }
    return err(mapApiError(res.error));
  }

  async refreshTodayMission(
    input: RefreshDailyMissionInput,
  ): Promise<Result<DailyMissionSnapshot, LinguisticGatewayError>> {
    const res = await this.apiClient.post<DailyMissionSnapshot>('/v1/missions/today/refresh', input, {
      timeoutMs: 25_000,
    });
    if (res.ok) {
      await this.cache?.cacheDailyMission(res.value).catch(() => {});
      return ok(res.value);
    }
    return err(mapApiError(res.error));
  }

  async completeMission(
    missionId: string,
    input: CompleteDailyMissionInput,
  ): Promise<Result<DailyMissionSnapshot, LinguisticGatewayError>> {
    const res = await this.apiClient.post<DailyMissionSnapshot>(
      `/v1/missions/${encodeURIComponent(missionId)}/complete`,
      input,
      { timeoutMs: 35_000 },
    );
    if (res.ok) {
      await this.cache?.cacheDailyMission(res.value).catch(() => {});
      return ok(res.value);
    }
    if (res.error.kind === 'network' && this.outbox) {
      await this.outbox.enqueue({
        idempotencyKey: `mission.complete:${missionId}`,
        actionType: 'mission.complete',
        entityKind: 'daily_mission',
        payloadJson: JSON.stringify({ missionId, ...input }),
      });
    }
    return err(mapApiError(res.error));
  }

  async completeMissionWithClip(
    missionId: string,
    params: {
      readonly clip: RecordedClip;
      readonly usedTargetKeys?: readonly string[];
    },
  ): Promise<Result<DailyMissionSnapshot, LinguisticGatewayError>> {
    const attemptId = crypto.randomUUID();
    const uploadRes = await uploadPresignedAudioClip({
      apiClient: this.apiClient,
      fetchFn: this.fetchFn,
      attemptId,
      partIndex: 3,
      clip: params.clip,
    });
    if (!uploadRes.ok) {
      return err(mapApiError(uploadRes.error));
    }
    return this.completeMission(missionId, {
      audioObjectKey: uploadRes.value.objectKey,
      ...(params.usedTargetKeys?.length ? { usedTargetKeys: [...params.usedTargetKeys] } : {}),
    });
  }

  async shiftRegisterFromClip(params: {
    readonly clip: RecordedClip;
    readonly examTrack: string;
    readonly topicHint?: string;
  }): Promise<Result<{ readonly jobId: string }, LinguisticGatewayError>> {
    const attemptId = crypto.randomUUID();
    const uploadRes = await uploadPresignedAudioClip({
      apiClient: this.apiClient,
      fetchFn: this.fetchFn,
      attemptId,
      partIndex: 1,
      clip: params.clip,
    });
    if (!uploadRes.ok) {
      return err(mapApiError(uploadRes.error));
    }
    const res = await this.apiClient.post<{ readonly jobId: string }>(
      '/v1/register-shifter/shift',
      {
        inputMode: 'audio',
        objectKey: uploadRes.value.objectKey,
        examTrack: params.examTrack,
        ...(params.topicHint ? { topicHint: params.topicHint } : {}),
        durationSeconds: Math.max(5, Math.min(45, Math.round(params.clip.durationMs / 1000))),
      },
    );
    return res.ok ? ok(res.value) : err(mapApiError(res.error));
  }

  async shiftRegisterFromText(params: {
    readonly text: string;
    readonly examTrack: string;
    readonly topicHint?: string;
  }): Promise<Result<{ readonly jobId: string }, LinguisticGatewayError>> {
    const res = await this.apiClient.post<{ readonly jobId: string }>('/v1/register-shifter/shift', {
      inputMode: 'text',
      rawText: params.text.trim(),
      examTrack: params.examTrack,
      ...(params.topicHint ? { topicHint: params.topicHint } : {}),
    });
    return res.ok ? ok(res.value) : err(mapApiError(res.error));
  }

  async verifyRepeatAloud(
    runId: string,
    params: {
      readonly gearLevel: 1 | 2;
      readonly expectedSentence: string;
      readonly targetPhrases: readonly string[];
      readonly clip: RecordedClip;
    },
  ): Promise<Result<VerifyRepeatAloudResponse, LinguisticGatewayError>> {
    const attemptId = crypto.randomUUID();
    const uploadRes = await uploadPresignedAudioClip({
      apiClient: this.apiClient,
      fetchFn: this.fetchFn,
      attemptId,
      partIndex: 2,
      clip: params.clip,
    });
    if (!uploadRes.ok) {
      return err(mapApiError(uploadRes.error));
    }
    const res = await this.apiClient.post<VerifyRepeatAloudResponse>(
      `/v1/register-shifter/${encodeURIComponent(runId)}/verify-repeat`,
      {
        objectKey: uploadRes.value.objectKey,
        gearLevel: params.gearLevel,
        expectedSentence: params.expectedSentence,
        targetPhrases: [...params.targetPhrases],
      },
      { timeoutMs: 35_000 },
    );
    return res.ok ? ok(res.value) : err(mapApiError(res.error));
  }

  async uploadDropMediaFile(params: {
    readonly dropId: string;
    readonly mediaKind: 'image' | 'audio';
    readonly index: number;
    readonly bytes: Uint8Array;
    readonly contentType: DropMediaContentType;
  }): Promise<Result<{ readonly objectKey: string }, LinguisticGatewayError>> {
    const batchRes = await this.uploadDropMediaBatch({
      dropId: params.dropId,
      mediaKind: params.mediaKind,
      files: [{ bytes: params.bytes, contentType: params.contentType }],
    });
    if (!batchRes.ok) return err(batchRes.error);
    const key = batchRes.value.objectKeys[0];
    if (!key) {
      return err({ kind: 'unexpected', message: 'Presign response missing object key.' });
    }
    return ok({ objectKey: key });
  }

  async uploadDropMediaBatch(params: {
    readonly dropId: string;
    readonly mediaKind: 'image' | 'audio';
    readonly files: ReadonlyArray<{
      readonly bytes: Uint8Array;
      readonly contentType: DropMediaContentType;
    }>;
  }): Promise<Result<{ readonly objectKeys: readonly string[] }, LinguisticGatewayError>> {
    const presignRes = await this.apiClient.post<DropPresignMediaResponse>('/v1/drop/presign-media', {
      dropId: params.dropId,
      mediaKind: params.mediaKind,
      files: params.files.map((f) => ({
        contentType: f.contentType,
        byteLength: f.bytes.byteLength,
      })),
    });
    if (!presignRes.ok) {
      return err(mapApiError(presignRes.error));
    }
    if (presignRes.value.items.length !== params.files.length) {
      return err({
        kind: 'unexpected',
        message: 'Presign response count mismatch for uploaded files.',
      });
    }
    const objectKeys: string[] = [];
    try {
      for (let i = 0; i < params.files.length; i += 1) {
        const slot = presignRes.value.items[i]!;
        const file = params.files[i]!;
        const uploadUrl = this.apiClient.resolveUrl(slot.uploadUrl);
        const copy = new Uint8Array(file.bytes.byteLength);
        copy.set(file.bytes);
        const putRes = await this.fetchFn(uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': file.contentType },
          body: copy.buffer,
        });
        if (!putRes.ok) {
          return err({
            kind: 'network',
            status: putRes.status,
            retryable: putRes.status >= 500,
            message: `Media upload failed (${putRes.status})`,
          });
        }
        objectKeys.push(slot.objectKey);
      }
      return ok({ objectKeys });
    } catch (cause) {
      return err({
        kind: 'network',
        retryable: true,
        message: cause instanceof Error ? cause.message : 'Media upload error',
      });
    }
  }

  async ingestDrop(input: DropIngestInput): Promise<Result<{ readonly jobId: string }, LinguisticGatewayError>> {
    const res = await this.apiClient.post<{ readonly jobId: string }>('/v1/drop/ingest', input);
    return res.ok ? ok(res.value) : err(mapApiError(res.error));
  }

  async getDropHistory(cursor?: string): Promise<Result<DropHistoryPage, LinguisticGatewayError>> {
    const path = cursor ? `/v1/drop/history?cursor=${encodeURIComponent(cursor)}` : '/v1/drop/history';
    const res = await this.apiClient.get<DropHistoryPage>(path);
    if (res.ok) return ok(res.value);
    if (this.cache && !cursor && res.error.kind === 'network') {
      const cached = await this.cache.readCachedDropHistory(this.edition);
      if (cached.length > 0) return ok({ items: cached, nextCursor: null });
    }
    return err(mapApiError(res.error));
  }

  async getDropById(dropId: string): Promise<Result<DroppedContentItem, LinguisticGatewayError>> {
    const res = await this.apiClient.get<DroppedContentItem>(`/v1/drop/${encodeURIComponent(dropId)}`);
    if (res.ok) {
      await this.cache?.cacheDropItem(res.value).catch(() => {});
      return ok(res.value);
    }
    if (this.cache && res.error.kind === 'network') {
      const cached = await this.cache.readCachedDropById(dropId);
      if (cached) return ok(cached);
    }
    return err(mapApiError(res.error));
  }

  async deleteDrop(dropId: string): Promise<Result<void, LinguisticGatewayError>> {
    const res = await this.apiClient.request<{ readonly deleted: boolean }>(
      `/v1/drop/${encodeURIComponent(dropId)}`,
      { method: 'DELETE' },
    );
    if (res.ok) {
      await this.cache?.deleteCachedDrop(dropId).catch(() => {});
      return ok(undefined);
    }
    return err(mapApiError(res.error));
  }

  async pollAdvancedJob<T = unknown>(
    jobId: string,
  ): Promise<
    Result<
      { readonly status: string; readonly stage?: string; readonly result?: T },
      LinguisticGatewayError
    >
  > {
    const res = await this.apiClient.get<{
      readonly status: string;
      readonly stage?: string;
      readonly result?: T;
      readonly advancedResult?: T;
    }>(`/v1/jobs/${encodeURIComponent(jobId)}`);
    return res.ok
      ? ok({
          status: res.value.status,
          stage: res.value.stage,
          result: res.value.advancedResult ?? res.value.result,
        })
      : err(mapApiError(res.error));
  }
}

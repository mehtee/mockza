import { serialDayFromUtcMs } from '@mockza/domain';
import type { ICatalogMediaGateway } from '@/gateways/catalog.gateway';
import { type Result, type StorageError, err, ok } from '@/gateways/result';
import type {
  AttemptStatus,
  ISyncOutboxGateway,
  OutboxMutationInput,
  SyncFlushReport,
  SyncOutboxError,
  SyncOutboxItem,
} from '@/gateways/storage.gateway';
import type { IClock } from '@/gateways/telemetry.gateway';
import { THIRTY_DAYS_MS } from '../media/opfs-catalog.adapter';
import type { MockzaDexieDb } from './mockza-db';

export const MAX_OUTBOX_RETRY_COUNT = 6;
export const MAX_OUTBOX_BACKOFF_MS = 15 * 60_000;
export const BASE_OUTBOX_BACKOFF_MS = 2_000;

export const PROTECTED_AUDIO_ATTEMPT_STATUSES: ReadonlySet<AttemptStatus> = new Set([
  'in_progress',
  'submitted_local',
  'uploading_audio',
  'queued_remote',
  'failed_retryable',
]);

export function computeOutboxBackoffMs(retryCount: number): number {
  const safeCount = Math.max(0, Math.trunc(retryCount));
  return Math.min(MAX_OUTBOX_BACKOFF_MS, BASE_OUTBOX_BACKOFF_MS * 2 ** safeCount);
}

export function stripAudioMimeCodecs(mimeType: string): string {
  const base = mimeType.split(';')[0]?.trim().toLowerCase();
  return base && base.length > 0 ? base : 'audio/mp4';
}

/**
 * Uploads raw audio bytes to a presigned S3/object-storage URL using ONLY `Content-Type`
 * (codecs suffix stripped) and ZERO `Authorization` or `x-mockza-edition` headers.
 */
export async function putBytesToPresignedUrl(
  input: {
    readonly uploadUrl: string;
    readonly bytes: Uint8Array;
    readonly contentType: string;
  },
  fetchFn: typeof fetch = (url, init) => globalThis.fetch(url, init),
): Promise<Result<void, SyncOutboxError>> {
  try {
    const strippedMime = stripAudioMimeCodecs(input.contentType);
    const bodyCopy = new Uint8Array(input.bytes.byteLength);
    bodyCopy.set(input.bytes);
    const response = await fetchFn(input.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': strippedMime,
      },
      body: bodyCopy.buffer,
    });
    if (!response.ok) {
      return err({
        kind: 'network',
        message: `Presigned audio PUT failed (${response.status})`,
        retryable: response.status >= 500 || response.status === 429,
        status: response.status,
      });
    }
    return ok(undefined);
  } catch (cause) {
    return err({
      kind: 'network',
      message: `Presigned audio PUT network error: ${cause instanceof Error ? cause.message : String(cause)}`,
      retryable: true,
    });
  }
}

export interface SpeakingTurnOutboxEntry {
  readonly partIndex?: number;
  readonly turnId?: string;
  readonly promptId?: string;
  readonly promptText?: string;
  readonly mediaKey?: string;
  readonly clipId?: string;
  readonly localFilePath?: string;
  readonly recordingId?: string;
  readonly durationMs?: number;
  readonly contentType?: string;
  objectKey?: string;
}

export interface OutboxTransport {
  enqueueWritingEvaluation(payload: Record<string, unknown>): Promise<Result<{ readonly jobId: string }, SyncOutboxError>>;
  presignAudioUpload(input: {
    readonly attemptId: string;
    readonly partIndex: number;
    readonly turnId: string;
    readonly byteLength: number;
    readonly contentType: string;
  }): Promise<Result<{ readonly uploadUrl: string; readonly objectKey: string }, SyncOutboxError>>;
  uploadAudioToPresignedUrl?(input: {
    readonly uploadUrl: string;
    readonly bytes: Uint8Array;
    readonly contentType: string;
  }): Promise<Result<void, SyncOutboxError>>;
  enqueueSpeakingEvaluation(payload: Record<string, unknown>): Promise<Result<{ readonly jobId: string }, SyncOutboxError>>;
  flagQuestion(payload: Record<string, unknown>): Promise<Result<void, SyncOutboxError>>;
  syncVocabLogs?(payload: Record<string, unknown>): Promise<Result<void, SyncOutboxError>>;
}

export type CatalogMediaForOutbox = Pick<
  ICatalogMediaGateway,
  'readUserRecordingBytes' | 'updateRecordingRemoteKey'
> & {
  deleteMediaBinary(mediaKey: string): Promise<void>;
};

export interface DexieOutboxAdapterOptions {
  readonly db: MockzaDexieDb;
  readonly catalogMedia: CatalogMediaForOutbox;
  readonly transport: OutboxTransport;
  readonly clock?: IClock;
  readonly fetchFn?: typeof fetch;
  readonly isOnline?: () => boolean;
  readonly autoAttachOnlineListener?: boolean;
  readonly windowTarget?: {
    addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  };
}

function createDefaultClock(): IClock {
  return {
    nowMs: () => Date.now(),
    nowIso: () => new Date().toISOString(),
    todaySerialDay: () => serialDayFromUtcMs(Date.now()),
  };
}

function toStorageError(message: string, cause: unknown): StorageError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return { kind: 'storage', message: `${message}: ${detail}` };
}

function isTerminalOutboxErrorKind(
  kind: SyncOutboxError['kind'],
): kind is 'quota_exceeded' | 'entitlement_required' | 'unauthorized' | 'validation' {
  return (
    kind === 'quota_exceeded' ||
    kind === 'entitlement_required' ||
    kind === 'unauthorized' ||
    kind === 'validation'
  );
}

export class DexieOutboxAdapter implements ISyncOutboxGateway {
  private readonly db: MockzaDexieDb;
  private readonly catalogMedia: CatalogMediaForOutbox;
  private readonly transport: OutboxTransport;
  private readonly clock: IClock;
  private readonly fetchFn: typeof fetch;
  private readonly isOnlineFn: () => boolean;
  private readonly listeners = new Set<(count: number) => void>();
  private readonly windowTarget?: DexieOutboxAdapterOptions['windowTarget'];
  private readonly onlineHandler: () => void;
  private _isFlushing = false;
  private _isDisposed = false;

  constructor(options: DexieOutboxAdapterOptions) {
    this.db = options.db;
    this.catalogMedia = options.catalogMedia;
    this.transport = options.transport;
    this.clock = options.clock ?? createDefaultClock();
    this.fetchFn = options.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
    this.isOnlineFn =
      options.isOnline ??
      (() => (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true));
    this.windowTarget =
      options.windowTarget ?? (typeof window !== 'undefined' ? window : undefined);
    this.onlineHandler = () => {
      if (!this._isDisposed) {
        void this.flushPending();
      }
    };

    if (options.autoAttachOnlineListener !== false && this.windowTarget) {
      this.windowTarget.addEventListener('online', this.onlineHandler);
    }
  }

  dispose(): void {
    this._isDisposed = true;
    this.windowTarget?.removeEventListener('online', this.onlineHandler);
    this.listeners.clear();
  }

  private emitPendingCount(): void {
    if (this.listeners.size === 0) return;
    void this.db.syncOutbox
      .count()
      .then((count) => {
        for (const listener of this.listeners) {
          listener(count);
        }
      })
      .catch(() => {
        // Ignore if db closed during teardown.
      });
  }

  observePendingCount(listener: (count: number) => void): () => void {
    this.listeners.add(listener);
    void this.db.syncOutbox
      .count()
      .then((count) => {
        if (this.listeners.has(listener)) {
          listener(count);
        }
      })
      .catch(() => {});

    return () => {
      this.listeners.delete(listener);
    };
  }

  async enqueue(mutation: OutboxMutationInput): Promise<Result<SyncOutboxItem, StorageError>> {
    try {
      const saved = await this.db.transaction('rw', this.db.syncOutbox, async () => {
        const existing = await this.db.syncOutbox
          .where('idempotencyKey')
          .equals(mutation.idempotencyKey)
          .first();
        if (existing) {
          return existing;
        }

        const now = this.clock.nowMs();
        const item: SyncOutboxItem = {
          idempotencyKey: mutation.idempotencyKey,
          actionType: mutation.actionType,
          entityKind: mutation.entityKind,
          payloadJson: mutation.payloadJson,
          retryCount: 0,
          nextRetryAtMs: mutation.nextRetryAtMs ?? now,
          createdAtMs: now,
          updatedAtMs: now,
        };
        const seq = await this.db.syncOutbox.add(item);
        return { ...item, seq };
      });

      this.emitPendingCount();
      return ok(saved);
    } catch (cause) {
      return err(toStorageError('Failed to enqueue outbox mutation', cause));
    }
  }

  async flushPending(): Promise<Result<SyncFlushReport, SyncOutboxError>> {
    if (this._isFlushing) {
      return ok({
        processedCount: 0,
        succeededCount: 0,
        failedRetryableCount: 0,
        stoppedReason: 'already_flushing',
      });
    }

    if (!this.isOnlineFn()) {
      return ok({
        processedCount: 0,
        succeededCount: 0,
        failedRetryableCount: 0,
        stoppedReason: 'offline',
      });
    }

    this._isFlushing = true;
    let processedCount = 0;
    let succeededCount = 0;
    let failedRetryableCount = 0;
    let stoppedReason: SyncFlushReport['stoppedReason'];

    try {
      const now = this.clock.nowMs();
      await this.purgeExpiredAudio(now);

      const orderedItems = await this.db.syncOutbox.orderBy('seq').toArray();
      const readyItems = orderedItems.filter((item) => item.nextRetryAtMs <= now);

      for (const item of readyItems) {
        if (this._isDisposed) break;
        if (!this.isOnlineFn()) {
          stoppedReason = 'offline';
          break;
        }
        if (item.seq === undefined) continue;

        let payload: Record<string, unknown>;
        try {
          const parsed: unknown = JSON.parse(item.payloadJson);
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error('Outbox payloadJson must be a JSON object');
          }
          payload = parsed as Record<string, unknown>;
        } catch {
          await this.db.syncOutbox.delete(item.seq);
          processedCount++;
          failedRetryableCount++;
          continue;
        }

        processedCount++;
        const outcome = await this.dispatchItem(item, payload);
        if (outcome.status === 'succeeded') {
          succeededCount++;
        } else if (outcome.status === 'retry_scheduled') {
          failedRetryableCount++;
          break;
        } else if (outcome.status === 'terminal') {
          failedRetryableCount++;
          if (outcome.stoppedReason) {
            stoppedReason = outcome.stoppedReason;
            break;
          }
        }
      }

      return ok({
        processedCount,
        succeededCount,
        failedRetryableCount,
        ...(stoppedReason ? { stoppedReason } : {}),
      });
    } catch (cause) {
      return err(toStorageError('Failed to flush sync outbox', cause));
    } finally {
      this._isFlushing = false;
      this.emitPendingCount();
    }
  }

  private async markAttemptStatus(
    attemptId: string | undefined,
    updates: {
      readonly status: AttemptStatus;
      readonly syncStatus: 'synced' | 'pending' | 'failed';
      readonly remoteJobId?: string | null;
      readonly errorCode?: string | null;
    },
  ): Promise<void> {
    if (!attemptId) return;
    await this.db.completedAttempts.update(attemptId, {
      status: updates.status,
      syncStatus: updates.syncStatus,
      ...(updates.remoteJobId !== undefined ? { remoteJobId: updates.remoteJobId } : {}),
      ...(updates.errorCode !== undefined ? { errorCode: updates.errorCode } : {}),
      updatedAtMs: this.clock.nowMs(),
    });
  }

  private async handleFailure(
    item: SyncOutboxItem,
    attemptId: string | undefined,
    error: SyncOutboxError,
  ): Promise<{
    readonly status: 'terminal' | 'retry_scheduled';
    readonly stoppedReason?: SyncFlushReport['stoppedReason'];
  }> {
    if (item.seq === undefined) {
      return { status: 'terminal' };
    }

    const terminalKind = isTerminalOutboxErrorKind(error.kind);
    if (terminalKind || item.retryCount >= MAX_OUTBOX_RETRY_COUNT) {
      await this.markAttemptStatus(attemptId, {
        status: 'failed_retryable',
        syncStatus: 'failed',
        errorCode: error.message,
      });
      await this.db.syncOutbox.delete(item.seq);
      return {
        status: 'terminal',
        ...(terminalKind ? { stoppedReason: error.kind } : {}),
      };
    }

    const now = this.clock.nowMs();
    const backoffMs = computeOutboxBackoffMs(item.retryCount);
    await this.db.syncOutbox.update(item.seq, {
      retryCount: item.retryCount + 1,
      nextRetryAtMs: now + backoffMs,
      updatedAtMs: now,
    });
    return { status: 'retry_scheduled' };
  }

  private async dispatchItem(
    item: SyncOutboxItem,
    payload: Record<string, unknown>,
  ): Promise<{
    readonly status: 'succeeded' | 'terminal' | 'retry_scheduled';
    readonly stoppedReason?: SyncFlushReport['stoppedReason'];
  }> {
    const seq = item.seq!;
    const attemptId = typeof payload['attemptId'] === 'string' ? payload['attemptId'] : undefined;

    switch (item.actionType) {
      case 'evaluate_writing': {
        const res = await this.transport.enqueueWritingEvaluation(payload);
        if (res.ok) {
          await this.markAttemptStatus(attemptId, {
            status: 'queued_remote',
            syncStatus: 'synced',
            remoteJobId: res.value.jobId,
            errorCode: null,
          });
          await this.db.syncOutbox.delete(seq);
          return { status: 'succeeded' };
        }
        return this.handleFailure(item, attemptId, res.error);
      }

      case 'evaluate_speaking': {
        return this.dispatchSpeakingEvaluation(item, payload, attemptId);
      }

      case 'flag_question': {
        const res = await this.transport.flagQuestion(payload);
        if (res.ok) {
          await this.db.syncOutbox.delete(seq);
          return { status: 'succeeded' };
        }
        return this.handleFailure(item, undefined, res.error);
      }

      case 'sync_log': {
        const res = this.transport.syncVocabLogs
          ? await this.transport.syncVocabLogs(payload)
          : ok(undefined);
        if (res.ok) {
          const logIds = Array.isArray(payload['logIds'])
            ? payload['logIds'].filter((v): v is string => typeof v === 'string')
            : [];
          if (logIds.length > 0) {
            await this.db.vocabReviewLogs
              .where('logId')
              .anyOf(logIds)
              .modify({ syncStatus: 'synced' });
          }
          await this.db.syncOutbox.delete(seq);
          return { status: 'succeeded' };
        }
        return this.handleFailure(item, undefined, res.error);
      }
    }
  }

  private async dispatchSpeakingEvaluation(
    item: SyncOutboxItem,
    payload: Record<string, unknown>,
    attemptId: string | undefined,
  ): Promise<{
    readonly status: 'succeeded' | 'terminal' | 'retry_scheduled';
    readonly stoppedReason?: SyncFlushReport['stoppedReason'];
  }> {
    const seq = item.seq!;
    const rawTurns = Array.isArray(payload['turns']) ? payload['turns'] : [];
    const turns: SpeakingTurnOutboxEntry[] = rawTurns
      .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
      .map((t) => ({ ...(t as SpeakingTurnOutboxEntry) }));

    if (turns.length === 0) {
      await this.markAttemptStatus(attemptId, {
        status: 'failed_retryable',
        syncStatus: 'failed',
        errorCode: 'NO_CLIPS_ATTACHED',
      });
      await this.db.syncOutbox.delete(seq);
      return { status: 'terminal' };
    }

    await this.markAttemptStatus(attemptId, {
      status: 'uploading_audio',
      syncStatus: 'pending',
    });

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      if (!turn) continue;

      if (typeof turn.objectKey === 'string' && turn.objectKey.length > 0) {
        continue;
      }

      const mediaKey = turn.mediaKey ?? turn.clipId ?? turn.recordingId ?? turn.localFilePath ?? '';
      if (!mediaKey) {
        await this.markAttemptStatus(attemptId, {
          status: 'failed_retryable',
          syncStatus: 'failed',
          errorCode: 'AUDIO_UNAVAILABLE',
        });
        await this.db.syncOutbox.delete(seq);
        return { status: 'terminal' };
      }

      const audioRes = await this.catalogMedia.readUserRecordingBytes(mediaKey);
      if (!audioRes.ok || audioRes.value.bytes.byteLength === 0) {
        await this.markAttemptStatus(attemptId, {
          status: 'failed_retryable',
          syncStatus: 'failed',
          errorCode: 'AUDIO_UNAVAILABLE',
        });
        await this.db.syncOutbox.delete(seq);
        return { status: 'terminal' };
      }

      const strippedMime = stripAudioMimeCodecs(turn.contentType ?? audioRes.value.mimeType);
      const partIndex = typeof turn.partIndex === 'number' ? turn.partIndex : i + 1;
      const turnId = turn.turnId ?? turn.promptId ?? `t${i}`;

      const presignRes = await this.transport.presignAudioUpload({
        attemptId: attemptId ?? '',
        partIndex,
        turnId,
        byteLength: audioRes.value.bytes.byteLength,
        contentType: strippedMime,
      });

      if (!presignRes.ok) {
        await this.persistOutboxCheckpoint(seq, payload, turns);
        return this.handleFailure(item, attemptId, presignRes.error);
      }

      const uploadRes = this.transport.uploadAudioToPresignedUrl
        ? await this.transport.uploadAudioToPresignedUrl({
            uploadUrl: presignRes.value.uploadUrl,
            bytes: audioRes.value.bytes,
            contentType: strippedMime,
          })
        : await putBytesToPresignedUrl(
            {
              uploadUrl: presignRes.value.uploadUrl,
              bytes: audioRes.value.bytes,
              contentType: strippedMime,
            },
            this.fetchFn,
          );

      if (!uploadRes.ok) {
        await this.persistOutboxCheckpoint(seq, payload, turns);
        return this.handleFailure(item, attemptId, uploadRes.error);
      }

      turn.objectKey = presignRes.value.objectKey;
      await this.catalogMedia.updateRecordingRemoteKey(mediaKey, presignRes.value.objectKey);
      await this.persistOutboxCheckpoint(seq, payload, turns);
    }

    // Never call enqueueSpeakingEvaluation unless every single turn has a valid objectKey (TD-19).
    const allUploaded = turns.every(
      (t) => typeof t.objectKey === 'string' && t.objectKey.length > 0,
    );
    if (!allUploaded) {
      return this.handleFailure(item, attemptId, {
        kind: 'unexpected',
        message: 'Incomplete speaking turn uploads',
      });
    }

    const firstTurn = turns[0];
    const enqueueRes = await this.transport.enqueueSpeakingEvaluation({
      ...payload,
      turns,
      audioObjectKey: firstTurn?.objectKey,
      partIndex: firstTurn?.partIndex ?? 1,
    });

    if (enqueueRes.ok) {
      await this.markAttemptStatus(attemptId, {
        status: 'queued_remote',
        syncStatus: 'synced',
        remoteJobId: enqueueRes.value.jobId,
        errorCode: null,
      });
      await this.db.syncOutbox.delete(seq);
      return { status: 'succeeded' };
    }

    return this.handleFailure(item, attemptId, enqueueRes.error);
  }

  private async persistOutboxCheckpoint(
    seq: number,
    payload: Record<string, unknown>,
    turns: readonly SpeakingTurnOutboxEntry[],
  ): Promise<void> {
    await this.db.syncOutbox.update(seq, {
      payloadJson: JSON.stringify({ ...payload, turns }),
      updatedAtMs: this.clock.nowMs(),
    });
  }

  /**
   * Purges `user_recording` entries older than 30 days (deleting BOTH `mediaCacheIndex` row
   * AND underlying OPFS/Cache/IDB binary blob), protecting recordings whose parent attempt is
   * in `['in_progress', 'submitted_local', 'uploading_audio', 'queued_remote', 'failed_retryable']`
   * or referenced by a pending `syncOutbox` item payload (`attemptId`), while garbage-collecting
   * expired orphaned recordings (`attemptId` null/empty or missing from attempts, drafts, and outbox).
   */
  async purgeExpiredAudio(nowMs?: number): Promise<Result<number, StorageError>> {
    try {
      const now = nowMs ?? this.clock.nowMs();
      const cutoffMs = now - THIRTY_DAYS_MS;

      const candidates = await this.db.mediaCacheIndex
        .where('kind')
        .equals('user_recording')
        .and((rec) => rec.createdAtMs <= cutoffMs)
        .toArray();

      if (candidates.length === 0) {
        return ok(0);
      }

      const attemptIds = Array.from(
        new Set(
          candidates
            .map((rec) => rec.attemptId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      );

      const [parentAttempts, activeDrafts, pendingOutboxItems] = await Promise.all([
        attemptIds.length > 0 ? this.db.completedAttempts.bulkGet(attemptIds) : Promise.resolve([]),
        attemptIds.length > 0
          ? this.db.attemptDrafts.where('attemptId').anyOf(attemptIds).toArray()
          : Promise.resolve([]),
        this.db.syncOutbox.toArray(),
      ]);

      const pendingOutboxAttemptIds = new Set<string>();
      for (const item of pendingOutboxItems) {
        try {
          const parsed: unknown = JSON.parse(item.payloadJson);
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            const payloadAttemptId = (parsed as Record<string, unknown>)['attemptId'];
            if (typeof payloadAttemptId === 'string' && payloadAttemptId.length > 0) {
              pendingOutboxAttemptIds.add(payloadAttemptId);
            }
          }
        } catch {
          // Ignore malformed outbox payloadJson.
        }
      }

      const statusByAttemptId = new Map<string, AttemptStatus>();
      for (const attempt of parentAttempts) {
        if (attempt) {
          statusByAttemptId.set(attempt.attemptId, attempt.status);
        }
      }
      for (const draft of activeDrafts) {
        if (!statusByAttemptId.has(draft.attemptId)) {
          statusByAttemptId.set(draft.attemptId, 'in_progress');
        }
      }

      let removedCount = 0;
      for (const rec of candidates) {
        if (rec.attemptId && rec.attemptId.length > 0) {
          const parentStatus = statusByAttemptId.get(rec.attemptId);
          if (parentStatus !== undefined) {
            if (PROTECTED_AUDIO_ATTEMPT_STATUSES.has(parentStatus)) {
              continue;
            }
          } else if (pendingOutboxAttemptIds.has(rec.attemptId)) {
            continue;
          }
        }
        await this.catalogMedia.deleteMediaBinary(rec.mediaKey);
        await this.db.mediaCacheIndex.delete(rec.mediaKey);
        removedCount++;
      }

      return ok(removedCount);
    } catch (cause) {
      return err(toStorageError('Failed to purge expired audio recordings', cause));
    }
  }
}

import 'fake-indexeddb/auto';
import { serialDayFromUtcMs } from '@mockza/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DexieOutboxAdapter,
  type OutboxTransport,
  computeOutboxBackoffMs,
} from '@/adapters/dexie/dexie-outbox.adapter';
import { MockzaDexieDb } from '@/adapters/dexie/mockza-db';
import { OpfsCatalogAdapter, THIRTY_DAYS_MS } from '@/adapters/media/opfs-catalog.adapter';
import { err, ok } from '@/gateways/result';
import type { AttemptStatus, CompletedAttemptRecord } from '@/gateways/storage.gateway';
import type { IClock } from '@/gateways/telemetry.gateway';

function createFakeClock(initialMs: number): {
  clock: IClock;
  advanceMs: (deltaMs: number) => void;
  setNowMs: (ms: number) => void;
} {
  let now = initialMs;
  return {
    clock: {
      nowMs: () => now,
      nowIso: () => new Date(now).toISOString(),
      todaySerialDay: () => serialDayFromUtcMs(now),
    },
    advanceMs: (deltaMs: number) => {
      now += deltaMs;
    },
    setNowMs: (ms: number) => {
      now = ms;
    },
  };
}

function makeAttemptRecord(
  attemptId: string,
  status: AttemptStatus,
  now: number,
): CompletedAttemptRecord {
  return {
    attemptId,
    examId: 'ielts_academic',
    packId: 'pack-spk-1',
    skill: 'speaking',
    status,
    syncStatus: status === 'completed' ? 'synced' : 'pending',
    remoteJobId: null,
    submissionJson: '{}',
    evaluationJson: null,
    overallBand: null,
    errorCode: null,
    startedAtUtcMs: now - 10_000,
    completedAtMs: now,
    durationSeconds: 10,
    usedStudyMode: false,
    questionCount: 0,
    isCalibratedFullPack: true,
    contentVersion: '1.0.0',
    mockSessionId: null,
    mockStageKey: null,
    updatedAtMs: now,
  };
}

describe('W1.3 DexieOutboxAdapter (FIFO, backoff, terminal stop, speaking TD-19 & 30-day GC)', () => {
  let db: MockzaDexieDb;
  let catalog: OpfsCatalogAdapter;
  let fakeClock: ReturnType<typeof createFakeClock>;
  let dbCounter = 0;

  beforeEach(async () => {
    dbCounter++;
    fakeClock = createFakeClock(Date.UTC(2026, 10, 18, 12, 0, 0));
    db = new MockzaDexieDb(`mockza-test-outbox-${Date.now()}-${dbCounter}`);
    await db.open();
    catalog = new OpfsCatalogAdapter({
      db,
      edition: 'glb',
      clock: fakeClock.clock,
      binaryStoreOptions: {
        disableOpfs: true,
        disableCacheStorage: true,
        idbDbName: `mockza-test-media-outbox-${Date.now()}-${dbCounter}`,
      },
    });
  });

  afterEach(async () => {
    await db.delete();
  });

  function createBaseTransport(overrides?: Partial<OutboxTransport>): OutboxTransport {
    return {
      enqueueWritingEvaluation: vi.fn(async () => ok({ jobId: 'job-w-1' })),
      presignAudioUpload: vi.fn(async ({ partIndex }) =>
        ok({
          uploadUrl: `https://s3.mockza.local/upload/part-${partIndex}`,
          objectKey: `audio/att/part-${partIndex}.m4a`,
        }),
      ),
      enqueueSpeakingEvaluation: vi.fn(async () => ok({ jobId: 'job-s-1' })),
      flagQuestion: vi.fn(async () => ok(undefined)),
      syncVocabLogs: vi.fn(async () => ok(undefined)),
      ...overrides,
    };
  }

  it('drains FIFO by seq, deduplicates idempotencyKey, enforces single-flight & handles online event', async () => {
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const transport = createBaseTransport({
      flagQuestion: vi.fn(async (payload) => {
        const qId = String(payload['questionId']);
        if (qId === 'q1') {
          await firstGate;
        }
        order.push(qId);
        return ok(undefined);
      }),
    });

    const onlineListeners = new Set<EventListener>();
    const mockWin = {
      addEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
        if (type === 'online') onlineListeners.add(fn as EventListener);
      },
      removeEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
        if (type === 'online') onlineListeners.delete(fn as EventListener);
      },
    };

    const outbox = new DexieOutboxAdapter({
      db,
      catalogMedia: catalog,
      transport,
      clock: fakeClock.clock,
      isOnline: () => true,
      windowTarget: mockWin,
    });

    const observedCounts: number[] = [];
    const unsubscribe = outbox.observePendingCount((c) => observedCounts.push(c));

    await outbox.enqueue({
      idempotencyKey: 'flag-1',
      actionType: 'flag_question',
      entityKind: 'flag',
      payloadJson: JSON.stringify({ packId: 'p1', questionId: 'q1', reason: 'typo' }),
    });
    // Duplicate idempotency key must not create a second item
    await outbox.enqueue({
      idempotencyKey: 'flag-1',
      actionType: 'flag_question',
      entityKind: 'flag',
      payloadJson: JSON.stringify({ packId: 'p1', questionId: 'q1', reason: 'typo' }),
    });
    await outbox.enqueue({
      idempotencyKey: 'flag-2',
      actionType: 'flag_question',
      entityKind: 'flag',
      payloadJson: JSON.stringify({ packId: 'p1', questionId: 'q2', reason: 'unclear' }),
    });

    expect(await db.syncOutbox.count()).toBe(2);

    // Trigger first flush (blocked on q1), then trigger concurrent flush -> already_flushing
    const flush1Promise = outbox.flushPending();
    await new Promise((r) => setTimeout(r, 10));
    const flush2 = await outbox.flushPending();
    expect(flush2.ok).toBe(true);
    if (flush2.ok) {
      expect(flush2.value.stoppedReason).toBe('already_flushing');
    }

    releaseFirst();
    const flush1 = await flush1Promise;
    expect(flush1.ok).toBe(true);
    if (flush1.ok) {
      expect(flush1.value.processedCount).toBe(2);
      expect(flush1.value.succeededCount).toBe(2);
    }
    expect(order).toEqual(['q1', 'q2']);
    expect(await db.syncOutbox.count()).toBe(0);

    // Enqueue another item and fire 'online' event on window
    await outbox.enqueue({
      idempotencyKey: 'flag-3',
      actionType: 'flag_question',
      entityKind: 'flag',
      payloadJson: JSON.stringify({ packId: 'p1', questionId: 'q3', reason: 'audio' }),
    });
    for (const fn of onlineListeners) {
      fn(new Event('online'));
    }
    await new Promise((r) => setTimeout(r, 30));
    expect(order).toEqual(['q1', 'q2', 'q3']);
    expect(observedCounts.length).toBeGreaterThan(0);

    unsubscribe();
    outbox.dispose();
  });

  it('applies exponential backoff Math.min(15m, 2000 * 2**retryCount) and marks failed_retryable at retryCount >= 6', async () => {
    expect(computeOutboxBackoffMs(0)).toBe(2_000);
    expect(computeOutboxBackoffMs(1)).toBe(4_000);
    expect(computeOutboxBackoffMs(2)).toBe(8_000);
    expect(computeOutboxBackoffMs(10)).toBe(15 * 60_000);

    const now = fakeClock.clock.nowMs();
    await db.completedAttempts.put(makeAttemptRecord('att-w-1', 'submitted_local', now));

    const transport = createBaseTransport({
      enqueueWritingEvaluation: vi.fn(async () =>
        err({ kind: 'network' as const, message: '503 Service Unavailable', retryable: true, status: 503 }),
      ),
    });

    const outbox = new DexieOutboxAdapter({
      db,
      catalogMedia: catalog,
      transport,
      clock: fakeClock.clock,
      autoAttachOnlineListener: false,
    });

    await outbox.enqueue({
      idempotencyKey: 'eval-w-1',
      actionType: 'evaluate_writing',
      entityKind: 'attempt',
      payloadJson: JSON.stringify({ attemptId: 'att-w-1', packId: 'p1', essayText: 'x'.repeat(50) }),
    });

    // Retries 0..5 -> schedules exponential backoff
    for (let retry = 0; retry < 6; retry++) {
      const res = await outbox.flushPending();
      expect(res.ok).toBe(true);
      const row = await db.syncOutbox.where('idempotencyKey').equals('eval-w-1').first();
      expect(row?.retryCount).toBe(retry + 1);
      const expectedBackoff = Math.min(15 * 60_000, 2000 * 2 ** retry);
      expect(row?.nextRetryAtMs).toBe(fakeClock.clock.nowMs() + expectedBackoff);
      fakeClock.advanceMs(expectedBackoff);
    }

    // At retryCount === 6, next failure hits terminal stop & marks attempt failed_retryable
    const finalRes = await outbox.flushPending();
    expect(finalRes.ok).toBe(true);
    if (finalRes.ok) {
      expect(finalRes.value.failedRetryableCount).toBe(1);
    }
    expect(await db.syncOutbox.count()).toBe(0);
    const attempt = await db.completedAttempts.get('att-w-1');
    expect(attempt?.status).toBe('failed_retryable');
    expect(attempt?.syncStatus).toBe('failed');
  });

  it.each([
    'quota_exceeded',
    'entitlement_required',
    'unauthorized',
    'validation',
  ] as const)('stops queue and marks attempt failed_retryable on %s terminal error', async (kind) => {
    const now = fakeClock.clock.nowMs();
    await db.completedAttempts.put(makeAttemptRecord('att-term-1', 'submitted_local', now));
    await db.completedAttempts.put(makeAttemptRecord('att-term-2', 'submitted_local', now));

    const terminalErr =
      kind === 'quota_exceeded'
        ? { kind: 'quota_exceeded' as const, message: 'Quota reached' }
        : kind === 'entitlement_required'
          ? { kind: 'entitlement_required' as const, message: 'Pro needed', feature: 'writing' }
          : kind === 'unauthorized'
            ? { kind: 'unauthorized' as const, message: 'Revoked', reasonCode: 'SESSION_REVOKED' as const }
            : { kind: 'validation' as const, message: 'Invalid essay' };

    const enqueueWritingEvaluation = vi.fn(async () => err(terminalErr));
    const outbox = new DexieOutboxAdapter({
      db,
      catalogMedia: catalog,
      transport: createBaseTransport({ enqueueWritingEvaluation }),
      clock: fakeClock.clock,
      autoAttachOnlineListener: false,
    });

    await outbox.enqueue({
      idempotencyKey: 'term-1',
      actionType: 'evaluate_writing',
      entityKind: 'attempt',
      payloadJson: JSON.stringify({ attemptId: 'att-term-1', packId: 'p1' }),
    });
    await outbox.enqueue({
      idempotencyKey: 'term-2',
      actionType: 'evaluate_writing',
      entityKind: 'attempt',
      payloadJson: JSON.stringify({ attemptId: 'att-term-2', packId: 'p1' }),
    });

    const flushRes = await outbox.flushPending();
    expect(flushRes.ok).toBe(true);
    if (flushRes.ok) {
      expect(flushRes.value.stoppedReason).toBe(kind);
      expect(flushRes.value.processedCount).toBe(1);
      expect(flushRes.value.failedRetryableCount).toBe(1);
    }

    // Stopped immediately on item 1; item 2 remains untouched in outbox
    expect(enqueueWritingEvaluation).toHaveBeenCalledTimes(1);
    expect((await db.completedAttempts.get('att-term-1'))?.status).toBe('failed_retryable');
    expect((await db.completedAttempts.get('att-term-2'))?.status).toBe('submitted_local');
    expect(await db.syncOutbox.count()).toBe(1);
  });

  it('checkpoints speaking turns per-turn, strips codecs & auth headers on S3 PUT, and never submits partial turns (TD-19)', async () => {
    const now = fakeClock.clock.nowMs();
    const attemptId = 'att-spk-td19';
    await db.completedAttempts.put(makeAttemptRecord(attemptId, 'submitted_local', now));

    // Store two recorded audio clips via OpfsCatalogAdapter
    const blob1 = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/mp4;codecs=mp4a.40.2' });
    const blob2 = new Blob([new Uint8Array([5, 6, 7, 8])], { type: 'audio/webm;codecs=opus' });

    await catalog.putUserRecording({
      clipId: 'clip-turn-1',
      blob: blob1,
      attemptId,
      partIndex: 1,
      durationMs: 4000,
      mimeType: 'audio/mp4;codecs=mp4a.40.2',
    });
    await catalog.putUserRecording({
      clipId: 'clip-turn-2',
      blob: blob2,
      attemptId,
      partIndex: 2,
      durationMs: 6000,
      mimeType: 'audio/webm;codecs=opus',
    });

    const s3PutCalls: Array<{
      url: string;
      headers: Record<string, string>;
    }> = [];
    let failTurn2Upload = true;

    const mockFetch: typeof fetch = vi.fn(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const rawHeaders = (init?.headers ?? {}) as Record<string, string>;
      s3PutCalls.push({ url, headers: rawHeaders });
      if (url.includes('part-2') && failTurn2Upload) {
        return new Response('Temporary S3 error', { status: 503 });
      }
      return new Response(null, { status: 200 });
    });

    const enqueueSpeakingEvaluation = vi.fn(async () => ok({ jobId: 'job-spk-99' }));
    const presignAudioUpload = vi.fn(async ({ partIndex }) =>
      ok({
        uploadUrl: `https://s3.mockza.local/presigned/part-${partIndex}`,
        objectKey: `uploads/${attemptId}/part-${partIndex}.m4a`,
      }),
    );

    const outbox = new DexieOutboxAdapter({
      db,
      catalogMedia: catalog,
      transport: createBaseTransport({
        presignAudioUpload,
        enqueueSpeakingEvaluation,
      }),
      fetchFn: mockFetch,
      clock: fakeClock.clock,
      autoAttachOnlineListener: false,
    });

    await outbox.enqueue({
      idempotencyKey: 'spk-1',
      actionType: 'evaluate_speaking',
      entityKind: 'attempt',
      payloadJson: JSON.stringify({
        attemptId,
        packId: 'pack-spk-1',
        examId: 'ielts_academic',
        partSequence: 'full',
        turns: [
          {
            partIndex: 1,
            turnId: 't1',
            promptText: 'Describe your hometown.',
            mediaKey: 'clip-turn-1',
            durationMs: 4000,
            contentType: 'audio/mp4;codecs=mp4a.40.2',
          },
          {
            partIndex: 2,
            turnId: 't2',
            promptText: 'Describe a memorable journey.',
            mediaKey: 'clip-turn-2',
            durationMs: 6000,
            contentType: 'audio/webm;codecs=opus',
          },
        ],
      }),
    });

    // Pass 1: Turn 1 succeeds, Turn 2 fails on S3 PUT
    const pass1 = await outbox.flushPending();
    expect(pass1.ok).toBe(true);
    // CRITICAL TD-19: enqueueSpeakingEvaluation MUST NOT be called when Turn 2 failed!
    expect(enqueueSpeakingEvaluation).not.toHaveBeenCalled();

    // Verify S3 PUT stripped ;codecs=... AND had zero Authorization / x-mockza-edition headers
    expect(s3PutCalls[0]?.headers).toEqual({ 'Content-Type': 'audio/mp4' });
    expect(s3PutCalls[0]?.headers['Authorization']).toBeUndefined();
    expect(s3PutCalls[0]?.headers['x-mockza-edition']).toBeUndefined();
    expect(s3PutCalls[1]?.headers).toEqual({ 'Content-Type': 'audio/webm' });

    // Verify Turn 1 was checkpointed in BOTH mediaCacheIndex AND syncOutbox.payloadJson
    const rec1 = await db.mediaCacheIndex.get('clip-turn-1');
    const rec2 = await db.mediaCacheIndex.get('clip-turn-2');
    expect(rec1?.remoteObjectKey).toBe(`uploads/${attemptId}/part-1.m4a`);
    expect(rec2?.remoteObjectKey).toBeNull();

    const outboxRow = await db.syncOutbox.where('idempotencyKey').equals('spk-1').first();
    expect(outboxRow).toBeDefined();
    const checkpointPayload = JSON.parse(outboxRow!.payloadJson) as {
      turns: Array<{ objectKey?: string }>;
    };
    expect(checkpointPayload.turns[0]?.objectKey).toBe(`uploads/${attemptId}/part-1.m4a`);
    expect(checkpointPayload.turns[1]?.objectKey).toBeUndefined();

    // Pass 2: Advance past backoff, heal S3 for Turn 2 -> Turn 1 is NOT re-uploaded, Turn 2 uploads, evaluation enqueues!
    failTurn2Upload = false;
    fakeClock.advanceMs(3_000);
    presignAudioUpload.mockClear();
    s3PutCalls.length = 0;

    const pass2 = await outbox.flushPending();
    expect(pass2.ok).toBe(true);
    if (pass2.ok) {
      expect(pass2.value.succeededCount).toBe(1);
    }

    // Only Turn 2 was presigned & uploaded on pass 2!
    expect(presignAudioUpload).toHaveBeenCalledTimes(1);
    expect(presignAudioUpload).toHaveBeenCalledWith(
      expect.objectContaining({ partIndex: 2, contentType: 'audio/webm' }),
    );
    expect(s3PutCalls).toHaveLength(1);
    expect(enqueueSpeakingEvaluation).toHaveBeenCalledTimes(1);

    const completedAttempt = await db.completedAttempts.get(attemptId);
    expect(completedAttempt?.status).toBe('queued_remote');
    expect(completedAttempt?.remoteJobId).toBe('job-spk-99');
    expect(await db.syncOutbox.count()).toBe(0);
  });

  it('purgeExpiredAudio deletes BOTH index row and binary blob after 30 days only for non-protected attempt statuses', async () => {
    const startMs = fakeClock.clock.nowMs();

    const protectedStatuses: AttemptStatus[] = [
      'in_progress',
      'submitted_local',
      'uploading_audio',
      'queued_remote',
      'failed_retryable',
    ];

    for (const status of protectedStatuses) {
      const attemptId = `att-${status}`;
      await db.completedAttempts.put(makeAttemptRecord(attemptId, status, startMs));
      await catalog.putUserRecording({
        clipId: `clip-${status}`,
        blob: new Blob([new Uint8Array([9, 9, 9])], { type: 'audio/mp4' }),
        attemptId,
        partIndex: 1,
        durationMs: 2000,
      });
    }

    // Completed attempt old (>= 30 days) -> SHOULD BE PURGED
    await db.completedAttempts.put(makeAttemptRecord('att-completed-old', 'completed', startMs));
    await catalog.putUserRecording({
      clipId: 'clip-completed-old',
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mp4' }),
      attemptId: 'att-completed-old',
      partIndex: 1,
      durationMs: 2000,
    });

    // Advance 29 days: nothing purged
    fakeClock.setNowMs(startMs + 29 * 86_400_000);
    const outbox = new DexieOutboxAdapter({
      db,
      catalogMedia: catalog,
      transport: createBaseTransport(),
      clock: fakeClock.clock,
      autoAttachOnlineListener: false,
    });

    const purge29 = await outbox.purgeExpiredAudio();
    expect(purge29.ok && purge29.value).toBe(0);

    // Completed attempt created at day 29 (only 1 day old when checked at day 30) -> NOT purged
    await db.completedAttempts.put(
      makeAttemptRecord('att-completed-recent', 'completed', fakeClock.clock.nowMs()),
    );
    await catalog.putUserRecording({
      clipId: 'clip-completed-recent',
      blob: new Blob([new Uint8Array([4, 5, 6])], { type: 'audio/mp4' }),
      attemptId: 'att-completed-recent',
      partIndex: 1,
      durationMs: 2000,
    });

    // Advance to day 30 + 1 second from startMs
    fakeClock.setNowMs(startMs + THIRTY_DAYS_MS + 1000);
    const purge30 = await outbox.purgeExpiredAudio();
    expect(purge30.ok).toBe(true);
    if (purge30.ok) {
      expect(purge30.value).toBe(1);
    }

    // BOTH mediaCacheIndex row AND underlying binary blob for 'clip-completed-old' are gone
    expect(await db.mediaCacheIndex.get('clip-completed-old')).toBeUndefined();
    const readOld = await catalog.readUserRecordingBytes('clip-completed-old');
    expect(readOld.ok).toBe(false);
    if (!readOld.ok) {
      expect(readOld.error.code).toBe('NOT_FOUND');
    }

    // Recent completed attempt recording is preserved
    expect(await db.mediaCacheIndex.get('clip-completed-recent')).toBeDefined();
    expect((await catalog.readUserRecordingBytes('clip-completed-recent')).ok).toBe(true);

    // ALL 5 protected statuses are preserved (both index row and binary blob)
    for (const status of protectedStatuses) {
      expect(await db.mediaCacheIndex.get(`clip-${status}`)).toBeDefined();
      const readProtected = await catalog.readUserRecordingBytes(`clip-${status}`);
      expect(readProtected.ok, `Expected clip-${status} binary to remain protected`).toBe(true);
    }
  });

  it('purgeExpiredAudio garbage-collects >30d orphaned user_recordings while preserving outbox- and draft-referenced clips', async () => {
    const startMs = fakeClock.clock.nowMs();

    // 1. Orphan with attemptId: null -> SHOULD BE PURGED
    await catalog.putUserRecording({
      clipId: 'clip-orphan-null',
      blob: new Blob([new Uint8Array([1, 1, 1])], { type: 'audio/mp4' }),
      attemptId: 'temp-att-null',
      partIndex: 1,
      durationMs: 1500,
    });
    await db.mediaCacheIndex.update('clip-orphan-null', { attemptId: null });

    // 1b. Orphan with empty attemptId: '' -> SHOULD BE PURGED
    await catalog.putUserRecording({
      clipId: 'clip-orphan-empty',
      blob: new Blob([new Uint8Array([1, 2, 1])], { type: 'audio/mp4' }),
      attemptId: '',
      partIndex: 1,
      durationMs: 1500,
    });

    // 2. Orphan with non-empty attemptId missing from completedAttempts, attemptDrafts, and syncOutbox -> SHOULD BE PURGED
    await catalog.putUserRecording({
      clipId: 'clip-orphan-missing-parent',
      blob: new Blob([new Uint8Array([2, 2, 2])], { type: 'audio/mp4' }),
      attemptId: 'att-deleted-parent',
      partIndex: 1,
      durationMs: 1500,
    });

    // 3. Recording whose attemptId is missing from completedAttempts & attemptDrafts, BUT referenced in pending syncOutbox -> SURVIVES
    await catalog.putUserRecording({
      clipId: 'clip-outbox-ref',
      blob: new Blob([new Uint8Array([3, 3, 3])], { type: 'audio/mp4' }),
      attemptId: 'att-outbox-pending',
      partIndex: 1,
      durationMs: 1500,
    });

    // 4. Recording whose attemptId is present in attemptDrafts -> SURVIVES
    await db.attemptDrafts.put({
      packId: 'pack-spk-draft',
      skill: 'speaking',
      attemptId: 'att-draft-only',
      examId: 'ielts_academic',
      taskType: 'speakingTurn',
      draftText: '',
      wordCount: 0,
      answersJson: {},
      flaggedQuestionIds: [],
      currentQuestionIndex: 0,
      timerRemainingSec: 600,
      usedStudyMode: false,
      mockSessionId: null,
      mockStageKey: null,
      updatedAtMs: startMs,
    });
    await catalog.putUserRecording({
      clipId: 'clip-draft-ref',
      blob: new Blob([new Uint8Array([4, 4, 4])], { type: 'audio/mp4' }),
      attemptId: 'att-draft-only',
      partIndex: 1,
      durationMs: 1500,
    });

    const outbox = new DexieOutboxAdapter({
      db,
      catalogMedia: catalog,
      transport: createBaseTransport(),
      clock: fakeClock.clock,
      autoAttachOnlineListener: false,
    });

    await outbox.enqueue({
      idempotencyKey: 'outbox-spk-ref',
      actionType: 'evaluate_speaking',
      entityKind: 'attempt',
      payloadJson: JSON.stringify({
        attemptId: 'att-outbox-pending',
        turns: [{ partIndex: 1, mediaKey: 'clip-outbox-ref' }],
      }),
    });

    fakeClock.setNowMs(startMs + THIRTY_DAYS_MS + 1000);
    const purgeRes = await outbox.purgeExpiredAudio();
    expect(purgeRes.ok).toBe(true);
    if (purgeRes.ok) {
      expect(purgeRes.value).toBe(3);
    }

    // All orphaned recordings (index + binary) are purged
    for (const orphanKey of [
      'clip-orphan-null',
      'clip-orphan-empty',
      'clip-orphan-missing-parent',
    ]) {
      expect(await db.mediaCacheIndex.get(orphanKey)).toBeUndefined();
      const readRes = await catalog.readUserRecordingBytes(orphanKey);
      expect(readRes.ok).toBe(false);
    }

    // Outbox-referenced and draft-referenced recordings survive (index + binary)
    for (const keptKey of ['clip-outbox-ref', 'clip-draft-ref']) {
      expect(await db.mediaCacheIndex.get(keptKey)).toBeDefined();
      const readRes = await catalog.readUserRecordingBytes(keptKey);
      expect(readRes.ok).toBe(true);
    }
  });

  it('serializes concurrent enqueue calls with identical idempotencyKey into a single outbox row', async () => {
    const outbox = new DexieOutboxAdapter({
      db,
      catalogMedia: catalog,
      transport: createBaseTransport(),
      clock: fakeClock.clock,
      autoAttachOnlineListener: false,
    });

    const mutation = {
      idempotencyKey: 'concurrent-same-key',
      actionType: 'flag_question' as const,
      entityKind: 'flag' as const,
      payloadJson: JSON.stringify({ packId: 'p1', questionId: 'q99', reason: 'typo' }),
    };

    const [resA, resB] = await Promise.all([outbox.enqueue(mutation), outbox.enqueue(mutation)]);

    expect(resA.ok).toBe(true);
    expect(resB.ok).toBe(true);
    expect(await db.syncOutbox.count()).toBe(1);
    if (resA.ok && resB.ok) {
      expect(resA.value.seq).toBe(resB.value.seq);
      expect(resA.value.idempotencyKey).toBe('concurrent-same-key');
    }
  });
});

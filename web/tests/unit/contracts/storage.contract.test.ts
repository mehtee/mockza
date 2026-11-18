import 'fake-indexeddb/auto';
import { serialDayFromUtcMs } from '@mockza/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DexieOutboxAdapter, type OutboxTransport } from '@/adapters/dexie/dexie-outbox.adapter';
import { DexieStorageAdapter } from '@/adapters/dexie/dexie-storage.adapter';
import { MockzaDexieDb } from '@/adapters/dexie/mockza-db';
import { FakeCatalogAdapter } from '@/adapters/fakes/fake-catalog.adapter';
import { FakeClock } from '@/adapters/fakes/fake-clock';
import { FakeStorageAdapter } from '@/adapters/fakes/fake-storage.adapter';
import { OpfsCatalogAdapter, THIRTY_DAYS_MS } from '@/adapters/media/opfs-catalog.adapter';
import type { ICatalogMediaGateway } from '@/gateways/catalog.gateway';
import { err, ok } from '@/gateways/result';
import type {
  AttemptDraftRecord,
  CompletedAttemptRecord,
  IOfflineAttemptStore,
  ISyncOutboxGateway,
  IVocabSrsStore,
  VocabCardRecord,
} from '@/gateways/storage.gateway';

interface StorageContractHarness {
  readonly clock: FakeClock;
  readonly attemptStore: IOfflineAttemptStore;
  readonly vocabStore: IVocabSrsStore;
  readonly syncOutbox: ISyncOutboxGateway;
  readonly catalog: ICatalogMediaGateway;
  setOutboxTerminalFailureNext(): void;
  setNextWritingFailRetryable(fail: boolean): void;
  setNextSpeakingTurn2Fail(fail: boolean): void;
  dropNextUrgentDraftWrite(): void;
  getDispatchedKeys(): readonly string[];
  getSpeakingEnqueueCount(): number;
  cleanup(): Promise<void>;
}

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => Array.from(map.keys())[index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

function makeDraft(overrides: Partial<AttemptDraftRecord> = {}): AttemptDraftRecord {
  return {
    packId: 'pack-w-01',
    skill: 'writing',
    attemptId: 'att-w-01',
    examId: 'ielts_academic',
    taskType: 'task2Essay',
    draftText: 'Initial academic argument paragraph.',
    wordCount: 4,
    answersJson: {},
    flaggedQuestionIds: [],
    currentQuestionIndex: 0,
    timerRemainingSec: 2400,
    usedStudyMode: false,
    mockSessionId: null,
    mockStageKey: null,
    updatedAtMs: 1_000,
    ...overrides,
  };
}

function makeAttempt(overrides: Partial<CompletedAttemptRecord> = {}): CompletedAttemptRecord {
  return {
    attemptId: 'att-1',
    examId: 'ielts_academic',
    packId: 'pack-r-01',
    skill: 'reading',
    status: 'completed',
    syncStatus: 'synced',
    remoteJobId: null,
    submissionJson: '{"answers":{}}',
    evaluationJson: null,
    overallBand: 7.5,
    errorCode: null,
    startedAtUtcMs: 1_000,
    completedAtMs: 2_000,
    durationSeconds: 1800,
    usedStudyMode: false,
    questionCount: 40,
    isCalibratedFullPack: true,
    contentVersion: 'v1',
    mockSessionId: null,
    mockStageKey: null,
    updatedAtMs: 2_000,
    ...overrides,
  };
}

function makeVocabCard(cardId: string, headword: string): VocabCardRecord {
  return {
    cardId,
    examId: 'ielts_academic',
    headword,
    ipa: '/test/',
    definition: `Definition of ${headword}`,
    glossFa: null,
    topicTag: 'environment',
    sourceKind: 'seeded',
    tags: ['academic'],
    contextSentence: `Example with ${headword}.`,
    paraphraseHints: ['synonym'],
    usageNote: null,
    sourceSkill: null,
    sourceAttemptId: null,
    sourceRefLabel: null,
    createdAtMs: 1_000,
    updatedAtMs: 1_000,
  };
}

function runStorageContractSuite(name: string, createHarness: () => Promise<StorageContractHarness>) {
  describe(`IOfflineAttemptStore / IVocabSrsStore / ISyncOutboxGateway LSP contract: ${name}`, () => {
    let harness: StorageContractHarness | null = null;

    afterEach(async () => {
      if (harness) {
        await harness.cleanup();
        harness = null;
      }
    });

    it('persists drafts, recovers newer urgent flush drafts, and completes attempts', async () => {
      harness = await createHarness();
      const baseDraft = makeDraft({ updatedAtMs: 1_000 });
      expect((await harness.attemptStore.saveAttemptDraft(baseDraft)).ok).toBe(true);

      const urgentDraft = makeDraft({
        draftText: 'Crash-safe pagehide text!',
        wordCount: 3,
        updatedAtMs: 2_500,
      });
      harness.dropNextUrgentDraftWrite();
      harness.attemptStore.flushUrgentDraftSync(urgentDraft);

      const active = await harness.attemptStore.getActiveDraft('pack-w-01', 'writing');
      expect(active.ok).toBe(true);
      if (active.ok) {
        expect(active.value?.draftText).toBe('Crash-safe pagehide text!');
      }

      // Completing a different attemptId on the same [packId, skill] must NOT delete att-w-01 draft
      await harness.attemptStore.completeObjectiveAttempt(
        makeAttempt({
          attemptId: 'att-other-01',
          packId: 'pack-w-01',
          skill: 'writing',
        }),
      );
      const stillActive = await harness.attemptStore.getActiveDraft('pack-w-01', 'writing');
      expect(stillActive.ok && stillActive.value?.attemptId).toBe('att-w-01');

      const completed = makeAttempt({
        attemptId: 'att-w-01',
        packId: 'pack-w-01',
        skill: 'writing',
      });
      await harness.attemptStore.completeObjectiveAttempt(completed);
      const afterComplete = await harness.attemptStore.getActiveDraft('pack-w-01', 'writing');
      expect(afterComplete.ok && afterComplete.value).toBeNull();

      const fetched = await harness.attemptStore.getAttemptById('att-w-01');
      expect(fetched.ok && fetched.value?.overallBand).toBe(7.5);
    });

    it('stores preferences, annotations, evaluations, micro-drills, diagnostics, and exports study JSON', async () => {
      harness = await createHarness();
      const today = harness.clock.todaySerialDay();

      await harness.attemptStore.saveUserProfile({
        deviceId: 'dev-1',
        examId: 'toefl_ibt',
        examModule: 'academic',
        targetBand: 5.5,
        targetDateSerial: today + 30,
        onboardingCompleted: true,
        freeDiagnosticUsed: false,
        linkedEmail: 'user@mockza.test',
        appUserId: 'u-1',
        isPro: true,
        updatedAtMs: harness.clock.nowMs(),
      });
      await harness.attemptStore.saveAppearance({
        themeModeKey: 'dark',
        presetId: 'midnight_indigo',
        updatedAtMs: harness.clock.nowMs(),
      });
      await harness.attemptStore.saveSplitPaneRatio('reading', 55);
      await harness.attemptStore.savePassageAnnotations('pack-r-01', [
        {
          annotationId: 'ann-1',
          packId: 'pack-r-01',
          passageIndex: 0,
          startOffset: 10,
          endOffset: 25,
          colorCode: 'yellow',
          noteText: 'Key claim',
          isDeleted: 0,
          createdAtMs: 1_000,
          updatedAtMs: 1_000,
        },
      ]);
      await harness.attemptStore.incrementDailyStudyLog({
        serialDay: today,
        addSeconds: 120,
        addCompletedItems: 1,
      });
      await harness.attemptStore.recordMicroDrillHistory({
        drillId: 'drill-1',
        examId: 'toefl_ibt',
        drillType: 'collocations',
        skill: 'reading',
        correctCount: 8,
        totalCount: 10,
        durationSeconds: 180,
        completedAtMs: harness.clock.nowMs(),
      });
      await harness.attemptStore.saveDiagnosticSession({
        diagId: 'diag-1',
        examId: 'toefl_ibt',
        mode: 'standard',
        policyVersion: 'v1',
        contentVersion: 'c1',
        selectionSeed: 'seed-1',
        startedAtUtcMs: 1_000,
        collectionDeadlineUtcMs: 901_000,
        resultsDeadlineUtcMs: 960_000,
        currentStage: 'results',
        status: 'completed',
        stateJson: '{}',
        createdAtMs: 1_000,
        updatedAtMs: 2_000,
      });

      const split = await harness.attemptStore.getSplitPaneRatio('reading');
      expect(split.ok && split.value).toBe(55);

      const anns = await harness.attemptStore.getPassageAnnotations('pack-r-01');
      expect(anns.ok && anns.value).toHaveLength(1);

      // Empty savePassageAnnotations merges/preserves existing annotations; adding ann-2 keeps both
      await harness.attemptStore.savePassageAnnotations('pack-r-01', []);
      await harness.attemptStore.savePassageAnnotations('pack-r-01', [
        {
          annotationId: 'ann-2',
          packId: 'pack-r-01',
          passageIndex: 0,
          startOffset: 30,
          endOffset: 42,
          colorCode: 'mint',
          noteText: null,
          isDeleted: 0,
          createdAtMs: 1_100,
          updatedAtMs: 1_100,
        },
      ]);
      const mergedAnns = await harness.attemptStore.getPassageAnnotations('pack-r-01');
      expect(mergedAnns.ok && mergedAnns.value.map((a) => a.annotationId)).toEqual([
        'ann-1',
        'ann-2',
      ]);

      // Negative daily study log increments are clamped to 0 (never decrement totals)
      const clampedLog = await harness.attemptStore.incrementDailyStudyLog({
        serialDay: today,
        addSeconds: -50,
        addCompletedItems: -3,
      });
      expect(clampedLog.ok && clampedLog.value.studySeconds).toBe(120);
      expect(clampedLog.ok && clampedLog.value.completedItems).toBe(1);

      const exp = await harness.attemptStore.exportStudyDataJson();
      expect(exp.ok).toBe(true);
      if (exp.ok) {
        expect(exp.value.schemaVersion).toBe(1);
        expect(exp.value.profiles).toHaveLength(1);
        expect(exp.value.studyLogs).toHaveLength(1);
        expect(exp.value.diagnosticSessions).toHaveLength(1);
      }

      await harness.attemptStore.wipeAllData();
      const profileAfterWipe = await harness.attemptStore.getUserProfile();
      expect(profileAfterWipe.ok && profileAfterWipe.value).toBeNull();
    });

    it('preserves SM-2 schedule when re-seeding vocabulary deck and logs reviews', async () => {
      harness = await createHarness();
      const today = serialDayFromUtcMs(harness.clock.nowMs());

      const seed1 = await harness.vocabStore.upsertSeededDeckPreservingSrs([
        makeVocabCard('c1', 'mitigate'),
        makeVocabCard('c2', 'ubiquitous'),
      ]);
      expect(seed1.ok && seed1.value.insertedCount).toBe(2);

      const reviewed = await harness.vocabStore.recordReview({
        cardId: 'c1',
        rating: 3, // easy
        todaySerialDay: today,
        nowMs: harness.clock.nowMs(),
      });
      expect(reviewed.ok).toBe(true);
      const savedDueDay = reviewed.ok ? reviewed.value.dueSerialDay : -1;
      expect(savedDueDay).toBeGreaterThan(today);

      // Re-upsert seeded deck with updated definition; SM-2 schedule must survive!
      const seed2 = await harness.vocabStore.upsertSeededDeckPreservingSrs([
        { ...makeVocabCard('c1', 'mitigate'), definition: 'Updated definition' },
      ]);
      expect(seed2.ok && seed2.value.updatedCount).toBe(1);

      const dueToday = await harness.vocabStore.getDueCards(today);
      expect(dueToday.ok).toBe(true);
      if (dueToday.ok) {
        expect(dueToday.value.map((c) => c.card.cardId)).toEqual(['c2']);
      }

      const ahead = await harness.vocabStore.getAheadCards(10, today);
      expect(ahead.ok).toBe(true);
      if (ahead.ok) {
        expect(ahead.value[0]?.card.cardId).toBe('c1');
        expect(ahead.value[0]?.srs.dueSerialDay).toBe(savedDueDay);
      }

      const logs = await harness.vocabStore.listVocabReviewLogs({ cardId: 'c1' });
      expect(logs.ok && logs.value).toHaveLength(1);
      expect(logs.ok && logs.value[0]?.syncStatus).toBe('pending');

      // Duplicate cardId within same upsertSeededDeckPreservingSrs batch is deduplicated
      const dedupSeed = await harness.vocabStore.upsertSeededDeckPreservingSrs([
        makeVocabCard('c3', 'ephemeral'),
        { ...makeVocabCard('c3', 'ephemeral'), definition: 'Latest definition' },
      ]);
      expect(dedupSeed.ok && dedupSeed.value).toEqual({ insertedCount: 1, updatedCount: 0 });
    });

    it('enforces idempotency, FIFO flush, terminal error stopping, and 30-day audio GC protection', async () => {
      harness = await createHarness();
      const observedCounts: number[] = [];
      const unsub = harness.syncOutbox.observePendingCount((c) => observedCounts.push(c));

      const att = makeAttempt({
        attemptId: 'att-writing-1',
        skill: 'writing',
        status: 'submitted_local',
        syncStatus: 'pending',
      });
      await harness.attemptStore.saveAttemptRecord(att);

      const e1 = await harness.syncOutbox.enqueue({
        idempotencyKey: 'idem-w-1',
        actionType: 'evaluate_writing',
        entityKind: 'attempt',
        payloadJson: JSON.stringify({ attemptId: 'att-writing-1', essayText: 'Test essay body 1234567890' }),
      });
      const e2 = await harness.syncOutbox.enqueue({
        idempotencyKey: 'idem-w-1',
        actionType: 'evaluate_writing',
        entityKind: 'attempt',
        payloadJson: JSON.stringify({ attemptId: 'att-writing-1', essayText: 'Duplicate' }),
      });
      expect(e1.ok && e2.ok && e1.value.seq === e2.value.seq).toBe(true);

      const flushOk = await harness.syncOutbox.flushPending();
      expect(flushOk.ok && flushOk.value.succeededCount).toBe(1);

      // Seed two old recordings (> 30 days): one linked to protected pending attempt, one completed
      await harness.attemptStore.saveAttemptRecord(
        makeAttempt({ attemptId: 'att-pending-audio', skill: 'speaking', status: 'failed_retryable' }),
      );
      await harness.attemptStore.saveAttemptRecord(
        makeAttempt({ attemptId: 'att-done-audio', skill: 'speaking', status: 'completed' }),
      );

      await harness.catalog.putUserRecording({
        clipId: 'rec-protected',
        blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mp4' }),
        attemptId: 'att-pending-audio',
        partIndex: 1,
        durationMs: 1000,
      });
      await harness.catalog.putUserRecording({
        clipId: 'rec-expired',
        blob: new Blob([new Uint8Array([4, 5, 6])], { type: 'audio/mp4' }),
        attemptId: 'att-done-audio',
        partIndex: 1,
        durationMs: 1000,
      });

      const purge = await harness.syncOutbox.purgeExpiredAudio(
        harness.clock.nowMs() + THIRTY_DAYS_MS + 10_000,
      );
      expect(purge.ok && purge.value).toBe(1);

      const stillThere = await harness.catalog.readUserRecordingBytes('rec-protected');
      expect(stillThere.ok).toBe(true);
      const removed = await harness.catalog.readUserRecordingBytes('rec-expired');
      expect(removed.ok).toBe(false);

      // Terminal error halts flush cleanly
      await harness.attemptStore.saveAttemptRecord(
        makeAttempt({ attemptId: 'att-quota', skill: 'writing', status: 'submitted_local' }),
      );
      await harness.syncOutbox.enqueue({
        idempotencyKey: 'idem-quota',
        actionType: 'evaluate_writing',
        entityKind: 'attempt',
        payloadJson: JSON.stringify({ attemptId: 'att-quota' }),
      });
      harness.setOutboxTerminalFailureNext();
      const flushTerm = await harness.syncOutbox.flushPending();
      expect(flushTerm.ok).toBe(true);
      if (flushTerm.ok) {
        expect(flushTerm.value.stoppedReason).toBe('quota_exceeded');
      }

      unsub();
      expect(observedCounts.length).toBeGreaterThanOrEqual(1);
    });

    it('enforces strict FIFO stop on retryable failure, exponential backoff, evaluate_speaking per-turn checkpointing, and sync_log', async () => {
      harness = await createHarness();
      const today = serialDayFromUtcMs(harness.clock.nowMs());

      // 1. Strict FIFO + backoff: item A fails retryably -> item B must NOT be dispatched out of order
      await harness.attemptStore.saveAttemptRecord(
        makeAttempt({ attemptId: 'att-fifo-1', skill: 'writing', status: 'submitted_local' }),
      );
      await harness.syncOutbox.enqueue({
        idempotencyKey: 'fifo-1',
        actionType: 'evaluate_writing',
        entityKind: 'attempt',
        payloadJson: JSON.stringify({ attemptId: 'att-fifo-1', tag: 'first' }),
      });
      await harness.syncOutbox.enqueue({
        idempotencyKey: 'fifo-2',
        actionType: 'flag_question',
        entityKind: 'flag',
        payloadJson: JSON.stringify({ questionId: 'q-fifo-2' }),
      });

      harness.setNextWritingFailRetryable(true);
      const passRetry = await harness.syncOutbox.flushPending();
      expect(passRetry.ok).toBe(true);
      if (passRetry.ok) {
        expect(passRetry.value.processedCount).toBe(1);
        expect(passRetry.value.succeededCount).toBe(0);
        expect(passRetry.value.failedRetryableCount).toBe(1);
      }
      expect(harness.getDispatchedKeys()).toEqual([]);

      // Before backoff expires (2000ms), item 1 is skipped/backed-off; advance past 2000ms -> FIFO drains both
      harness.clock.advanceByMs(2_500);
      const passDrain = await harness.syncOutbox.flushPending();
      expect(passDrain.ok && passDrain.value.succeededCount).toBe(2);
      expect(harness.getDispatchedKeys()).toEqual(['att-fifo-1', 'q-fifo-2']);

      // 2. evaluate_speaking per-turn presign+PUT checkpointing (TD-19)
      await harness.attemptStore.saveAttemptRecord(
        makeAttempt({ attemptId: 'att-spk-1', skill: 'speaking', status: 'submitted_local' }),
      );
      await harness.catalog.putUserRecording({
        clipId: 'clip-spk-1',
        blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/mp4' }),
        attemptId: 'att-spk-1',
        partIndex: 1,
        durationMs: 1200,
      });
      await harness.catalog.putUserRecording({
        clipId: 'clip-spk-2',
        blob: new Blob([new Uint8Array([4, 5, 6])], { type: 'audio/webm' }),
        attemptId: 'att-spk-1',
        partIndex: 2,
        durationMs: 1500,
      });

      await harness.syncOutbox.enqueue({
        idempotencyKey: 'spk-td19',
        actionType: 'evaluate_speaking',
        entityKind: 'attempt',
        payloadJson: JSON.stringify({
          attemptId: 'att-spk-1',
          turns: [
            { partIndex: 1, turnId: 't1', mediaKey: 'clip-spk-1', contentType: 'audio/mp4;codecs=mp4a.40.2' },
            { partIndex: 2, turnId: 't2', mediaKey: 'clip-spk-2', contentType: 'audio/webm;codecs=opus' },
          ],
        }),
      });

      harness.setNextSpeakingTurn2Fail(true);
      const spkPass1 = await harness.syncOutbox.flushPending();
      expect(spkPass1.ok).toBe(true);
      expect(harness.getSpeakingEnqueueCount()).toBe(0);

      // Turn 1 remoteObjectKey is checkpointed while Turn 2 remains null
      const recsAfterFail = await harness.catalog.listRecordingsForAttempt('att-spk-1');
      expect(recsAfterFail.ok && recsAfterFail.value[0]?.remoteObjectKey).toBeTruthy();
      expect(recsAfterFail.ok && recsAfterFail.value[1]?.remoteObjectKey).toBeNull();

      harness.clock.advanceByMs(2_500);
      const spkPass2 = await harness.syncOutbox.flushPending();
      expect(spkPass2.ok && spkPass2.value.succeededCount).toBe(1);
      expect(harness.getSpeakingEnqueueCount()).toBe(1);

      // 3. sync_log updates vocabReviewLogs syncStatus to 'synced'
      await harness.vocabStore.upsertSeededDeckPreservingSrs([makeVocabCard('c-sync', 'coherent')]);
      await harness.vocabStore.recordReview({
        cardId: 'c-sync',
        rating: 2,
        todaySerialDay: today,
        nowMs: harness.clock.nowMs(),
      });
      const pendingLogs = await harness.vocabStore.listVocabReviewLogs({ cardId: 'c-sync' });
      const logId = pendingLogs.ok ? pendingLogs.value[0]?.logId : undefined;
      expect(logId).toBeTruthy();
      await harness.syncOutbox.enqueue({
        idempotencyKey: 'vocab-sync-1',
        actionType: 'sync_log',
        entityKind: 'vocab_log',
        payloadJson: JSON.stringify({ logIds: [logId] }),
      });
      const logFlush = await harness.syncOutbox.flushPending();
      expect(logFlush.ok && logFlush.value.succeededCount).toBe(1);
      const syncedLogs = await harness.vocabStore.listVocabReviewLogs({ cardId: 'c-sync' });
      expect(syncedLogs.ok && syncedLogs.value[0]?.syncStatus).toBe('synced');
    });
  });
}

function createSharedMockTransport(): {
  readonly transport: OutboxTransport;
  setTerminalNext(): void;
  setWritingRetryableNext(fail: boolean): void;
  setTurn2FailNext(fail: boolean): void;
  getDispatchedKeys(): readonly string[];
  getSpeakingEnqueueCount(): number;
} {
  let failTerminalNext = false;
  let failWritingRetryable = false;
  let failTurn2 = false;
  let speakingEnqueueCount = 0;
  const dispatchedKeys: string[] = [];

  const transport: OutboxTransport = {
    async enqueueWritingEvaluation(payload) {
      if (failTerminalNext) {
        failTerminalNext = false;
        return err({ kind: 'quota_exceeded', message: 'Daily quota reached' });
      }
      if (failWritingRetryable) {
        failWritingRetryable = false;
        return err({ kind: 'network', message: 'Temporary 503', retryable: true, status: 503 });
      }
      dispatchedKeys.push(String(payload['attemptId'] ?? 'unknown'));
      return ok({ jobId: 'job-writing-1' });
    },
    async presignAudioUpload({ attemptId, partIndex }) {
      return ok({
        uploadUrl: `https://s3.test/put/part-${partIndex}`,
        objectKey: `users/d/clips/${attemptId}/p${partIndex}.m4a`,
      });
    },
    async uploadAudioToPresignedUrl({ uploadUrl }) {
      if (failTurn2 && uploadUrl.includes('part-2')) {
        failTurn2 = false;
        return err({ kind: 'network', message: 'S3 503', retryable: true, status: 503 });
      }
      return ok(undefined);
    },
    async enqueueSpeakingEvaluation() {
      speakingEnqueueCount++;
      return ok({ jobId: 'job-speak-1' });
    },
    async flagQuestion(payload) {
      dispatchedKeys.push(String(payload['questionId'] ?? 'flag'));
      return ok(undefined);
    },
    async syncVocabLogs() {
      return ok(undefined);
    },
  };

  return {
    transport,
    setTerminalNext: () => {
      failTerminalNext = true;
    },
    setWritingRetryableNext: (fail) => {
      failWritingRetryable = fail;
    },
    setTurn2FailNext: (fail) => {
      failTurn2 = fail;
    },
    getDispatchedKeys: () => dispatchedKeys,
    getSpeakingEnqueueCount: () => speakingEnqueueCount,
  };
}

runStorageContractSuite('FakeStorageAdapter', async () => {
  const clock = new FakeClock();
  const catalog = new FakeCatalogAdapter({ clock });
  const mockTransport = createSharedMockTransport();
  const storage = new FakeStorageAdapter({
    clock,
    catalog,
    outboxTransport: mockTransport.transport,
  });
  return {
    clock,
    attemptStore: storage,
    vocabStore: storage,
    syncOutbox: storage,
    catalog,
    setOutboxTerminalFailureNext: mockTransport.setTerminalNext,
    setNextWritingFailRetryable: mockTransport.setWritingRetryableNext,
    setNextSpeakingTurn2Fail: mockTransport.setTurn2FailNext,
    dropNextUrgentDraftWrite: () => storage.dropNextUrgentDraftWriteForTest(),
    getDispatchedKeys: mockTransport.getDispatchedKeys,
    getSpeakingEnqueueCount: mockTransport.getSpeakingEnqueueCount,
    cleanup: async () => {},
  };
});

runStorageContractSuite('DexieStorageAdapter + DexieOutboxAdapter + OpfsCatalogAdapter', async () => {
  const clock = new FakeClock();
  const db = new MockzaDexieDb(`contract-storage-${Date.now()}-${Math.random()}`);
  const storage = new DexieStorageAdapter({
    db,
    clock,
    localStorage: createMemoryStorage(),
  });
  const catalog = new OpfsCatalogAdapter({
    db,
    edition: 'glb',
    clock,
    binaryStoreOptions: {
      disableOpfs: true,
      disableCacheStorage: true,
      idbDbName: `contract-blobs-${Date.now()}-${Math.random()}`,
    },
  });
  const mockTransport = createSharedMockTransport();
  const outbox = new DexieOutboxAdapter({
    db,
    catalogMedia: catalog,
    clock,
    isOnline: () => true,
    autoAttachOnlineListener: false,
    transport: mockTransport.transport,
  });

  return {
    clock,
    attemptStore: storage,
    vocabStore: storage,
    syncOutbox: outbox,
    catalog,
    setOutboxTerminalFailureNext: mockTransport.setTerminalNext,
    setNextWritingFailRetryable: mockTransport.setWritingRetryableNext,
    setNextSpeakingTurn2Fail: mockTransport.setTurn2FailNext,
    dropNextUrgentDraftWrite: () => {
      vi.spyOn(db.attemptDrafts, 'put').mockRejectedValueOnce(new Error('Aborted on pagehide'));
    },
    getDispatchedKeys: mockTransport.getDispatchedKeys,
    getSpeakingEnqueueCount: mockTransport.getSpeakingEnqueueCount,
    cleanup: async () => {
      outbox.dispose();
      await db.delete();
    },
  };
});

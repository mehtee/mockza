import 'fake-indexeddb/auto';
import {
  DEFAULT_EASE_FACTOR_MILLI,
  type SerialDay,
  scheduleSm2Review,
  serialDayFromUtcMs,
} from '@mockza/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DexieStorageAdapter,
  URGENT_DRAFT_STORAGE_PREFIX,
  getUrgentDraftStorageKey,
  registerUrgentDraftFlushListeners,
} from '@/adapters/dexie/dexie-storage.adapter';
import {
  MOCKZA_DB_TABLE_NAMES,
  MockzaDexieDb,
} from '@/adapters/dexie/mockza-db';
import type {
  AttemptDraftRecord,
  CompletedAttemptRecord,
  VocabCardRecord,
} from '@/gateways/storage.gateway';
import type { IClock } from '@/gateways/telemetry.gateway';

function createFakeClock(initialMs: number): {
  clock: IClock;
  setNowMs: (ms: number) => void;
} {
  let now = initialMs;
  return {
    clock: {
      nowMs: () => now,
      nowIso: () => new Date(now).toISOString(),
      todaySerialDay: () => serialDayFromUtcMs(now),
    },
    setNowMs: (ms: number) => {
      now = ms;
    },
  };
}

function makeDraft(overrides?: Partial<AttemptDraftRecord>): AttemptDraftRecord {
  return {
    packId: 'pack-writing-001',
    skill: 'writing',
    attemptId: 'attempt-draft-1',
    examId: 'ielts_academic',
    taskType: 'task2Essay',
    draftText: 'Initial essay draft',
    wordCount: 3,
    answersJson: {},
    flaggedQuestionIds: [],
    currentQuestionIndex: 0,
    timerRemainingSec: 2300,
    usedStudyMode: false,
    mockSessionId: null,
    mockStageKey: null,
    updatedAtMs: 1_700_000_000_000,
    ...overrides,
  };
}

function makeVocabCard(cardId: string, overrides?: Partial<VocabCardRecord>): VocabCardRecord {
  return {
    cardId,
    examId: 'ielts_academic',
    headword: `word_${cardId}`,
    ipa: '/wɜːd/',
    definition: `Definition for ${cardId}`,
    glossFa: `معنی ${cardId}`,
    topicTag: 'environment',
    sourceKind: 'seeded',
    tags: ['academic', 'band8'],
    contextSentence: `This is an academic sentence using ${cardId}.`,
    paraphraseHints: ['term', 'expression'],
    usageNote: 'Formal register',
    sourceSkill: null,
    sourceAttemptId: null,
    sourceRefLabel: null,
    createdAtMs: 1_700_000_000_000,
    updatedAtMs: 1_700_000_000_000,
    ...overrides,
  };
}

describe('W1.3 MockzaDexieDb & DexieStorageAdapter', () => {
  let db: MockzaDexieDb;
  let store: DexieStorageAdapter;
  let fakeClock: ReturnType<typeof createFakeClock>;
  let dbCounter = 0;

  beforeEach(async () => {
    dbCounter++;
    localStorage.clear();
    fakeClock = createFakeClock(Date.UTC(2026, 10, 18, 12, 0, 0));
    db = new MockzaDexieDb(`mockza-test-storage-${Date.now()}-${dbCounter}`);
    await db.open();
    store = new DexieStorageAdapter({
      db,
      clock: fakeClock.clock,
      localStorage,
    });
  });

  afterEach(async () => {
    await db.delete();
    localStorage.clear();
  });

  it('defines exact 20 EntityTable tables matching the canonical schema', async () => {
    const tableNames = db.tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([...MOCKZA_DB_TABLE_NAMES].sort());
    expect(tableNames).toHaveLength(20);
  });

  it('supports CRUD across all 20 Dexie tables and wipeAllData clears every table and urgent buffers', async () => {
    const now = fakeClock.clock.nowMs();
    const today: SerialDay = fakeClock.clock.todaySerialDay();

    // 1. localPreferences (profile, appearance, splitPane, mockSession, dailyStudy)
    expect(
      (
        await store.saveUserProfile({
          deviceId: 'dev-1',
          examId: 'ielts_academic',
          examModule: 'academic',
          targetBand: 7.5,
          targetDateSerial: today + 30,
          onboardingCompleted: true,
          freeDiagnosticUsed: false,
          linkedEmail: 'learner@example.com',
          appUserId: 'user-1',
          isPro: true,
          updatedAtMs: now,
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await store.saveAppearance({
          themeModeKey: 'dark',
          presetId: 'midnight_indigo',
          updatedAtMs: now,
        })
      ).ok,
    ).toBe(true);
    expect((await store.saveSplitPaneRatio('reading', 0.55)).ok).toBe(true);
    expect(
      (
        await store.saveMockSession({
          mockId: 'mock-1',
          track: 'ielts_academic',
          startedAtUtcMs: now,
          examMode: 'exam',
          stageAttemptIds: { reading: 'att-r-1' },
          updatedAtMs: now,
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await store.incrementDailyStudyLog({
          serialDay: today,
          addSeconds: 120,
          addCompletedItems: 2,
        })
      ).ok,
    ).toBe(true);

    // 2. catalogPacks
    await db.catalogPacks.put({
      packId: 'pack-1',
      edition: 'glb',
      examId: 'ielts_academic',
      track: 'academic',
      skill: 'reading',
      title: 'Academic Reading 1',
      description: 'Full passage',
      durationSeconds: 3600,
      questionCount: 40,
      accent: null,
      mediaUrl: null,
      version: '1.0.0',
      sha256: 'a'.repeat(64),
      byteLength: 1024,
      isFreeSample: true,
      isCachedOffline: 1,
      bundleJson: '{}',
      cachedMediaInline: null,
      sizeBytes: 2,
      cachedAtMs: now,
      updatedAtMs: now,
    });

    // 3. attemptDrafts (+ urgent localStorage buffer)
    const draft = makeDraft({ updatedAtMs: now });
    store.flushUrgentDraftSync(draft);
    await store.saveAttemptDraft(draft);

    // 4. completedAttempts
    const completed: CompletedAttemptRecord = {
      attemptId: 'att-1',
      examId: 'ielts_academic',
      packId: 'pack-1',
      skill: 'reading',
      status: 'completed',
      syncStatus: 'synced',
      remoteJobId: null,
      submissionJson: '{"q1":"TRUE"}',
      evaluationJson: null,
      overallBand: 7.5,
      errorCode: null,
      startedAtUtcMs: now - 600_000,
      completedAtMs: now,
      durationSeconds: 600,
      usedStudyMode: false,
      questionCount: 40,
      isCalibratedFullPack: true,
      contentVersion: '1.0.0',
      mockSessionId: 'mock-1',
      mockStageKey: 'reading',
      updatedAtMs: now,
    };
    expect((await store.saveAttemptRecord(completed)).ok).toBe(true);

    // 5. passageAnnotations
    expect(
      (
        await store.savePassageAnnotations('pack-1', [
          {
            annotationId: 'ann-1',
            packId: 'pack-1',
            passageIndex: 0,
            startOffset: 10,
            endOffset: 24,
            colorCode: 'yellow',
            noteText: 'Key evidence',
            isDeleted: 0,
            createdAtMs: now,
            updatedAtMs: now,
          },
          {
            annotationId: 'ann-2',
            packId: 'pack-1',
            passageIndex: 0,
            startOffset: 30,
            endOffset: 40,
            colorCode: 'mint',
            noteText: null,
            isDeleted: 1,
            createdAtMs: now,
            updatedAtMs: now,
          },
        ])
      ).ok,
    ).toBe(true);
    const activeAnnotations = await store.getPassageAnnotations('pack-1');
    expect(activeAnnotations.ok && activeAnnotations.value.map((a) => a.annotationId)).toEqual([
      'ann-1',
    ]);

    // 6. evaluationResults
    expect(
      (
        await store.saveEvaluationResult({
          id: 'eval-1',
          attemptId: 'att-1',
          submissionId: 'sub-1',
          examId: 'ielts_academic',
          skill: 'writing',
          overallBand: 7.5,
          resultJson: {
            attemptId: 'att-1',
            overallBand: 7.5,
            isEstimated: true,
            criteria: [
              { code: 'TR', label: 'TR', band: 7.5, evidenceExcerpt: 'ex', feedbackNote: 'ok' },
              { code: 'CC', label: 'CC', band: 7.5, evidenceExcerpt: 'ex', feedbackNote: 'ok' },
              { code: 'LR', label: 'LR', band: 7.5, evidenceExcerpt: 'ex', feedbackNote: 'ok' },
              { code: 'GRA', label: 'GRA', band: 7.5, evidenceExcerpt: 'ex', feedbackNote: 'ok' },
            ],
            vocabUpgrades: [],
            modelId: 'm1',
            rubricVersion: '2026.1',
          },
          createdAtMs: now,
        })
      ).ok,
    ).toBe(true);

    // 7. diagnosticSessions
    expect(
      (
        await store.saveDiagnosticSession({
          diagId: 'diag-1',
          examId: 'ielts_academic',
          mode: 'standard',
          policyVersion: '1.0',
          contentVersion: '1.0',
          selectionSeed: 'seed-1',
          startedAtUtcMs: now,
          collectionDeadlineUtcMs: now + 540_000,
          resultsDeadlineUtcMs: now + 600_000,
          currentStage: 'reading',
          status: 'in_progress',
          stateJson: '{}',
          createdAtMs: now,
          updatedAtMs: now,
        })
      ).ok,
    ).toBe(true);

    // 8, 9, 10. vocabCards, vocabSrsStates, vocabReviewLogs
    await store.upsertSeededDeckPreservingSrs([makeVocabCard('c1')]);
    await store.recordReview({
      cardId: 'c1',
      rating: 2,
      todaySerialDay: today,
      nowMs: now,
    });

    // 11. microDrillHistory
    await store.recordMicroDrillHistory({
      drillId: 'drill-cc-1',
      examId: 'ielts_academic',
      drillType: 'CC',
      skill: 'reading',
      correctCount: 4,
      totalCount: 5,
      durationSeconds: 120,
      completedAtMs: now,
    });

    // 12. syncOutbox
    await db.syncOutbox.add({
      idempotencyKey: 'idem-1',
      actionType: 'flag_question',
      entityKind: 'flag',
      payloadJson: '{}',
      retryCount: 0,
      nextRetryAtMs: now,
      createdAtMs: now,
      updatedAtMs: now,
    });

    // 13. mediaCacheIndex
    await db.mediaCacheIndex.put({
      mediaKey: 'rec-1',
      kind: 'user_recording',
      storageBackend: 'idb_fallback',
      mimeType: 'audio/mp4',
      sha256: 'b'.repeat(64),
      byteSize: 128,
      attemptId: 'att-1',
      partIndex: 1,
      durationMs: 2000,
      remoteObjectKey: null,
      lastAccessedMs: now,
      createdAtMs: now,
      expiresAtMs: now + 30 * 86_400_000,
    });

    // 14. deviceMeta
    await db.deviceMeta.put({
      key: 'deviceInstallId',
      value: 'install-uuid-1',
      updatedAtMs: now,
    });

    // 15. linguisticNodes
    await db.linguisticNodes.put({
      nodeId: 'node-1',
      edition: 'glb',
      nodeKind: 'bottleneck',
      canonicalKey: 'grammar:conditional_avoidance',
      displayLabelEn: 'Conditional Clause Avoidance',
      displayLabelFa: null,
      masteryScoreMilli: 350,
      signalWeightMilli: 750,
      evidenceCount: 1,
      lastSeenDaySerial: today,
      lastExampleEn: 'Sample text',
      coachNoteEn: 'Use conditionals',
      coachNoteFa: null,
      isPinned: false,
      isMuted: false,
      updatedAtMs: now,
    });

    // 16. dailyMissions
    await db.dailyMissions.put({
      missionId: 'mission-1',
      missionDaySerial: today,
      edition: 'glb',
      examTrack: 'ielts_academic',
      status: 'ready',
      focusTopic: 'Artificial Intelligence',
      payloadJson: '{}',
      resultJson: null,
      updatedAtMs: now,
    });

    // 17. droppedContents
    await db.droppedContents.put({
      dropId: 'drop-1',
      inputKind: 'text',
      edition: 'glb',
      title: 'AI Essay',
      sourceLabel: 'Personal Paste',
      cefrEstimate: 'B2',
      extractedPhrasesJson: '[]',
      drillPayloadJson: '{}',
      completedAtMs: null,
      createdAtMs: now,
    });

    // 18. personalizationState
    await db.personalizationState.put({
      key: 'primary',
      payloadJson: '{}',
      updatedAtMs: now,
    });

    // 19. pronunciationHistory
    await db.pronunciationHistory.put({
      practiceId: 'pron-1',
      targetText: 'sustainable urbanization',
      overallScore: 84,
      payloadJson: '{}',
      createdAtMs: now,
    });

    // 20. bandEventsLocal
    await db.bandEventsLocal.put({
      eventId: 'evt-1',
      skill: 'reading',
      sourceKind: 'practice_section',
      rawScore: 7.0,
      createdAtMs: now,
    });

    // Verify every single one of the 20 tables is non-empty
    for (const tableName of MOCKZA_DB_TABLE_NAMES) {
      const count = await db.table(tableName).count();
      expect(count, `Expected table ${tableName} to have >= 1 row`).toBeGreaterThanOrEqual(1);
    }

    // Verify exportStudyDataJson schemaVersion: 1 parity
    const exported = await store.exportStudyDataJson();
    expect(exported.ok).toBe(true);
    if (exported.ok) {
      expect(exported.value.schemaVersion).toBe(1);
      expect(exported.value.profiles).toHaveLength(1);
      expect(exported.value.attempts).toHaveLength(1);
      expect(exported.value.vocabCards).toHaveLength(1);
      expect(exported.value.vocabReviewLogs).toHaveLength(1);
      expect(exported.value.studyLogs).toHaveLength(1);
      expect(exported.value.diagnosticSessions).toHaveLength(1);
    }

    // Add an extra urgent draft buffer key to verify wipeAllData removes it
    localStorage.setItem(`${URGENT_DRAFT_STORAGE_PREFIX}pack-x_speaking`, JSON.stringify(draft));

    const wipeRes = await store.wipeAllData();
    expect(wipeRes.ok).toBe(true);

    for (const tableName of MOCKZA_DB_TABLE_NAMES) {
      const count = await db.table(tableName).count();
      expect(count, `Expected table ${tableName} to be empty after wipeAllData`).toBe(0);
    }
    expect(localStorage.getItem(`${URGENT_DRAFT_STORAGE_PREFIX}pack-x_speaking`)).toBeNull();
  });

  it('recovers newer urgent draft from localStorage after pagehide/visibilitychange and resolves newer timestamp', async () => {
    const baseDraft = makeDraft({
      draftText: 'Older Dexie draft',
      wordCount: 3,
      updatedAtMs: 1_000,
    });
    await store.saveAttemptDraft(baseDraft);

    let currentDraft = makeDraft({
      draftText: 'Newer urgent crash-safe draft from pagehide',
      wordCount: 7,
      updatedAtMs: 5_000,
    });

    const listeners = new Map<string, Set<EventListener>>();
    const mockWin = {
      addEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)?.add(fn as EventListener);
      },
      removeEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
        listeners.get(type)?.delete(fn as EventListener);
      },
    };
    const mockDoc = {
      visibilityState: 'visible' as DocumentVisibilityState,
      addEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)?.add(fn as EventListener);
      },
      removeEventListener: (type: string, fn: EventListenerOrEventListenerObject) => {
        listeners.get(type)?.delete(fn as EventListener);
      },
    };

    const unregister = registerUrgentDraftFlushListeners(
      () => currentDraft,
      (d) => store.flushUrgentDraftSync(d),
      { windowTarget: mockWin, documentTarget: mockDoc },
    );

    // Simulate Dexie failing to finish before tab closes by reverting Dexie back to older draft
    for (const fn of listeners.get('pagehide') ?? []) {
      fn(new Event('pagehide'));
    }
    // Overwrite Dexie directly with older timestamp to simulate aborted async IDB write on crash
    await db.attemptDrafts.put(baseDraft);

    const urgentKey = getUrgentDraftStorageKey(baseDraft.packId, baseDraft.skill);
    expect(localStorage.getItem(urgentKey)).not.toBeNull();

    // getActiveDraft must compare updatedAtMs and return the newer localStorage urgent draft
    const recovered = await store.getActiveDraft('pack-writing-001', 'writing');
    expect(recovered.ok).toBe(true);
    if (recovered.ok) {
      expect(recovered.value?.draftText).toBe('Newer urgent crash-safe draft from pagehide');
      expect(recovered.value?.updatedAtMs).toBe(5_000);
    }

    // Also test visibilitychange -> hidden
    currentDraft = makeDraft({
      draftText: 'Even newer visibilitychange draft',
      wordCount: 4,
      updatedAtMs: 9_000,
    });
    mockDoc.visibilityState = 'hidden';
    for (const fn of listeners.get('visibilitychange') ?? []) {
      fn(new Event('visibilitychange'));
    }
    await db.attemptDrafts.put(baseDraft);

    const recovered2 = await store.getActiveDraft('pack-writing-001', 'writing');
    expect(recovered2.ok).toBe(true);
    if (recovered2.ok) {
      expect(recovered2.value?.draftText).toBe('Even newer visibilitychange draft');
      expect(recovered2.value?.updatedAtMs).toBe(9_000);
    }

    // If Dexie is strictly newer than localStorage urgent buffer, Dexie wins
    const evenNewerDexie = makeDraft({
      draftText: 'Dexie newer draft',
      wordCount: 3,
      updatedAtMs: 12_000,
    });
    await db.attemptDrafts.put(evenNewerDexie);
    const recovered3 = await store.getActiveDraft('pack-writing-001', 'writing');
    expect(recovered3.ok).toBe(true);
    if (recovered3.ok) {
      expect(recovered3.value?.draftText).toBe('Dexie newer draft');
      expect(recovered3.value?.updatedAtMs).toBe(12_000);
    }

    unregister();
  });

  it('preserves existing vocabSrsStates during upsertSeededDeckPreservingSrs (RR-20) and maps ratings 0..3 deterministically', async () => {
    const today = fakeClock.clock.todaySerialDay();
    const now = fakeClock.clock.nowMs();

    const initialInsert = await store.upsertSeededDeckPreservingSrs([
      makeVocabCard('card-1', { headword: 'ubiquitous' }),
      makeVocabCard('card-2', { headword: 'mitigate' }),
    ]);
    expect(initialInsert.ok).toBe(true);
    if (initialInsert.ok) {
      expect(initialInsert.value).toEqual({ insertedCount: 2, updatedCount: 0 });
    }

    // Review card-1 with rating=3 (easy), rating=2 (good), rating=1 (hard), rating=0 (again)
    const rEasy = await store.recordReview({
      cardId: 'card-1',
      rating: 3,
      todaySerialDay: today,
      nowMs: now,
    });
    expect(rEasy.ok).toBe(true);
    const expectedEasy = scheduleSm2Review({
      current: {
        repetitions: 0,
        intervalDays: 0,
        easeFactorMilli: DEFAULT_EASE_FACTOR_MILLI,
        dueDay: today,
      },
      quality: 'easy',
      today,
    });
    if (rEasy.ok) {
      expect(rEasy.value.repetitions).toBe(expectedEasy.repetitions);
      expect(rEasy.value.intervalDays).toBe(expectedEasy.intervalDays);
      expect(rEasy.value.easeFactorMilli).toBe(expectedEasy.easeFactorMilli);
      expect(rEasy.value.dueSerialDay).toBe(expectedEasy.dueDay);
    }

    // Advance card-2 with rating=0 ('again'), rating=1 ('hard'), rating=2 ('good')
    const rAgain = await store.recordReview({
      cardId: 'card-2',
      rating: 0,
      todaySerialDay: today,
      nowMs: now + 1000,
    });
    expect(rAgain.ok).toBe(true);
    if (rAgain.ok) {
      expect(rAgain.value.repetitions).toBe(0);
      expect(rAgain.value.intervalDays).toBe(1);
      expect(rAgain.value.easeFactorMilli).toBe(2180);
    }

    // Re-sync seeded deck with updated definition and a brand-new card-3
    const reSync = await store.upsertSeededDeckPreservingSrs([
      makeVocabCard('card-1', { headword: 'ubiquitous', definition: 'Updated definition' }),
      makeVocabCard('card-3', { headword: 'paradigm' }),
    ]);
    expect(reSync.ok).toBe(true);
    if (reSync.ok) {
      expect(reSync.value).toEqual({ insertedCount: 1, updatedCount: 1 });
    }

    // card-1 SRS state MUST NOT be overwritten!
    const allRes = await store.getAllCards({ searchQuery: 'Updated definition' });
    expect(allRes.ok).toBe(true);
    if (allRes.ok) {
      expect(allRes.value).toHaveLength(1);
      expect(allRes.value[0]?.card.cardId).toBe('card-1');
      expect(allRes.value[0]?.srs.repetitions).toBe(expectedEasy.repetitions);
      expect(allRes.value[0]?.srs.intervalDays).toBe(expectedEasy.intervalDays);
      expect(allRes.value[0]?.srs.easeFactorMilli).toBe(expectedEasy.easeFactorMilli);
      expect(allRes.value[0]?.srs.dueSerialDay).toBe(expectedEasy.dueDay);
    }

    // Verify due / ahead / logs
    const dueToday = await store.getDueCards(today);
    expect(dueToday.ok).toBe(true);
    if (dueToday.ok) {
      // Only card-3 is due today; card-1 (+4d) and card-2 (+1d) are ahead
      expect(dueToday.value.map((x) => x.card.cardId)).toEqual(['card-3']);
    }

    const ahead = await store.getAheadCards(10, today);
    expect(ahead.ok).toBe(true);
    if (ahead.ok) {
      expect(ahead.value.map((x) => x.card.cardId)).toEqual(['card-2', 'card-1']);
    }

    const logs = await store.listVocabReviewLogs();
    expect(logs.ok).toBe(true);
    if (logs.ok) {
      expect(logs.value).toHaveLength(2);
      expect(logs.value[0]?.cardId).toBe('card-2');
      expect(logs.value[0]?.rating).toBe(0);
      expect(logs.value[1]?.cardId).toBe('card-1');
      expect(logs.value[1]?.rating).toBe(3);
    }
  });

  it('falls back gracefully to Dexie in saveAttemptDraft and getActiveDraft when localStorage throws SecurityError', async () => {
    const throwingStorage: Storage = {
      get length() {
        return 0;
      },
      clear: () => {
        throw new DOMException('storage denied', 'SecurityError');
      },
      getItem: () => {
        throw new DOMException('storage denied', 'SecurityError');
      },
      key: () => null,
      removeItem: () => {
        throw new DOMException('storage denied', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('storage denied', 'SecurityError');
      },
    };

    const restrictedStore = new DexieStorageAdapter({
      db,
      clock: fakeClock.clock,
      localStorage: throwingStorage,
    });

    const draft = makeDraft({
      packId: 'pack-restricted-1',
      attemptId: 'att-restricted-1',
      draftText: 'Saved directly to Dexie despite SecurityError',
      wordCount: 7,
      updatedAtMs: 42_000,
    });

    const saveRes = await restrictedStore.saveAttemptDraft(draft);
    expect(saveRes.ok).toBe(true);

    const loadRes = await restrictedStore.getActiveDraft('pack-restricted-1', 'writing');
    expect(loadRes.ok).toBe(true);
    if (loadRes.ok) {
      expect(loadRes.value?.attemptId).toBe('att-restricted-1');
      expect(loadRes.value?.draftText).toBe('Saved directly to Dexie despite SecurityError');
    }
  });

  it('deduplicates duplicate cardIds in upsertSeededDeckPreservingSrs without ConstraintError while preserving SRS', async () => {
    const today = fakeClock.clock.todaySerialDay();
    const now = fakeClock.clock.nowMs();

    // Seed and review card-existing first so its SRS state is non-initial
    await store.upsertSeededDeckPreservingSrs([makeVocabCard('card-existing')]);
    const rev = await store.recordReview({
      cardId: 'card-existing',
      rating: 3,
      todaySerialDay: today,
      nowMs: now,
    });
    expect(rev.ok).toBe(true);

    const batchWithDuplicates = [
      makeVocabCard('card-dup-new', { definition: 'First definition' }),
      makeVocabCard('card-dup-new', { definition: 'Latest definition' }),
      makeVocabCard('card-existing', { definition: 'Updated existing 1' }),
      makeVocabCard('card-existing', { definition: 'Updated existing 2' }),
    ];

    const res = await store.upsertSeededDeckPreservingSrs(batchWithDuplicates);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toEqual({ insertedCount: 1, updatedCount: 1 });
    }

    const newCard = await db.vocabCards.get('card-dup-new');
    expect(newCard?.definition).toBe('Latest definition');
    const newSrs = await db.vocabSrsStates.get('card-dup-new');
    expect(newSrs?.state).toBe('new');

    const existingSrs = await db.vocabSrsStates.get('card-existing');
    expect(existingSrs?.repetitions).toBe(1);
    expect(existingSrs?.intervalDays).toBe(4);
  });
});

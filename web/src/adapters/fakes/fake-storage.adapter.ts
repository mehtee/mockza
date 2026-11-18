import {
  DEFAULT_EASE_FACTOR_MILLI,
  type SerialDay,
  type SrsCardState,
  type SupportedExamId,
  createInitialSrsCardState,
  scheduleSm2Review,
} from '@mockza/domain';
import {
  type OutboxTransport,
  type SpeakingTurnOutboxEntry,
  computeOutboxBackoffMs,
  MAX_OUTBOX_RETRY_COUNT,
  PROTECTED_AUDIO_ATTEMPT_STATUSES,
  stripAudioMimeCodecs,
} from '@/adapters/dexie/dexie-outbox.adapter';
import {
  computeVocabSrsLearningState,
  mapVocabRatingToQuality,
} from '@/adapters/dexie/dexie-storage.adapter';
import { THIRTY_DAYS_MS } from '@/adapters/media/opfs-catalog.adapter';
import { err, ok, type Result, type StorageError } from '@/gateways/result';
import type {
  AppearanceSettingsRecord,
  AttemptDraftRecord,
  AttemptListFilter,
  AttemptStatus,
  CompletedAttemptRecord,
  DailyStudyLogRecord,
  DiagnosticSessionRecord,
  EvaluationResultRecord,
  IOfflineAttemptStore,
  ISyncOutboxGateway,
  IVocabSrsStore,
  MicroDrillHistoryRecord,
  MockSessionRecord,
  OutboxMutationInput,
  PassageAnnotationRecord,
  RecordVocabReviewInput,
  SeedDeckUpsertSummary,
  StudyDataExportPayload,
  SyncFlushReport,
  SyncOutboxError,
  SyncOutboxItem,
  UserProfileRecord,
  VocabCardFilter,
  VocabCardRecord,
  VocabCardWithSrs,
  VocabReviewLogRecord,
  VocabSrsStateRecord,
} from '@/gateways/storage.gateway';
import type { IClock } from '@/gateways/telemetry.gateway';
import type { FakeCatalogAdapter } from './fake-catalog.adapter';
import { FakeClock } from './fake-clock';

export interface FakeStorageAdapterOptions {
  readonly clock?: IClock;
  readonly catalog?: FakeCatalogAdapter;
  readonly outboxDispatcher?: (item: SyncOutboxItem, payload: Record<string, unknown>) => Promise<Result<{ readonly jobId?: string }, SyncOutboxError>>;
  readonly outboxTransport?: OutboxTransport;
}

export class FakeStorageAdapter
  implements IOfflineAttemptStore, IVocabSrsStore, ISyncOutboxGateway
{
  private readonly clock: IClock;
  private readonly catalog?: FakeCatalogAdapter;
  private outboxDispatcher?: FakeStorageAdapterOptions['outboxDispatcher'];
  private outboxTransport?: OutboxTransport;

  private userProfile: UserProfileRecord | null = null;
  private appearance: AppearanceSettingsRecord | null = null;
  private readonly splitPaneRatios = new Map<string, number>();
  private readonly mockSessions = new Map<string, MockSessionRecord>();
  private readonly dailyStudyLogs = new Map<SerialDay, DailyStudyLogRecord>();
  private readonly drafts = new Map<string, AttemptDraftRecord>();
  private readonly urgentDrafts = new Map<string, AttemptDraftRecord>();
  private readonly completedAttempts = new Map<string, CompletedAttemptRecord>();
  private readonly annotations = new Map<string, readonly PassageAnnotationRecord[]>();
  private readonly evaluations = new Map<string, EvaluationResultRecord>();
  private readonly diagnosticSessions = new Map<string, DiagnosticSessionRecord>();
  private readonly microDrillHistory: MicroDrillHistoryRecord[] = [];
  private readonly vocabCards = new Map<string, VocabCardRecord>();
  private readonly vocabSrsStates = new Map<string, VocabSrsStateRecord>();
  private readonly vocabReviewLogs: VocabReviewLogRecord[] = [];
  private readonly outboxItems = new Map<number, SyncOutboxItem>();
  private readonly pendingListeners = new Set<(count: number) => void>();

  private nextSeq = 1;
  private nextLogId = 1;
  private nextDrillAutoId = 1;
  private isFlushing = false;
  private isOnline = true;
  private dropNextUrgentMainWrite = false;

  dropNextUrgentDraftWriteForTest(): void {
    this.dropNextUrgentMainWrite = true;
  }

  constructor(options: FakeStorageAdapterOptions = {}) {
    this.clock = options.clock ?? new FakeClock();
    this.catalog = options.catalog;
    this.outboxDispatcher = options.outboxDispatcher;
    this.outboxTransport = options.outboxTransport;
  }

  setOnline(online: boolean): void {
    this.isOnline = online;
  }

  setOutboxDispatcher(dispatcher: FakeStorageAdapterOptions['outboxDispatcher']): void {
    this.outboxDispatcher = dispatcher;
  }

  setOutboxTransport(transport: OutboxTransport | undefined): void {
    this.outboxTransport = transport;
  }

  private draftKey(packId: string, skill: string): string {
    return `${packId}::${skill}`;
  }

  private emitPendingCount(): void {
    const count = this.outboxItems.size;
    for (const listener of this.pendingListeners) {
      listener(count);
    }
  }

  // --- IOfflineAttemptStore ---

  async saveAttemptDraft(draft: AttemptDraftRecord): Promise<Result<void, StorageError>> {
    const key = this.draftKey(draft.packId, draft.skill);
    this.drafts.set(key, draft);
    const urgent = this.urgentDrafts.get(key);
    if (urgent && urgent.updatedAtMs <= draft.updatedAtMs) {
      this.urgentDrafts.delete(key);
    }
    return ok(undefined);
  }

  flushUrgentDraftSync(draft: AttemptDraftRecord): void {
    const key = this.draftKey(draft.packId, draft.skill);
    this.urgentDrafts.set(key, draft);
    if (this.dropNextUrgentMainWrite) {
      this.dropNextUrgentMainWrite = false;
      return;
    }
    this.drafts.set(key, draft);
  }

  async getActiveDraft(
    packId: string,
    skill: AttemptDraftRecord['skill'],
  ): Promise<Result<AttemptDraftRecord | null, StorageError>> {
    const key = this.draftKey(packId, skill);
    const main = this.drafts.get(key) ?? null;
    const urgent = this.urgentDrafts.get(key) ?? null;
    if (urgent && (!main || urgent.updatedAtMs > main.updatedAtMs)) {
      this.drafts.set(key, urgent);
      return ok(urgent);
    }
    return ok(main);
  }

  async deleteDraft(attemptId: string): Promise<Result<void, StorageError>> {
    for (const [k, v] of this.drafts.entries()) {
      if (v.attemptId === attemptId) this.drafts.delete(k);
    }
    for (const [k, v] of this.urgentDrafts.entries()) {
      if (v.attemptId === attemptId) this.urgentDrafts.delete(k);
    }
    return ok(undefined);
  }

  async completeObjectiveAttempt(
    record: CompletedAttemptRecord,
  ): Promise<Result<void, StorageError>> {
    this.completedAttempts.set(record.attemptId, record);
    const key = this.draftKey(record.packId, record.skill);
    const main = this.drafts.get(key);
    if (main && main.attemptId === record.attemptId) {
      this.drafts.delete(key);
    }
    const urgent = this.urgentDrafts.get(key);
    if (urgent && urgent.attemptId === record.attemptId) {
      this.urgentDrafts.delete(key);
    }
    for (const [k, v] of this.drafts.entries()) {
      if (v.attemptId === record.attemptId) this.drafts.delete(k);
    }
    for (const [k, v] of this.urgentDrafts.entries()) {
      if (v.attemptId === record.attemptId) this.urgentDrafts.delete(k);
    }
    return ok(undefined);
  }

  async saveAttemptRecord(record: CompletedAttemptRecord): Promise<Result<void, StorageError>> {
    this.completedAttempts.set(record.attemptId, record);
    return ok(undefined);
  }

  async getAttemptById(
    attemptId: string,
  ): Promise<Result<CompletedAttemptRecord | null, StorageError>> {
    return ok(this.completedAttempts.get(attemptId) ?? null);
  }

  async listCompletedAttempts(
    filter?: AttemptListFilter,
  ): Promise<Result<readonly CompletedAttemptRecord[], StorageError>> {
    const items = Array.from(this.completedAttempts.values())
      .filter((a) => {
        if (filter?.examId && a.examId !== filter.examId) return false;
        if (filter?.skill && a.skill !== filter.skill) return false;
        if (filter?.mockSessionId && a.mockSessionId !== filter.mockSessionId) return false;
        return true;
      })
      .sort((a, b) => b.completedAtMs - a.completedAtMs);
    return ok(items);
  }

  async savePassageAnnotations(
    packId: string,
    spans: readonly PassageAnnotationRecord[],
  ): Promise<Result<void, StorageError>> {
    const existing = this.annotations.get(packId) ?? [];
    const byId = new Map<string, PassageAnnotationRecord>();
    for (const item of existing) {
      byId.set(item.annotationId, item);
    }
    for (const span of spans) {
      byId.set(span.annotationId, { ...span, packId });
    }
    this.annotations.set(
      packId,
      Array.from(byId.values()).sort((a, b) => a.startOffset - b.startOffset),
    );
    return ok(undefined);
  }

  async getPassageAnnotations(
    packId: string,
  ): Promise<Result<readonly PassageAnnotationRecord[], StorageError>> {
    const items = (this.annotations.get(packId) ?? []).filter((a) => a.isDeleted !== 1);
    return ok(items);
  }

  async saveEvaluationResult(record: EvaluationResultRecord): Promise<Result<void, StorageError>> {
    this.evaluations.set(record.id, record);
    return ok(undefined);
  }

  async getEvaluationResultById(
    id: string,
  ): Promise<Result<EvaluationResultRecord | null, StorageError>> {
    return ok(this.evaluations.get(id) ?? null);
  }

  async getEvaluationResultByAttemptId(
    attemptId: string,
  ): Promise<Result<EvaluationResultRecord | null, StorageError>> {
    for (const item of this.evaluations.values()) {
      if (item.attemptId === attemptId) return ok(item);
    }
    return ok(null);
  }

  async recordMicroDrillHistory(
    record: MicroDrillHistoryRecord,
  ): Promise<Result<MicroDrillHistoryRecord, StorageError>> {
    const stored: MicroDrillHistoryRecord = { ...record, id: this.nextDrillAutoId++ };
    this.microDrillHistory.push(stored);
    return ok(stored);
  }

  async listMicroDrillHistory(filter?: {
    readonly examId?: SupportedExamId;
    readonly drillId?: string;
    readonly limit?: number;
  }): Promise<Result<readonly MicroDrillHistoryRecord[], StorageError>> {
    const items = this.microDrillHistory
      .filter((row) => {
        if (filter?.examId && row.examId !== filter.examId) return false;
        if (filter?.drillId && row.drillId !== filter.drillId) return false;
        return true;
      })
      .sort((a, b) => b.completedAtMs - a.completedAtMs);
    const limited =
      filter?.limit !== undefined && filter.limit >= 0 ? items.slice(0, filter.limit) : items;
    return ok(limited);
  }

  async getUserProfile(): Promise<Result<UserProfileRecord | null, StorageError>> {
    return ok(this.userProfile);
  }

  async saveUserProfile(profile: UserProfileRecord): Promise<Result<void, StorageError>> {
    this.userProfile = profile;
    return ok(undefined);
  }

  async getAppearance(): Promise<Result<AppearanceSettingsRecord | null, StorageError>> {
    return ok(this.appearance);
  }

  async saveAppearance(settings: AppearanceSettingsRecord): Promise<Result<void, StorageError>> {
    this.appearance = settings;
    return ok(undefined);
  }

  async getSplitPaneRatio(viewKey: string): Promise<Result<number | null, StorageError>> {
    return ok(this.splitPaneRatios.get(viewKey) ?? null);
  }

  async saveSplitPaneRatio(viewKey: string, ratio: number): Promise<Result<void, StorageError>> {
    this.splitPaneRatios.set(viewKey, ratio);
    return ok(undefined);
  }

  async getMockSession(mockId: string): Promise<Result<MockSessionRecord | null, StorageError>> {
    return ok(this.mockSessions.get(mockId) ?? null);
  }

  async saveMockSession(session: MockSessionRecord): Promise<Result<void, StorageError>> {
    this.mockSessions.set(session.mockId, session);
    return ok(undefined);
  }

  async getDailyStudyLog(
    serialDay: SerialDay,
  ): Promise<Result<DailyStudyLogRecord | null, StorageError>> {
    return ok(this.dailyStudyLogs.get(serialDay) ?? null);
  }

  async listRecentDailyStudyLogs(
    limit: number = 90,
  ): Promise<Result<readonly DailyStudyLogRecord[], StorageError>> {
    const items = Array.from(this.dailyStudyLogs.values()).sort(
      (a, b) => b.serialDay - a.serialDay,
    );
    return ok(limit >= 0 ? items.slice(0, limit) : items);
  }

  async incrementDailyStudyLog(input: {
    readonly serialDay: SerialDay;
    readonly addSeconds: number;
    readonly addCompletedItems: number;
  }): Promise<Result<DailyStudyLogRecord, StorageError>> {
    const existing = this.dailyStudyLogs.get(input.serialDay);
    const updated: DailyStudyLogRecord = {
      serialDay: input.serialDay,
      studySeconds: (existing?.studySeconds ?? 0) + Math.max(0, Math.trunc(input.addSeconds)),
      completedItems:
        (existing?.completedItems ?? 0) + Math.max(0, Math.trunc(input.addCompletedItems)),
      updatedAtMs: this.clock.nowMs(),
    };
    this.dailyStudyLogs.set(input.serialDay, updated);
    return ok(updated);
  }

  async getDiagnosticSession(
    diagId: string,
  ): Promise<Result<DiagnosticSessionRecord | null, StorageError>> {
    return ok(this.diagnosticSessions.get(diagId) ?? null);
  }

  async getLatestDiagnosticSession(
    examId?: SupportedExamId,
  ): Promise<Result<DiagnosticSessionRecord | null, StorageError>> {
    const list = Array.from(this.diagnosticSessions.values())
      .filter((s) => !examId || s.examId === examId)
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    return ok(list[0] ?? null);
  }

  async saveDiagnosticSession(
    session: DiagnosticSessionRecord,
  ): Promise<Result<void, StorageError>> {
    this.diagnosticSessions.set(session.diagId, session);
    return ok(undefined);
  }

  async exportStudyDataJson(): Promise<Result<StudyDataExportPayload, StorageError>> {
    return ok({
      schemaVersion: 1,
      exportedAtMs: this.clock.nowMs(),
      profiles: this.userProfile ? [this.userProfile] : [],
      attempts: Array.from(this.completedAttempts.values()).sort(
        (a, b) => b.completedAtMs - a.completedAtMs,
      ),
      vocabCards: Array.from(this.vocabCards.values()).sort((a, b) =>
        a.headword.localeCompare(b.headword),
      ),
      vocabReviewLogs: [...this.vocabReviewLogs],
      studyLogs: Array.from(this.dailyStudyLogs.values()).sort(
        (a, b) => b.serialDay - a.serialDay,
      ),
      diagnosticSessions: Array.from(this.diagnosticSessions.values()),
    });
  }

  async wipeAllData(): Promise<Result<void, StorageError>> {
    this.userProfile = null;
    this.appearance = null;
    this.splitPaneRatios.clear();
    this.mockSessions.clear();
    this.dailyStudyLogs.clear();
    this.drafts.clear();
    this.urgentDrafts.clear();
    this.completedAttempts.clear();
    this.annotations.clear();
    this.evaluations.clear();
    this.diagnosticSessions.clear();
    this.microDrillHistory.length = 0;
    this.vocabCards.clear();
    this.vocabSrsStates.clear();
    this.vocabReviewLogs.length = 0;
    this.outboxItems.clear();
    this.emitPendingCount();
    return ok(undefined);
  }

  // --- IVocabSrsStore ---

  private getOrDefaultSrs(card: VocabCardRecord, fallbackDay?: SerialDay): VocabSrsStateRecord {
    return (
      this.vocabSrsStates.get(card.cardId) ?? {
        cardId: card.cardId,
        repetitions: 0,
        intervalDays: 0,
        easeFactorMilli: DEFAULT_EASE_FACTOR_MILLI,
        dueSerialDay: fallbackDay ?? this.clock.todaySerialDay(),
        state: 'new',
        updatedAtMs: card.updatedAtMs,
      }
    );
  }

  async getDueCards(
    todaySerialDay: SerialDay,
    limit: number = 200,
  ): Promise<Result<readonly VocabCardWithSrs[], StorageError>> {
    const due = Array.from(this.vocabSrsStates.values())
      .filter((s) => s.dueSerialDay <= todaySerialDay)
      .sort((a, b) => a.dueSerialDay - b.dueSerialDay);
    const sliced = limit >= 0 ? due.slice(0, limit) : due;
    const out: VocabCardWithSrs[] = [];
    for (const srs of sliced) {
      const card = this.vocabCards.get(srs.cardId);
      if (card) out.push({ card, srs });
    }
    return ok(out);
  }

  async getAllCards(
    filter?: VocabCardFilter,
  ): Promise<Result<readonly VocabCardWithSrs[], StorageError>> {
    const query = filter?.searchQuery?.trim().toLowerCase();
    const cards = Array.from(this.vocabCards.values())
      .filter((card) => {
        if (filter?.examId && card.examId !== filter.examId) return false;
        if (filter?.sourceKind && card.sourceKind !== filter.sourceKind) return false;
        if (filter?.topicTag && card.topicTag !== filter.topicTag) return false;
        if (filter?.tag && !card.tags.includes(filter.tag)) return false;
        if (query && query.length > 0) {
          const hit =
            card.headword.toLowerCase().includes(query) ||
            card.definition.toLowerCase().includes(query) ||
            (card.glossFa?.toLowerCase().includes(query) ?? false) ||
            (card.contextSentence?.toLowerCase().includes(query) ?? false);
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => a.headword.localeCompare(b.headword));

    return ok(cards.map((card) => ({ card, srs: this.getOrDefaultSrs(card) })));
  }

  async getAheadCards(
    limit: number = 200,
    todaySerialDay?: SerialDay,
  ): Promise<Result<readonly VocabCardWithSrs[], StorageError>> {
    const states = Array.from(this.vocabSrsStates.values())
      .filter((s) => todaySerialDay === undefined || s.dueSerialDay > todaySerialDay)
      .sort((a, b) => a.dueSerialDay - b.dueSerialDay);
    const sliced = limit >= 0 ? states.slice(0, limit) : states;
    const out: VocabCardWithSrs[] = [];
    for (const srs of sliced) {
      const card = this.vocabCards.get(srs.cardId);
      if (card) out.push({ card, srs });
    }
    return ok(out);
  }

  async recordReview(
    input: RecordVocabReviewInput,
  ): Promise<Result<VocabSrsStateRecord, StorageError>> {
    const quality = mapVocabRatingToQuality(input.rating);
    if (!quality) {
      return err({
        kind: 'storage',
        code: 'CORRUPT_DATA',
        message: `Unsupported rating: ${String(input.rating)}`,
      });
    }
    const card = this.vocabCards.get(input.cardId);
    if (!card) {
      return err({
        kind: 'storage',
        code: 'NOT_FOUND',
        message: `Vocab card not found: ${input.cardId}`,
      });
    }

    const existing = this.vocabSrsStates.get(input.cardId);
    const current: SrsCardState = existing
      ? {
          repetitions: existing.repetitions,
          intervalDays: existing.intervalDays,
          easeFactorMilli: existing.easeFactorMilli,
          dueDay: existing.dueSerialDay,
        }
      : createInitialSrsCardState(input.todaySerialDay);

    const scheduled = scheduleSm2Review({
      current,
      quality,
      today: input.todaySerialDay,
    });

    const nextSrs: VocabSrsStateRecord = {
      cardId: input.cardId,
      repetitions: scheduled.repetitions,
      intervalDays: scheduled.intervalDays,
      easeFactorMilli: scheduled.easeFactorMilli,
      dueSerialDay: scheduled.dueDay,
      state: computeVocabSrsLearningState(
        scheduled.repetitions,
        scheduled.easeFactorMilli,
        true,
      ),
      updatedAtMs: input.nowMs,
    };

    this.vocabSrsStates.set(input.cardId, nextSrs);
    this.vocabReviewLogs.push({
      id: this.nextLogId++,
      logId: `fake-log-${this.nextLogId}`,
      cardId: input.cardId,
      rating: input.rating,
      reviewedDaySerial: input.todaySerialDay,
      reviewedAtMs: input.nowMs,
      syncStatus: 'pending',
    });

    return ok(nextSrs);
  }

  async listVocabReviewLogs(filter?: {
    readonly cardId?: string;
    readonly limit?: number;
  }): Promise<Result<readonly VocabReviewLogRecord[], StorageError>> {
    const rows = this.vocabReviewLogs
      .filter((r) => !filter?.cardId || r.cardId === filter.cardId)
      .sort((a, b) => b.reviewedAtMs - a.reviewedAtMs || (b.id ?? 0) - (a.id ?? 0));
    const limited =
      filter?.limit !== undefined && filter.limit >= 0 ? rows.slice(0, filter.limit) : rows;
    return ok(limited);
  }

  async upsertMistakeCard(
    card: VocabCardRecord,
  ): Promise<Result<VocabCardWithSrs, StorageError>> {
    this.vocabCards.set(card.cardId, card);
    let srs = this.vocabSrsStates.get(card.cardId);
    if (!srs) {
      const initial = createInitialSrsCardState(this.clock.todaySerialDay());
      srs = {
        cardId: card.cardId,
        repetitions: initial.repetitions,
        intervalDays: initial.intervalDays,
        easeFactorMilli: initial.easeFactorMilli,
        dueSerialDay: initial.dueDay,
        state: 'new',
        updatedAtMs: card.updatedAtMs,
      };
      this.vocabSrsStates.set(card.cardId, srs);
    }
    return ok({ card, srs });
  }

  async upsertSeededDeckPreservingSrs(
    cards: readonly VocabCardRecord[],
  ): Promise<Result<SeedDeckUpsertSummary, StorageError>> {
    let insertedCount = 0;
    let updatedCount = 0;
    const initialDay = this.clock.todaySerialDay();

    const dedupedById = new Map<string, VocabCardRecord>();
    for (const card of cards) {
      dedupedById.set(card.cardId, card);
    }

    for (const card of dedupedById.values()) {
      if (this.vocabCards.has(card.cardId)) {
        updatedCount++;
      } else {
        insertedCount++;
      }
      this.vocabCards.set(card.cardId, card);
      if (!this.vocabSrsStates.has(card.cardId)) {
        const initial = createInitialSrsCardState(initialDay);
        this.vocabSrsStates.set(card.cardId, {
          cardId: card.cardId,
          repetitions: initial.repetitions,
          intervalDays: initial.intervalDays,
          easeFactorMilli: initial.easeFactorMilli,
          dueSerialDay: initial.dueDay,
          state: 'new',
          updatedAtMs: card.updatedAtMs,
        });
      }
    }

    return ok({ insertedCount, updatedCount });
  }

  // --- ISyncOutboxGateway ---

  async enqueue(mutation: OutboxMutationInput): Promise<Result<SyncOutboxItem, StorageError>> {
    for (const existing of this.outboxItems.values()) {
      if (existing.idempotencyKey === mutation.idempotencyKey) {
        return ok(existing);
      }
    }

    const seq = this.nextSeq++;
    const now = this.clock.nowMs();
    const item: SyncOutboxItem = {
      seq,
      idempotencyKey: mutation.idempotencyKey,
      actionType: mutation.actionType,
      entityKind: mutation.entityKind,
      payloadJson: mutation.payloadJson,
      retryCount: 0,
      nextRetryAtMs: mutation.nextRetryAtMs ?? now,
      createdAtMs: now,
      updatedAtMs: now,
    };
    this.outboxItems.set(seq, item);
    this.emitPendingCount();
    return ok(item);
  }

  async flushPending(): Promise<Result<SyncFlushReport, SyncOutboxError>> {
    if (this.isFlushing) {
      return ok({
        processedCount: 0,
        succeededCount: 0,
        failedRetryableCount: 0,
        stoppedReason: 'already_flushing',
      });
    }
    if (!this.isOnline) {
      return ok({
        processedCount: 0,
        succeededCount: 0,
        failedRetryableCount: 0,
        stoppedReason: 'offline',
      });
    }

    this.isFlushing = true;
    let processedCount = 0;
    let succeededCount = 0;
    let failedRetryableCount = 0;
    let stoppedReason: SyncFlushReport['stoppedReason'];

    try {
      const now = this.clock.nowMs();
      await this.purgeExpiredAudio(now);

      const ordered = Array.from(this.outboxItems.values())
        .filter((item) => item.nextRetryAtMs <= now)
        .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));

      for (const item of ordered) {
        if (!this.isOnline) {
          stoppedReason = 'offline';
          break;
        }
        const seq = item.seq!;
        const payload = JSON.parse(item.payloadJson) as Record<string, unknown>;
        const attemptId = typeof payload['attemptId'] === 'string' ? payload['attemptId'] : undefined;
        processedCount++;

        const markAttempt = (
          status: AttemptStatus,
          syncStatus: 'synced' | 'pending' | 'failed',
          extra?: { readonly remoteJobId?: string | null; readonly errorCode?: string | null },
        ) => {
          if (!attemptId) return;
          const attempt = this.completedAttempts.get(attemptId);
          if (!attempt) return;
          this.completedAttempts.set(attemptId, {
            ...attempt,
            status,
            syncStatus,
            ...(extra?.remoteJobId !== undefined ? { remoteJobId: extra.remoteJobId } : {}),
            ...(extra?.errorCode !== undefined ? { errorCode: extra.errorCode } : {}),
            updatedAtMs: this.clock.nowMs(),
          });
        };

        const handleFailure = (failure: SyncOutboxError): { readonly shouldBreak: boolean } => {
          const isTerminal =
            failure.kind === 'quota_exceeded' ||
            failure.kind === 'entitlement_required' ||
            failure.kind === 'unauthorized' ||
            failure.kind === 'validation';

          if (isTerminal || item.retryCount >= MAX_OUTBOX_RETRY_COUNT) {
            markAttempt('failed_retryable', 'failed', { errorCode: failure.message });
            this.outboxItems.delete(seq);
            failedRetryableCount++;
            if (isTerminal) {
              stoppedReason = failure.kind;
              return { shouldBreak: true };
            }
            return { shouldBreak: false };
          }

          const backoffMs = computeOutboxBackoffMs(item.retryCount);
          const currentRow = this.outboxItems.get(seq) ?? item;
          this.outboxItems.set(seq, {
            ...currentRow,
            retryCount: item.retryCount + 1,
            nextRetryAtMs: now + backoffMs,
            updatedAtMs: now,
          });
          failedRetryableCount++;
          return { shouldBreak: true };
        };

        if (item.actionType === 'evaluate_speaking') {
          const rawTurns = Array.isArray(payload['turns']) ? payload['turns'] : [];
          const turns: SpeakingTurnOutboxEntry[] = rawTurns
            .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
            .map((t) => ({ ...(t as SpeakingTurnOutboxEntry) }));

          if (turns.length === 0) {
            markAttempt('failed_retryable', 'failed', { errorCode: 'NO_CLIPS_ATTACHED' });
            this.outboxItems.delete(seq);
            failedRetryableCount++;
            continue;
          }

          markAttempt('uploading_audio', 'pending');

          let turnFailure: SyncOutboxError | null = null;
          let turnMissingAudio = false;

          for (let i = 0; i < turns.length; i++) {
            const turn = turns[i];
            if (!turn) continue;
            if (typeof turn.objectKey === 'string' && turn.objectKey.length > 0) continue;

            const mediaKey =
              turn.mediaKey ?? turn.clipId ?? turn.recordingId ?? turn.localFilePath ?? '';
            if (!mediaKey || !this.catalog) {
              turnMissingAudio = true;
              break;
            }
            const audioRes = await this.catalog.readUserRecordingBytes(mediaKey);
            if (!audioRes.ok || audioRes.value.bytes.byteLength === 0) {
              turnMissingAudio = true;
              break;
            }

            const strippedMime = stripAudioMimeCodecs(turn.contentType ?? audioRes.value.mimeType);
            const partIndex = typeof turn.partIndex === 'number' ? turn.partIndex : i + 1;
            const turnId = turn.turnId ?? turn.promptId ?? `t${i}`;

            const presignRes = this.outboxTransport
              ? await this.outboxTransport.presignAudioUpload({
                  attemptId: attemptId ?? '',
                  partIndex,
                  turnId,
                  byteLength: audioRes.value.bytes.byteLength,
                  contentType: strippedMime,
                })
              : ok({
                  uploadUrl: `https://s3.fake.test/presigned/part-${partIndex}`,
                  objectKey: `uploads/${attemptId ?? 'att'}/part-${partIndex}.m4a`,
                });

            if (!presignRes.ok) {
              turnFailure = presignRes.error;
              break;
            }

            if (this.outboxTransport?.uploadAudioToPresignedUrl) {
              const uploadRes = await this.outboxTransport.uploadAudioToPresignedUrl({
                uploadUrl: presignRes.value.uploadUrl,
                bytes: audioRes.value.bytes,
                contentType: strippedMime,
              });
              if (!uploadRes.ok) {
                turnFailure = uploadRes.error;
                break;
              }
            }

            turn.objectKey = presignRes.value.objectKey;
            await this.catalog.updateRecordingRemoteKey(mediaKey, presignRes.value.objectKey);
            const prevRow = this.outboxItems.get(seq) ?? item;
            this.outboxItems.set(seq, {
              ...prevRow,
              payloadJson: JSON.stringify({ ...payload, turns }),
              updatedAtMs: this.clock.nowMs(),
            });
          }

          if (turnMissingAudio) {
            markAttempt('failed_retryable', 'failed', { errorCode: 'AUDIO_UNAVAILABLE' });
            this.outboxItems.delete(seq);
            failedRetryableCount++;
            continue;
          }

          if (turnFailure) {
            if (handleFailure(turnFailure).shouldBreak) break;
            continue;
          }

          const firstTurn = turns[0];
          const speakingPayload = {
            ...payload,
            turns,
            audioObjectKey: firstTurn?.objectKey,
            partIndex: firstTurn?.partIndex ?? 1,
          };
          const dispatchRes = this.outboxTransport
            ? await this.outboxTransport.enqueueSpeakingEvaluation(speakingPayload)
            : this.outboxDispatcher
              ? await this.outboxDispatcher(item, speakingPayload)
              : ok({ jobId: `fake-job-${seq}` });

          if (dispatchRes.ok) {
            markAttempt('queued_remote', 'synced', {
              remoteJobId: dispatchRes.value.jobId ?? null,
              errorCode: null,
            });
            this.outboxItems.delete(seq);
            succeededCount++;
            continue;
          }

          if (handleFailure(dispatchRes.error).shouldBreak) break;
          continue;
        }

        let dispatchRes: Result<{ readonly jobId?: string }, SyncOutboxError>;
        if (this.outboxTransport) {
          if (item.actionType === 'evaluate_writing') {
            dispatchRes = await this.outboxTransport.enqueueWritingEvaluation(payload);
          } else if (item.actionType === 'flag_question') {
            const flagRes = await this.outboxTransport.flagQuestion(payload);
            dispatchRes = flagRes.ok ? ok({}) : flagRes;
          } else {
            const syncRes = this.outboxTransport.syncVocabLogs
              ? await this.outboxTransport.syncVocabLogs(payload)
              : ok(undefined);
            dispatchRes = syncRes.ok ? ok({}) : syncRes;
          }
        } else if (this.outboxDispatcher) {
          dispatchRes = await this.outboxDispatcher(item, payload);
        } else {
          dispatchRes = ok({ jobId: `fake-job-${seq}` });
        }

        if (dispatchRes.ok) {
          if (item.actionType === 'sync_log') {
            const logIds = new Set(
              Array.isArray(payload['logIds'])
                ? payload['logIds'].filter((v): v is string => typeof v === 'string')
                : [],
            );
            if (logIds.size > 0) {
              for (let i = 0; i < this.vocabReviewLogs.length; i++) {
                const row = this.vocabReviewLogs[i];
                if (row && logIds.has(row.logId)) {
                  this.vocabReviewLogs[i] = { ...row, syncStatus: 'synced' };
                }
              }
            }
          } else {
            markAttempt('queued_remote', 'synced', {
              remoteJobId: dispatchRes.value.jobId ?? null,
              errorCode: null,
            });
          }
          this.outboxItems.delete(seq);
          succeededCount++;
          continue;
        }

        if (handleFailure(dispatchRes.error).shouldBreak) {
          break;
        }
      }

      return ok({
        processedCount,
        succeededCount,
        failedRetryableCount,
        ...(stoppedReason ? { stoppedReason } : {}),
      });
    } finally {
      this.isFlushing = false;
      this.emitPendingCount();
    }
  }

  observePendingCount(listener: (count: number) => void): () => void {
    this.pendingListeners.add(listener);
    listener(this.outboxItems.size);
    return () => {
      this.pendingListeners.delete(listener);
    };
  }

  async purgeExpiredAudio(nowMs?: number): Promise<Result<number, StorageError>> {
    if (!this.catalog) {
      return ok(0);
    }
    const now = nowMs ?? this.clock.nowMs();
    const cutoffMs = now - THIRTY_DAYS_MS;

    const pendingOutboxAttemptIds = new Set<string>();
    for (const item of this.outboxItems.values()) {
      try {
        const parsed = JSON.parse(item.payloadJson) as Record<string, unknown>;
        if (typeof parsed['attemptId'] === 'string' && parsed['attemptId'].length > 0) {
          pendingOutboxAttemptIds.add(parsed['attemptId']);
        }
      } catch {
        // Ignore malformed payload.
      }
    }

    const candidates = this.catalog
      .getMediaIndexEntries()
      .filter((r) => r.kind === 'user_recording' && r.createdAtMs <= cutoffMs);

    let removed = 0;
    for (const rec of candidates) {
      if (rec.attemptId && rec.attemptId.length > 0) {
        const parentAttempt = this.completedAttempts.get(rec.attemptId);
        let status: AttemptStatus | undefined = parentAttempt?.status;
        if (status === undefined) {
          for (const d of this.drafts.values()) {
            if (d.attemptId === rec.attemptId) {
              status = 'in_progress';
              break;
            }
          }
        }
        if (status !== undefined) {
          if (PROTECTED_AUDIO_ATTEMPT_STATUSES.has(status)) {
            continue;
          }
        } else if (pendingOutboxAttemptIds.has(rec.attemptId)) {
          continue;
        }
      }
      await this.catalog.deleteMediaBinary(rec.mediaKey);
      removed++;
    }

    return ok(removed);
  }
}

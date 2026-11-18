import {
  DEFAULT_EASE_FACTOR_MILLI,
  type ReviewQuality,
  type SerialDay,
  type SrsCardState,
  type SupportedExamId,
  createInitialSrsCardState,
  scheduleSm2Review,
  serialDayFromUtcMs,
} from '@mockza/domain';
import { type Result, type StorageError, err, ok } from '@/gateways/result';
import type {
  AppearanceSettingsRecord,
  AttemptDraftRecord,
  AttemptListFilter,
  CompletedAttemptRecord,
  DailyStudyLogRecord,
  DiagnosticSessionRecord,
  EvaluationResultRecord,
  IOfflineAttemptStore,
  IVocabSrsStore,
  MicroDrillHistoryRecord,
  MockSessionRecord,
  PassageAnnotationRecord,
  RecordVocabReviewInput,
  SeedDeckUpsertSummary,
  StudyDataExportPayload,
  UserProfileRecord,
  VocabCardFilter,
  VocabCardRecord,
  VocabCardWithSrs,
  VocabReviewLogRecord,
  VocabReviewRating,
  VocabSrsLearningState,
  VocabSrsStateRecord,
} from '@/gateways/storage.gateway';
import type { IClock } from '@/gateways/telemetry.gateway';
import type { SkillKind } from '@mockza/domain';
import {
  type MockzaDexieDb,
  PREF_KEY_APPEARANCE,
  PREF_KEY_USER_PROFILE,
  PREF_PREFIX_DAILY_STUDY,
  PREF_PREFIX_MOCK_SESSION,
  PREF_PREFIX_SPLIT_PANE,
} from './mockza-db';

export const URGENT_DRAFT_STORAGE_PREFIX = 'mz_urgent_draft_' as const;

export function getUrgentDraftStorageKey(packId: string, skill: SkillKind): string {
  return `${URGENT_DRAFT_STORAGE_PREFIX}${packId}_${skill}`;
}

export function mapVocabRatingToQuality(rating: VocabReviewRating): ReviewQuality | null {
  switch (rating) {
    case 0:
      return 'again';
    case 1:
      return 'hard';
    case 2:
      return 'good';
    case 3:
      return 'easy';
    default:
      return null;
  }
}

export function computeVocabSrsLearningState(
  repetitions: number,
  easeFactorMilli: number,
  hasBeenReviewed: boolean,
): VocabSrsLearningState {
  if (!hasBeenReviewed) return 'new';
  if (repetitions >= 4 && easeFactorMilli >= DEFAULT_EASE_FACTOR_MILLI) {
    return 'mastered';
  }
  return 'learning';
}

export interface UrgentDraftListenerTarget {
  readonly addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => void;
  readonly removeEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => void;
  readonly visibilityState?: DocumentVisibilityState;
}

/**
 * Registers `pagehide` and `visibilitychange` listeners to synchronously flush any active
 * draft to `localStorage` + Dexie before tab close or backgrounding.
 */
export function registerUrgentDraftFlushListeners(
  getDraft: () => AttemptDraftRecord | null,
  flush: (draft: AttemptDraftRecord) => void,
  options?: {
    readonly windowTarget?: UrgentDraftListenerTarget;
    readonly documentTarget?: UrgentDraftListenerTarget;
  },
): () => void {
  const win = options?.windowTarget ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = options?.documentTarget ?? (typeof document !== 'undefined' ? document : undefined);

  const handlePageHide = (): void => {
    const draft = getDraft();
    if (draft !== null) {
      flush(draft);
    }
  };

  const handleVisibilityChange = (): void => {
    if (doc && doc.visibilityState === 'hidden') {
      const draft = getDraft();
      if (draft !== null) {
        flush(draft);
      }
    }
  };

  win?.addEventListener('pagehide', handlePageHide);
  doc?.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    win?.removeEventListener('pagehide', handlePageHide);
    doc?.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

function getSafeLocalStorage(override?: Storage | null): Storage | null {
  if (override !== undefined) return override;
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function parseUrgentDraftJson(
  raw: string | null,
  expectedPackId: string,
  expectedSkill: SkillKind,
): AttemptDraftRecord | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const rec = parsed as Partial<AttemptDraftRecord>;
    if (
      rec.packId !== expectedPackId ||
      rec.skill !== expectedSkill ||
      typeof rec.attemptId !== 'string' ||
      typeof rec.updatedAtMs !== 'number'
    ) {
      return null;
    }
    return rec as AttemptDraftRecord;
  } catch {
    return null;
  }
}

function createDefaultClock(): IClock {
  return {
    nowMs: () => Date.now(),
    nowIso: () => new Date().toISOString(),
    todaySerialDay: () => serialDayFromUtcMs(Date.now()),
  };
}

function toStorageError(message: string, cause: unknown, code?: StorageError['code']): StorageError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return code !== undefined
    ? { kind: 'storage', message: `${message}: ${detail}`, code }
    : { kind: 'storage', message: `${message}: ${detail}` };
}

function createUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export interface DexieStorageAdapterOptions {
  readonly db: MockzaDexieDb;
  readonly clock?: IClock;
  readonly localStorage?: Storage | null;
}

/**
 * Dexie.js v4 implementation of `IOfflineAttemptStore` and `IVocabSrsStore`.
 */
export class DexieStorageAdapter implements IOfflineAttemptStore, IVocabSrsStore {
  private readonly db: MockzaDexieDb;
  private readonly clock: IClock;
  private readonly storageOverride: Storage | null | undefined;

  constructor(options: DexieStorageAdapterOptions) {
    this.db = options.db;
    this.clock = options.clock ?? createDefaultClock();
    this.storageOverride = options.localStorage;
  }

  private getStorage(): Storage | null {
    return getSafeLocalStorage(this.storageOverride);
  }

  private removeUrgentDraftFromStorage(packId: string, skill: SkillKind): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      storage.removeItem(getUrgentDraftStorageKey(packId, skill));
    } catch {
      // Ignore storage access errors in restricted environments.
    }
  }

  private removeUrgentDraftsByAttemptId(attemptId: string): void {
    const storage = this.getStorage();
    if (!storage) return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key || !key.startsWith(URGENT_DRAFT_STORAGE_PREFIX)) continue;
        const raw = storage.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as { attemptId?: unknown };
          if (parsed.attemptId === attemptId) {
            keysToRemove.push(key);
          }
        } catch {
          // Ignore malformed buffer.
        }
      }
      for (const key of keysToRemove) {
        storage.removeItem(key);
      }
    } catch {
      // Ignore storage errors.
    }
  }

  async saveAttemptDraft(draft: AttemptDraftRecord): Promise<Result<void, StorageError>> {
    try {
      await this.db.attemptDrafts.put(draft);
      const storage = this.getStorage();
      if (storage) {
        try {
          const urgentKey = getUrgentDraftStorageKey(draft.packId, draft.skill);
          const existingUrgent = parseUrgentDraftJson(
            storage.getItem(urgentKey),
            draft.packId,
            draft.skill,
          );
          if (existingUrgent && existingUrgent.updatedAtMs <= draft.updatedAtMs) {
            storage.removeItem(urgentKey);
          }
        } catch {
          // Ignore storage access errors (e.g., SecurityError) in restricted environments.
        }
      }
      return ok(undefined);
    } catch (cause) {
      return err(toStorageError('Failed to save attempt draft', cause));
    }
  }

  flushUrgentDraftSync(draft: AttemptDraftRecord): void {
    const storage = this.getStorage();
    if (storage) {
      try {
        storage.setItem(getUrgentDraftStorageKey(draft.packId, draft.skill), JSON.stringify(draft));
      } catch {
        // Best-effort emergency synchronous persistence.
      }
    }
    void this.db.attemptDrafts.put(draft).catch(() => {
      // Ignore async put errors when browser is tearing down page.
    });
  }

  async getActiveDraft(
    packId: string,
    skill: SkillKind,
  ): Promise<Result<AttemptDraftRecord | null, StorageError>> {
    try {
      const dexieDraft = (await this.db.attemptDrafts.get([packId, skill])) ?? null;
      const storage = this.getStorage();
      let urgentDraft: AttemptDraftRecord | null = null;
      if (storage) {
        try {
          urgentDraft = parseUrgentDraftJson(
            storage.getItem(getUrgentDraftStorageKey(packId, skill)),
            packId,
            skill,
          );
        } catch {
          // Ignore storage access errors (e.g., SecurityError) and fall back to Dexie.
        }
      }

      if (urgentDraft && (!dexieDraft || urgentDraft.updatedAtMs > dexieDraft.updatedAtMs)) {
        try {
          await this.db.attemptDrafts.put(urgentDraft);
        } catch {
          // Return recovered urgent draft even if Dexie write fails.
        }
        return ok(urgentDraft);
      }

      return ok(dexieDraft);
    } catch (cause) {
      return err(toStorageError('Failed to load active draft', cause));
    }
  }

  async deleteDraft(attemptId: string): Promise<Result<void, StorageError>> {
    try {
      const matchingDrafts = await this.db.attemptDrafts
        .where('attemptId')
        .equals(attemptId)
        .toArray();
      for (const draft of matchingDrafts) {
        this.removeUrgentDraftFromStorage(draft.packId, draft.skill);
      }
      this.removeUrgentDraftsByAttemptId(attemptId);
      await this.db.attemptDrafts.where('attemptId').equals(attemptId).delete();
      return ok(undefined);
    } catch (cause) {
      return err(toStorageError('Failed to delete draft', cause));
    }
  }

  async completeObjectiveAttempt(
    record: CompletedAttemptRecord,
  ): Promise<Result<void, StorageError>> {
    try {
      await this.db.transaction('rw', this.db.completedAttempts, this.db.attemptDrafts, async () => {
        await this.db.completedAttempts.put(record);
        await this.db.attemptDrafts.where('attemptId').equals(record.attemptId).delete();
        const slotDraft = await this.db.attemptDrafts.get([record.packId, record.skill]);
        if (slotDraft && slotDraft.attemptId === record.attemptId) {
          await this.db.attemptDrafts.delete([record.packId, record.skill]);
        }
      });
      this.removeUrgentDraftsByAttemptId(record.attemptId);
      return ok(undefined);
    } catch (cause) {
      return err(toStorageError('Failed to complete objective attempt', cause));
    }
  }

  async saveAttemptRecord(record: CompletedAttemptRecord): Promise<Result<void, StorageError>> {
    try {
      await this.db.completedAttempts.put(record);
      return ok(undefined);
    } catch (cause) {
      return err(toStorageError('Failed to save attempt record', cause));
    }
  }

  async getAttemptById(
    attemptId: string,
  ): Promise<Result<CompletedAttemptRecord | null, StorageError>> {
    try {
      const row = (await this.db.completedAttempts.get(attemptId)) ?? null;
      return ok(row);
    } catch (cause) {
      return err(toStorageError('Failed to load attempt', cause));
    }
  }

  async listCompletedAttempts(
    filter?: AttemptListFilter,
  ): Promise<Result<readonly CompletedAttemptRecord[], StorageError>> {
    try {
      let rows: CompletedAttemptRecord[];
      if (filter?.mockSessionId) {
        rows = await this.db.completedAttempts
          .where('mockSessionId')
          .equals(filter.mockSessionId)
          .toArray();
      } else if (filter?.examId && filter?.skill) {
        rows = await this.db.completedAttempts
          .where('[examId+skill]')
          .equals([filter.examId, filter.skill])
          .toArray();
      } else {
        rows = await this.db.completedAttempts.toArray();
      }

      const filtered = rows.filter((row) => {
        if (filter?.examId && row.examId !== filter.examId) return false;
        if (filter?.skill && row.skill !== filter.skill) return false;
        if (filter?.mockSessionId && row.mockSessionId !== filter.mockSessionId) return false;
        return true;
      });

      filtered.sort(
        (a, b) => b.completedAtMs - a.completedAtMs || b.updatedAtMs - a.updatedAtMs,
      );
      return ok(filtered);
    } catch (cause) {
      return err(toStorageError('Failed to list completed attempts', cause));
    }
  }

  async savePassageAnnotations(
    packId: string,
    spans: readonly PassageAnnotationRecord[],
  ): Promise<Result<void, StorageError>> {
    try {
      const normalized = spans.map((span) => ({
        ...span,
        packId,
      }));
      if (normalized.length > 0) {
        await this.db.passageAnnotations.bulkPut(normalized);
      }
      return ok(undefined);
    } catch (cause) {
      return err(toStorageError('Failed to save passage annotations', cause));
    }
  }

  async getPassageAnnotations(
    packId: string,
  ): Promise<Result<readonly PassageAnnotationRecord[], StorageError>> {
    try {
      const rows = await this.db.passageAnnotations
        .where('packId')
        .equals(packId)
        .and((row) => row.isDeleted === 0)
        .sortBy('startOffset');
      return ok(rows);
    } catch (cause) {
      return err(toStorageError('Failed to load passage annotations', cause));
    }
  }

  async saveEvaluationResult(
    record: EvaluationResultRecord,
  ): Promise<Result<void, StorageError>> {
    try {
      await this.db.evaluationResults.put(record);
      return ok(undefined);
    } catch (cause) {
      return err(toStorageError('Failed to save evaluation result', cause));
    }
  }

  async getEvaluationResultById(
    id: string,
  ): Promise<Result<EvaluationResultRecord | null, StorageError>> {
    try {
      const row = (await this.db.evaluationResults.get(id)) ?? null;
      return ok(row);
    } catch (cause) {
      return err(toStorageError('Failed to get evaluation result by id', cause));
    }
  }

  async getEvaluationResultByAttemptId(
    attemptId: string,
  ): Promise<Result<EvaluationResultRecord | null, StorageError>> {
    try {
      const rows = await this.db.evaluationResults
        .where('attemptId')
        .equals(attemptId)
        .toArray();
      if (rows.length === 0) return ok(null);
      rows.sort((a, b) => b.createdAtMs - a.createdAtMs);
      return ok(rows[0] ?? null);
    } catch (cause) {
      return err(toStorageError('Failed to get evaluation result by attemptId', cause));
    }
  }

  async recordMicroDrillHistory(
    record: MicroDrillHistoryRecord,
  ): Promise<Result<MicroDrillHistoryRecord, StorageError>> {
    try {
      const id =
        record.id !== undefined
          ? await this.db.microDrillHistory.put(record)
          : await this.db.microDrillHistory.add(record);
      return ok({ ...record, id });
    } catch (cause) {
      return err(toStorageError('Failed to record micro-drill history', cause));
    }
  }

  async listMicroDrillHistory(filter?: {
    readonly examId?: SupportedExamId;
    readonly drillId?: string;
    readonly limit?: number;
  }): Promise<Result<readonly MicroDrillHistoryRecord[], StorageError>> {
    try {
      let rows: MicroDrillHistoryRecord[];
      if (filter?.drillId) {
        rows = await this.db.microDrillHistory
          .where('drillId')
          .equals(filter.drillId)
          .toArray();
      } else if (filter?.examId) {
        rows = await this.db.microDrillHistory
          .where('examId')
          .equals(filter.examId)
          .toArray();
      } else {
        rows = await this.db.microDrillHistory.toArray();
      }

      const filtered = rows.filter((row) => {
        if (filter?.examId && row.examId !== filter.examId) return false;
        if (filter?.drillId && row.drillId !== filter.drillId) return false;
        return true;
      });
      filtered.sort((a, b) => b.completedAtMs - a.completedAtMs);

      const limited =
        filter?.limit !== undefined && filter.limit >= 0
          ? filtered.slice(0, filter.limit)
          : filtered;
      return ok(limited);
    } catch (cause) {
      return err(toStorageError('Failed to list micro-drill history', cause));
    }
  }

  async getUserProfile(): Promise<Result<UserProfileRecord | null, StorageError>> {
    try {
      const pref = await this.db.localPreferences.get(PREF_KEY_USER_PROFILE);
      return ok((pref?.value as UserProfileRecord | undefined) ?? null);
    } catch (cause) {
      return err(toStorageError('Failed to read user profile', cause));
    }
  }

  async saveUserProfile(profile: UserProfileRecord): Promise<Result<void, StorageError>> {
    try {
      await this.db.localPreferences.put({
        key: PREF_KEY_USER_PROFILE,
        value: profile,
        updatedAtMs: profile.updatedAtMs,
      });
      return ok(undefined);
    } catch (cause) {
      return err(toStorageError('Failed to save user profile', cause));
    }
  }

  async getAppearance(): Promise<Result<AppearanceSettingsRecord | null, StorageError>> {
    try {
      const pref = await this.db.localPreferences.get(PREF_KEY_APPEARANCE);
      return ok((pref?.value as AppearanceSettingsRecord | undefined) ?? null);
    } catch (cause) {
      return err(toStorageError('Failed to read appearance settings', cause));
    }
  }

  async saveAppearance(
    settings: AppearanceSettingsRecord,
  ): Promise<Result<void, StorageError>> {
    try {
      await this.db.localPreferences.put({
        key: PREF_KEY_APPEARANCE,
        value: settings,
        updatedAtMs: settings.updatedAtMs,
      });
      return ok(undefined);
    } catch (cause) {
      return err(toStorageError('Failed to save appearance settings', cause));
    }
  }

  async getSplitPaneRatio(viewKey: string): Promise<Result<number | null, StorageError>> {
    try {
      const pref = await this.db.localPreferences.get(`${PREF_PREFIX_SPLIT_PANE}${viewKey}`);
      if (!pref) return ok(null);
      if (typeof pref.value === 'number') return ok(pref.value);
      if (
        typeof pref.value === 'object' &&
        pref.value !== null &&
        typeof (pref.value as { ratio?: unknown }).ratio === 'number'
      ) {
        return ok((pref.value as { ratio: number }).ratio);
      }
      return ok(null);
    } catch (cause) {
      return err(toStorageError('Failed to read split-pane ratio', cause));
    }
  }

  async saveSplitPaneRatio(viewKey: string, ratio: number): Promise<Result<void, StorageError>> {
    try {
      await this.db.localPreferences.put({
        key: `${PREF_PREFIX_SPLIT_PANE}${viewKey}`,
        value: { ratio },
        updatedAtMs: this.clock.nowMs(),
      });
      return ok(undefined);
    } catch (cause) {
      return err(toStorageError('Failed to save split-pane ratio', cause));
    }
  }

  async getMockSession(mockId: string): Promise<Result<MockSessionRecord | null, StorageError>> {
    try {
      const pref = await this.db.localPreferences.get(`${PREF_PREFIX_MOCK_SESSION}${mockId}`);
      return ok((pref?.value as MockSessionRecord | undefined) ?? null);
    } catch (cause) {
      return err(toStorageError('Failed to read mock session', cause));
    }
  }

  async saveMockSession(session: MockSessionRecord): Promise<Result<void, StorageError>> {
    try {
      await this.db.localPreferences.put({
        key: `${PREF_PREFIX_MOCK_SESSION}${session.mockId}`,
        value: session,
        updatedAtMs: session.updatedAtMs,
      });
      return ok(undefined);
    } catch (cause) {
      return err(toStorageError('Failed to save mock session', cause));
    }
  }

  async getDailyStudyLog(
    serialDay: SerialDay,
  ): Promise<Result<DailyStudyLogRecord | null, StorageError>> {
    try {
      const pref = await this.db.localPreferences.get(`${PREF_PREFIX_DAILY_STUDY}${serialDay}`);
      return ok((pref?.value as DailyStudyLogRecord | undefined) ?? null);
    } catch (cause) {
      return err(toStorageError('Failed to read daily study log', cause));
    }
  }

  async listRecentDailyStudyLogs(
    limit: number = 30,
  ): Promise<Result<readonly DailyStudyLogRecord[], StorageError>> {
    try {
      const rows = await this.db.localPreferences
        .where('key')
        .startsWith(PREF_PREFIX_DAILY_STUDY)
        .toArray();
      const logs = rows
        .map((row) => row.value as DailyStudyLogRecord)
        .sort((a, b) => b.serialDay - a.serialDay);
      return ok(limit >= 0 ? logs.slice(0, limit) : logs);
    } catch (cause) {
      return err(toStorageError('Failed to list daily study logs', cause));
    }
  }

  async incrementDailyStudyLog(input: {
    readonly serialDay: SerialDay;
    readonly addSeconds: number;
    readonly addCompletedItems: number;
  }): Promise<Result<DailyStudyLogRecord, StorageError>> {
    try {
      const prefKey = `${PREF_PREFIX_DAILY_STUDY}${input.serialDay}`;
      const updated = await this.db.transaction('rw', this.db.localPreferences, async () => {
        const existing = await this.db.localPreferences.get(prefKey);
        const prev = existing?.value as DailyStudyLogRecord | undefined;
        const nextRecord: DailyStudyLogRecord = {
          serialDay: input.serialDay,
          studySeconds:
            Math.max(0, (prev?.studySeconds ?? 0) + Math.max(0, Math.trunc(input.addSeconds))),
          completedItems:
            Math.max(
              0,
              (prev?.completedItems ?? 0) + Math.max(0, Math.trunc(input.addCompletedItems)),
            ),
          updatedAtMs: this.clock.nowMs(),
        };
        await this.db.localPreferences.put({
          key: prefKey,
          value: nextRecord,
          updatedAtMs: nextRecord.updatedAtMs,
        });
        return nextRecord;
      });
      return ok(updated);
    } catch (cause) {
      return err(toStorageError('Failed to increment daily study log', cause));
    }
  }

  async getDiagnosticSession(
    diagId: string,
  ): Promise<Result<DiagnosticSessionRecord | null, StorageError>> {
    try {
      const row = (await this.db.diagnosticSessions.get(diagId)) ?? null;
      return ok(row);
    } catch (cause) {
      return err(toStorageError('Failed to read diagnostic session', cause));
    }
  }

  async getLatestDiagnosticSession(
    examId?: SupportedExamId,
  ): Promise<Result<DiagnosticSessionRecord | null, StorageError>> {
    try {
      const rows = examId
        ? await this.db.diagnosticSessions.where('examId').equals(examId).toArray()
        : await this.db.diagnosticSessions.toArray();
      if (rows.length === 0) return ok(null);
      rows.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      return ok(rows[0] ?? null);
    } catch (cause) {
      return err(toStorageError('Failed to read latest diagnostic session', cause));
    }
  }

  async saveDiagnosticSession(
    session: DiagnosticSessionRecord,
  ): Promise<Result<void, StorageError>> {
    try {
      await this.db.diagnosticSessions.put(session);
      return ok(undefined);
    } catch (cause) {
      return err(toStorageError('Failed to save diagnostic session', cause));
    }
  }

  async exportStudyDataJson(): Promise<Result<StudyDataExportPayload, StorageError>> {
    try {
      const [profileRes, attempts, vocabCards, vocabReviewLogs, studyLogsRes, diagnosticSessions] =
        await Promise.all([
          this.getUserProfile(),
          this.db.completedAttempts.toArray(),
          this.db.vocabCards.toArray(),
          this.db.vocabReviewLogs.toArray(),
          this.listRecentDailyStudyLogs(10_000),
          this.db.diagnosticSessions.toArray(),
        ]);

      if (!profileRes.ok) return profileRes;
      if (!studyLogsRes.ok) return studyLogsRes;

      attempts.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      vocabReviewLogs.sort((a, b) => b.reviewedAtMs - a.reviewedAtMs);

      return ok({
        schemaVersion: 1,
        exportedAtMs: this.clock.nowMs(),
        profiles: profileRes.value ? [profileRes.value] : [],
        attempts,
        vocabCards,
        vocabReviewLogs,
        studyLogs: studyLogsRes.value,
        diagnosticSessions,
      });
    } catch (cause) {
      return err(toStorageError('Failed to export study data', cause));
    }
  }

  async wipeAllData(): Promise<Result<void, StorageError>> {
    try {
      await this.db.transaction('rw', this.db.tables, async () => {
        for (const table of this.db.tables) {
          await table.clear();
        }
      });

      const storage = this.getStorage();
      if (storage) {
        const urgentKeys: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key?.startsWith(URGENT_DRAFT_STORAGE_PREFIX)) {
            urgentKeys.push(key);
          }
        }
        for (const key of urgentKeys) {
          storage.removeItem(key);
        }
      }

      return ok(undefined);
    } catch (cause) {
      return err(toStorageError('Failed to wipe all offline data', cause));
    }
  }

  // --- IVocabSrsStore ---

  private async joinCardsWithSrs(
    cards: readonly VocabCardRecord[],
    fallbackSerialDay?: SerialDay,
  ): Promise<VocabCardWithSrs[]> {
    if (cards.length === 0) return [];
    const cardIds = cards.map((c) => c.cardId);
    const srsRows = await this.db.vocabSrsStates.bulkGet(cardIds);
    const defaultDay = fallbackSerialDay ?? this.clock.todaySerialDay();

    const joined: VocabCardWithSrs[] = [];
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card) continue;
      const existingSrs = srsRows[i];
      const srs: VocabSrsStateRecord = existingSrs ?? {
        cardId: card.cardId,
        repetitions: 0,
        intervalDays: 0,
        easeFactorMilli: DEFAULT_EASE_FACTOR_MILLI,
        dueSerialDay: defaultDay,
        state: 'new',
        updatedAtMs: card.updatedAtMs,
      };
      joined.push({ card, srs });
    }
    return joined;
  }

  async getDueCards(
    todaySerialDay: SerialDay,
    limit: number = 200,
  ): Promise<Result<readonly VocabCardWithSrs[], StorageError>> {
    try {
      const dueStates = await this.db.vocabSrsStates
        .where('dueSerialDay')
        .belowOrEqual(todaySerialDay)
        .sortBy('dueSerialDay');
      const slicedStates = limit >= 0 ? dueStates.slice(0, limit) : dueStates;
      if (slicedStates.length === 0) return ok([]);

      const cards = await this.db.vocabCards.bulkGet(slicedStates.map((s) => s.cardId));
      const result: VocabCardWithSrs[] = [];
      for (let i = 0; i < slicedStates.length; i++) {
        const srs = slicedStates[i];
        const card = cards[i];
        if (srs && card) {
          result.push({ card, srs });
        }
      }
      return ok(result);
    } catch (cause) {
      return err(toStorageError('Failed to query due vocab cards', cause));
    }
  }

  async getAllCards(
    filter?: VocabCardFilter,
  ): Promise<Result<readonly VocabCardWithSrs[], StorageError>> {
    try {
      let cards: VocabCardRecord[];
      if (filter?.tag) {
        cards = await this.db.vocabCards.where('tags').equals(filter.tag).toArray();
      } else if (filter?.examId) {
        cards = await this.db.vocabCards.where('examId').equals(filter.examId).toArray();
      } else if (filter?.topicTag) {
        cards = await this.db.vocabCards.where('topicTag').equals(filter.topicTag).toArray();
      } else if (filter?.sourceKind) {
        cards = await this.db.vocabCards.where('sourceKind').equals(filter.sourceKind).toArray();
      } else {
        cards = await this.db.vocabCards.toArray();
      }

      const query = filter?.searchQuery?.trim().toLowerCase();
      const filtered = cards.filter((card) => {
        if (filter?.examId && card.examId !== filter.examId) return false;
        if (filter?.sourceKind && card.sourceKind !== filter.sourceKind) return false;
        if (filter?.topicTag && card.topicTag !== filter.topicTag) return false;
        if (filter?.tag && !card.tags.includes(filter.tag)) return false;
        if (query && query.length > 0) {
          const matchesHeadword = card.headword.toLowerCase().includes(query);
          const matchesDefinition = card.definition.toLowerCase().includes(query);
          const matchesGlossFa = card.glossFa?.toLowerCase().includes(query) ?? false;
          const matchesContext = card.contextSentence?.toLowerCase().includes(query) ?? false;
          if (!matchesHeadword && !matchesDefinition && !matchesGlossFa && !matchesContext) {
            return false;
          }
        }
        return true;
      });

      filtered.sort((a, b) => a.headword.localeCompare(b.headword));
      return ok(await this.joinCardsWithSrs(filtered));
    } catch (cause) {
      return err(toStorageError('Failed to list vocab cards', cause));
    }
  }

  async getAheadCards(
    limit: number = 200,
    todaySerialDay?: SerialDay,
  ): Promise<Result<readonly VocabCardWithSrs[], StorageError>> {
    try {
      const states =
        todaySerialDay !== undefined
          ? await this.db.vocabSrsStates
              .where('dueSerialDay')
              .above(todaySerialDay)
              .sortBy('dueSerialDay')
          : await this.db.vocabSrsStates.orderBy('dueSerialDay').toArray();

      const sliced = limit >= 0 ? states.slice(0, limit) : states;
      if (sliced.length === 0) return ok([]);

      const cards = await this.db.vocabCards.bulkGet(sliced.map((s) => s.cardId));
      const result: VocabCardWithSrs[] = [];
      for (let i = 0; i < sliced.length; i++) {
        const srs = sliced[i];
        const card = cards[i];
        if (srs && card) {
          result.push({ card, srs });
        }
      }
      return ok(result);
    } catch (cause) {
      return err(toStorageError('Failed to query ahead vocab cards', cause));
    }
  }

  async recordReview(
    input: RecordVocabReviewInput,
  ): Promise<Result<VocabSrsStateRecord, StorageError>> {
    const quality = mapVocabRatingToQuality(input.rating);
    if (!quality) {
      return err({
        kind: 'storage',
        message: `Unsupported vocab review rating: ${String(input.rating)}`,
        code: 'CORRUPT_DATA',
      });
    }

    try {
      const outcome = await this.db.transaction(
        'rw',
        this.db.vocabCards,
        this.db.vocabSrsStates,
        this.db.vocabReviewLogs,
        async (): Promise<Result<VocabSrsStateRecord, StorageError>> => {
          const card = await this.db.vocabCards.get(input.cardId);
          if (!card) {
            return err({
              kind: 'storage',
              message: `Vocab card not found: ${input.cardId}`,
              code: 'NOT_FOUND',
            });
          }

          const existingSrs = await this.db.vocabSrsStates.get(input.cardId);
          const current: SrsCardState = existingSrs
            ? {
                repetitions: existingSrs.repetitions,
                intervalDays: existingSrs.intervalDays,
                easeFactorMilli: existingSrs.easeFactorMilli,
                dueDay: existingSrs.dueSerialDay,
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

          await this.db.vocabSrsStates.put(nextSrs);
          await this.db.vocabReviewLogs.add({
            logId: createUuid(),
            cardId: input.cardId,
            rating: input.rating,
            reviewedDaySerial: input.todaySerialDay,
            reviewedAtMs: input.nowMs,
            syncStatus: 'pending',
          });

          return ok(nextSrs);
        },
      );
      return outcome;
    } catch (cause) {
      return err(toStorageError('Failed to record vocab review', cause));
    }
  }

  async listVocabReviewLogs(filter?: {
    readonly cardId?: string;
    readonly limit?: number;
  }): Promise<Result<readonly VocabReviewLogRecord[], StorageError>> {
    try {
      const rows = filter?.cardId
        ? await this.db.vocabReviewLogs.where('cardId').equals(filter.cardId).toArray()
        : await this.db.vocabReviewLogs.toArray();
      rows.sort((a, b) => b.reviewedAtMs - a.reviewedAtMs || (b.id ?? 0) - (a.id ?? 0));
      const limited =
        filter?.limit !== undefined && filter.limit >= 0 ? rows.slice(0, filter.limit) : rows;
      return ok(limited);
    } catch (cause) {
      return err(toStorageError('Failed to list vocab review logs', cause));
    }
  }

  async upsertMistakeCard(
    card: VocabCardRecord,
  ): Promise<Result<VocabCardWithSrs, StorageError>> {
    try {
      const result = await this.db.transaction(
        'rw',
        this.db.vocabCards,
        this.db.vocabSrsStates,
        async (): Promise<VocabCardWithSrs> => {
          await this.db.vocabCards.put(card);
          let srs = await this.db.vocabSrsStates.get(card.cardId);
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
            await this.db.vocabSrsStates.put(srs);
          }
          return { card, srs };
        },
      );
      return ok(result);
    } catch (cause) {
      return err(toStorageError('Failed to upsert mistake card', cause));
    }
  }

  async upsertSeededDeckPreservingSrs(
    cards: readonly VocabCardRecord[],
  ): Promise<Result<SeedDeckUpsertSummary, StorageError>> {
    if (cards.length === 0) {
      return ok({ insertedCount: 0, updatedCount: 0 });
    }

    try {
      const summary = await this.db.transaction(
        'rw',
        this.db.vocabCards,
        this.db.vocabSrsStates,
        async (): Promise<SeedDeckUpsertSummary> => {
          const cardById = new Map<string, VocabCardRecord>();
          for (const card of cards) {
            cardById.set(card.cardId, card);
          }
          const dedupedCards = Array.from(cardById.values());
          const cardIds = dedupedCards.map((c) => c.cardId);
          const [existingCards, existingSrsStates] = await Promise.all([
            this.db.vocabCards.bulkGet(cardIds),
            this.db.vocabSrsStates.bulkGet(cardIds),
          ]);

          let insertedCount = 0;
          let updatedCount = 0;
          const initialDay = this.clock.todaySerialDay();
          const missingSrsToInsert: VocabSrsStateRecord[] = [];
          const seenSrsCardIds = new Set<string>();

          for (let i = 0; i < dedupedCards.length; i++) {
            const card = dedupedCards[i];
            if (!card) continue;
            if (existingCards[i]) {
              updatedCount++;
            } else {
              insertedCount++;
            }

            if (!existingSrsStates[i] && !seenSrsCardIds.has(card.cardId)) {
              seenSrsCardIds.add(card.cardId);
              const initial = createInitialSrsCardState(initialDay);
              missingSrsToInsert.push({
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

          await this.db.vocabCards.bulkPut(dedupedCards);
          if (missingSrsToInsert.length > 0) {
            await this.db.vocabSrsStates.bulkAdd(missingSrsToInsert);
          }

          return { insertedCount, updatedCount };
        },
      );
      return ok(summary);
    } catch (cause) {
      return err(toStorageError('Failed to upsert seeded vocab deck', cause));
    }
  }
}

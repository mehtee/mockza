import type { ThemePresetId } from '@mockza/design-tokens';
import type {
  CatalogTrackSchema,
  EvaluationOutputSchema,
  MicroDrillItemSchema,
  MicroDrillSchema,
} from '@mockza/contracts';
import type {
  AppEditionCode,
  DiagnosticMode,
  ExamModuleType,
  SerialDay,
  SkillKind,
  SupportedExamId,
  SupportedWritingTaskType,
} from '@mockza/domain';
import type {
  EntitlementRequiredError,
  NetworkError,
  QuotaExceededError,
  Result,
  StorageError,
  UnauthorizedError,
  UnexpectedError,
  ValidationError,
} from './result';

export type CatalogTrack = (typeof CatalogTrackSchema)['_output'];
export type EvaluationOutputDto = (typeof EvaluationOutputSchema)['_output'];
export type MicroDrillItemDto = (typeof MicroDrillItemSchema)['_output'];
export type MicroDrillDto = (typeof MicroDrillSchema)['_output'];

export type AppearanceThemeMode = 'dark' | 'light' | 'system';
export type AppearancePresetId = ThemePresetId;

export interface UserProfileRecord {
  readonly deviceId: string;
  readonly examId: SupportedExamId;
  readonly examModule: ExamModuleType;
  readonly studyFocus?: 'exams' | 'coach' | 'both';
  readonly targetBand: number;
  readonly targetDateSerial: SerialDay | null;
  readonly onboardingCompleted: boolean;
  readonly freeDiagnosticUsed: boolean;
  readonly linkedEmail: string | null;
  readonly appUserId: string | null;
  readonly isPro: boolean;
  readonly updatedAtMs: number;
}

export interface AppearanceSettingsRecord {
  readonly themeModeKey: AppearanceThemeMode;
  readonly presetId: AppearancePresetId;
  readonly updatedAtMs: number;
}

export interface MockSessionRecord {
  readonly mockId: string;
  readonly track: SupportedExamId;
  readonly startedAtUtcMs: number;
  readonly examMode: 'exam' | 'study';
  readonly stageAttemptIds: Readonly<Record<string, string>>;
  readonly updatedAtMs: number;
}

export interface DailyStudyLogRecord {
  readonly serialDay: SerialDay;
  readonly studySeconds: number;
  readonly completedItems: number;
  readonly updatedAtMs: number;
}

export interface CatalogPackRecord {
  readonly packId: string;
  readonly edition: AppEditionCode;
  readonly examId: SupportedExamId;
  readonly track: CatalogTrack;
  readonly skill: SkillKind | 'fullMock';
  readonly title: string;
  readonly description: string;
  readonly durationSeconds: number;
  readonly questionCount: number;
  readonly accent: string | null;
  readonly mediaUrl: string | null;
  readonly downloadUrl?: string;
  readonly version: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly isFreeSample: boolean;
  readonly isCachedOffline: 0 | 1;
  readonly bundleJson: string | null;
  readonly cachedMediaInline: Readonly<Record<string, string>> | null;
  readonly sizeBytes: number;
  readonly cachedAtMs: number | null;
  readonly updatedAtMs: number;
  readonly kind?: 'pack' | 'drill';
}

export interface CachedDrillRecord {
  readonly drillId: string;
  readonly title: string;
  readonly drillType: string;
  readonly skill: SkillKind;
  readonly durationSeconds: number;
  readonly itemsJson: string;
  readonly updatedAtMs: number;
}

export interface AttemptDraftRecord {
  readonly packId: string;
  readonly skill: SkillKind;
  readonly attemptId: string;
  readonly examId: SupportedExamId;
  readonly taskType: SupportedWritingTaskType | string;
  readonly draftText: string;
  readonly wordCount: number;
  readonly answersJson: Readonly<Record<string, unknown>>;
  readonly flaggedQuestionIds: readonly string[];
  readonly currentQuestionIndex: number;
  readonly timerRemainingSec: number;
  readonly usedStudyMode: boolean;
  readonly mockSessionId: string | null;
  readonly mockStageKey: string | null;
  readonly updatedAtMs: number;
}

export function isResumableStandaloneDraft(
  draft: AttemptDraftRecord,
  examId: SupportedExamId,
): boolean {
  return (
    draft.examId === examId &&
    draft.mockSessionId == null &&
    (draft.skill === 'reading' || draft.skill === 'writing' ||
      (draft.skill === 'listening' && draft.usedStudyMode)) &&
    (draft.usedStudyMode || draft.timerRemainingSec > 0) &&
    (draft.draftText.trim() !== '' ||
      Object.values(draft.answersJson).some(
        (answer) => typeof answer === 'string' && answer.trim() !== '',
      ) ||
      draft.flaggedQuestionIds.length > 0)
  );
}

export type AttemptStatus =
  | 'in_progress'
  | 'submitted_local'
  | 'uploading_audio'
  | 'queued_remote'
  | 'completed'
  | 'failed_retryable';

export interface CompletedAttemptRecord {
  readonly attemptId: string;
  readonly examId: SupportedExamId;
  readonly packId: string;
  readonly skill: SkillKind;
  readonly status: AttemptStatus;
  readonly syncStatus: 'synced' | 'pending' | 'failed';
  readonly remoteJobId: string | null;
  readonly submissionJson: string;
  readonly evaluationJson: string | null;
  readonly overallBand: number | null;
  readonly errorCode: string | null;
  readonly startedAtUtcMs: number | null;
  readonly completedAtMs: number;
  readonly durationSeconds: number;
  readonly usedStudyMode: boolean;
  readonly questionCount: number;
  readonly isCalibratedFullPack: boolean;
  readonly contentVersion: string | null;
  readonly mockSessionId: string | null;
  readonly mockStageKey: string | null;
  readonly updatedAtMs: number;
}

export type AnnotationColorCode = 'yellow' | 'mint' | 'coral' | 'green' | 'pink';

export interface PassageAnnotationRecord {
  readonly annotationId: string;
  readonly packId: string;
  readonly passageIndex: number;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly colorCode: AnnotationColorCode;
  readonly noteText: string | null;
  readonly isDeleted: 0 | 1;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export interface EvaluationResultRecord {
  readonly id: string;
  readonly attemptId: string;
  readonly submissionId: string;
  readonly examId: SupportedExamId;
  readonly skill: SkillKind;
  readonly overallBand: number;
  readonly resultJson: EvaluationOutputDto;
  readonly createdAtMs: number;
}

export type DiagnosticStage =
  | 'intro'
  | 'reading'
  | 'listening'
  | 'writing'
  | 'speaking'
  | 'results';

export type DiagnosticSessionStatus = 'in_progress' | 'submitted' | 'completed' | 'abandoned';

export interface DiagnosticSessionRecord {
  readonly diagId: string;
  readonly examId: SupportedExamId;
  readonly mode: DiagnosticMode;
  readonly policyVersion: string;
  readonly contentVersion: string;
  readonly selectionSeed: string;
  readonly startedAtUtcMs: number;
  readonly collectionDeadlineUtcMs: number;
  readonly resultsDeadlineUtcMs: number;
  readonly currentStage: DiagnosticStage;
  readonly status: DiagnosticSessionStatus;
  readonly stateJson: string;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export interface VocabCardRecord {
  readonly cardId: string;
  readonly examId: SupportedExamId;
  readonly headword: string;
  readonly ipa: string | null;
  readonly definition: string;
  readonly glossFa: string | null;
  readonly topicTag: string;
  readonly sourceKind: 'seeded' | 'mistake_to_deck' | 'register_shifter' | 'drop_anything';
  readonly tags: readonly string[];
  readonly contextSentence: string | null;
  readonly paraphraseHints: readonly string[];
  readonly usageNote: string | null;
  readonly sourceSkill: SkillKind | null;
  readonly sourceAttemptId: string | null;
  readonly sourceRefLabel: string | null;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export type VocabSrsLearningState = 'new' | 'learning' | 'mastered';

export interface VocabSrsStateRecord {
  readonly cardId: string;
  readonly repetitions: number;
  readonly intervalDays: number;
  readonly easeFactorMilli: number;
  readonly dueSerialDay: SerialDay;
  readonly state: VocabSrsLearningState;
  readonly updatedAtMs: number;
}

export type VocabReviewRating = 0 | 1 | 2 | 3;

export interface VocabReviewLogRecord {
  readonly id?: number;
  readonly logId: string;
  readonly cardId: string;
  readonly rating: VocabReviewRating;
  readonly reviewedDaySerial: SerialDay;
  readonly reviewedAtMs: number;
  readonly syncStatus: 'synced' | 'pending';
}

export interface MicroDrillHistoryRecord {
  readonly id?: number;
  readonly drillId: string;
  readonly examId: SupportedExamId;
  readonly drillType: string;
  readonly skill: SkillKind;
  readonly correctCount: number;
  readonly totalCount: number;
  readonly durationSeconds: number;
  readonly completedAtMs: number;
}

export type SyncOutboxActionType =
  | 'evaluate_writing'
  | 'evaluate_speaking'
  | 'flag_question'
  | 'sync_log'
  | 'mission.complete'
  | 'shifter.repeat_check'
  | 'drop.drill_complete';

export type SyncOutboxEntityKind =
  | 'attempt'
  | 'flag'
  | 'vocab_log'
  | 'daily_mission'
  | 'register_shifter'
  | 'dropped_content';

export interface LinguisticNodeRecord {
  readonly nodeId: string;
  readonly edition: AppEditionCode;
  readonly nodeKind: 'bottleneck' | 'target_structure' | 'interest_topic';
  readonly canonicalKey: string;
  readonly displayLabelEn: string;
  readonly displayLabelFa: string | null;
  readonly masteryScoreMilli: number;
  readonly signalWeightMilli: number;
  readonly evidenceCount: number;
  readonly lastSeenDaySerial: number;
  readonly lastExampleEn: string | null;
  readonly coachNoteEn: string | null;
  readonly coachNoteFa: string | null;
  readonly isPinned: boolean;
  readonly isMuted: boolean;
  readonly updatedAtMs: number;
}

export interface DailyMissionRecord {
  readonly missionId: string;
  readonly missionDaySerial: number;
  readonly edition: AppEditionCode;
  readonly examTrack: SupportedExamId;
  readonly status: 'ready' | 'in_progress' | 'completed' | 'skipped';
  readonly focusTopic: string;
  readonly payloadJson: string;
  readonly resultJson: string | null;
  readonly updatedAtMs: number;
}

export interface DroppedContentRecord {
  readonly dropId: string;
  readonly inputKind: 'text_url' | 'text' | 'image' | 'audio';
  readonly edition: AppEditionCode;
  readonly title: string;
  readonly sourceLabel: string;
  readonly cefrEstimate: string;
  readonly extractedPhrasesJson: string;
  readonly drillPayloadJson: string;
  readonly completedAtMs: number | null;
  readonly createdAtMs: number;
}

export interface SyncOutboxItem {
  readonly seq?: number;
  readonly idempotencyKey: string;
  readonly actionType: SyncOutboxActionType;
  readonly entityKind: SyncOutboxEntityKind;
  readonly payloadJson: string;
  readonly retryCount: number;
  readonly nextRetryAtMs: number;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

export type MediaCacheKind = 'pack_audio' | 'pack_svg' | 'user_recording';
export type MediaStorageBackend = 'opfs' | 'cache' | 'idb_fallback';

export interface MediaCacheIndexRecord {
  readonly mediaKey: string;
  readonly kind: MediaCacheKind;
  readonly storageBackend: MediaStorageBackend;
  readonly mimeType: string;
  readonly sha256: string;
  readonly byteSize: number;
  readonly attemptId: string | null;
  readonly partIndex: number | null;
  readonly durationMs: number | null;
  readonly remoteObjectKey: string | null;
  readonly lastAccessedMs: number;
  readonly createdAtMs: number;
  readonly expiresAtMs: number | null;
}

export type DeviceMetaKey =
  | 'deviceInstallId'
  | 'deviceSecret'
  | 'pendingErasureReceipt'
  | 'lastUserId';

export interface DeviceMetaRecord {
  readonly key: DeviceMetaKey;
  readonly value: string;
  readonly updatedAtMs: number;
}

export interface AttemptListFilter {
  readonly examId?: SupportedExamId;
  readonly skill?: SkillKind;
  readonly mockSessionId?: string;
}

export interface StudyDataExportPayload {
  readonly schemaVersion: 1;
  readonly exportedAtMs: number;
  readonly profiles: readonly UserProfileRecord[];
  readonly attempts: readonly CompletedAttemptRecord[];
  readonly vocabCards: readonly VocabCardRecord[];
  readonly vocabReviewLogs: readonly VocabReviewLogRecord[];
  readonly studyLogs: readonly DailyStudyLogRecord[];
  readonly diagnosticSessions: readonly DiagnosticSessionRecord[];
}

export interface IOfflineAttemptStore {
  saveAttemptDraft(draft: AttemptDraftRecord): Promise<Result<void, StorageError>>;
  flushUrgentDraftSync(draft: AttemptDraftRecord): void;
  getActiveDraft(
    packId: string,
    skill: SkillKind,
  ): Promise<Result<AttemptDraftRecord | null, StorageError>>;
  getLatestResumableDraft(
    examId: SupportedExamId,
  ): Promise<Result<AttemptDraftRecord | null, StorageError>>;
  deleteDraft(attemptId: string): Promise<Result<void, StorageError>>;
  completeObjectiveAttempt(record: CompletedAttemptRecord): Promise<Result<void, StorageError>>;
  saveAttemptRecord(record: CompletedAttemptRecord): Promise<Result<void, StorageError>>;
  getAttemptById(
    attemptId: string,
  ): Promise<Result<CompletedAttemptRecord | null, StorageError>>;
  listCompletedAttempts(
    filter?: AttemptListFilter,
  ): Promise<Result<readonly CompletedAttemptRecord[], StorageError>>;
  savePassageAnnotations(
    packId: string,
    spans: readonly PassageAnnotationRecord[],
  ): Promise<Result<void, StorageError>>;
  getPassageAnnotations(
    packId: string,
  ): Promise<Result<readonly PassageAnnotationRecord[], StorageError>>;
  saveEvaluationResult(record: EvaluationResultRecord): Promise<Result<void, StorageError>>;
  getEvaluationResultById(id: string): Promise<Result<EvaluationResultRecord | null, StorageError>>;
  getEvaluationResultByAttemptId(
    attemptId: string,
  ): Promise<Result<EvaluationResultRecord | null, StorageError>>;
  recordMicroDrillHistory(
    record: MicroDrillHistoryRecord,
  ): Promise<Result<MicroDrillHistoryRecord, StorageError>>;
  listMicroDrillHistory(filter?: {
    readonly examId?: SupportedExamId;
    readonly drillId?: string;
    readonly limit?: number;
  }): Promise<Result<readonly MicroDrillHistoryRecord[], StorageError>>;
  getUserProfile(): Promise<Result<UserProfileRecord | null, StorageError>>;
  saveUserProfile(profile: UserProfileRecord): Promise<Result<void, StorageError>>;
  getAppearance(): Promise<Result<AppearanceSettingsRecord | null, StorageError>>;
  saveAppearance(settings: AppearanceSettingsRecord): Promise<Result<void, StorageError>>;
  getSplitPaneRatio(viewKey: string): Promise<Result<number | null, StorageError>>;
  saveSplitPaneRatio(viewKey: string, ratio: number): Promise<Result<void, StorageError>>;
  getMockSession(mockId: string): Promise<Result<MockSessionRecord | null, StorageError>>;
  saveMockSession(session: MockSessionRecord): Promise<Result<void, StorageError>>;
  getDailyStudyLog(serialDay: SerialDay): Promise<Result<DailyStudyLogRecord | null, StorageError>>;
  listRecentDailyStudyLogs(
    limit?: number,
  ): Promise<Result<readonly DailyStudyLogRecord[], StorageError>>;
  incrementDailyStudyLog(input: {
    readonly serialDay: SerialDay;
    readonly addSeconds: number;
    readonly addCompletedItems: number;
  }): Promise<Result<DailyStudyLogRecord, StorageError>>;
  getDiagnosticSession(diagId: string): Promise<Result<DiagnosticSessionRecord | null, StorageError>>;
  getLatestDiagnosticSession(
    examId?: SupportedExamId,
  ): Promise<Result<DiagnosticSessionRecord | null, StorageError>>;
  saveDiagnosticSession(session: DiagnosticSessionRecord): Promise<Result<void, StorageError>>;
  exportStudyDataJson(): Promise<Result<StudyDataExportPayload, StorageError>>;
  wipeAllData(): Promise<Result<void, StorageError>>;
}

export interface OutboxMutationInput {
  readonly idempotencyKey: string;
  readonly actionType: SyncOutboxActionType;
  readonly entityKind: SyncOutboxEntityKind;
  readonly payloadJson: string;
  readonly nextRetryAtMs?: number;
}

export interface SyncFlushReport {
  readonly processedCount: number;
  readonly succeededCount: number;
  readonly failedRetryableCount: number;
  readonly stoppedReason?:
    | 'offline'
    | 'already_flushing'
    | 'quota_exceeded'
    | 'entitlement_required'
    | 'unauthorized'
    | 'validation';
}

export type SyncOutboxError =
  | StorageError
  | NetworkError
  | UnauthorizedError
  | QuotaExceededError
  | EntitlementRequiredError
  | ValidationError
  | UnexpectedError;

export interface ISyncOutboxGateway {
  enqueue(mutation: OutboxMutationInput): Promise<Result<SyncOutboxItem, StorageError>>;
  flushPending(): Promise<Result<SyncFlushReport, SyncOutboxError>>;
  observePendingCount(listener: (count: number) => void): () => void;
  purgeExpiredAudio(nowMs?: number): Promise<Result<number, StorageError>>;
}

export interface VocabCardWithSrs {
  readonly card: VocabCardRecord;
  readonly srs: VocabSrsStateRecord;
}

export interface VocabCardFilter {
  readonly examId?: SupportedExamId;
  readonly sourceKind?: 'seeded' | 'mistake_to_deck' | 'register_shifter' | 'drop_anything';
  readonly topicTag?: string;
  readonly tag?: string;
  readonly searchQuery?: string;
}

export interface RecordVocabReviewInput {
  readonly cardId: string;
  readonly rating: VocabReviewRating;
  readonly todaySerialDay: SerialDay;
  readonly nowMs: number;
}

export interface SeedDeckUpsertSummary {
  readonly insertedCount: number;
  readonly updatedCount: number;
}

export interface IVocabSrsStore {
  getDueCards(
    todaySerialDay: SerialDay,
    limit?: number,
  ): Promise<Result<readonly VocabCardWithSrs[], StorageError>>;
  getAllCards(filter?: VocabCardFilter): Promise<Result<readonly VocabCardWithSrs[], StorageError>>;
  getAheadCards(
    limit?: number,
    todaySerialDay?: SerialDay,
  ): Promise<Result<readonly VocabCardWithSrs[], StorageError>>;
  recordReview(input: RecordVocabReviewInput): Promise<Result<VocabSrsStateRecord, StorageError>>;
  listVocabReviewLogs(filter?: {
    readonly cardId?: string;
    readonly limit?: number;
  }): Promise<Result<readonly VocabReviewLogRecord[], StorageError>>;
  upsertMistakeCard(card: VocabCardRecord): Promise<Result<VocabCardWithSrs, StorageError>>;
  upsertSeededDeckPreservingSrs(
    cards: readonly VocabCardRecord[],
  ): Promise<Result<SeedDeckUpsertSummary, StorageError>>;
}

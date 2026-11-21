import type { SkillKind } from '@mockza/domain';
import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  AttemptDraftRecord,
  CatalogPackRecord,
  CompletedAttemptRecord,
  DailyMissionRecord,
  DeviceMetaRecord,
  DiagnosticSessionRecord,
  DroppedContentRecord,
  EvaluationResultRecord,
  LinguisticNodeRecord,
  MediaCacheIndexRecord,
  MicroDrillHistoryRecord,
  PassageAnnotationRecord,
  SyncOutboxItem,
  VocabCardRecord,
  VocabReviewLogRecord,
  VocabSrsStateRecord,
} from '@/gateways/storage.gateway';

export interface LocalPreferenceRecord {
  readonly key: string;
  readonly value: unknown;
  readonly updatedAtMs: number;
}

export const PREF_KEY_USER_PROFILE = 'userProfile' as const;
export const PREF_KEY_APPEARANCE = 'appearance' as const;
export const PREF_PREFIX_SPLIT_PANE = 'splitPane:' as const;
export const PREF_PREFIX_MOCK_SESSION = 'mockSession:' as const;
export const PREF_PREFIX_DAILY_STUDY = 'dailyStudy:' as const;
export const PREF_PREFIX_CACHED_DRILL = 'cachedDrill:' as const;

export const MOCKZA_DB_DEFAULT_NAME = 'mockza-offline-v1' as const;

export const MOCKZA_DB_TABLE_NAMES = [
  'localPreferences',
  'catalogPacks',
  'attemptDrafts',
  'completedAttempts',
  'passageAnnotations',
  'evaluationResults',
  'diagnosticSessions',
  'vocabCards',
  'vocabSrsStates',
  'vocabReviewLogs',
  'microDrillHistory',
  'syncOutbox',
  'mediaCacheIndex',
  'deviceMeta',
  'linguisticNodes',
  'dailyMissions',
  'droppedContents',
] as const;

export type MockzaDbTableName = (typeof MOCKZA_DB_TABLE_NAMES)[number];

/**
 * Dexie.js v4 offline store with exact 14 EntityTable definitions matching
 * Flutter AppDatabase parity and DESKTOP_WEB_PLAN.md Sec 9.1.
 */
export class MockzaDexieDb extends Dexie {
  declare localPreferences: EntityTable<LocalPreferenceRecord, 'key'>;
  declare catalogPacks: EntityTable<CatalogPackRecord, 'packId'>;
  declare attemptDrafts: Table<AttemptDraftRecord, [string, SkillKind]>;
  declare completedAttempts: EntityTable<CompletedAttemptRecord, 'attemptId'>;
  declare passageAnnotations: EntityTable<PassageAnnotationRecord, 'annotationId'>;
  declare evaluationResults: EntityTable<EvaluationResultRecord, 'id'>;
  declare diagnosticSessions: EntityTable<DiagnosticSessionRecord, 'diagId'>;
  declare vocabCards: EntityTable<VocabCardRecord, 'cardId'>;
  declare vocabSrsStates: EntityTable<VocabSrsStateRecord, 'cardId'>;
  declare vocabReviewLogs: EntityTable<VocabReviewLogRecord, 'id'>;
  declare microDrillHistory: EntityTable<MicroDrillHistoryRecord, 'id'>;
  declare syncOutbox: EntityTable<SyncOutboxItem, 'seq'>;
  declare mediaCacheIndex: EntityTable<MediaCacheIndexRecord, 'mediaKey'>;
  declare deviceMeta: EntityTable<DeviceMetaRecord, 'key'>;
  declare linguisticNodes: EntityTable<LinguisticNodeRecord, 'nodeId'>;
  declare dailyMissions: EntityTable<DailyMissionRecord, 'missionId'>;
  declare droppedContents: EntityTable<DroppedContentRecord, 'dropId'>;

  constructor(dbName: string = MOCKZA_DB_DEFAULT_NAME) {
    super(dbName);
    const v1Stores = {
      localPreferences: 'key',
      catalogPacks: 'packId, [examId+skill], track, version, isCachedOffline',
      attemptDrafts: '[packId+skill], attemptId, updatedAtMs',
      completedAttempts: 'attemptId, [examId+skill], completedAtMs, syncStatus, mockSessionId',
      passageAnnotations: 'annotationId, packId, [packId+passageIndex], isDeleted',
      evaluationResults: 'id, attemptId, submissionId, [examId+skill], createdAtMs',
      diagnosticSessions: 'diagId, examId, status, updatedAtMs',
      vocabCards: 'cardId, examId, topicTag, sourceKind, *tags',
      vocabSrsStates: 'cardId, dueSerialDay, state',
      vocabReviewLogs: '++id, logId, cardId, reviewedAtMs, reviewedDaySerial, syncStatus',
      microDrillHistory: '++id, drillId, examId, completedAtMs',
      syncOutbox: '++seq, idempotencyKey, actionType, entityKind, nextRetryAtMs',
      mediaCacheIndex: 'mediaKey, kind, attemptId, lastAccessedMs, createdAtMs, expiresAtMs',
      deviceMeta: 'key',
    };
    this.version(1).stores(v1Stores);
    this.version(2).stores({
      ...v1Stores,
      linguisticNodes: 'nodeId, [edition+nodeKind], canonicalKey, lastSeenDaySerial',
      dailyMissions: 'missionId, [missionDaySerial+edition], status',
      droppedContents: 'dropId, inputKind, createdAtMs, completedAtMs',
    });
  }
}

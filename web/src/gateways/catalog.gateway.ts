import type { ExamBundleResponseSchema } from '@mockza/contracts';
import type { SkillKind, SupportedExamId } from '@mockza/domain';
import type { NetworkError, Result, StorageError, UnexpectedError, ValidationError } from './result';
import type {
  CachedDrillRecord,
  CatalogPackRecord,
  MediaCacheIndexRecord,
  VocabCardRecord,
} from './storage.gateway';

export const MEDIA_CACHE_QUOTA_BYTES = 262_144_000 as const;

export type ExamBundlePayload = (typeof ExamBundleResponseSchema)['_output'];

export interface CatalogPackFilter {
  readonly examId?: SupportedExamId;
  readonly skill?: SkillKind | 'fullMock';
  readonly cachedOnly?: boolean;
  readonly freeOnly?: boolean;
}

export interface CachedMediaSourceInput {
  readonly mediaKey: string;
  readonly fallbackUrl: string;
  readonly expectedSha256?: string;
}

export interface PutUserRecordingInput {
  readonly clipId: string;
  readonly blob: Blob;
  readonly attemptId: string;
  readonly partIndex: number;
  readonly durationMs: number;
  readonly mimeType?: string;
}

export interface CachedAudioBytes {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
  readonly sha256: string;
}

export interface CacheUsageSummary {
  readonly totalBytes: number;
  readonly quotaBytes: typeof MEDIA_CACHE_QUOTA_BYTES;
  readonly packCount: number;
  readonly userRecordingBytes?: number;
}

export interface CacheEvictionResult {
  readonly evictedBytes: number;
  readonly evictedKeys: readonly string[];
}

export type CatalogGatewayError = NetworkError | StorageError | ValidationError | UnexpectedError;
export type CatalogError = CatalogGatewayError;

export interface ICatalogMediaGateway {
  syncCatalogManifest(): Promise<Result<readonly CatalogPackRecord[], CatalogGatewayError>>;
  listPacks(filter?: CatalogPackFilter): Promise<Result<readonly CatalogPackRecord[], StorageError>>;
  ensureExamBundle(packId: string): Promise<Result<ExamBundlePayload, CatalogGatewayError>>;
  downloadExamPack(packId: string): Promise<Result<CatalogPackRecord, CatalogGatewayError>>;
  syncDrills(): Promise<Result<readonly CachedDrillRecord[], CatalogError>>;
  syncVocabDeck(
    defaultExamId?: SupportedExamId,
  ): Promise<Result<readonly VocabCardRecord[], CatalogError>>;
  listCachedDrills(filter?: {
    readonly skill?: SkillKind;
    readonly drillType?: string;
  }): Promise<Result<readonly CachedDrillRecord[], StorageError>>;
  getCachedDrillById(drillId: string): Promise<Result<CachedDrillRecord | null, StorageError>>;
  getCachedMediaUrl(
    input: CachedMediaSourceInput,
  ): Promise<Result<string, NetworkError | StorageError | UnexpectedError>>;
  putUserRecording(
    input: PutUserRecordingInput,
  ): Promise<Result<MediaCacheIndexRecord, StorageError>>;
  readUserRecordingBytes(mediaKey: string): Promise<Result<CachedAudioBytes, StorageError>>;
  listRecordingsForAttempt(
    attemptId: string,
  ): Promise<Result<readonly MediaCacheIndexRecord[], StorageError>>;
  updateRecordingRemoteKey(
    mediaKey: string,
    remoteObjectKey: string,
  ): Promise<Result<void, StorageError>>;
  getCacheUsageSummary(): Promise<Result<CacheUsageSummary, StorageError>>;
  evictLruIfOverQuota(): Promise<Result<CacheEvictionResult, StorageError>>;
  clearDownloadedCaches(): Promise<Result<{ readonly clearedBytes: number }, StorageError>>;
  eraseAllCachedMedia(): Promise<Result<void, StorageError>>;
}

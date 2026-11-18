import {
  type AppEditionCode,
  type SkillKind,
  type SupportedExamId,
  serialDayFromUtcMs,
} from '@mockza/domain';
import {
  type CatalogError,
  type CatalogGatewayError,
  type CatalogPackFilter,
  type CachedAudioBytes,
  type CachedMediaSourceInput,
  type CacheEvictionResult,
  type CacheUsageSummary,
  type ExamBundlePayload,
  type ICatalogMediaGateway,
  MEDIA_CACHE_QUOTA_BYTES,
  type PutUserRecordingInput,
} from '@/gateways/catalog.gateway';
import {
  type NetworkError,
  type Result,
  type StorageError,
  type UnexpectedError,
  err,
  ok,
} from '@/gateways/result';
import type {
  CachedDrillRecord,
  CatalogPackRecord,
  CatalogTrack,
  MediaCacheIndexRecord,
  MediaStorageBackend,
} from '@/gateways/storage.gateway';
import type { IClock } from '@/gateways/telemetry.gateway';
import { type MockzaDexieDb, PREF_PREFIX_CACHED_DRILL } from '../dexie/mockza-db';

export const OPFS_MEDIA_DIR_NAME = 'mockza-media' as const;
export const CACHE_STORAGE_MEDIA_NAME = 'mockza-media-v1' as const;
export const IDB_FALLBACK_MEDIA_DB_NAME = 'mockza-media-blobs-v1' as const;
export const IDB_FALLBACK_MEDIA_STORE_NAME = 'blobs' as const;
export const THIRTY_DAYS_MS = 30 * 86_400_000;

interface OpfsWritableStreamLike {
  write(data: ArrayBuffer | Uint8Array | Blob | string): Promise<void>;
  close(): Promise<void>;
}

interface OpfsFileHandleLike {
  getFile(): Promise<File>;
  createWritable(): Promise<OpfsWritableStreamLike>;
}

export interface OpfsDirectoryHandleLike {
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<OpfsDirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<OpfsFileHandleLike>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  entries?(): AsyncIterableIterator<[string, unknown]>;
}

function createDefaultClock(): IClock {
  return {
    nowMs: () => Date.now(),
    nowIso: () => new Date().toISOString(),
    todaySerialDay: () => serialDayFromUtcMs(Date.now()),
  };
}

function encodeMediaFileName(mediaKey: string): string {
  const bytes = new TextEncoder().encode(mediaKey);
  let hex = 'mz_';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToHex(buffer: ArrayBuffer): string {
  const view = new Uint8Array(buffer);
  let hex = '';
  for (const b of view) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Deterministic sorted-key JSON encoder matching Dart `ContentSyncService._stableJsonEncode`.
 */
export function stableJsonStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (Array.isArray(value)) {
    const parts = value.map((item) => (item === undefined ? 'null' : stableJsonStringify(item)));
    return `[${parts.join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const parts: string[] = [];
    for (const k of keys) {
      const propVal = record[k];
      if (propVal === undefined) continue;
      parts.push(`${JSON.stringify(k)}:${stableJsonStringify(propVal)}`);
    }
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(value);
}

export async function sha256Hex(input: Uint8Array | string): Promise<string> {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto subtle.digest is unavailable in this environment');
  }
  const digest = await subtle.digest('SHA-256', toArrayBuffer(bytes));
  return bytesToHex(digest);
}

/**
 * Computes deterministic sorted-key SHA-256 over `{'questions': ..., 'sections': ...}`
 * matching Flutter `ContentSyncService.computeCanonicalBundleSha256`.
 */
export async function computeCanonicalBundleSha256(
  sections: unknown,
  questions: unknown,
): Promise<string> {
  const encoded = stableJsonStringify({
    questions: questions ?? [],
    sections: sections ?? [],
  });
  return sha256Hex(encoded);
}

interface StoredBlobEntry {
  readonly bytes: Uint8Array;
  readonly mimeType: string;
}

export interface MediaBinaryStoreOptions {
  readonly opfsRootOverride?: OpfsDirectoryHandleLike | null;
  readonly disableOpfs?: boolean;
  readonly disableCacheStorage?: boolean;
  readonly disableIdbFallback?: boolean;
  readonly idbDbName?: string;
}

/**
 * Three-tier binary media storage:
 * 1. OPFS (`navigator.storage.getDirectory()` -> `'mockza-media'`)
 * 2. Cache Storage (`caches.open('mockza-media-v1')`)
 * 3. Bounded IDB/in-memory fallback (`'mockza-media-blobs-v1'`)
 */
export class MediaBinaryStore {
  private readonly options: MediaBinaryStoreOptions;
  private readonly memoryFallback = new Map<string, StoredBlobEntry>();
  private readonly idbDbName: string;

  constructor(options: MediaBinaryStoreOptions = {}) {
    this.options = options;
    this.idbDbName = options.idbDbName ?? IDB_FALLBACK_MEDIA_DB_NAME;
  }

  private async getOpfsDirectory(create: boolean): Promise<OpfsDirectoryHandleLike | null> {
    if (this.options.disableOpfs) return null;
    try {
      let root: OpfsDirectoryHandleLike | null | undefined = this.options.opfsRootOverride;
      if (root === undefined) {
        if (
          typeof navigator !== 'undefined' &&
          navigator.storage &&
          typeof navigator.storage.getDirectory === 'function'
        ) {
          root = (await navigator.storage.getDirectory()) as unknown as OpfsDirectoryHandleLike;
        }
      }
      if (!root) return null;
      return await root.getDirectoryHandle(OPFS_MEDIA_DIR_NAME, { create });
    } catch {
      return null;
    }
  }

  private async getCacheStorage(): Promise<Cache | null> {
    if (this.options.disableCacheStorage) return null;
    try {
      if (typeof caches !== 'undefined' && typeof caches.open === 'function') {
        return await caches.open(CACHE_STORAGE_MEDIA_NAME);
      }
    } catch {
      return null;
    }
    return null;
  }

  private cacheRequestUrl(mediaKey: string): string {
    return `https://mockza-media.local/${encodeURIComponent(mediaKey)}`;
  }

  private async openFallbackIdb(): Promise<IDBDatabase | null> {
    if (this.options.disableIdbFallback) return null;
    if (typeof indexedDB === 'undefined') return null;
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(this.idbDbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_FALLBACK_MEDIA_STORE_NAME)) {
            db.createObjectStore(IDB_FALLBACK_MEDIA_STORE_NAME);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async writeFallbackIdb(
    mediaKey: string,
    bytes: Uint8Array,
    mimeType: string,
  ): Promise<boolean> {
    const db = await this.openFallbackIdb();
    if (!db) return false;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: boolean): void => {
        if (settled) return;
        settled = true;
        try {
          db.close();
        } catch {
          // Ignore close errors.
        }
        resolve(value);
      };
      try {
        const tx = db.transaction(IDB_FALLBACK_MEDIA_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_FALLBACK_MEDIA_STORE_NAME);
        tx.oncomplete = () => finish(true);
        tx.onerror = () => finish(false);
        tx.onabort = () => finish(false);
        store.put({ bytes: toArrayBuffer(bytes), mimeType }, mediaKey);
      } catch {
        finish(false);
      }
    });
  }

  private async readFallbackIdb(mediaKey: string): Promise<StoredBlobEntry | null> {
    const db = await this.openFallbackIdb();
    if (!db) return null;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: StoredBlobEntry | null): void => {
        if (settled) return;
        settled = true;
        try {
          db.close();
        } catch {
          // Ignore close errors.
        }
        resolve(value);
      };
      try {
        const tx = db.transaction(IDB_FALLBACK_MEDIA_STORE_NAME, 'readonly');
        const store = tx.objectStore(IDB_FALLBACK_MEDIA_STORE_NAME);
        const req = store.get(mediaKey);
        req.onsuccess = () => {
          const raw = req.result as { bytes?: unknown; mimeType?: unknown } | undefined;
          if (!raw || !raw.bytes) {
            finish(null);
            return;
          }
          let bytes: Uint8Array | null = null;
          if (ArrayBuffer.isView(raw.bytes)) {
            bytes = new Uint8Array(
              raw.bytes.buffer,
              raw.bytes.byteOffset,
              raw.bytes.byteLength,
            ).slice();
          } else {
            const tag = Object.prototype.toString.call(raw.bytes);
            if (tag === '[object ArrayBuffer]' || tag === '[object SharedArrayBuffer]') {
              bytes = new Uint8Array(raw.bytes as ArrayBuffer).slice();
            }
          }
          if (!bytes) {
            finish(null);
            return;
          }
          finish({
            bytes,
            mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : 'application/octet-stream',
          });
        };
        req.onerror = () => finish(null);
        tx.onerror = () => finish(null);
        tx.onabort = () => finish(null);
      } catch {
        finish(null);
      }
    });
  }

  private async deleteFallbackIdb(mediaKey: string): Promise<void> {
    const db = await this.openFallbackIdb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        try {
          db.close();
        } catch {
          // Ignore close errors.
        }
        resolve();
      };
      try {
        const tx = db.transaction(IDB_FALLBACK_MEDIA_STORE_NAME, 'readwrite');
        tx.oncomplete = finish;
        tx.onerror = finish;
        tx.onabort = finish;
        tx.objectStore(IDB_FALLBACK_MEDIA_STORE_NAME).delete(mediaKey);
      } catch {
        finish();
      }
    });
  }

  private async clearFallbackIdb(): Promise<void> {
    const db = await this.openFallbackIdb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        try {
          db.close();
        } catch {
          // Ignore close errors.
        }
        resolve();
      };
      try {
        const tx = db.transaction(IDB_FALLBACK_MEDIA_STORE_NAME, 'readwrite');
        tx.oncomplete = finish;
        tx.onerror = finish;
        tx.onabort = finish;
        tx.objectStore(IDB_FALLBACK_MEDIA_STORE_NAME).clear();
      } catch {
        finish();
      }
    });
  }

  async writeBinary(
    mediaKey: string,
    bytes: Uint8Array,
    mimeType: string,
  ): Promise<MediaStorageBackend> {
    const dir = await this.getOpfsDirectory(true);
    if (dir) {
      try {
        const fileName = encodeMediaFileName(mediaKey);
        const fileHandle = await dir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(toArrayBuffer(bytes));
        await writable.close();
        return 'opfs';
      } catch {
        // Fall through to Cache Storage.
      }
    }

    const cache = await this.getCacheStorage();
    if (cache) {
      try {
        const response = new Response(toArrayBuffer(bytes), {
          headers: { 'Content-Type': mimeType },
        });
        await cache.put(this.cacheRequestUrl(mediaKey), response);
        return 'cache';
      } catch {
        // Fall through to IDB / in-memory fallback.
      }
    }

    const copied = new Uint8Array(bytes.byteLength);
    copied.set(bytes);
    const idbOk = await this.writeFallbackIdb(mediaKey, copied, mimeType);
    if (!idbOk) {
      this.memoryFallback.set(mediaKey, { bytes: copied, mimeType });
    }
    return 'idb_fallback';
  }

  async readBinary(
    mediaKey: string,
    backendHint?: MediaStorageBackend,
    fallbackMimeType: string = 'application/octet-stream',
  ): Promise<StoredBlobEntry | null> {
    if (!backendHint || backendHint === 'opfs') {
      const dir = await this.getOpfsDirectory(false);
      if (dir) {
        try {
          const handle = await dir.getFileHandle(encodeMediaFileName(mediaKey));
          const file = await handle.getFile();
          const buf = await file.arrayBuffer();
          return {
            bytes: new Uint8Array(buf),
            mimeType: file.type || fallbackMimeType,
          };
        } catch {
          if (backendHint === 'opfs') return null;
        }
      }
    }

    if (!backendHint || backendHint === 'cache') {
      const cache = await this.getCacheStorage();
      if (cache) {
        try {
          const match = await cache.match(this.cacheRequestUrl(mediaKey));
          if (match) {
            const buf = await match.arrayBuffer();
            return {
              bytes: new Uint8Array(buf),
              mimeType: match.headers.get('Content-Type') ?? fallbackMimeType,
            };
          }
        } catch {
          if (backendHint === 'cache') return null;
        }
      }
    }

    const idbEntry = await this.readFallbackIdb(mediaKey);
    if (idbEntry) return idbEntry;

    return this.memoryFallback.get(mediaKey) ?? null;
  }

  async deleteBinary(mediaKey: string, backendHint?: MediaStorageBackend): Promise<void> {
    if (!backendHint || backendHint === 'opfs') {
      const dir = await this.getOpfsDirectory(false);
      if (dir) {
        try {
          await dir.removeEntry(encodeMediaFileName(mediaKey));
        } catch {
          // Ignore missing OPFS entry.
        }
      }
    }

    if (!backendHint || backendHint === 'cache') {
      const cache = await this.getCacheStorage();
      if (cache) {
        try {
          await cache.delete(this.cacheRequestUrl(mediaKey));
        } catch {
          // Ignore missing cache entry.
        }
      }
    }

    this.memoryFallback.delete(mediaKey);
    await this.deleteFallbackIdb(mediaKey);
  }

  async clearAllBinaries(): Promise<void> {
    const dir = await this.getOpfsDirectory(false);
    if (dir && typeof dir.entries === 'function') {
      try {
        for await (const [name] of dir.entries()) {
          await dir.removeEntry(name, { recursive: true });
        }
      } catch {
        // Ignore OPFS enumeration errors.
      }
    }

    if (!this.options.disableCacheStorage) {
      try {
        if (typeof caches !== 'undefined' && typeof caches.delete === 'function') {
          await caches.delete(CACHE_STORAGE_MEDIA_NAME);
        }
      } catch {
        // Ignore cache clear error.
      }
    }

    this.memoryFallback.clear();
    await this.clearFallbackIdb();
  }
}

export interface OpfsCatalogAdapterOptions {
  readonly db: MockzaDexieDb;
  readonly edition: AppEditionCode;
  readonly clock?: IClock;
  readonly fetchFn?: typeof fetch;
  readonly apiBaseUrl?: string;
  readonly cdnBaseUrl?: string;
  readonly getAuthHeaders?: () => Record<string, string>;
  readonly quotaBytes?: number;
  readonly binaryStore?: MediaBinaryStore;
  readonly binaryStoreOptions?: MediaBinaryStoreOptions;
}

function toStorageError(message: string, cause: unknown, code?: StorageError['code']): StorageError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return code !== undefined
    ? { kind: 'storage', message: `${message}: ${detail}`, code }
    : { kind: 'storage', message: `${message}: ${detail}` };
}

function inferMimeTypeFromUrl(url: string, contentTypeHeader?: string | null): string {
  const header = contentTypeHeader?.split(';')[0]?.trim().toLowerCase();
  if (header && header !== 'application/octet-stream') {
    return header;
  }
  const lower = url.toLowerCase();
  if (lower.endsWith('.svg') || lower.includes('.svg?')) return 'image/svg+xml';
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  return 'application/octet-stream';
}

function makePackMediaKey(packId: string, url: string): string {
  return `pack:${packId}:${url}`;
}

export class OpfsCatalogAdapter implements ICatalogMediaGateway {
  private readonly db: MockzaDexieDb;
  private readonly edition: AppEditionCode;
  private readonly clock: IClock;
  private readonly fetchFn: typeof fetch;
  private readonly apiBaseUrl: string;
  private readonly cdnBaseUrl: string;
  private readonly getAuthHeaders?: () => Record<string, string>;
  private readonly quotaBytes: number;
  private readonly binaryStore: MediaBinaryStore;

  constructor(options: OpfsCatalogAdapterOptions) {
    this.db = options.db;
    this.edition = options.edition;
    this.clock = options.clock ?? createDefaultClock();
    this.fetchFn = options.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
    this.apiBaseUrl = (options.apiBaseUrl ?? '').replace(/\/+$/, '');
    this.cdnBaseUrl = (options.cdnBaseUrl ?? '').replace(/\/+$/, '');
    this.getAuthHeaders = options.getAuthHeaders;
    this.quotaBytes = options.quotaBytes ?? MEDIA_CACHE_QUOTA_BYTES;
    this.binaryStore = options.binaryStore ?? new MediaBinaryStore(options.binaryStoreOptions);
  }

  private resolveApiUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.apiBaseUrl}${normalizedPath}`;
  }

  private resolveMediaUrl(url: string): string {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
      return url;
    }
    const normalized = url.startsWith('/') ? url : `/${url}`;
    if (this.cdnBaseUrl.length > 0 && !normalized.startsWith('/v1/')) {
      return `${this.cdnBaseUrl}${normalized}`;
    }
    return `${this.apiBaseUrl}${normalized}`;
  }

  private buildApiHeaders(): Record<string, string> {
    return {
      'x-mockza-edition': this.edition,
      ...(this.getAuthHeaders ? this.getAuthHeaders() : {}),
    };
  }

  async syncCatalogManifest(): Promise<Result<readonly CatalogPackRecord[], CatalogGatewayError>> {
    try {
      const response = await this.fetchFn(this.resolveApiUrl('/v1/catalog/manifest'), {
        method: 'GET',
        headers: this.buildApiHeaders(),
      });
      if (!response.ok) {
        return err<NetworkError>({
          kind: 'network',
          message: `Catalog manifest request failed (${response.status})`,
          retryable: response.status >= 500 || response.status === 429,
          status: response.status,
        });
      }

      const body = (await response.json()) as {
        readonly packs?: ReadonlyArray<{
          readonly packId: string;
          readonly edition?: AppEditionCode;
          readonly examId: SupportedExamId;
          readonly track?: CatalogTrack;
          readonly skill: SkillKind | 'fullMock';
          readonly title?: string;
          readonly description?: string;
          readonly durationSeconds?: number;
          readonly questionCount?: number;
          readonly accent?: string | null;
          readonly mediaUrl?: string | null;
          readonly downloadUrl?: string;
          readonly version: string;
          readonly sha256: string;
          readonly byteLength: number;
          readonly isFreeSample: boolean;
        }>;
      };

      const rawPacks = body.packs ?? [];
      const now = this.clock.nowMs();
      const existingRows = await this.db.catalogPacks.bulkGet(rawPacks.map((p) => p.packId));

      const records: CatalogPackRecord[] = rawPacks.map((pack, idx) => {
        const existing = existingRows[idx];
        return {
          packId: pack.packId,
          edition: pack.edition ?? this.edition,
          examId: pack.examId,
          track: pack.track ?? 'academic',
          skill: pack.skill,
          title: pack.title ?? '',
          description: pack.description ?? '',
          durationSeconds: pack.durationSeconds ?? 0,
          questionCount: pack.questionCount ?? 0,
          accent: pack.accent ?? null,
          mediaUrl: pack.mediaUrl ?? null,
          downloadUrl: pack.downloadUrl,
          version: pack.version,
          sha256: pack.sha256,
          byteLength: pack.byteLength,
          isFreeSample: pack.isFreeSample,
          isCachedOffline: existing?.isCachedOffline ?? 0,
          bundleJson: existing?.bundleJson ?? null,
          cachedMediaInline: existing?.cachedMediaInline ?? null,
          sizeBytes: existing?.sizeBytes ?? 0,
          cachedAtMs: existing?.cachedAtMs ?? null,
          updatedAtMs: now,
          kind: 'pack',
        };
      });

      if (records.length > 0) {
        await this.db.catalogPacks.bulkPut(records);
      }

      return ok(records);
    } catch (cause) {
      return err<NetworkError>({
        kind: 'network',
        message: `Catalog sync network error: ${cause instanceof Error ? cause.message : String(cause)}`,
        retryable: true,
      });
    }
  }

  async listPacks(
    filter?: CatalogPackFilter,
  ): Promise<Result<readonly CatalogPackRecord[], StorageError>> {
    try {
      const all = await this.db.catalogPacks.toArray();
      const filtered = all.filter((pack) => {
        if (filter?.examId && pack.examId !== filter.examId) return false;
        if (filter?.skill && pack.skill !== filter.skill) return false;
        if (filter?.cachedOnly && pack.isCachedOffline !== 1) return false;
        if (filter?.freeOnly && !pack.isFreeSample) return false;
        return true;
      });
      filtered.sort(
        (a, b) => a.skill.localeCompare(b.skill) || a.packId.localeCompare(b.packId),
      );
      return ok(filtered);
    } catch (cause) {
      return err(toStorageError('Failed to list catalog packs', cause));
    }
  }

  async ensureExamBundle(
    packId: string,
  ): Promise<Result<ExamBundlePayload, CatalogGatewayError>> {
    try {
      const existing = await this.db.catalogPacks.get(packId);
      if (existing && existing.isCachedOffline === 1 && existing.bundleJson) {
        try {
          const parsed = JSON.parse(existing.bundleJson) as ExamBundlePayload;
          const isStale =
            (parsed.pack?.version && existing.version && parsed.pack.version !== existing.version) ||
            (parsed.pack?.sha256 &&
              existing.sha256 &&
              parsed.pack.sha256.toLowerCase() !== existing.sha256.toLowerCase());
          if (!isStale) {
            return ok(parsed);
          }

          const refreshed = await this.downloadExamPack(packId);
          if (refreshed.ok && refreshed.value.bundleJson) {
            return ok(JSON.parse(refreshed.value.bundleJson) as ExamBundlePayload);
          }
          // Offline fallback to cached bundle if refresh failed over network.
          return ok(parsed);
        } catch {
          // Corrupt JSON: fall through to re-download.
        }
      }

      const downloaded = await this.downloadExamPack(packId);
      if (!downloaded.ok) return downloaded;
      if (!downloaded.value.bundleJson) {
        return err({
          kind: 'storage',
          message: `Downloaded pack ${packId} missing bundleJson`,
          code: 'CORRUPT_DATA',
        });
      }
      return ok(JSON.parse(downloaded.value.bundleJson) as ExamBundlePayload);
    } catch (cause) {
      return err<UnexpectedError>({
        kind: 'unexpected',
        message: `Failed to ensure exam bundle ${packId}`,
        cause,
      });
    }
  }

  async downloadExamPack(
    packId: string,
  ): Promise<Result<CatalogPackRecord, CatalogGatewayError>> {
    try {
      const response = await this.fetchFn(
        this.resolveApiUrl(`/v1/exams/${encodeURIComponent(packId)}`),
        {
          method: 'GET',
          headers: this.buildApiHeaders(),
        },
      );
      if (!response.ok) {
        return err<NetworkError>({
          kind: 'network',
          message: `Exam bundle download failed (${response.status})`,
          retryable: response.status >= 500 || response.status === 429,
          status: response.status,
        });
      }

      const bundle = (await response.json()) as ExamBundlePayload;
      if (!bundle || !bundle.pack) {
        return err({
          kind: 'validation',
          message: `Empty exam bundle response for ${packId}`,
          code: 'EMPTY_BUNDLE',
        });
      }

      const declaredSha = (bundle.pack.sha256 ?? '').trim().toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(declaredSha)) {
        return err({
          kind: 'storage',
          message: `Exam bundle ${packId} is missing a valid 64-char SHA-256 digest`,
          code: 'SHA256_MISMATCH',
        });
      }

      const computedSha = await computeCanonicalBundleSha256(bundle.sections, bundle.questions);
      if (computedSha !== declaredSha) {
        return err({
          kind: 'storage',
          message: `Exam bundle ${packId} failed canonical SHA-256 verification`,
          code: 'SHA256_MISMATCH',
        });
      }

      const mediaUrls = new Set<string>();
      if (bundle.pack.mediaUrl && bundle.pack.mediaUrl.length > 0) {
        mediaUrls.add(bundle.pack.mediaUrl);
      }
      for (const section of bundle.sections ?? []) {
        if (section.mediaUrl && section.mediaUrl.length > 0) {
          mediaUrls.add(section.mediaUrl);
        }
      }

      const now = this.clock.nowMs();
      const cachedMediaInline: Record<string, string> = {};
      let mediaTotalBytes = 0;

      for (const url of mediaUrls) {
        const mediaRes = await this.fetchFn(this.resolveMediaUrl(url), {
          method: 'GET',
          headers: url.startsWith('/v1/') ? this.buildApiHeaders() : undefined,
        });
        if (!mediaRes.ok) {
          return err<NetworkError>({
            kind: 'network',
            message: `Failed to download media asset (${url}): HTTP ${mediaRes.status}`,
            retryable: mediaRes.status >= 500 || mediaRes.status === 429,
            status: mediaRes.status,
          });
        }

        const bytes = new Uint8Array(await mediaRes.arrayBuffer());
        if (bytes.byteLength === 0) {
          return err<NetworkError>({
            kind: 'network',
            message: `Required media asset (${url}) for ${packId} is empty`,
            retryable: true,
          });
        }

        const mimeType = inferMimeTypeFromUrl(url, mediaRes.headers?.get?.('content-type'));
        const isSvgUrl = url.toLowerCase().endsWith('.svg') || mimeType === 'image/svg+xml';
        const prefixText = new TextDecoder().decode(bytes.subarray(0, Math.min(64, bytes.length))).trimStart();
        const isSvgPayload = isSvgUrl || prefixText.startsWith('<svg') || prefixText.startsWith('<?xml');

        if (isSvgPayload) {
          const svgText = new TextDecoder().decode(bytes).trim();
          if (!svgText.includes('<svg')) {
            return err({
              kind: 'validation',
              message: `Invalid SVG chart asset (${url}) for ${packId}`,
              code: 'INVALID_SVG',
            });
          }
          cachedMediaInline[url] = svgText;
        }

        const mediaSha = await sha256Hex(bytes);
        const mediaKey = makePackMediaKey(packId, url);
        const finalMime = isSvgPayload ? 'image/svg+xml' : mimeType;
        const backend = await this.binaryStore.writeBinary(mediaKey, bytes, finalMime);

        await this.db.mediaCacheIndex.put({
          mediaKey,
          kind: isSvgPayload ? 'pack_svg' : 'pack_audio',
          storageBackend: backend,
          mimeType: finalMime,
          sha256: mediaSha,
          byteSize: bytes.byteLength,
          attemptId: null,
          partIndex: null,
          durationMs: null,
          remoteObjectKey: null,
          lastAccessedMs: now,
          createdAtMs: now,
          expiresAtMs: null,
        });
        mediaTotalBytes += bytes.byteLength;
      }

      const bundleJson = JSON.stringify(bundle);
      const bundleBytes = new TextEncoder().encode(bundleJson).byteLength;

      const record: CatalogPackRecord = {
        packId: bundle.pack.packId,
        edition: bundle.pack.edition,
        examId: bundle.pack.examId as SupportedExamId,
        track: bundle.pack.track,
        skill: bundle.pack.skill as SkillKind | 'fullMock',
        title: bundle.pack.title,
        description: bundle.pack.description,
        durationSeconds: bundle.pack.durationSeconds,
        questionCount: bundle.pack.questionCount,
        accent: bundle.pack.accent ?? null,
        mediaUrl: bundle.pack.mediaUrl ?? null,
        downloadUrl: bundle.pack.downloadUrl,
        version: bundle.pack.version,
        sha256: declaredSha,
        byteLength: bundle.pack.byteLength,
        isFreeSample: bundle.pack.isFreeSample,
        isCachedOffline: 1,
        bundleJson,
        cachedMediaInline: Object.keys(cachedMediaInline).length > 0 ? cachedMediaInline : null,
        sizeBytes: bundleBytes + mediaTotalBytes,
        cachedAtMs: now,
        updatedAtMs: now,
        kind: 'pack',
      };

      await this.db.catalogPacks.put(record);
      await this.evictLruIfOverQuota();
      return ok(record);
    } catch (cause) {
      return err<UnexpectedError>({
        kind: 'unexpected',
        message: `Unable to download exam pack ${packId}: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      });
    }
  }

  async syncDrills(): Promise<Result<readonly CachedDrillRecord[], CatalogError>> {
    try {
      const response = await this.fetchFn(this.resolveApiUrl('/v1/drills'), {
        method: 'GET',
        headers: this.buildApiHeaders(),
      });
      if (!response.ok) {
        return err<NetworkError>({
          kind: 'network',
          message: `Drills sync failed (${response.status})`,
          retryable: response.status >= 500 || response.status === 429,
          status: response.status,
        });
      }

      const body = (await response.json()) as {
        readonly drills?: ReadonlyArray<{
          readonly drillId: string;
          readonly title: string;
          readonly drillType: string;
          readonly skill: SkillKind;
          readonly durationSeconds: number;
          readonly items: readonly unknown[];
        }>;
      };

      const now = this.clock.nowMs();
      const drills: CachedDrillRecord[] = (body.drills ?? []).map((d) => ({
        drillId: d.drillId,
        title: d.title,
        drillType: d.drillType,
        skill: d.skill,
        durationSeconds: d.durationSeconds,
        itemsJson: JSON.stringify(d.items ?? []),
        updatedAtMs: now,
      }));

      if (drills.length > 0) {
        await this.db.localPreferences.bulkPut(
          drills.map((drill) => ({
            key: `${PREF_PREFIX_CACHED_DRILL}${drill.drillId}`,
            value: drill,
            updatedAtMs: now,
          })),
        );
      }

      return ok(drills);
    } catch (cause) {
      return err<NetworkError>({
        kind: 'network',
        message: `Drills sync error: ${cause instanceof Error ? cause.message : String(cause)}`,
        retryable: true,
      });
    }
  }

  async listCachedDrills(filter?: {
    readonly skill?: SkillKind;
    readonly drillType?: string;
  }): Promise<Result<readonly CachedDrillRecord[], StorageError>> {
    try {
      const rows = await this.db.localPreferences
        .where('key')
        .startsWith(PREF_PREFIX_CACHED_DRILL)
        .toArray();
      const drills = rows
        .map((row) => row.value as CachedDrillRecord)
        .filter((drill) => {
          if (filter?.skill && drill.skill !== filter.skill) return false;
          if (filter?.drillType && drill.drillType !== filter.drillType) return false;
          return true;
        })
        .sort(
          (a, b) => a.skill.localeCompare(b.skill) || a.drillId.localeCompare(b.drillId),
        );
      return ok(drills);
    } catch (cause) {
      return err(toStorageError('Failed to list cached drills', cause));
    }
  }

  async getCachedDrillById(
    drillId: string,
  ): Promise<Result<CachedDrillRecord | null, StorageError>> {
    try {
      const row = await this.db.localPreferences.get(`${PREF_PREFIX_CACHED_DRILL}${drillId}`);
      return ok((row?.value as CachedDrillRecord | undefined) ?? null);
    } catch (cause) {
      return err(toStorageError('Failed to load cached drill', cause));
    }
  }

  async getCachedMediaUrl(
    input: CachedMediaSourceInput,
  ): Promise<Result<string, NetworkError | StorageError | UnexpectedError>> {
    try {
      const now = this.clock.nowMs();
      const existing = await this.db.mediaCacheIndex.get(input.mediaKey);
      if (existing) {
        const stored = await this.binaryStore.readBinary(
          input.mediaKey,
          existing.storageBackend,
          existing.mimeType,
        );
        if (stored && stored.bytes.byteLength > 0) {
          if (
            input.expectedSha256 &&
            existing.sha256.toLowerCase() !== input.expectedSha256.toLowerCase()
          ) {
            await this.deleteMediaBinary(input.mediaKey);
            await this.db.mediaCacheIndex.delete(input.mediaKey);
            return err({
              kind: 'storage',
              message: `Cached media ${input.mediaKey} failed SHA-256 verification`,
              code: 'SHA256_MISMATCH',
            });
          }
          await this.db.mediaCacheIndex.update(input.mediaKey, { lastAccessedMs: now });
          const blob = new Blob([toArrayBuffer(stored.bytes)], { type: existing.mimeType });
          if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
            return ok(URL.createObjectURL(blob));
          }
          return ok(input.fallbackUrl);
        }
      }

      const response = await this.fetchFn(this.resolveMediaUrl(input.fallbackUrl), {
        method: 'GET',
        headers: input.fallbackUrl.startsWith('/v1/') ? this.buildApiHeaders() : undefined,
      });
      if (!response.ok) {
        return err<NetworkError>({
          kind: 'network',
          message: `Media fetch failed (${response.status}) for ${input.mediaKey}`,
          retryable: response.status >= 500 || response.status === 429,
          status: response.status,
        });
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      const sha256 = await sha256Hex(bytes);
      if (
        input.expectedSha256 &&
        sha256.toLowerCase() !== input.expectedSha256.toLowerCase()
      ) {
        return err({
          kind: 'storage',
          message: `Downloaded media ${input.mediaKey} failed SHA-256 verification`,
          code: 'SHA256_MISMATCH',
        });
      }

      const mimeType = inferMimeTypeFromUrl(
        input.fallbackUrl,
        response.headers?.get?.('content-type'),
      );
      const backend = await this.binaryStore.writeBinary(input.mediaKey, bytes, mimeType);
      await this.db.mediaCacheIndex.put({
        mediaKey: input.mediaKey,
        kind: mimeType.includes('svg') ? 'pack_svg' : 'pack_audio',
        storageBackend: backend,
        mimeType,
        sha256,
        byteSize: bytes.byteLength,
        attemptId: null,
        partIndex: null,
        durationMs: null,
        remoteObjectKey: null,
        lastAccessedMs: now,
        createdAtMs: now,
        expiresAtMs: null,
      });

      await this.evictLruIfOverQuota();

      const blob = new Blob([toArrayBuffer(bytes)], { type: mimeType });
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        return ok(URL.createObjectURL(blob));
      }
      return ok(input.fallbackUrl);
    } catch (cause) {
      return err<UnexpectedError>({
        kind: 'unexpected',
        message: `Failed to resolve cached media ${input.mediaKey}`,
        cause,
      });
    }
  }

  async putUserRecording(
    input: PutUserRecordingInput,
  ): Promise<Result<MediaCacheIndexRecord, StorageError>> {
    try {
      const bytes = new Uint8Array(await input.blob.arrayBuffer());
      const sha256 = await sha256Hex(bytes);
      const rawMime = input.mimeType ?? (input.blob.type || 'audio/mp4');
      const mimeType = rawMime.trim().length > 0 ? rawMime.trim() : 'audio/mp4';
      const now = this.clock.nowMs();
      const backend = await this.binaryStore.writeBinary(input.clipId, bytes, mimeType);

      const indexRecord: MediaCacheIndexRecord = {
        mediaKey: input.clipId,
        kind: 'user_recording',
        storageBackend: backend,
        mimeType,
        sha256,
        byteSize: bytes.byteLength,
        attemptId: input.attemptId,
        partIndex: input.partIndex,
        durationMs: input.durationMs,
        remoteObjectKey: null,
        lastAccessedMs: now,
        createdAtMs: now,
        expiresAtMs: now + THIRTY_DAYS_MS,
      };

      await this.db.mediaCacheIndex.put(indexRecord);
      return ok(indexRecord);
    } catch (cause) {
      return err(toStorageError('Failed to store user recording', cause));
    }
  }

  async readUserRecordingBytes(
    mediaKey: string,
  ): Promise<Result<CachedAudioBytes, StorageError>> {
    try {
      const indexRow = await this.db.mediaCacheIndex.get(mediaKey);
      if (!indexRow) {
        return err({
          kind: 'storage',
          message: `Recording index not found: ${mediaKey}`,
          code: 'NOT_FOUND',
        });
      }

      const stored = await this.binaryStore.readBinary(
        mediaKey,
        indexRow.storageBackend,
        indexRow.mimeType,
      );
      if (!stored) {
        return err({
          kind: 'storage',
          message: `Recording binary missing: ${mediaKey}`,
          code: 'NOT_FOUND',
        });
      }

      await this.db.mediaCacheIndex
        .update(mediaKey, { lastAccessedMs: this.clock.nowMs() })
        .catch(() => {});

      return ok({
        bytes: stored.bytes,
        mimeType: indexRow.mimeType,
        sha256: indexRow.sha256,
      });
    } catch (cause) {
      return err(toStorageError('Failed to read user recording bytes', cause));
    }
  }

  async listRecordingsForAttempt(
    attemptId: string,
  ): Promise<Result<readonly MediaCacheIndexRecord[], StorageError>> {
    try {
      const rows = await this.db.mediaCacheIndex
        .where('attemptId')
        .equals(attemptId)
        .and((row) => row.kind === 'user_recording')
        .toArray();
      rows.sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0));
      return ok(rows);
    } catch (cause) {
      return err(toStorageError('Failed to list recordings for attempt', cause));
    }
  }

  async updateRecordingRemoteKey(
    mediaKey: string,
    remoteObjectKey: string,
  ): Promise<Result<void, StorageError>> {
    try {
      const updated = await this.db.mediaCacheIndex.update(mediaKey, { remoteObjectKey });
      if (updated === 0) {
        return err({
          kind: 'storage',
          message: `Cannot update remoteObjectKey; mediaKey not found: ${mediaKey}`,
          code: 'NOT_FOUND',
        });
      }
      return ok(undefined);
    } catch (cause) {
      return err(toStorageError('Failed to update recording remoteObjectKey', cause));
    }
  }

  /**
   * Deletes the underlying binary blob from OPFS/Cache/IDB fallback for garbage collection.
   */
  async deleteMediaBinary(mediaKey: string): Promise<void> {
    const existing = await this.db.mediaCacheIndex.get(mediaKey).catch(() => undefined);
    await this.binaryStore.deleteBinary(mediaKey, existing?.storageBackend);
  }

  async getCacheUsageSummary(): Promise<Result<CacheUsageSummary, StorageError>> {
    try {
      const [mediaRows, cachedPacks] = await Promise.all([
        this.db.mediaCacheIndex.toArray(),
        this.db.catalogPacks.where('isCachedOffline').equals(1).count(),
      ]);

      let totalBytes = 0;
      let userRecordingBytes = 0;
      for (const row of mediaRows) {
        totalBytes += row.byteSize;
        if (row.kind === 'user_recording') {
          userRecordingBytes += row.byteSize;
        }
      }

      return ok({
        totalBytes,
        quotaBytes: MEDIA_CACHE_QUOTA_BYTES,
        packCount: cachedPacks,
        userRecordingBytes,
      });
    } catch (cause) {
      return err(toStorageError('Failed to compute cache usage summary', cause));
    }
  }

  async evictLruIfOverQuota(): Promise<Result<CacheEvictionResult, StorageError>> {
    try {
      const allEntries = await this.db.mediaCacheIndex.toArray();
      let currentTotalBytes = 0;
      for (const entry of allEntries) {
        currentTotalBytes += entry.byteSize;
      }

      if (currentTotalBytes <= this.quotaBytes) {
        return ok({ evictedBytes: 0, evictedKeys: [] });
      }

      // Only pack_audio and pack_svg participate in LRU eviction; user_recording is NEVER evicted here.
      const evictable = allEntries
        .filter((entry) => entry.kind === 'pack_audio' || entry.kind === 'pack_svg')
        .sort(
          (a, b) =>
            a.lastAccessedMs - b.lastAccessedMs ||
            a.createdAtMs - b.createdAtMs ||
            a.mediaKey.localeCompare(b.mediaKey),
        );

      let evictedBytes = 0;
      const evictedKeys: string[] = [];

      for (const entry of evictable) {
        if (currentTotalBytes <= this.quotaBytes) break;
        await this.binaryStore.deleteBinary(entry.mediaKey, entry.storageBackend);
        await this.db.mediaCacheIndex.delete(entry.mediaKey);
        currentTotalBytes -= entry.byteSize;
        evictedBytes += entry.byteSize;
        evictedKeys.push(entry.mediaKey);
      }

      return ok({ evictedBytes, evictedKeys });
    } catch (cause) {
      return err(toStorageError('Failed to run LRU cache eviction', cause));
    }
  }

  async clearDownloadedCaches(): Promise<Result<{ readonly clearedBytes: number }, StorageError>> {
    try {
      const allEntries = await this.db.mediaCacheIndex.toArray();
      let clearedBytes = 0;
      const packMediaKeys: string[] = [];

      for (const entry of allEntries) {
        if (entry.kind === 'pack_audio' || entry.kind === 'pack_svg') {
          await this.binaryStore.deleteBinary(entry.mediaKey, entry.storageBackend);
          packMediaKeys.push(entry.mediaKey);
          clearedBytes += entry.byteSize;
        }
      }

      if (packMediaKeys.length > 0) {
        await this.db.mediaCacheIndex.bulkDelete(packMediaKeys);
      }

      const packs = await this.db.catalogPacks.toArray();
      if (packs.length > 0) {
        const now = this.clock.nowMs();
        await this.db.catalogPacks.bulkPut(
          packs.map((pack) => ({
            ...pack,
            isCachedOffline: 0 as const,
            bundleJson: null,
            cachedMediaInline: null,
            sizeBytes: 0,
            cachedAtMs: null,
            updatedAtMs: now,
          })),
        );
      }

      return ok({ clearedBytes });
    } catch (cause) {
      return err(toStorageError('Failed to clear downloaded caches', cause));
    }
  }

  async eraseAllCachedMedia(): Promise<Result<void, StorageError>> {
    try {
      await this.binaryStore.clearAllBinaries();
      await this.db.mediaCacheIndex.clear();
      const packs = await this.db.catalogPacks.toArray();
      if (packs.length > 0) {
        const now = this.clock.nowMs();
        await this.db.catalogPacks.bulkPut(
          packs.map((pack) => ({
            ...pack,
            isCachedOffline: 0 as const,
            bundleJson: null,
            cachedMediaInline: null,
            sizeBytes: 0,
            cachedAtMs: null,
            updatedAtMs: now,
          })),
        );
      }
      return ok(undefined);
    } catch (cause) {
      return err(toStorageError('Failed to erase all cached media', cause));
    }
  }
}

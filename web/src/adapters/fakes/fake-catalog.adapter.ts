import {
  computeCanonicalBundleSha256,
  sha256Hex,
  THIRTY_DAYS_MS,
} from '@/adapters/media/opfs-catalog.adapter';
import {
  type CachedAudioBytes,
  type CachedMediaSourceInput,
  type CacheEvictionResult,
  type CacheUsageSummary,
  type CatalogError,
  type CatalogGatewayError,
  type CatalogPackFilter,
  type ExamBundlePayload,
  type ICatalogMediaGateway,
  MEDIA_CACHE_QUOTA_BYTES,
  type PutUserRecordingInput,
} from '@/gateways/catalog.gateway';
import {
  err,
  ok,
  type NetworkError,
  type Result,
  type StorageError,
} from '@/gateways/result';
import type {
  CachedDrillRecord,
  CatalogPackRecord,
  MediaCacheIndexRecord,
} from '@/gateways/storage.gateway';
import type { IClock } from '@/gateways/telemetry.gateway';
import { FakeClock } from './fake-clock';

export interface FakeCatalogAdapterOptions {
  readonly clock?: IClock;
  readonly quotaBytes?: number;
  readonly initialPacks?: readonly CatalogPackRecord[];
  readonly initialBundles?: Readonly<Record<string, ExamBundlePayload>>;
  readonly initialDrills?: readonly CachedDrillRecord[];
  readonly initialMediaBytes?: Readonly<Record<string, { readonly bytes: Uint8Array; readonly mimeType: string }>>;
}

export class FakeCatalogAdapter implements ICatalogMediaGateway {
  private readonly clock: IClock;
  private readonly quotaBytes: number;
  private readonly packs = new Map<string, CatalogPackRecord>();
  private readonly bundles = new Map<string, ExamBundlePayload>();
  private readonly drills = new Map<string, CachedDrillRecord>();
  private readonly mediaIndex = new Map<string, MediaCacheIndexRecord>();
  private readonly mediaBytes = new Map<string, { readonly bytes: Uint8Array; readonly mimeType: string }>();
  private simulateOffline = false;

  constructor(options: FakeCatalogAdapterOptions = {}) {
    this.clock = options.clock ?? new FakeClock();
    this.quotaBytes = options.quotaBytes ?? MEDIA_CACHE_QUOTA_BYTES;

    for (const pack of options.initialPacks ?? []) {
      this.packs.set(pack.packId, pack);
    }
    for (const [packId, bundle] of Object.entries(options.initialBundles ?? {})) {
      this.bundles.set(packId, bundle);
    }
    for (const drill of options.initialDrills ?? []) {
      this.drills.set(drill.drillId, drill);
    }
    for (const [urlOrKey, asset] of Object.entries(options.initialMediaBytes ?? {})) {
      this.mediaBytes.set(urlOrKey, asset);
    }
  }

  setOffline(offline: boolean): void {
    this.simulateOffline = offline;
  }

  seedPackAndBundle(pack: CatalogPackRecord, bundle: ExamBundlePayload): void {
    this.packs.set(pack.packId, pack);
    this.bundles.set(pack.packId, bundle);
  }

  seedDrills(drills: readonly CachedDrillRecord[]): void {
    for (const drill of drills) {
      this.drills.set(drill.drillId, drill);
    }
  }

  seedRemoteMedia(urlOrKey: string, bytes: Uint8Array, mimeType: string): void {
    this.mediaBytes.set(urlOrKey, { bytes, mimeType });
  }

  getMediaIndexEntries(): readonly MediaCacheIndexRecord[] {
    return Array.from(this.mediaIndex.values());
  }

  setMediaIndexRecordForTest(record: MediaCacheIndexRecord): void {
    this.mediaIndex.set(record.mediaKey, record);
  }

  async deleteMediaBinary(mediaKey: string): Promise<void> {
    this.mediaBytes.delete(mediaKey);
    this.mediaIndex.delete(mediaKey);
  }

  async syncCatalogManifest(): Promise<Result<readonly CatalogPackRecord[], CatalogGatewayError>> {
    if (this.simulateOffline) {
      return err<NetworkError>({
        kind: 'network',
        message: 'FakeCatalogAdapter is offline',
        retryable: true,
      });
    }
    return ok(Array.from(this.packs.values()));
  }

  async listPacks(
    filter?: CatalogPackFilter,
  ): Promise<Result<readonly CatalogPackRecord[], StorageError>> {
    const items = Array.from(this.packs.values())
      .filter((pack) => {
        if (filter?.examId && pack.examId !== filter.examId) return false;
        if (filter?.skill && pack.skill !== filter.skill) return false;
        if (filter?.cachedOnly && pack.isCachedOffline !== 1) return false;
        if (filter?.freeOnly && !pack.isFreeSample) return false;
        return true;
      })
      .sort((a, b) => a.skill.localeCompare(b.skill) || a.packId.localeCompare(b.packId));
    return ok(items);
  }

  async ensureExamBundle(packId: string): Promise<Result<ExamBundlePayload, CatalogGatewayError>> {
    const existing = this.packs.get(packId);
    if (existing && existing.isCachedOffline === 1 && existing.bundleJson) {
      try {
        const parsed = JSON.parse(existing.bundleJson) as ExamBundlePayload;
        const isStale =
          parsed.pack.version !== existing.version ||
          parsed.pack.sha256.toLowerCase() !== existing.sha256.toLowerCase();
        if (!isStale) {
          return ok(parsed);
        }
        const refreshed = await this.downloadExamPack(packId);
        if (refreshed.ok && refreshed.value.bundleJson) {
          return ok(JSON.parse(refreshed.value.bundleJson) as ExamBundlePayload);
        }
        if (!refreshed.ok) {
          if (refreshed.error.kind === 'network') {
            return ok(parsed);
          }
          return err(refreshed.error);
        }
      } catch {
        // Corrupt cached bundle: fall through to download.
      }
    }
    const downloaded = await this.downloadExamPack(packId);
    if (!downloaded.ok) return downloaded;
    return ok(JSON.parse(downloaded.value.bundleJson!) as ExamBundlePayload);
  }

  async downloadExamPack(
    packId: string,
  ): Promise<Result<CatalogPackRecord, CatalogGatewayError>> {
    if (this.simulateOffline) {
      return err<NetworkError>({
        kind: 'network',
        message: 'FakeCatalogAdapter is offline',
        retryable: true,
      });
    }

    const bundle = this.bundles.get(packId);
    if (!bundle) {
      return err<NetworkError>({
        kind: 'network',
        message: `Pack not found: ${packId}`,
        retryable: false,
        status: 404,
      });
    }

    const declaredSha = bundle.pack.sha256.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(declaredSha)) {
      return err({
        kind: 'storage',
        code: 'SHA256_MISMATCH',
        message: `Invalid SHA-256 on pack ${packId}`,
      });
    }
    const computedSha = await computeCanonicalBundleSha256(bundle.sections, bundle.questions);
    if (computedSha !== declaredSha) {
      return err({
        kind: 'storage',
        code: 'SHA256_MISMATCH',
        message: `SHA-256 verification failed for ${packId}`,
      });
    }

    const now = this.clock.nowMs();
    const cachedMediaInline: Record<string, string> = {};
    let mediaTotalBytes = 0;

    const mediaUrls = new Set<string>();
    if (bundle.pack.mediaUrl) mediaUrls.add(bundle.pack.mediaUrl);
    for (const section of bundle.sections) {
      if (section.mediaUrl) mediaUrls.add(section.mediaUrl);
    }

    for (const url of mediaUrls) {
      const asset = this.mediaBytes.get(url);
      if (!asset || asset.bytes.byteLength === 0) {
        return err<NetworkError>({
          kind: 'network',
          message: `Missing remote media asset: ${url}`,
          retryable: true,
          status: 404,
        });
      }
      const mediaKey = `pack:${packId}:${url}`;
      const sha256 = await sha256Hex(asset.bytes);
      const isSvg = asset.mimeType.includes('svg') || url.endsWith('.svg');
      if (isSvg) {
        cachedMediaInline[url] = new TextDecoder().decode(asset.bytes);
      }
      this.mediaBytes.set(mediaKey, asset);
      this.mediaIndex.set(mediaKey, {
        mediaKey,
        kind: isSvg ? 'pack_svg' : 'pack_audio',
        storageBackend: 'opfs',
        mimeType: asset.mimeType,
        sha256,
        byteSize: asset.bytes.byteLength,
        attemptId: null,
        partIndex: null,
        durationMs: null,
        remoteObjectKey: null,
        lastAccessedMs: now,
        createdAtMs: now,
        expiresAtMs: null,
      });
      mediaTotalBytes += asset.bytes.byteLength;
    }

    const bundleJson = JSON.stringify(bundle);
    const prev = this.packs.get(packId);
    const record: CatalogPackRecord = {
      packId: bundle.pack.packId,
      edition: bundle.pack.edition,
      examId: bundle.pack.examId as CatalogPackRecord['examId'],
      track: bundle.pack.track,
      skill: bundle.pack.skill as CatalogPackRecord['skill'],
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
      sizeBytes: new TextEncoder().encode(bundleJson).byteLength + mediaTotalBytes,
      cachedAtMs: now,
      updatedAtMs: now,
      kind: prev?.kind ?? 'pack',
    };
    this.packs.set(packId, record);
    await this.evictLruIfOverQuota();
    return ok(record);
  }

  async syncDrills(): Promise<Result<readonly CachedDrillRecord[], CatalogError>> {
    if (this.simulateOffline) {
      return err<NetworkError>({
        kind: 'network',
        message: 'FakeCatalogAdapter is offline',
        retryable: true,
      });
    }
    return ok(Array.from(this.drills.values()));
  }

  async listCachedDrills(filter?: {
    readonly skill?: CachedDrillRecord['skill'];
    readonly drillType?: string;
  }): Promise<Result<readonly CachedDrillRecord[], StorageError>> {
    const items = Array.from(this.drills.values())
      .filter((d) => {
        if (filter?.skill && d.skill !== filter.skill) return false;
        if (filter?.drillType && d.drillType !== filter.drillType) return false;
        return true;
      })
      .sort((a, b) => a.skill.localeCompare(b.skill) || a.drillId.localeCompare(b.drillId));
    return ok(items);
  }

  async getCachedDrillById(
    drillId: string,
  ): Promise<Result<CachedDrillRecord | null, StorageError>> {
    return ok(this.drills.get(drillId) ?? null);
  }

  async getCachedMediaUrl(
    input: CachedMediaSourceInput,
  ): Promise<Result<string, NetworkError | StorageError>> {
    const existing = this.mediaIndex.get(input.mediaKey);
    const stored = this.mediaBytes.get(input.mediaKey);
    if (existing && stored) {
      if (
        input.expectedSha256 &&
        existing.sha256.toLowerCase() !== input.expectedSha256.toLowerCase()
      ) {
        this.mediaBytes.delete(input.mediaKey);
        this.mediaIndex.delete(input.mediaKey);
        return err({
          kind: 'storage',
          code: 'SHA256_MISMATCH',
          message: `Cached media SHA-256 mismatch for ${input.mediaKey}`,
        });
      }
      this.mediaIndex.set(input.mediaKey, {
        ...existing,
        lastAccessedMs: this.clock.nowMs(),
      });
      return ok(`blob:fake-media/${encodeURIComponent(input.mediaKey)}`);
    }

    if (this.simulateOffline) {
      return err<NetworkError>({
        kind: 'network',
        message: `Offline fetching media ${input.mediaKey}`,
        retryable: true,
      });
    }

    const remote = this.mediaBytes.get(input.fallbackUrl);
    if (!remote) {
      return err<NetworkError>({
        kind: 'network',
        message: `Remote media not found: ${input.fallbackUrl}`,
        retryable: false,
        status: 404,
      });
    }

    const sha256 = await sha256Hex(remote.bytes);
    if (
      input.expectedSha256 &&
      sha256.toLowerCase() !== input.expectedSha256.toLowerCase()
    ) {
      return err({
        kind: 'storage',
        code: 'SHA256_MISMATCH',
        message: `Remote media SHA-256 mismatch for ${input.mediaKey}`,
      });
    }

    const now = this.clock.nowMs();
    this.mediaBytes.set(input.mediaKey, remote);
    this.mediaIndex.set(input.mediaKey, {
      mediaKey: input.mediaKey,
      kind: remote.mimeType.includes('svg') ? 'pack_svg' : 'pack_audio',
      storageBackend: 'opfs',
      mimeType: remote.mimeType,
      sha256,
      byteSize: remote.bytes.byteLength,
      attemptId: null,
      partIndex: null,
      durationMs: null,
      remoteObjectKey: null,
      lastAccessedMs: now,
      createdAtMs: now,
      expiresAtMs: null,
    });
    await this.evictLruIfOverQuota();
    return ok(`blob:fake-media/${encodeURIComponent(input.mediaKey)}`);
  }

  async putUserRecording(
    input: PutUserRecordingInput,
  ): Promise<Result<MediaCacheIndexRecord, StorageError>> {
    const bytes = new Uint8Array(await input.blob.arrayBuffer());
    const sha256 = await sha256Hex(bytes);
    const mimeType = input.mimeType ?? (input.blob.type || 'audio/mp4');
    const now = this.clock.nowMs();
    this.mediaBytes.set(input.clipId, { bytes, mimeType });
    const record: MediaCacheIndexRecord = {
      mediaKey: input.clipId,
      kind: 'user_recording',
      storageBackend: 'opfs',
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
    this.mediaIndex.set(input.clipId, record);
    return ok(record);
  }

  async readUserRecordingBytes(
    mediaKey: string,
  ): Promise<Result<CachedAudioBytes, StorageError>> {
    const index = this.mediaIndex.get(mediaKey);
    const stored = this.mediaBytes.get(mediaKey);
    if (!index || !stored) {
      return err({
        kind: 'storage',
        code: 'NOT_FOUND',
        message: `Recording not found: ${mediaKey}`,
      });
    }
    this.mediaIndex.set(mediaKey, {
      ...index,
      lastAccessedMs: this.clock.nowMs(),
    });
    return ok({
      bytes: stored.bytes,
      mimeType: index.mimeType,
      sha256: index.sha256,
    });
  }

  async listRecordingsForAttempt(
    attemptId: string,
  ): Promise<Result<readonly MediaCacheIndexRecord[], StorageError>> {
    const rows = Array.from(this.mediaIndex.values())
      .filter((r) => r.kind === 'user_recording' && r.attemptId === attemptId)
      .sort((a, b) => (a.partIndex ?? 0) - (b.partIndex ?? 0));
    return ok(rows);
  }

  async updateRecordingRemoteKey(
    mediaKey: string,
    remoteObjectKey: string,
  ): Promise<Result<void, StorageError>> {
    const existing = this.mediaIndex.get(mediaKey);
    if (!existing) {
      return err({
        kind: 'storage',
        code: 'NOT_FOUND',
        message: `Recording not found: ${mediaKey}`,
      });
    }
    this.mediaIndex.set(mediaKey, {
      ...existing,
      remoteObjectKey,
    });
    return ok(undefined);
  }

  async getCacheUsageSummary(): Promise<Result<CacheUsageSummary, StorageError>> {
    let totalBytes = 0;
    let userRecordingBytes = 0;
    for (const entry of this.mediaIndex.values()) {
      totalBytes += entry.byteSize;
      if (entry.kind === 'user_recording') {
        userRecordingBytes += entry.byteSize;
      }
    }
    const packCount = Array.from(this.packs.values()).filter(
      (p) => p.isCachedOffline === 1,
    ).length;
    return ok({
      totalBytes,
      quotaBytes: this.quotaBytes as typeof MEDIA_CACHE_QUOTA_BYTES,
      packCount,
      userRecordingBytes,
    });
  }

  async evictLruIfOverQuota(): Promise<Result<CacheEvictionResult, StorageError>> {
    const all = Array.from(this.mediaIndex.values());
    let currentTotal = all.reduce((sum, e) => sum + e.byteSize, 0);
    if (currentTotal <= this.quotaBytes) {
      return ok({ evictedBytes: 0, evictedKeys: [] });
    }

    const evictable = all
      .filter((e) => e.kind === 'pack_audio' || e.kind === 'pack_svg')
      .sort(
        (a, b) =>
          a.lastAccessedMs - b.lastAccessedMs ||
          a.createdAtMs - b.createdAtMs ||
          a.mediaKey.localeCompare(b.mediaKey),
      );

    let evictedBytes = 0;
    const evictedKeys: string[] = [];
    for (const entry of evictable) {
      if (currentTotal <= this.quotaBytes) break;
      this.mediaBytes.delete(entry.mediaKey);
      this.mediaIndex.delete(entry.mediaKey);
      currentTotal -= entry.byteSize;
      evictedBytes += entry.byteSize;
      evictedKeys.push(entry.mediaKey);
    }

    return ok({ evictedBytes, evictedKeys });
  }

  async clearDownloadedCaches(): Promise<Result<{ readonly clearedBytes: number }, StorageError>> {
    let clearedBytes = 0;
    for (const entry of Array.from(this.mediaIndex.values())) {
      if (entry.kind === 'pack_audio' || entry.kind === 'pack_svg') {
        this.mediaBytes.delete(entry.mediaKey);
        this.mediaIndex.delete(entry.mediaKey);
        clearedBytes += entry.byteSize;
      }
    }
    const now = this.clock.nowMs();
    for (const [packId, pack] of this.packs.entries()) {
      this.packs.set(packId, {
        ...pack,
        isCachedOffline: 0,
        bundleJson: null,
        cachedMediaInline: null,
        sizeBytes: 0,
        cachedAtMs: null,
        updatedAtMs: now,
      });
    }
    return ok({ clearedBytes });
  }

  async eraseAllCachedMedia(): Promise<Result<void, StorageError>> {
    this.mediaBytes.clear();
    this.mediaIndex.clear();
    const now = this.clock.nowMs();
    for (const [packId, pack] of this.packs.entries()) {
      this.packs.set(packId, {
        ...pack,
        isCachedOffline: 0,
        bundleJson: null,
        cachedMediaInline: null,
        sizeBytes: 0,
        cachedAtMs: null,
        updatedAtMs: now,
      });
    }
    return ok(undefined);
  }
}

import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { MockzaDexieDb } from '@/adapters/dexie/mockza-db';
import { FakeCatalogAdapter } from '@/adapters/fakes/fake-catalog.adapter';
import { FakeClock } from '@/adapters/fakes/fake-clock';
import { ApiClient } from '@/adapters/http/api-client';
import {
  OpfsCatalogAdapter,
  computeCanonicalBundleSha256,
  sha256Hex,
} from '@/adapters/media/opfs-catalog.adapter';
import type { ExamBundlePayload, ICatalogMediaGateway } from '@/gateways/catalog.gateway';
import type { CachedDrillRecord, CatalogPackRecord } from '@/gateways/storage.gateway';

interface CatalogContractHarness {
  readonly clock: FakeClock;
  readonly catalog: ICatalogMediaGateway;
  setTamperedPackHash(packId: string): void;
  setOffline(offline: boolean): void;
  bumpManifestVersion(packId: string, newVersion: string): Promise<void>;
  cleanup(): Promise<void>;
}

async function createSampleBundle(packId: string, mediaUrl: string | null = '/media/sample.svg'): Promise<ExamBundlePayload> {
  const sections: ExamBundlePayload['sections'] = [
    {
      sectionId: 'sec-1',
      sectionIndex: 1,
      sectionType: 'passage',
      title: 'Section 1',
      instructions: 'Read carefully',
      contentText: 'Sample passage text',
      paragraphs: null,
      transcript: null,
      mediaUrl,
      durationSeconds: 600,
      wordCount: 3,
      metadata: null,
    },
  ];
  const questions: ExamBundlePayload['questions'] = [
    {
      questionId: 'q-1',
      sectionId: 'sec-1',
      questionNumber: 1,
      questionType: 'single_choice',
      prompt: 'Choose A',
      options: ['A', 'B'],
      acceptedAnswers: ['A'],
      maxWords: null,
      evidence: null,
      cueTimestampMs: null,
    },
  ];
  const sha256 = await computeCanonicalBundleSha256(sections, questions);
  return {
    pack: {
      packId,
      edition: 'glb',
      examId: 'ielts_academic',
      skill: 'reading',
      track: 'academic',
      title: `Pack ${packId}`,
      description: 'Test pack',
      durationSeconds: 1200,
      questionCount: 1,
      accent: null,
      mediaUrl,
      version: '1.0.0',
      sha256,
      byteLength: 512,
      downloadUrl: `/v1/exams/${packId}`,
      contentOrigin: 'authored_original',
      humanQaReviewed: true,
      isFreeSample: true,
    },
    sections,
    questions,
  };
}

function runCatalogContractSuite(
  name: string,
  createHarness: (options?: { readonly quotaBytes?: number }) => Promise<CatalogContractHarness>,
) {
  describe(`ICatalogMediaGateway LSP contract: ${name}`, () => {
    let harness: CatalogContractHarness | null = null;

    afterEach(async () => {
      if (harness) {
        await harness.cleanup();
        harness = null;
      }
    });

    it('syncs catalog manifest, filters packs, verifies SHA-256 on download, and rejects tampered bundles', async () => {
      harness = await createHarness();
      const syncRes = await harness.catalog.syncCatalogManifest();
      expect(syncRes.ok).toBe(true);

      const listAll = await harness.catalog.listPacks();
      expect(listAll.ok && listAll.value.length).toBeGreaterThanOrEqual(2);

      const ensured = await harness.catalog.ensureExamBundle('pack-valid');
      expect(ensured.ok).toBe(true);
      if (ensured.ok) {
        expect(ensured.value.pack.packId).toBe('pack-valid');
      }

      const cachedList = await harness.catalog.listPacks({ cachedOnly: true });
      expect(cachedList.ok && cachedList.value.some((p) => p.packId === 'pack-valid')).toBe(true);

      harness.setTamperedPackHash('pack-tampered');
      const badRes = await harness.catalog.downloadExamPack('pack-tampered');
      expect(badRes.ok).toBe(false);
      if (!badRes.ok && badRes.error.kind === 'storage') {
        expect(badRes.error.code).toBe('SHA256_MISMATCH');
      }
    });

    it('syncs and queries micro-drills', async () => {
      harness = await createHarness();
      const synced = await harness.catalog.syncDrills();
      expect(synced.ok && synced.value).toHaveLength(1);

      const listed = await harness.catalog.listCachedDrills({ skill: 'reading' });
      expect(listed.ok && listed.value).toHaveLength(1);

      const byId = await harness.catalog.getCachedDrillById('drill-colloc-1');
      expect(byId.ok && byId.value?.drillId).toBe('drill-colloc-1');
    });

    it('stores user recordings, protects them during LRU eviction, and clears pack caches', async () => {
      harness = await createHarness();

      await harness.catalog.downloadExamPack('pack-valid');
      const recRes = await harness.catalog.putUserRecording({
        clipId: 'rec-attempt-1',
        blob: new Blob([new Uint8Array([10, 20, 30, 40])], { type: 'audio/mp4' }),
        attemptId: 'att-speaking-99',
        partIndex: 1,
        durationMs: 1500,
      });
      expect(recRes.ok).toBe(true);

      const updateKey = await harness.catalog.updateRecordingRemoteKey(
        'rec-attempt-1',
        'users/u1/clips/att-speaking-99/p1.m4a',
      );
      expect(updateKey.ok).toBe(true);

      const forAttempt = await harness.catalog.listRecordingsForAttempt('att-speaking-99');
      expect(forAttempt.ok && forAttempt.value[0]?.remoteObjectKey).toBe(
        'users/u1/clips/att-speaking-99/p1.m4a',
      );

      const bytesRes = await harness.catalog.readUserRecordingBytes('rec-attempt-1');
      expect(bytesRes.ok && Array.from(bytesRes.value.bytes)).toEqual([10, 20, 30, 40]);

      const usage = await harness.catalog.getCacheUsageSummary();
      expect(usage.ok && usage.value.totalBytes).toBeGreaterThan(0);

      const cleared = await harness.catalog.clearDownloadedCaches();
      expect(cleared.ok).toBe(true);
      // User recording must still exist after clearing downloaded pack caches
      const stillPresent = await harness.catalog.readUserRecordingBytes('rec-attempt-1');
      expect(stillPresent.ok).toBe(true);

      await harness.catalog.eraseAllCachedMedia();
      const gone = await harness.catalog.readUserRecordingBytes('rec-attempt-1');
      expect(gone.ok).toBe(false);
    });

    it('falls back to stale cached bundle when offline during ensureExamBundle', async () => {
      harness = await createHarness();
      await harness.catalog.syncCatalogManifest();
      const first = await harness.catalog.ensureExamBundle('pack-valid');
      expect(first.ok).toBe(true);

      await harness.bumpManifestVersion('pack-valid', '2.0.0');
      await harness.catalog.syncCatalogManifest();
      harness.setOffline(true);

      const fallback = await harness.catalog.ensureExamBundle('pack-valid');
      expect(fallback.ok).toBe(true);
      if (fallback.ok) {
        expect(fallback.value.pack.version).toBe('1.0.0');
      }
    });

    it('resolves getCachedMediaUrl() with SHA-256 verification and offline cache hit', async () => {
      harness = await createHarness();
      const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
      const validSha = await sha256Hex(svgBytes);

      const firstUrl = await harness.catalog.getCachedMediaUrl({
        mediaKey: 'media-svg-1',
        fallbackUrl: '/media/sample.svg',
        expectedSha256: validSha,
      });
      expect(firstUrl.ok).toBe(true);
      if (firstUrl.ok) {
        expect(firstUrl.value.length).toBeGreaterThan(0);
      }

      // Offline cache hit returns URL without network
      harness.setOffline(true);
      const cachedUrl = await harness.catalog.getCachedMediaUrl({
        mediaKey: 'media-svg-1',
        fallbackUrl: '/media/sample.svg',
        expectedSha256: validSha,
      });
      expect(cachedUrl.ok).toBe(true);

      // SHA-256 mismatch rejects corrupted/tampered media
      const mismatch = await harness.catalog.getCachedMediaUrl({
        mediaKey: 'media-svg-1',
        fallbackUrl: '/media/sample.svg',
        expectedSha256: '0'.repeat(64),
      });
      expect(mismatch.ok).toBe(false);
      if (!mismatch.ok && mismatch.error.kind === 'storage') {
        expect(mismatch.error.code).toBe('SHA256_MISMATCH');
      }
    });

    it('evicts oldest pack media via evictLruIfOverQuota while protecting user recordings and reporting quotaBytes', async () => {
      harness = await createHarness({ quotaBytes: 210 });
      const initialSummary = await harness.catalog.getCacheUsageSummary();
      expect(initialSummary.ok && initialSummary.value.quotaBytes).toBe(210);

      // Fetch two pack media items totaling 46 + 155 = 201 bytes (<= 210 quota)
      const m1 = await harness.catalog.getCachedMediaUrl({
        mediaKey: 'pack:lru:1',
        fallbackUrl: '/media/sample.svg',
      });
      expect(m1.ok).toBe(true);

      harness.clock.advanceByMs(1_000);
      const m2 = await harness.catalog.getCachedMediaUrl({
        mediaKey: 'pack:lru:2',
        fallbackUrl: '/media/large.svg',
      });
      expect(m2.ok).toBe(true);

      // Add a 20-byte user recording -> total 221 > 210 quota; user_recording must NEVER be evicted
      harness.clock.advanceByMs(1_000);
      await harness.catalog.putUserRecording({
        clipId: 'rec-keep-lru',
        blob: new Blob([new Uint8Array(20)], { type: 'audio/mp4' }),
        attemptId: 'att-lru-1',
        partIndex: 1,
        durationMs: 500,
      });

      const evictRes = await harness.catalog.evictLruIfOverQuota();
      expect(evictRes.ok).toBe(true);
      if (evictRes.ok) {
        expect(evictRes.value.evictedKeys).toEqual(['pack:lru:1']);
        expect(evictRes.value.evictedBytes).toBeGreaterThan(0);
      }

      const recordingStillThere = await harness.catalog.readUserRecordingBytes('rec-keep-lru');
      expect(recordingStillThere.ok).toBe(true);
    });
  });
}

runCatalogContractSuite('FakeCatalogAdapter', async (options) => {
  const clock = new FakeClock();
  const validBundle = await createSampleBundle('pack-valid');
  const tamperedBundle = await createSampleBundle('pack-tampered');
  const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  const largeSvgBytes = new TextEncoder().encode(
    `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${'x'.repeat(100)} --></svg>`,
  );

  const toPackRecord = (b: ExamBundlePayload): CatalogPackRecord => ({
    packId: b.pack.packId,
    edition: b.pack.edition,
    examId: b.pack.examId as CatalogPackRecord['examId'],
    track: b.pack.track,
    skill: b.pack.skill as CatalogPackRecord['skill'],
    title: b.pack.title,
    description: b.pack.description,
    durationSeconds: b.pack.durationSeconds,
    questionCount: b.pack.questionCount,
    accent: b.pack.accent ?? null,
    mediaUrl: b.pack.mediaUrl ?? null,
    downloadUrl: b.pack.downloadUrl,
    version: b.pack.version,
    sha256: b.pack.sha256,
    byteLength: b.pack.byteLength,
    isFreeSample: b.pack.isFreeSample,
    isCachedOffline: 0,
    bundleJson: null,
    cachedMediaInline: null,
    sizeBytes: 0,
    cachedAtMs: null,
    updatedAtMs: clock.nowMs(),
  });

  const drill: CachedDrillRecord = {
    drillId: 'drill-colloc-1',
    title: 'Collocations',
    drillType: 'collocations',
    skill: 'reading',
    durationSeconds: 180,
    itemsJson: '[]',
    updatedAtMs: clock.nowMs(),
  };

  const fake = new FakeCatalogAdapter({
    clock,
    quotaBytes: options?.quotaBytes,
    initialDrills: [drill],
    initialMediaBytes: {
      '/media/sample.svg': { bytes: svgBytes, mimeType: 'image/svg+xml' },
      '/media/large.svg': { bytes: largeSvgBytes, mimeType: 'image/svg+xml' },
    },
  });
  fake.seedPackAndBundle(toPackRecord(validBundle), validBundle);
  fake.seedPackAndBundle(toPackRecord(tamperedBundle), tamperedBundle);

  return {
    clock,
    catalog: fake,
    setTamperedPackHash: (packId) => {
      const badBundle: ExamBundlePayload = {
        ...tamperedBundle,
        pack: { ...tamperedBundle.pack, packId, sha256: 'f'.repeat(64) },
      };
      fake.seedPackAndBundle(toPackRecord(badBundle), badBundle);
    },
    setOffline: (offline) => {
      fake.setOffline(offline);
    },
    bumpManifestVersion: async (packId, newVersion) => {
      const listed = await fake.listPacks();
      const existing = listed.ok ? listed.value.find((p) => p.packId === packId) : undefined;
      if (existing) {
        fake.seedPackAndBundle(
          { ...existing, version: newVersion },
          { ...validBundle, pack: { ...validBundle.pack, version: newVersion } },
        );
      }
    },
    cleanup: async () => {},
  };
});

runCatalogContractSuite('OpfsCatalogAdapter (Dexie + BinaryStore)', async (options) => {
  const clock = new FakeClock();
  const db = new MockzaDexieDb(`contract-catalog-${Date.now()}-${Math.random()}`);
  let validBundle = await createSampleBundle('pack-valid');
  let manifestPackValid = validBundle.pack;
  let tamperedBundle = await createSampleBundle('pack-tampered');
  const svgText = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
  const largeSvgText = `<svg xmlns="http://www.w3.org/2000/svg"><!-- ${'x'.repeat(100)} --></svg>`;
  let offline = false;

  const fetchFn: typeof fetch = async (input) => {
    if (offline) {
      throw new TypeError('Network offline');
    }
    const url = typeof input === 'string' ? input : input.toString();
    const path = new URL(url, 'https://api.mockza.com').pathname;

    if (path === '/v1/catalog/manifest') {
      return new Response(
        JSON.stringify({
          edition: 'glb',
          generatedAt: clock.nowIso(),
          packs: [manifestPackValid, tamperedBundle.pack],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (path === '/v1/exams/pack-valid') {
      return new Response(JSON.stringify(validBundle), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (path === '/v1/exams/pack-tampered') {
      return new Response(JSON.stringify(tamperedBundle), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (path === '/v1/drills') {
      return new Response(
        JSON.stringify({
          drills: [
            {
              drillId: 'drill-colloc-1',
              title: 'Collocations',
              drillType: 'collocations',
              skill: 'reading',
              durationSeconds: 180,
              items: [],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (path === '/media/sample.svg') {
      return new Response(svgText, {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' },
      });
    }
    if (path === '/media/large.svg') {
      return new Response(largeSvgText, {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' },
      });
    }
    return new Response('Not found', { status: 404 });
  };

  const apiClient = new ApiClient({
    apiBaseUrl: 'https://api.mockza.com',
    edition: 'glb',
    fetchFn,
    readAccessToken: () => 'test-token',
  });

  const adapter = new OpfsCatalogAdapter({
    db,
    edition: 'glb',
    clock,
    apiClient,
    fetchFn,
    apiBaseUrl: 'https://api.mockza.com',
    cdnBaseUrl: 'https://cdn.mockza.com',
    quotaBytes: options?.quotaBytes,
    binaryStoreOptions: {
      disableOpfs: true,
      disableCacheStorage: true,
      idbDbName: `contract-cat-blobs-${Date.now()}-${Math.random()}`,
    },
  });

  return {
    clock,
    catalog: adapter,
    setTamperedPackHash: () => {
      tamperedBundle = {
        ...tamperedBundle,
        pack: { ...tamperedBundle.pack, sha256: 'a'.repeat(64) },
      };
    },
    setOffline: (nextOffline) => {
      offline = nextOffline;
    },
    bumpManifestVersion: async (_packId, newVersion) => {
      manifestPackValid = { ...manifestPackValid, version: newVersion };
      validBundle = { ...validBundle, pack: { ...validBundle.pack, version: newVersion } };
    },
    cleanup: async () => {
      await db.delete();
    },
  };
});

describe('OpfsCatalogAdapter ApiClient 401 SESSION_REVOKED propagation', () => {
  it('triggers onSessionRevoked via ApiClient on 401 SESSION_REVOKED during syncCatalogManifest', async () => {
    const db = new MockzaDexieDb(`contract-cat-401-${Date.now()}-${Math.random()}`);
    let revokedCount = 0;
    let refreshCalls = 0;

    const fetchFn: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          code: 'unauthorized',
          reasonCode: 'SESSION_REVOKED',
          message: 'Revoked',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );

    const apiClient = new ApiClient({
      apiBaseUrl: 'https://api.mockza.com',
      edition: 'glb',
      fetchFn,
      readAccessToken: () => 'user-token',
      refreshAccessToken: async () => {
        refreshCalls++;
        return 'anon-token';
      },
      onSessionRevoked: () => {
        revokedCount++;
      },
    });

    const adapter = new OpfsCatalogAdapter({
      db,
      edition: 'glb',
      apiClient,
      fetchFn,
      apiBaseUrl: 'https://api.mockza.com',
      cdnBaseUrl: 'https://cdn.mockza.com',
      binaryStoreOptions: {
        disableOpfs: true,
        disableCacheStorage: true,
        idbDbName: `contract-cat-401-blobs-${Date.now()}-${Math.random()}`,
      },
    });

    const res = await adapter.syncCatalogManifest();
    expect(res.ok).toBe(false);
    expect(refreshCalls).toBe(0);
    expect(revokedCount).toBe(1);
    await db.delete();
  });
});

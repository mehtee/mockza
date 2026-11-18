import 'fake-indexeddb/auto';
import { serialDayFromUtcMs } from '@mockza/domain';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MockzaDexieDb } from '@/adapters/dexie/mockza-db';
import {
  MediaBinaryStore,
  OpfsCatalogAdapter,
  type OpfsDirectoryHandleLike,
  computeCanonicalBundleSha256,
} from '@/adapters/media/opfs-catalog.adapter';
import {
  type AudioElementLike,
  WebAudioPlayerAdapter,
  WebAudioRecorderAdapter,
} from '@/adapters/media/web-audio.adapter';
import { MEDIA_CACHE_QUOTA_BYTES } from '@/gateways/catalog.gateway';
import type { IClock } from '@/gateways/telemetry.gateway';

function createFakeClock(initialMs: number): {
  clock: IClock;
  advanceMs: (deltaMs: number) => void;
} {
  let now = initialMs;
  return {
    clock: {
      nowMs: () => now,
      nowIso: () => new Date(now).toISOString(),
      todaySerialDay: () => serialDayFromUtcMs(now),
    },
    advanceMs: (deltaMs: number) => {
      now += deltaMs;
    },
  };
}

function createInMemoryOpfsRoot(): OpfsDirectoryHandleLike {
  const dirs = new Map<string, OpfsDirectoryHandleLike>();
  const files = new Map<string, Uint8Array>();

  const self: OpfsDirectoryHandleLike = {
    async getDirectoryHandle(name: string, options?: { create?: boolean }) {
      const existing = dirs.get(name);
      if (existing) return existing;
      if (!options?.create) {
        throw new Error(`Directory not found: ${name}`);
      }
      const created = createInMemoryOpfsRoot();
      dirs.set(name, created);
      return created;
    },
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!files.has(name) && !options?.create) {
        throw new Error(`File not found: ${name}`);
      }
      return {
        async getFile() {
          const data = files.get(name) ?? new Uint8Array(0);
          return new File([data.slice()], name);
        },
        async createWritable() {
          let pending = new Uint8Array(0);
          return {
            async write(chunk: ArrayBuffer | Uint8Array | Blob | string) {
              if (chunk instanceof Uint8Array) {
                pending = new Uint8Array(chunk);
              } else if (chunk instanceof ArrayBuffer) {
                pending = new Uint8Array(chunk);
              } else if (typeof chunk === 'string') {
                pending = new TextEncoder().encode(chunk);
              } else {
                pending = new Uint8Array(await chunk.arrayBuffer());
              }
            },
            async close() {
              files.set(name, pending);
            },
          };
        },
      };
    },
    async removeEntry(name: string) {
      files.delete(name);
      dirs.delete(name);
    },
    async *entries() {
      for (const [k, v] of files.entries()) {
        yield [k, v] as [string, unknown];
      }
    },
  };
  return self;
}

describe('W1.3 OpfsCatalogAdapter (SHA-256, OPFS/Cache/IDB, Drills, 250 MB LRU)', () => {
  let db: MockzaDexieDb;
  let fakeClock: ReturnType<typeof createFakeClock>;
  let dbCounter = 0;

  beforeEach(async () => {
    dbCounter++;
    fakeClock = createFakeClock(Date.UTC(2026, 10, 18, 12, 0, 0));
    db = new MockzaDexieDb(`mockza-test-catalog-${Date.now()}-${dbCounter}`);
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('computes key-order-invariant canonical SHA-256 and rejects tampered bundles', async () => {
    const sectionsA = [{ sectionId: 's1', title: 'Passage 1', meta: { b: 2, a: 1 } }];
    const questionsA = [{ questionId: 'q1', prompt: 'Question', options: ['A', 'B'] }];

    const sectionsB = [{ meta: { a: 1, b: 2 }, title: 'Passage 1', sectionId: 's1' }];
    const questionsB = [{ options: ['A', 'B'], prompt: 'Question', questionId: 'q1' }];

    const shaA = await computeCanonicalBundleSha256(sectionsA, questionsA);
    const shaB = await computeCanonicalBundleSha256(sectionsB, questionsB);
    expect(shaA).toMatch(/^[a-f0-9]{64}$/);
    expect(shaA).toBe(shaB);

    // Mock server returning a bundle with tampered SHA-256
    const badFetch: typeof fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          pack: {
            packId: 'pack-bad-sha',
            edition: 'glb',
            examId: 'ielts_academic',
            skill: 'reading',
            track: 'academic',
            title: 'Bad Pack',
            description: 'Tampered',
            durationSeconds: 3600,
            questionCount: 1,
            version: '1.0.0',
            sha256: 'f'.repeat(64),
            byteLength: 100,
            downloadUrl: '/v1/exams/pack-bad-sha',
            isFreeSample: true,
          },
          sections: sectionsA,
          questions: questionsA,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const catalog = new OpfsCatalogAdapter({
      db,
      edition: 'glb',
      clock: fakeClock.clock,
      fetchFn: badFetch,
      binaryStoreOptions: {
        opfsRootOverride: createInMemoryOpfsRoot(),
      },
    });

    const badRes = await catalog.downloadExamPack('pack-bad-sha');
    expect(badRes.ok).toBe(false);
    if (!badRes.ok && badRes.error.kind === 'storage') {
      expect(badRes.error.code).toBe('SHA256_MISMATCH');
    }

    // Valid bundle with SVG + audio + drills
    const validFetch: typeof fetch = vi.fn(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.endsWith('/v1/exams/pack-good-1')) {
        return new Response(
          JSON.stringify({
            pack: {
              packId: 'pack-good-1',
              edition: 'glb',
              examId: 'ielts_academic',
              skill: 'listening',
              track: 'academic',
              title: 'Listening Pack 1',
              description: 'With audio & chart',
              durationSeconds: 1800,
              questionCount: 10,
              mediaUrl: '/cdn/audio/pack1.m4a',
              version: '1.0.0',
              sha256: shaA,
              byteLength: 500,
              downloadUrl: '/v1/exams/pack-good-1',
              isFreeSample: true,
            },
            sections: [
              {
                ...sectionsA[0],
                mediaUrl: '/cdn/charts/chart1.svg',
              },
            ],
            questions: questionsA,
          }),
          { status: 200 },
        );
      }
      if (url.includes('chart1.svg')) {
        return new Response('<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="20"/></svg>', {
          status: 200,
          headers: { 'Content-Type': 'image/svg+xml' },
        });
      }
      if (url.includes('pack1.m4a')) {
        return new Response(new Uint8Array([10, 20, 30, 40, 50]), {
          status: 200,
          headers: { 'Content-Type': 'audio/mp4' },
        });
      }
      if (url.endsWith('/v1/drills')) {
        return new Response(
          JSON.stringify({
            drills: [
              {
                drillId: 'drill-lr-1',
                title: 'Lexical Collocations',
                drillType: 'LR',
                skill: 'reading',
                durationSeconds: 180,
                items: [{ id: 'i1', prompt: 'Pick collocation', options: ['a', 'b'], answer: 'a' }],
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response('Not Found', { status: 404 });
    });

    // Notice sections in validFetch added mediaUrl, so compute sha for those exact sections
    const validSha = await computeCanonicalBundleSha256(
      [{ ...sectionsA[0], mediaUrl: '/cdn/charts/chart1.svg' }],
      questionsA,
    );
    const catalogValid = new OpfsCatalogAdapter({
      db,
      edition: 'glb',
      clock: fakeClock.clock,
      fetchFn: async (input, init) => {
        const res = await validFetch(input, init);
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/v1/exams/pack-good-1')) {
          const text = await res.text();
          return new Response(text.replace(shaA, validSha), { status: 200 });
        }
        return res;
      },
      binaryStoreOptions: {
        opfsRootOverride: createInMemoryOpfsRoot(),
      },
    });

    const downloadOk = await catalogValid.downloadExamPack('pack-good-1');
    expect(downloadOk.ok).toBe(true);
    if (downloadOk.ok) {
      expect(downloadOk.value.isCachedOffline).toBe(1);
      expect(downloadOk.value.cachedMediaInline?.['/cdn/charts/chart1.svg']).toContain('<svg');
    }

    // Verify OPFS backend was used for mediaCacheIndex rows
    const audioIdx = await db.mediaCacheIndex.get('pack:pack-good-1:/cdn/audio/pack1.m4a');
    expect(audioIdx?.storageBackend).toBe('opfs');
    expect(audioIdx?.kind).toBe('pack_audio');

    // Sync & query CachedDrillRecord inside 14-table schema
    const drillsRes = await catalogValid.syncDrills();
    expect(drillsRes.ok).toBe(true);
    const listedDrills = await catalogValid.listCachedDrills({ skill: 'reading' });
    expect(listedDrills.ok && listedDrills.value).toHaveLength(1);
    const drillById = await catalogValid.getCachedDrillById('drill-lr-1');
    expect(drillById.ok && drillById.value?.title).toBe('Lexical Collocations');
    expect(db.tables).toHaveLength(14);
  });

  it('supports OPFS, Cache Storage fallback, and IDB fallback binary storage', async () => {
    const sampleBytes = new Uint8Array([1, 2, 3, 4, 5]);

    // 1. OPFS primary
    const opfsStore = new MediaBinaryStore({
      opfsRootOverride: createInMemoryOpfsRoot(),
      disableCacheStorage: true,
    });
    expect(await opfsStore.writeBinary('k1', sampleBytes, 'audio/mp4')).toBe('opfs');
    expect((await opfsStore.readBinary('k1', 'opfs'))?.bytes).toEqual(sampleBytes);

    // 2. Cache Storage fallback
    const cacheMap = new Map<string, Response>();
    const originalCaches = globalThis.caches;
    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: {
        open: async () => ({
          put: async (req: RequestInfo | URL, res: Response) => {
            cacheMap.set(String(req), res.clone());
          },
          match: async (req: RequestInfo | URL) => cacheMap.get(String(req))?.clone() ?? undefined,
          delete: async (req: RequestInfo | URL) => cacheMap.delete(String(req)),
        }),
        delete: async () => {
          cacheMap.clear();
          return true;
        },
      },
    });
    try {
      const cacheStore = new MediaBinaryStore({ disableOpfs: true });
      expect(await cacheStore.writeBinary('k2', sampleBytes, 'audio/webm')).toBe('cache');
      const readCache = await cacheStore.readBinary('k2', 'cache');
      expect(readCache?.bytes).toEqual(sampleBytes);
      expect(readCache?.mimeType).toBe('audio/webm');
    } finally {
      Object.defineProperty(globalThis, 'caches', {
        configurable: true,
        value: originalCaches,
      });
    }

    // 3. IDB fallback
    const idbStore = new MediaBinaryStore({
      disableOpfs: true,
      disableCacheStorage: true,
      idbDbName: `mockza-fallback-test-${Date.now()}`,
    });
    expect(await idbStore.writeBinary('k3', sampleBytes, 'audio/mp4')).toBe('idb_fallback');
    expect((await idbStore.readBinary('k3', 'idb_fallback'))?.bytes).toEqual(sampleBytes);
  });

  it('evicts oldest pack_audio/pack_svg entries over 250 MB quota via LRU and never evicts user_recording', async () => {
    expect(MEDIA_CACHE_QUOTA_BYTES).toBe(262_144_000);

    // Use a 1000-byte test quota to verify exact LRU math & binary deletion without allocating 250 MB in RAM
    const opfsRoot = createInMemoryOpfsRoot();
    const binaryStore = new MediaBinaryStore({ opfsRootOverride: opfsRoot, disableCacheStorage: true });
    const catalog = new OpfsCatalogAdapter({
      db,
      edition: 'glb',
      clock: fakeClock.clock,
      quotaBytes: 1000,
      binaryStore,
    });

    const t0 = fakeClock.clock.nowMs();

    // Write user_recording (500 bytes, oldest timestamp) -> MUST NEVER be evicted
    await binaryStore.writeBinary('rec-active', new Uint8Array(500), 'audio/mp4');
    await db.mediaCacheIndex.put({
      mediaKey: 'rec-active',
      kind: 'user_recording',
      storageBackend: 'opfs',
      mimeType: 'audio/mp4',
      sha256: 'a'.repeat(64),
      byteSize: 500,
      attemptId: 'att-pending-1',
      partIndex: 1,
      durationMs: 3000,
      remoteObjectKey: null,
      lastAccessedMs: t0 - 10_000,
      createdAtMs: t0 - 10_000,
      expiresAtMs: t0 + 30 * 86_400_000,
    });

    // Write 3 pack items: 400 + 300 + 300 = 1000 bytes (total = 1500 bytes > 1000 quota)
    await binaryStore.writeBinary('pack-oldest', new Uint8Array(400), 'audio/mp4');
    await db.mediaCacheIndex.put({
      mediaKey: 'pack-oldest',
      kind: 'pack_audio',
      storageBackend: 'opfs',
      mimeType: 'audio/mp4',
      sha256: 'b'.repeat(64),
      byteSize: 400,
      attemptId: null,
      partIndex: null,
      durationMs: null,
      remoteObjectKey: null,
      lastAccessedMs: t0 - 5_000,
      createdAtMs: t0 - 5_000,
      expiresAtMs: null,
    });

    await binaryStore.writeBinary('pack-svg-mid', new Uint8Array(300), 'image/svg+xml');
    await db.mediaCacheIndex.put({
      mediaKey: 'pack-svg-mid',
      kind: 'pack_svg',
      storageBackend: 'opfs',
      mimeType: 'image/svg+xml',
      sha256: 'c'.repeat(64),
      byteSize: 300,
      attemptId: null,
      partIndex: null,
      durationMs: null,
      remoteObjectKey: null,
      lastAccessedMs: t0 - 2_000,
      createdAtMs: t0 - 2_000,
      expiresAtMs: null,
    });

    await binaryStore.writeBinary('pack-newest', new Uint8Array(300), 'audio/mp4');
    await db.mediaCacheIndex.put({
      mediaKey: 'pack-newest',
      kind: 'pack_audio',
      storageBackend: 'opfs',
      mimeType: 'audio/mp4',
      sha256: 'd'.repeat(64),
      byteSize: 300,
      attemptId: null,
      partIndex: null,
      durationMs: null,
      remoteObjectKey: null,
      lastAccessedMs: t0,
      createdAtMs: t0,
      expiresAtMs: null,
    });

    const evictRes = await catalog.evictLruIfOverQuota();
    expect(evictRes.ok).toBe(true);
    if (evictRes.ok) {
      // Total was 1500, quota 1000 -> must evict pack-oldest (400) and pack-svg-mid (300) => 700 bytes, leaving 800 <= 1000
      expect(evictRes.value.evictedKeys).toEqual(['pack-oldest', 'pack-svg-mid']);
      expect(evictRes.value.evictedBytes).toBe(700);
    }

    // user_recording and pack-newest remain intact; evicted binaries are deleted
    expect(await db.mediaCacheIndex.get('rec-active')).toBeDefined();
    expect(await binaryStore.readBinary('rec-active', 'opfs')).not.toBeNull();
    expect(await db.mediaCacheIndex.get('pack-newest')).toBeDefined();
    expect(await binaryStore.readBinary('pack-oldest', 'opfs')).toBeNull();
    expect(await binaryStore.readBinary('pack-svg-mid', 'opfs')).toBeNull();
  });
});

describe('W1.3 WebAudioRecorderAdapter & WebAudioPlayerAdapter', () => {
  it('probes MIME in priority order, strips codecs for activeContentType, streams RMS [0..1], and flags muted mic (< 0.01)', async () => {
    // 1. Probe order: mp4;codecs -> mp4 -> webm;codecs=opus -> webm
    const recMp4 = new WebAudioRecorderAdapter({
      isTypeSupported: (mime) => mime === 'audio/mp4;codecs=mp4a.40.2' || mime === 'audio/webm',
    });
    expect(recMp4.activeContentType).toBe('audio/mp4');

    const recOpus = new WebAudioRecorderAdapter({
      isTypeSupported: (mime) => mime === 'audio/webm;codecs=opus',
    });
    expect(recOpus.activeContentType).toBe('audio/webm');

    // 2. Test AnalyserNode RMS streaming + muted mic (< 0.01) vs active mic (>= 0.01)
    let sampleAmplitude = 0.002; // muted (< 0.01)
    const mockStream = {
      getTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream;

    const recorder = new WebAudioRecorderAdapter({
      isTypeSupported: (mime) => mime === 'audio/mp4;codecs=mp4a.40.2',
      mediaDevices: {
        enumerateDevices: async () => [
          {
            deviceId: 'default',
            groupId: 'g1',
            kind: 'audioinput',
            label: 'Built-in Mic',
            toJSON: () => ({}),
          },
        ],
        getUserMedia: async () => mockStream,
      },
      createAudioContext: () => ({
        state: 'running',
        close: async () => {},
        createMediaStreamSource: () => ({ connect: () => {} }),
        createAnalyser: () => ({
          fftSize: 256,
          frequencyBinCount: 128,
          getFloatTimeDomainData: (arr: Float32Array) => {
            arr.fill(sampleAmplitude);
          },
        }),
      }),
      createMediaRecorder: (_stream, opts) => {
        const instance = {
          mimeType: opts.mimeType,
          state: 'inactive',
          ondataavailable: null as ((e: { readonly data: Blob }) => void) | null,
          onstop: null as (() => void) | null,
          onerror: null as ((e: unknown) => void) | null,
          start: () => {
            instance.state = 'recording';
            setTimeout(() => {
              instance.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])]) });
            }, 5);
          },
          stop: () => {
            instance.state = 'inactive';
            instance.onstop?.();
          },
        };
        return instance;
      },
    });

    const preflight = await recorder.checkMicPermissionAndDevices();
    expect(preflight.ok).toBe(true);
    if (preflight.ok) {
      expect(preflight.value.activeContentType).toBe('audio/mp4');
      expect(preflight.value.devices).toHaveLength(1);
    }

    // Muted recording (RMS = 0.002 < 0.01)
    const levelsMuted: number[] = [];
    const startMuted = await recorder.startRecording({
      maxDurationSec: 10,
      onLevel: (rms) => levelsMuted.push(rms),
    });
    expect(startMuted.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 40));
    if (startMuted.ok) {
      const stopMuted = await startMuted.value.stop();
      expect(stopMuted.ok).toBe(true);
      if (stopMuted.ok) {
        expect(stopMuted.value.strippedContentType).toBe('audio/mp4');
        expect(stopMuted.value.mimeType).toBe('audio/mp4;codecs=mp4a.40.2');
        expect(stopMuted.value.isMutedWarning).toBe(true);
        expect(stopMuted.value.peakRms).toBeLessThan(0.01);
      }
    }
    expect(levelsMuted.length).toBeGreaterThan(0);

    // Audible recording (RMS = 0.25 >= 0.01)
    sampleAmplitude = 0.25;
    const levelsActive: number[] = [];
    const startActive = await recorder.startRecording({
      maxDurationSec: 10,
      onLevel: (rms) => levelsActive.push(rms),
    });
    expect(startActive.ok).toBe(true);
    await new Promise((r) => setTimeout(r, 40));
    if (startActive.ok) {
      const stopActive = await startActive.value.stop();
      expect(stopActive.ok).toBe(true);
      if (stopActive.ok) {
        expect(stopActive.value.isMutedWarning).toBe(false);
        expect(stopActive.value.peakRms).toBeCloseTo(0.25, 2);
      }
    }
  });

  it('snapshots AudioPlaybackMode at loadSource time so later setPlaybackMode cannot unlock exam_linear_locked handles', async () => {
    const createMockElement = (): AudioElementLike & { triggerEnded: () => void } => {
      const listeners = new Map<string, Set<EventListener>>();
      return {
        src: '',
        currentTime: 0,
        duration: 120,
        playbackRate: 1.0,
        play: async () => {
          for (const fn of listeners.get('play') ?? []) fn(new Event('play'));
        },
        pause: () => {
          for (const fn of listeners.get('pause') ?? []) fn(new Event('pause'));
        },
        addEventListener: (type, fn) => {
          if (!listeners.has(type)) listeners.set(type, new Set());
          listeners.get(type)?.add(fn as EventListener);
        },
        removeEventListener: (type, fn) => {
          listeners.get(type)?.delete(fn as EventListener);
        },
        triggerEnded: () => {
          for (const fn of listeners.get('ended') ?? []) fn(new Event('ended'));
        },
      };
    };

    const mockElements: Array<ReturnType<typeof createMockElement>> = [];
    const player = new WebAudioPlayerAdapter({
      initialMode: 'exam_linear_locked',
      createAudioElement: () => {
        const el = createMockElement();
        mockElements.push(el);
        return el;
      },
    });

    // Load handle while in exam_linear_locked
    const examHandleRes = await player.loadSource({
      mediaKey: 'listening-sec-1',
      fallbackUrl: 'https://cdn.mockza.local/listening-sec-1.m4a',
    });
    expect(examHandleRes.ok).toBe(true);
    if (!examHandleRes.ok) return;
    const examHandle = examHandleRes.value;

    // Now switch gateway mode to study_interactive AFTER loadSource!
    player.setPlaybackMode('study_interactive');

    // Existing examHandle MUST remain locked to exam_linear_locked
    const seekErr = examHandle.seek(30);
    expect(seekErr.ok).toBe(false);
    if (!seekErr.ok) {
      expect(seekErr.error.code).toBe('LOCKED_EXAM_PLAYBACK');
    }

    const speedErr = examHandle.setSpeed(1.5);
    expect(speedErr.ok).toBe(false);
    if (!speedErr.ok) {
      expect(speedErr.error.code).toBe('LOCKED_EXAM_PLAYBACK');
    }

    // 1.0x speed is permitted
    expect(examHandle.setSpeed(1.0).ok).toBe(true);

    // Play once -> ends -> second play() must be rejected in exam_linear_locked
    expect((await examHandle.play()).ok).toBe(true);
    mockElements[0]?.triggerEnded();
    const replayErr = await examHandle.play();
    expect(replayErr.ok).toBe(false);
    if (!replayErr.ok) {
      expect(replayErr.error.code).toBe('LOCKED_EXAM_PLAYBACK');
    }

    // New handle loaded in study_interactive allows seek & variable speed even if mode switches back
    const studyHandleRes = await player.loadSource({
      mediaKey: 'listening-sec-1-review',
      fallbackUrl: 'https://cdn.mockza.local/listening-sec-1.m4a',
    });
    expect(studyHandleRes.ok).toBe(true);
    if (!studyHandleRes.ok) return;
    const studyHandle = studyHandleRes.value;

    player.setPlaybackMode('exam_linear_locked');
    expect(studyHandle.seek(45).ok).toBe(true);
    expect(studyHandle.setSpeed(1.25).ok).toBe(true);
    expect(mockElements[1]?.currentTime).toBe(45);
    expect(mockElements[1]?.playbackRate).toBe(1.25);

    examHandle.dispose();
    studyHandle.dispose();
  });

  it('keeps exam_linear_locked play() blocked after ended even if an error event fires, and cleans up on init/cancel failures', async () => {
    const listeners = new Map<string, Set<EventListener>>();
    const mockEl: AudioElementLike = {
      src: '',
      currentTime: 0,
      duration: 60,
      playbackRate: 1.0,
      play: async () => {
        for (const fn of listeners.get('play') ?? []) fn(new Event('play'));
      },
      pause: () => {},
      addEventListener: (type, fn) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)?.add(fn as EventListener);
      },
      removeEventListener: (type, fn) => {
        listeners.get(type)?.delete(fn as EventListener);
      },
    };

    const player = new WebAudioPlayerAdapter({
      initialMode: 'exam_linear_locked',
      createAudioElement: () => mockEl,
    });

    const handleRes = await player.loadSource({
      mediaKey: 'exam-locked-error-after-end',
      fallbackUrl: 'https://cdn.mockza.local/locked.m4a',
    });
    expect(handleRes.ok).toBe(true);
    if (!handleRes.ok) return;
    const handle = handleRes.value;

    const states: string[] = [];
    const unsub = handle.subscribe((s) => states.push(s.status));

    expect((await handle.play()).ok).toBe(true);
    for (const fn of listeners.get('ended') ?? []) fn(new Event('ended'));
    // Dispatch an element error event AFTER ended
    for (const fn of listeners.get('error') ?? []) fn(new Event('error'));

    const replayErr = await handle.play();
    expect(replayErr.ok).toBe(false);
    if (!replayErr.ok) {
      expect(replayErr.error.code).toBe('LOCKED_EXAM_PLAYBACK');
    }
    expect(states[states.length - 1]).toBe('ended');

    unsub();
    handle.dispose();

    // Verify owned blob URL is revoked when createAudioElement throws
    const originalRevokeDesc = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const revokeMock = vi.fn();
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeMock,
    });
    try {
      const failingPlayer = new WebAudioPlayerAdapter({
        resolveMediaUrl: async () => ({ ok: true, value: 'blob:https://mockza.local/owned-blob' }),
        createAudioElement: () => {
          throw new Error('Audio element unsupported');
        },
      });
      const initErr = await failingPlayer.loadSource({
        mediaKey: 'broken-audio',
        fallbackUrl: 'https://cdn.mockza.local/fallback.m4a',
      });
      expect(initErr.ok).toBe(false);
      expect(revokeMock).toHaveBeenCalledWith('blob:https://mockza.local/owned-blob');
    } finally {
      if (originalRevokeDesc) {
        Object.defineProperty(URL, 'revokeObjectURL', originalRevokeDesc);
      } else {
        Reflect.deleteProperty(URL, 'revokeObjectURL');
      }
    }

    // Verify ActiveRecordingHandle.cancel() completes resource cleanup even if recorder.stop() throws
    const stopTrackSpy = vi.fn();
    const closeCtxSpy = vi.fn(async () => {});
    const recorder = new WebAudioRecorderAdapter({
      isTypeSupported: () => true,
      mediaDevices: {
        enumerateDevices: async () => [],
        getUserMedia: async () =>
          ({ getTracks: () => [{ stop: stopTrackSpy }] }) as unknown as MediaStream,
      },
      createAudioContext: () => ({
        state: 'running',
        close: closeCtxSpy,
        createMediaStreamSource: () => ({ connect: () => {} }),
        createAnalyser: () => ({
          fftSize: 256,
          frequencyBinCount: 128,
          getFloatTimeDomainData: () => {},
        }),
      }),
      createMediaRecorder: (_stream, opts) => ({
        mimeType: opts.mimeType,
        state: 'recording',
        ondataavailable: null,
        onstop: null,
        onerror: null,
        start: () => {},
        stop: () => {
          throw new Error('InvalidStateError');
        },
      }),
    });

    const recStart = await recorder.startRecording({ maxDurationSec: 10, onLevel: () => {} });
    expect(recStart.ok).toBe(true);
    if (recStart.ok) {
      expect(() => recStart.value.cancel()).not.toThrow();
      expect(stopTrackSpy).toHaveBeenCalledTimes(1);
      expect(closeCtxSpy).toHaveBeenCalledTimes(1);
    }
  });
});

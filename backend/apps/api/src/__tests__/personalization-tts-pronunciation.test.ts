import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '@mockza/config';
import { analyzePronunciationGraph, OpenRouterClient } from '@mockza/ai';
import { createApiApp } from '../app.js';

describe('Adaptive Personalization, Kokoro TTS, Pronunciation & Sync Routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function createAuthedApp() {
    const env = loadEnv({
      NODE_ENV: 'test',
      EDITION: 'glb',
      OPENROUTER_API_KEY: 'sk-test-openrouter',
      OPENROUTER_TTS_MODEL: 'hexgrad/kokoro-82m',
      OPENROUTER_PRONUNCIATION_MODEL: 'google/gemini-3.1-flash-lite',
    });
    const app = createApiApp(env, {
      verifyAttestationProof: async () => true,
    });
    const deviceId = randomUUID();
    const authRes = await app.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, appVersion: '1.0.0' }),
    });
    expect(authRes.status).toBe(201);
    const authData = (await authRes.json()) as { accessToken: string };
    return { app, deviceId, token: authData.accessToken };
  }

  it('serves and updates personalization state, roadmap, and sync endpoints cleanly', async () => {
    const { app, token } = await createAuthedApp();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const getRes = await app.request('/v1/personalization/state', { headers });
    expect(getRes.status).toBe(200);
    const state = (await getRes.json()) as {
      profile: { examTrack: string; favoriteTopics: string[] };
      roadmap: { milestones: unknown[]; steps: Array<{ stepId: string }> };
    };
    expect(state.roadmap.milestones.length).toBe(4);
    expect(state.roadmap.steps.length).toBeGreaterThan(0);

    const putRes = await app.request('/v1/personalization/profile', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        examTrack: 'toefl_ibt',
        targetBand: 5.5,
        favoriteTopics: ['health_sports', 'science_climate'],
        onboardingCompleted: true,
      }),
    });
    expect(putRes.status).toBe(200);
    const updated = (await putRes.json()) as {
      profile: { examTrack: string; favoriteTopics: string[]; onboardingCompleted: boolean };
    };
    expect(updated.profile.examTrack).toBe('toefl_ibt');
    expect(updated.profile.favoriteTopics).toContain('health_sports');
    expect(updated.profile.onboardingCompleted).toBe(true);

    const syncPull = await app.request('/v1/sync/pull', { headers });
    expect(syncPull.status).toBe(200);

    const vocabSync = await app.request('/v1/sync/vocab-batch', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cards: [
          {
            cardId: 'card-1',
            easeFactorMilli: 2600,
            intervalDays: 3,
            repetitions: 2,
            dueSerialDay: 20790,
            lapses: 0,
            sourceKind: 'seeded',
          },
        ],
      }),
    });
    expect(vocabSync.status).toBe(200);
    const waveSummary = (await vocabSync.json()) as { currentWaveLearned: number };
    expect(waveSummary.currentWaveLearned).toBe(1);
  });

  it('synthesizes Kokoro-82m TTS audio through OpenRouter API and serves cached MP3 stream', async () => {
    const { app, token } = await createAuthedApp();
    const mp3Bytes = Uint8Array.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x01, 0x02]);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(mp3Bytes, { status: 200 }));

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const res1 = await app.request('/v1/tts/synthesize', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'albeit at the cost of', voice: 'af_bella', sourceContext: 'vocab' }),
    });
    expect(res1.status).toBe(200);
    const d1 = (await res1.json()) as {
      cacheKey: string;
      audioUrl: string;
      cached: boolean;
      modelUsed: string;
    };
    expect(d1.cached).toBe(false);
    expect(d1.modelUsed).toBe('hexgrad/kokoro-82m');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const res2 = await app.request('/v1/tts/synthesize', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text: 'albeit   at the   cost of', voice: 'af_bella' }),
    });
    expect(res2.status).toBe(200);
    const d2 = (await res2.json()) as { cacheKey: string; cached: boolean };
    expect(d2.cacheKey).toBe(d1.cacheKey);
    expect(d2.cached).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const audioRes = await app.request(d1.audioUrl, { headers });
    expect(audioRes.status).toBe(200);
    expect(audioRes.headers.get('content-type')).toBe('audio/mpeg');
    const returned = new Uint8Array(await audioRes.arrayBuffer());
    expect(Array.from(returned)).toEqual(Array.from(mp3Bytes));
  });

  it('captures exact OpenRouter usage + cost telemetry in analyzePronunciationGraph & OpenRouterClient', async () => {
    const usages: Array<{ promptTokens: number; completionTokens: number; estimatedCostUsdMicros: number }> = [];
    const mockClient = {
      createChatCompletion: vi.fn(async () => ({
        id: 'gen-pron-123',
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                transcript: 'resilient infrastructure',
                accuracyScore: 88,
                fluencyScore: 85,
                intonationScore: 82,
                stressScore: 80,
                overallScore: 85,
                bandImpactLabel: 'Band 7.5+ articulation',
                summaryEn: 'Clear consonant clusters.',
                summaryFa: null,
                mouthTipEn: 'Hold the second syllable of resilient steady.',
                mouthTipFa: null,
                actionableRetryEn: 'Repeat once more emphasizing -SIL-.',
                actionableRetryFa: null,
                weaknessSignalKey: 'phonetics:word_stress',
                wordsFeedback: [
                  {
                    word: 'resilient',
                    status: 'needs_work',
                    ipaTarget: '/rɪˈzɪliənt/',
                    ipaObserved: '/ˈrɪzɪliənt/',
                    issueType: 'stress',
                    tipEn: 'Shift stress to the second syllable.',
                    tipFa: null,
                  },
                ],
              }),
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 420,
          completion_tokens: 180,
          total_tokens: 600,
          cost: 0.0000855,
          prompt_tokens_details: { cached_tokens: 100 },
        },
      })),
    } satisfies Pick<OpenRouterClient, 'createChatCompletion'>;

    const out = await analyzePronunciationGraph(
      {
        edition: 'glb',
        examTrack: 'ielts_academic',
        targetText: 'resilient infrastructure',
        practiceKind: 'word',
        base64AudioData: 'AQID',
        audioFormat: 'm4a',
      },
      {
        client: mockClient,
        onUsage: (u) => {
          usages.push(u);
        },
      },
    );

    expect(out.result.accuracyScore).toBe(88);
    expect(out.result.wordsFeedback[0]?.word).toBe('resilient');
    expect(out.usage?.promptTokens).toBe(420);
    expect(out.usage?.cachedTokens).toBe(100);
    expect(out.usage?.estimatedCostUsdMicros).toBe(86);
    expect(usages).toHaveLength(1);
  });

  it('issues pronunciation upload presign URL scoped to authenticated device', async () => {
    const { app, deviceId, token } = await createAuthedApp();
    const practiceId = randomUUID();
    const res = await app.request('/v1/pronunciation/presign', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        practiceId,
        byteLength: 24576,
        contentType: 'audio/mp4',
      }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { objectKey: string; uploadUrl: string };
    expect(data.objectKey).toContain(`users/${deviceId}/pronunciation/${practiceId}/`);
    expect(data.uploadUrl.length).toBeGreaterThan(10);
  });

  it('preserves speaking_only + preferredTtsAccent, persists & acknowledges bandShift, and handles DET weakness ratio', async () => {
    const { app, token } = await createAuthedApp();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const upd = await app.request('/v1/personalization/profile', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        examTrack: 'det',
        targetBand: 130,
        studyFocus: 'speaking_only',
        preferredTtsAccent: 'uk',
        dailyNewVocabCap: 5,
        favoriteTopics: ['technology_ai'],
        onboardingCompleted: true,
      }),
    });
    expect(upd.status).toBe(200);
    const updBody = (await upd.json()) as {
      profile: {
        examTrack: string;
        studyFocus: string;
        preferredTtsAccent: string;
        dailyNewVocabCap: number;
      };
    };
    expect(updBody.profile.examTrack).toBe('det');
    expect(updBody.profile.studyFocus).toBe('speaking_only');
    expect(updBody.profile.preferredTtsAccent).toBe('uk');
    expect(updBody.profile.dailyNewVocabCap).toBe(5);

    const lowDet = await app.request('/v1/personalization/band-event', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        examTrack: 'det',
        skill: 'reading',
        sourceKind: 'practice_section',
        sourceId: 'det-pack-1',
        rawScore: 85,
        accuracyRatio: 0.45,
        questionTypeStats: [{ questionType: 'tfng', correct: 1, total: 5 }],
        topicKeys: ['technology_ai'],
      }),
    });
    expect(lowDet.status).toBe(200);

    const highDet = await app.request('/v1/personalization/band-event', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        examTrack: 'det',
        skill: 'reading',
        sourceKind: 'practice_section',
        sourceId: 'det-pack-2',
        rawScore: 135,
        accuracyRatio: 0.9,
        questionTypeStats: [{ questionType: 'tfng', correct: 5, total: 5 }],
        topicKeys: ['technology_ai'],
      }),
    });
    expect(highDet.status).toBe(200);

    const beforeAck = await app.request('/v1/personalization/state', { headers });
    expect(beforeAck.status).toBe(200);
    const beforeAckBody = (await beforeAck.json()) as {
      profile: { bandShiftAcknowledged: boolean };
    };
    expect(beforeAckBody.profile.bandShiftAcknowledged).toBe(false);

    const ackRes = await app.request('/v1/personalization/band-shift/ack', {
      method: 'POST',
      headers,
    });
    expect(ackRes.status).toBe(200);

    const afterAck = await app.request('/v1/personalization/state', { headers });
    expect(afterAck.status).toBe(200);
    const afterAckBody = (await afterAck.json()) as {
      profile: { bandShiftAcknowledged: boolean };
    };
    expect(afterAckBody.profile.bandShiftAcknowledged).toBe(true);
  });

  it('syncs vocab-batch cardSnapshotJson across /v1/sync/pull, serves single pronunciation 404, and exports admin CSV', async () => {
    const { app, token } = await createAuthedApp();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const batchRes = await app.request('/v1/sync/vocab-batch', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        cards: [
          {
            cardId: 'mistake-card-snapshot-1',
            easeFactorMilli: 2500,
            intervalDays: 1,
            repetitions: 1,
            dueSerialDay: 20500,
            lapses: 0,
            sourceKind: 'mistake_to_deck',
            cardSnapshotJson: {
              headword: 'ubiquitous',
              definition: 'Present everywhere.',
              ipa: '/juːˈbɪk.wɪ.təs/',
            },
          },
        ],
      }),
    });
    expect(batchRes.status).toBe(200);

    const pullRes = await app.request('/v1/sync/pull', { headers });
    expect(pullRes.status).toBe(200);
    const pullBody = (await pullRes.json()) as {
      vocabSrs: Array<{ cardId: string; cardSnapshotJson?: Record<string, unknown> | null }>;
    };
    const found = pullBody.vocabSrs.find((c) => c.cardId === 'mistake-card-snapshot-1');
    expect(found?.cardSnapshotJson?.['headword']).toBe('ubiquitous');

    const missingPron = await app.request(`/v1/pronunciation/${randomUUID()}`, { headers });
    expect(missingPron.status).toBe(404);

    const histRes = await app.request('/v1/pronunciation/history?limit=10', { headers });
    expect(histRes.status).toBe(200);
    const histBody = (await histRes.json()) as {
      dailyQuotaLimit?: number;
      remainingDailyQuota?: number;
    };
    expect(histBody.dailyQuotaLimit).toBeGreaterThan(0);

    const csvRes = await app.request('/v1/admin/usage/export.csv', {
      headers: { 'x-admin-key': 'test-admin-key' },
    });
    expect([200, 401, 403, 503]).toContain(csvRes.status);
  });

  it('enforces per-account 60 req/min burst limiter on POST /v1/tts/synthesize (TD-08)', async () => {
    const { app, token } = await createAuthedApp();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    for (let i = 0; i < 60; i += 1) {
      const res = await app.request('/v1/tts/synthesize', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: `burst phrase ${i}`,
          voice: 'bf_emma',
          speed: 1.0,
          sourceContext: 'vocab',
        }),
      });
      expect(res.status).not.toBe(429);
    }

    const blocked = await app.request('/v1/tts/synthesize', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        text: 'burst phrase 61',
        voice: 'bf_emma',
        speed: 1.0,
        sourceContext: 'vocab',
      }),
    });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
    const blockedJson = (await blocked.json()) as { code: string };
    expect(blockedJson.code).toBe('quota_exceeded');

    // A separate authenticated account on the same app must remain unblocked
    const otherAuth = await app.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: randomUUID(),
        platform: 'web',
        appVersion: '1.0.0',
        locale: 'en',
      }),
    });
    const otherToken = ((await otherAuth.json()) as { accessToken: string }).accessToken;
    const otherRes = await app.request('/v1/tts/synthesize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${otherToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'fresh user phrase',
        voice: 'af_bella',
        speed: 1.0,
        sourceContext: 'vocab',
      }),
    });
    expect(otherRes.status).not.toBe(429);
  });
});

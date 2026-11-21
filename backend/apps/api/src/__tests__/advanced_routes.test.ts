import { describe, expect, it } from 'vitest';
import { loadEnv } from '@mockza/config';
import { createApiApp } from '../app.js';

describe('Phase A2-A5: Closed-Loop API Routes (Graph, Missions, Register Shifter, Drop Anything)', () => {
  const baseEnv = loadEnv({
    NODE_ENV: 'test',
    EDITION: 'glb',
    ALLOW_DEMO_EVALUATOR: 'true',
  });

  async function issueAuthHeaders(app: ReturnType<typeof createApiApp>) {
    const res = await app.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: '11111111-1111-4111-8111-111111111111',
        appVersion: '1.0.0',
      }),
    });
    expect(res.status).toBe(201);
    const data = (await res.json()) as { accessToken: string };
    return {
      Authorization: `Bearer ${data.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  it('GET /v1/graph/me, PATCH /v1/graph/interests, GET /v1/missions/today, and POST /v1/missions/:id/complete work end-to-end', async () => {
    const app = createApiApp(baseEnv);
    const headers = await issueAuthHeaders(app);

    const graphRes = await app.request('/v1/graph/me', { headers });
    expect(graphRes.status).toBe(200);

    const patchRes = await app.request('/v1/graph/interests', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ pinTopics: ['Artificial Intelligence'], muteTopics: [] }),
    });
    expect(patchRes.status).toBe(200);

    const missionRes = await app.request('/v1/missions/today?dueWords=albeit,mitigate', {
      headers,
    });
    expect(missionRes.status).toBe(200);
    const mission = (await missionRes.json()) as {
      missionId: string;
      status: string;
      payload: { forcedTargets: Array<{ phraseEn: string }> };
    };
    expect(mission.status).toBe('ready');
    expect(mission.payload.forcedTargets.length).toBeGreaterThanOrEqual(2);

    const completeRes = await app.request(`/v1/missions/${mission.missionId}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        responseText:
          'Were we to prioritize safety, albeit slower initially, we would mitigate risk significantly.',
      }),
    });
    expect(completeRes.status).toBe(200);
    const completed = (await completeRes.json()) as { status: string; evaluationResult: unknown };
    expect(completed.status).toBe('completed');
    expect(completed.evaluationResult).toBeTruthy();
  });

  it('returns 404 feature_disabled when ENABLE_LINGUISTIC_GRAPH=false or ENABLE_DROP_ANYTHING_AUDIO=false', async () => {
    const disabledEnv = loadEnv({
      NODE_ENV: 'test',
      EDITION: 'irn',
      ENABLE_LINGUISTIC_GRAPH: 'false',
      ENABLE_DROP_ANYTHING_AUDIO: 'false',
    });
    const app = createApiApp(disabledEnv);
    const headers = await issueAuthHeaders(app);

    const graphRes = await app.request('/v1/graph/me', { headers });
    expect(graphRes.status).toBe(404);

    const audioDropRes = await app.request('/v1/drop/ingest', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputKind: 'audio',
        audioObjectKey: 'users/11111111-1111-4111-8111-111111111111/drops/a/item-0.m4a',
        durationSeconds: 30,
      }),
    });
    expect(audioDropRes.status).toBe(404);
  });

  it('rejects YouTube URLs, private SSRF IPs, and oversized shifter clips before enqueueing', async () => {
    const app = createApiApp(baseEnv);
    const headers = await issueAuthHeaders(app);

    const ytRes = await app.request('/v1/drop/ingest', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputKind: 'text_url',
        sourceUrl: 'https://www.youtube.com/watch?v=12345',
      }),
    });
    expect(ytRes.status).toBe(422);
    const ytBody = (await ytRes.json()) as { code: string };
    expect(ytBody.code).toBe('UNSUPPORTED_DROP_SOURCE');

    const ssrfRes = await app.request('/v1/drop/ingest', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputKind: 'text_url',
        sourceUrl: 'https://169.254.169.254/latest/meta-data',
      }),
    });
    expect(ssrfRes.status).toBe(422);

    const shiftBad = await app.request('/v1/register-shifter/shift', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        objectKey: 'users/11111111-1111-4111-8111-111111111111/clips/2222/part-1.m4a',
        durationSeconds: 90,
      }),
    });
    expect(shiftBad.status).toBe(400);
  });

  it('enqueues valid Register Shifter & Drop Anything requests and issues drop media presign URLs', async () => {
    const app = createApiApp(baseEnv);
    const headers = await issueAuthHeaders(app);

    const presignRes = await app.request('/v1/drop/presign-media', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dropId: '33333333-3333-4333-8333-333333333333',
        mediaKind: 'image',
        files: [{ contentType: 'image/png', byteLength: 2048 }],
      }),
    });
    expect(presignRes.status).toBe(200);
    const presignBody = (await presignRes.json()) as { items: Array<{ objectKey: string; uploadUrl: string }> };
    expect(presignBody.items[0]?.objectKey).toContain('/drops/33333333-3333-4333-8333-333333333333/');

    const ingestRes = await app.request('/v1/drop/ingest', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputKind: 'text',
        rawText:
          'Artificial intelligence research highlights how structured feedback loops build enduring academic precision.',
      }),
    });
    expect(ingestRes.status).toBe(202);

    const shiftRes = await app.request('/v1/register-shifter/shift', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        objectKey: 'users/11111111-1111-4111-8111-111111111111/clips/22222222-2222-4222-8222-222222222222/part-1.m4a',
        examTrack: 'ielts_academic',
        durationSeconds: 22,
      }),
    });
    expect(shiftRes.status).toBe(202);
  });

  it('enforces drop objectKey prefix, repeat-aloud ownership prefix, and preserves Persian topic slugs', async () => {
    const app = createApiApp(baseEnv);
    const headers = await issueAuthHeaders(app);

    const badDropKeyRes = await app.request('/v1/drop/ingest', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputKind: 'image',
        imageObjectKeys: ['users/other-device/drops/1/img.png'],
      }),
    });
    expect(badDropKeyRes.status).toBe(400);

    const badRepeatRes = await app.request(
      '/v1/register-shifter/22222222-2222-4222-8222-222222222222/verify-repeat',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          objectKey: 'users/other-device/repeat.m4a',
          gearLevel: 2,
          expectedSentence: 'Albeit demanding, edge quantization scales cleanly.',
          targetPhrases: ['albeit'],
        }),
      },
    );
    expect(badRepeatRes.status).toBe(400);

    const faTopicRes = await app.request('/v1/graph/interests', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ pinTopics: ['فوتبال', 'هوش مصنوعی'], muteTopics: [] }),
    });
    expect(faTopicRes.status).toBe(200);
    const faBody = (await faTopicRes.json()) as {
      interestTopics: Array<{ canonicalKey: string }>;
    };
    const keys = faBody.interestTopics.map((t) => t.canonicalKey);
    expect(keys).toContain('topic:فوتبال');
    expect(keys).toContain('topic:هوش_مصنوعی');
  });

  it('presigns multi-image batch with /v1/uploads/signed-put, accepts text Register Shifter, refreshes topic max 2/day & exposes advancedQuota', async () => {
    const s3Stub = { send: async () => ({}) } as never;
    const app = createApiApp(baseEnv, { s3Client: s3Stub });
    const headers = await issueAuthHeaders(app);

    const quotaRes = await app.request('/v1/quota/me', { headers });
    expect(quotaRes.status).toBe(200);
    const quota = (await quotaRes.json()) as {
      advancedQuota?: { isPro: boolean; shifterRemainingToday: number; dropsRemainingToday: number };
    };
    expect(quota.advancedQuota).toBeDefined();
    expect(quota.advancedQuota?.dropsRemainingToday).toBeGreaterThanOrEqual(1);

    // Multi-file presign produces unique item-0 / item-1 keys and working /v1/uploads/signed-put URLs
    const batchPresign = await app.request('/v1/drop/presign-media', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dropId: '44444444-4444-4444-8444-444444444444',
        mediaKind: 'image',
        files: [
          { contentType: 'image/png', byteLength: 512 },
          { contentType: 'image/webp', byteLength: 768 },
        ],
      }),
    });
    expect(batchPresign.status).toBe(200);
    const batchBody = (await batchPresign.json()) as {
      items: Array<{ objectKey: string; uploadUrl: string }>;
    };
    expect(batchBody.items).toHaveLength(2);
    expect(batchBody.items[0]?.objectKey).toContain('item-0.png');
    expect(batchBody.items[1]?.objectKey).toContain('item-1.webp');
    expect(batchBody.items[0]?.uploadUrl).toContain('/v1/uploads/signed-put?');

    const putRes = await app.request(batchBody.items[0]!.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'image/png' },
      body: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });
    expect(putRes.status).toBe(200);

    // Text-mode Register Shifter
    const textShiftRes = await app.request('/v1/register-shifter/shift', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputMode: 'text',
        rawText: 'Today I saw a really good movie with cool scenes about future technology.',
        examTrack: 'ielts_academic',
      }),
    });
    expect(textShiftRes.status).toBe(202);

    // Daily Mission topic refresh capped at 2/day
    const r1 = await app.request('/v1/missions/today/refresh', {
      method: 'POST',
      headers,
      body: JSON.stringify({ focusTopic: 'Football & Sports', examTrack: 'ielts_academic' }),
    });
    expect(r1.status).toBe(200);
    const r1Body = (await r1.json()) as { focusTopic: string };
    expect(r1Body.focusTopic).toBe('Football & Sports');

    const r2 = await app.request('/v1/missions/today/refresh', {
      method: 'POST',
      headers,
      body: JSON.stringify({ focusTopic: 'Medicine & Health', examTrack: 'ielts_academic' }),
    });
    expect(r2.status).toBe(200);

    const r3 = await app.request('/v1/missions/today/refresh', {
      method: 'POST',
      headers,
      body: JSON.stringify({ focusTopic: 'AI & Tech', examTrack: 'ielts_academic' }),
    });
    expect(r3.status).toBe(429);
  });
});

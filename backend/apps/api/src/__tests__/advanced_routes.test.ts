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
});

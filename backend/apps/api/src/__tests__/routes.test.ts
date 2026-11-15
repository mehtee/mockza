import { loadEnv } from '@mockza/config';
import { describe, expect, it } from 'vitest';
import { createApiApp } from '../app.js';

describe('@mockza/api full route suite', () => {
  const env = loadEnv({
    EDITION: 'glb',
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-at-least-32-chars-long-12345',
    REVENUECAT_WEBHOOK_SECRET: 'rc-secret-123',
  });
  const app = createApiApp(env);

  it('issues session JWT on POST /v1/auth/anonymous', async () => {
    const res = await app.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: '123e4567-e89b-12d3-a456-426614174000' }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      accessToken: string;
      deviceId: string;
      expiresAt: string;
    };
    expect(body.accessToken).toBeDefined();
    expect(body.deviceId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(body.expiresAt).toBeDefined();
  });

  it('returns challenge nonce on GET /v1/auth/challenge', async () => {
    const res = await app.request('/v1/auth/challenge');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { challenge: string; expiresAt: string };
    expect(body.challenge).toBeDefined();
    expect(body.expiresAt).toBeDefined();
  });

  it('verifies readiness on GET /v1/health/ready', async () => {
    const res = await app.request('/v1/health/ready');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; edition: string };
    expect(body.status).toBe('ready');
    expect(body.edition).toBe('glb');
  });

  it('serves catalog manifest with caching ETag on GET /v1/catalog/manifest', async () => {
    const res = await app.request('/v1/catalog/manifest');
    expect(res.status).toBe(200);
    const etag = res.headers.get('etag');
    expect(etag).toBeDefined();

    // Conditional request with If-None-Match returns 304
    const cachedRes = await app.request('/v1/catalog/manifest', {
      headers: { 'if-none-match': etag ?? '' },
    });
    expect(cachedRes.status).toBe(304);
  });

  it('rejects unauthorized RevenueCat webhook and accepts valid secret', async () => {
    const badRes = await app.request('/v1/webhooks/revenuecat', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-secret', 'content-type': 'application/json' },
      body: JSON.stringify({ event: { id: 'evt-1', type: 'INITIAL_PURCHASE' } }),
    });
    expect(badRes.status).toBe(401);

    const goodRes = await app.request('/v1/webhooks/revenuecat', {
      method: 'POST',
      headers: { authorization: 'Bearer rc-secret-123', 'content-type': 'application/json' },
      body: JSON.stringify({ event: { id: 'evt-1', type: 'INITIAL_PURCHASE' } }),
    });
    expect(goodRes.status).toBe(200);
  });

  it('queues writing evaluation with 202 Accepted', async () => {
    // Obtain auth token first
    const authRes = await app.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: '123e4567-e89b-12d3-a456-426614174000' }),
    });
    const { accessToken } = (await authRes.json()) as { accessToken: string };

    const evalRes = await app.request('/v1/evaluate/writing', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        attemptId: '123e4567-e89b-12d3-a456-426614174001',
        packId: 'writing-pack-01',
        taskType: 'task2Essay',
        promptTitle: 'Education',
        promptBody: 'Discuss both views and give your opinion.',
        essayText:
          'In recent years, the role of artificial intelligence in higher education has ignited extensive discussion among educators and policy makers across the world.',
      }),
    });

    expect(evalRes.status).toBe(202);
    const body = (await evalRes.json()) as { jobId: string; status: string };
    expect(body.jobId).toBeDefined();
    expect(body.status).toBe('queued');
  });

  it('returns quota status on GET /v1/quota/me', async () => {
    const authRes = await app.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: '123e4567-e89b-12d3-a456-426614174000' }),
    });
    const { accessToken } = (await authRes.json()) as { accessToken: string };

    const quotaRes = await app.request('/v1/quota/me', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(quotaRes.status).toBe(200);
    const quota = (await quotaRes.json()) as {
      dailySpeakingLimit: number;
      monthlyLimit: number;
    };
    expect(quota.dailySpeakingLimit).toBeDefined();
    expect(quota.monthlyLimit).toBeDefined();
  });

  it('presigns audio/webm in proxy mode and rejects tampered signed-put signatures', async () => {
    const authRes = await app.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: '123e4567-e89b-12d3-a456-426614174000' }),
    });
    const { accessToken } = (await authRes.json()) as { accessToken: string };

    const presignRes = await app.request('/v1/uploads/presign', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        attemptId: '123e4567-e89b-12d3-a456-426614174009',
        partIndex: 1,
        byteLength: 4096,
        contentType: 'audio/webm',
      }),
    });
    expect(presignRes.status).toBe(200);
    const presignBody = (await presignRes.json()) as { uploadUrl: string; objectKey: string };
    expect(presignBody.objectKey).toContain('.webm');
    expect(presignBody.uploadUrl).toContain('/v1/uploads/signed-put');

    const tamperedUrl = presignBody.uploadUrl.replace(/sig=[^&]+/, 'sig=tampered');
    const badPut = await app.request(tamperedUrl, {
      method: 'PUT',
      body: new Uint8Array([1, 2, 3, 4]),
    });
    expect(badPut.status).toBe(403);
  });

  it('protects DELETE /v1/account and /v1/admin/* with auth/admin keys', async () => {
    const unauthDel = await app.request('/v1/account', { method: 'DELETE' });
    expect(unauthDel.status).toBe(401);

    const adminDenied = await app.request('/v1/admin/exams');
    expect(adminDenied.status).toBe(401);
  });

  it('serves drills and vocab deck endpoints cleanly', async () => {
    const drillsRes = await app.request('/v1/drills');
    expect(drillsRes.status).toBe(200);
    const vocabRes = await app.request('/v1/vocab/deck');
    expect(vocabRes.status).toBe(200);
  });
});

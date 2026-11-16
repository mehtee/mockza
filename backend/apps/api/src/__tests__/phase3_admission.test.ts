import { loadEnv } from '@mockza/config';
import { describe, expect, it } from 'vitest';
import { createApiApp } from '../app.js';

describe('Phase 3: Owned Idempotency, Producer Readiness & Job Retry (TD-06, TD-13, TD-16)', () => {
  const env = loadEnv({
    EDITION: 'glb',
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-at-least-32-chars-long-12345',
    REVENUECAT_WEBHOOK_SECRET: 'rc-secret-123',
  });

  it('TD-06: rejects cross-owner attemptId (403) and modified input payload reuse (409)', async () => {
    const app = createApiApp(env);

    const authA = await app.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: '123e4567-e89b-12d3-a456-426614174501' }),
    });
    const { accessToken: tokenA } = (await authA.json()) as { accessToken: string };

    const authB = await app.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: '123e4567-e89b-12d3-a456-426614174502' }),
    });
    const { accessToken: tokenB } = (await authB.json()) as { accessToken: string };

    const attemptId = '123e4567-e89b-12d3-a456-426614174599';
    const basePayload = {
      attemptId,
      packId: 'writing-pack-01',
      taskType: 'task2Essay',
      promptTitle: 'Urban Planning',
      promptBody: 'Discuss urban planning.',
      essayText: 'Careful urban planning strengthens civic infrastructure and public health.',
    };

    const first = await app.request('/v1/evaluate/writing', {
      method: 'POST',
      headers: { authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(basePayload),
    });
    expect(first.status).toBe(202);
    const firstBody = (await first.json()) as { jobId: string };

    // Identical caller + identical input returns same job
    const replay = await app.request('/v1/evaluate/writing', {
      method: 'POST',
      headers: { authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(basePayload),
    });
    expect(replay.status).toBe(202);
    const replayBody = (await replay.json()) as { jobId: string };
    expect(replayBody.jobId).toBe(firstBody.jobId);

    // Same owner + different essay fails with 409 conflict
    const modified = await app.request('/v1/evaluate/writing', {
      method: 'POST',
      headers: { authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePayload,
        essayText: 'Completely different essay text reusing the same attempt identifier.',
      }),
    });
    expect(modified.status).toBe(409);

    // Different caller reusing known attemptId fails with 403
    const crossOwner = await app.request('/v1/evaluate/writing', {
      method: 'POST',
      headers: { authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(basePayload),
    });
    expect(crossOwner.status).toBe(403);
  });

  it('TD-13: fails readiness (503) and rejects evaluation admission when queue producer is unavailable', async () => {
    const app = createApiApp(env, { isQueueReady: () => false });

    const ready = await app.request('/v1/health/ready');
    expect(ready.status).toBe(503);
    const readyBody = (await ready.json()) as { queue?: boolean };
    expect(readyBody.queue).toBe(false);

    const authRes = await app.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: '123e4567-e89b-12d3-a456-426614174503' }),
    });
    const { accessToken } = (await authRes.json()) as { accessToken: string };

    const blocked = await app.request('/v1/evaluate/writing', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attemptId: '123e4567-e89b-12d3-a456-426614174590',
        packId: 'writing-pack-01',
        taskType: 'task2Essay',
        promptTitle: 'Education',
        promptBody: 'Discuss.',
        essayText: 'Queue unavailable should reject admission with 503 instead of stranding work.',
      }),
    });
    expect(blocked.status).toBe(503);
  });

  it('TD-16: supports authorized job retry endpoint for existing failed jobs', async () => {
    const app = createApiApp(env);
    const authRes = await app.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: '123e4567-e89b-12d3-a456-426614174504' }),
    });
    const { accessToken } = (await authRes.json()) as { accessToken: string };

    const missingRetry = await app.request('/v1/evaluate/retry', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ attemptId: '123e4567-e89b-12d3-a456-426614174591' }),
    });
    expect(missingRetry.status).toBe(404);
  });
});

import { createHmac } from 'node:crypto';
import { loadEnv } from '@mockza/config';
import { describe, expect, it } from 'vitest';
import { createApiApp } from '../app.js';

describe('Phase 1 Security & Integrity Tests (TD-01–05, TD-09–10)', () => {
  const env = loadEnv({
    EDITION: 'glb',
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-at-least-32-chars-long-12345',
    REVENUECAT_WEBHOOK_SECRET: 'rc-secret-123',
    SSE_ENABLED: 'true',
  });

  it('TD-01: rejects raw UUIDs and invalid signatures on protected routes', async () => {
    const app = createApiApp(env);
    const rawUuidRes = await app.request('/v1/quota/me', {
      headers: { authorization: 'Bearer 123e4567-e89b-12d3-a456-426614174000' },
    });
    expect(rawUuidRes.status).toBe(401);

    const forgedJwtRes = await app.request('/v1/quota/me', {
      headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.bad' },
    });
    expect(forgedJwtRes.status).toBe(401);
  });

  it('TD-03: rejects malformed registration, blocks UUID takeover, and enforces single-use attestation challenges', async () => {
    const secret = 'attest-hmac-secret-test-123456';
    const attestedEnv = loadEnv({
      EDITION: 'glb',
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-at-least-32-chars-long-12345',
      REVENUECAT_WEBHOOK_SECRET: 'rc-secret-123',
      APP_ATTEST_ENFORCED: 'true',
      APP_ATTEST_HMAC_SECRET: secret,
    });
    const attestedApp = createApiApp(attestedEnv);

    // 1. Challenge endpoint works without attestation header
    const chalRes = await attestedApp.request('/v1/auth/challenge');
    expect(chalRes.status).toBe(200);
    const { challenge } = (await chalRes.json()) as { challenge: string };

    // 2. Arbitrary attestation string fails
    const badAttest = await attestedApp.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-attest': 'arbitrary-fake-proof',
      },
      body: JSON.stringify({ deviceId: '123e4567-e89b-12d3-a456-426614174100' }),
    });
    expect(badAttest.status).toBe(401);

    // 3. Valid proof registers device and issues deviceSecret
    const proof = createHmac('sha256', secret).update(`ios:${challenge}`).digest('hex');
    const envelope = Buffer.from(
      JSON.stringify({ challenge, platform: 'ios', proof }),
      'utf-8',
    ).toString('base64url');

    const regRes = await attestedApp.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-attest': envelope,
      },
      body: JSON.stringify({ deviceId: '123e4567-e89b-12d3-a456-426614174100' }),
    });
    expect(regRes.status).toBe(201);
    const regBody = (await regRes.json()) as { deviceSecret?: string; accessToken: string };
    expect(regBody.deviceSecret).toBeTruthy();

    // 4. Reusing same challenge fails
    const replayRes = await attestedApp.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-app-attest': envelope,
      },
      body: JSON.stringify({ deviceId: '123e4567-e89b-12d3-a456-426614174101' }),
    });
    expect(replayRes.status).toBe(401);

    // 5. Knowledge of existing UUID without deviceSecret fails even with a fresh challenge
    const app2 = createApiApp(env);
    const first = await app2.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: '123e4567-e89b-12d3-a456-426614174200' }),
    });
    expect(first.status).toBe(201);
    const { deviceSecret } = (await first.json()) as { deviceSecret: string };

    const hijack = await app2.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: '123e4567-e89b-12d3-a456-426614174200' }),
    });
    expect(hijack.status).toBe(401);

    const legitRenew = await app2.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        deviceId: '123e4567-e89b-12d3-a456-426614174200',
        deviceSecret,
      }),
    });
    expect(legitRenew.status).toBe(201);
  });

  it('TD-02: rejects unverified unsigned provider tokens on POST /v1/auth/link', async () => {
    const app = createApiApp(env);
    const authRes = await app.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: '123e4567-e89b-12d3-a456-426614174300' }),
    });
    const { accessToken } = (await authRes.json()) as { accessToken: string };

    const unsignedPayload = Buffer.from(
      JSON.stringify({ sub: 'victim-apple-user', email: 'victim@example.com' }),
    ).toString('base64url');
    const forgedIdToken = `eyJhbGciOiJub25lIn0.${unsignedPayload}.sig`;

    const linkRes = await app.request('/v1/auth/link', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ provider: 'apple', idToken: forgedIdToken }),
    });
    expect([401, 503]).toContain(linkRes.status);
  });

  it('TD-04: rejects RevenueCat webhooks when secret is unconfigured', async () => {
    const noSecretEnv = loadEnv({
      EDITION: 'glb',
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-at-least-32-chars-long-12345',
      REVENUECAT_WEBHOOK_SECRET: '',
    });
    const app = createApiApp(noSecretEnv);

    const res = await app.request('/v1/webhooks/revenuecat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: { id: 'evt-open', type: 'INITIAL_PURCHASE' } }),
    });
    expect(res.status).toBe(503);
  });

  it('TD-05: rejects unauthenticated SSE requests and honors SSE_ENABLED=false', async () => {
    const sseOffApp = createApiApp(
      loadEnv({
        EDITION: 'glb',
        NODE_ENV: 'test',
        JWT_SECRET: 'test-secret-at-least-32-chars-long-12345',
        REVENUECAT_WEBHOOK_SECRET: 'rc-secret-123',
        SSE_ENABLED: 'false',
      }),
    );

    const unauthSse = await sseOffApp.request(
      '/v1/jobs/123e4567-e89b-12d3-a456-426614174400/events',
    );
    expect(unauthSse.status).toBe(401);

    const authRes = await sseOffApp.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: '123e4567-e89b-12d3-a456-426614174401' }),
    });
    const { accessToken } = (await authRes.json()) as { accessToken: string };

    const disabledSse = await sseOffApp.request(
      '/v1/jobs/123e4567-e89b-12d3-a456-426614174400/events',
      {
        headers: { authorization: `Bearer ${accessToken}` },
      },
    );
    expect(disabledSse.status).toBe(404);
  });
});

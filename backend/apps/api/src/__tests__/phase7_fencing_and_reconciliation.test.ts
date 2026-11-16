import { randomUUID } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import { loadEnv } from '@mockza/config';
import {
  catalogPacks,
  createDbClient,
  devices,
  entitlements,
  erasureRequests,
  webhookEvents,
} from '@mockza/db';
import { signUploadProxyParams } from '@mockza/storage';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiApp } from '../app.js';
import { resolveClientKey } from '../middleware/rate-limit.js';

const testDbUrl =
  process.env['DATABASE_URL'] ?? 'postgres://mockza:mockza_dev_password@127.0.0.1:45432/mockza';

let pgReachable = false;
const { db, sql } = createDbClient(testDbUrl, { max: 8, prepare: false });

beforeAll(async () => {
  try {
    await sql`SELECT 1`;
    pgReachable = true;
  } catch {
    pgReachable = false;
  }
});

afterAll(async () => {
  await sql.end();
});

const baseEnv = loadEnv({
  EDITION: 'glb',
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-at-least-32-chars-long-12345',
  REVENUECAT_WEBHOOK_SECRET: 'rc-webhook-secret-999',
  ADMIN_API_KEY: 'admin-key-test-value-12345',
  MAX_AUDIO_MB: '1',
  TRUSTED_PROXY_IPS: '127.0.0.1,10.0.0.10',
});

describe('Phase 7 Live PostgreSQL Fencing, Reconciliation, Proxy & Catalog Integrity (RR-04..06, RR-14, RR-17, RR-18)', () => {
  it('RR-04: rejects out-of-order EXPIRATION after newer RENEWAL, handles TRANSFER, and reconciles late registration', async (ctx) => {
    if (!pgReachable) {
      ctx.skip();
      return;
    }

    const devFrom = randomUUID();
    const devTo = randomUUID();
    const lateUser = randomUUID();
    const app = createApiApp(baseEnv, { db });

    await db.insert(devices).values([
      { deviceId: devFrom, deviceSecretHash: 'h1', edition: 'glb' },
      { deviceId: devTo, deviceSecretHash: 'h2', edition: 'glb' },
    ]);

    const tOlder = 1_760_000_000_000;
    const tNewer = 1_760_000_100_000;
    const futureExp = Date.now() + 86_400_000;
    const evtIds: string[] = [];

    try {
      // 1. Newer RENEWAL arrives first -> grants Pro
      const renewId = `evt-renew-${randomUUID()}`;
      evtIds.push(renewId);
      const renewRes = await app.request('/v1/webhooks/revenuecat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer rc-webhook-secret-999',
        },
        body: JSON.stringify({
          event: {
            id: renewId,
            type: 'RENEWAL',
            app_user_id: devFrom,
            product_id: 'mockza_pro_monthly',
            entitlement_ids: ['pro'],
            expiration_at_ms: futureExp,
            event_timestamp_ms: tNewer,
          },
        }),
      });
      expect(renewRes.status).toBe(200);

      // 2. Stale out-of-order EXPIRATION with older timestamp arrives later -> must NOT revoke Pro
      const expId = `evt-exp-${randomUUID()}`;
      evtIds.push(expId);
      const expRes = await app.request('/v1/webhooks/revenuecat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer rc-webhook-secret-999',
        },
        body: JSON.stringify({
          event: {
            id: expId,
            type: 'EXPIRATION',
            app_user_id: devFrom,
            product_id: 'mockza_pro_monthly',
            entitlement_ids: ['pro'],
            event_timestamp_ms: tOlder,
          },
        }),
      });
      expect(expRes.status).toBe(200);

      const [entAfterStaleExp] = await db
        .select({ isPro: entitlements.isPro })
        .from(entitlements)
        .where(eq(entitlements.deviceId, devFrom));
      expect(entAfterStaleExp?.isPro).toBe(true);

      // 3. TRANSFER revokes devFrom and grants devTo
      const transferId = `evt-xfer-${randomUUID()}`;
      evtIds.push(transferId);
      const transferRes = await app.request('/v1/webhooks/revenuecat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer rc-webhook-secret-999',
        },
        body: JSON.stringify({
          event: {
            id: transferId,
            type: 'TRANSFER',
            transferred_from: [devFrom],
            transferred_to: [devTo],
            product_id: 'mockza_pro_monthly',
            entitlement_ids: ['pro'],
            expiration_at_ms: futureExp,
            event_timestamp_ms: tNewer + 1000,
          },
        }),
      });
      expect(transferRes.status).toBe(200);

      const [fromRow] = await db
        .select({ isPro: entitlements.isPro })
        .from(entitlements)
        .where(eq(entitlements.deviceId, devFrom));
      const [toRow] = await db
        .select({ isPro: entitlements.isPro })
        .from(entitlements)
        .where(eq(entitlements.deviceId, devTo));
      expect(fromRow?.isPro).toBe(false);
      expect(toRow?.isPro).toBe(true);

      // 4. Webhook for unregistered device is stored as pending_reconciliation & reconciled on anonymous auth
      const pendingEvtId = `evt-late-${randomUUID()}`;
      evtIds.push(pendingEvtId);
      const pendingRes = await app.request('/v1/webhooks/revenuecat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: 'Bearer rc-webhook-secret-999',
        },
        body: JSON.stringify({
          event: {
            id: pendingEvtId,
            type: 'INITIAL_PURCHASE',
            app_user_id: lateUser,
            product_id: 'mockza_quarterly',
            entitlement_ids: ['pro'],
            expiration_at_ms: futureExp,
            event_timestamp_ms: tNewer,
          },
        }),
      });
      expect(pendingRes.status).toBe(200);

      const [pendingRow] = await db
        .select({ status: webhookEvents.status })
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, pendingEvtId));
      expect(pendingRow?.status).toBe('pending_reconciliation');

      const regRes = await app.request('/v1/auth/anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: lateUser }),
      });
      expect(regRes.status).toBe(201);

      const [reconciledEnt] = await db
        .select({ isPro: entitlements.isPro })
        .from(entitlements)
        .where(eq(entitlements.deviceId, lateUser));
      expect(reconciledEnt?.isPro).toBe(true);
    } finally {
      for (const id of evtIds) {
        await db.delete(webhookEvents).where(eq(webhookEvents.eventId, id));
      }
      await db.delete(entitlements).where(eq(entitlements.deviceId, devFrom));
      await db.delete(entitlements).where(eq(entitlements.deviceId, devTo));
      await db.delete(entitlements).where(eq(entitlements.deviceId, lateUser));
      await db.delete(devices).where(eq(devices.deviceId, devFrom));
      await db.delete(devices).where(eq(devices.deviceId, devTo));
      await db.delete(devices).where(eq(devices.deviceId, lateUser));
    }
  });

  it('RR-05 & RR-06 & RR-17: fences presigned uploads during erasure, streams 413 on chunk overflow, and completes erasure retry with receipt', async (ctx) => {
    if (!pgReachable) {
      ctx.skip();
      return;
    }

    const deviceId = randomUUID();
    let shouldFailS3 = true;
    const mockS3 = {
      async send(command: unknown) {
        const name = (command as { constructor?: { name?: string } })?.constructor?.name ?? '';
        if (shouldFailS3 && name.includes('ListObjectsV2')) {
          throw new Error('Simulated transient S3 outage');
        }
        return { Contents: [], IsTruncated: false };
      },
    } as unknown as S3Client;

    const app = createApiApp(baseEnv, { db, s3Client: mockS3 });

    const authRes = await app.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    expect(authRes.status).toBe(201);
    const { accessToken } = (await authRes.json()) as { accessToken: string };

    let createdErasureId: string | undefined;
    try {
      // 1. Streaming chunked upload exceeding MAX_AUDIO_MB=1 rejects with 413 without buffering full payload
      const bigStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(700 * 1024));
          controller.enqueue(new Uint8Array(700 * 1024));
          controller.close();
        },
      });
      const attemptId = randomUUID();
      const objectKey = `users/${deviceId}/clips/${attemptId}/part-1.m4a`;
      const exp = Math.floor(Date.now() / 1000) + 300;
      const sig = signUploadProxyParams({
        bucket: baseEnv.S3_BUCKET,
        objectKey,
        contentType: 'audio/mp4',
        expiresAtEpochSec: exp,
        uploadGeneration: 1,
        secret: baseEnv.JWT_SECRET,
      });
      const oversizedRes = await app.request(
        `/v1/uploads/signed-put?key=${encodeURIComponent(objectKey)}&exp=${exp}&gen=1&contentType=${encodeURIComponent('audio/mp4')}&sig=${sig}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'audio/mp4' },
          body: bigStream,
          duplex: 'half',
        } as RequestInit,
      );
      expect(oversizedRes.status).toBe(413);

      // 2. Initiate DELETE /v1/account while S3 fails -> returns 503 with erasureId + receiptToken
      const delRes = await app.request('/v1/account', {
        method: 'DELETE',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(delRes.status).toBe(503);
      const delBody = (await delRes.json()) as { erasureId: string; receiptToken: string };
      expect(delBody.erasureId).toBeTruthy();
      expect(delBody.receiptToken).toBeTruthy();
      createdErasureId = delBody.erasureId;

      // 3. Previously signed upload PUT for erased device is immediately rejected with 410
      const postErasePut = await app.request(
        `/v1/uploads/signed-put?key=${encodeURIComponent(objectKey)}&exp=${exp}&gen=1&contentType=${encodeURIComponent('audio/mp4')}&sig=${sig}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'audio/mp4' },
          body: new Uint8Array([1, 2, 3, 4]),
        },
      );
      expect(postErasePut.status).toBe(410);

      // 4. Retry without valid receipt is rejected (401), then with valid receipt completes erasure cleanly
      const badRetry = await app.request(`/v1/erasure/${delBody.erasureId}/retry`, {
        method: 'POST',
        headers: { 'x-erasure-receipt': 'wrong-receipt' },
      });
      expect(badRetry.status).toBe(401);

      shouldFailS3 = false;
      const goodRetry = await app.request(`/v1/erasure/${delBody.erasureId}/retry`, {
        method: 'POST',
        headers: { 'x-erasure-receipt': delBody.receiptToken },
      });
      expect(goodRetry.status).toBe(200);
      const retryBody = (await goodRetry.json()) as { status: string };
      expect(retryBody.status).toBe('completed');
    } finally {
      if (createdErasureId) {
        await db.delete(erasureRequests).where(eq(erasureRequests.erasureId, createdErasureId));
      }
      await db.delete(devices).where(eq(devices.deviceId, deviceId));
    }
  });

  it('RR-17: ignores spoofed proxy headers when remoteAddr is not in TRUSTED_PROXY_IPS', () => {
    const trusted = new Set(['127.0.0.1', '10.0.0.10']);
    const spoofed = resolveClientKey({
      forwardedFor: '1.2.3.4, 5.6.7.8',
      cfIp: '9.9.9.9',
      remoteAddr: '198.51.100.42',
      trustedProxyIps: trusted,
    });
    expect(spoofed).toBe('198.51.100.42');

    const viaTrustedProxy = resolveClientKey({
      forwardedFor: '203.0.113.1, 198.51.100.9, 10.0.0.10',
      remoteAddr: '127.0.0.1',
      trustedProxyIps: trusted,
    });
    expect(viaTrustedProxy).toBe('198.51.100.9');
  });

  it('RR-14 & RR-18: blocks publishing unreviewed packs and blocks explain-question on unpublished packs', async (ctx) => {
    if (!pgReachable) {
      ctx.skip();
      return;
    }

    const packId = `test-unpub-${randomUUID().slice(0, 8)}`;
    const deviceId = randomUUID();
    const app = createApiApp(baseEnv, { db });

    await db.insert(catalogPacks).values({
      packId,
      edition: 'all',
      examId: 'ielts_academic',
      skill: 'reading',
      track: 'academic',
      title: 'Unpublished Draft Pack',
      description: 'Draft',
      durationSeconds: 600,
      questionCount: 1,
      version: '1.0.0',
      sha256: 'a'.repeat(64),
      byteLength: 10,
      cdnRelativePath: '',
      contentOrigin: 'authored_original',
      humanQaReviewed: false,
      isFreeSample: false,
      isPublished: false,
    });

    const authRes = await app.request('/v1/auth/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    expect(authRes.status).toBe(201);
    const { accessToken } = (await authRes.json()) as { accessToken: string };

    await db.insert(entitlements).values({
      deviceId,
      provider: 'revenuecat',
      isPro: true,
      productId: 'mockza_pro_monthly',
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    try {
      const publishRes = await app.request(`/v1/admin/exams/${packId}/publish`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-api-key': baseEnv.ADMIN_API_KEY,
        },
        body: JSON.stringify({ isPublished: true }),
      });
      expect(publishRes.status).toBe(400);

      const explainRes = await app.request('/v1/evaluate/explain-question', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packId,
          packVersion: '1.0.0',
          questionId: 'q-missing',
          skill: 'reading',
          questionType: 'tfng',
          userAnswer: 'TRUE',
        }),
      });
      expect(explainRes.status).toBe(404);
    } finally {
      await db.delete(entitlements).where(eq(entitlements.deviceId, deviceId));
      await db.delete(devices).where(eq(devices.deviceId, deviceId));
      await db.delete(catalogPacks).where(eq(catalogPacks.packId, packId));
    }
  });
});

import { randomUUID } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import { loadEnv } from '@mockza/config';
import {
  audioAssets,
  createDbClient,
  devices,
  diagnosticSessions,
  erasureRequests,
  evaluationJobs,
  quotaReservations,
} from '@mockza/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiApp } from '../app.js';

const testDbUrl =
  process.env['DATABASE_URL'] ?? 'postgres://mockza:mockza_dev_password@127.0.0.1:45432/mockza';
const { db, sql } = createDbClient(testDbUrl, { max: 4 });

let pgReachable = false;

const baseEnv = loadEnv({
  EDITION: 'glb',
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-at-least-32-chars-long-12345',
  REVENUECAT_WEBHOOK_SECRET: 'rc-webhook-secret-999',
  APP_ATTEST_ENFORCED: 'false',
});

beforeAll(async () => {
  try {
    await sql`SELECT 1`;
    await db.select({ id: diagnosticSessions.diagId }).from(diagnosticSessions).limit(1);
    pgReachable = true;
  } catch {
    pgReachable = false;
  }
});

afterAll(async () => {
  await sql.end();
});

describe('Full-Journey Backend E2E: Auth -> Catalog -> Diagnostic -> Upload/Eval -> Quota -> Erasure', () => {
  it('completes an end-to-end API lifecycle against Postgres with atomic erasure cleanup', async (ctx) => {
    if (!pgReachable) return ctx.skip();

    const deviceId1 = randomUUID();
    const deviceId2 = randomUUID();
    const diagId = randomUUID();
    const writingAttemptId = randomUUID();
    const speakingAttemptId = randomUUID();
    const standaloneAttemptId = randomUUID();

    const fakeS3 = {
      async send() {
        return { ContentLength: 1024, ContentType: 'audio/mp4' };
      },
    } as unknown as S3Client;

    const app = createApiApp(baseEnv, { db, s3Client: fakeS3 });

    try {
      // 1. Health readiness
      const readyRes = await app.request('/v1/health/ready');
      expect(readyRes.status).toBe(200);

      // 2. Anonymous auth registration + secret renewal
      const regRes = await app.request('/v1/auth/anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: deviceId1, appVersion: '1.0.0' }),
      });
      expect(regRes.status).toBe(201);
      const regBody = (await regRes.json()) as {
        accessToken: string;
        deviceSecret?: string;
      };
      expect(regBody.accessToken).toBeDefined();
      expect(regBody.deviceSecret).toBeDefined();

      const renewRes = await app.request('/v1/auth/anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: deviceId1,
          deviceSecret: regBody.deviceSecret,
        }),
      });
      expect(renewRes.status).toBe(201);
      const renewBody = (await renewRes.json()) as { accessToken: string };
      const authHeaders1 = {
        authorization: `Bearer ${renewBody.accessToken}`,
        'Content-Type': 'application/json',
      };

      // 3. Catalog manifest & drills endpoints
      const manifestRes = await app.request('/v1/catalog/manifest');
      expect(manifestRes.status).toBe(200);
      const drillsRes = await app.request('/v1/drills');
      expect(drillsRes.status).toBe(200);

      // 4. Diagnostic bank budgets match domain 900/90/990
      const bankRes = await app.request('/v1/diagnostic/packs');
      expect(bankRes.status).toBe(200);
      const bankBody = (await bankRes.json()) as {
        budgetSeconds: { collectionTotal: number; resultsWindow: number; total: number };
      };
      expect(bankBody.budgetSeconds.collectionTotal).toBe(900);
      expect(bankBody.budgetSeconds.resultsWindow).toBe(90);
      expect(bankBody.budgetSeconds.total).toBe(990);

      // 5. Audio presign upload
      const presignRes = await app.request('/v1/uploads/presign', {
        method: 'POST',
        headers: authHeaders1,
        body: JSON.stringify({
          attemptId: speakingAttemptId,
          partIndex: 1,
          byteLength: 1024,
          contentType: 'audio/mp4',
        }),
      });
      expect(presignRes.status).toBe(200);
      const { objectKey } = (await presignRes.json()) as {
        uploadUrl: string;
        objectKey: string;
      };
      expect(objectKey).toContain(deviceId1);

      // 6. Diagnostic session create -> submit -> poll
      const createDiag = await app.request('/v1/diagnostic/sessions', {
        method: 'POST',
        headers: authHeaders1,
        body: JSON.stringify({ diagId, examId: 'ielts_academic', mode: 'standard' }),
      });
      expect(createDiag.status).toBe(200);

      const submitDiag = await app.request(`/v1/diagnostic/sessions/${diagId}/submit`, {
        method: 'POST',
        headers: authHeaders1,
        body: JSON.stringify({
          readingHistory: [
            { blockId: 'DR-B1-1', tier: 'B1', selectedOptionIndices: [1, 2] },
            { blockId: 'DR-B2-1', tier: 'B2', selectedOptionIndices: [0, 1] },
            { blockId: 'DR-C1-1', tier: 'C1', selectedOptionIndices: [2, 2] },
          ],
          readingStopReason: 'sampling_complete',
          listeningHistory: [
            { blockId: 'DL-B1-1', tier: 'B1', selectedOptionIndices: [1, 0] },
            { blockId: 'DL-B2-1', tier: 'B2', selectedOptionIndices: [0, 1] },
          ],
          listeningStopReason: 'sampling_complete',
          writing: {
            attemptId: writingAttemptId,
            promptTitle: 'Public Libraries',
            basePrompt: 'Describe a useful library resource.',
            baseResponse:
              'Libraries offer quiet reading desks and reliable internet for exam candidates.',
          },
          speaking: {
            attemptId: speakingAttemptId,
            basePrompt: 'Describe your study routine.',
            turns: [
              {
                partIndex: 1,
                promptText: 'Describe your study routine.',
                objectKey,
                durationMs: 22000,
              },
            ],
          },
        }),
      });
      expect(submitDiag.status).toBe(200);

      const getDiag = await app.request(`/v1/diagnostic/sessions/${diagId}`, {
        headers: { authorization: authHeaders1.authorization },
      });
      expect(getDiag.status).toBe(200);

      // 7. Rapid Diagnostic consumes freeRapidDiagnosticUsed while preserving standalone freeDiagnosticUsed
      const [dev1Row] = await db
        .select({
          freeDiagnosticUsed: devices.freeDiagnosticUsed,
          freeRapidDiagnosticUsed: devices.freeRapidDiagnosticUsed,
        })
        .from(devices)
        .where(eq(devices.deviceId, deviceId1))
        .limit(1);
      expect(dev1Row?.freeRapidDiagnosticUsed).toBe(true);
      expect(dev1Row?.freeDiagnosticUsed).toBe(false);

      const quotaRes1 = await app.request('/v1/quota/me', {
        headers: { authorization: authHeaders1.authorization },
      });
      expect(quotaRes1.status).toBe(200);
      const quotaBody1 = (await quotaRes1.json()) as { freeDiagnosticUsed: boolean };
      expect(quotaBody1.freeDiagnosticUsed).toBe(false);

      // 8. Second device enqueues standalone writing evaluation, inspects job status & quota consumption
      const reg2 = await app.request('/v1/auth/anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: deviceId2, appVersion: '1.0.0' }),
      });
      expect(reg2.status).toBe(201);
      const { accessToken: token2 } = (await reg2.json()) as { accessToken: string };
      const authHeaders2 = {
        authorization: `Bearer ${token2}`,
        'Content-Type': 'application/json',
      };

      const evalWrite = await app.request('/v1/evaluate/writing', {
        method: 'POST',
        headers: authHeaders2,
        body: JSON.stringify({
          attemptId: standaloneAttemptId,
          packId: 'ielts-writing-seed-01',
          taskType: 'task2Essay',
          promptTitle: 'Transit vs Highways',
          promptBody: 'Should cities fund rail over highways?',
          essayText:
            'Investing in reliable public rail lowers carbon emissions and reduces commuter congestion sustainably.',
        }),
      });
      expect(evalWrite.status).toBe(202);
      const { jobId } = (await evalWrite.json()) as { jobId: string; status: string };

      const jobStatusRes = await app.request(`/v1/jobs/${jobId}`, {
        headers: { authorization: authHeaders2.authorization },
      });
      expect(jobStatusRes.status).toBe(200);

      const quotaRes2 = await app.request('/v1/quota/me', {
        headers: { authorization: authHeaders2.authorization },
      });
      expect(quotaRes2.status).toBe(200);
      const quotaBody2 = (await quotaRes2.json()) as {
        freeDiagnosticUsed: boolean;
        dailyWritingLimit: number;
      };
      expect(quotaBody2.freeDiagnosticUsed).toBe(true);
      expect(quotaBody2.dailyWritingLimit).toBe(0);

      // 9. Account deletion & cascade check on device 1
      const eraseRes = await app.request('/v1/account', {
        method: 'DELETE',
        headers: { authorization: authHeaders1.authorization },
      });
      expect(eraseRes.status).toBe(200);
      const eraseBody = (await eraseRes.json()) as {
        erasureId: string;
        receiptToken: string;
      };
      expect(eraseBody.erasureId).toBeDefined();
      expect(eraseBody.receiptToken).toBeDefined();

      // Cascaded rows & auth revocation check
      const remainingDevs = await db
        .select({ deviceId: devices.deviceId })
        .from(devices)
        .where(eq(devices.deviceId, deviceId1));
      expect(remainingDevs).toHaveLength(0);

      const postEraseQuota = await app.request('/v1/quota/me', {
        headers: { authorization: authHeaders1.authorization },
      });
      expect(postEraseQuota.status).toBe(401);
    } finally {
      for (const dev of [deviceId1, deviceId2]) {
        await db.delete(erasureRequests).where(eq(erasureRequests.accountKey, dev));
        await db.delete(quotaReservations).where(eq(quotaReservations.deviceId, dev));
        await db.delete(audioAssets).where(eq(audioAssets.deviceId, dev));
        await db.delete(evaluationJobs).where(eq(evaluationJobs.deviceId, dev));
        await db.delete(diagnosticSessions).where(eq(diagnosticSessions.deviceId, dev));
        await db.delete(devices).where(eq(devices.deviceId, dev));
      }
    }
  });
});

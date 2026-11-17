import { randomUUID } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import { loadEnv } from '@mockza/config';
import {
  createDbClient,
  devices,
  diagnosticSessions,
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

describe('Diagnostic API: sessions, bundle quota, server recomputation, & single-skill retakes', () => {
  it('returns the diagnostic bank with worked examples and preflight sound', async () => {
    const app = createApiApp(baseEnv);
    const res = await app.request('/v1/diagnostic/packs');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      budgetSeconds: { collectionTotal: number; resultsWindow: number; total: number };
      readingBlocks: Array<{ blockId: string }>;
      listeningBlocks: Array<{ blockId: string; mediaUrl?: string }>;
      preflightAudioUrl: string;
    };
    expect(body.budgetSeconds.collectionTotal).toBe(900);
    expect(body.budgetSeconds.resultsWindow).toBe(90);
    expect(body.budgetSeconds.total).toBe(990);
    expect(body.readingBlocks.length).toBeGreaterThanOrEqual(13);
    expect(body.listeningBlocks.length).toBeGreaterThanOrEqual(13);
    expect(body.preflightAudioUrl).toContain('preflight_check.m4a');
  });

  it('creates diagnostic session, allows 1 free bundle (Writing + Speaking), blocks 2nd free session, and preserves other skills on retake', async (ctx) => {
    if (!pgReachable) return ctx.skip();

    const deviceId = randomUUID();
    const diagId1 = randomUUID();
    const diagId2 = randomUUID();
    const writingAttempt1 = randomUUID();
    const speakingAttempt1 = randomUUID();
    const writingAttempt2 = randomUUID();
    const fakeS3 = {
      async send() {
        return { ContentLength: 1024, ContentType: 'audio/mp4' };
      },
    } as unknown as S3Client;

    const app = createApiApp(baseEnv, { db, s3Client: fakeS3 });

    try {
      const reg = await app.request('/v1/auth/anonymous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      expect(reg.status).toBe(201);
      const { accessToken } = (await reg.json()) as { accessToken: string };
      const authHeaders = {
        authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      const created1 = await app.request('/v1/diagnostic/sessions', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ diagId: diagId1, examId: 'ielts_academic', mode: 'standard' }),
      });
      expect(created1.status).toBe(200);

      const submit1 = await app.request(`/v1/diagnostic/sessions/${diagId1}/submit`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          readingHistory: [
            { blockId: 'DR-B1-1', tier: 'B1', selectedOptionIndices: [1, 2] },
            { blockId: 'DR-B2-1', tier: 'B2', selectedOptionIndices: [0, 1] },
            { blockId: 'DR-C1-1', tier: 'C1', selectedOptionIndices: [2, 2] },
          ],
          readingStopReason: 'sampling_complete',
          listeningHistory: [],
          listeningSkipped: true,
          writing: {
            attemptId: writingAttempt1,
            promptTitle: 'New Library',
            basePrompt: 'Would you visit?',
            baseResponse:
              'I would visit on Saturday mornings because the study rooms are peaceful.',
          },
          speaking: {
            attemptId: speakingAttempt1,
            basePrompt: 'Favorite place',
            turns: [
              {
                partIndex: 1,
                promptText: 'Favorite place',
                objectKey: `users/${deviceId}/clips/${speakingAttempt1}/part-1.m4a`,
                durationMs: 25000,
              },
            ],
          },
        }),
      });
      expect(submit1.status).toBe(200);
      const snap1 = (await submit1.json()) as {
        skills: {
          reading: { status: string; suggestedTier?: string };
          listening: { status: string };
          writing: { status: string; errorCode?: string };
          speaking: { status: string; errorCode?: string };
        };
      };
      expect(snap1.skills.reading.status).toBe('provisional');
      expect(snap1.skills.reading.suggestedTier).toBe('B2');
      expect(snap1.skills.listening.status).toBe('skipped');
      expect(snap1.skills.writing.status).toBe('pending');
      expect(snap1.skills.speaking.status).toBe('pending');

      // 2nd separate diagnostic session on same free device blocks extra free AI bundle without failing objective placement
      await app.request('/v1/diagnostic/sessions', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ diagId: diagId2, examId: 'toefl_ibt', mode: 'standard' }),
      });
      const submit2 = await app.request(`/v1/diagnostic/sessions/${diagId2}/submit`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          readingHistory: [{ blockId: 'DR-B1-1', tier: 'B1', selectedOptionIndices: [1, 2] }],
          listeningSkipped: true,
          writing: {
            attemptId: writingAttempt2,
            promptTitle: 'Library',
            basePrompt: 'Would you visit?',
            baseResponse: 'Yes I would definitely go every morning before classes start.',
          },
        }),
      });
      expect(submit2.status).toBe(200);
      const snap2 = (await submit2.json()) as {
        skills: {
          reading: { status: string; reducedSampling: boolean };
          writing: { status: string; errorCode?: string };
        };
      };
      expect(snap2.skills.reading.status).toBe('provisional');
      expect(snap2.skills.reading.reducedSampling).toBe(true);
      expect(snap2.skills.writing.status).toBe('failed');
      expect(snap2.skills.writing.errorCode).toBe('entitlement_required');

      // Single-skill objective retake on diagId1 preserves Writing & Speaking pending state
      const retakeListening = await app.request(`/v1/diagnostic/sessions/${diagId1}/retake-skill`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          skill: 'listening',
          listeningHistory: [
            { blockId: 'DL-B1-1', tier: 'B1', selectedOptionIndices: [1, 0] },
            { blockId: 'DL-B2-1', tier: 'B2', selectedOptionIndices: [0, 1] },
            { blockId: 'DL-C1-1', tier: 'C1', selectedOptionIndices: [0, 1] },
          ],
          listeningStopReason: 'sampling_complete',
        }),
      });
      expect(retakeListening.status).toBe(200);
      const retakeSnap = (await retakeListening.json()) as {
        resultRevision: number;
        skills: {
          listening: { status: string; suggestedTier?: string };
          writing: { status: string };
          speaking: { status: string };
        };
      };
      expect(retakeSnap.skills.listening.status).toBe('provisional');
      expect(retakeSnap.skills.listening.suggestedTier).toBe('C2');
      expect(retakeSnap.skills.writing.status).toBe('pending');
      expect(retakeSnap.skills.speaking.status).toBe('pending');
    } finally {
      await db.delete(quotaReservations).where(eq(quotaReservations.deviceId, deviceId));
      await db.delete(evaluationJobs).where(eq(evaluationJobs.deviceId, deviceId));
      await db.delete(diagnosticSessions).where(eq(diagnosticSessions.deviceId, deviceId));
      await db.delete(devices).where(eq(devices.deviceId, deviceId));
    }
  });
});

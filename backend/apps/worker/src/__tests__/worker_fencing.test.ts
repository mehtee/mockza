import { randomUUID } from 'node:crypto';
import { createDbClient, devices, evaluationJobs, quotaReservations } from '@mockza/db';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { handleGradeWritingJob } from '../jobs/grade-writing.js';

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

function createSlowWritingClient(delayMs: number) {
  let invocations = 0;
  return {
    get callCount() {
      return invocations;
    },
    async createChatCompletion() {
      invocations += 1;
      await new Promise((r) => setTimeout(r, delayMs));
      const essaySnippet = 'Public spaces foster community well-being.';
      return {
        id: `slow-w-${invocations}`,
        choices: [
          {
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: JSON.stringify({
                criteria: [
                  {
                    code: 'TR',
                    label: 'Task Response',
                    band: 7.0,
                    evidenceExcerpt: essaySnippet,
                    feedbackNote: 'Well argued.',
                  },
                  {
                    code: 'CC',
                    label: 'Coherence and Cohesion',
                    band: 6.5,
                    evidenceExcerpt: essaySnippet,
                    feedbackNote: 'Clear progression.',
                  },
                  {
                    code: 'LR',
                    label: 'Lexical Resource',
                    band: 7.0,
                    evidenceExcerpt: essaySnippet,
                    feedbackNote: 'Precise lexis.',
                  },
                  {
                    code: 'GRA',
                    label: 'Grammatical Range and Accuracy',
                    band: 6.5,
                    evidenceExcerpt: essaySnippet,
                    feedbackNote: 'Varied structures.',
                  },
                ],
              }),
            },
          },
        ],
      };
    },
  };
}

describe('RR-03 Live PostgreSQL Worker Lease & Generation Fencing', () => {
  it('allows strictly one worker to acquire lease & grade duplicate delivery, and rejects stale generation', async (ctx) => {
    if (!pgReachable) {
      ctx.skip();
      return;
    }

    const deviceId = randomUUID();
    const attemptId = randomUUID();
    const jobId = randomUUID();
    const now = new Date();

    await db.insert(devices).values({
      deviceId,
      deviceSecretHash: 'worker-fence-test-hash',
      edition: 'glb',
      freeDiagnosticUsed: true,
    });

    await db.insert(quotaReservations).values({
      reservationId: randomUUID(),
      attemptId,
      accountKey: deviceId,
      deviceId,
      skill: 'writing',
      isDiagnostic: true,
      utcDay: '2026-11-16',
      utcMonth: '2026-11',
      status: 'reserved',
    });

    await db.insert(evaluationJobs).values({
      jobId,
      attemptId,
      accountKey: deviceId,
      deviceId,
      packId: 'writing-pack-01',
      examId: 'ielts_academic',
      taskType: 'task2Essay',
      skill: 'writing',
      status: 'queued',
      stageDetail: 'Queued for test',
      inputHash: 'hash-worker-fence-1',
      inputJson: { essayText: 'Public spaces foster community well-being.' },
      executionGeneration: 1,
      createdAt: now,
      updatedAt: now,
    });

    try {
      const client = createSlowWritingClient(40);
      const jobPayload = {
        jobId,
        attemptId,
        packId: 'writing-pack-01',
        examId: 'ielts_academic' as const,
        taskType: 'task2Essay' as const,
        promptTitle: 'Public Spaces',
        promptBody: 'Discuss.',
        essayText: 'Public spaces foster community well-being.',
        executionGeneration: 1,
      };

      const [resA, resB] = await Promise.all([
        handleGradeWritingJob(jobPayload, db, { client }),
        handleGradeWritingJob(jobPayload, db, { client }),
      ]);

      const completedResults = [resA, resB].filter((r) => r !== null);
      expect(completedResults).toHaveLength(1);
      expect(client.callCount).toBe(1);

      const [resRow] = await db
        .select({ status: quotaReservations.status })
        .from(quotaReservations)
        .where(eq(quotaReservations.attemptId, attemptId));
      expect(resRow?.status).toBe('committed');

      // Reset to generation 2 (as `/v1/evaluate/retry` does) and ensure stale gen=1 job cannot touch it.
      await db
        .update(evaluationJobs)
        .set({
          status: 'queued',
          executionGeneration: 2,
          claimToken: null,
          claimExpiresAt: null,
        })
        .where(eq(evaluationJobs.jobId, jobId));

      const staleRes = await handleGradeWritingJob(jobPayload, db, { client });
      expect(staleRes).toBeNull();
      expect(client.callCount).toBe(1);
    } finally {
      await db.delete(evaluationJobs).where(eq(evaluationJobs.jobId, jobId));
      await db.delete(quotaReservations).where(eq(quotaReservations.attemptId, attemptId));
      await db.delete(devices).where(eq(devices.deviceId, deviceId));
    }
  });
});

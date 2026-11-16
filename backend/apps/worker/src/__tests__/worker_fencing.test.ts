import { randomUUID } from 'node:crypto';
import {
  createDbClient,
  devices,
  evaluationJobs,
  jobDispatchOutbox,
  type MockzaDb,
  quotaReservations,
} from '@mockza/db';
import { eq, sql as sqlQuery } from 'drizzle-orm';
import type PgBoss from 'pg-boss';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { sweepPendingDispatchOutbox } from '../index.js';
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
  it('renews its lease while evaluation is still running and stops renewal on completion', async (ctx) => {
    if (!pgReachable) return ctx.skip();
    const deviceId = randomUUID();
    const jobId = randomUUID();
    const attemptId = randomUUID();
    await db.insert(devices).values({ deviceId, edition: 'glb' });
    await db.insert(evaluationJobs).values({
      jobId,
      attemptId,
      deviceId,
      accountKey: deviceId,
      skill: 'writing',
      status: 'queued',
    });
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const inner = createSlowWritingClient(0);
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const running = handleGradeWritingJob(
      {
        jobId,
        attemptId,
        packId: 'writing-pack-01',
        examId: 'ielts_academic',
        taskType: 'task2Essay',
        promptTitle: 'Public Spaces',
        promptBody: 'Discuss.',
        essayText: 'Public spaces foster community well-being.',
      },
      db,
      {
        client: {
          async createChatCompletion() {
            enter();
            await released;
            return inner.createChatCompletion();
          },
        },
      },
    );
    try {
      await entered;
      await db
        .update(evaluationJobs)
        .set({ claimExpiresAt: new Date(Date.now() - 1000) })
        .where(eq(evaluationJobs.jobId, jobId));
      await vi.advanceTimersByTimeAsync(60_000);
      // The interval starts a real database write; poll the row, not simulated time.
      await vi.waitFor(async () => {
        const [row] = await db.select().from(evaluationJobs).where(eq(evaluationJobs.jobId, jobId));
        expect(row?.claimExpiresAt?.getTime()).toBeGreaterThan(Date.now());
      });
      release();
      await running;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      release();
      await running;
      vi.useRealTimers();
      await db.delete(evaluationJobs).where(eq(evaluationJobs.jobId, jobId));
      await db.delete(devices).where(eq(devices.deviceId, deviceId));
    }
  });
  it('recovers an expired claim under a new generation and cannot acknowledge a newer dispatch', async (ctx) => {
    if (!pgReachable) return ctx.skip();
    await db.transaction(async (tx) => {
      // Session-local tables keep recovery sweeps away from unrelated queued work.
      await tx.execute(
        sqlQuery`CREATE TEMP TABLE evaluation_jobs (LIKE public.evaluation_jobs INCLUDING ALL) ON COMMIT DROP`,
      );
      await tx.execute(
        sqlQuery`CREATE TEMP TABLE job_dispatch_outbox (LIKE public.job_dispatch_outbox INCLUDING ALL) ON COMMIT DROP`,
      );
      const isolated = tx as unknown as MockzaDb;
      const deviceId = randomUUID();
      const jobId = randomUUID();
      const attemptId = randomUUID();
      await isolated.insert(evaluationJobs).values({
        jobId,
        attemptId,
        deviceId,
        accountKey: deviceId,
        skill: 'writing',
        status: 'evaluating',
        executionGeneration: 1,
        claimToken: 'crashed-worker',
        claimExpiresAt: new Date(Date.now() - 60_000),
        inputJson: { attemptId, essayText: 'Saved learner work' },
      });
      await isolated.insert(jobDispatchOutbox).values({
        jobId,
        queueName: 'evaluation.writing',
        dispatchKey: `${attemptId}:gen:1`,
        payloadJson: { jobId, attemptId, executionGeneration: 1 },
        status: 'dispatched',
      });
      const delivered: Array<{ payload: Record<string, unknown>; key: string }> = [];
      const boss = {
        async send(
          _queue: string,
          payload: Record<string, unknown>,
          options: { singletonKey: string },
        ) {
          if (payload['jobId'] !== jobId) return randomUUID();
          delivered.push({ payload, key: options.singletonKey });
          // A newer retry replaces this row before the old send returns.
          await isolated
            .update(jobDispatchOutbox)
            .set({
              status: 'pending',
              dispatchKey: `${attemptId}:gen:3`,
              payloadJson: { jobId, attemptId, executionGeneration: 3 },
            })
            .where(eq(jobDispatchOutbox.jobId, jobId));
          return randomUUID();
        },
      } as unknown as PgBoss;
      try {
        await sweepPendingDispatchOutbox(isolated, boss);
        const [job] = await isolated
          .select()
          .from(evaluationJobs)
          .where(eq(evaluationJobs.jobId, jobId));
        expect(job?.executionGeneration).toBe(2);
        expect(job?.claimToken).toBeNull();
        expect(delivered).toHaveLength(1);
        expect(delivered[0]?.key).toBe(`${attemptId}:gen:2`);
        expect(delivered[0]?.payload['executionGeneration']).toBe(2);
        const [outbox] = await isolated
          .select()
          .from(jobDispatchOutbox)
          .where(eq(jobDispatchOutbox.jobId, jobId));
        expect(outbox?.status).toBe('pending');
        expect(outbox?.dispatchKey).toBe(`${attemptId}:gen:3`);
      } finally {
        await isolated.delete(evaluationJobs).where(eq(evaluationJobs.jobId, jobId));
      }
    });
  });
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

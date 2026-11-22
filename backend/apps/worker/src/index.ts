import { loadEnv } from '@mockza/config';
import { createDbClient, evaluationJobs, jobDispatchOutbox, type MockzaDb } from '@mockza/db';
import { createAudioS3Client } from '@mockza/storage';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import PgBoss from 'pg-boss';
import { DROP_INGEST_JOB_QUEUE, handleDropIngestJob } from './jobs/drop-ingest.js';
import { EXPLAIN_JOB_QUEUE, handleExplainQuestionJob } from './jobs/explain-question.js';
import { handleGradeSpeakingJob, SPEAKING_JOB_QUEUE } from './jobs/grade-speaking.js';
import { handleGradeWritingJob, WRITING_JOB_QUEUE } from './jobs/grade-writing.js';
import { handlePurgeAudioJob, PURGE_AUDIO_QUEUE } from './jobs/purge-audio.js';
import {
  ANALYZE_PRONUNCIATION_JOB_QUEUE,
  handleAnalyzePronunciationJob,
} from './jobs/analyze-pronunciation.js';
import {
  handleRegisterShifterJob,
  REGISTER_SHIFTER_JOB_QUEUE,
} from './jobs/register-shifter.js';

const DEFAULT_RETRY_LIMIT = 3;

/** Sweeps pending outbox dispatches and crashed expired-lease jobs using one durable dispatch key (`RR-03`). */
export async function sweepPendingDispatchOutbox(db: MockzaDb, boss: PgBoss): Promise<number> {
  const now = new Date();
  const expiredLeaseCutoff = new Date(now.getTime() - 1000);
  const cutoff = new Date(now.getTime() - 5000);

  // Recover jobs whose worker lease expired mid-flight without deleting generation fencing.
  await db.transaction(async (tx) => {
    const expiredJobs = await tx
      .update(evaluationJobs)
      .set({
        status: 'queued',
        stageDetail: 'Recovering interrupted evaluation after worker lease timeout',
        claimToken: null,
        claimExpiresAt: null,
        executionGeneration: sql`${evaluationJobs.executionGeneration} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          inArray(evaluationJobs.status, ['evaluating', 'processing_audio', 'repairing']),
          lt(evaluationJobs.claimExpiresAt, expiredLeaseCutoff),
        ),
      )
      .returning();

    for (const job of expiredJobs) {
      const queueName =
        job.taskType === 'register_shifter'
          ? REGISTER_SHIFTER_JOB_QUEUE
          : job.taskType === 'drop_ingest'
            ? DROP_INGEST_JOB_QUEUE
            : job.taskType === 'pronunciation'
              ? ANALYZE_PRONUNCIATION_JOB_QUEUE
              : job.skill === 'speaking'
                ? SPEAKING_JOB_QUEUE
                : WRITING_JOB_QUEUE;
      const payload = {
        ...(job.inputJson as Record<string, unknown>),
        jobId: job.jobId,
        executionGeneration: job.executionGeneration,
      };
      const dispatchKey = `${job.attemptId}:gen:${job.executionGeneration}`;
      await tx
        .insert(jobDispatchOutbox)
        .values({
          jobId: job.jobId,
          queueName,
          dispatchKey,
          payloadJson: payload,
          status: 'pending',
          updatedAt: new Date(cutoff.getTime() - 1),
        })
        .onConflictDoUpdate({
          target: jobDispatchOutbox.jobId,
          set: {
            queueName,
            dispatchKey,
            payloadJson: payload,
            status: 'pending',
            updatedAt: new Date(cutoff.getTime() - 1),
          },
        });
    }
  });

  const pending = await db
    .select()
    .from(jobDispatchOutbox)
    .where(and(eq(jobDispatchOutbox.status, 'pending'), lt(jobDispatchOutbox.updatedAt, cutoff)))
    .limit(50);

  let dispatchedCount = 0;
  for (const row of pending) {
    try {
      const payload = row.payloadJson;
      const attemptId = typeof payload['attemptId'] === 'string' ? payload['attemptId'] : row.jobId;
      const execGen =
        typeof payload['executionGeneration'] === 'number' ? payload['executionGeneration'] : 1;
      const singletonKey = row.dispatchKey ?? `${attemptId}:gen:${execGen}`;
      await boss.send(row.queueName, payload, {
        singletonKey,
        retryLimit: DEFAULT_RETRY_LIMIT,
        retryBackoff: true,
      });
      await db
        .update(jobDispatchOutbox)
        .set({ status: 'dispatched', updatedAt: new Date() })
        .where(
          and(
            eq(jobDispatchOutbox.jobId, row.jobId),
            sql`${jobDispatchOutbox.dispatchKey} IS NOT DISTINCT FROM ${row.dispatchKey}`,
            eq(jobDispatchOutbox.status, 'pending'),
          ),
        );
      dispatchedCount += 1;
    } catch (err) {
      await db
        .update(jobDispatchOutbox)
        .set({
          attempts: row.attempts + 1,
          lastError: (err as Error).message.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(jobDispatchOutbox.jobId, row.jobId),
            sql`${jobDispatchOutbox.dispatchKey} IS NOT DISTINCT FROM ${row.dispatchKey}`,
            eq(jobDispatchOutbox.status, 'pending'),
          ),
        );
    }
  }
  return dispatchedCount;
}

export async function startWorker(): Promise<{ boss: PgBoss; stop: () => Promise<void> }> {
  const env = loadEnv();
  const { db, sql } = createDbClient(env.DATABASE_URL, {
    max: env.WORKER_CONCURRENCY,
    prepare: !env.PG_PGBOUNCER,
  });
  const s3Client = createAudioS3Client(env);

  const boss = new PgBoss({
    connectionString: env.DATABASE_URL,
    max: env.WORKER_CONCURRENCY,
  });
  boss.on('error', (err) => {
    process.stderr.write(`pg-boss worker error: ${err.message}\n`);
  });

  await boss.start();

  // Create queues with production retry bounds (B5.1)
  const concurrency = Math.min(15, Math.max(1, env.WORKER_CONCURRENCY));
  const batchSize = Math.min(10, concurrency);
  await boss.createQueue(WRITING_JOB_QUEUE, {
    name: WRITING_JOB_QUEUE,
    retryLimit: DEFAULT_RETRY_LIMIT,
    retryBackoff: true,
  });
  await boss.createQueue(SPEAKING_JOB_QUEUE, {
    name: SPEAKING_JOB_QUEUE,
    retryLimit: DEFAULT_RETRY_LIMIT,
    retryBackoff: true,
  });
  await boss.createQueue(EXPLAIN_JOB_QUEUE, {
    name: EXPLAIN_JOB_QUEUE,
    retryLimit: DEFAULT_RETRY_LIMIT,
    retryBackoff: true,
  });
  await boss.createQueue(REGISTER_SHIFTER_JOB_QUEUE, {
    name: REGISTER_SHIFTER_JOB_QUEUE,
    retryLimit: 2,
    retryBackoff: true,
  });
  await boss.createQueue(DROP_INGEST_JOB_QUEUE, {
    name: DROP_INGEST_JOB_QUEUE,
    retryLimit: 2,
    retryBackoff: true,
  });
  await boss.createQueue(ANALYZE_PRONUNCIATION_JOB_QUEUE, {
    name: ANALYZE_PRONUNCIATION_JOB_QUEUE,
    retryLimit: 2,
    retryBackoff: true,
  });
  await boss.createQueue(PURGE_AUDIO_QUEUE, {
    name: PURGE_AUDIO_QUEUE,
    retryLimit: 2,
  });

  // Process jobs with bounded concurrency (`batchSize: 1` per worker slot, `Promise.allSettled` if batched)
  // and `includeMetadata: true` so retries/terminal refunds synchronize cleanly (`TD-15`, `TD-51`).
  await boss.work(WRITING_JOB_QUEUE, { batchSize, includeMetadata: true }, async (jobs) => {
    const outcomes = await Promise.allSettled(
      jobs.map(async (job) => {
        const meta = job as { retryCount?: number; retryLimit?: number; data: unknown };
        const attemptNumber = (meta.retryCount ?? 0) + 1;
        const maxAttempts = (meta.retryLimit ?? DEFAULT_RETRY_LIMIT) + 1;
        await handleGradeWritingJob(
          meta.data as Parameters<typeof handleGradeWritingJob>[0],
          db,
          undefined,
          { attemptNumber, maxAttempts },
        );
      }),
    );
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        throw outcome.reason;
      }
    }
  });

  await boss.work(SPEAKING_JOB_QUEUE, { batchSize, includeMetadata: true }, async (jobs) => {
    const outcomes = await Promise.allSettled(
      jobs.map(async (job) => {
        const meta = job as { retryCount?: number; retryLimit?: number; data: unknown };
        const attemptNumber = (meta.retryCount ?? 0) + 1;
        const maxAttempts = (meta.retryLimit ?? DEFAULT_RETRY_LIMIT) + 1;
        await handleGradeSpeakingJob(
          meta.data as Parameters<typeof handleGradeSpeakingJob>[0],
          db,
          s3Client,
          env.S3_BUCKET,
          undefined,
          { attemptNumber, maxAttempts },
        );
      }),
    );
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        throw outcome.reason;
      }
    }
  });

  await boss.work(EXPLAIN_JOB_QUEUE, { batchSize }, async (jobs) => {
    const outcomes = await Promise.allSettled(
      jobs.map((job) =>
        handleExplainQuestionJob(job.data as Parameters<typeof handleExplainQuestionJob>[0], db),
      ),
    );
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        throw outcome.reason;
      }
    }
  });

  await boss.work(REGISTER_SHIFTER_JOB_QUEUE, { batchSize, includeMetadata: true }, async (jobs) => {
    const outcomes = await Promise.allSettled(
      jobs.map(async (job) => {
        const meta = job as { retryCount?: number; retryLimit?: number; data: unknown };
        const attemptNumber = (meta.retryCount ?? 0) + 1;
        const maxAttempts = (meta.retryLimit ?? 2) + 1;
        await handleRegisterShifterJob(
          meta.data as Parameters<typeof handleRegisterShifterJob>[0],
          db,
          s3Client,
          env.S3_BUCKET,
          undefined,
          { attemptNumber, maxAttempts },
        );
      }),
    );
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        throw outcome.reason;
      }
    }
  });

  await boss.work(DROP_INGEST_JOB_QUEUE, { batchSize, includeMetadata: true }, async (jobs) => {
    const outcomes = await Promise.allSettled(
      jobs.map(async (job) => {
        const meta = job as { retryCount?: number; retryLimit?: number; data: unknown };
        const attemptNumber = (meta.retryCount ?? 0) + 1;
        const maxAttempts = (meta.retryLimit ?? 2) + 1;
        await handleDropIngestJob(
          meta.data as Parameters<typeof handleDropIngestJob>[0],
          db,
          s3Client,
          env.S3_BUCKET,
          { ttlDays: env.AUDIO_TTL_DAYS },
          { attemptNumber, maxAttempts },
        );
      }),
    );
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        throw outcome.reason;
      }
    }
  });

  await boss.work(ANALYZE_PRONUNCIATION_JOB_QUEUE, { batchSize, includeMetadata: true }, async (jobs) => {
    const outcomes = await Promise.allSettled(
      jobs.map(async (job) => {
        const meta = job as { retryCount?: number; retryLimit?: number; data: unknown };
        const attemptNumber = (meta.retryCount ?? 0) + 1;
        const maxAttempts = (meta.retryLimit ?? 2) + 1;
        await handleAnalyzePronunciationJob(
          meta.data as Parameters<typeof handleAnalyzePronunciationJob>[0],
          db,
          s3Client,
          env.S3_BUCKET,
          { modelOverride: env.OPENROUTER_PRONUNCIATION_MODEL },
          { attemptNumber, maxAttempts },
        );
      }),
    );
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        throw outcome.reason;
      }
    }
  });

  await boss.schedule(PURGE_AUDIO_QUEUE, '0 * * * *', {});
  await boss.work(PURGE_AUDIO_QUEUE, async () => {
    await handlePurgeAudioJob({ db, s3Client, bucket: env.S3_BUCKET });
  });

  let sweepingOutbox = false;
  const outboxTimer = setInterval(() => {
    if (sweepingOutbox) return;
    sweepingOutbox = true;
    void sweepPendingDispatchOutbox(db, boss)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`outbox sweep error (retrying next tick): ${msg}\n`);
      })
      .finally(() => {
        sweepingOutbox = false;
      });
  }, 10_000).unref();

  process.stdout.write(
    `mockza-worker pool started with concurrency=${concurrency} (${env.EDITION})\n`,
  );

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(outboxTimer);
    process.stdout.write('Stopping mockza-worker gracefully...\n');
    await boss.stop({ graceful: true, timeout: 30_000 });
    await sql.end({ timeout: 5 });
  };

  process.on('SIGINT', () => void stop().then(() => process.exit(0)));
  process.on('SIGTERM', () => void stop().then(() => process.exit(0)));

  return { boss, stop };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startWorker();
}

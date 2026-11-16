import { loadEnv } from '@mockza/config';
import { createDbClient, jobDispatchOutbox, type MockzaDb } from '@mockza/db';
import { createAudioS3Client } from '@mockza/storage';
import { and, eq, lt } from 'drizzle-orm';
import PgBoss from 'pg-boss';
import { EXPLAIN_JOB_QUEUE, handleExplainQuestionJob } from './jobs/explain-question.js';
import { handleGradeSpeakingJob, SPEAKING_JOB_QUEUE } from './jobs/grade-speaking.js';
import { handleGradeWritingJob, WRITING_JOB_QUEUE } from './jobs/grade-writing.js';
import { handlePurgeAudioJob, PURGE_AUDIO_QUEUE } from './jobs/purge-audio.js';

const DEFAULT_RETRY_LIMIT = 3;

/** Sweeps any outbox dispatches left pending by an API crash between DB commit and enqueue (`TD-14`). */
export async function sweepPendingDispatchOutbox(db: MockzaDb, boss: PgBoss): Promise<number> {
  const cutoff = new Date(Date.now() - 5000);
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
      await boss.send(row.queueName, payload, {
        singletonKey: `${attemptId}:outbox:${row.attempts}`,
        retryLimit: DEFAULT_RETRY_LIMIT,
        retryBackoff: true,
      });
      await db
        .update(jobDispatchOutbox)
        .set({ status: 'dispatched', updatedAt: new Date() })
        .where(eq(jobDispatchOutbox.jobId, row.jobId));
      dispatchedCount += 1;
    } catch (err) {
      await db
        .update(jobDispatchOutbox)
        .set({
          attempts: row.attempts + 1,
          lastError: (err as Error).message.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(jobDispatchOutbox.jobId, row.jobId));
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
  await boss.createQueue(PURGE_AUDIO_QUEUE, {
    name: PURGE_AUDIO_QUEUE,
    retryLimit: 2,
  });

  // Process jobs with bounded concurrency (`batchSize: 1` per worker slot, `Promise.allSettled` if batched)
  // and `includeMetadata: true` so retries/terminal refunds synchronize cleanly (`TD-15`, `TD-51`).
  await boss.work(WRITING_JOB_QUEUE, { batchSize, includeMetadata: true }, async (jobs) => {
    await Promise.all(
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
  });

  await boss.work(SPEAKING_JOB_QUEUE, { batchSize, includeMetadata: true }, async (jobs) => {
    await Promise.all(
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
  });

  await boss.work(EXPLAIN_JOB_QUEUE, { batchSize }, async (jobs) => {
    await Promise.all(
      jobs.map((job) =>
        handleExplainQuestionJob(job.data as Parameters<typeof handleExplainQuestionJob>[0], db),
      ),
    );
  });

  await boss.schedule(PURGE_AUDIO_QUEUE, '0 * * * *', {});
  await boss.work(PURGE_AUDIO_QUEUE, async () => {
    await handlePurgeAudioJob({ db, s3Client, bucket: env.S3_BUCKET });
  });

  const outboxTimer = setInterval(() => {
    void sweepPendingDispatchOutbox(db, boss);
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

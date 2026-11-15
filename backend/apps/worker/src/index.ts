import { loadEnv } from '@mockza/config';
import { createDbClient } from '@mockza/db';
import { createAudioS3Client } from '@mockza/storage';
import PgBoss from 'pg-boss';
import { EXPLAIN_JOB_QUEUE, handleExplainQuestionJob } from './jobs/explain-question.js';
import { handleGradeSpeakingJob, SPEAKING_JOB_QUEUE } from './jobs/grade-speaking.js';
import { handleGradeWritingJob, WRITING_JOB_QUEUE } from './jobs/grade-writing.js';
import { handlePurgeAudioJob, PURGE_AUDIO_QUEUE } from './jobs/purge-audio.js';

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
    retryLimit: 3,
    retryBackoff: true,
  });
  await boss.createQueue(SPEAKING_JOB_QUEUE, {
    name: SPEAKING_JOB_QUEUE,
    retryLimit: 3,
    retryBackoff: true,
  });
  await boss.createQueue(EXPLAIN_JOB_QUEUE, {
    name: EXPLAIN_JOB_QUEUE,
    retryLimit: 3,
    retryBackoff: true,
  });
  await boss.createQueue(PURGE_AUDIO_QUEUE, {
    name: PURGE_AUDIO_QUEUE,
    retryLimit: 2,
  });

  // Evaluation Writing Worker
  await boss.work(WRITING_JOB_QUEUE, { batchSize }, async (jobs) => {
    for (const job of jobs) {
      await handleGradeWritingJob(job.data as Parameters<typeof handleGradeWritingJob>[0], db);
    }
  });

  // Evaluation Speaking Worker
  await boss.work(SPEAKING_JOB_QUEUE, { batchSize }, async (jobs) => {
    for (const job of jobs) {
      await handleGradeSpeakingJob(
        job.data as Parameters<typeof handleGradeSpeakingJob>[0],
        db,
        s3Client,
        env.S3_BUCKET,
      );
    }
  });

  // Question Explainer Worker
  await boss.work(EXPLAIN_JOB_QUEUE, { batchSize }, async (jobs) => {
    for (const job of jobs) {
      await handleExplainQuestionJob(
        job.data as Parameters<typeof handleExplainQuestionJob>[0],
        db,
      );
    }
  });

  // Scheduled audio maintenance cron: runs hourly (B3.1 / B5.1)
  await boss.schedule(PURGE_AUDIO_QUEUE, '0 * * * *', {});
  await boss.work(PURGE_AUDIO_QUEUE, async () => {
    await handlePurgeAudioJob({ db, s3Client, bucket: env.S3_BUCKET });
  });

  process.stdout.write(
    `mockza-worker pool started with concurrency=${concurrency} (${env.EDITION})\n`,
  );

  const stop = async () => {
    process.stdout.write('Stopping mockza-worker gracefully...\n');
    await boss.stop({ graceful: true, timeout: 5000 });
    await sql.end({ timeout: 5 });
  };

  process.on('SIGINT', () => void stop().then(() => process.exit(0)));
  process.on('SIGTERM', () => void stop().then(() => process.exit(0)));

  return { boss, stop };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startWorker();
}

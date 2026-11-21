import { serve } from '@hono/node-server';
import { loadEnv } from '@mockza/config';
import { createDbClient } from '@mockza/db';
import { createAudioS3Client } from '@mockza/storage';
import PgBoss from 'pg-boss';
import { createApiApp } from './app.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const { db, sql } = createDbClient(env.DATABASE_URL, {
    max: env.PG_POOL_MAX,
    prepare: !env.PG_PGBOUNCER,
  });
  const s3Client = createAudioS3Client(env);

  let boss: PgBoss | undefined;
  try {
    const candidate = new PgBoss(env.DATABASE_URL);
    candidate.on('error', (err) => {
      process.stderr.write(`pg-boss producer error: ${err.message}\n`);
    });
    await candidate.start();
    boss = candidate;
  } catch (error) {
    process.stderr.write(
      `Warning: Failed to start pg-boss producer: ${(error as Error).message}\n`,
    );
    boss = undefined;
  }

  const app = createApiApp(env, {
    db,
    sql,
    boss,
    s3Client,
    isQueueReady: () => Boolean(boss),
  });

  const server = serve(
    {
      fetch: app.fetch,
      hostname: '0.0.0.0',
      port: env.PORT,
    },
    (info) => {
      process.stdout.write(
        `mockza-api listening on http://0.0.0.0:${info.port} (${env.EDITION})\n`,
      );
    },
  );

  let shuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    process.stdout.write(`Received ${signal}. Shutting down mockza-api cleanly...\n`);

    const timeout = setTimeout(() => {
      process.stderr.write('Forceful shutdown after timeout.\n');
      process.exit(1);
    }, 10_000).unref();

    try {
      server.close();
      if (boss) {
        await boss.stop({ graceful: true, timeout: 5000 });
      }
      await sql.end({ timeout: 5 });
      clearTimeout(timeout);
      process.stdout.write('mockza-api shut down successfully.\n');
      process.exit(0);
    } catch (err) {
      process.stderr.write(`Error during shutdown: ${(err as Error).message}\n`);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

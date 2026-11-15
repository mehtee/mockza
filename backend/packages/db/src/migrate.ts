import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '@mockza/config';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDbClient } from './client.js';
import { seedDatabase } from './seed.js';

async function runMigrations(): Promise<void> {
  const env = loadEnv();
  const candidates = [
    process.env['MIGRATIONS_DIR'],
    fileURLToPath(new URL('./migrations', import.meta.url)),
    fileURLToPath(new URL('../src/migrations', import.meta.url)),
  ].filter((value): value is string => Boolean(value));

  const migrationsFolder = candidates.find((candidate) => existsSync(candidate));
  if (!migrationsFolder) {
    throw new Error(`No Drizzle migrations folder found in: ${candidates.join(', ')}`);
  }

  const { db, sql } = createDbClient(env.DATABASE_URL, { max: 1, prepare: false });
  try {
    await migrate(db, { migrationsFolder });
    const seedResult = await seedDatabase(db);
    process.stdout.write(
      `mockza-db migrated from ${migrationsFolder} and seeded: ${JSON.stringify(seedResult)}\n`,
    );
  } finally {
    await sql.end();
  }
}

await runMigrations();

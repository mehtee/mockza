import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export interface DbClientOptions {
  max?: number;
  prepare?: boolean;
  idleTimeoutSeconds?: number;
  connectTimeoutSeconds?: number;
}

export function createDbClient(databaseUrl: string, options: DbClientOptions = {}) {
  const sql = postgres(databaseUrl, {
    max: options.max ?? 10,
    prepare: options.prepare ?? true,
    idle_timeout: options.idleTimeoutSeconds ?? 20,
    connect_timeout: options.connectTimeoutSeconds ?? 10,
  });
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export async function checkDbHealth(
  sql: postgres.Sql,
  timeoutMs = 5000,
): Promise<{ healthy: boolean; latencyMs: number }> {
  const start = Date.now();
  const timer = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('DB health check timeout')), timeoutMs),
  );
  try {
    await Promise.race([sql`SELECT 1`, timer]);
    return { healthy: true, latencyMs: Date.now() - start };
  } catch (_error) {
    return { healthy: false, latencyMs: Date.now() - start };
  }
}

export type MockzaDb = ReturnType<typeof createDbClient>['db'];

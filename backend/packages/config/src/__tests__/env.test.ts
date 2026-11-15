import { describe, expect, it } from 'vitest';
import { loadEnv } from '../env.js';

describe('@mockza/config env schema', () => {
  it('loads default global edition values cleanly', () => {
    const env = loadEnv({});
    expect(env.EDITION).toBe('glb');
    expect(env.MAX_AUDIO_MB).toBe(5);
    expect(env.AUDIO_TTL_DAYS).toBe(30);
    expect(env.PG_PGBOUNCER).toBe(false);
    expect(env.PG_POOL_MAX).toBe(20);
    expect(env.WORKER_CONCURRENCY).toBe(15);
    expect(env.OPENROUTER_NO_RETENTION).toBe(true);
    expect(env.REVENUECAT_API_KEY).toBe('');
    expect(env.APPLE_CLIENT_ID).toBe('');
    expect(env.GOOGLE_CLIENT_ID).toBe('');
    expect(env.SSE_ENABLED).toBe(false);
  });

  it('rejects unsupported edition flags', () => {
    expect(() => loadEnv({ EDITION: 'invalid' })).toThrow();
  });
});

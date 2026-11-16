import { describe, expect, it } from 'vitest';
import { loadEnv } from '../env.js';

describe('@mockza/config env schema', () => {
  it('loads default global edition values cleanly in development', () => {
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
    expect(env.ALLOW_DEMO_EVALUATOR).toBe(false);
  });

  it('rejects unsupported edition flags', () => {
    expect(() => loadEnv({ EDITION: 'invalid' })).toThrow();
  });

  it('rejects dev default secrets and missing webhook secret in production', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow();
    expect(() =>
      loadEnv({
        NODE_ENV: 'production',
        EDITION: 'glb',
        DATABASE_URL: 'postgres://prod:strong_pass@db:5432/mockza',
        JWT_SECRET: 'prod-jwt-secret-with-at-least-32-characters',
        ADMIN_API_KEY: 'prod-admin-key-at-least-16',
        S3_ACCESS_KEY: 'prod-s3-access',
        S3_SECRET_KEY: 'prod-s3-secret',
        REVENUECAT_WEBHOOK_SECRET: '',
      }),
    ).toThrow();
  });

  it('accepts properly hardened production config', () => {
    const prod = loadEnv({
      NODE_ENV: 'production',
      EDITION: 'glb',
      DATABASE_URL: 'postgres://prod:strong_pass@db:5432/mockza',
      JWT_SECRET: 'prod-jwt-secret-with-at-least-32-characters',
      ADMIN_API_KEY: 'prod-admin-key-at-least-16',
      S3_ACCESS_KEY: 'prod-s3-access',
      S3_SECRET_KEY: 'prod-s3-secret',
      REVENUECAT_WEBHOOK_SECRET: 'prod-rc-webhook-secret',
    });
    expect(prod.NODE_ENV).toBe('production');
  });
});

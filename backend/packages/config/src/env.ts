import { z } from 'zod';

/** Regional distribution flavor flag enforced server-side (ADR-002 / ADR-011). */
export const EditionSchema = z.enum(['glb', 'irn']);
export type Edition = z.infer<typeof EditionSchema>;

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  EDITION: EditionSchema.default('glb'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgres://mockza:mockza_dev_password@localhost:5432/mockza'),
  PG_PGBOUNCER: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  PG_POOL_MAX: z.coerce.number().int().positive().default(20),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(15),
  OPENROUTER_NO_RETENTION: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  REVENUECAT_API_KEY: z.string().default(''),
  APPLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_ID: z.string().default(''),
  SSE_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  S3_ENDPOINT: z.string().url().default('http://localhost:8333'),
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1).default('mockza-audio-private'),
  S3_ACCESS_KEY: z.string().min(1).default('mockza_s3_access'),
  S3_SECRET_KEY: z.string().min(1).default('mockza_s3_secret'),
  S3_MEDIA_BUCKET: z.string().min(1).default('mockza-media'),
  S3_PUBLIC_MODE: z.enum(['proxy', 'presigned']).default('proxy'),
  ADMIN_API_KEY: z.string().min(8).default('mockza-dev-admin-key-change-me'),
  JWT_SECRET: z.string().min(16).default('dev-insecure-replace-before-prod-32chars'),
  APP_ATTEST_ENFORCED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  OPENROUTER_API_KEY: z.string().default(''),
  LANGFUSE_SECRET_KEY: z.string().default(''),
  LANGFUSE_PUBLIC_KEY: z.string().default(''),
  LANGFUSE_HOST: z.string().url().default('https://cloud.langfuse.com'),
  REVENUECAT_WEBHOOK_SECRET: z.string().default(''),
  CAFEBAZAAR_SECRET: z.string().default(''),
  MYKET_SECRET: z.string().default(''),
  POSTHOG_API_KEY: z.string().default(''),
  MAX_AUDIO_MB: z.coerce.number().positive().max(25).default(5),
  AUDIO_TTL_DAYS: z.coerce.number().int().positive().max(30).default(30),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  return EnvSchema.parse(source);
}

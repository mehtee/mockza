import { z } from 'zod';

/** Regional distribution flavor flag enforced server-side (ADR-002 / ADR-011). */
export const EditionSchema = z.enum(['glb', 'irn']);
export type Edition = z.infer<typeof EditionSchema>;

const DEV_DEFAULT_JWT_SECRET = 'dev-insecure-replace-before-prod-32chars';
const DEV_DEFAULT_ADMIN_KEY = 'mockza-dev-admin-key-change-me';
const DEV_DEFAULT_S3_ACCESS_KEY = 'mockza_s3_access';
const DEV_DEFAULT_S3_SECRET_KEY = 'mockza_s3_secret';
const DEV_DEFAULT_DB_PASSWORD = 'mockza_dev_password';

export const BaseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  EDITION: EditionSchema.default('glb'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default(`postgres://mockza:${DEV_DEFAULT_DB_PASSWORD}@localhost:5432/mockza`),
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
  ALLOW_DEV_AUTH_PROVIDERS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SSE_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  S3_ENDPOINT: z.string().url().default('http://localhost:8333'),
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1).default('mockza-audio-private'),
  S3_ACCESS_KEY: z.string().min(1).default(DEV_DEFAULT_S3_ACCESS_KEY),
  S3_SECRET_KEY: z.string().min(1).default(DEV_DEFAULT_S3_SECRET_KEY),
  S3_MEDIA_BUCKET: z.string().min(1).default('mockza-media'),
  S3_PUBLIC_MODE: z.enum(['proxy', 'presigned']).default('proxy'),
  ADMIN_API_KEY: z.string().min(8).default(DEV_DEFAULT_ADMIN_KEY),
  JWT_SECRET: z.string().min(16).default(DEV_DEFAULT_JWT_SECRET),
  APP_ATTEST_ENFORCED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  APP_ATTEST_HMAC_SECRET: z.string().default(''),
  OPENROUTER_API_KEY: z.string().default(''),
  ALLOW_DEMO_EVALUATOR: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  LANGFUSE_SECRET_KEY: z.string().default(''),
  LANGFUSE_PUBLIC_KEY: z.string().default(''),
  LANGFUSE_HOST: z.string().url().default('https://cloud.langfuse.com'),
  REVENUECAT_WEBHOOK_SECRET: z.string().default(''),
  BILLING_WEBHOOK_DISABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  ZARINPAL_MERCHANT_ID: z.string().default(''),
  ZARINPAL_SANDBOX: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  KAVENEGAR_API_KEY: z.string().default(''),
  KAVENEGAR_OTP_TEMPLATE: z.string().default('mockza-verify'),
  WEB_PUBLIC_BASE_URL: z.string().default('http://127.0.0.1:45280'),
  CAFEBAZAAR_SECRET: z.string().default(''),
  MYKET_SECRET: z.string().default(''),
  MAX_AUDIO_MB: z.coerce.number().positive().max(25).default(5),
  AUDIO_TTL_DAYS: z.coerce.number().int().positive().max(30).default(30),
  TRUSTED_PROXY_IPS: z.string().default(''),
  OPENROUTER_ALPHA_BASE_URL: z.string().url().default('https://openrouter.ai/api/alpha'),
  ENABLE_LINGUISTIC_GRAPH: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  ENABLE_REGISTER_SHIFTER: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  ENABLE_DROP_ANYTHING_TEXT_IMAGE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  ENABLE_DROP_ANYTHING_AUDIO: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export const EnvSchema = BaseEnvSchema.superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  if (env.JWT_SECRET === DEV_DEFAULT_JWT_SECRET || env.JWT_SECRET.length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message: 'Production JWT_SECRET must be at least 32 characters and not the dev default.',
    });
  }

  if (env.ADMIN_API_KEY === DEV_DEFAULT_ADMIN_KEY || env.ADMIN_API_KEY.length < 16) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ADMIN_API_KEY'],
      message: 'Production ADMIN_API_KEY must be at least 16 characters and not the dev default.',
    });
  }

  if (
    env.S3_ACCESS_KEY === DEV_DEFAULT_S3_ACCESS_KEY ||
    env.S3_SECRET_KEY === DEV_DEFAULT_S3_SECRET_KEY
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['S3_SECRET_KEY'],
      message: 'Production S3 credentials must not use development defaults.',
    });
  }

  if (env.DATABASE_URL.includes(DEV_DEFAULT_DB_PASSWORD)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DATABASE_URL'],
      message: 'Production DATABASE_URL must not use the development password.',
    });
  }

  if (env.EDITION === 'glb' && !env.BILLING_WEBHOOK_DISABLED && !env.REVENUECAT_WEBHOOK_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['REVENUECAT_WEBHOOK_SECRET'],
      message:
        'Production glb deployment requires REVENUECAT_WEBHOOK_SECRET unless BILLING_WEBHOOK_DISABLED=true.',
    });
  }

  if (env.ALLOW_DEMO_EVALUATOR) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ALLOW_DEMO_EVALUATOR'],
      message: 'ALLOW_DEMO_EVALUATOR is prohibited in production.',
    });
  }

  if (env.ALLOW_DEV_AUTH_PROVIDERS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['ALLOW_DEV_AUTH_PROVIDERS'],
      message: 'ALLOW_DEV_AUTH_PROVIDERS is prohibited in production.',
    });
  }
});

export type AppEnv = z.infer<typeof EnvSchema>;

/** Splits comma-separated OAuth client IDs (e.g. Web, iOS, Android) into trimmed unique entries. */
export function parseProviderClientIds(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    ),
  );
}

export function loadEnv(source: Record<string, string | undefined> = process.env): AppEnv {
  return EnvSchema.parse(source);
}

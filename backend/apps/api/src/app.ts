import type { S3Client } from '@aws-sdk/client-s3';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import type { MockzaDb } from '@mockza/db';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import type PgBoss from 'pg-boss';
import type postgres from 'postgres';
import {
  createAttestationMiddleware,
  createChallengeStore,
  type VerifyAttestationProofFn,
} from './middleware/attest.js';
import { createEditionGuardMiddleware } from './middleware/edition-guard.js';
import { createRateLimitMiddleware } from './middleware/rate-limit.js';
import { type RequestVariables, requestIdMiddleware } from './middleware/request-id.js';
import { registerAccountRoutes } from './routes/account.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCatalogRoutes } from './routes/catalog.js';
import { registerEvaluateRoutes } from './routes/evaluate.js';
import { registerContentRoutes } from './routes/exams.js';
import { registerFeedbackRoutes } from './routes/feedback.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerJobRoutes } from './routes/jobs.js';
import { registerMediaRoutes } from './routes/media.js';
import { registerQuotaRoutes } from './routes/quota.js';
import { registerUploadRoutes } from './routes/uploads.js';
import { registerBillingWebhookRoutes } from './routes/webhooks-revenuecat.js';
import type { VerifyProviderTokenFn } from './services/provider-verify.js';

export interface ApiAppDependencies {
  db?: MockzaDb;
  sql?: postgres.Sql;
  boss?: PgBoss;
  s3Client?: S3Client;
  isQueueReady?: () => boolean;
  verifyProviderToken?: VerifyProviderTokenFn;
  verifyAttestationProof?: VerifyAttestationProofFn;
}

export function createApiApp(
  env: AppEnv,
  deps: ApiAppDependencies = {},
): OpenAPIHono<{ Variables: RequestVariables }> {
  const app = new OpenAPIHono<{ Variables: RequestVariables }>();
  const challengeStore = createChallengeStore(deps.db);

  const trustedProxyIps = new Set(
    (env.TRUSTED_PROXY_IPS ?? '127.0.0.1,::1')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );

  app.onError((err, c) => {
    const requestId = c.get('requestId') ?? 'unknown';
    if (err instanceof HTTPException) {
      const status = err.status;
      return c.json(
        {
          code: status === 413 ? 'payload_too_large' : 'request_error',
          message: status >= 500 ? 'Internal server error.' : err.message,
          requestId,
        },
        status,
      );
    }
    return c.json(
      {
        code: 'internal_error',
        message: 'Unexpected internal error.',
        requestId,
      },
      500,
    );
  });

  app.use('*', cors());
  app.use('*', requestIdMiddleware);
  app.use(
    '/v1/*',
    createRateLimitMiddleware({ windowMs: 60_000, maxRequests: 120, trustedProxyIps }),
  );
  // Bound JSON API routes (upload proxy enforces its own streaming byte cap `RR-17`).
  app.use('/v1/evaluate/*', bodyLimit({ maxSize: 2 * 1024 * 1024 }));
  app.use('/v1/auth/*', bodyLimit({ maxSize: 256 * 1024 }));
  app.use('/v1/*', createEditionGuardMiddleware(env.EDITION));
  app.use(
    '/v1/auth/*',
    createAttestationMiddleware({
      enforced: env.APP_ATTEST_ENFORCED,
      challengeStore,
      hmacSecret: env.APP_ATTEST_HMAC_SECRET,
      verifyProof: deps.verifyAttestationProof,
    }),
  );

  registerHealthRoutes(app, env, deps.sql, deps.s3Client, deps.isQueueReady);
  registerAuthRoutes(app, env, deps.db, {
    challengeStore,
    verifyProviderToken: deps.verifyProviderToken,
  });
  registerUploadRoutes(app, env, deps.db, deps.s3Client);
  registerMediaRoutes(app, env, deps.s3Client);
  registerContentRoutes(app, env, deps.db);
  registerAdminRoutes(app, env, deps.db, deps.s3Client);
  registerEvaluateRoutes(app, env, deps.db, deps.boss, deps.s3Client, deps.isQueueReady);
  registerJobRoutes(app, env, deps.db);
  registerQuotaRoutes(app, env, deps.db);
  registerCatalogRoutes(app, env, deps.db);
  registerBillingWebhookRoutes(app, env, deps.db);
  registerAccountRoutes(app, env, deps.db, deps.s3Client);
  registerFeedbackRoutes(app, env, deps.db);

  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Mockza API',
      version: '0.1.0',
    },
  });

  return app;
}

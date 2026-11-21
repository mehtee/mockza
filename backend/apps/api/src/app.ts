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
import { registerWebBillingRoutes } from './routes/billing.js';
import { registerCatalogRoutes } from './routes/catalog.js';
import { registerDiagnosticRoutes } from './routes/diagnostic.js';
import { registerDropRoutes } from './routes/drop.js';
import { registerEvaluateRoutes } from './routes/evaluate.js';
import { registerContentRoutes } from './routes/exams.js';
import { registerFeedbackRoutes } from './routes/feedback.js';
import { registerGraphAndMissionRoutes } from './routes/graph-and-missions.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerJobRoutes } from './routes/jobs.js';
import { registerMediaRoutes } from './routes/media.js';
import { registerQuotaRoutes } from './routes/quota.js';
import { registerShifterRoutes } from './routes/register-shifter.js';
import { registerUploadRoutes } from './routes/uploads.js';
import { registerBillingWebhookRoutes } from './routes/webhooks-revenuecat.js';
import type { VerifyProviderTokenFn } from './services/provider-verify.js';
import { createSessionManager } from './services/session-manager.js';
import type { OtpChallengeService } from './services/sms-gateway.js';
import type { WebBillingService } from './services/web-billing.js';

export interface ApiAppDependencies {
  db?: MockzaDb;
  sql?: postgres.Sql;
  boss?: PgBoss;
  s3Client?: S3Client;
  isQueueReady?: () => boolean;
  verifyProviderToken?: VerifyProviderTokenFn;
  verifyAttestationProof?: VerifyAttestationProofFn;
  otpService?: OtpChallengeService;
  webBillingService?: WebBillingService;
}

export function createApiApp(
  env: AppEnv,
  deps: ApiAppDependencies = {},
): OpenAPIHono<{ Variables: RequestVariables }> {
  const app = new OpenAPIHono<{ Variables: RequestVariables }>();
  const challengeStore = createChallengeStore(deps.db);
  const sessionManager = createSessionManager(env, deps.db);

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

  app.use(
    '*',
    cors({
      origin: (origin) => origin || '*',
      credentials: true,
      allowHeaders: ['Content-Type', 'Authorization', 'X-Mockza-Edition', 'X-Attest-Proof'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use('*', requestIdMiddleware);
  app.use(
    '/v1/*',
    createRateLimitMiddleware({ windowMs: 60_000, maxRequests: 120, trustedProxyIps }),
  );
  // Bound JSON API routes (upload proxy enforces its own streaming byte cap `RR-17`).
  app.use('/v1/evaluate/*', bodyLimit({ maxSize: 2 * 1024 * 1024 }));
  app.use('/v1/diagnostic/*', bodyLimit({ maxSize: 2 * 1024 * 1024 }));
  app.use('/v1/drop/*', bodyLimit({ maxSize: 512 * 1024 }));
  app.use('/v1/missions/*', bodyLimit({ maxSize: 256 * 1024 }));
  app.use('/v1/register-shifter/*', bodyLimit({ maxSize: 256 * 1024 }));
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
    sessionManager,
    otpService: deps.otpService,
  });
  registerWebBillingRoutes(app, env, deps.db, sessionManager, deps.webBillingService);
  registerUploadRoutes(app, env, deps.db, deps.s3Client);
  registerMediaRoutes(app, env, deps.s3Client);
  registerContentRoutes(app, env, deps.db);
  registerAdminRoutes(app, env, deps.db, deps.s3Client);
  registerEvaluateRoutes(app, env, deps.db, deps.boss, deps.s3Client, deps.isQueueReady);
  registerDiagnosticRoutes(app, env, deps.db, deps.boss, deps.s3Client, deps.isQueueReady);
  registerGraphAndMissionRoutes(app, env, deps.db, deps.s3Client);
  registerShifterRoutes(app, env, deps.db, deps.boss, deps.s3Client, deps.isQueueReady);
  registerDropRoutes(app, env, deps.db, deps.boss, deps.s3Client, deps.isQueueReady);
  registerJobRoutes(app, env, deps.db);
  registerQuotaRoutes(app, env, deps.db, sessionManager);
  registerCatalogRoutes(app, env, deps.db);
  registerBillingWebhookRoutes(app, env, deps.db);
  registerAccountRoutes(app, env, deps.db, deps.s3Client, sessionManager);
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

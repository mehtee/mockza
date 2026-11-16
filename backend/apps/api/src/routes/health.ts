import { HeadBucketCommand, type S3Client } from '@aws-sdk/client-s3';
import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import { HealthResponseSchema, ReadyResponseSchema } from '@mockza/contracts';
import { checkDbHealth } from '@mockza/db';
import type postgres from 'postgres';
import type { RequestVariables } from '../middleware/request-id.js';

export function registerHealthRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: Pick<AppEnv, 'EDITION' | 'S3_BUCKET'>,
  sqlClient?: postgres.Sql,
  s3Client?: S3Client,
  isQueueReady?: () => boolean,
): void {
  const livenessRoute = createRoute({
    method: 'get',
    path: '/v1/health',
    responses: {
      200: {
        description: 'Service liveness and configured regional edition.',
        content: {
          'application/json': {
            schema: HealthResponseSchema,
          },
        },
      },
    },
  });

  app.openapi(livenessRoute, (c) =>
    c.json(
      {
        status: 'ok' as const,
        edition: env.EDITION,
        service: 'mockza-api',
      },
      200,
    ),
  );

  const readinessRoute = createRoute({
    method: 'get',
    path: '/v1/health/ready',
    responses: {
      200: {
        description: 'Service readiness verifying database and storage connectivity.',
        content: {
          'application/json': {
            schema: ReadyResponseSchema,
          },
        },
      },
      503: {
        description: 'Service unavailable due to storage or database connectivity issues.',
        content: {
          'application/json': {
            schema: ReadyResponseSchema,
          },
        },
      },
    },
  });

  app.openapi(readinessRoute, async (c) => {
    let dbHealthy = true;
    let s3Healthy = true;

    if (sqlClient) {
      const dbCheck = await checkDbHealth(sqlClient, 3000);
      dbHealthy = dbCheck.healthy;
    }

    if (s3Client) {
      try {
        await s3Client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
      } catch (_s3Err) {
        s3Healthy = false;
      }
    }

    const queueHealthy = isQueueReady ? isQueueReady() : true;
    const ready = dbHealthy && s3Healthy && queueHealthy;
    const body = {
      status: 'ready' as const,
      edition: env.EDITION,
      database: dbHealthy,
      storage: s3Healthy,
      queue: queueHealthy,
      service: 'mockza-api',
    };

    return c.json(body, ready ? 200 : 503);
  });
}

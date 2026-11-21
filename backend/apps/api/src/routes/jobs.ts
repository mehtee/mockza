import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import { ApiErrorSchema, JobStatusResponseSchema } from '@mockza/contracts';
import { evaluationJobs, type MockzaDb, quotaReservations } from '@mockza/db';
import { eq } from 'drizzle-orm';
import { streamSSE } from 'hono/streaming';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';

type ValidJobStage =
  | 'queued'
  | 'processing_audio'
  | 'transcoding'
  | 'evaluating'
  | 'repairing'
  | 'completed'
  | 'failed';

const VALID_JOB_STAGES: readonly ValidJobStage[] = [
  'queued',
  'processing_audio',
  'transcoding',
  'evaluating',
  'repairing',
  'completed',
  'failed',
];

function normalizeJobStage(status: string): ValidJobStage {
  return VALID_JOB_STAGES.includes(status as ValidJobStage) ? (status as ValidJobStage) : 'queued';
}

type AuthorizedJobResult =
  | { kind: 'ok'; job: typeof evaluationJobs.$inferSelect }
  | { kind: 'not_found' }
  | { kind: 'forbidden' };

async function findAuthorizedJob(
  db: MockzaDb,
  jobId: string,
  deviceId: string,
  accountKey: string,
): Promise<AuthorizedJobResult> {
  const jobRows = await db
    .select()
    .from(evaluationJobs)
    .where(eq(evaluationJobs.jobId, jobId))
    .limit(1);

  const job = jobRows[0];
  if (!job) {
    return { kind: 'not_found' };
  }

  if (job.accountKey !== accountKey && job.deviceId !== deviceId) {
    return { kind: 'forbidden' };
  }

  return { kind: 'ok', job };
}

export function registerJobRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db);
  app.use('/v1/jobs/*', authMiddleware);

  const getJobRoute = createRoute({
    method: 'get',
    path: '/v1/jobs/{jobId}',
    request: {
      params: JobStatusResponseSchema.pick({ jobId: true }),
    },
    responses: {
      200: {
        description: 'Current job status and evaluation result.',
        content: { 'application/json': { schema: JobStatusResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      404: {
        description: 'Job not found.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(getJobRoute, async (c) => {
    const jobId = c.req.param('jobId');
    const deviceId = c.get('deviceId');
    const accountKey = c.get('accountKey') ?? deviceId;

    if (!deviceId || !accountKey) {
      return c.json(
        {
          code: 'unauthorized' as const,
          message: 'Device auth required',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    if (db) {
      const lookup = await findAuthorizedJob(db, jobId, deviceId, accountKey);
      if (lookup.kind === 'not_found') {
        return c.json(
          {
            code: 'not_found' as const,
            message: `Job ${jobId} not found.`,
            requestId: c.get('requestId'),
          },
          404,
        );
      }
      if (lookup.kind === 'forbidden') {
        return c.json(
          {
            code: 'unauthorized' as const,
            message: 'Access denied to this evaluation job.',
            requestId: c.get('requestId'),
          },
          401,
        );
      }

      const job = lookup.job;
      let quotaRefunded = false;
      if (job.status === 'failed') {
        const res = await db
          .select({ status: quotaReservations.status })
          .from(quotaReservations)
          .where(eq(quotaReservations.attemptId, job.attemptId))
          .limit(1);
        quotaRefunded = res[0]?.status === 'refunded';
      }

      const isAdvancedTask =
        job.taskType === 'register_shifter' || job.taskType === 'drop_ingest';

      return c.json(
        {
          jobId: job.jobId,
          attemptId: job.attemptId,
          status: normalizeJobStage(job.status),
          stage: job.stageDetail ?? job.status,
          result: !isAdvancedTask && job.resultJson ? (job.resultJson as never) : undefined,
          advancedResult:
            isAdvancedTask && job.resultJson
              ? (job.resultJson as Record<string, unknown>)
              : undefined,
          errorCode: job.errorCode ?? undefined,
          quotaRefunded,
          createdAt: job.createdAt.toISOString(),
          updatedAt: job.updatedAt.toISOString(),
        },
        200,
      );
    }

    return c.json(
      {
        jobId,
        attemptId: '00000000-0000-0000-0000-000000000000',
        status: 'queued' as const,
        stage: 'queued',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      200,
    );
  });

  // GET /v1/jobs/:jobId/events (Authorized, SSE_ENABLED-gated SSE stream)
  app.get('/v1/jobs/:jobId/events', async (c) => {
    if (!env.SSE_ENABLED) {
      return c.json(
        {
          code: 'not_found',
          message: 'Job event streaming is not enabled on this deployment.',
          requestId: c.get('requestId'),
        },
        404,
      );
    }

    const jobId = c.req.param('jobId');
    const deviceId = c.get('deviceId');
    const accountKey = c.get('accountKey') ?? deviceId;

    if (!deviceId || !accountKey) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Device auth required',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    if (db) {
      const initialLookup = await findAuthorizedJob(db, jobId, deviceId, accountKey);
      if (initialLookup.kind === 'not_found') {
        return c.json(
          {
            code: 'not_found',
            message: `Job ${jobId} not found.`,
            requestId: c.get('requestId'),
          },
          404,
        );
      }
      if (initialLookup.kind === 'forbidden') {
        return c.json(
          {
            code: 'unauthorized',
            message: 'Access denied to this evaluation job.',
            requestId: c.get('requestId'),
          },
          401,
        );
      }
    }

    return streamSSE(c, async (stream) => {
      let aborted = false;
      stream.onAbort(() => {
        aborted = true;
      });

      let iterations = 0;
      const maxIterations = 90;

      while (!aborted && iterations < maxIterations) {
        iterations += 1;
        if (db) {
          const lookup = await findAuthorizedJob(db, jobId, deviceId, accountKey);
          if (lookup.kind !== 'ok') {
            break;
          }
          const job = lookup.job;
          await stream.writeSSE({
            data: JSON.stringify({
              jobId: job.jobId,
              status: job.status,
              stage: job.stageDetail ?? job.status,
              result: job.resultJson,
            }),
            event: 'job-status',
            id: String(iterations),
          });

          if (job.status === 'completed' || job.status === 'failed') {
            break;
          }
        } else {
          await stream.writeSSE({
            data: JSON.stringify({ jobId, status: 'queued' }),
            event: 'job-status',
            id: String(iterations),
          });
          break;
        }

        await stream.sleep(1000);
      }
    });
  });
}

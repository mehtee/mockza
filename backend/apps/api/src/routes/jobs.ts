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

    if (!deviceId) {
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
      const jobRows = await db
        .select()
        .from(evaluationJobs)
        .where(eq(evaluationJobs.jobId, jobId))
        .limit(1);

      const job = jobRows[0];
      if (!job) {
        return c.json(
          {
            code: 'not_found' as const,
            message: `Job ${jobId} not found.`,
            requestId: c.get('requestId'),
          },
          404,
        );
      }

      // Verify ownership
      if (job.accountKey !== accountKey && job.deviceId !== deviceId) {
        return c.json(
          {
            code: 'unauthorized' as const,
            message: 'Access denied to this evaluation job.',
            requestId: c.get('requestId'),
          },
          401,
        );
      }

      // Check if refunded
      let quotaRefunded = false;
      if (job.status === 'failed') {
        const res = await db
          .select({ status: quotaReservations.status })
          .from(quotaReservations)
          .where(eq(quotaReservations.attemptId, job.attemptId))
          .limit(1);
        quotaRefunded = res[0]?.status === 'refunded';
      }

      const validStatus: ValidJobStage = (
        [
          'queued',
          'processing_audio',
          'transcoding',
          'evaluating',
          'repairing',
          'completed',
          'failed',
        ].includes(job.status)
          ? job.status
          : 'queued'
      ) as ValidJobStage;

      return c.json(
        {
          jobId: job.jobId,
          attemptId: job.attemptId,
          status: validStatus,
          stage: job.stageDetail ?? job.status,
          result: job.resultJson ? (job.resultJson as any) : undefined,
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

  // GET /v1/jobs/:jobId/events (SSE stream B4.4)
  app.get('/v1/jobs/:jobId/events', async (c) => {
    const jobId = c.req.param('jobId');

    return streamSSE(c, async (stream) => {
      let completed = false;
      let iterations = 0;

      while (!completed && iterations < 30) {
        iterations += 1;
        if (db) {
          const jobRows = await db
            .select()
            .from(evaluationJobs)
            .where(eq(evaluationJobs.jobId, jobId))
            .limit(1);

          const job = jobRows[0];
          if (job) {
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
              completed = true;
              break;
            }
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

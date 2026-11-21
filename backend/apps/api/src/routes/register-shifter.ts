import { createHash, randomUUID } from 'node:crypto';
import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import {
  bufferAudioStream,
  prepareAudioForModel,
  verifyRepeatAloud,
} from '@mockza/ai';
import type { AppEnv } from '@mockza/config';
import {
  ApiErrorSchema,
  JobEnqueueResponseSchema,
  RegisterShifterRequestSchema,
  VerifyRepeatAloudRequestSchema,
  VerifyRepeatAloudResponseSchema,
} from '@mockza/contracts';
import {
  evaluationJobs,
  jobDispatchOutbox,
  type MockzaDb,
  reserveAdvancedQuotaAtomic,
  upsertLinguisticGraphSignals,
} from '@mockza/db';
import { DomainError, SHIFTER_MAX_AUDIO_SECONDS, SHIFTER_MIN_AUDIO_SECONDS } from '@mockza/domain';
import { createAudioS3Client } from '@mockza/storage';
import { eq } from 'drizzle-orm';
import type PgBoss from 'pg-boss';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';

export const REGISTER_SHIFTER_QUEUE = 'advanced.register-shifter';

function sha256Canonical(data: unknown): string {
  return createHash('sha256').update(JSON.stringify(data), 'utf-8').digest('hex');
}

export function registerShifterRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
  boss?: PgBoss,
  s3Client?: S3Client,
  isQueueReady?: () => boolean,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db);
  app.use('/v1/register-shifter/*', authMiddleware);
  const internalS3 = s3Client ?? createAudioS3Client(env);

  app.use('/v1/register-shifter/*', async (c, next) => {
    if (!env.ENABLE_REGISTER_SHIFTER) {
      return c.json(
        {
          code: 'feature_disabled',
          message: 'Register Shifter feature is disabled.',
          requestId: c.get('requestId'),
        },
        404,
      );
    }
    return next();
  });

  const shiftRoute = createRoute({
    method: 'post',
    path: '/v1/register-shifter/shift',
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: RegisterShifterRequestSchema } },
      },
    },
    responses: {
      202: {
        description: 'Register Shifter job queued in pg-boss.',
        content: { 'application/json': { schema: JobEnqueueResponseSchema } },
      },
      400: {
        description: 'Invalid clip duration or objectKey.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      402: {
        description: 'Pro entitlement required.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      429: {
        description: 'Quota exceeded.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      503: {
        description: 'Queue unavailable.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(shiftRoute, async (c) => {
    const body = c.req.valid('json');
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;

    const isTextMode = Boolean(body.rawText && !body.objectKey);
    if (!isTextMode) {
      const dur = body.durationSeconds ?? 0;
      if (dur < SHIFTER_MIN_AUDIO_SECONDS || dur > SHIFTER_MAX_AUDIO_SECONDS) {
        return c.json(
          {
            code: 'validation_error' as const,
            message: `Speaking clip must be ${SHIFTER_MIN_AUDIO_SECONDS}..${SHIFTER_MAX_AUDIO_SECONDS} seconds.`,
            requestId: c.get('requestId'),
          },
          400,
        );
      }

      if (!body.objectKey || !body.objectKey.startsWith(`users/${deviceId}/`)) {
        return c.json(
          {
            code: 'validation_error' as const,
            message: 'Audio objectKey does not belong to authenticated device.',
            requestId: c.get('requestId'),
          },
          400,
        );
      }
    }

    if (isQueueReady && !isQueueReady()) {
      return c.json(
        {
          code: 'model_unavailable' as const,
          message: 'Queue producer temporarily unavailable.',
          requestId: c.get('requestId'),
        },
        503,
      );
    }

    const jobId = randomUUID();
    const attemptId = randomUUID();
    const executionGeneration = 1;
    const dispatchKey = `${attemptId}:gen:${executionGeneration}`;
    const jobPayload = {
      jobId,
      attemptId,
      accountKey,
      deviceId,
      edition: env.EDITION,
      ...(body.objectKey ? { objectKey: body.objectKey } : {}),
      ...(body.rawText ? { rawText: body.rawText } : {}),
      examTrack: body.examTrack,
      topicHint: body.topicHint,
      durationSeconds: body.durationSeconds ?? 15,
      executionGeneration,
    };

    if (db) {
      try {
        await db.transaction(async (tx) => {
          await reserveAdvancedQuotaAtomic({
            db: tx,
            accountKey,
            deviceId,
            attemptId,
            skill: 'register_shifter',
            edition: env.EDITION,
          });

          await tx.insert(evaluationJobs).values({
            jobId,
            attemptId,
            accountKey,
            deviceId,
            packId: 'register_shifter_v1',
            examId: body.examTrack,
            taskType: 'register_shifter',
            skill: 'speaking',
            status: 'queued',
            stageDetail: 'Queued for 3-Gear Register Shift',
            inputHash: sha256Canonical(body),
            inputJson: jobPayload,
            executionGeneration,
          });

          await tx.insert(jobDispatchOutbox).values({
            jobId,
            queueName: REGISTER_SHIFTER_QUEUE,
            dispatchKey,
            payloadJson: jobPayload,
            status: 'pending',
          });
        });
      } catch (err) {
        if (err instanceof DomainError) {
          return c.json(
            { code: err.code, message: err.message, requestId: c.get('requestId') },
            err.status as 401 | 402 | 429,
          );
        }
        throw err;
      }

      if (boss) {
        try {
          await boss.send(REGISTER_SHIFTER_QUEUE, jobPayload, {
            singletonKey: dispatchKey,
            retryLimit: 2,
            retryBackoff: true,
          });
          await db
            .update(jobDispatchOutbox)
            .set({ status: 'dispatched', updatedAt: new Date() })
            .where(eq(jobDispatchOutbox.jobId, jobId));
        } catch {
          // Outbox sweeper will pick up pending dispatch safely
        }
      }
    }

    return c.json({ jobId, status: 'queued' as const }, 202);
  });

  const verifyRepeatRoute = createRoute({
    method: 'post',
    path: '/v1/register-shifter/{runId}/verify-repeat',
    request: {
      params: z.object({ runId: z.string().uuid() }),
      body: {
        required: true,
        content: { 'application/json': { schema: VerifyRepeatAloudRequestSchema } },
      },
    },
    responses: {
      200: {
        description: 'Verification outcome from Gemini Decision System 1.',
        content: { 'application/json': { schema: VerifyRepeatAloudResponseSchema } },
      },
      400: {
        description: 'Invalid request or unowned objectKey.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      403: {
        description: 'Forbidden run ownership.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      404: {
        description: 'Register Shifter run not found.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(verifyRepeatRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const { runId } = c.req.param();
    const body = c.req.valid('json');

    if (!body.objectKey.startsWith(`users/${deviceId}/`)) {
      return c.json(
        {
          code: 'validation_error' as const,
          message: 'Repeat-aloud audio objectKey does not belong to authenticated device.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    let expectedSentence = body.expectedSentence;
    let targetPhrases = body.targetPhrases;

    if (db) {
      const [job] = await db
        .select()
        .from(evaluationJobs)
        .where(eq(evaluationJobs.jobId, runId))
        .limit(1);

      if (!job || job.taskType !== 'register_shifter') {
        return c.json(
          {
            code: 'not_found' as const,
            message: 'Register Shifter run not found.',
            requestId: c.get('requestId'),
          },
          404,
        );
      }
      if (job.accountKey !== accountKey && job.deviceId !== deviceId) {
        return c.json(
          {
            code: 'unauthorized' as const,
            message: 'Run belongs to another account.',
            requestId: c.get('requestId'),
          },
          403,
        );
      }
      const storedResult = job.resultJson as
        | { repeatAloudTarget?: { targetSentence?: string; targetPhrases?: string[] } }
        | null;
      if (storedResult?.repeatAloudTarget?.targetSentence) {
        expectedSentence = storedResult.repeatAloudTarget.targetSentence;
      }
      if (storedResult?.repeatAloudTarget?.targetPhrases?.length) {
        targetPhrases = storedResult.repeatAloudTarget.targetPhrases;
      }
    }

    let preparedAudio: { base64Data: string; format: 'm4a' | 'mp3' | 'wav' } | undefined;
    try {
      const obj = await internalS3.send(
        new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: body.objectKey }),
      );
      if (obj.Body) {
        const buf = await bufferAudioStream(obj.Body as NodeJS.ReadableStream);
        preparedAudio = await prepareAudioForModel(buf, body.objectKey, {
          maxDurationSeconds: 20,
        });
      }
    } catch {
      if (!env.ALLOW_DEMO_EVALUATOR && env.OPENROUTER_API_KEY) {
        throw new DomainError('upload_not_found', 'Could not read repeat-aloud audio object.', 400);
      }
    }

    const result = await verifyRepeatAloud(
      {
        runId,
        gearLevel: body.gearLevel,
        expectedSentence,
        targetPhrases,
        base64AudioData: preparedAudio?.base64Data,
        audioFormat: preparedAudio?.format,
        spokenTextFallback: preparedAudio ? undefined : expectedSentence,
      },
      {
        allowDemoEvaluator: env.ALLOW_DEMO_EVALUATOR || !env.OPENROUTER_API_KEY,
      },
    );

    if (db && result.matchedTargets.length > 0) {
      try {
        await upsertLinguisticGraphSignals({
          db,
          accountKey,
          edition: env.EDITION,
          sourceKind: 'register_shifter',
          sourceRefId: runId,
          signals: result.matchedTargets.map((phrase) => ({
            nodeKind: 'target_structure',
            canonicalKey: `lexis:target_${phrase.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 48)}`,
            displayLabelEn: phrase,
            displayLabelFa: phrase,
            coachNoteEn: `Mastered spoken register shift "${phrase}" aloud.`,
            coachNoteFa: `تکرار شفاهی ساختار ارتقایافته «${phrase}» با موفقیت ثبت شد.`,
            observedPolarity: 'target_used',
            excerptText: body.expectedSentence.slice(0, 220),
          })),
        });
      } catch {
        // Non-blocking
      }
    }

    return c.json(VerifyRepeatAloudResponseSchema.parse(result), 200);
  });
}

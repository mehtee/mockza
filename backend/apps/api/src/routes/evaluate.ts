import { randomUUID } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import { explainQuestionGraph } from '@mockza/ai';
import type { AppEnv } from '@mockza/config';
import {
  ApiErrorSchema,
  EvaluateSpeakingRequestSchema,
  EvaluateWritingRequestSchema,
  ExplainQuestionRequestSchema,
  ExplainQuestionResponseSchema,
  JobEnqueueResponseSchema,
} from '@mockza/contracts';
import {
  aiQuestionExplanations,
  entitlements,
  evaluationJobs,
  examQuestions,
  examSections,
  type MockzaDb,
} from '@mockza/db';
import { DomainError } from '@mockza/domain';
import { createAudioS3Client, verifyUploadedAudioObject } from '@mockza/storage';
import { and, eq } from 'drizzle-orm';
import type PgBoss from 'pg-boss';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';
import { refundQuotaAtomic, reserveQuotaAtomic } from '../services/quota.js';

export const WRITING_QUEUE = 'evaluation.writing';
export const SPEAKING_QUEUE = 'evaluation.speaking';
export const EXPLAIN_QUEUE = 'explain.question';

type ValidJobStatus = 'queued' | 'processing_audio' | 'evaluating' | 'completed' | 'failed';

export function registerEvaluateRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
  boss?: PgBoss,
  s3Client?: S3Client,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db);
  app.use('/v1/evaluate/*', authMiddleware);
  const internalS3 = s3Client ?? createAudioS3Client(env);

  // POST /v1/evaluate/writing (202 Accepted)
  const writingRoute = createRoute({
    method: 'post',
    path: '/v1/evaluate/writing',
    request: {
      body: {
        content: { 'application/json': { schema: EvaluateWritingRequestSchema } },
      },
    },
    responses: {
      202: {
        description: 'Writing evaluation queued in pg-boss.',
        content: { 'application/json': { schema: JobEnqueueResponseSchema } },
      },
      400: {
        description: 'Validation error.',
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
    },
  });

  app.openapi(writingRoute, async (c) => {
    const payload = c.req.valid('json');
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;

    if (db) {
      // 1. Idempotency check: if attemptId already evaluated or queued, return existing job
      const existing = await db
        .select({ jobId: evaluationJobs.jobId, status: evaluationJobs.status })
        .from(evaluationJobs)
        .where(eq(evaluationJobs.attemptId, payload.attemptId))
        .limit(1);

      if (existing[0]) {
        const validStatus: ValidJobStatus = (
          ['queued', 'processing_audio', 'evaluating', 'completed', 'failed'].includes(
            existing[0].status,
          )
            ? existing[0].status
            : 'queued'
        ) as ValidJobStatus;
        return c.json(
          {
            jobId: existing[0].jobId,
            status: validStatus,
          },
          202,
        );
      }

      // 2. Atomic Quota Reservation
      try {
        await reserveQuotaAtomic({
          db,
          accountKey,
          deviceId,
          attemptId: payload.attemptId,
          skill: 'writing',
        });
      } catch (err) {
        if (err instanceof DomainError) {
          return c.json(
            { code: err.code as any, message: err.message, requestId: c.get('requestId') },
            err.status as 400 | 401 | 402 | 429,
          );
        }
        throw err;
      }

      const jobId = randomUUID();

      // 3. Insert job in database
      await db.insert(evaluationJobs).values({
        jobId,
        attemptId: payload.attemptId,
        accountKey,
        deviceId,
        packId: payload.packId,
        examId: payload.examId,
        taskType: payload.taskType,
        skill: 'writing',
        status: 'queued',
        stageDetail: 'Queued for AI evaluation',
        inputJson: payload,
      });

      // 4. Enqueue in pg-boss
      if (boss) {
        try {
          await boss.send(
            WRITING_QUEUE,
            { jobId, ...payload },
            {
              singletonKey: payload.attemptId,
              retryLimit: 3,
              retryBackoff: true,
            },
          );
        } catch (enqueueError) {
          await refundQuotaAtomic({ db, attemptId: payload.attemptId });
          await db
            .update(evaluationJobs)
            .set({ status: 'failed', errorCode: 'internal_error' })
            .where(eq(evaluationJobs.jobId, jobId));
          throw enqueueError;
        }
      }

      return c.json({ jobId, status: 'queued' as const }, 202);
    }

    return c.json({ jobId: randomUUID(), status: 'queued' as const }, 202);
  });

  // POST /v1/evaluate/speaking (202 Accepted)
  const speakingRoute = createRoute({
    method: 'post',
    path: '/v1/evaluate/speaking',
    request: {
      body: {
        content: { 'application/json': { schema: EvaluateSpeakingRequestSchema } },
      },
    },
    responses: {
      202: {
        description: 'Speaking evaluation queued in pg-boss.',
        content: { 'application/json': { schema: JobEnqueueResponseSchema } },
      },
      400: {
        description: 'Audio validation or size error.',
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
      404: {
        description: 'Audio object not found in S3.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      429: {
        description: 'Quota exceeded.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(speakingRoute, async (c) => {
    const payload = c.req.valid('json');
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;

    if (db) {
      // 1. Idempotency check
      const existing = await db
        .select({ jobId: evaluationJobs.jobId, status: evaluationJobs.status })
        .from(evaluationJobs)
        .where(eq(evaluationJobs.attemptId, payload.attemptId))
        .limit(1);

      if (existing[0]) {
        const validStatus: ValidJobStatus = (
          ['queued', 'processing_audio', 'evaluating', 'completed', 'failed'].includes(
            existing[0].status,
          )
            ? existing[0].status
            : 'queued'
        ) as ValidJobStatus;
        return c.json(
          {
            jobId: existing[0].jobId,
            status: validStatus,
          },
          202,
        );
      }

      // 2. HeadObject verification on each audio clip
      const keysToVerify = payload.turns.map((t) => t.objectKey);
      for (const objectKey of keysToVerify) {
        try {
          await verifyUploadedAudioObject({
            client: internalS3,
            bucket: env.S3_BUCKET,
            objectKey,
            expectedDeviceId: deviceId,
            maxBytes: env.MAX_AUDIO_MB * 1024 * 1024,
          });
        } catch (err) {
          if (err instanceof DomainError) {
            return c.json(
              { code: err.code as any, message: err.message, requestId: c.get('requestId') },
              err.status as 400 | 401 | 404,
            );
          }
        }
      }

      // 3. Atomic Quota Reservation
      try {
        await reserveQuotaAtomic({
          db,
          accountKey,
          deviceId,
          attemptId: payload.attemptId,
          skill: 'speaking',
        });
      } catch (err) {
        if (err instanceof DomainError) {
          return c.json(
            { code: err.code as any, message: err.message, requestId: c.get('requestId') },
            err.status as 400 | 401 | 402 | 429,
          );
        }
        throw err;
      }

      const jobId = randomUUID();

      // 4. Insert job in database
      await db.insert(evaluationJobs).values({
        jobId,
        attemptId: payload.attemptId,
        accountKey,
        deviceId,
        packId: payload.packId,
        examId: payload.examId,
        skill: 'speaking',
        status: 'queued',
        stageDetail: 'Queued for audio evaluation',
        inputJson: payload,
      });

      // 5. Enqueue in pg-boss
      if (boss) {
        try {
          await boss.send(
            SPEAKING_QUEUE,
            { jobId, ...payload },
            {
              singletonKey: payload.attemptId,
              retryLimit: 3,
              retryBackoff: true,
            },
          );
        } catch (enqueueError) {
          await refundQuotaAtomic({ db, attemptId: payload.attemptId });
          await db
            .update(evaluationJobs)
            .set({ status: 'failed', errorCode: 'internal_error' })
            .where(eq(evaluationJobs.jobId, jobId));
          throw enqueueError;
        }
      }

      return c.json({ jobId, status: 'queued' as const }, 202);
    }

    return c.json({ jobId: randomUUID(), status: 'queued' as const }, 202);
  });

  // POST /v1/evaluate/explain-question (Pro cached explainer B4.4)
  const explainRoute = createRoute({
    method: 'post',
    path: '/v1/evaluate/explain-question',
    request: {
      body: {
        content: { 'application/json': { schema: ExplainQuestionRequestSchema } },
      },
    },
    responses: {
      200: {
        description: 'Explanation returned (cached or freshly generated).',
        content: { 'application/json': { schema: ExplainQuestionResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      402: {
        description: 'Pro entitlement required for AI question explanations.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(explainRoute, async (c) => {
    const payload = c.req.valid('json');
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }

    if (db) {
      const entRows = await db
        .select({ isPro: entitlements.isPro, expiresAt: entitlements.expiresAt })
        .from(entitlements)
        .where(eq(entitlements.deviceId, deviceId))
        .limit(1);

      const isPro = Boolean(
        entRows[0]?.isPro && (!entRows[0].expiresAt || entRows[0].expiresAt > new Date()),
      );
      if (!isPro) {
        return c.json(
          {
            code: 'entitlement_required' as const,
            message:
              'AI Question Explanations are a Pro feature. Please subscribe to Pro to ask AI why.',
            requestId: c.get('requestId'),
          },
          402,
        );
      }

      const cached = await db
        .select({ explanationJson: aiQuestionExplanations.explanationJson })
        .from(aiQuestionExplanations)
        .where(
          and(
            eq(aiQuestionExplanations.questionId, payload.questionId),
            eq(aiQuestionExplanations.packVersion, payload.packVersion),
          ),
        )
        .limit(1);

      if (cached[0]?.explanationJson) {
        const cachedData = cached[0].explanationJson as Record<string, unknown>;
        return c.json(
          {
            cached: true,
            explanation: String(cachedData['explanation'] ?? 'Cached explanation'),
            evidenceQuote: cachedData['evidenceQuote']
              ? String(cachedData['evidenceQuote'])
              : undefined,
            whyWrongOptions:
              (cachedData['whyWrongOptions'] as { option: string; reason: string }[]) ?? [],
          },
          200,
        );
      }

      let correctAnswer = '';
      let questionPrompt = '';
      let passageExcerpt = '';

      const [qRow] = await db
        .select()
        .from(examQuestions)
        .where(
          and(
            eq(examQuestions.questionId, payload.questionId),
            eq(examQuestions.packId, payload.packId),
          ),
        )
        .limit(1);

      if (qRow) {
        correctAnswer = qRow.acceptedAnswersJson[0] ?? '';
        questionPrompt = qRow.prompt;
        const quote = qRow.evidenceJson?.['exactQuote'];
        if (typeof quote === 'string' && quote.length > 0) {
          passageExcerpt = quote;
        }
        const [secRow] = await db
          .select()
          .from(examSections)
          .where(eq(examSections.sectionId, qRow.sectionId))
          .limit(1);
        if (secRow?.contentText && passageExcerpt.length === 0) {
          passageExcerpt = secRow.contentText.slice(0, 1500);
        }
      }

      const generatedExplanation = await explainQuestionGraph.invoke({
        ...payload,
        correctAnswer: correctAnswer || undefined,
        questionPrompt: questionPrompt || undefined,
        passageExcerpt: passageExcerpt || undefined,
      });

      const responsePayload = {
        cached: false,
        explanation: generatedExplanation.explanation,
        evidenceQuote: generatedExplanation.evidenceQuote,
        whyWrongOptions: generatedExplanation.whyWrongOptions,
      };

      await db
        .insert(aiQuestionExplanations)
        .values({
          questionId: payload.questionId,
          packVersion: payload.packVersion,
          skill: payload.skill,
          explanationJson: responsePayload,
        })
        .onConflictDoNothing();

      return c.json(responsePayload, 200);
    }

    const fallbackExplained = await explainQuestionGraph.invoke(payload);
    return c.json(
      {
        cached: false,
        explanation: fallbackExplained.explanation,
        evidenceQuote: fallbackExplained.evidenceQuote,
        whyWrongOptions: fallbackExplained.whyWrongOptions,
      },
      200,
    );
  });
}

import { createHash, randomUUID } from 'node:crypto';
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
  RetryEvaluationRequestSchema,
} from '@mockza/contracts';
import {
  aiQuestionExplanations,
  audioAssets,
  catalogPacks,
  entitlements,
  evaluationJobs,
  examQuestions,
  examSections,
  jobDispatchOutbox,
  type MockzaDb,
} from '@mockza/db';
import { DomainError } from '@mockza/domain';
import { createAudioS3Client, verifyUploadedAudioObject } from '@mockza/storage';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import type PgBoss from 'pg-boss';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';
import { reserveQuotaAtomic } from '../services/quota.js';

export const WRITING_QUEUE = 'evaluation.writing';
export const SPEAKING_QUEUE = 'evaluation.speaking';
export const EXPLAIN_QUEUE = 'explain.question';

type ValidJobStatus = 'queued' | 'processing_audio' | 'evaluating' | 'completed' | 'failed';

const VALID_JOB_STATUSES = new Set<string>([
  'queued',
  'processing_audio',
  'evaluating',
  'completed',
  'failed',
]);

function normalizeJobStatus(status: string): ValidJobStatus {
  return VALID_JOB_STATUSES.has(status) ? (status as ValidJobStatus) : 'queued';
}

function sha256Canonical(data: unknown): string {
  return createHash('sha256').update(JSON.stringify(data), 'utf-8').digest('hex');
}

function isPgUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code =
    (err as { code?: string; cause?: { code?: string } }).code ??
    (err as { cause?: { code?: string } }).cause?.code;
  return code === '23505';
}

export function registerEvaluateRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
  boss?: PgBoss,
  s3Client?: S3Client,
  isQueueReady?: () => boolean,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db);
  app.use('/v1/evaluate/*', authMiddleware);
  const internalS3 = s3Client ?? createAudioS3Client(env);
  const memoryJobs = new Map<
    string,
    {
      jobId: string;
      accountKey: string;
      deviceId: string;
      inputHash: string;
      status: ValidJobStatus;
    }
  >();

  async function dispatchNowAndMark(params: {
    database: MockzaDb;
    jobId: string;
    queueName: string;
    payload: Record<string, unknown>;
    singletonKey: string;
  }): Promise<void> {
    if (!boss) return;
    try {
      await boss.send(params.queueName, params.payload, {
        singletonKey: params.singletonKey,
        retryLimit: 3,
        retryBackoff: true,
      });
      await params.database
        .update(jobDispatchOutbox)
        .set({ status: 'dispatched', updatedAt: new Date() })
        .where(
          and(
            eq(jobDispatchOutbox.jobId, params.jobId),
            eq(jobDispatchOutbox.dispatchKey, params.singletonKey),
            eq(jobDispatchOutbox.status, 'pending'),
          ),
        );
    } catch (enqueueErr) {
      // Leave `status = 'pending'` in `job_dispatch_outbox` so sweeper recovers without stranding credit.
      await params.database
        .update(jobDispatchOutbox)
        .set({
          attempts: sql`${jobDispatchOutbox.attempts} + 1`,
          lastError: (enqueueErr as Error).message.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(jobDispatchOutbox.jobId, params.jobId),
            eq(jobDispatchOutbox.dispatchKey, params.singletonKey),
            eq(jobDispatchOutbox.status, 'pending'),
          ),
        );
    }
  }

  function resolveIdempotentMatch(params: {
    existing: {
      jobId: string;
      status: string;
      accountKey: string;
      deviceId: string;
      inputHash: string | null;
    };
    accountKey: string;
    deviceId: string;
    inputHash: string;
  }):
    | { kind: 'ok'; jobId: string; status: ValidJobStatus }
    | { kind: 'forbidden' }
    | { kind: 'conflict' } {
    if (
      params.existing.accountKey !== params.accountKey &&
      params.existing.deviceId !== params.deviceId
    ) {
      return { kind: 'forbidden' };
    }
    if (params.existing.inputHash && params.existing.inputHash !== params.inputHash) {
      return { kind: 'conflict' };
    }
    return {
      kind: 'ok',
      jobId: params.existing.jobId,
      status: normalizeJobStatus(params.existing.status),
    };
  }

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
      403: {
        description: 'Forbidden attempt access.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      404: {
        description: 'Exam pack not found or unpublished.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      409: {
        description: 'Attempt ID conflict with different input.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      429: {
        description: 'Quota exceeded.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      503: {
        description: 'Evaluation queue unavailable.',
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

    if (isQueueReady && !isQueueReady()) {
      return c.json(
        {
          code: 'model_unavailable' as const,
          message: 'Evaluation queue producer is temporarily unavailable. Please retry shortly.',
          requestId: c.get('requestId'),
        },
        503,
      );
    }

    let effectivePayload = {
      ...payload,
      edition: payload.edition ?? env.EDITION,
    };
    if (db) {
      const edition = env.EDITION === 'irn' ? 'irn' : 'glb';
      const [packRow] = await db
        .select({
          packId: catalogPacks.packId,
          edition: catalogPacks.edition,
          isPublished: catalogPacks.isPublished,
        })
        .from(catalogPacks)
        .where(eq(catalogPacks.packId, payload.packId))
        .limit(1);

      if (packRow) {
        if (!packRow.isPublished || (packRow.edition !== 'all' && packRow.edition !== edition)) {
          return c.json(
            {
              code: 'not_found' as const,
              message: `Exam pack ${payload.packId} is not published for this edition.`,
              requestId: c.get('requestId'),
            },
            404,
          );
        }

        const sections = await db
          .select({
            sectionIndex: examSections.sectionIndex,
            sectionType: examSections.sectionType,
            title: examSections.title,
            contentText: examSections.contentText,
          })
          .from(examSections)
          .where(eq(examSections.packId, payload.packId))
          .orderBy(asc(examSections.sectionIndex));

        const taskSectionFallback: Record<string, { index: number; sectionType: string }> = {
          task1Academic: { index: 1, sectionType: 'task1' },
          task1General: { index: 1, sectionType: 'task1' },
          task2Essay: { index: 2, sectionType: 'task2' },
          toeflSentenceBuild: { index: 1, sectionType: 'toeflSentenceBuild' },
          toeflEmail: { index: 2, sectionType: 'toeflEmail' },
          toeflAcademicDiscussion: { index: 3, sectionType: 'toeflAcademicDiscussion' },
          pteSummarizeWrittenText: { index: 1, sectionType: 'pteSummarizeWrittenText' },
          pteEssay: { index: 2, sectionType: 'pteEssay' },
          detWriteAboutPhoto: { index: 1, sectionType: 'detWriteAboutPhoto' },
          detInteractiveWriting: { index: 2, sectionType: 'detInteractiveWriting' },
          detWritingSample: { index: 3, sectionType: 'detWritingSample' },
        };
        const fallback = taskSectionFallback[payload.taskType] ?? {
          index: 1,
          sectionType: payload.taskType,
        };
        const matchedSection =
          sections.find(
            (s) => s.sectionType === payload.taskType || s.sectionType === fallback.sectionType,
          ) ??
          sections.find((s) => s.sectionIndex === fallback.index) ??
          sections[0];

        if (matchedSection && matchedSection.contentText.trim().length > 0) {
          effectivePayload = {
            ...effectivePayload,
            promptTitle: matchedSection.title || payload.promptTitle,
            promptBody: matchedSection.contentText,
          };
        }
      }
    }

    const inputHash = sha256Canonical({
      skill: 'writing',
      packId: effectivePayload.packId,
      examId: effectivePayload.examId,
      taskType: effectivePayload.taskType,
      promptTitle: effectivePayload.promptTitle,
      promptBody: effectivePayload.promptBody,
      essayText: effectivePayload.essayText,
    });

    if (db) {
      const existingRows = await db
        .select({
          jobId: evaluationJobs.jobId,
          status: evaluationJobs.status,
          accountKey: evaluationJobs.accountKey,
          deviceId: evaluationJobs.deviceId,
          inputHash: evaluationJobs.inputHash,
        })
        .from(evaluationJobs)
        .where(eq(evaluationJobs.attemptId, payload.attemptId))
        .limit(1);

      if (existingRows[0]) {
        const match = resolveIdempotentMatch({
          existing: existingRows[0],
          accountKey,
          deviceId,
          inputHash,
        });
        if (match.kind === 'forbidden') {
          return c.json(
            {
              code: 'unauthorized' as const,
              message: 'Attempt ID belongs to a different account.',
              requestId: c.get('requestId'),
            },
            403,
          );
        }
        if (match.kind === 'conflict') {
          return c.json(
            {
              code: 'attempt_conflict' as const,
              message: 'Attempt ID cannot be reused with modified writing input.',
              requestId: c.get('requestId'),
            },
            409,
          );
        }
        return c.json({ jobId: match.jobId, status: match.status }, 202);
      }

      const jobId = randomUUID();
      const executionGeneration = 1;
      const dispatchKey = `${effectivePayload.attemptId}:gen:${executionGeneration}`;
      const jobPayload = { jobId, executionGeneration, ...effectivePayload };

      try {
        await db.transaction(async (tx) => {
          await reserveQuotaAtomic({
            db: tx,
            accountKey,
            deviceId,
            attemptId: effectivePayload.attemptId,
            skill: 'writing',
          });

          await tx.insert(evaluationJobs).values({
            jobId,
            attemptId: effectivePayload.attemptId,
            accountKey,
            deviceId,
            packId: effectivePayload.packId,
            examId: effectivePayload.examId,
            taskType: effectivePayload.taskType,
            skill: 'writing',
            status: 'queued',
            stageDetail: 'Queued for AI evaluation',
            inputHash,
            inputJson: effectivePayload,
            executionGeneration,
          });

          await tx.insert(jobDispatchOutbox).values({
            jobId,
            queueName: WRITING_QUEUE,
            dispatchKey,
            payloadJson: jobPayload,
            status: 'pending',
          });
        });
      } catch (err) {
        if (err instanceof DomainError) {
          return c.json(
            { code: err.code, message: err.message, requestId: c.get('requestId') },
            err.status as 401 | 402 | 409 | 429,
          );
        }
        if (isPgUniqueViolation(err)) {
          const raceRows = await db
            .select({
              jobId: evaluationJobs.jobId,
              status: evaluationJobs.status,
              accountKey: evaluationJobs.accountKey,
              deviceId: evaluationJobs.deviceId,
              inputHash: evaluationJobs.inputHash,
            })
            .from(evaluationJobs)
            .where(eq(evaluationJobs.attemptId, payload.attemptId))
            .limit(1);
          if (raceRows[0]) {
            const match = resolveIdempotentMatch({
              existing: raceRows[0],
              accountKey,
              deviceId,
              inputHash,
            });
            if (match.kind === 'forbidden') {
              return c.json(
                {
                  code: 'unauthorized' as const,
                  message: 'Attempt ID belongs to a different account.',
                  requestId: c.get('requestId'),
                },
                403,
              );
            }
            if (match.kind === 'conflict') {
              return c.json(
                {
                  code: 'attempt_conflict' as const,
                  message: 'Attempt ID cannot be reused with modified writing input.',
                  requestId: c.get('requestId'),
                },
                409,
              );
            }
            return c.json({ jobId: match.jobId, status: match.status }, 202);
          }
        }
        throw err;
      }

      await dispatchNowAndMark({
        database: db,
        jobId,
        queueName: WRITING_QUEUE,
        payload: jobPayload,
        singletonKey: dispatchKey,
      });

      return c.json({ jobId, status: 'queued' as const }, 202);
    }

    const memExisting = memoryJobs.get(payload.attemptId);
    if (memExisting) {
      const match = resolveIdempotentMatch({
        existing: memExisting,
        accountKey,
        deviceId,
        inputHash,
      });
      if (match.kind === 'forbidden') {
        return c.json(
          {
            code: 'unauthorized' as const,
            message: 'Attempt ID belongs to a different account.',
            requestId: c.get('requestId'),
          },
          403,
        );
      }
      if (match.kind === 'conflict') {
        return c.json(
          {
            code: 'attempt_conflict' as const,
            message: 'Attempt ID cannot be reused with modified writing input.',
            requestId: c.get('requestId'),
          },
          409,
        );
      }
      return c.json({ jobId: match.jobId, status: match.status }, 202);
    }

    const memJobId = randomUUID();
    memoryJobs.set(payload.attemptId, {
      jobId: memJobId,
      accountKey,
      deviceId,
      inputHash,
      status: 'queued',
    });
    return c.json({ jobId: memJobId, status: 'queued' as const }, 202);
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
      403: {
        description: 'Forbidden attempt access.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      404: {
        description: 'Audio object not found in S3.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      409: {
        description: 'Attempt ID conflict with different input.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      429: {
        description: 'Quota exceeded.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      503: {
        description: 'Evaluation queue unavailable.',
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

    if (isQueueReady && !isQueueReady()) {
      return c.json(
        {
          code: 'model_unavailable' as const,
          message: 'Evaluation queue producer is temporarily unavailable. Please retry shortly.',
          requestId: c.get('requestId'),
        },
        503,
      );
    }

    const inputHash = sha256Canonical({
      skill: 'speaking',
      packId: payload.packId,
      examId: payload.examId,
      partSequence: payload.partSequence,
      turns: payload.turns.map((t) => ({
        partIndex: t.partIndex,
        promptText: t.promptText,
        objectKey: t.objectKey,
      })),
    });

    if (db) {
      const existingRows = await db
        .select({
          jobId: evaluationJobs.jobId,
          status: evaluationJobs.status,
          accountKey: evaluationJobs.accountKey,
          deviceId: evaluationJobs.deviceId,
          inputHash: evaluationJobs.inputHash,
        })
        .from(evaluationJobs)
        .where(eq(evaluationJobs.attemptId, payload.attemptId))
        .limit(1);

      if (existingRows[0]) {
        const match = resolveIdempotentMatch({
          existing: existingRows[0],
          accountKey,
          deviceId,
          inputHash,
        });
        if (match.kind === 'forbidden') {
          return c.json(
            {
              code: 'unauthorized' as const,
              message: 'Attempt ID belongs to a different account.',
              requestId: c.get('requestId'),
            },
            403,
          );
        }
        if (match.kind === 'conflict') {
          return c.json(
            {
              code: 'attempt_conflict' as const,
              message: 'Attempt ID cannot be reused with modified speaking input.',
              requestId: c.get('requestId'),
            },
            409,
          );
        }
        return c.json({ jobId: match.jobId, status: match.status }, 202);
      }

      // Verify all clips and aggregate byte budget
      const keysToVerify = payload.turns.map((t) => t.objectKey);
      const assetExpiresAt = new Date(Date.now() + env.AUDIO_TTL_DAYS * 24 * 60 * 60 * 1000);
      const maxSingleClipBytes = env.MAX_AUDIO_MB * 1024 * 1024;
      const maxAggregateBytes = Math.min(25 * 1024 * 1024, maxSingleClipBytes * 3);
      let aggregateBytes = 0;

      for (const objectKey of keysToVerify) {
        try {
          const verified = await verifyUploadedAudioObject({
            client: internalS3,
            bucket: env.S3_BUCKET,
            objectKey,
            expectedDeviceId: deviceId,
            maxBytes: maxSingleClipBytes,
          });
          aggregateBytes += verified.byteLength;
          if (aggregateBytes > maxAggregateBytes) {
            return c.json(
              {
                code: 'upload_too_large' as const,
                message: `Combined speaking audio size exceeds ${Math.round(maxAggregateBytes / (1024 * 1024))} MB session limit.`,
                requestId: c.get('requestId'),
              },
              400,
            );
          }
          await db
            .insert(audioAssets)
            .values({
              objectKey,
              deviceId,
              attemptId: payload.attemptId,
              byteLength: verified.byteLength,
              expiresAt: assetExpiresAt,
              purgedAt: null,
            })
            .onConflictDoUpdate({
              target: audioAssets.objectKey,
              set: {
                byteLength: verified.byteLength,
                expiresAt: assetExpiresAt,
                purgedAt: null,
              },
            });
        } catch (err) {
          if (err instanceof DomainError) {
            return c.json(
              { code: err.code, message: err.message, requestId: c.get('requestId') },
              err.status as 400 | 401 | 403 | 404,
            );
          }
          throw err;
        }
      }

      const jobId = randomUUID();
      const executionGeneration = 1;
      const dispatchKey = `${payload.attemptId}:gen:${executionGeneration}`;
      const jobPayload = {
        jobId,
        executionGeneration,
        ...payload,
        edition: payload.edition ?? env.EDITION,
      };

      try {
        await db.transaction(async (tx) => {
          await reserveQuotaAtomic({
            db: tx,
            accountKey,
            deviceId,
            attemptId: payload.attemptId,
            skill: 'speaking',
          });

          await tx.insert(evaluationJobs).values({
            jobId,
            attemptId: payload.attemptId,
            accountKey,
            deviceId,
            packId: payload.packId,
            examId: payload.examId,
            skill: 'speaking',
            status: 'queued',
            stageDetail: 'Queued for audio evaluation',
            inputHash,
            inputJson: payload,
            executionGeneration,
          });

          await tx.insert(jobDispatchOutbox).values({
            jobId,
            queueName: SPEAKING_QUEUE,
            dispatchKey,
            payloadJson: jobPayload,
            status: 'pending',
          });
        });
      } catch (err) {
        if (err instanceof DomainError) {
          return c.json(
            { code: err.code, message: err.message, requestId: c.get('requestId') },
            err.status as 401 | 402 | 409 | 429,
          );
        }
        if (isPgUniqueViolation(err)) {
          const raceRows = await db
            .select({
              jobId: evaluationJobs.jobId,
              status: evaluationJobs.status,
              accountKey: evaluationJobs.accountKey,
              deviceId: evaluationJobs.deviceId,
              inputHash: evaluationJobs.inputHash,
            })
            .from(evaluationJobs)
            .where(eq(evaluationJobs.attemptId, payload.attemptId))
            .limit(1);
          if (raceRows[0]) {
            const match = resolveIdempotentMatch({
              existing: raceRows[0],
              accountKey,
              deviceId,
              inputHash,
            });
            if (match.kind === 'forbidden') {
              return c.json(
                {
                  code: 'unauthorized' as const,
                  message: 'Attempt ID belongs to a different account.',
                  requestId: c.get('requestId'),
                },
                403,
              );
            }
            if (match.kind === 'conflict') {
              return c.json(
                {
                  code: 'attempt_conflict' as const,
                  message: 'Attempt ID cannot be reused with modified speaking input.',
                  requestId: c.get('requestId'),
                },
                409,
              );
            }
            return c.json({ jobId: match.jobId, status: match.status }, 202);
          }
        }
        throw err;
      }

      await dispatchNowAndMark({
        database: db,
        jobId,
        queueName: SPEAKING_QUEUE,
        payload: jobPayload,
        singletonKey: dispatchKey,
      });

      return c.json({ jobId, status: 'queued' as const }, 202);
    }

    const memExisting = memoryJobs.get(payload.attemptId);
    if (memExisting) {
      const match = resolveIdempotentMatch({
        existing: memExisting,
        accountKey,
        deviceId,
        inputHash,
      });
      if (match.kind === 'forbidden') {
        return c.json(
          {
            code: 'unauthorized' as const,
            message: 'Attempt ID belongs to a different account.',
            requestId: c.get('requestId'),
          },
          403,
        );
      }
      if (match.kind === 'conflict') {
        return c.json(
          {
            code: 'attempt_conflict' as const,
            message: 'Attempt ID cannot be reused with modified speaking input.',
            requestId: c.get('requestId'),
          },
          409,
        );
      }
      return c.json({ jobId: match.jobId, status: match.status }, 202);
    }

    const memJobId = randomUUID();
    memoryJobs.set(payload.attemptId, {
      jobId: memJobId,
      accountKey,
      deviceId,
      inputHash,
      status: 'queued',
    });
    return c.json({ jobId: memJobId, status: 'queued' as const }, 202);
  });

  // POST /v1/evaluate/retry (Re-queue an existing failed job with quota re-reservation `TD-16`)
  const retryRoute = createRoute({
    method: 'post',
    path: '/v1/evaluate/retry',
    request: {
      body: {
        content: { 'application/json': { schema: RetryEvaluationRequestSchema } },
      },
    },
    responses: {
      202: {
        description: 'Failed evaluation job re-queued.',
        content: { 'application/json': { schema: JobEnqueueResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      402: {
        description: 'Entitlement required.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      403: {
        description: 'Forbidden.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      404: {
        description: 'Attempt job not found.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      409: {
        description: 'Completed job cannot be retried.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      429: {
        description: 'Quota exceeded.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      503: {
        description: 'Evaluation queue unavailable.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(retryRoute, async (c) => {
    const { attemptId } = c.req.valid('json');
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;

    if (isQueueReady && !isQueueReady()) {
      return c.json(
        {
          code: 'model_unavailable' as const,
          message: 'Evaluation queue producer is temporarily unavailable.',
          requestId: c.get('requestId'),
        },
        503,
      );
    }

    if (db) {
      const jobRows = await db
        .select()
        .from(evaluationJobs)
        .where(eq(evaluationJobs.attemptId, attemptId))
        .limit(1);

      const job = jobRows[0];
      if (!job) {
        return c.json(
          {
            code: 'not_found' as const,
            message: `No evaluation job found for attempt ${attemptId}.`,
            requestId: c.get('requestId'),
          },
          404,
        );
      }

      if (job.accountKey !== accountKey && job.deviceId !== deviceId) {
        return c.json(
          {
            code: 'unauthorized' as const,
            message: 'Access denied to retry this attempt.',
            requestId: c.get('requestId'),
          },
          403,
        );
      }

      if (job.status === 'completed') {
        return c.json(
          {
            code: 'attempt_conflict' as const,
            message: 'Completed evaluations cannot be re-submitted.',
            requestId: c.get('requestId'),
          },
          409,
        );
      }

      if (job.status !== 'failed') {
        return c.json({ jobId: job.jobId, status: normalizeJobStatus(job.status) }, 202);
      }

      const queueName = job.skill === 'speaking' ? SPEAKING_QUEUE : WRITING_QUEUE;
      const storedInput = (job.inputJson ?? {}) as Record<string, unknown>;
      const nextExecutionGeneration = job.executionGeneration + 1;
      const dispatchKey = `${attemptId}:gen:${nextExecutionGeneration}`;
      const jobPayload = {
        jobId: job.jobId,
        executionGeneration: nextExecutionGeneration,
        ...storedInput,
      };

      try {
        await db.transaction(async (tx) => {
          await reserveQuotaAtomic({
            db: tx,
            accountKey,
            deviceId,
            attemptId,
            skill: job.skill === 'speaking' ? 'speaking' : 'writing',
            allowRetryRefunded: true,
          });

          const transitioned = await tx
            .update(evaluationJobs)
            .set({
              status: 'queued',
              stageDetail: 'Retry queued for AI evaluation',
              errorCode: null,
              executionGeneration: nextExecutionGeneration,
              claimToken: null,
              claimExpiresAt: null,
              attemptsCount: job.attemptsCount + 1,
              updatedAt: new Date(),
            })
            .where(and(eq(evaluationJobs.jobId, job.jobId), eq(evaluationJobs.status, 'failed')))
            .returning({ jobId: evaluationJobs.jobId });

          if (transitioned.length > 0) {
            await tx
              .insert(jobDispatchOutbox)
              .values({
                jobId: job.jobId,
                queueName,
                dispatchKey,
                payloadJson: jobPayload,
                status: 'pending',
              })
              .onConflictDoUpdate({
                target: jobDispatchOutbox.jobId,
                set: {
                  queueName,
                  dispatchKey,
                  payloadJson: jobPayload,
                  status: 'pending',
                  updatedAt: new Date(),
                },
              });
          }
        });
      } catch (err) {
        if (err instanceof DomainError) {
          return c.json(
            { code: err.code, message: err.message, requestId: c.get('requestId') },
            err.status as 401 | 402 | 409 | 429,
          );
        }
        throw err;
      }

      await dispatchNowAndMark({
        database: db,
        jobId: job.jobId,
        queueName,
        payload: jobPayload,
        singletonKey: dispatchKey,
      });

      return c.json({ jobId: job.jobId, status: 'queued' as const }, 202);
    }

    const memExisting = memoryJobs.get(attemptId);
    if (memExisting) {
      if (memExisting.accountKey !== accountKey && memExisting.deviceId !== deviceId) {
        return c.json(
          {
            code: 'unauthorized' as const,
            message: 'Access denied to retry this attempt.',
            requestId: c.get('requestId'),
          },
          403,
        );
      }
      memExisting.status = 'queued';
      return c.json({ jobId: memExisting.jobId, status: 'queued' as const }, 202);
    }

    return c.json(
      {
        code: 'not_found' as const,
        message: `No evaluation job found for attempt ${attemptId}.`,
        requestId: c.get('requestId'),
      },
      404,
    );
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
      404: {
        description: 'Published question not found.',
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
    const accountKey = c.get('accountKey') ?? deviceId;

    if (db) {
      const isLinked = accountKey !== deviceId;
      const entRows = await db
        .select({
          isPro: entitlements.isPro,
          expiresAt: entitlements.expiresAt,
          graceUntil: entitlements.graceUntil,
        })
        .from(entitlements)
        .where(
          isLinked
            ? or(eq(entitlements.deviceId, deviceId), eq(entitlements.userId, accountKey))
            : eq(entitlements.deviceId, deviceId),
        );

      const now = new Date();
      const isPro = entRows.some(
        (e) =>
          e.isPro &&
          (!e.expiresAt || e.expiresAt > now || Boolean(e.graceUntil && e.graceUntil > now)),
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

      const edition = env.EDITION === 'irn' ? 'irn' : 'glb';
      // Verify authoritative PUBLISHED question & pack version BEFORE cache lookup/generation (`RR-18`, `TD-59`).
      const [row] = await db
        .select({
          question: examQuestions,
          packVersion: catalogPacks.version,
          packSkill: catalogPacks.skill,
        })
        .from(examQuestions)
        .innerJoin(catalogPacks, eq(examQuestions.packId, catalogPacks.packId))
        .where(
          and(
            eq(examQuestions.questionId, payload.questionId),
            eq(examQuestions.packId, payload.packId),
            eq(catalogPacks.isPublished, true),
            inArray(catalogPacks.edition, [edition, 'all']),
          ),
        )
        .limit(1);

      const qRow = row?.question;
      if (!qRow || !row || (row.packSkill !== payload.skill && row.packSkill !== 'fullMock')) {
        return c.json(
          {
            code: 'not_found' as const,
            message: `Published question ${payload.questionId} was not found in pack ${payload.packId}.`,
            requestId: c.get('requestId'),
          },
          404,
        );
      }

      const authoritativePackVersion = row.packVersion;

      const cached = await db
        .select({ explanationJson: aiQuestionExplanations.explanationJson })
        .from(aiQuestionExplanations)
        .where(
          and(
            eq(aiQuestionExplanations.questionId, payload.questionId),
            eq(aiQuestionExplanations.packVersion, authoritativePackVersion),
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

      const correctAnswer = qRow.acceptedAnswersJson[0] ?? '';
      const questionPrompt = qRow.prompt;
      let passageExcerpt = '';
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

      const authoritativeSkill =
        row.packSkill === 'listening' || row.packSkill === 'reading'
          ? row.packSkill
          : payload.skill;

      // Generate question-generic explanation using authoritative DB metadata (`RR-18`, `TD-59`).
      const generatedExplanation = await explainQuestionGraph.invoke({
        ...payload,
        edition: payload.edition ?? env.EDITION,
        packVersion: authoritativePackVersion,
        questionType: qRow.questionType,
        skill: authoritativeSkill,
        userAnswer: '',
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
          packVersion: authoritativePackVersion,
          skill: payload.skill,
          explanationJson: responsePayload,
        })
        .onConflictDoNothing();

      return c.json(ExplainQuestionResponseSchema.parse(responsePayload), 200);
    }

    return c.json(
      {
        code: 'not_found' as const,
        message: 'Database unavailable for authoritative question lookup.',
        requestId: c.get('requestId'),
      },
      404,
    );
  });
}

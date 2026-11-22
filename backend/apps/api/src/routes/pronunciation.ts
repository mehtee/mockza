import { createHash, randomUUID } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import { analyzePronunciationGraph, bufferAudioStream, prepareAudioForModel } from '@mockza/ai';
import type { AppEnv } from '@mockza/config';
import {
  AnalyzePronunciationRequestSchema,
  ApiErrorSchema,
  JobEnqueueResponseSchema,
  PronunciationHistoryResponseSchema,
  PronunciationPracticeItemSchema,
  PronunciationPresignRequestSchema,
  PronunciationPresignResponseSchema,
} from '@mockza/contracts';
import {
  audioAssets,
  devices,
  evaluationJobs,
  jobDispatchOutbox,
  type MockzaDb,
  pronunciationPractices,
  recordAiUsageLedger,
  recordUserActivityLedger,
  upsertLinguisticGraphSignals,
} from '@mockza/db';
import { evaluatePronunciationQuota, normalizeSupportedExamId } from '@mockza/domain';
import {
  createAudioPresignObjectUrl,
  createAudioS3Client,
  createPublicSigningS3Client,
  extensionForAudioContentType,
  getMediaObject,
  signUploadProxyParams,
  type SupportedAudioContentType,
} from '@mockza/storage';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type PgBoss from 'pg-boss';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';
import { getAccountQuotaStatus } from '../services/quota.js';

export const ANALYZE_PRONUNCIATION_QUEUE = 'advanced.analyze-pronunciation';

function sha256Canonical(data: unknown): string {
  return createHash('sha256').update(JSON.stringify(data), 'utf-8').digest('hex');
}

export function registerPronunciationRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
  boss?: PgBoss,
  s3Client?: S3Client,
  isQueueReady?: () => boolean,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db);
  app.use('/v1/pronunciation/*', authMiddleware);
  const internalS3 = s3Client ?? createAudioS3Client(env);

  const presignRoute = createRoute({
    method: 'post',
    path: '/v1/pronunciation/presign',
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: PronunciationPresignRequestSchema } },
      },
    },
    responses: {
      200: {
        description: 'Upload URL and locked objectKey for pronunciation recording.',
        content: { 'application/json': { schema: PronunciationPresignResponseSchema } },
      },
      400: { description: 'Validation error.', content: { 'application/json': { schema: ApiErrorSchema } } },
      401: { description: 'Unauthorized.', content: { 'application/json': { schema: ApiErrorSchema } } },
    },
  });

  app.openapi(presignRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const body = c.req.valid('json');
    const contentType = body.contentType as SupportedAudioContentType;
    const ext = extensionForAudioContentType(contentType);
    const objectKey = `users/${deviceId}/pronunciation/${body.practiceId}/take.${ext}`;
    const expiresInSeconds = 300;

    let uploadGeneration = 1;
    if (db) {
      const [dev] = await db
        .select({ uploadGeneration: devices.uploadGeneration, erasingAt: devices.erasingAt })
        .from(devices)
        .where(eq(devices.deviceId, deviceId))
        .limit(1);
      if (!dev || dev.erasingAt !== null) {
        return c.json(
          { code: 'unauthorized' as const, message: 'Device unavailable.', requestId: c.get('requestId') },
          401,
        );
      }
      uploadGeneration = dev.uploadGeneration;
      await db
        .insert(audioAssets)
        .values({
          objectKey,
          deviceId,
          attemptId: body.practiceId,
          accountKey,
          assetKind: 'pronunciation_practice',
          sourceRefId: body.practiceId,
          contentType,
          byteLength: body.byteLength,
          expiresAt: new Date(Date.now() + env.AUDIO_TTL_DAYS * 86_400_000),
        })
        .onConflictDoNothing();
    }

    if (env.S3_PUBLIC_MODE === 'proxy') {
      const expiresAtEpochSec = Math.floor(Date.now() / 1000) + expiresInSeconds;
      const sig = signUploadProxyParams({
        secret: env.JWT_SECRET,
        bucket: env.S3_BUCKET,
        objectKey,
        contentType,
        expiresAtEpochSec,
        uploadGeneration,
      });
      const qs = new URLSearchParams({
        key: objectKey,
        contentType,
        exp: String(expiresAtEpochSec),
        gen: String(uploadGeneration),
        sig,
      });
      return c.json(
        PronunciationPresignResponseSchema.parse({
          practiceId: body.practiceId,
          uploadUrl: `/v1/uploads/signed-put?${qs.toString()}`,
          objectKey,
          expiresInSeconds,
        }),
        200,
      );
    }

    const publicClient = createPublicSigningS3Client(env);
    const uploadUrl = await createAudioPresignObjectUrl({
      client: publicClient,
      bucket: env.S3_BUCKET,
      objectKey,
      contentType,
      byteLength: body.byteLength,
      expiresInSeconds,
    });
    return c.json(
      PronunciationPresignResponseSchema.parse({
        practiceId: body.practiceId,
        uploadUrl,
        objectKey,
        expiresInSeconds,
      }),
      200,
    );
  });

  const analyzeRoute = createRoute({
    method: 'post',
    path: '/v1/pronunciation/analyze',
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: AnalyzePronunciationRequestSchema } },
      },
    },
    responses: {
      202: {
        description: 'Pronunciation analysis queued or completed.',
        content: { 'application/json': { schema: JobEnqueueResponseSchema } },
      },
      400: { description: 'Validation error.', content: { 'application/json': { schema: ApiErrorSchema } } },
      401: { description: 'Unauthorized.', content: { 'application/json': { schema: ApiErrorSchema } } },
      429: { description: 'Daily pronunciation quota reached.', content: { 'application/json': { schema: ApiErrorSchema } } },
      503: { description: 'Queue unavailable.', content: { 'application/json': { schema: ApiErrorSchema } } },
    },
  });

  app.openapi(analyzeRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const body = c.req.valid('json');
    if (!body.objectKey.startsWith(`users/${deviceId}/`)) {
      return c.json(
        {
          code: 'validation_error' as const,
          message: 'Recording objectKey does not belong to authenticated device.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    if (db) {
      const todayMidnight = new Date();
      todayMidnight.setUTCHours(0, 0, 0, 0);
      const [status, usedRows] = await Promise.all([
        getAccountQuotaStatus({ db, accountKey, deviceId }),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(pronunciationPractices)
          .where(
            and(
              eq(pronunciationPractices.accountKey, accountKey),
              gte(pronunciationPractices.createdAt, todayMidnight),
            ),
          ),
      ]);
      const quotaCheck = evaluatePronunciationQuota({
        isPro: status.isPro,
        usedToday: Number(usedRows[0]?.count ?? 0),
      });
      if (!quotaCheck.allowed) {
        return c.json(
          {
            code: 'quota_exceeded' as const,
            message: `Daily pronunciation practice limit (${quotaCheck.limit}) reached.`,
            requestId: c.get('requestId'),
          },
          429,
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

    const practiceId = body.practiceId ?? randomUUID();
    const jobId = practiceId;
    const examTrack = normalizeSupportedExamId(body.examTrack);
    const dispatchKey = `${practiceId}:gen:1`;
    const jobPayload = {
      jobId,
      practiceId,
      attemptId: practiceId,
      accountKey,
      deviceId,
      edition: env.EDITION,
      examTrack,
      targetText: body.targetText,
      practiceKind: body.practiceKind,
      sourceRefType: body.sourceRefType ?? null,
      sourceRefId: body.sourceRefId ?? null,
      objectKey: body.objectKey,
      durationMs: body.durationMs ?? null,
      executionGeneration: 1,
    };

    if (db) {
      await db.transaction(async (tx) => {
        await tx
          .insert(pronunciationPractices)
          .values({
            practiceId,
            accountKey,
            edition: env.EDITION,
            targetText: body.targetText,
            practiceKind: body.practiceKind,
            sourceRefType: body.sourceRefType ?? null,
            sourceRefId: body.sourceRefId ?? null,
            objectKey: body.objectKey,
            durationMs: body.durationMs ?? null,
            status: 'queued',
            createdAt: new Date(),
          })
          .onConflictDoNothing();

        await tx
          .insert(evaluationJobs)
          .values({
            jobId,
            attemptId: practiceId,
            accountKey,
            deviceId,
            packId: 'pronunciation-studio-v1',
            examId: examTrack,
            taskType: 'pronunciation',
            skill: 'speaking',
            status: 'queued',
            stageDetail: 'Analyzing pronunciation phonemes, word stress, and intonation',
            inputHash: sha256Canonical(jobPayload),
            inputJson: jobPayload,
            executionGeneration: 1,
          })
          .onConflictDoNothing();

        if (boss) {
          await tx
            .insert(jobDispatchOutbox)
            .values({
              jobId,
              queueName: ANALYZE_PRONUNCIATION_QUEUE,
              dispatchKey,
              payloadJson: jobPayload,
              status: 'pending',
            })
            .onConflictDoNothing();
        }
      });

      if (boss) {
        try {
          await boss.send(ANALYZE_PRONUNCIATION_QUEUE, jobPayload, {
            singletonKey: dispatchKey,
            retryLimit: 2,
            retryBackoff: true,
          });
          await db
            .update(jobDispatchOutbox)
            .set({ status: 'dispatched', updatedAt: new Date() })
            .where(eq(jobDispatchOutbox.jobId, jobId));
          return c.json(JobEnqueueResponseSchema.parse({ jobId, status: 'queued' }), 202);
        } catch {
          // Outbox sweeper picks up if queued
        }
        return c.json(JobEnqueueResponseSchema.parse({ jobId, status: 'queued' }), 202);
      }

      // Direct inline fallback if worker/boss unavailable in embedded API mode
      try {
        const obj = await getMediaObject({
          client: internalS3,
          bucket: env.S3_BUCKET,
          objectKey: body.objectKey,
        });
        if (obj) {
          const buf = await bufferAudioStream(obj.body);
          const prepared = await prepareAudioForModel(buf, body.objectKey, {
            maxDurationSeconds: 60,
          });
          const analyzed = await analyzePronunciationGraph(
            {
              edition: env.EDITION,
              examTrack,
              targetText: body.targetText,
              practiceKind: body.practiceKind,
              base64AudioData: prepared.base64Data,
              audioFormat: prepared.format,
            },
            {
              modelOverride: env.OPENROUTER_PRONUNCIATION_MODEL,
              allowDemoEvaluator: env.ALLOW_DEMO_EVALUATOR || !env.OPENROUTER_API_KEY,
            },
          );
          await db
            .update(pronunciationPractices)
            .set({
              transcript: analyzed.result.transcript,
              accuracyScore: analyzed.result.accuracyScore,
              fluencyScore: analyzed.result.fluencyScore,
              intonationScore: analyzed.result.intonationScore,
              stressScore: analyzed.result.stressScore,
              overallScore: analyzed.result.overallScore,
              bandImpactLabel: analyzed.result.bandImpactLabel,
              summaryEn: analyzed.result.summaryEn,
              summaryFa: analyzed.result.summaryFa,
              mouthTipEn: analyzed.result.mouthTipEn,
              mouthTipFa: analyzed.result.mouthTipFa,
              actionableRetryEn: analyzed.result.actionableRetryEn,
              actionableRetryFa: analyzed.result.actionableRetryFa,
              wordsFeedbackJson: analyzed.result.wordsFeedback,
              weaknessSignalKey: analyzed.result.weaknessSignalKey,
              status: 'completed',
              modelUsed: analyzed.result.modelUsed,
              providerRequestId: analyzed.usage?.providerRequestId ?? null,
              promptTokens: analyzed.usage?.promptTokens ?? 0,
              completionTokens: analyzed.usage?.completionTokens ?? 0,
              cachedTokens: analyzed.usage?.cachedTokens ?? 0,
              estimatedCostUsdMicros: analyzed.usage?.estimatedCostUsdMicros ?? 0,
            })
            .where(eq(pronunciationPractices.practiceId, practiceId));

          await db
            .update(evaluationJobs)
            .set({
              status: 'completed',
              stageDetail: 'Pronunciation feedback ready',
              overallBand: null,
              resultJson: analyzed.result as unknown as Record<string, unknown>,
              modelId: analyzed.result.modelUsed,
              tokenUsageJson: analyzed.usage ?? null,
              estimatedCostUsdMicros: analyzed.usage?.estimatedCostUsdMicros ?? 0,
              updatedAt: new Date(),
            })
            .where(eq(evaluationJobs.jobId, jobId));

          if (analyzed.usage) {
            await recordAiUsageLedger({
              db,
              accountKey,
              deviceId,
              edition: env.EDITION,
              featureKind: 'pronunciation',
              entityType: 'pronunciation_practice',
              entityId: practiceId,
              modelId: analyzed.usage.modelId,
              providerRequestId: analyzed.usage.providerRequestId,
              promptTokens: analyzed.usage.promptTokens,
              completionTokens: analyzed.usage.completionTokens,
              cachedTokens: analyzed.usage.cachedTokens,
              totalTokens: analyzed.usage.totalTokens,
              estimatedCostUsdMicros: analyzed.usage.estimatedCostUsdMicros,
              costUsdSource: analyzed.usage.costUsdSource,
              latencyMs: analyzed.usage.latencyMs,
              audioDurationMs: body.durationMs ?? null,
            });
          }
          if (analyzed.result.weaknessSignalKey) {
            await upsertLinguisticGraphSignals({
              db,
              accountKey,
              edition: env.EDITION,
              sourceKind: 'pronunciation',
              sourceRefId: practiceId,
              signals: [
                {
                  nodeKind: analyzed.result.overallScore >= 85 ? 'target_structure' : 'bottleneck',
                  canonicalKey: analyzed.result.weaknessSignalKey,
                  displayLabelEn: analyzed.result.weaknessSignalKey.replace(/^phonetics:/, '').replace(/_/g, ' '),
                  displayLabelFa: analyzed.result.mouthTipFa ?? analyzed.result.weaknessSignalKey,
                  coachNoteEn: analyzed.result.mouthTipEn,
                  coachNoteFa: analyzed.result.mouthTipFa ?? analyzed.result.mouthTipEn,
                  observedPolarity: analyzed.result.overallScore >= 85 ? 'target_used' : 'gap_observed',
                  excerptText: analyzed.result.transcript,
                  skill: 'speaking',
                  detectedFrom: 'pronunciation',
                },
              ],
            });
          }
          await recordUserActivityLedger({
            db,
            accountKey,
            deviceId,
            edition: env.EDITION,
            activityKind: 'pronunciation_practice',
            entityType: 'pronunciation_practice',
            entityId: practiceId,
            weaknessKeys: analyzed.result.weaknessSignalKey ? [analyzed.result.weaknessSignalKey] : [],
            durationSeconds: body.durationMs ? Math.ceil(body.durationMs / 1000) : null,
            metadata: {
              targetText: body.targetText,
              overallScore: analyzed.result.overallScore,
            },
          });
          return c.json(JobEnqueueResponseSchema.parse({ jobId, status: 'completed' }), 202);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message.slice(0, 300) : 'Inline pronunciation analysis failed';
        await db
          .update(pronunciationPractices)
          .set({ status: 'failed', errorMessage: msg })
          .where(eq(pronunciationPractices.practiceId, practiceId))
          .catch(() => {});
        await db
          .update(evaluationJobs)
          .set({
            status: 'failed',
            errorCode: 'internal_error',
            stageDetail: msg,
            updatedAt: new Date(),
          })
          .where(eq(evaluationJobs.jobId, jobId))
          .catch(() => {});
        return c.json(JobEnqueueResponseSchema.parse({ jobId, status: 'failed' }), 202);
      }
    }

    return c.json(JobEnqueueResponseSchema.parse({ jobId, status: 'queued' }), 202);
  });

  const mapPracticeRow = (r: typeof pronunciationPractices.$inferSelect) => ({
    practiceId: r.practiceId,
    targetText: r.targetText,
    practiceKind: r.practiceKind,
    sourceRefType: r.sourceRefType ?? null,
    sourceRefId: r.sourceRefId ?? null,
    objectKey: r.objectKey,
    audioPlayUrl: `/v1/pronunciation/audio/${r.practiceId}`,
    referenceTtsUrl: null,
    transcript: r.transcript ?? null,
    accuracyScore: r.accuracyScore ?? null,
    fluencyScore: r.fluencyScore ?? null,
    intonationScore: r.intonationScore ?? null,
    stressScore: r.stressScore ?? null,
    overallScore: r.overallScore ?? null,
    bandImpactLabel: r.bandImpactLabel ?? null,
    summaryEn: r.summaryEn ?? null,
    summaryFa: r.summaryFa ?? null,
    mouthTipEn: r.mouthTipEn ?? null,
    mouthTipFa: r.mouthTipFa ?? null,
    actionableRetryEn: r.actionableRetryEn ?? null,
    actionableRetryFa: r.actionableRetryFa ?? null,
    wordsFeedback: r.wordsFeedbackJson as never[],
    status: r.status,
    errorMessage: r.errorMessage ?? null,
    modelUsed: r.modelUsed ?? null,
    estimatedCostUsdMicros: r.estimatedCostUsdMicros,
    createdAt: r.createdAt.toISOString(),
  });

  const historyRoute = createRoute({
    method: 'get',
    path: '/v1/pronunciation/history',
    request: {
      query: z.object({
        sourceRefId: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        cursor: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Synced pronunciation practices with replay audio links.',
        content: { 'application/json': { schema: PronunciationHistoryResponseSchema } },
      },
      401: { description: 'Unauthorized.', content: { 'application/json': { schema: ApiErrorSchema } } },
    },
  });

  app.openapi(historyRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const { sourceRefId, limit, cursor } = c.req.valid('query');
    if (!db) {
      return c.json(
        PronunciationHistoryResponseSchema.parse({
          items: [],
          nextCursor: null,
          remainingDailyQuota: 15,
          dailyQuotaLimit: 15,
        }),
        200,
      );
    }

    const conditions = [
      eq(pronunciationPractices.accountKey, accountKey),
      eq(pronunciationPractices.edition, env.EDITION),
    ];
    if (sourceRefId) {
      conditions.push(eq(pronunciationPractices.sourceRefId, sourceRefId));
    }
    if (cursor) {
      const parsedCursor = new Date(cursor);
      if (!Number.isNaN(parsedCursor.getTime())) {
        conditions.push(sql`${pronunciationPractices.createdAt} < ${parsedCursor}`);
      }
    }

    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);
    const [rows, quotaStatus, usedRows] = await Promise.all([
      db
        .select()
        .from(pronunciationPractices)
        .where(and(...conditions))
        .orderBy(desc(pronunciationPractices.createdAt))
        .limit(limit + 1),
      getAccountQuotaStatus({ db, accountKey, deviceId }),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(pronunciationPractices)
        .where(
          and(
            eq(pronunciationPractices.accountKey, accountKey),
            gte(pronunciationPractices.createdAt, todayMidnight),
          ),
        ),
    ]);

    const hasMore = rows.length > limit;
    const sliced = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? sliced[sliced.length - 1]?.createdAt.toISOString() ?? null : null;
    const quotaCheck = evaluatePronunciationQuota({
      isPro: quotaStatus.isPro,
      usedToday: Number(usedRows[0]?.count ?? 0),
    });

    return c.json(
      PronunciationHistoryResponseSchema.parse({
        items: sliced.map(mapPracticeRow),
        nextCursor,
        remainingDailyQuota: Math.max(0, quotaCheck.limit - Number(usedRows[0]?.count ?? 0)),
        dailyQuotaLimit: quotaCheck.limit,
      }),
      200,
    );
  });

  const singlePracticeRoute = createRoute({
    method: 'get',
    path: '/v1/pronunciation/{practiceId}',
    request: { params: z.object({ practiceId: z.string().uuid() }) },
    responses: {
      200: {
        description: 'Single pronunciation practice item (for job polling).',
        content: { 'application/json': { schema: PronunciationPracticeItemSchema } },
      },
      401: { description: 'Unauthorized.', content: { 'application/json': { schema: ApiErrorSchema } } },
      404: { description: 'Not found.', content: { 'application/json': { schema: ApiErrorSchema } } },
    },
  });

  app.openapi(singlePracticeRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const { practiceId } = c.req.valid('param');
    if (!db) {
      return c.json(
        { code: 'not_found' as const, message: 'Practice item not found.', requestId: c.get('requestId') },
        404,
      );
    }
    const [row] = await db
      .select()
      .from(pronunciationPractices)
      .where(
        and(
          eq(pronunciationPractices.practiceId, practiceId),
          eq(pronunciationPractices.accountKey, accountKey),
        ),
      )
      .limit(1);
    if (!row) {
      return c.json(
        { code: 'not_found' as const, message: 'Practice item not found.', requestId: c.get('requestId') },
        404,
      );
    }
    return c.json(PronunciationPracticeItemSchema.parse(mapPracticeRow(row)), 200);
  });

  const audioPlaybackRoute = createRoute({
    method: 'get',
    path: '/v1/pronunciation/audio/{practiceId}',
    request: { params: z.object({ practiceId: z.string().uuid() }) },
    responses: {
      200: { description: 'Pronunciation recording stream' },
      401: { description: 'Unauthorized' },
      404: { description: 'Not found' },
    },
  });

  app.openapi(audioPlaybackRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json({ code: 'unauthorized', message: 'Auth required', requestId: c.get('requestId') }, 401);
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const { practiceId } = c.req.valid('param');
    if (!db) {
      return c.json({ code: 'not_found', message: 'Recording not found', requestId: c.get('requestId') }, 404);
    }
    const [row] = await db
      .select()
      .from(pronunciationPractices)
      .where(
        and(
          eq(pronunciationPractices.practiceId, practiceId),
          eq(pronunciationPractices.accountKey, accountKey),
        ),
      )
      .limit(1);
    if (!row) {
      return c.json({ code: 'not_found', message: 'Recording not found', requestId: c.get('requestId') }, 404);
    }
    const obj = await getMediaObject({
      client: internalS3,
      bucket: env.S3_BUCKET,
      objectKey: row.objectKey,
    });
    if (!obj) {
      return c.json({ code: 'not_found', message: 'Audio file purged or unavailable', requestId: c.get('requestId') }, 404);
    }
    const chunks: Uint8Array[] = [];
    for await (const chunk of obj.body) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Uint8Array));
    }
    c.header('Content-Type', obj.contentType || 'audio/mp4');
    c.header('Cache-Control', 'private, max-age=3600');
    return c.body(Buffer.concat(chunks) as never, 200);
  });
}

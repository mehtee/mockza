import { createHash, randomUUID } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import {
  ApiErrorSchema,
  DropHistoryResponseSchema,
  DropIngestRequestSchema,
  DropPresignMediaRequestSchema,
  DropPresignMediaResponseSchema,
  DroppedContentResponseSchema,
  JobEnqueueResponseSchema,
} from '@mockza/contracts';
import {
  devices,
  droppedContents,
  evaluationJobs,
  getAdvancedQuotaSummary,
  jobDispatchOutbox,
  type MockzaDb,
  reserveAdvancedQuotaAtomic,
} from '@mockza/db';
import {
  DomainError,
  validateBoundedAudioInput,
  validateDropImagesMetadata,
  validateDropTextSnippet,
  validateDropUrlPreFlight,
} from '@mockza/domain';
import {
  buildDropMediaObjectKey,
  createAudioS3Client,
  createDropMediaPresignUrl,
  createPublicSigningS3Client,
  deleteAudioObjects,
  signUploadProxyParams,
  type SupportedDropMediaContentType,
} from '@mockza/storage';
import { and, desc, eq, lt } from 'drizzle-orm';
import type PgBoss from 'pg-boss';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';

export const DROP_INGEST_QUEUE = 'advanced.drop-ingest';

function sha256Canonical(data: unknown): string {
  return createHash('sha256').update(JSON.stringify(data), 'utf-8').digest('hex');
}

export function registerDropRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
  boss?: PgBoss,
  s3Client?: S3Client,
  isQueueReady?: () => boolean,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db);
  app.use('/v1/drop/*', authMiddleware);
  const internalS3 = s3Client ?? createAudioS3Client(env);
  const signingS3 = createPublicSigningS3Client(env);

  const presignDropRoute = createRoute({
    method: 'post',
    path: '/v1/drop/presign-media',
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: DropPresignMediaRequestSchema } },
      },
    },
    responses: {
      200: {
        description: 'Short-lived upload URLs for bounded Drop Anything images or audio.',
        content: { 'application/json': { schema: DropPresignMediaResponseSchema } },
      },
      400: {
        description: 'Invalid media specification.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      402: {
        description: 'Pro subscription required.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      404: {
        description: 'Feature disabled.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      429: {
        description: 'Daily or monthly drop quota exceeded.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(presignDropRoute, async (c) => {
    const body = c.req.valid('json');
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;

    if (body.mediaKind === 'audio' && !env.ENABLE_DROP_ANYTHING_AUDIO) {
      return c.json(
        {
          code: 'feature_disabled' as const,
          message: 'Audio drops are currently disabled.',
          requestId: c.get('requestId'),
        },
        404,
      );
    }
    if (body.mediaKind === 'image' && !env.ENABLE_DROP_ANYTHING_TEXT_IMAGE) {
      return c.json(
        {
          code: 'feature_disabled' as const,
          message: 'Image drops are currently disabled.',
          requestId: c.get('requestId'),
        },
        404,
      );
    }

    let uploadGeneration = 1;
    if (db) {
      const [dev] = await db
        .select({ uploadGeneration: devices.uploadGeneration, erasingAt: devices.erasingAt })
        .from(devices)
        .where(eq(devices.deviceId, deviceId))
        .limit(1);
      if (!dev || dev.erasingAt !== null) {
        return c.json(
          {
            code: 'unauthorized' as const,
            message: 'Device missing or undergoing erasure.',
            requestId: c.get('requestId'),
          },
          401,
        );
      }
      uploadGeneration = dev.uploadGeneration;

      const summary = await getAdvancedQuotaSummary({
        db,
        accountKey,
        deviceId,
        edition: env.EDITION,
        feature: body.mediaKind === 'audio' ? 'drop_audio' : 'drop_text_image',
      });
      if (!summary.allowedForFeature) {
        if (
          summary.reason === 'pro_required_for_audio_drop' ||
          summary.reason === 'free_sample_used'
        ) {
          return c.json(
            {
              code: 'entitlement_required' as const,
              message:
                summary.reason === 'pro_required_for_audio_drop'
                  ? 'Upgrade to Pro to upload audio study materials.'
                  : 'Free trial drop already used. Upgrade to Pro for daily drops.',
              requestId: c.get('requestId'),
            },
            402,
          );
        }
        return c.json(
          {
            code: 'quota_exceeded' as const,
            message: `Daily or monthly study material limit reached (${summary.reason ?? 'limit'}).`,
            requestId: c.get('requestId'),
          },
          429,
        );
      }
    }

    const expiresInSeconds = 300;
    const items: Array<{ objectKey: string; uploadUrl: string; expiresInSeconds: number }> = [];

    for (let i = 0; i < body.files.length; i += 1) {
      const file = body.files[i]!;
      const normalizedCt = (
        file.contentType === 'audio/webm' ? 'audio/mp4' : file.contentType
      ) as SupportedDropMediaContentType;

      if (env.S3_PUBLIC_MODE === 'proxy') {
        const objectKey = buildDropMediaObjectKey({
          deviceId,
          dropId: body.dropId,
          index: i,
          contentType: normalizedCt,
        });
        const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
        const sig = signUploadProxyParams({
          secret: env.JWT_SECRET,
          bucket: env.S3_BUCKET,
          objectKey,
          contentType: normalizedCt,
          expiresAtEpochSec: exp,
          uploadGeneration,
        });
        const qs = new URLSearchParams({
          key: objectKey,
          contentType: normalizedCt,
          exp: String(exp),
          sig,
          gen: String(uploadGeneration),
        });
        items.push({
          objectKey,
          uploadUrl: `/v1/uploads/signed-put?${qs.toString()}`,
          expiresInSeconds,
        });
      } else {
        const presigned = await createDropMediaPresignUrl({
          client: signingS3,
          bucket: env.S3_BUCKET,
          deviceId,
          dropId: body.dropId,
          index: i,
          byteLength: file.byteLength,
          contentType: normalizedCt,
          expiresInSeconds,
        });
        items.push(presigned);
      }
    }

    return c.json(
      DropPresignMediaResponseSchema.parse({
        dropId: body.dropId,
        items,
      }),
      200,
    );
  });

  const ingestRoute = createRoute({
    method: 'post',
    path: '/v1/drop/ingest',
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: DropIngestRequestSchema } },
      },
    },
    responses: {
      202: {
        description: 'Drop Anything job queued cleanly.',
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
        description: 'Pro subscription required.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      404: {
        description: 'Feature disabled.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      422: {
        description: 'SSRF or unsupported video/duration constraint rejected before spend.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      429: {
        description: 'Daily or monthly drop quota exceeded.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      503: {
        description: 'Queue unavailable.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(ingestRoute, async (c) => {
    const body = c.req.valid('json');
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;

    if (body.inputKind === 'audio' && !env.ENABLE_DROP_ANYTHING_AUDIO) {
      return c.json(
        {
          code: 'feature_disabled' as const,
          message: 'Bounded audio drops are disabled.',
          requestId: c.get('requestId'),
        },
        404,
      );
    }
    if (body.inputKind !== 'audio' && !env.ENABLE_DROP_ANYTHING_TEXT_IMAGE) {
      return c.json(
        {
          code: 'feature_disabled' as const,
          message: 'Drop Anything text/image ingestion is disabled.',
          requestId: c.get('requestId'),
        },
        404,
      );
    }

    // Fail-fast pure domain / SSRF preflight BEFORE touching quota or pg-boss
    const allowHttpDev = env.NODE_ENV !== 'production';
    if (body.inputKind === 'text_url') {
      const urlCheck = validateDropUrlPreFlight(body.sourceUrl, { allowHttpInDev: allowHttpDev });
      if (!urlCheck.ok) {
        return c.json(
          {
            code: (urlCheck.code ?? 'UNSUPPORTED_DROP_SOURCE') as
              | 'UNSUPPORTED_DROP_SOURCE'
              | 'SSRF_BLOCKED_HOST'
              | 'INVALID_DROP_URL',
            message: urlCheck.reason ?? 'URL blocked by Drop policy.',
            requestId: c.get('requestId'),
          },
          422,
        );
      }
    } else if (body.inputKind === 'text') {
      const textCheck = validateDropTextSnippet(body.rawText);
      if (!textCheck.ok) {
        return c.json(
          {
            code: 'INVALID_DROP_TEXT' as const,
            message: textCheck.reason ?? 'Text length must be 40..15,000 chars.',
            requestId: c.get('requestId'),
          },
          400,
        );
      }
    } else if (body.inputKind === 'image') {
      const imgCount = (body.imageObjectKeys?.length ?? 0) + (body.imageUrls?.length ?? 0);
      if (imgCount === 0) {
        return c.json(
          {
            code: 'validation_error' as const,
            message: 'Provide at least 1 imageObjectKey or imageUrl.',
            requestId: c.get('requestId'),
          },
          400,
        );
      }
      for (const objKey of body.imageObjectKeys ?? []) {
        if (!objKey.startsWith(`users/${deviceId}/drops/`)) {
          return c.json(
            {
              code: 'validation_error' as const,
              message: 'Image objectKey does not belong to authenticated device drop prefix.',
              requestId: c.get('requestId'),
            },
            400,
          );
        }
      }
      const metaCheck = validateDropImagesMetadata(
        Array.from({ length: imgCount }, () => ({ contentType: 'image/png', byteLength: 1024 })),
      );
      if (!metaCheck.ok) {
        return c.json(
          {
            code: 'INVALID_DROP_IMAGE' as const,
            message: metaCheck.reason ?? 'Invalid image count.',
            requestId: c.get('requestId'),
          },
          400,
        );
      }
      for (const imgUrl of body.imageUrls ?? []) {
        const uCheck = validateDropUrlPreFlight(imgUrl, { allowHttpInDev: allowHttpDev });
        if (!uCheck.ok) {
          return c.json(
            {
              code: (uCheck.code ?? 'SSRF_BLOCKED_HOST') as
                | 'UNSUPPORTED_DROP_SOURCE'
                | 'SSRF_BLOCKED_HOST'
                | 'INVALID_DROP_URL',
              message: uCheck.reason ?? 'Blocked image URL.',
              requestId: c.get('requestId'),
            },
            422,
          );
        }
      }
    } else if (body.inputKind === 'audio') {
      if (!body.audioObjectKey && !body.audioUrl) {
        return c.json(
          {
            code: 'validation_error' as const,
            message: 'Provide audioObjectKey or audioUrl.',
            requestId: c.get('requestId'),
          },
          400,
        );
      }
      if (body.audioObjectKey && !body.audioObjectKey.startsWith(`users/${deviceId}/drops/`)) {
        return c.json(
          {
            code: 'validation_error' as const,
            message: 'Audio objectKey does not belong to authenticated device drop prefix.',
            requestId: c.get('requestId'),
          },
          400,
        );
      }
      const audioCheck = validateBoundedAudioInput({
        mode: 'drop',
        contentType: 'audio/mp4',
        byteLength: 1024,
        durationSeconds: body.durationSeconds,
      });
      if (!audioCheck.ok) {
        return c.json(
          {
            code: 'DROP_AUDIO_TOO_LONG' as const,
            message: audioCheck.reason ?? 'Audio clip exceeds 180s ceiling.',
            requestId: c.get('requestId'),
          },
          422,
        );
      }
      if (body.audioUrl) {
        const uCheck = validateDropUrlPreFlight(body.audioUrl, { allowHttpInDev: allowHttpDev });
        if (!uCheck.ok) {
          return c.json(
            {
              code: (uCheck.code ?? 'UNSUPPORTED_DROP_SOURCE') as
                | 'UNSUPPORTED_DROP_SOURCE'
                | 'SSRF_BLOCKED_HOST'
                | 'INVALID_DROP_URL',
              message: uCheck.reason ?? 'Blocked audio URL.',
              requestId: c.get('requestId'),
            },
            422,
          );
        }
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
    const dropId = randomUUID();
    const executionGeneration = 1;
    const dispatchKey = `${attemptId}:gen:${executionGeneration}`;
    const quotaSkill = body.inputKind === 'audio' ? 'drop_audio' : 'drop_text_image';

    const jobPayload = {
      jobId,
      attemptId,
      dropId,
      accountKey,
      deviceId,
      edition: env.EDITION,
      request: body,
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
            skill: quotaSkill,
            edition: env.EDITION,
          });

          await tx.insert(evaluationJobs).values({
            jobId,
            attemptId,
            accountKey,
            deviceId,
            packId: 'drop_anything_v1',
            examId: body.examTrack,
            taskType: 'drop_ingest',
            skill: body.inputKind === 'audio' ? 'speaking' : 'writing',
            status: 'queued',
            stageDetail: 'Queued for Drop Anything extraction and 2-min drill synthesis',
            inputHash: sha256Canonical(body),
            inputJson: jobPayload,
            executionGeneration,
          });

          await tx.insert(jobDispatchOutbox).values({
            jobId,
            queueName: DROP_INGEST_QUEUE,
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
          await boss.send(DROP_INGEST_QUEUE, jobPayload, {
            singletonKey: dispatchKey,
            retryLimit: 2,
            retryBackoff: true,
          });
          await db
            .update(jobDispatchOutbox)
            .set({ status: 'dispatched', updatedAt: new Date() })
            .where(eq(jobDispatchOutbox.jobId, jobId));
        } catch {
          // Outbox handles dispatch recovery
        }
      }
    }

    return c.json({ jobId, status: 'queued' as const }, 202);
  });

  const historyRoute = createRoute({
    method: 'get',
    path: '/v1/drop/history',
    request: {
      query: z.object({
        limit: z.coerce.number().int().min(1).max(50).default(20),
        cursor: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Private personal drop archive scoped to accountKey and edition.',
        content: { 'application/json': { schema: DropHistoryResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(historyRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        {
          code: 'unauthorized' as const,
          message: 'Auth required',
          requestId: c.get('requestId'),
        },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const { limit, cursor } = c.req.valid('query');

    if (!db) {
      return c.json(DropHistoryResponseSchema.parse({ items: [], nextCursor: null }), 200);
    }

    const cursorDate = cursor ? new Date(cursor) : null;
    const rows = await db
      .select()
      .from(droppedContents)
      .where(
        and(
          eq(droppedContents.accountKey, accountKey),
          eq(droppedContents.edition, env.EDITION),
          ...(cursorDate && !Number.isNaN(cursorDate.getTime())
            ? [lt(droppedContents.createdAt, cursorDate)]
            : []),
        ),
      )
      .orderBy(desc(droppedContents.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const slice = rows.slice(0, limit);
    const items = slice.map((r) =>
      DroppedContentResponseSchema.parse({
        dropId: r.dropId,
        edition: env.EDITION,
        inputKind: r.inputKind,
        sourceDomainOrLabel: r.sourceDomainOrLabel,
        title: r.title,
        cefrEstimate: r.cefrEstimate,
        detectedTopics: r.detectedTopicsJson,
        extractedPhrases: r.extractedPhrasesJson,
        drillPayload: r.drillPayloadJson,
        createdAt: r.createdAt.toISOString(),
      }),
    );

    const nextCursor = hasMore ? slice[slice.length - 1]!.createdAt.toISOString() : null;
    return c.json(DropHistoryResponseSchema.parse({ items, nextCursor }), 200);
  });

  const getDropRoute = createRoute({
    method: 'get',
    path: '/v1/drop/{dropId}',
    request: {
      params: z.object({ dropId: z.string().uuid() }),
    },
    responses: {
      200: {
        description: 'Single dropped content item and micro-drill.',
        content: { 'application/json': { schema: DroppedContentResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      404: {
        description: 'Drop not found.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(getDropRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        {
          code: 'unauthorized' as const,
          message: 'Auth required',
          requestId: c.get('requestId'),
        },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const { dropId } = c.req.param();

    if (!db) {
      return c.json(
        {
          code: 'not_found' as const,
          message: 'Drop not found.',
          requestId: c.get('requestId'),
        },
        404,
      );
    }

    const [row] = await db
      .select()
      .from(droppedContents)
      .where(
        and(
          eq(droppedContents.dropId, dropId),
          eq(droppedContents.accountKey, accountKey),
          eq(droppedContents.edition, env.EDITION),
        ),
      )
      .limit(1);

    if (!row) {
      return c.json(
        {
          code: 'not_found' as const,
          message: 'Drop not found.',
          requestId: c.get('requestId'),
        },
        404,
      );
    }

    return c.json(
      DroppedContentResponseSchema.parse({
        dropId: row.dropId,
        edition: env.EDITION,
        inputKind: row.inputKind,
        sourceDomainOrLabel: row.sourceDomainOrLabel,
        title: row.title,
        cefrEstimate: row.cefrEstimate,
        detectedTopics: row.detectedTopicsJson,
        extractedPhrases: row.extractedPhrasesJson,
        drillPayload: row.drillPayloadJson,
        createdAt: row.createdAt.toISOString(),
      }),
      200,
    );
  });

  const deleteDropRoute = createRoute({
    method: 'delete',
    path: '/v1/drop/{dropId}',
    request: {
      params: z.object({ dropId: z.string().uuid() }),
    },
    responses: {
      200: {
        description: 'Deletes a user dropped study item and purges stored media objects.',
        content: {
          'application/json': {
            schema: z.object({ deleted: z.boolean(), dropId: z.string().uuid() }),
          },
        },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      404: {
        description: 'Drop not found.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(deleteDropRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const { dropId } = c.req.param();
    if (!db) {
      return c.json(
        { code: 'not_found' as const, message: 'Drop not found.', requestId: c.get('requestId') },
        404,
      );
    }
    const deleted = await db
      .delete(droppedContents)
      .where(
        and(
          eq(droppedContents.dropId, dropId),
          eq(droppedContents.accountKey, accountKey),
          eq(droppedContents.edition, env.EDITION),
        ),
      )
      .returning({
        dropId: droppedContents.dropId,
        mediaKeys: droppedContents.mediaObjectKeysJson,
      });

    const removed = deleted[0];
    if (!removed) {
      return c.json(
        { code: 'not_found' as const, message: 'Drop not found.', requestId: c.get('requestId') },
        404,
      );
    }
    const keys = Array.isArray(removed.mediaKeys)
      ? removed.mediaKeys.filter((k): k is string => typeof k === 'string' && k.length > 0)
      : [];
    if (keys.length > 0) {
      await deleteAudioObjects({
        client: internalS3,
        bucket: env.S3_BUCKET,
        objectKeys: keys,
      }).catch(() => {});
    }
    return c.json({ deleted: true, dropId: removed.dropId }, 200);
  });
}

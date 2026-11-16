import type { S3Client } from '@aws-sdk/client-s3';
import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import {
  ApiErrorSchema,
  PresignUploadRequestSchema,
  PresignUploadResponseSchema,
} from '@mockza/contracts';
import { audioAssets, type MockzaDb } from '@mockza/db';
import {
  buildAudioClipObjectKey,
  createAudioPresignUrl,
  createAudioS3Client,
  createPublicSigningS3Client,
  putObjectBuffer,
  type SupportedAudioContentType,
  signUploadProxyParams,
  verifyUploadProxySignature,
} from '@mockza/storage';
import { and, eq, ne } from 'drizzle-orm';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';

const ALLOWED_AUDIO_MIME = new Set<string>(['audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav']);

async function upsertAudioAssetRow(params: {
  db?: MockzaDb;
  objectKey: string;
  deviceId: string;
  attemptId: string;
  byteLength: number;
  ttlDays: number;
}): Promise<void> {
  if (!params.db) return;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + params.ttlDays * 24 * 60 * 60 * 1000);
  await params.db
    .insert(audioAssets)
    .values({
      objectKey: params.objectKey,
      deviceId: params.deviceId,
      attemptId: params.attemptId,
      byteLength: params.byteLength,
      expiresAt,
      purgedAt: null,
    })
    .onConflictDoUpdate({
      target: audioAssets.objectKey,
      set: {
        byteLength: params.byteLength,
        expiresAt,
        purgedAt: null,
      },
    });
}

function parseClipObjectKey(objectKey: string): { deviceId: string; attemptId: string } | null {
  const match = /^users\/([0-9a-f-]{36})\/clips\/([0-9a-f-]{36})\//i.exec(objectKey);
  if (!match?.[1] || !match[2]) return null;
  return { deviceId: match[1], attemptId: match[2] };
}

export function registerUploadRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
  s3Client?: S3Client,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db);
  app.use('/v1/uploads/presign', authMiddleware);

  const presignRoute = createRoute({
    method: 'post',
    path: '/v1/uploads/presign',
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: PresignUploadRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Upload URL and locked S3 object key.',
        content: { 'application/json': { schema: PresignUploadResponseSchema } },
      },
      400: {
        description: 'Validation error or audio exceeds max byte ceiling.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(presignRoute, async (c) => {
    const body = c.req.valid('json');
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required.', requestId: c.get('requestId') },
        401,
      );
    }

    const maxBytes = env.MAX_AUDIO_MB * 1024 * 1024;
    if (body.byteLength > maxBytes) {
      return c.json(
        {
          code: 'upload_too_large' as const,
          message: `Audio clip exceeds maximum allowed ${env.MAX_AUDIO_MB} MB.`,
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const contentType = body.contentType as SupportedAudioContentType;
    const expiresInSeconds = 300;
    const objectKey = buildAudioClipObjectKey({
      deviceId,
      attemptId: body.attemptId,
      partIndex: body.partIndex,
      contentType,
      turnId: body.turnId,
    });

    if (db) {
      const existingAssets = await db
        .select({ byteLength: audioAssets.byteLength })
        .from(audioAssets)
        .where(
          and(eq(audioAssets.attemptId, body.attemptId), ne(audioAssets.objectKey, objectKey)),
        );
      const aggregateBytes =
        existingAssets.reduce((sum, row) => sum + row.byteLength, 0) + body.byteLength;
      const maxAggregateBytes = maxBytes * 12;
      if (aggregateBytes > maxAggregateBytes) {
        return c.json(
          {
            code: 'upload_too_large' as const,
            message: `Aggregate attempt audio exceeds limit (${env.MAX_AUDIO_MB * 12} MB).`,
            requestId: c.get('requestId'),
          },
          400,
        );
      }
    }

    await upsertAudioAssetRow({
      db,
      objectKey,
      deviceId,
      attemptId: body.attemptId,
      byteLength: body.byteLength,
      ttlDays: env.AUDIO_TTL_DAYS,
    });

    if (env.S3_PUBLIC_MODE === 'proxy') {
      const expiresAtEpochSec = Math.floor(Date.now() / 1000) + expiresInSeconds;
      const sig = signUploadProxyParams({
        secret: env.JWT_SECRET,
        bucket: env.S3_BUCKET,
        objectKey,
        contentType,
        expiresAtEpochSec,
      });
      const qs = new URLSearchParams({
        key: objectKey,
        contentType,
        exp: String(expiresAtEpochSec),
        sig,
      });
      return c.json(
        {
          uploadUrl: `/v1/uploads/signed-put?${qs.toString()}`,
          objectKey,
          expiresInSeconds,
        },
        200,
      );
    }

    const publicClient = createPublicSigningS3Client(env);
    const res = await createAudioPresignUrl({
      client: publicClient,
      bucket: env.S3_BUCKET,
      deviceId,
      attemptId: body.attemptId,
      partIndex: body.partIndex,
      turnId: body.turnId,
      byteLength: body.byteLength,
      contentType,
      expiresInSeconds,
    });
    return c.json(res, 200);
  });

  // Same-origin signed PUT proxy writing directly into internal SeaweedFS S3
  app.put('/v1/uploads/signed-put', async (c) => {
    const objectKey = c.req.query('key') ?? '';
    const contentType = c.req.query('contentType') ?? 'audio/mp4';
    const expStr = c.req.query('exp') ?? '0';
    const sig = c.req.query('sig') ?? '';
    const maxBytes = env.MAX_AUDIO_MB * 1024 * 1024;

    const declaredLengthRaw = c.req.header('content-length');
    if (declaredLengthRaw) {
      const declaredLength = Number(declaredLengthRaw);
      if (!Number.isFinite(declaredLength) || declaredLength <= 0 || declaredLength > maxBytes) {
        return c.json(
          {
            code: 'payload_too_large',
            message: `Audio payload must be between 1 byte and ${env.MAX_AUDIO_MB} MB.`,
            requestId: c.get('requestId'),
          },
          400,
        );
      }
    }

    const expiresAtEpochSec = Number.parseInt(expStr, 10);
    if (!objectKey.startsWith('users/') || !ALLOWED_AUDIO_MIME.has(contentType)) {
      return c.json(
        {
          code: 'bad_request',
          message: 'Invalid upload parameters.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const valid = verifyUploadProxySignature({
      secret: env.JWT_SECRET,
      bucket: env.S3_BUCKET,
      objectKey,
      contentType,
      expiresAtEpochSec,
      signature: sig,
    });
    if (!valid) {
      return c.json(
        {
          code: 'forbidden',
          message: 'Expired or invalid upload signature.',
          requestId: c.get('requestId'),
        },
        403,
      );
    }

    const arrayBuf = await c.req.arrayBuffer();
    if (arrayBuf.byteLength === 0 || arrayBuf.byteLength > maxBytes) {
      return c.json(
        {
          code: 'payload_too_large',
          message: `Audio payload must be between 1 byte and ${env.MAX_AUDIO_MB} MB.`,
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const client = s3Client ?? createAudioS3Client(env);
    await putObjectBuffer({
      client,
      bucket: env.S3_BUCKET,
      objectKey,
      body: Buffer.from(arrayBuf),
      contentType,
    });

    const parsedKey = parseClipObjectKey(objectKey);
    if (parsedKey) {
      await upsertAudioAssetRow({
        db,
        objectKey,
        deviceId: parsedKey.deviceId,
        attemptId: parsedKey.attemptId,
        byteLength: arrayBuf.byteLength,
        ttlDays: env.AUDIO_TTL_DAYS,
      });
    }

    return c.json({ ok: true, objectKey, byteLength: arrayBuf.byteLength }, 200);
  });
}

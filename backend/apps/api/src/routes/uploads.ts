import type { S3Client } from '@aws-sdk/client-s3';
import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import {
  ApiErrorSchema,
  PresignUploadRequestSchema,
  PresignUploadResponseSchema,
} from '@mockza/contracts';
import type { MockzaDb } from '@mockza/db';
import {
  createAudioPresignUrl,
  createAudioS3Client,
  createPublicSigningS3Client,
  extensionForAudioContentType,
  putObjectBuffer,
  type SupportedAudioContentType,
  signUploadProxyParams,
  verifyUploadProxySignature,
} from '@mockza/storage';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';

const ALLOWED_AUDIO_MIME = new Set<string>(['audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav']);

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
    const ext = extensionForAudioContentType(contentType);
    const objectKey = `users/${deviceId}/clips/${body.attemptId}/part-${body.partIndex}.${ext}`;

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
    const maxBytes = env.MAX_AUDIO_MB * 1024 * 1024;
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

    return c.json({ ok: true, objectKey, byteLength: arrayBuf.byteLength }, 200);
  });
}

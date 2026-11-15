import { Readable } from 'node:stream';
import type { S3Client } from '@aws-sdk/client-s3';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import { createAudioS3Client, getMediaObject } from '@mockza/storage';
import type { RequestVariables } from '../middleware/request-id.js';

export function registerMediaRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  s3Client?: S3Client,
): void {
  app.get('/v1/media/*', async (c) => {
    const rawPath = c.req.path.replace(/^\/v1\/media\/?/, '');
    const objectKey = decodeURIComponent(rawPath);

    if (!objectKey || objectKey.includes('..') || objectKey.startsWith('/')) {
      return c.json(
        {
          code: 'invalid_media_key',
          message: 'Invalid media object key.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const client = s3Client ?? createAudioS3Client(env);
    const range = c.req.header('range');
    const obj = await getMediaObject({
      client,
      bucket: env.S3_MEDIA_BUCKET,
      objectKey,
      range,
    });

    if (!obj) {
      return c.json(
        {
          code: 'not_found',
          message: `Media asset not found: ${objectKey}`,
          requestId: c.get('requestId'),
        },
        404,
      );
    }

    const headers: Record<string, string> = {
      'Content-Type': obj.contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    };
    if (obj.contentLength > 0) {
      headers['Content-Length'] = String(obj.contentLength);
    }
    if (obj.contentRange) {
      headers['Content-Range'] = obj.contentRange;
    }
    if (obj.etag) {
      headers['ETag'] = obj.etag;
    }

    const webStream = Readable.toWeb(obj.body) as ReadableStream<Uint8Array>;
    return new Response(webStream, {
      status: obj.statusCode,
      headers,
    });
  });
}

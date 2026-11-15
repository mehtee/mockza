import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import type { Readable } from 'node:stream';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';

const MIME_BY_EXT: Record<string, string> = {
  '.m4a': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.webm': 'audio/webm',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
};

export function contentTypeFromKey(objectKey: string): string {
  const ext = extname(objectKey).toLowerCase();
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

export async function headObjectSafe(params: {
  client: S3Client;
  bucket: string;
  objectKey: string;
}): Promise<{ exists: boolean; contentLength?: number; contentType?: string; etag?: string }> {
  try {
    const head = await params.client.send(
      new HeadObjectCommand({
        Bucket: params.bucket,
        Key: params.objectKey,
      }),
    );
    return {
      exists: true,
      contentLength: head.ContentLength,
      contentType: head.ContentType,
      etag: head.ETag,
    };
  } catch {
    return { exists: false };
  }
}

export async function putObjectBuffer(params: {
  client: S3Client;
  bucket: string;
  objectKey: string;
  body: Uint8Array | Buffer;
  contentType: string;
  cacheControl?: string;
}): Promise<void> {
  await params.client.send(
    new PutObjectCommand({
      Bucket: params.bucket,
      Key: params.objectKey,
      Body: params.body,
      ContentType: params.contentType,
      CacheControl: params.cacheControl,
    }),
  );
}

export interface StreamedS3Object {
  statusCode: 200 | 206;
  body: Readable;
  contentType: string;
  contentLength: number;
  contentRange?: string;
  etag?: string;
}

export async function getMediaObject(params: {
  client: S3Client;
  bucket: string;
  objectKey: string;
  range?: string;
}): Promise<StreamedS3Object | null> {
  try {
    const res = await params.client.send(
      new GetObjectCommand({
        Bucket: params.bucket,
        Key: params.objectKey,
        ...(params.range ? { Range: params.range } : {}),
      }),
    );
    if (!res.Body) {
      return null;
    }
    return {
      statusCode: res.ContentRange ? 206 : 200,
      body: res.Body as Readable,
      contentType: res.ContentType ?? contentTypeFromKey(params.objectKey),
      contentLength: Number(res.ContentLength ?? 0),
      contentRange: res.ContentRange,
      etag: res.ETag,
    };
  } catch {
    return null;
  }
}

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

/** Uploads bundled starter audio and SVG chart media into SeaweedFS `mockza-media`. */
export async function seedMediaAssets(params: {
  client: S3Client;
  bucket: string;
  assetsDir: string;
}): Promise<{ uploaded: string[]; skipped: string[] }> {
  const files = await collectFiles(params.assetsDir);
  const uploaded: string[] = [];
  const skipped: string[] = [];

  for (const filePath of files) {
    const rel = relative(params.assetsDir, filePath).replaceAll('\\', '/');
    const objectKey = `media/${rel}`;
    const existing = await headObjectSafe({
      client: params.client,
      bucket: params.bucket,
      objectKey,
    });
    if (existing.exists && (existing.contentLength ?? 0) > 0) {
      skipped.push(objectKey);
      continue;
    }
    const bytes = await readFile(filePath);
    await putObjectBuffer({
      client: params.client,
      bucket: params.bucket,
      objectKey,
      body: bytes,
      contentType: contentTypeFromKey(objectKey),
      cacheControl: 'public, max-age=86400',
    });
    uploaded.push(objectKey);
  }

  return { uploaded, skipped };
}

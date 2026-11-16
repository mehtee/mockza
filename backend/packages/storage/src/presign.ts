import { createHmac, timingSafeEqual } from 'node:crypto';
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export type SupportedAudioContentType = 'audio/mp4' | 'audio/webm' | 'audio/ogg' | 'audio/wav';

export function extensionForAudioContentType(contentType: SupportedAudioContentType): string {
  switch (contentType) {
    case 'audio/webm':
      return 'webm';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/wav':
      return 'wav';
    case 'audio/mp4':
      return 'm4a';
  }
}

export interface AudioPresignResult {
  objectKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

/** Builds a deterministic, collision-free audio clip object key scoped to device, attempt, part, and optional turnId. */
export function buildAudioClipObjectKey(params: {
  deviceId: string;
  attemptId: string;
  partIndex: number;
  contentType?: SupportedAudioContentType;
  turnId?: string;
}): string {
  const ext = extensionForAudioContentType(params.contentType ?? 'audio/mp4');
  const safeTurn = params.turnId?.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName =
    safeTurn && safeTurn.length > 0
      ? `part-${params.partIndex}-${safeTurn}.${ext}`
      : `part-${params.partIndex}.${ext}`;
  return `users/${params.deviceId}/clips/${params.attemptId}/${fileName}`;
}

/** Creates an S3 presigned PUT URL (and locked objectKey) for private device audio uploads. */
export async function createAudioPresignUrl(params: {
  client: S3Client;
  bucket: string;
  deviceId: string;
  attemptId: string;
  partIndex: number;
  turnId?: string;
  byteLength: number;
  contentType?: SupportedAudioContentType;
  expiresInSeconds?: number;
}): Promise<AudioPresignResult> {
  const expiresInSeconds = params.expiresInSeconds ?? 300;
  const contentType = params.contentType ?? 'audio/mp4';
  const objectKey = buildAudioClipObjectKey({
    deviceId: params.deviceId,
    attemptId: params.attemptId,
    partIndex: params.partIndex,
    contentType,
    turnId: params.turnId,
  });

  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: objectKey,
    ContentType: contentType,
    ContentLength: params.byteLength,
  });

  const uploadUrl = await getSignedUrl(params.client, command, { expiresIn: expiresInSeconds });

  return {
    objectKey,
    uploadUrl,
    expiresInSeconds,
  };
}

/** Signs a same-origin API upload proxy URL so Web/mobile browsers bypass S3 CORS/localhost gaps. */
export function signUploadProxyParams(params: {
  secret: string;
  bucket: string;
  objectKey: string;
  contentType: string;
  expiresAtEpochSec: number;
  uploadGeneration?: number;
}): string {
  const genSuffix = params.uploadGeneration !== undefined ? `:gen=${params.uploadGeneration}` : '';
  const payload = `${params.bucket}:${params.objectKey}:${params.contentType}:${params.expiresAtEpochSec}${genSuffix}`;
  return createHmac('sha256', params.secret).update(payload).digest('hex');
}

export function verifyUploadProxySignature(params: {
  secret: string;
  bucket: string;
  objectKey: string;
  contentType: string;
  expiresAtEpochSec: number;
  signature: string;
  uploadGeneration?: number;
  nowEpochSec?: number;
}): boolean {
  const now = params.nowEpochSec ?? Math.floor(Date.now() / 1000);
  if (params.expiresAtEpochSec < now) {
    return false;
  }
  const expected = signUploadProxyParams({
    secret: params.secret,
    bucket: params.bucket,
    objectKey: params.objectKey,
    contentType: params.contentType,
    expiresAtEpochSec: params.expiresAtEpochSec,
    uploadGeneration: params.uploadGeneration,
  });
  const actualBuf = Buffer.from(params.signature, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');
  if (actualBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(actualBuf, expectedBuf);
}

import { HeadObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { DomainError } from '@mockza/domain';

export interface VerifyUploadedAudioParams {
  client: S3Client;
  bucket: string;
  objectKey: string;
  expectedDeviceId: string;
  maxBytes?: number;
}

export interface VerifyUploadedAudioResult {
  valid: boolean;
  byteLength: number;
  contentType?: string;
}

/**
 * Verifies that an audio clip was uploaded to S3/SeaweedFS before worker enqueue (B3.1).
 * Rejects spoofed keys, missing objects, 0-byte clips, or oversized files with standard domain errors.
 */
export async function verifyUploadedAudioObject(
  params: VerifyUploadedAudioParams,
): Promise<VerifyUploadedAudioResult> {
  const maxBytes = params.maxBytes ?? 5 * 1024 * 1024;
  const expectedPrefix = `users/${params.expectedDeviceId}/clips/`;

  // Prevent spoofing other users' audio clips
  if (!params.objectKey.startsWith(expectedPrefix)) {
    throw new DomainError(
      'unauthorized',
      `Object key ${params.objectKey} does not belong to device ${params.expectedDeviceId}`,
      403,
    );
  }

  try {
    const head = await params.client.send(
      new HeadObjectCommand({
        Bucket: params.bucket,
        Key: params.objectKey,
      }),
    );

    const byteLength = head.ContentLength ?? 0;
    if (byteLength === 0) {
      throw new DomainError('validation_error', 'Uploaded audio object is 0 bytes.', 400);
    }

    if (byteLength > maxBytes) {
      throw new DomainError(
        'upload_too_large',
        `Audio object exceeds maximum allowed size of ${maxBytes} bytes (actual: ${byteLength}).`,
        400,
      );
    }

    return {
      valid: true,
      byteLength,
      contentType: head.ContentType,
    };
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;
    }
    // S3 HeadObject returns NotFound or NoSuchKey
    const s3Error = error as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (s3Error.name === 'NotFound' || s3Error.$metadata?.httpStatusCode === 404) {
      throw new DomainError(
        'upload_not_found',
        `Audio object ${params.objectKey} was not found in bucket ${params.bucket}.`,
        404,
      );
    }
    throw new DomainError(
      'internal_error',
      `Failed to verify audio object: ${(error as Error).message}`,
      500,
    );
  }
}

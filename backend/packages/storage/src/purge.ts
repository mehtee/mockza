import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
  type S3Client,
} from '@aws-sdk/client-s3';
import { audioAssets, type MockzaDb } from '@mockza/db';
import { and, inArray, isNull, lte } from 'drizzle-orm';

/** Deletes a batch of S3 objects in chunks of 1,000 (S3 API limit). */
export async function deleteAudioObjects(params: {
  client: S3Client;
  bucket: string;
  objectKeys: readonly string[];
}): Promise<number> {
  if (params.objectKeys.length === 0) return 0;

  const chunkSize = 1000;
  let totalDeleted = 0;

  for (let i = 0; i < params.objectKeys.length; i += chunkSize) {
    const chunk = params.objectKeys.slice(i, i + chunkSize);
    await params.client.send(
      new DeleteObjectsCommand({
        Bucket: params.bucket,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
    totalDeleted += chunk.length;
  }

  return totalDeleted;
}

/** Purges all audio clips under users/${deviceId}/ upon account deletion (DELETE /v1/account). */
export async function deleteAllUserAudio(params: {
  client: S3Client;
  bucket: string;
  deviceId: string;
}): Promise<number> {
  const prefix = `users/${params.deviceId}/`;
  let totalDeleted = 0;
  let continuationToken: string | undefined;

  do {
    const listRes: ListObjectsV2CommandOutput = await params.client.send(
      new ListObjectsV2Command({
        Bucket: params.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    const contents = listRes.Contents ?? [];
    const keys = contents.map((item) => item.Key).filter((key): key is string => Boolean(key));
    if (keys.length > 0) {
      totalDeleted += await deleteAudioObjects({
        client: params.client,
        bucket: params.bucket,
        objectKeys: keys,
      });
    }

    continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;
  } while (continuationToken);

  return totalDeleted;
}

/** Batch purges expired audio assets from S3 and marks them purgedAt in PostgreSQL (B3.1). */
export async function batchPurgeExpiredAudioAssets(params: {
  client: S3Client;
  bucket: string;
  db: MockzaDb;
  batchSize?: number;
  now?: Date;
}): Promise<number> {
  const now = params.now ?? new Date();
  const limit = params.batchSize ?? 1000;

  const expiredRows = await params.db
    .select({ objectKey: audioAssets.objectKey })
    .from(audioAssets)
    .where(and(lte(audioAssets.expiresAt, now), isNull(audioAssets.purgedAt)))
    .limit(limit);

  if (expiredRows.length === 0) {
    return 0;
  }

  const keys = expiredRows.map((r) => r.objectKey);
  await deleteAudioObjects({
    client: params.client,
    bucket: params.bucket,
    objectKeys: keys,
  });

  await params.db
    .update(audioAssets)
    .set({ purgedAt: now })
    .where(inArray(audioAssets.objectKey, keys));

  return keys.length;
}

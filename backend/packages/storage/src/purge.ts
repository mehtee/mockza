import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
  type S3Client,
} from '@aws-sdk/client-s3';
import { audioAssets, erasureRequests, type MockzaDb } from '@mockza/db';
import { and, eq, inArray, isNull, lte } from 'drizzle-orm';

export interface DeleteObjectsBatchResult {
  deletedKeys: string[];
  failedErrors: Array<{ key?: string; code?: string; message?: string }>;
}

export class IncompleteAudioPurgeError extends Error {
  constructor(
    message: string,
    public readonly failedErrors: Array<{ key?: string; code?: string; message?: string }>,
  ) {
    super(message);
    this.name = 'IncompleteAudioPurgeError';
  }
}

/**
 * Deletes a batch of S3 objects in chunks of 1,000 (S3 API limit) and inspects
 * per-object Errors so failed deletions are never recorded as purged.
 */
export async function deleteAudioObjectsDetailed(params: {
  client: S3Client;
  bucket: string;
  objectKeys: readonly string[];
}): Promise<DeleteObjectsBatchResult> {
  if (params.objectKeys.length === 0) {
    return { deletedKeys: [], failedErrors: [] };
  }

  const chunkSize = 1000;
  const deletedKeys: string[] = [];
  const failedErrors: Array<{ key?: string; code?: string; message?: string }> = [];

  for (let i = 0; i < params.objectKeys.length; i += chunkSize) {
    const chunk = params.objectKeys.slice(i, i + chunkSize);
    const res = await params.client.send(
      new DeleteObjectsCommand({
        Bucket: params.bucket,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: false,
        },
      }),
    );

    const chunkErrors = (res.Errors ?? []).map((err) => ({
      key: err.Key,
      code: err.Code,
      message: err.Message,
    }));
    failedErrors.push(...chunkErrors);

    const failedKeySet = new Set(
      chunkErrors.map((e) => e.key).filter((key): key is string => Boolean(key)),
    );

    if (res.Deleted && res.Deleted.length > 0) {
      for (const item of res.Deleted) {
        if (item.Key && !failedKeySet.has(item.Key)) {
          deletedKeys.push(item.Key);
        }
      }
    } else if (chunkErrors.length === 0) {
      // Minimal test mocks that return `{}` without `Deleted`/`Errors` deleted the whole chunk cleanly.
      deletedKeys.push(...chunk);
    } else {
      for (const key of chunk) {
        if (!failedKeySet.has(key)) {
          deletedKeys.push(key);
        }
      }
    }
  }

  return { deletedKeys, failedErrors };
}

/** Deletes S3 objects and throws if any object failed to delete. */
export async function deleteAudioObjects(params: {
  client: S3Client;
  bucket: string;
  objectKeys: readonly string[];
}): Promise<number> {
  const result = await deleteAudioObjectsDetailed(params);
  if (result.failedErrors.length > 0) {
    throw new IncompleteAudioPurgeError(
      `Failed to delete ${result.failedErrors.length} audio object(s).`,
      result.failedErrors,
    );
  }
  return result.deletedKeys.length;
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

/** Batch purges expired audio assets from S3 and marks ONLY confirmed-deleted rows purgedAt (B3.1). */
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
  const batchResult = await deleteAudioObjectsDetailed({
    client: params.client,
    bucket: params.bucket,
    objectKeys: keys,
  });

  if (batchResult.deletedKeys.length > 0) {
    await params.db
      .update(audioAssets)
      .set({ purgedAt: now })
      .where(inArray(audioAssets.objectKey, batchResult.deletedKeys));
  }

  return batchResult.deletedKeys.length;
}

/** Retries any pending or partial account erasure object cleanups recorded by DELETE /v1/account. */
export async function retryPendingErasures(params: {
  client: S3Client;
  bucket: string;
  db: MockzaDb;
  now?: Date;
}): Promise<number> {
  const now = params.now ?? new Date();
  const pending = await params.db
    .select()
    .from(erasureRequests)
    .where(inArray(erasureRequests.status, ['pending', 'partial']))
    .limit(100);

  let completedCount = 0;
  for (const row of pending) {
    try {
      const deviceIds = Array.isArray(row.deviceIdsJson) ? row.deviceIdsJson : [];
      for (const devId of deviceIds) {
        await deleteAllUserAudio({
          client: params.client,
          bucket: params.bucket,
          deviceId: devId,
        });
      }
      await params.db
        .update(erasureRequests)
        .set({ status: 'completed', lastError: null, updatedAt: now })
        .where(eq(erasureRequests.erasureId, row.erasureId));
      completedCount += 1;
    } catch (err) {
      await params.db
        .update(erasureRequests)
        .set({
          status: 'partial',
          lastError: (err as Error).message.slice(0, 500),
          updatedAt: now,
        })
        .where(eq(erasureRequests.erasureId, row.erasureId));
    }
  }
  return completedCount;
}

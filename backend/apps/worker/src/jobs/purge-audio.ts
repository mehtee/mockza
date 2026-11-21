import type { S3Client } from '@aws-sdk/client-s3';
import type { MockzaDb } from '@mockza/db';
import {
  batchPurgeExpiredAudioAssets,
  batchPurgeExpiredDropMedia,
  retryPendingErasures,
} from '@mockza/storage';

export const PURGE_AUDIO_QUEUE = 'maintenance.purge-audio';

export async function handlePurgeAudioJob(params: {
  db: MockzaDb;
  s3Client: S3Client;
  bucket: string;
}): Promise<number> {
  const purgedCount = await batchPurgeExpiredAudioAssets({
    client: params.s3Client,
    bucket: params.bucket,
    db: params.db,
  });

  const purgedDropMedia = await batchPurgeExpiredDropMedia({
    client: params.s3Client,
    bucket: params.bucket,
    db: params.db,
  });

  const completedErasures = await retryPendingErasures({
    client: params.s3Client,
    bucket: params.bucket,
    db: params.db,
  });

  if (purgedCount > 0 || purgedDropMedia > 0 || completedErasures > 0) {
    process.stdout.write(
      `maintenance.purge-audio: purged ${purgedCount} audio assets, ${purgedDropMedia} drop media objects, completed ${completedErasures} pending erasures.\n`,
    );
  }

  return purgedCount + purgedDropMedia;
}

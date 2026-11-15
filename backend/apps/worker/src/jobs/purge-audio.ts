import type { S3Client } from '@aws-sdk/client-s3';
import type { MockzaDb } from '@mockza/db';
import { batchPurgeExpiredAudioAssets } from '@mockza/storage';

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

  if (purgedCount > 0) {
    process.stdout.write(`maintenance.purge-audio: purged ${purgedCount} expired audio assets.\n`);
  }

  return purgedCount;
}

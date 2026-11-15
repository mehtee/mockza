import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '@mockza/config';
import { configureBucketCors, ensureBuckets } from './buckets.js';
import { seedMediaAssets } from './media.js';
import { createAudioS3Client } from './s3-client.js';

async function initBucketsAndMedia(): Promise<void> {
  const env = loadEnv();
  const s3Client = createAudioS3Client(env);
  const buckets = Array.from(new Set([env.S3_BUCKET, env.S3_MEDIA_BUCKET]));

  await ensureBuckets(s3Client, buckets);
  for (const bucket of buckets) {
    await configureBucketCors(s3Client, bucket);
  }

  const assetCandidates = [
    process.env['MEDIA_SEED_DIR'],
    fileURLToPath(new URL('./seed-assets', import.meta.url)),
    fileURLToPath(new URL('../seed-assets', import.meta.url)),
  ].filter((value): value is string => Boolean(value));

  const assetsDir = assetCandidates.find((dir) => existsSync(dir));
  if (assetsDir) {
    const result = await seedMediaAssets({
      client: s3Client,
      bucket: env.S3_MEDIA_BUCKET,
      assetsDir,
    });
    process.stdout.write(
      `mockza-s3 initialized buckets [${buckets.join(', ')}] and media seed: ${JSON.stringify(result)}\n`,
    );
  } else {
    process.stdout.write(
      `mockza-s3 initialized buckets [${buckets.join(', ')}] (no seed-assets dir)\n`,
    );
  }
}

await initBucketsAndMedia();

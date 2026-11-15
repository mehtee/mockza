import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  type S3Client,
} from '@aws-sdk/client-s3';

/** Ensures each named bucket exists in SeaweedFS/S3 without failing when already present. */
export async function ensureBuckets(
  client: S3Client,
  buckets: readonly string[],
): Promise<readonly string[]> {
  const created: string[] = [];
  for (const bucket of buckets) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
      created.push(bucket);
    }
  }
  return created;
}

/** Configures standard permissive CORS rules for mobile and web browser clients. */
export async function configureBucketCors(client: S3Client, bucket: string): Promise<void> {
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ['*'],
              AllowedMethods: ['GET', 'PUT', 'HEAD', 'POST'],
              AllowedOrigins: ['*'],
              ExposeHeaders: ['ETag', 'Content-Length'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
  } catch (_error) {
    // SeaweedFS or mock environments may not support PutBucketCors, safe to ignore
  }
}

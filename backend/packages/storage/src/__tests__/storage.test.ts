import { describe, expect, it } from 'vitest';
import {
  createAudioPresignUrl,
  signUploadProxyParams,
  verifyUploadProxySignature,
} from '../presign.js';
import { createAudioS3Client, createPublicSigningS3Client } from '../s3-client.js';
import { verifyUploadedAudioObject } from '../verify.js';

describe('@mockza/storage S3 operations', () => {
  const dummyEnv = {
    S3_ENDPOINT: 'http://localhost:45833',
    S3_PUBLIC_ENDPOINT: 'http://192.168.1.100:45833',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY: 'test-access',
    S3_SECRET_KEY: 'test-secret',
  };

  it('creates dual internal and signing S3 clients', () => {
    const internal = createAudioS3Client(dummyEnv);
    const signing = createPublicSigningS3Client(dummyEnv);
    expect(internal).toBeDefined();
    expect(signing).toBeDefined();
  });

  it('creates presigned URL with locked key format users/${deviceId}/clips/${attemptId}/part-${partIndex}.m4a', async () => {
    const client = createAudioS3Client(dummyEnv);
    const res = await createAudioPresignUrl({
      client,
      bucket: 'mockza-audio-private',
      deviceId: '11111111-1111-1111-1111-111111111111',
      attemptId: '22222222-2222-2222-2222-222222222222',
      partIndex: 1,
      byteLength: 1024 * 500,
    });

    expect(res.objectKey).toBe(
      'users/11111111-1111-1111-1111-111111111111/clips/22222222-2222-2222-2222-222222222222/part-1.m4a',
    );
    expect(res.expiresInSeconds).toBe(300);
    expect(res.uploadUrl).toContain('mockza-audio-private');
  });

  it('rejects spoofed device object keys during verification', async () => {
    const client = createAudioS3Client(dummyEnv);
    await expect(
      verifyUploadedAudioObject({
        client,
        bucket: 'mockza-audio-private',
        objectKey: 'users/other-device/clips/attempt/part-1.m4a',
        expectedDeviceId: 'my-device',
      }),
    ).rejects.toThrow('does not belong to device');
  });

  it('signs and verifies HMAC upload proxy parameters', () => {
    const exp = Math.floor(Date.now() / 1000) + 120;
    const sig = signUploadProxyParams({
      secret: 'super-secret-key',
      bucket: 'mockza-audio-private',
      objectKey: 'users/dev/clips/att/part-1.webm',
      contentType: 'audio/webm',
      expiresAtEpochSec: exp,
    });
    expect(
      verifyUploadProxySignature({
        secret: 'super-secret-key',
        bucket: 'mockza-audio-private',
        objectKey: 'users/dev/clips/att/part-1.webm',
        contentType: 'audio/webm',
        expiresAtEpochSec: exp,
        signature: sig,
      }),
    ).toBe(true);
  });
});

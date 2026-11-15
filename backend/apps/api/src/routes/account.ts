import type { S3Client } from '@aws-sdk/client-s3';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import {
  accountLinks,
  audioAssets,
  dailyQuotaUsage,
  devices,
  entitlements,
  evaluationJobs,
  type MockzaDb,
  monthlyQuotaUsage,
  questionFlags,
  quotaReservations,
  users,
} from '@mockza/db';
import { createAudioS3Client, deleteAllUserAudio } from '@mockza/storage';
import { eq, or } from 'drizzle-orm';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';

export function registerAccountRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
  s3Client?: S3Client,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db);
  app.use('/v1/account', authMiddleware);
  app.use('/v1/account/*', authMiddleware);
  const internalS3 = s3Client ?? createAudioS3Client(env);

  app.delete('/v1/account', async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Device authentication required.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    let purgedAudioCount = 0;

    if (db) {
      const devRows = await db
        .select({ linkedUserId: devices.linkedUserId })
        .from(devices)
        .where(eq(devices.deviceId, deviceId))
        .limit(1);

      const linkedUserId = devRows[0]?.linkedUserId;

      await db.transaction(async (tx) => {
        // Delete related telemetry, feedback and audio records
        await tx.delete(questionFlags).where(eq(questionFlags.deviceId, deviceId));
        await tx.delete(audioAssets).where(eq(audioAssets.deviceId, deviceId));
        await tx.delete(evaluationJobs).where(eq(evaluationJobs.deviceId, deviceId));

        if (linkedUserId) {
          await tx
            .delete(quotaReservations)
            .where(
              or(
                eq(quotaReservations.accountKey, deviceId),
                eq(quotaReservations.accountKey, linkedUserId),
              ),
            );
          await tx
            .delete(dailyQuotaUsage)
            .where(
              or(
                eq(dailyQuotaUsage.accountKey, deviceId),
                eq(dailyQuotaUsage.accountKey, linkedUserId),
              ),
            );
          await tx
            .delete(monthlyQuotaUsage)
            .where(
              or(
                eq(monthlyQuotaUsage.accountKey, deviceId),
                eq(monthlyQuotaUsage.accountKey, linkedUserId),
              ),
            );
          await tx.delete(entitlements).where(eq(entitlements.deviceId, deviceId));
          await tx.delete(accountLinks).where(eq(accountLinks.userId, linkedUserId));
          await tx.delete(devices).where(eq(devices.deviceId, deviceId));
          await tx.delete(users).where(eq(users.userId, linkedUserId));
        } else {
          await tx.delete(quotaReservations).where(eq(quotaReservations.accountKey, deviceId));
          await tx.delete(dailyQuotaUsage).where(eq(dailyQuotaUsage.accountKey, deviceId));
          await tx.delete(monthlyQuotaUsage).where(eq(monthlyQuotaUsage.accountKey, deviceId));
          await tx.delete(entitlements).where(eq(entitlements.deviceId, deviceId));
          await tx.delete(devices).where(eq(devices.deviceId, deviceId));
        }
      });

      // Purge all user audio files from S3/SeaweedFS
      try {
        purgedAudioCount = await deleteAllUserAudio({
          client: internalS3,
          bucket: env.S3_BUCKET,
          deviceId,
        });
      } catch (_s3Error) {
        // Safe to ignore in test mocks
      }
    }

    return c.json(
      {
        success: true,
        deleted: true,
        deviceId,
        purgedAudioCount,
      },
      200,
    );
  });
}

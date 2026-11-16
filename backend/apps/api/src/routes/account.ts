import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import {
  accountLinks,
  audioAssets,
  dailyQuotaUsage,
  devices,
  entitlements,
  erasureRequests,
  evaluationJobs,
  type MockzaDb,
  monthlyQuotaUsage,
  questionFlags,
  quotaReservations,
  users,
} from '@mockza/db';
import { createAudioS3Client, deleteAllUserAudio } from '@mockza/storage';
import { eq, inArray, or, sql } from 'drizzle-orm';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';

function hashReceiptToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function verifyReceiptHash(token: string | undefined, expectedHex: string | null): boolean {
  if (!token || !expectedHex) return false;
  const actual = Buffer.from(hashReceiptToken(token), 'utf8');
  const expected = Buffer.from(expectedHex, 'utf8');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

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

      const linkedUserId = devRows[0]?.linkedUserId ?? null;
      let affectedDeviceIds: string[] = [deviceId];

      if (linkedUserId) {
        const linkedDevs = await db
          .select({ deviceId: devices.deviceId })
          .from(devices)
          .where(eq(devices.linkedUserId, linkedUserId));
        const set = new Set<string>([deviceId, ...linkedDevs.map((d) => d.deviceId)]);
        affectedDeviceIds = Array.from(set);
      }

      const accountKeys = linkedUserId
        ? [...affectedDeviceIds, linkedUserId]
        : [...affectedDeviceIds];
      const erasureId = randomUUID();
      const receiptToken = randomBytes(24).toString('base64url');
      const receiptTokenHash = hashReceiptToken(receiptToken);

      await db.transaction(async (tx) => {
        // Fence active signed uploads immediately before removing device rows (`RR-06`).
        await tx
          .update(devices)
          .set({
            erasingAt: new Date(),
            uploadGeneration: sql`${devices.uploadGeneration} + 1`,
          })
          .where(inArray(devices.deviceId, affectedDeviceIds));

        await tx.insert(erasureRequests).values({
          erasureId,
          accountKey: linkedUserId ?? deviceId,
          deviceIdsJson: affectedDeviceIds,
          status: 'pending',
          receiptTokenHash,
        });

        await tx.delete(questionFlags).where(inArray(questionFlags.deviceId, affectedDeviceIds));
        await tx.delete(audioAssets).where(inArray(audioAssets.deviceId, affectedDeviceIds));
        await tx
          .delete(evaluationJobs)
          .where(
            or(
              inArray(evaluationJobs.deviceId, affectedDeviceIds),
              inArray(evaluationJobs.accountKey, accountKeys),
            ),
          );
        await tx
          .delete(quotaReservations)
          .where(inArray(quotaReservations.accountKey, accountKeys));
        await tx.delete(dailyQuotaUsage).where(inArray(dailyQuotaUsage.accountKey, accountKeys));
        await tx
          .delete(monthlyQuotaUsage)
          .where(inArray(monthlyQuotaUsage.accountKey, accountKeys));

        if (linkedUserId) {
          await tx
            .delete(entitlements)
            .where(
              or(
                inArray(entitlements.deviceId, affectedDeviceIds),
                eq(entitlements.userId, linkedUserId),
              ),
            );
          await tx.delete(accountLinks).where(eq(accountLinks.userId, linkedUserId));
          await tx.delete(devices).where(inArray(devices.deviceId, affectedDeviceIds));
          await tx.delete(users).where(eq(users.userId, linkedUserId));
        } else {
          await tx.delete(entitlements).where(inArray(entitlements.deviceId, affectedDeviceIds));
          await tx.delete(devices).where(inArray(devices.deviceId, affectedDeviceIds));
        }
      });

      // Purge all S3 audio across every affected device; never swallow errors.
      try {
        for (const targetDevId of affectedDeviceIds) {
          purgedAudioCount += await deleteAllUserAudio({
            client: internalS3,
            bucket: env.S3_BUCKET,
            deviceId: targetDevId,
          });
        }
        await db
          .update(erasureRequests)
          .set({ status: 'completed', lastError: null, updatedAt: new Date() })
          .where(eq(erasureRequests.erasureId, erasureId));
      } catch (s3Error) {
        await db
          .update(erasureRequests)
          .set({
            status: 'partial',
            lastError: (s3Error as Error).message.slice(0, 500),
            updatedAt: new Date(),
          })
          .where(eq(erasureRequests.erasureId, erasureId));

        return c.json(
          {
            code: 'erasure_incomplete',
            message:
              'Account records were erased, but media storage deletion failed and has been queued for retry.',
            requestId: c.get('requestId'),
            erasureId,
            receiptToken,
          },
          503,
        );
      }
    } else if (s3Client) {
      purgedAudioCount = await deleteAllUserAudio({
        client: s3Client,
        bucket: env.S3_BUCKET,
        deviceId,
      });
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

  // Receipt-authenticated erasure status & resume endpoint usable after device credentials are deleted (`RR-05`).
  app.get('/v1/erasure/:erasureId', async (c) => {
    const erasureId = c.req.param('erasureId');
    const receipt = c.req.header('x-erasure-receipt');
    if (!db) {
      return c.json({ code: 'not_found', message: 'Erasure store unavailable.' }, 404);
    }
    const [row] = await db
      .select()
      .from(erasureRequests)
      .where(eq(erasureRequests.erasureId, erasureId))
      .limit(1);
    if (!row || !verifyReceiptHash(receipt, row.receiptTokenHash)) {
      return c.json({ code: 'unauthorized', message: 'Invalid or missing erasure receipt.' }, 401);
    }
    return c.json({
      erasureId: row.erasureId,
      status: row.status,
      completed: row.status === 'completed',
    });
  });

  app.post('/v1/erasure/:erasureId/retry', async (c) => {
    const erasureId = c.req.param('erasureId');
    const receipt = c.req.header('x-erasure-receipt');
    if (!db) {
      return c.json({ code: 'not_found', message: 'Erasure store unavailable.' }, 404);
    }
    const [row] = await db
      .select()
      .from(erasureRequests)
      .where(eq(erasureRequests.erasureId, erasureId))
      .limit(1);
    if (!row || !verifyReceiptHash(receipt, row.receiptTokenHash)) {
      return c.json({ code: 'unauthorized', message: 'Invalid or missing erasure receipt.' }, 401);
    }
    if (row.status === 'completed') {
      return c.json({ success: true, erasureId: row.erasureId, status: 'completed' }, 200);
    }

    let purgedAudioCount = 0;
    try {
      for (const targetDevId of row.deviceIdsJson) {
        purgedAudioCount += await deleteAllUserAudio({
          client: internalS3,
          bucket: env.S3_BUCKET,
          deviceId: targetDevId,
        });
      }
      await db
        .update(erasureRequests)
        .set({ status: 'completed', lastError: null, updatedAt: new Date() })
        .where(eq(erasureRequests.erasureId, erasureId));

      return c.json(
        { success: true, erasureId: row.erasureId, status: 'completed', purgedAudioCount },
        200,
      );
    } catch (s3Error) {
      await db
        .update(erasureRequests)
        .set({
          status: 'partial',
          lastError: (s3Error as Error).message.slice(0, 500),
          updatedAt: new Date(),
        })
        .where(eq(erasureRequests.erasureId, erasureId));

      return c.json(
        {
          code: 'erasure_incomplete',
          message: 'Media storage deletion still incomplete; retry with receipt.',
          requestId: c.get('requestId'),
          erasureId,
        },
        503,
      );
    }
  });
}

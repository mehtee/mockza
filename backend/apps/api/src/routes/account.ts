import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import {
  AccountSessionsResponseSchema,
  AccountUserSchema,
  RevokeDeviceSessionResponseSchema,
} from '@mockza/contracts';
import {
  accountLinks,
  aiUsageLedger,
  audioAssets,
  dailyMissions,
  dailyQuotaUsage,
  devices,
  droppedContents,
  entitlements,
  erasureRequests,
  evaluationJobs,
  learnerBandEvents,
  learnerProfiles,
  learnerRoadmapPlans,
  learnerTopicWeaknessCoverage,
  linguisticEvidenceEvents,
  linguisticNodes,
  type MockzaDb,
  monthlyQuotaUsage,
  pronunciationPractices,
  questionFlags,
  quotaReservations,
  userActivityLedger,
  userAttemptsSync,
  userDeviceSessions,
  userEntitlements,
  userVocabSrsSync,
  users,
} from '@mockza/db';
import { createAudioS3Client, deleteAllUserAudio } from '@mockza/storage';
import { eq, inArray, or, sql } from 'drizzle-orm';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';
import {
  AuthActionError,
  createSessionManager,
  type SessionManager,
} from '../services/session-manager.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  sessionManagerArg?: SessionManager,
): void {
  const sessionManager = sessionManagerArg ?? createSessionManager(env, db);
  const authMiddleware = createDeviceAuthMiddleware(env, db, sessionManager);
  app.use('/v1/account', authMiddleware);
  app.use('/v1/account/*', authMiddleware);
  const internalS3 = s3Client ?? createAudioS3Client(env);

  async function resolveLinkedUserId(
    deviceId: string,
    contextUserId?: string | null,
  ): Promise<string | null> {
    if (contextUserId) return contextUserId;
    if (db) {
      const [row] = await db
        .select({ linkedUserId: devices.linkedUserId })
        .from(devices)
        .where(eq(devices.deviceId, deviceId))
        .limit(1);
      return row?.linkedUserId ?? null;
    }
    return sessionManager.resolveMemoryDeviceState(deviceId)?.linkedUserId ?? null;
  }

  // GET /v1/account/me & GET /v1/account/devices (Signed-in user + active sessions list)
  app.get('/v1/account/me', async (c) => {
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
    const userId = await resolveLinkedUserId(deviceId, c.get('userId'));
    const payload = await sessionManager.getAccountSessions({ deviceId, userId });
    return c.json(AccountSessionsResponseSchema.parse(payload), 200);
  });

  app.get('/v1/account/devices', async (c) => {
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
    const userId = await resolveLinkedUserId(deviceId, c.get('userId'));
    const payload = await sessionManager.getAccountSessions({ deviceId, userId });
    return c.json(AccountSessionsResponseSchema.parse(payload), 200);
  });

  // POST /v1/account/devices/revoke-others (Sign out all other devices immediately)
  app.post('/v1/account/devices/revoke-others', async (c) => {
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
    const userId = await resolveLinkedUserId(deviceId, c.get('userId'));
    if (!userId) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Sign in with an account to manage signed-in devices.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }
    const outcome = await sessionManager.terminateOtherSessions({
      callerDeviceId: deviceId,
      userId,
    });
    return c.json(
      RevokeDeviceSessionResponseSchema.parse({
        success: true,
        revokedDeviceIds: outcome.revokedDeviceIds,
        signedOutCurrentDevice: false,
        sessions: outcome.sessions,
      }),
      200,
    );
  });

  // DELETE /v1/account/devices/:targetDeviceId (Terminate one active device session & vacate slot)
  app.delete('/v1/account/devices/:targetDeviceId', async (c) => {
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
    const targetDeviceId = c.req.param('targetDeviceId');
    if (!UUID_REGEX.test(targetDeviceId)) {
      return c.json(
        {
          code: 'validation_error',
          message: 'Invalid target device UUID.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }
    const userId = await resolveLinkedUserId(deviceId, c.get('userId'));
    if (!userId) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Sign in with an account to manage signed-in devices.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    try {
      const outcome = await sessionManager.terminateDeviceSession({
        callerDeviceId: deviceId,
        userId,
        targetDeviceId,
      });
      return c.json(
        RevokeDeviceSessionResponseSchema.parse({
          success: true,
          ...outcome,
        }),
        200,
      );
    } catch (err) {
      if (err instanceof AuthActionError) {
        return c.json(
          { code: err.code, message: err.message, requestId: c.get('requestId') },
          err.status,
        );
      }
      throw err;
    }
  });

  // POST /v1/account/device-policy-consent (Record explicit 1-phone + 1-desktop-web ToS consent)
  app.post('/v1/account/device-policy-consent', async (c) => {
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
    const userId = await resolveLinkedUserId(deviceId, c.get('userId'));
    if (!userId) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Sign in with an account before subscribing.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }
    const user = await sessionManager.recordDevicePolicyConsent({ userId });
    return c.json(AccountUserSchema.parse(user), 200);
  });

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
    let erasureReceipt: { erasureId: string; receiptToken: string } | undefined;

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
      erasureReceipt = { erasureId, receiptToken };

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

        await tx
          .delete(linguisticEvidenceEvents)
          .where(inArray(linguisticEvidenceEvents.accountKey, accountKeys));
        await tx
          .delete(linguisticNodes)
          .where(inArray(linguisticNodes.accountKey, accountKeys));
        await tx.delete(dailyMissions).where(inArray(dailyMissions.accountKey, accountKeys));
        await tx.delete(droppedContents).where(inArray(droppedContents.accountKey, accountKeys));
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

        const anonymizedKey = `deleted:${createHash('sha256')
          .update(`${linkedUserId ?? deviceId}:${env.JWT_SECRET}`)
          .digest('hex')
          .slice(0, 24)}`;

        if (linkedUserId) {
          await tx
            .delete(entitlements)
            .where(
              or(
                inArray(entitlements.deviceId, affectedDeviceIds),
                eq(entitlements.userId, linkedUserId),
              ),
            );
          await tx.delete(learnerRoadmapPlans).where(inArray(learnerRoadmapPlans.accountKey, accountKeys));
          await tx.delete(learnerProfiles).where(inArray(learnerProfiles.accountKey, accountKeys));
          await tx.delete(learnerBandEvents).where(inArray(learnerBandEvents.accountKey, accountKeys));
          await tx
            .delete(learnerTopicWeaknessCoverage)
            .where(inArray(learnerTopicWeaknessCoverage.accountKey, accountKeys));
          await tx.delete(pronunciationPractices).where(inArray(pronunciationPractices.accountKey, accountKeys));
          await tx.delete(userAttemptsSync).where(inArray(userAttemptsSync.accountKey, accountKeys));
          await tx.delete(userVocabSrsSync).where(inArray(userVocabSrsSync.accountKey, accountKeys));
          await tx.delete(userActivityLedger).where(inArray(userActivityLedger.accountKey, accountKeys));
          // Pseudonymize cost ledger instead of deleting so aggregate OpenRouter spend remains auditable
          await tx
            .update(aiUsageLedger)
            .set({ accountKey: anonymizedKey, deviceId: null, entityId: 'redacted' })
            .where(inArray(aiUsageLedger.accountKey, accountKeys));
          await tx.delete(userDeviceSessions).where(eq(userDeviceSessions.userId, linkedUserId));
          await tx.delete(userEntitlements).where(eq(userEntitlements.userId, linkedUserId));
          await tx.delete(accountLinks).where(eq(accountLinks.userId, linkedUserId));
          await tx.delete(devices).where(inArray(devices.deviceId, affectedDeviceIds));
          await tx.delete(users).where(eq(users.userId, linkedUserId));
        } else {
          await tx.delete(learnerRoadmapPlans).where(inArray(learnerRoadmapPlans.accountKey, accountKeys));
          await tx.delete(learnerProfiles).where(inArray(learnerProfiles.accountKey, accountKeys));
          await tx.delete(learnerBandEvents).where(inArray(learnerBandEvents.accountKey, accountKeys));
          await tx
            .delete(learnerTopicWeaknessCoverage)
            .where(inArray(learnerTopicWeaknessCoverage.accountKey, accountKeys));
          await tx.delete(pronunciationPractices).where(inArray(pronunciationPractices.accountKey, accountKeys));
          await tx.delete(userAttemptsSync).where(inArray(userAttemptsSync.accountKey, accountKeys));
          await tx.delete(userVocabSrsSync).where(inArray(userVocabSrsSync.accountKey, accountKeys));
          await tx.delete(userActivityLedger).where(inArray(userActivityLedger.accountKey, accountKeys));
          await tx
            .update(aiUsageLedger)
            .set({ accountKey: anonymizedKey, deviceId: null, entityId: 'redacted' })
            .where(inArray(aiUsageLedger.accountKey, accountKeys));
          await tx.delete(entitlements).where(inArray(entitlements.deviceId, affectedDeviceIds));
          await tx.delete(devices).where(inArray(devices.deviceId, affectedDeviceIds));
        }
      });

      sessionManager.wipeMemoryForAccount({ deviceIds: affectedDeviceIds, userId: linkedUserId });

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
    } else {
      if (s3Client) {
        purgedAudioCount = await deleteAllUserAudio({
          client: s3Client,
          bucket: env.S3_BUCKET,
          deviceId,
        });
      }
      const linkedUserId = c.get('userId') ?? null;
      sessionManager.wipeMemoryForAccount({ deviceIds: [deviceId], userId: linkedUserId });
    }

    return c.json(
      {
        success: true,
        deleted: true,
        deviceId,
        purgedAudioCount,
        ...erasureReceipt,
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

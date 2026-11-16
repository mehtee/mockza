import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import {
  AnonymousAuthRequestSchema,
  AnonymousAuthResponseSchema,
  LinkAccountRequestSchema,
  LinkAccountResponseSchema,
} from '@mockza/contracts';
import { accountLinks, devices, entitlements, type MockzaDb, users } from '@mockza/db';
import { and, eq, sql } from 'drizzle-orm';
import { verify } from 'hono/jwt';
import type { ChallengeStore } from '../middleware/attest.js';
import {
  createDeviceAuthMiddleware,
  signDeviceToken,
  type TokenPayload,
} from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';
import {
  ProviderTokenError,
  type VerifyProviderTokenFn,
  verifyProviderIdToken,
} from '../services/provider-verify.js';
import { reconcilePendingWebhooksForIdentities } from './webhooks-revenuecat.js';

function sha256Hex(secret: string): string {
  return createHash('sha256').update(secret, 'utf-8').digest('hex');
}

function timingSafeHexEqual(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'utf-8');
  const b = Buffer.from(bHex, 'utf-8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface MemoryDeviceRecord {
  deviceId: string;
  secretHash: string;
  tokenVersion: number;
}

export interface AuthRouteDeps {
  challengeStore: ChallengeStore;
  verifyProviderToken?: VerifyProviderTokenFn;
}

export function registerAuthRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db: MockzaDb | undefined,
  deps: AuthRouteDeps,
): void {
  const memoryDevices = new Map<string, MemoryDeviceRecord>();
  const verifyProvider = deps.verifyProviderToken ?? verifyProviderIdToken;

  async function verifyBearerForDevice(
    authHeader: string | undefined,
    expectedDeviceId: string,
    expectedTokenVersion: number,
  ): Promise<boolean> {
    if (!authHeader?.startsWith('Bearer ')) return false;
    const rawToken = authHeader.slice('Bearer '.length).trim();
    if (!rawToken) return false;
    try {
      const decoded = (await verify(
        rawToken,
        env.JWT_SECRET,
        'HS256',
      )) as unknown as Partial<TokenPayload>;
      return (
        decoded.sub === expectedDeviceId &&
        decoded.type === 'device' &&
        decoded.edition === env.EDITION &&
        (decoded.tv === undefined || decoded.tv === expectedTokenVersion)
      );
    } catch {
      return false;
    }
  }

  // POST /v1/auth/anonymous
  app.post('/v1/auth/anonymous', async (c) => {
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json(
        {
          code: 'validation_error',
          message: 'Valid JSON request body with deviceId UUID is required.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const parsed = AnonymousAuthRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        {
          code: 'validation_error',
          message: 'Invalid registration payload: deviceId must be a valid UUID.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const { deviceId, appVersion, deviceSecret } = parsed.data;
    const authHeader = c.req.header('authorization');
    let tokenVersion = 1;
    let issuedSecret: string | undefined;

    if (db) {
      const newSecret = randomBytes(32).toString('base64url');
      const newSecretHash = sha256Hex(newSecret);

      const inserted = await db
        .insert(devices)
        .values({
          deviceId,
          edition: env.EDITION,
          appVersion,
          deviceSecretHash: newSecretHash,
          tokenVersion: 1,
          lastSeenAt: new Date(),
        })
        .onConflictDoNothing({ target: devices.deviceId })
        .returning({
          deviceId: devices.deviceId,
          tokenVersion: devices.tokenVersion,
        });

      if (inserted[0]) {
        tokenVersion = inserted[0].tokenVersion;
        issuedSecret = newSecret;
      } else {
        const existingRows = await db
          .select({
            deviceId: devices.deviceId,
            deviceSecretHash: devices.deviceSecretHash,
            tokenVersion: devices.tokenVersion,
          })
          .from(devices)
          .where(eq(devices.deviceId, deviceId))
          .limit(1);

        const existing = existingRows[0];
        if (!existing) {
          return c.json(
            {
              code: 'unauthorized',
              message: 'Device registration conflict.',
              requestId: c.get('requestId'),
            },
            401,
          );
        }

        const secretMatches =
          Boolean(deviceSecret) &&
          Boolean(existing.deviceSecretHash) &&
          timingSafeHexEqual(sha256Hex(deviceSecret!), existing.deviceSecretHash!);
        const bearerMatches = await verifyBearerForDevice(
          authHeader,
          deviceId,
          existing.tokenVersion,
        );

        if (!secretMatches && !bearerMatches) {
          return c.json(
            {
              code: 'unauthorized',
              message:
                'Existing device requires valid deviceSecret or active session token to renew.',
              requestId: c.get('requestId'),
            },
            401,
          );
        }

        tokenVersion = existing.tokenVersion;
        let updatedSecretHash = existing.deviceSecretHash;
        if (!updatedSecretHash && bearerMatches) {
          // One-time upgrade for pre-migration devices renewing via valid JWT.
          issuedSecret = newSecret;
          updatedSecretHash = newSecretHash;
        }

        await db
          .update(devices)
          .set({
            lastSeenAt: new Date(),
            appVersion: appVersion ?? sql`${devices.appVersion}`,
            deviceSecretHash: updatedSecretHash,
          })
          .where(eq(devices.deviceId, deviceId));
      }
    } else {
      const existing = memoryDevices.get(deviceId);
      if (!existing) {
        const newSecret = randomBytes(32).toString('base64url');
        memoryDevices.set(deviceId, {
          deviceId,
          secretHash: sha256Hex(newSecret),
          tokenVersion: 1,
        });
        issuedSecret = newSecret;
      } else {
        const secretMatches =
          Boolean(deviceSecret) &&
          timingSafeHexEqual(sha256Hex(deviceSecret!), existing.secretHash);
        const bearerMatches = await verifyBearerForDevice(
          authHeader,
          deviceId,
          existing.tokenVersion,
        );
        if (!secretMatches && !bearerMatches) {
          return c.json(
            {
              code: 'unauthorized',
              message:
                'Existing device requires valid deviceSecret or active session token to renew.',
              requestId: c.get('requestId'),
            },
            401,
          );
        }
        tokenVersion = existing.tokenVersion;
      }
    }

    if (db) {
      await reconcilePendingWebhooksForIdentities(db, [deviceId]);
    }
    const { token, expiresAt } = await signDeviceToken(deviceId, env, 30 * 24 * 3600, tokenVersion);

    return c.json(
      AnonymousAuthResponseSchema.parse({
        accessToken: token,
        deviceId,
        expiresAt,
        deviceSecret: issuedSecret,
      }),
      201,
    );
  });

  // GET /v1/auth/challenge (Single-use persisted App Attest challenge nonce)
  app.get('/v1/auth/challenge', async (c) => {
    const challenge = randomBytes(32).toString('base64url');
    const expiresAtDate = new Date(Date.now() + 5 * 60 * 1000);
    await deps.challengeStore.issue(challenge, expiresAtDate);
    return c.json({ challenge, expiresAt: expiresAtDate.toISOString() }, 200);
  });

  // POST /v1/auth/link (Account linking: verified Apple / Google Sign-In)
  const authMiddleware = createDeviceAuthMiddleware(env, db);
  app.post('/v1/auth/link', authMiddleware, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Valid device auth required.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          code: 'validation_error',
          message: 'Invalid JSON request payload.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const parsed = LinkAccountRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          code: 'validation_error',
          message: 'Invalid link account request payload.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const { provider, idToken } = parsed.data;
    let verifiedClaims: { provider: 'apple' | 'google'; sub: string; email?: string };
    try {
      verifiedClaims = await verifyProvider({ provider, idToken, env });
    } catch (err) {
      if (err instanceof ProviderTokenError) {
        return c.json(
          {
            code: err.code,
            message: err.message,
            requestId: c.get('requestId'),
          },
          err.status,
        );
      }
      return c.json(
        {
          code: 'unauthorized',
          message: 'Failed to verify provider credential.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    let userId: string = randomUUID();
    let tokenVersion = 1;

    if (db) {
      const outcome = await db.transaction(async (tx) => {
        const deviceRows = await tx
          .select({
            linkedUserId: devices.linkedUserId,
            tokenVersion: devices.tokenVersion,
          })
          .from(devices)
          .where(eq(devices.deviceId, deviceId))
          .limit(1);

        const currentDevice = deviceRows[0];
        if (!currentDevice) {
          return { conflict: false as const, missingDevice: true as const };
        }

        const existingLink = await tx
          .select({ userId: accountLinks.userId })
          .from(accountLinks)
          .where(
            and(
              eq(accountLinks.provider, verifiedClaims.provider),
              eq(accountLinks.providerSubject, verifiedClaims.sub),
            ),
          )
          .limit(1);

        let targetUserId: string;
        if (existingLink[0]) {
          targetUserId = String(existingLink[0].userId);
          if (currentDevice.linkedUserId && currentDevice.linkedUserId !== targetUserId) {
            return { conflict: true as const, missingDevice: false as const };
          }
        } else {
          targetUserId = currentDevice.linkedUserId ?? randomUUID();
          if (!currentDevice.linkedUserId) {
            await tx.insert(users).values({
              userId: targetUserId,
              email: verifiedClaims.email,
            });
          }

          await tx
            .insert(accountLinks)
            .values({
              linkId: randomUUID(),
              userId: targetUserId,
              provider: verifiedClaims.provider,
              providerSubject: verifiedClaims.sub,
            })
            .onConflictDoNothing({
              target: [accountLinks.provider, accountLinks.providerSubject],
            });

          const resolvedLink = await tx
            .select({ userId: accountLinks.userId })
            .from(accountLinks)
            .where(
              and(
                eq(accountLinks.provider, verifiedClaims.provider),
                eq(accountLinks.providerSubject, verifiedClaims.sub),
              ),
            )
            .limit(1);
          if (resolvedLink[0]) {
            targetUserId = String(resolvedLink[0].userId);
          }
        }

        await tx
          .update(devices)
          .set({ linkedUserId: targetUserId, lastSeenAt: new Date() })
          .where(eq(devices.deviceId, deviceId));

        await tx
          .update(entitlements)
          .set({ userId: targetUserId, updatedAt: new Date() })
          .where(eq(entitlements.deviceId, deviceId));

        return {
          conflict: false as const,
          missingDevice: false as const,
          userId: targetUserId,
          tokenVersion: currentDevice.tokenVersion,
        };
      });

      if (outcome.missingDevice) {
        return c.json(
          {
            code: 'unauthorized',
            message: 'Device session not found.',
            requestId: c.get('requestId'),
          },
          401,
        );
      }

      if (outcome.conflict) {
        return c.json(
          {
            code: 'attempt_conflict',
            message: 'This device is already linked to a different user account.',
            requestId: c.get('requestId'),
          },
          409,
        );
      }

      userId = outcome.userId;
      tokenVersion = outcome.tokenVersion;
    }

    if (db) {
      await reconcilePendingWebhooksForIdentities(db, [deviceId, userId]);
    }
    const { token, expiresAt } = await signDeviceToken(deviceId, env, 30 * 24 * 3600, tokenVersion);

    return c.json(
      LinkAccountResponseSchema.parse({
        success: true,
        userId,
        accessToken: token,
        expiresAt,
      }),
      200,
    );
  });
}

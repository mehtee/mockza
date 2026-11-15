import { randomBytes, randomUUID } from 'node:crypto';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import {
  AnonymousAuthRequestSchema,
  AnonymousAuthResponseSchema,
  LinkAccountRequestSchema,
  LinkAccountResponseSchema,
} from '@mockza/contracts';
import { accountLinks, devices, entitlements, type MockzaDb, users } from '@mockza/db';
import { eq, sql } from 'drizzle-orm';
import { createDeviceAuthMiddleware, signDeviceToken } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';

function parseIdToken(idToken: string): { sub: string; email?: string } {
  try {
    const parts = idToken.split('.');
    if (parts.length >= 2 && parts[1]) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
      if (payload.sub) {
        return {
          sub: String(payload.sub),
          email: payload.email ? String(payload.email) : undefined,
        };
      }
    }
  } catch (_e) {
    // Fall back to hash or raw slice in testing
  }
  return { sub: idToken.slice(0, 64) };
}

export function registerAuthRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
): void {
  // POST /v1/auth/anonymous
  app.post('/v1/auth/anonymous', async (c) => {
    let rawBody: unknown = {};
    try {
      rawBody = await c.req.json();
    } catch (_e) {
      // Empty body allowed
    }

    const parsed = AnonymousAuthRequestSchema.safeParse(rawBody);
    const deviceId = parsed.success ? parsed.data.deviceId : randomUUID();
    const appVersion = parsed.success ? parsed.data.appVersion : undefined;

    if (db) {
      await db
        .insert(devices)
        .values({
          deviceId,
          edition: env.EDITION,
          appVersion,
          lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
          target: devices.deviceId,
          set: {
            lastSeenAt: new Date(),
            appVersion: appVersion ?? sql`${devices.appVersion}`,
          },
        });
    }

    const { token, expiresAt } = await signDeviceToken(deviceId, env);
    return c.json(
      AnonymousAuthResponseSchema.parse({
        accessToken: token,
        deviceId,
        expiresAt,
      }),
      201,
    );
  });

  // GET /v1/auth/challenge (App Attest challenge nonce)
  app.get('/v1/auth/challenge', (c) => {
    const challenge = randomBytes(32).toString('base64');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    return c.json({ challenge, expiresAt }, 200);
  });

  // POST /v1/auth/link (Account linking: Apple / Google Sign-In)
  const authMiddleware = createDeviceAuthMiddleware(env, db);
  app.post('/v1/auth/link', authMiddleware, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Valid device auth required',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    const body = await c.req.json();
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
    const { sub: providerSubject, email } = parseIdToken(idToken);
    let userId: string = randomUUID();

    if (db) {
      const dbUserId = await db.transaction(async (tx) => {
        // 1. Check if an account link already exists for this provider subject
        const existingLink = await tx
          .select({ userId: accountLinks.userId })
          .from(accountLinks)
          .where(eq(accountLinks.providerSubject, providerSubject))
          .limit(1);

        let targetUserId: string;

        if (existingLink[0]) {
          targetUserId = String(existingLink[0].userId);
        } else {
          // Create new user
          targetUserId = randomUUID();
          await tx.insert(users).values({
            userId: targetUserId,
            email,
          });

          await tx.insert(accountLinks).values({
            linkId: randomUUID(),
            userId: targetUserId,
            provider,
            providerSubject,
          });
        }

        // 2. Link device to user
        await tx
          .update(devices)
          .set({ linkedUserId: targetUserId, lastSeenAt: new Date() })
          .where(eq(devices.deviceId, deviceId));

        // 3. Migrate entitlements if present
        await tx
          .update(entitlements)
          .set({ userId: targetUserId, updatedAt: new Date() })
          .where(eq(entitlements.deviceId, deviceId));

        return targetUserId;
      });
      userId = dbUserId;
    }

    const { token, expiresAt } = await signDeviceToken(deviceId, env);
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

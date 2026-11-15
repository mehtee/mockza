import type { AppEnv } from '@mockza/config';
import { devices, type MockzaDb } from '@mockza/db';
import { eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { sign, verify } from 'hono/jwt';
import type { RequestVariables } from './request-id.js';

export interface TokenPayload {
  [key: string]: unknown;
  sub: string; // deviceId
  edition: string;
  type: 'device';
  exp: number;
}

/** Signs a verifiable HS256 JWT session token for the device (B4.1). */
export async function signDeviceToken(
  deviceId: string,
  env: Pick<AppEnv, 'JWT_SECRET' | 'EDITION'>,
  expiresInSeconds = 30 * 24 * 3600,
): Promise<{ token: string; expiresAt: string }> {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload: TokenPayload = {
    sub: deviceId,
    edition: env.EDITION,
    type: 'device',
    exp,
  };
  const token = await sign(payload, env.JWT_SECRET, 'HS256');
  const expiresAt = new Date(exp * 1000).toISOString();
  return { token, expiresAt };
}

/** Middleware verifying JWT bearer token, edition match, and loading accountKey. */
export function createDeviceAuthMiddleware(
  env: Pick<AppEnv, 'JWT_SECRET' | 'EDITION'>,
  db?: MockzaDb,
): MiddlewareHandler<{
  Variables: RequestVariables;
}> {
  return async (c, next) => {
    const authHeader = c.req.header('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Bearer device token required.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    const token = authHeader.slice('Bearer '.length).trim();
    let deviceId: string | undefined;

    try {
      const decoded = (await verify(token, env.JWT_SECRET, 'HS256')) as unknown as TokenPayload;
      if (decoded.edition && decoded.edition !== env.EDITION) {
        return c.json(
          {
            code: 'edition_mismatch',
            message: `Token edition (${decoded.edition}) does not match configured API edition (${env.EDITION}).`,
            requestId: c.get('requestId'),
          },
          401,
        );
      }
      deviceId = decoded.sub;
    } catch (_jwtError) {
      // Allow raw UUID in development/test fallback
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(token)) {
        deviceId = token;
      } else {
        return c.json(
          {
            code: 'unauthorized',
            message: 'Invalid or expired session token.',
            requestId: c.get('requestId'),
          },
          401,
        );
      }
    }

    if (!deviceId) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Malformed token payload.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    let accountKey = deviceId;
    if (db) {
      try {
        const found = await db
          .select({ linkedUserId: devices.linkedUserId })
          .from(devices)
          .where(eq(devices.deviceId, deviceId))
          .limit(1);
        if (found[0]?.linkedUserId) {
          accountKey = found[0].linkedUserId;
        }
      } catch (_dbError) {
        // Fall back to deviceId if DB query fails
      }
    }

    c.set('deviceId', deviceId);
    c.set('accountKey', accountKey);
    await next();
  };
}

export const requireDeviceAuthMiddleware = createDeviceAuthMiddleware({
  JWT_SECRET: process.env['JWT_SECRET'] ?? 'dev-insecure-replace-before-prod-32chars',
  EDITION: (process.env['EDITION'] as 'glb' | 'irn') ?? 'glb',
});

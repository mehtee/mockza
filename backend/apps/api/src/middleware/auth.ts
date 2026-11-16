import type { AppEnv } from '@mockza/config';
import { devices, type MockzaDb } from '@mockza/db';
import { eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { sign, verify } from 'hono/jwt';
import type { RequestVariables } from './request-id.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TokenPayload {
  [key: string]: unknown;
  sub: string; // deviceId
  edition: string;
  type: 'device';
  tv?: number;
  exp: number;
}

/** Signs a verifiable HS256 JWT session token for the device (B4.1). */
export async function signDeviceToken(
  deviceId: string,
  env: Pick<AppEnv, 'JWT_SECRET' | 'EDITION'>,
  expiresInSeconds = 30 * 24 * 3600,
  tokenVersion = 1,
): Promise<{ token: string; expiresAt: string }> {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload: TokenPayload = {
    sub: deviceId,
    edition: env.EDITION,
    type: 'device',
    tv: tokenVersion,
    exp,
  };
  const token = await sign(payload, env.JWT_SECRET, 'HS256');
  const expiresAt = new Date(exp * 1000).toISOString();
  return { token, expiresAt };
}

/** Middleware verifying JWT bearer token, required claims, edition match, and active DB device row. */
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
    if (!token) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Bearer device token required.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    let decoded: Partial<TokenPayload>;
    try {
      decoded = (await verify(token, env.JWT_SECRET, 'HS256')) as unknown as Partial<TokenPayload>;
    } catch {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Invalid or expired session token.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    if (typeof decoded.edition !== 'string' || decoded.edition !== env.EDITION) {
      return c.json(
        {
          code: 'edition_mismatch',
          message: `Token edition (${String(decoded.edition ?? 'missing')}) does not match configured API edition (${env.EDITION}).`,
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    if (
      typeof decoded.sub !== 'string' ||
      !UUID_REGEX.test(decoded.sub) ||
      decoded.type !== 'device' ||
      typeof decoded.exp !== 'number'
    ) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Malformed token payload.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    const deviceId = decoded.sub;
    let accountKey = deviceId;

    if (db) {
      const found = await db
        .select({
          linkedUserId: devices.linkedUserId,
          tokenVersion: devices.tokenVersion,
        })
        .from(devices)
        .where(eq(devices.deviceId, deviceId))
        .limit(1);

      const row = found[0];
      if (!row) {
        return c.json(
          {
            code: 'unauthorized',
            message: 'Session revoked or device is not registered.',
            requestId: c.get('requestId'),
          },
          401,
        );
      }

      if (decoded.tv !== undefined && row.tokenVersion !== decoded.tv) {
        return c.json(
          {
            code: 'unauthorized',
            message: 'Session token has been revoked.',
            requestId: c.get('requestId'),
          },
          401,
        );
      }

      if (row.linkedUserId) {
        accountKey = row.linkedUserId;
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

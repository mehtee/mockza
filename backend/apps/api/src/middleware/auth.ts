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
  uid?: string | null;
  exp: number;
}

export interface MemoryDeviceAuthLookup {
  resolveMemoryDeviceState(deviceId: string): {
    exists: boolean;
    linkedUserId: string | null;
    tokenVersion: number;
  } | null;
}

/** Signs a verifiable HS256 JWT session token for the device (B4.1). */
export async function signDeviceToken(
  deviceId: string,
  env: Pick<AppEnv, 'JWT_SECRET' | 'EDITION'>,
  expiresInSeconds = 30 * 24 * 3600,
  tokenVersion = 1,
  userId?: string | null,
): Promise<{ token: string; expiresAt: string }> {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload: TokenPayload = {
    sub: deviceId,
    edition: env.EDITION,
    type: 'device',
    tv: tokenVersion,
    ...(userId ? { uid: userId } : {}),
    exp,
  };
  const token = await sign(payload, env.JWT_SECRET, 'HS256');
  const expiresAt = new Date(exp * 1000).toISOString();
  return { token, expiresAt };
}

/** Middleware verifying JWT bearer token, required claims, edition match, and active device/user session. */
export function createDeviceAuthMiddleware(
  env: Pick<AppEnv, 'JWT_SECRET' | 'EDITION'>,
  db?: MockzaDb,
  memoryLookup?: MemoryDeviceAuthLookup,
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
    let linkedUserId: string | null = null;
    const tokenUid = typeof decoded.uid === 'string' && decoded.uid.length > 0 ? decoded.uid : null;

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

      if (tokenUid && row.linkedUserId !== tokenUid) {
        return c.json(
          {
            code: 'unauthorized',
            message: 'Device session was signed out or terminated.',
            requestId: c.get('requestId'),
          },
          401,
        );
      }

      if (row.linkedUserId) {
        linkedUserId = row.linkedUserId;
        accountKey = row.linkedUserId;
      }
    } else if (memoryLookup) {
      const mem = memoryLookup.resolveMemoryDeviceState(deviceId);
      if (mem) {
        if (decoded.tv !== undefined && mem.tokenVersion !== decoded.tv) {
          return c.json(
            {
              code: 'unauthorized',
              message: 'Session token has been revoked.',
              requestId: c.get('requestId'),
            },
            401,
          );
        }
        if (tokenUid && mem.linkedUserId !== tokenUid) {
          return c.json(
            {
              code: 'unauthorized',
              message: 'Device session was signed out or terminated.',
              requestId: c.get('requestId'),
            },
            401,
          );
        }
        if (mem.linkedUserId) {
          linkedUserId = mem.linkedUserId;
          accountKey = mem.linkedUserId;
        }
      }
    }

    c.set('deviceId', deviceId);
    c.set('accountKey', accountKey);
    c.set('userId', linkedUserId);
    await next();
  };
}

export const requireDeviceAuthMiddleware = createDeviceAuthMiddleware({
  JWT_SECRET: process.env['JWT_SECRET'] ?? 'dev-insecure-replace-before-prod-32chars',
  EDITION: (process.env['EDITION'] as 'glb' | 'irn') ?? 'glb',
});

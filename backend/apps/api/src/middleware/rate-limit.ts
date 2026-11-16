import type { MiddlewareHandler } from 'hono';
import type { RequestVariables } from './request-id.js';

interface RateLimitEntry {
  timestamps: number[];
}

export interface RateLimitOptions {
  windowMs?: number; // e.g. 60_000 (1 minute)
  maxRequests?: number; // e.g. 60
  trustedProxyIps?: Set<string>;
}

export function resolveClientKey(params: {
  forwardedFor?: string;
  realIp?: string;
  cfIp?: string;
  remoteAddr?: string;
  deviceId?: string;
  trustedProxyIps?: Set<string>;
}): string {
  const remoteIp = params.remoteAddr?.replace(/^::ffff:/, '').trim() ?? '';
  const isTrustedProxy = remoteIp.length > 0 && Boolean(params.trustedProxyIps?.has(remoteIp));

  // Only consume proxy headers when the immediate peer IP is an explicitly configured trusted proxy (`RR-17`).
  if (isTrustedProxy) {
    if (params.cfIp?.trim()) return params.cfIp.trim();
    if (params.forwardedFor) {
      const hops = params.forwardedFor
        .split(',')
        .map((h) => h.trim())
        .filter((h) => h.length > 0);
      // Pick the rightmost hop not in trustedProxyIps rather than caller-spoofable left-most value.
      for (let i = hops.length - 1; i >= 0; i -= 1) {
        const hop = hops[i];
        if (hop && !params.trustedProxyIps?.has(hop)) {
          return hop;
        }
      }
      if (hops[0]) return hops[0];
    }
    if (params.realIp?.trim()) return params.realIp.trim();
  }

  return remoteIp || params.deviceId || 'direct-client';
}

/** In-memory sliding-window rate limiter per trusted client IP / deviceId (`RR-17`). */
export function createRateLimitMiddleware(
  options: RateLimitOptions = {},
): MiddlewareHandler<{ Variables: RequestVariables }> {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 60;
  const trustedProxyIps = options.trustedProxyIps;
  const store = new Map<string, RateLimitEntry>();

  // Cleanup old entries every 5 minutes
  setInterval(() => {
    const threshold = Date.now() - windowMs;
    for (const [key, entry] of store.entries()) {
      entry.timestamps = entry.timestamps.filter((ts) => ts > threshold);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 300_000).unref();

  return async (c, next) => {
    const rawIncoming = (
      c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined
    )?.incoming;
    const ip = resolveClientKey({
      forwardedFor: c.req.header('x-forwarded-for'),
      realIp: c.req.header('x-real-ip'),
      cfIp: c.req.header('cf-connecting-ip'),
      remoteAddr: rawIncoming?.socket?.remoteAddress,
      deviceId: c.get('deviceId'),
      trustedProxyIps,
    });
    const now = Date.now();
    const threshold = now - windowMs;

    let entry = store.get(ip);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(ip, entry);
    }

    entry.timestamps = entry.timestamps.filter((ts) => ts > threshold);

    const oldest = entry.timestamps[0];
    if (entry.timestamps.length >= maxRequests && oldest !== undefined) {
      const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
      c.header('Retry-After', String(Math.max(1, retryAfterSec)));
      return c.json(
        {
          code: 'quota_exceeded',
          message: `Too many requests. Please slow down and try again in ${retryAfterSec} seconds.`,
          requestId: c.get('requestId'),
        },
        429,
      );
    }

    entry.timestamps.push(now);
    await next();
  };
}

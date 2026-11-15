import type { MiddlewareHandler } from 'hono';
import type { RequestVariables } from './request-id.js';

interface RateLimitEntry {
  timestamps: number[];
}

export interface RateLimitOptions {
  windowMs?: number; // e.g. 60_000 (1 minute)
  maxRequests?: number; // e.g. 60
}

/** In-memory sliding-window rate limiter per client IP / deviceId (B4.2). */
export function createRateLimitMiddleware(
  options: RateLimitOptions = {},
): MiddlewareHandler<{ Variables: RequestVariables }> {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 60;
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
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      c.get('deviceId') ??
      'unknown-client';
    const now = Date.now();
    const threshold = now - windowMs;

    let entry = store.get(ip);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(ip, entry);
    }

    entry.timestamps = entry.timestamps.filter((ts) => ts > threshold);

    if (entry.timestamps.length >= maxRequests) {
      const retryAfterSec = Math.ceil((entry.timestamps[0]! + windowMs - now) / 1000);
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

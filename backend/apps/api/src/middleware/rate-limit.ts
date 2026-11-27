import type { MiddlewareHandler } from 'hono';
import type { RequestVariables } from './request-id.js';

interface RateLimitEntry {
  timestamps: number[];
}

const DEFAULT_TRUSTED_PROXY_LIST = '127.0.0.1,::1';

export interface RateLimitOptions {
  windowMs?: number; // e.g. 60_000 (1 minute)
  maxRequests?: number; // e.g. 60
  trustedProxyIps?: Set<string>;
  keyByAccount?: boolean;
}

export function parseTrustedProxyList(raw?: string): Set<string> {
  if (raw !== undefined) {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.toLowerCase() === 'none') {
      return new Set();
    }
    return new Set(
      trimmed
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    );
  }
  return new Set(
    DEFAULT_TRUSTED_PROXY_LIST.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

function normalizeIpLiteral(raw: string): string {
  const trimmed = raw.trim().replace(/^::ffff:/i, '');
  const zoneIdx = trimmed.indexOf('%');
  return zoneIdx >= 0 ? trimmed.slice(0, zoneIdx) : trimmed;
}

function parseIpv4Int(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const num = Number(part);
    if (num < 0 || num > 255) return null;
    value = ((value << 8) | num) >>> 0;
  }
  return value;
}

function parseIpv6BigInt(ip: string): bigint | null {
  if (!ip.includes(':')) return null;
  const halves = ip.split('::');
  if (halves.length > 2) return null;

  const parseGroups = (segment: string): number[] | null => {
    if (segment.length === 0) return [];
    const tokens = segment.split(':');
    const out: number[] = [];
    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i] ?? '';
      if (tok.includes('.') && i === tokens.length - 1) {
        const v4 = parseIpv4Int(tok);
        if (v4 === null) return null;
        out.push((v4 >>> 16) & 0xffff, v4 & 0xffff);
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(tok)) return null;
        out.push(Number.parseInt(tok, 16));
      }
    }
    return out;
  };

  const left = parseGroups(halves[0] ?? '');
  if (!left) return null;
  const right = halves.length === 2 ? parseGroups(halves[1] ?? '') : [];
  if (!right) return null;

  let groups: number[];
  if (halves.length === 2) {
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    groups = [...left, ...Array<number>(missing).fill(0), ...right];
  } else {
    if (left.length !== 8) return null;
    groups = left;
  }

  let acc = 0n;
  for (const g of groups) {
    acc = (acc << 16n) | BigInt(g);
  }
  return acc;
}

function ipMatchesEntry(ipRaw: string, entryRaw: string): boolean {
  const ip = normalizeIpLiteral(ipRaw);
  const entry = entryRaw.trim();
  if (!ip || !entry) return false;
  if (!entry.includes('/')) {
    if (ip === normalizeIpLiteral(entry)) return true;
    const v6Ip = parseIpv6BigInt(ip);
    const v6Entry = parseIpv6BigInt(normalizeIpLiteral(entry));
    return v6Ip !== null && v6Entry !== null && v6Ip === v6Entry;
  }

  const slashIdx = entry.indexOf('/');
  const netIp = normalizeIpLiteral(entry.slice(0, slashIdx));
  const prefixStr = entry.slice(slashIdx + 1);
  if (!/^\d{1,3}$/.test(prefixStr)) return false;
  const prefix = Number(prefixStr);

  const ipV4 = parseIpv4Int(ip);
  const netV4 = parseIpv4Int(netIp);
  if (ipV4 !== null && netV4 !== null) {
    if (prefix < 0 || prefix > 32) return false;
    if (prefix === 0) return true;
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    return (ipV4 & mask) === (netV4 & mask);
  }

  const ipV6 = parseIpv6BigInt(ip);
  const netV6 = parseIpv6BigInt(netIp);
  if (ipV6 !== null && netV6 !== null) {
    if (prefix < 0 || prefix > 128) return false;
    if (prefix === 0) return true;
    const shift = BigInt(128 - prefix);
    return ipV6 >> shift === netV6 >> shift;
  }

  return false;
}

function isIpTrusted(ipRaw: string, trustedProxyIps?: Set<string>): boolean {
  if (!trustedProxyIps || trustedProxyIps.size === 0) return false;
  const normalized = normalizeIpLiteral(ipRaw);
  if (!normalized) return false;
  if (trustedProxyIps.has(normalized)) return true;
  for (const entry of trustedProxyIps) {
    if (ipMatchesEntry(normalized, entry)) return true;
  }
  return false;
}

export function resolveClientKey(params: {
  forwardedFor?: string;
  realIp?: string;
  cfIp?: string;
  remoteAddr?: string;
  deviceId?: string;
  trustedProxyIps?: Set<string>;
}): string {
  const remoteIp = params.remoteAddr ? normalizeIpLiteral(params.remoteAddr) : '';
  const isTrustedProxy = isIpTrusted(remoteIp, params.trustedProxyIps);

  // Only consume proxy headers when the immediate peer IP matches trustedProxyIps/CIDRs (`RR-17`).
  if (isTrustedProxy) {
    // A trusted reverse proxy can forward a caller-supplied CF-Connecting-IP.
    // Use its appended forwarding chain rather than trusting that header.
    if (params.forwardedFor) {
      const hops = params.forwardedFor
        .split(',')
        .map((h) => normalizeIpLiteral(h))
        .filter((h) => h.length > 0);
      // Pick the rightmost hop not in trustedProxyIps rather than caller-spoofable left-most value.
      for (let i = hops.length - 1; i >= 0; i -= 1) {
        const hop = hops[i];
        if (hop && !isIpTrusted(hop, params.trustedProxyIps)) {
          return hop;
        }
      }
      if (hops[0]) return hops[0];
    }
    if (params.realIp?.trim()) {
      const real = normalizeIpLiteral(params.realIp);
      if (real && !isIpTrusted(real, params.trustedProxyIps)) {
        return real;
      }
      if (real) return real;
    }
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
  const keyByAccount = options.keyByAccount ?? false;
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
    const resolvedIp = resolveClientKey({
      forwardedFor: c.req.header('x-forwarded-for'),
      realIp: c.req.header('x-real-ip'),
      cfIp: c.req.header('cf-connecting-ip'),
      remoteAddr: rawIncoming?.socket?.remoteAddress,
      deviceId: c.get('deviceId'),
      trustedProxyIps,
    });
    const ip = keyByAccount ? (c.get('accountKey') ?? c.get('deviceId') ?? resolvedIp) : resolvedIp;
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

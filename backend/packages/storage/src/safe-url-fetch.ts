import { lookup } from 'node:dns/promises';
import * as http from 'node:http';
import * as https from 'node:https';
import { isIP } from 'node:net';
import {
  isBlockedVideoHost,
  isPrivateOrInternalHost,
  validateDropTextSnippet,
  validateDropUrlPreFlight,
} from '@mockza/domain';

export class SafeUrlFetchError extends Error {
  constructor(
    public readonly code:
      | 'UNSUPPORTED_DROP_SOURCE'
      | 'SSRF_BLOCKED'
      | 'FETCH_TIMEOUT'
      | 'FETCH_TOO_LARGE'
      | 'FETCH_FAILED',
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'SafeUrlFetchError';
  }
}

export type DnsLookupFn = (
  hostname: string,
) => Promise<Array<{ address: string; family: 4 | 6 }>>;

export interface SafeUrlFetchOptions {
  allowHttpInNonProd?: boolean;
  isProduction?: boolean;
  maxBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
  lookupFn?: DnsLookupFn;
  /** Optional raw transport override for deterministic unit tests. */
  rawRequestFn?: (params: {
    url: URL;
    pinnedIp: string;
    ipFamily: 4 | 6;
    maxBytes: number;
    timeoutMs: number;
  }) => Promise<{ statusCode: number; headers: Record<string, string | string[] | undefined>; body: Buffer }>;
}

export interface SafeFetchedDocument {
  finalUrl: string;
  sourceDomain: string;
  contentType: string;
  title: string;
  extractedText: string;
  byteLength: number;
}

const DEFAULT_MAX_BYTES = Math.floor(1.5 * 1024 * 1024); // 1.5 MB text cap
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_TIMEOUT_MS = 8_000;

function isPrivateOrReservedIpAddress(ip: string): boolean {
  const normalized = ip.trim().toLowerCase();
  if (isPrivateOrInternalHost(normalized)) {
    return true;
  }
  // IPv4 checks not caught by simple string prefix (172.16-31, 100.64-127, 198.18-19, 0/8, multicast/reserved)
  const ipv4Match = normalized.startsWith('::ffff:')
    ? normalized.slice('::ffff:'.length)
    : normalized;

  if (isIP(ipv4Match) === 4) {
    const parts = ipv4Match.split('.').map((p) => Number.parseInt(p, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const a = parts[0]!;
    const b = parts[1]!;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true; // Multicast & reserved
    return false;
  }

  if (isIP(normalized) === 6) {
    if (normalized === '::1' || normalized === '::') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // Unique local
    if (
      normalized.startsWith('fe8') ||
      normalized.startsWith('fe9') ||
      normalized.startsWith('fea') ||
      normalized.startsWith('feb')
    ) {
      return true; // Link-local fe80::/10
    }
    if (normalized.startsWith('ff')) return true; // Multicast
    return false;
  }

  return true;
}

function defaultDnsLookup(): DnsLookupFn {
  return async (hostname: string) => {
    const records = await lookup(hostname, { all: true, verbatim: true });
    return records.map((r) => ({
      address: r.address,
      family: r.family === 6 ? 6 : 4,
    }));
  };
}

async function performPinnedHttpRequest(params: {
  url: URL;
  pinnedIp: string;
  ipFamily: 4 | 6;
  maxBytes: number;
  timeoutMs: number;
}): Promise<{
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}> {
  return new Promise((resolve, reject) => {
    const isHttps = params.url.protocol === 'https:';
    const port = params.url.port
      ? Number.parseInt(params.url.port, 10)
      : isHttps
        ? 443
        : 80;

    const requestFn = isHttps ? https.request : http.request;
    const req = requestFn(
      {
        host: params.pinnedIp,
        port,
        method: 'GET',
        path: `${params.url.pathname}${params.url.search}`,
        family: params.ipFamily,
        headers: {
          Host: params.url.host,
          'User-Agent': 'MockzaSafeFetcher/1.0 (+https://mockza.app)',
          Accept: 'text/html,text/plain,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'Accept-Encoding': 'identity',
        },
        ...(isHttps ? { servername: params.url.hostname } : {}),
        timeout: params.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let totalBytes = 0;

        res.on('data', (chunk: Buffer) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buf.length;
          if (totalBytes > params.maxBytes) {
            req.destroy();
            reject(
              new SafeUrlFetchError(
                'FETCH_TOO_LARGE',
                413,
                `Remote document exceeded ${params.maxBytes} bytes limit.`,
              ),
            );
            return;
          }
          chunks.push(buf);
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers as Record<string, string | string[] | undefined>,
            body: Buffer.concat(chunks),
          });
        });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new SafeUrlFetchError('FETCH_TIMEOUT', 504, 'Remote URL fetch timed out.'));
    });

    req.on('error', (err) => {
      if (err instanceof SafeUrlFetchError) {
        reject(err);
      } else {
        reject(new SafeUrlFetchError('FETCH_FAILED', 502, `URL fetch failed: ${err.message}`));
      }
    });

    req.end();
  });
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function extractReadableTextFromHtml(
  rawHtmlOrText: string,
  contentType: string,
): { title: string; text: string } {
  const lowerCt = contentType.toLowerCase();
  if (lowerCt.includes('text/plain')) {
    const cleaned = rawHtmlOrText.replace(/\s+/g, ' ').trim();
    const firstLine = cleaned.slice(0, 80);
    return { title: firstLine, text: cleaned };
  }

  const titleMatch = rawHtmlOrText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]
    ? decodeHtmlEntities(titleMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(
        0,
        140,
      )
    : '';

  const stripped = rawHtmlOrText
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<\/?(p|div|li|h[1-6]|article|section|blockquote|br)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const text = decodeHtmlEntities(stripped)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

  return { title, text };
}

function isBlockedMimeType(contentType: string): boolean {
  const lower = contentType.toLowerCase();
  return (
    lower.startsWith('video/') ||
    lower.includes('application/vnd.apple.mpegurl') ||
    lower.includes('application/x-mpegurl') ||
    lower.includes('application/dash+xml')
  );
}

/**
 * Fetches an external article URL with DNS pinning, SSRF IP blocklist, video-host/MIME rejection,
 * manual redirect hop checks, and strict byte/UTF-16 size caps (`ADR-ADV-004`).
 */
export async function safeFetchReadableUrl(
  rawUrl: string,
  options: SafeUrlFetchOptions = {},
): Promise<SafeFetchedDocument> {
  const isProd = options.isProduction ?? process.env['NODE_ENV'] === 'production';
  const allowHttp = Boolean(options.allowHttpInNonProd && !isProd);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const lookupFn = options.lookupFn ?? defaultDnsLookup();
  const requestFn = options.rawRequestFn ?? performPinnedHttpRequest;

  let currentUrl = rawUrl.trim();
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const preflight = validateDropUrlPreFlight(currentUrl, { allowHttpInDev: allowHttp });
    if (!preflight.ok) {
      if (preflight.code === 'UNSUPPORTED_DROP_SOURCE') {
        throw new SafeUrlFetchError(
          'UNSUPPORTED_DROP_SOURCE',
          422,
          preflight.reason ?? 'Share the article URL, text excerpt, or a screenshot instead.',
        );
      }
      throw new SafeUrlFetchError(
        'SSRF_BLOCKED',
        422,
        preflight.reason ?? 'URL rejected by safety policy.',
      );
    }

    const parsed = new URL(currentUrl);
    if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
      throw new SafeUrlFetchError('SSRF_BLOCKED', 422, 'Only standard ports 80/443 are permitted.');
    }

    let pinned: { address: string; family: 4 | 6 } | undefined;
    if (isIP(parsed.hostname) !== 0) {
      if (isPrivateOrReservedIpAddress(parsed.hostname)) {
        throw new SafeUrlFetchError('SSRF_BLOCKED', 422, 'Direct private/reserved IP blocked.');
      }
      pinned = { address: parsed.hostname, family: isIP(parsed.hostname) === 6 ? 6 : 4 };
    } else {
      let resolved: Array<{ address: string; family: 4 | 6 }> = [];
      try {
        resolved = await lookupFn(parsed.hostname);
      } catch (_err) {
        throw new SafeUrlFetchError('FETCH_FAILED', 422, 'Hostname DNS resolution failed.');
      }
      if (resolved.length === 0) {
        throw new SafeUrlFetchError('FETCH_FAILED', 422, 'Hostname resolved to zero addresses.');
      }
      for (const record of resolved) {
        if (isPrivateOrReservedIpAddress(record.address)) {
          throw new SafeUrlFetchError(
            'SSRF_BLOCKED',
            422,
            'Resolved IP belongs to a private or reserved network range.',
          );
        }
      }
      pinned = resolved[0]!;
    }

    const res = await requestFn({
      url: parsed,
      pinnedIp: pinned.address,
      ipFamily: pinned.family,
      maxBytes,
      timeoutMs,
    });

    if (res.statusCode >= 300 && res.statusCode < 400) {
      const locationHeader = res.headers['location'];
      const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
      if (!location || hop === maxRedirects) {
        throw new SafeUrlFetchError('FETCH_FAILED', 422, 'Too many redirects or missing Location.');
      }
      currentUrl = new URL(location, parsed).toString();
      if (isBlockedVideoHost(new URL(currentUrl).hostname)) {
        throw new SafeUrlFetchError(
          'UNSUPPORTED_DROP_SOURCE',
          422,
          'Redirected to a blocked video platform; share article text or a screenshot instead.',
        );
      }
      continue;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw new SafeUrlFetchError(
        'FETCH_FAILED',
        422,
        `Upstream responded with HTTP ${res.statusCode}.`,
      );
    }

    const ctHeader = res.headers['content-type'];
    const contentType = (Array.isArray(ctHeader) ? ctHeader[0] : ctHeader) ?? 'text/html';
    if (isBlockedMimeType(contentType)) {
      throw new SafeUrlFetchError(
        'UNSUPPORTED_DROP_SOURCE',
        422,
        'Video streams are unsupported; share the article URL, text excerpt, or screenshot instead.',
      );
    }

    const rawText = res.body.toString('utf8');
    const extracted = extractReadableTextFromHtml(rawText, contentType);
    const boundedText = extracted.text.slice(0, 15_000);
    const snippetCheck = validateDropTextSnippet(boundedText);
    if (!snippetCheck.ok) {
      throw new SafeUrlFetchError(
        'FETCH_FAILED',
        422,
        'Fetched page did not contain enough readable text.',
      );
    }

    return {
      finalUrl: parsed.toString(),
      sourceDomain: parsed.hostname,
      contentType,
      title: extracted.title || parsed.hostname,
      extractedText: boundedText,
      byteLength: res.body.length,
    };
  }

  throw new SafeUrlFetchError('FETCH_FAILED', 422, 'Exceeded redirect ceiling.');
}

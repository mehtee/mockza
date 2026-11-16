import { createPublicKey, verify as cryptoVerify, type JsonWebKey } from 'node:crypto';
import type { AppEnv } from '@mockza/config';

export interface VerifiedProviderClaims {
  provider: 'apple' | 'google';
  sub: string;
  email?: string;
}

export type VerifyProviderTokenFn = (params: {
  provider: 'apple' | 'google';
  idToken: string;
  env: Pick<AppEnv, 'APPLE_CLIENT_ID' | 'GOOGLE_CLIENT_ID'>;
}) => Promise<VerifiedProviderClaims>;

export class ProviderTokenError extends Error {
  constructor(
    public readonly code: 'unauthorized' | 'provider_not_configured',
    message: string,
    public readonly status: 401 | 503 = 401,
  ) {
    super(message);
    this.name = 'ProviderTokenError';
  }
}

interface JwkCacheEntry {
  keys: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }>;
  fetchedAtMs: number;
}

const JWKS_CACHE = new Map<string, JwkCacheEntry>();
const JWKS_TTL_MS = 10 * 60 * 1000;

async function fetchJwksKeys(
  jwksUrl: string,
  forceRefresh = false,
): Promise<Array<JsonWebKey & { kid?: string; alg?: string; use?: string }>> {
  const cached = JWKS_CACHE.get(jwksUrl);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAtMs < JWKS_TTL_MS) {
    return cached.keys;
  }

  const res = await fetch(jwksUrl, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new ProviderTokenError(
      'provider_not_configured',
      `Failed to fetch provider JWKS (${res.status}).`,
      503,
    );
  }
  const body = (await res.json()) as {
    keys?: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }>;
  };
  const keys = Array.isArray(body.keys) ? body.keys : [];
  JWKS_CACHE.set(jwksUrl, { keys, fetchedAtMs: Date.now() });
  return keys;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const json = Buffer.from(segment, 'base64url').toString('utf-8');
  return JSON.parse(json) as T;
}

/**
 * Cryptographically verifies Apple/Google OIDC ID tokens using provider JWKS,
 * strict issuer, audience, expiration, and subject validation.
 */
export const verifyProviderIdToken: VerifyProviderTokenFn = async ({ provider, idToken, env }) => {
  const expectedAudience = provider === 'apple' ? env.APPLE_CLIENT_ID : env.GOOGLE_CLIENT_ID;
  if (!expectedAudience) {
    throw new ProviderTokenError(
      'provider_not_configured',
      `${provider} sign-in client ID is not configured on this server.`,
      503,
    );
  }

  const parts = idToken.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new ProviderTokenError('unauthorized', 'Malformed provider ID token.');
  }

  let header: { alg?: string; kid?: string };
  let payload: {
    iss?: string;
    aud?: string | string[];
    sub?: string;
    exp?: number;
    email?: string;
  };
  try {
    header = decodeBase64UrlJson(parts[0]);
    payload = decodeBase64UrlJson(parts[1]);
  } catch {
    throw new ProviderTokenError('unauthorized', 'Unparseable provider ID token.');
  }

  if (header.alg !== 'RS256' && header.alg !== 'ES256') {
    throw new ProviderTokenError('unauthorized', 'Unsupported provider token signing algorithm.');
  }

  const allowedIssuers =
    provider === 'apple'
      ? ['https://appleid.apple.com']
      : ['https://accounts.google.com', 'accounts.google.com'];

  if (!payload.iss || !allowedIssuers.includes(payload.iss)) {
    throw new ProviderTokenError('unauthorized', 'Provider token issuer mismatch.');
  }

  const audMatches = Array.isArray(payload.aud)
    ? payload.aud.includes(expectedAudience)
    : payload.aud === expectedAudience;
  if (!audMatches) {
    throw new ProviderTokenError('unauthorized', 'Provider token audience mismatch.');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
    throw new ProviderTokenError('unauthorized', 'Provider token expired.');
  }

  if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0) {
    throw new ProviderTokenError('unauthorized', 'Provider token missing subject claim.');
  }

  const jwksUrl =
    provider === 'apple'
      ? 'https://appleid.apple.com/auth/keys'
      : 'https://www.googleapis.com/oauth2/v3/certs';

  let keys = await fetchJwksKeys(jwksUrl);
  let jwk = keys.find((k) => (!header.kid || k.kid === header.kid) && (!k.use || k.use === 'sig'));
  if (!jwk) {
    keys = await fetchJwksKeys(jwksUrl, true);
    jwk = keys.find((k) => (!header.kid || k.kid === header.kid) && (!k.use || k.use === 'sig'));
  }

  if (!jwk) {
    throw new ProviderTokenError('unauthorized', 'Matching provider signing key not found.');
  }

  const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf-8');
  const signature = Buffer.from(parts[2], 'base64url');
  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });

  const verified =
    header.alg === 'ES256'
      ? cryptoVerify(
          'sha256',
          signingInput,
          { key: publicKey, dsaEncoding: 'ieee-p1363' },
          signature,
        )
      : cryptoVerify('sha256', signingInput, publicKey, signature);

  if (!verified) {
    throw new ProviderTokenError('unauthorized', 'Invalid provider token signature.');
  }

  return {
    provider,
    sub: payload.sub.trim(),
    email:
      typeof payload.email === 'string' && payload.email.length > 0 ? payload.email : undefined,
  };
};

import { createPublicKey, verify as cryptoVerify, type JsonWebKey } from 'node:crypto';
import { type AppEnv, parseProviderClientIds } from '@mockza/config';

export interface VerifiedProviderClaims {
  provider: 'apple' | 'google';
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
}

export type VerifyProviderTokenFn = (params: {
  provider: 'apple' | 'google';
  idToken: string;
  env: Pick<AppEnv, 'APPLE_CLIENT_ID' | 'GOOGLE_CLIENT_ID'> & {
    NODE_ENV?: AppEnv['NODE_ENV'];
    ALLOW_DEV_AUTH_PROVIDERS?: boolean;
  };
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

export const DEV_OAUTH_TOKEN_PREFIX = 'mockza_dev_oauth_v1.';

interface DevOAuthTokenPayload {
  provider?: string;
  sub?: string;
  email?: string;
  name?: string;
}

/**
 * Cryptographically verifies Apple/Google OIDC ID tokens using provider JWKS,
 * strict issuer, audience, expiration, and subject validation, with explicit
 * opt-in dev sandbox tokens disabled in production.
 */
export const verifyProviderIdToken: VerifyProviderTokenFn = async ({ provider, idToken, env }) => {
  const rawAudience = provider === 'apple' ? env.APPLE_CLIENT_ID : env.GOOGLE_CLIENT_ID;
  const expectedAudiences = parseProviderClientIds(rawAudience);

  if (idToken.startsWith(DEV_OAUTH_TOKEN_PREFIX)) {
    const devSandboxAllowed =
      env.NODE_ENV !== 'production' && env.ALLOW_DEV_AUTH_PROVIDERS === true;
    if (!devSandboxAllowed) {
      throw new ProviderTokenError(
        'unauthorized',
        'Dev sandbox provider tokens are disabled in this environment.',
        401,
      );
    }
    const encoded = idToken.slice(DEV_OAUTH_TOKEN_PREFIX.length).trim();
    if (!encoded) {
      throw new ProviderTokenError('unauthorized', 'Malformed dev OAuth sandbox token.', 401);
    }
    let decoded: DevOAuthTokenPayload;
    try {
      decoded = decodeBase64UrlJson<DevOAuthTokenPayload>(encoded);
    } catch {
      throw new ProviderTokenError('unauthorized', 'Invalid dev OAuth sandbox payload.', 401);
    }
    if (decoded.provider && decoded.provider !== provider) {
      throw new ProviderTokenError('unauthorized', 'Dev OAuth provider mismatch.', 401);
    }
    if (typeof decoded.sub !== 'string' || decoded.sub.trim().length === 0) {
      throw new ProviderTokenError('unauthorized', 'Dev OAuth sandbox missing subject.', 401);
    }
    return {
      provider,
      sub: decoded.sub.trim(),
      email:
        typeof decoded.email === 'string' && decoded.email.trim().length > 0
          ? decoded.email.trim().toLowerCase()
          : undefined,
      emailVerified: true,
      name:
        typeof decoded.name === 'string' && decoded.name.trim().length > 0
          ? decoded.name.trim()
          : undefined,
    };
  }

  if (expectedAudiences.length === 0) {
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
    email_verified?: boolean | string;
    name?: string;
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
    ? payload.aud.some((aud) => expectedAudiences.includes(aud))
    : typeof payload.aud === 'string' && expectedAudiences.includes(payload.aud);
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
      typeof payload.email === 'string' && payload.email.length > 0
        ? payload.email.trim().toLowerCase()
        : undefined,
    emailVerified:
      payload.email_verified === true || payload.email_verified === 'true' ? true : undefined,
    name:
      typeof payload.name === 'string' && payload.name.trim().length > 0
        ? payload.name.trim()
        : undefined,
  };
};

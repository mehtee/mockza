import { createHmac, timingSafeEqual } from 'node:crypto';
import { authChallenges, type MockzaDb } from '@mockza/db';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import type { RequestVariables } from './request-id.js';

export interface ChallengeRecord {
  expiresAtMs: number;
  consumed: boolean;
}

export interface ChallengeStore {
  issue(challenge: string, expiresAt: Date): Promise<void>;
  consume(challenge: string, now?: Date): Promise<boolean>;
}

/** Creates a PostgreSQL-backed (or bounded in-memory test) single-use challenge store. */
export function createChallengeStore(db?: MockzaDb): ChallengeStore {
  const memoryChallenges = new Map<string, ChallengeRecord>();
  const MAX_MEMORY_CHALLENGES = 10_000;

  return {
    async issue(challenge: string, expiresAt: Date): Promise<void> {
      if (db) {
        await db.insert(authChallenges).values({
          challenge,
          expiresAt,
        });
        return;
      }

      const nowMs = Date.now();
      for (const [key, entry] of memoryChallenges.entries()) {
        if (entry.expiresAtMs <= nowMs || entry.consumed) {
          memoryChallenges.delete(key);
        }
      }
      if (memoryChallenges.size >= MAX_MEMORY_CHALLENGES) {
        const oldestKey = memoryChallenges.keys().next().value;
        if (oldestKey !== undefined) {
          memoryChallenges.delete(oldestKey);
        }
      }
      memoryChallenges.set(challenge, {
        expiresAtMs: expiresAt.getTime(),
        consumed: false,
      });
    },

    async consume(challenge: string, now = new Date()): Promise<boolean> {
      if (!challenge || challenge.length < 16 || challenge.length > 256) {
        return false;
      }

      if (db) {
        const updated = await db
          .update(authChallenges)
          .set({ consumedAt: now })
          .where(
            and(
              eq(authChallenges.challenge, challenge),
              isNull(authChallenges.consumedAt),
              gt(authChallenges.expiresAt, now),
            ),
          )
          .returning({ challenge: authChallenges.challenge });
        return updated.length === 1;
      }

      const rec = memoryChallenges.get(challenge);
      if (!rec || rec.consumed || rec.expiresAtMs <= now.getTime()) {
        return false;
      }
      rec.consumed = true;
      return true;
    },
  };
}

export interface AttestationPayload {
  challenge: string;
  platform: 'ios' | 'android' | 'web';
  proof: string;
}

export type VerifyAttestationProofFn = (payload: AttestationPayload) => Promise<boolean> | boolean;

function parseAttestationHeader(rawHeader: string): AttestationPayload | null {
  try {
    const trimmed = rawHeader.trim();
    const jsonText = trimmed.startsWith('{')
      ? trimmed
      : Buffer.from(trimmed, 'base64url').toString('utf-8');
    const parsed = JSON.parse(jsonText) as Partial<AttestationPayload>;
    if (
      typeof parsed.challenge === 'string' &&
      parsed.challenge.length > 0 &&
      (parsed.platform === 'ios' || parsed.platform === 'android' || parsed.platform === 'web') &&
      typeof parsed.proof === 'string' &&
      parsed.proof.length > 0
    ) {
      return {
        challenge: parsed.challenge,
        platform: parsed.platform,
        proof: parsed.proof,
      };
    }
  } catch {
    return null;
  }
  return null;
}

function verifyHmacAttestation(secret: string, payload: AttestationPayload): boolean {
  if (!secret) return false;
  const expected = createHmac('sha256', secret)
    .update(`${payload.platform}:${payload.challenge}`)
    .digest('hex');
  const providedBuf = Buffer.from(payload.proof, 'utf-8');
  const expectedBuf = Buffer.from(expected, 'utf-8');
  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Play Integrity / App Attest verification hook before anonymous token issue.
 * Validates single-use challenge consumption and cryptographic proof (never header presence alone).
 */
export function createAttestationMiddleware(params: {
  enforced: boolean;
  challengeStore: ChallengeStore;
  hmacSecret?: string;
  verifyProof?: VerifyAttestationProofFn;
}): MiddlewareHandler<{ Variables: RequestVariables }> {
  return async (c, next) => {
    if (!params.enforced || c.req.path === '/v1/auth/challenge') {
      await next();
      return;
    }

    const attestHeader = c.req.header('x-app-attest');
    if (!attestHeader) {
      return c.json(
        {
          code: 'attestation_required',
          message: 'App attestation proof required before issuing credential.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    const parsed = parseAttestationHeader(attestHeader);
    if (!parsed) {
      return c.json(
        {
          code: 'attestation_required',
          message: 'Malformed attestation proof envelope.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    const consumed = await params.challengeStore.consume(parsed.challenge);
    if (!consumed) {
      return c.json(
        {
          code: 'attestation_required',
          message: 'Attestation challenge is missing, expired, or already used.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    const isValid = params.verifyProof
      ? await params.verifyProof(parsed)
      : verifyHmacAttestation(params.hmacSecret ?? '', parsed);

    if (!isValid) {
      return c.json(
        {
          code: 'attestation_required',
          message: 'App attestation signature verification failed.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    await next();
  };
}

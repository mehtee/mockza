import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AppEnv } from '@mockza/config';
import { type MockzaDb, otpChallenges } from '@mockza/db';
import { and, desc, eq, isNull } from 'drizzle-orm';

export interface SmsDispatchResult {
  readonly devOtpHint?: string;
}

export interface ISmsGateway {
  readonly mode: 'kavenegar' | 'dev_sandbox';
  sendOtp(params: { phoneE164: string; code: string }): Promise<SmsDispatchResult>;
}

export class SmsGatewayError extends Error {
  constructor(
    public readonly code:
      | 'provider_not_configured'
      | 'invalid_credentials'
      | 'quota_exceeded'
      | 'internal_error',
    message: string,
    public readonly status: 401 | 429 | 502 | 503,
  ) {
    super(message);
    this.name = 'SmsGatewayError';
  }
}

export class DevSandboxSmsGateway implements ISmsGateway {
  readonly mode = 'dev_sandbox' as const;

  async sendOtp(params: { phoneE164: string; code: string }): Promise<SmsDispatchResult> {
    return {
      devOtpHint: params.code,
    };
  }
}

export class KavenegarSmsGateway implements ISmsGateway {
  readonly mode = 'kavenegar' as const;

  constructor(
    private readonly apiKey: string,
    private readonly template: string,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async sendOtp(params: { phoneE164: string; code: string }): Promise<SmsDispatchResult> {
    const url = new URL(
      `https://api.kavenegar.com/v1/${encodeURIComponent(this.apiKey)}/verify/lookup.json`,
    );
    url.searchParams.set('receptor', params.phoneE164);
    url.searchParams.set('token', params.code);
    url.searchParams.set('template', this.template);

    const res = await this.fetchFn(url.toString(), { method: 'POST' });
    if (!res.ok) {
      throw new SmsGatewayError(
        'provider_not_configured',
        `Kavenegar SMS dispatch failed with HTTP ${res.status}.`,
        502,
      );
    }
    return {};
  }
}

export function createSmsGateway(env: AppEnv, fetchFn?: typeof fetch): ISmsGateway | null {
  if (env.KAVENEGAR_API_KEY.trim().length > 0) {
    return new KavenegarSmsGateway(
      env.KAVENEGAR_API_KEY.trim(),
      env.KAVENEGAR_OTP_TEMPLATE || 'mockza-verify',
      fetchFn,
    );
  }
  if (env.NODE_ENV !== 'production' && env.ALLOW_DEV_AUTH_PROVIDERS) {
    return new DevSandboxSmsGateway();
  }
  return null;
}

interface MemoryOtpRecord {
  challengeId: string;
  phoneE164: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

const OTP_COOLDOWN_MS = 60_000;
const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;

function hashOtpCode(secret: string, phoneE164: string, code: string): string {
  return createHmac('sha256', secret).update(`${phoneE164}:${code}`, 'utf8').digest('hex');
}

function timingSafeHexEqual(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'utf8');
  const b = Buffer.from(bHex, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface OtpChallengeService {
  requestOtp(params: {
    phoneE164: string;
  }): Promise<{ retryAfterSec: number; devOtpHint?: string }>;
  verifyOtp(params: { phoneE164: string; otpCode: string }): Promise<void>;
}

export function createOtpChallengeService(
  env: AppEnv,
  db?: MockzaDb,
  gatewayOverride?: ISmsGateway | null,
): OtpChallengeService {
  const memoryChallenges: MemoryOtpRecord[] = [];
  const gateway = gatewayOverride === undefined ? createSmsGateway(env) : gatewayOverride;

  return {
    async requestOtp({ phoneE164 }) {
      if (!gateway) {
        throw new SmsGatewayError(
          'provider_not_configured',
          'SMS OTP gateway is not configured for this environment.',
          503,
        );
      }

      const now = new Date();
      if (db) {
        const [latest] = await db
          .select({ createdAt: otpChallenges.createdAt })
          .from(otpChallenges)
          .where(eq(otpChallenges.phoneE164, phoneE164))
          .orderBy(desc(otpChallenges.createdAt))
          .limit(1);

        if (latest && now.getTime() - latest.createdAt.getTime() < OTP_COOLDOWN_MS) {
          const remainingSec = Math.max(
            1,
            Math.ceil((OTP_COOLDOWN_MS - (now.getTime() - latest.createdAt.getTime())) / 1000),
          );
          throw new SmsGatewayError(
            'quota_exceeded',
            `Please wait ${remainingSec} seconds before requesting another OTP code.`,
            429,
          );
        }
      } else {
        const latest = memoryChallenges
          .filter((c) => c.phoneE164 === phoneE164)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        if (latest && now.getTime() - latest.createdAt.getTime() < OTP_COOLDOWN_MS) {
          const remainingSec = Math.max(
            1,
            Math.ceil((OTP_COOLDOWN_MS - (now.getTime() - latest.createdAt.getTime())) / 1000),
          );
          throw new SmsGatewayError(
            'quota_exceeded',
            `Please wait ${remainingSec} seconds before requesting another OTP code.`,
            429,
          );
        }
      }

      const code = String(randomInt(100_000, 999_999));
      const codeHash = hashOtpCode(env.JWT_SECRET, phoneE164, code);
      const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

      if (db) {
        await db.insert(otpChallenges).values({
          challengeId: randomUUID(),
          phoneE164,
          codeHash,
          attempts: 0,
          expiresAt,
          consumedAt: null,
          createdAt: now,
        });
      } else {
        memoryChallenges.push({
          challengeId: randomUUID(),
          phoneE164,
          codeHash,
          attempts: 0,
          expiresAt,
          consumedAt: null,
          createdAt: now,
        });
      }

      const dispatched = await gateway.sendOtp({ phoneE164, code });
      return {
        retryAfterSec: 60,
        ...(dispatched.devOtpHint ? { devOtpHint: dispatched.devOtpHint } : {}),
      };
    },

    async verifyOtp({ phoneE164, otpCode }) {
      const now = new Date();
      const expectedHash = hashOtpCode(env.JWT_SECRET, phoneE164, otpCode.trim());

      if (db) {
        const [active] = await db
          .select()
          .from(otpChallenges)
          .where(and(eq(otpChallenges.phoneE164, phoneE164), isNull(otpChallenges.consumedAt)))
          .orderBy(desc(otpChallenges.createdAt))
          .limit(1);

        if (!active || active.expiresAt <= now || active.attempts >= OTP_MAX_ATTEMPTS) {
          throw new SmsGatewayError(
            'invalid_credentials',
            'OTP code is expired or invalid. Request a fresh code.',
            401,
          );
        }

        if (!timingSafeHexEqual(expectedHash, active.codeHash)) {
          await db
            .update(otpChallenges)
            .set({ attempts: active.attempts + 1 })
            .where(eq(otpChallenges.challengeId, active.challengeId));
          throw new SmsGatewayError('invalid_credentials', 'Incorrect verification code.', 401);
        }

        await db
          .update(otpChallenges)
          .set({ consumedAt: now })
          .where(eq(otpChallenges.challengeId, active.challengeId));
        return;
      }

      const active = memoryChallenges
        .filter((c) => c.phoneE164 === phoneE164 && c.consumedAt === null)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      if (!active || active.expiresAt <= now || active.attempts >= OTP_MAX_ATTEMPTS) {
        throw new SmsGatewayError(
          'invalid_credentials',
          'OTP code is expired or invalid. Request a fresh code.',
          401,
        );
      }

      if (!timingSafeHexEqual(expectedHash, active.codeHash)) {
        active.attempts += 1;
        throw new SmsGatewayError('invalid_credentials', 'Incorrect verification code.', 401);
      }

      active.consumedAt = now;
    },
  };
}

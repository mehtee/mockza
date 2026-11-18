import { HttpAuthAdapter, type HttpAuthAdapterOptions } from '@/adapters/http/http-auth.adapter';
import type {
  AuthGatewayError,
  AuthSession,
  RequestSmsOtpInput,
  SmsOtpChallengeResult,
  VerifySmsOtpInput,
} from '@/gateways/auth.gateway';
import { err, ok, type Result } from '@/gateways/result';

const IRAN_E164_REGEX = /^\+989\d{9}$/;

export function normalizeIranPhoneE164(raw: string): string | null {
  const digitsAndPlus = raw.replace(/[\s\-()]/g, '').trim();
  let normalized = digitsAndPlus;
  if (/^09\d{9}$/.test(normalized)) {
    normalized = `+98${normalized.slice(1)}`;
  } else if (/^989\d{9}$/.test(normalized)) {
    normalized = `+${normalized}`;
  }
  return IRAN_E164_REGEX.test(normalized) ? normalized : null;
}

export class IrnOtpAuthAdapter extends HttpAuthAdapter {
  constructor(options: HttpAuthAdapterOptions) {
    super(options);
  }

  async requestSmsOtp(
    input: RequestSmsOtpInput,
  ): Promise<Result<SmsOtpChallengeResult, AuthGatewayError>> {
    const normalizedPhone = normalizeIranPhoneE164(input.phoneE164);
    if (!normalizedPhone) {
      return err({
        kind: 'validation',
        field: 'phoneE164',
        code: 'INVALID_E164',
        message: 'Invalid Iranian mobile number. Expected +989XXXXXXXXX.',
      });
    }

    const res = await this.apiClient.post<{
      readonly retryAfterSec?: number;
      readonly devOtpHint?: string;
    }>('/v1/auth/otp/request', {
      phoneE164: normalizedPhone,
    });

    if (!res.ok) {
      return err(this.mapApiErrorToAuthError(res.error));
    }

    return ok({
      retryAfterSec: res.value?.retryAfterSec ?? 60,
      ...(res.value?.devOtpHint ? { devOtpHint: res.value.devOtpHint } : {}),
    });
  }

  async verifySmsOtp(
    input: VerifySmsOtpInput,
  ): Promise<Result<AuthSession, AuthGatewayError>> {
    const normalizedPhone = normalizeIranPhoneE164(input.phoneE164);
    if (!normalizedPhone) {
      return err({
        kind: 'validation',
        field: 'phoneE164',
        code: 'INVALID_E164',
        message: 'Invalid Iranian mobile number. Expected +989XXXXXXXXX.',
      });
    }

    const code = input.otpCode.trim();
    if (!/^\d{4,8}$/.test(code)) {
      return err({
        kind: 'validation',
        field: 'otpCode',
        code: 'INVALID_OTP_CODE',
        message: 'OTP code must be 4 to 8 digits.',
      });
    }

    const displayName = input.displayName?.trim();
    return this.submitSessionAuth('/v1/auth/otp/verify', {
      phoneE164: normalizedPhone,
      otpCode: code,
      ...(displayName ? { displayName } : {}),
      ...(input.replaceSessionId ? { replaceSessionId: input.replaceSessionId } : {}),
    });
  }
}

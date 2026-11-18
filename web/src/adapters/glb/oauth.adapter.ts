import { HttpAuthAdapter, type HttpAuthAdapterOptions } from '@/adapters/http/http-auth.adapter';
import type {
  AuthGatewayError,
  OAuthSignInInput,
  AuthSession,
} from '@/gateways/auth.gateway';
import { err, type Result } from '@/gateways/result';

export const DEV_SANDBOX_OAUTH_TOKEN_PREFIX = 'mockza_dev_oauth_v1.' as const;

function encodeBase64UrlUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export class GlbOAuthAuthAdapter extends HttpAuthAdapter {
  constructor(options: HttpAuthAdapterOptions) {
    super(options);
  }

  async signInWithOAuth(
    input: OAuthSignInInput,
  ): Promise<Result<AuthSession, AuthGatewayError>> {
    let tokenToExchange = input.idTokenOrCode.trim();
    if (!tokenToExchange) {
      if (!this.allowDevAuth) {
        return err({
          kind: 'validation',
          field: 'idTokenOrCode',
          code: 'OAUTH_TOKEN_REQUIRED',
          message: `Missing ${input.provider} OAuth credential token.`,
        });
      }
      const payload = {
        provider: input.provider,
        sub: `dev-${input.provider}-${this.clock.nowMs()}`,
        email: `dev.${input.provider}@mockza.local`,
        name:
          input.displayName?.trim() ||
          `${input.provider === 'apple' ? 'Apple' : 'Google'} Dev User`,
      };
      tokenToExchange = `${DEV_SANDBOX_OAUTH_TOKEN_PREFIX}${encodeBase64UrlUtf8(JSON.stringify(payload))}`;
    }

    const displayName = input.displayName?.trim();
    return this.submitSessionAuth('/v1/auth/oauth', {
      provider: input.provider,
      idToken: tokenToExchange,
      ...(displayName ? { displayName } : {}),
      ...(input.replaceSessionId ? { replaceSessionId: input.replaceSessionId } : {}),
    });
  }
}

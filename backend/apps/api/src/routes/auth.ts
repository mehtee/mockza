import { randomBytes } from 'node:crypto';
import type { OpenAPIHono } from '@hono/zod-openapi';
import { type AppEnv, parseProviderClientIds } from '@mockza/config';
import {
  AnonymousAuthRequestSchema,
  AnonymousAuthResponseSchema,
  AuthProvidersResponseSchema,
  AuthSessionResponseSchema,
  EmailLoginRequestSchema,
  EmailRegisterRequestSchema,
  LinkAccountRequestSchema,
  LinkAccountResponseSchema,
  LogoutResponseSchema,
  OAuthSignInRequestSchema,
  OtpRequestResponseSchema,
  OtpRequestSchema,
  OtpVerifyRequestSchema,
} from '@mockza/contracts';
import { mergeAccountPersonalizationData, type MockzaDb } from '@mockza/db';
import type { Context } from 'hono';
import type { ChallengeStore } from '../middleware/attest.js';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import { createRateLimitMiddleware, resolveClientKey } from '../middleware/rate-limit.js';
import type { RequestVariables } from '../middleware/request-id.js';
import {
  type DeviceClientMeta,
  maskIpAddress,
  type ResolvedDeviceContext,
  resolveDeviceMetadata,
  resolveLocationLabel,
} from '../services/device-context.js';
import {
  ProviderTokenError,
  type VerifyProviderTokenFn,
  verifyProviderIdToken,
} from '../services/provider-verify.js';
import {
  AuthActionError,
  createSessionManager,
  DeviceSlotLimitError,
  type SessionManager,
} from '../services/session-manager.js';
import {
  createOtpChallengeService,
  type OtpChallengeService,
  SmsGatewayError,
} from '../services/sms-gateway.js';
import { reconcilePendingWebhooksForIdentities } from './webhooks-revenuecat.js';

export interface AuthRouteDeps {
  challengeStore: ChallengeStore;
  verifyProviderToken?: VerifyProviderTokenFn;
  sessionManager?: SessionManager;
  otpService?: OtpChallengeService;
}

function buildDeviceContext(
  c: Context<{ Variables: RequestVariables }>,
  trustedProxyIps: Set<string>,
  clientMeta?: DeviceClientMeta,
): ResolvedDeviceContext {
  const rawIncoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)
    ?.incoming;
  const clientIp = resolveClientKey({
    forwardedFor: c.req.header('x-forwarded-for'),
    realIp: c.req.header('x-real-ip'),
    remoteAddr: rawIncoming?.socket?.remoteAddress,
    trustedProxyIps,
  });
  const base = resolveDeviceMetadata({
    userAgent: c.req.header('user-agent'),
    secChUaMobile: c.req.header('sec-ch-ua-mobile'),
    clientMeta,
  });
  const locationLabel = resolveLocationLabel({
    headers: {
      'cf-ipcity': c.req.header('cf-ipcity'),
      'cf-ipcountry': c.req.header('cf-ipcountry'),
      'x-vercel-ip-city': c.req.header('x-vercel-ip-city'),
      'x-vercel-ip-country': c.req.header('x-vercel-ip-country'),
      'x-geo-city': c.req.header('x-geo-city'),
      'x-geo-country': c.req.header('x-geo-country'),
    },
    clientIp,
    timezone: clientMeta?.timezone,
  });

  return {
    ...base,
    ipMasked: maskIpAddress(clientIp),
    locationLabel,
  };
}

function mapAuthErrorResponse(
  c: Context<{ Variables: RequestVariables }>,
  err: unknown,
): Response | null {
  const requestId = c.get('requestId');
  if (err instanceof DeviceSlotLimitError) {
    return c.json(
      {
        code: 'device_slot_limit_reached',
        message: err.message,
        requestId,
        details: {
          slotKind: err.slotKind,
          occupyingDevice: err.occupyingDevice,
        },
      },
      409,
    );
  }
  if (err instanceof AuthActionError) {
    return c.json(
      {
        code: err.code,
        message: err.message,
        requestId,
      },
      err.status,
    );
  }
  if (err instanceof ProviderTokenError) {
    return c.json(
      {
        code: err.code,
        message: err.message,
        requestId,
      },
      err.status,
    );
  }
  if (err instanceof SmsGatewayError) {
    return c.json(
      {
        code: err.code,
        message: err.message,
        requestId,
      },
      err.status,
    );
  }
  return null;
}

export function registerAuthRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db: MockzaDb | undefined,
  deps: AuthRouteDeps,
): void {
  const sessionManager = deps.sessionManager ?? createSessionManager(env, db);
  const otpService = deps.otpService ?? createOtpChallengeService(env, db);
  const verifyProvider = deps.verifyProviderToken ?? verifyProviderIdToken;
  const trustedProxyIps = new Set(
    (env.TRUSTED_PROXY_IPS ?? '127.0.0.1,::1')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
  const strictAuthRateLimit = createRateLimitMiddleware({
    windowMs: 60_000,
    maxRequests: 25,
    trustedProxyIps,
  });

  // GET /v1/auth/providers
  app.get('/v1/auth/providers', (c) => {
    const googleIds = parseProviderClientIds(env.GOOGLE_CLIENT_ID);
    const appleIds = parseProviderClientIds(env.APPLE_CLIENT_ID);
    const devSandboxEnabled = env.NODE_ENV !== 'production' && env.ALLOW_DEV_AUTH_PROVIDERS;

    const googleMode =
      googleIds.length > 0 ? 'oidc' : devSandboxEnabled ? 'dev_sandbox' : 'disabled';
    const appleMode = appleIds.length > 0 ? 'oidc' : devSandboxEnabled ? 'dev_sandbox' : 'disabled';
    const smsOtpMode =
      env.EDITION !== 'irn'
        ? 'disabled'
        : env.KAVENEGAR_API_KEY.trim().length > 0
          ? 'kavenegar'
          : devSandboxEnabled
            ? 'dev_sandbox'
            : 'disabled';

    return c.json(
      AuthProvidersResponseSchema.parse({
        emailPasswordEnabled: true,
        google: {
          enabled: googleMode !== 'disabled',
          mode: googleMode,
          ...(googleIds[0] ? { clientId: googleIds[0] } : {}),
        },
        apple: {
          enabled: appleMode !== 'disabled',
          mode: appleMode,
          ...(appleIds[0] ? { clientId: appleIds[0] } : {}),
        },
        smsOtp: {
          enabled: smsOtpMode !== 'disabled',
          mode: smsOtpMode,
        },
        devicePolicy: {
          maxMobilePhones: 1,
          maxDesktopWebInstances: 1,
        },
      }),
      200,
    );
  });

  // POST /v1/auth/anonymous
  app.post('/v1/auth/anonymous', async (c) => {
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json(
        {
          code: 'validation_error',
          message: 'Valid JSON request body with deviceId UUID is required.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const parsed = AnonymousAuthRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        {
          code: 'validation_error',
          message: 'Invalid registration payload: deviceId must be a valid UUID.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const { deviceId, appVersion, deviceSecret, deviceMeta } = parsed.data;
    try {
      const outcome = await sessionManager.authenticateAnonymous({
        deviceId,
        appVersion,
        deviceSecret,
        authHeader: c.req.header('authorization'),
        deviceCtx: buildDeviceContext(c, trustedProxyIps, deviceMeta),
      });

      if (db) {
        const identities = [deviceId];
        if (outcome.linkedUserId) identities.push(outcome.linkedUserId);
        await reconcilePendingWebhooksForIdentities(db, identities);
      }

      return c.json(AnonymousAuthResponseSchema.parse(outcome), 201);
    } catch (err) {
      const mapped = mapAuthErrorResponse(c, err);
      if (mapped) return mapped;
      throw err;
    }
  });

  // GET /v1/auth/challenge (Single-use persisted App Attest challenge nonce)
  app.get('/v1/auth/challenge', async (c) => {
    const challenge = randomBytes(32).toString('base64url');
    const expiresAtDate = new Date(Date.now() + 5 * 60 * 1000);
    await deps.challengeStore.issue(challenge, expiresAtDate);
    return c.json({ challenge, expiresAt: expiresAtDate.toISOString() }, 200);
  });

  // POST /v1/auth/register (Email + Password sign-up under 1 Phone + 1 Desktop Web slot cap)
  app.post('/v1/auth/register', strictAuthRateLimit, async (c) => {
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json(
        {
          code: 'validation_error',
          message: 'Valid JSON registration payload required.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const parsed = EmailRegisterRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        {
          code: 'validation_error',
          message: 'Provide a valid email address and a password of at least 8 characters.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const {
      email,
      password,
      displayName,
      deviceId,
      deviceSecret,
      appVersion,
      deviceMeta,
      replaceSessionId,
    } = parsed.data;
    try {
      const bundle = await sessionManager.registerWithEmail({
        email,
        password,
        displayName,
        deviceId,
        deviceSecret,
        authHeader: c.req.header('authorization'),
        appVersion,
        deviceCtx: buildDeviceContext(c, trustedProxyIps, deviceMeta),
        replaceSessionId,
      });

      if (db) {
        await mergeAccountPersonalizationData({
          db,
          fromAccountKey: deviceId,
          toAccountKey: bundle.user.userId,
        }).catch(() => {});
        const reconciled = await reconcilePendingWebhooksForIdentities(db, [
          deviceId,
          bundle.user.userId,
        ]);
        if (reconciled > 0) {
          const refreshed = await sessionManager.getAccountSessions({
            deviceId,
            userId: bundle.user.userId,
          });
          if (refreshed.user) {
            bundle.user = refreshed.user;
          }
        }
      }

      return c.json(AuthSessionResponseSchema.parse(bundle), 201);
    } catch (err) {
      const mapped = mapAuthErrorResponse(c, err);
      if (mapped) return mapped;
      throw err;
    }
  });

  // POST /v1/auth/login (Email + Password sign-in with strict device slot check)
  app.post('/v1/auth/login', strictAuthRateLimit, async (c) => {
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json(
        {
          code: 'validation_error',
          message: 'Valid JSON login payload required.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const parsed = EmailLoginRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        {
          code: 'validation_error',
          message: 'Valid email, password, and deviceId are required.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const { email, password, deviceId, deviceSecret, appVersion, deviceMeta, replaceSessionId } =
      parsed.data;
    try {
      const bundle = await sessionManager.loginWithEmail({
        email,
        password,
        deviceId,
        deviceSecret,
        authHeader: c.req.header('authorization'),
        appVersion,
        deviceCtx: buildDeviceContext(c, trustedProxyIps, deviceMeta),
        replaceSessionId,
      });

      if (db) {
        await mergeAccountPersonalizationData({
          db,
          fromAccountKey: deviceId,
          toAccountKey: bundle.user.userId,
        }).catch(() => {});
        const reconciled = await reconcilePendingWebhooksForIdentities(db, [
          deviceId,
          bundle.user.userId,
        ]);
        if (reconciled > 0) {
          const refreshed = await sessionManager.getAccountSessions({
            deviceId,
            userId: bundle.user.userId,
          });
          if (refreshed.user) {
            bundle.user = refreshed.user;
          }
        }
      }

      return c.json(AuthSessionResponseSchema.parse(bundle), 200);
    } catch (err) {
      const mapped = mapAuthErrorResponse(c, err);
      if (mapped) return mapped;
      throw err;
    }
  });

  // POST /v1/auth/oauth (Sign in or register with Google / Apple ID token or dev sandbox token)
  app.post('/v1/auth/oauth', strictAuthRateLimit, async (c) => {
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json(
        {
          code: 'validation_error',
          message: 'Valid JSON OAuth sign-in payload required.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const parsed = OAuthSignInRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        {
          code: 'validation_error',
          message: 'Invalid OAuth sign-in payload.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const {
      provider,
      idToken,
      displayName,
      deviceId,
      deviceSecret,
      appVersion,
      deviceMeta,
      replaceSessionId,
    } = parsed.data;
    try {
      const claims = await verifyProvider({ provider, idToken, env });
      const bundle = await sessionManager.authenticateOAuth({
        claims,
        displayName,
        deviceId,
        deviceSecret,
        authHeader: c.req.header('authorization'),
        appVersion,
        deviceCtx: buildDeviceContext(c, trustedProxyIps, deviceMeta),
        replaceSessionId,
      });

      if (db) {
        await mergeAccountPersonalizationData({
          db,
          fromAccountKey: deviceId,
          toAccountKey: bundle.user.userId,
        }).catch(() => {});
        const reconciled = await reconcilePendingWebhooksForIdentities(db, [
          deviceId,
          bundle.user.userId,
        ]);
        if (reconciled > 0) {
          const refreshed = await sessionManager.getAccountSessions({
            deviceId,
            userId: bundle.user.userId,
          });
          if (refreshed.user) {
            bundle.user = refreshed.user;
          }
        }
      }

      return c.json(AuthSessionResponseSchema.parse(bundle), 200);
    } catch (err) {
      const mapped = mapAuthErrorResponse(c, err);
      if (mapped) return mapped;
      return c.json(
        {
          code: 'unauthorized',
          message: 'Failed to verify provider credential.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }
  });

  // POST /v1/auth/otp/request (IRN +98 SMS OTP challenge)
  app.post('/v1/auth/otp/request', strictAuthRateLimit, async (c) => {
    if (env.EDITION !== 'irn') {
      return c.json(
        {
          code: 'edition_forbidden',
          message: 'SMS OTP authentication is only available in the IRN (Sanjia) edition.',
          requestId: c.get('requestId'),
        },
        403,
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json(
        {
          code: 'validation_error',
          message: 'Valid JSON OTP request payload required.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const parsed = OtpRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        {
          code: 'validation_error',
          message: 'Valid Iranian mobile number (+989XXXXXXXXX) is required.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    try {
      const outcome = await otpService.requestOtp({ phoneE164: parsed.data.phoneE164 });
      return c.json(OtpRequestResponseSchema.parse(outcome), 200);
    } catch (err) {
      const mapped = mapAuthErrorResponse(c, err);
      if (mapped) return mapped;
      throw err;
    }
  });

  // POST /v1/auth/otp/verify (IRN +98 SMS OTP sign-in/sign-up with strict 1+1 slot enforcement)
  app.post('/v1/auth/otp/verify', strictAuthRateLimit, async (c) => {
    if (env.EDITION !== 'irn') {
      return c.json(
        {
          code: 'edition_forbidden',
          message: 'SMS OTP verification is only available in the IRN (Sanjia) edition.',
          requestId: c.get('requestId'),
        },
        403,
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json(
        {
          code: 'validation_error',
          message: 'Valid JSON OTP verification payload required.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const parsed = OtpVerifyRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        {
          code: 'validation_error',
          message: 'Provide a valid +989XXXXXXXXX phone number, OTP code, and deviceId.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const {
      phoneE164,
      otpCode,
      displayName,
      deviceId,
      deviceSecret,
      appVersion,
      deviceMeta,
      replaceSessionId,
    } = parsed.data;

    try {
      await otpService.verifyOtp({ phoneE164, otpCode });
      const bundle = await sessionManager.authenticateSmsOtp({
        phoneE164,
        displayName,
        deviceId,
        deviceSecret,
        authHeader: c.req.header('authorization'),
        appVersion,
        deviceCtx: buildDeviceContext(c, trustedProxyIps, deviceMeta),
        replaceSessionId,
      });

      if (db) {
        await mergeAccountPersonalizationData({
          db,
          fromAccountKey: deviceId,
          toAccountKey: bundle.user.userId,
        }).catch(() => {});
        const reconciled = await reconcilePendingWebhooksForIdentities(db, [
          deviceId,
          bundle.user.userId,
        ]);
        if (reconciled > 0) {
          const refreshed = await sessionManager.getAccountSessions({
            deviceId,
            userId: bundle.user.userId,
          });
          if (refreshed.user) {
            bundle.user = refreshed.user;
          }
        }
      }

      return c.json(AuthSessionResponseSchema.parse(bundle), 200);
    } catch (err) {
      const mapped = mapAuthErrorResponse(c, err);
      if (mapped) return mapped;
      throw err;
    }
  });

  // POST /v1/auth/link (Link verified Apple / Google provider to current authenticated device)
  const authMiddleware = createDeviceAuthMiddleware(env, db, sessionManager);
  app.post('/v1/auth/link', authMiddleware, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Valid device auth required.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          code: 'validation_error',
          message: 'Invalid JSON request payload.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const parsed = LinkAccountRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          code: 'validation_error',
          message: 'Invalid link account request payload.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const { provider, idToken, deviceMeta } = parsed.data;
    try {
      const claims = await verifyProvider({ provider, idToken, env });
      const linked = await sessionManager.linkAuthenticatedDevice({
        deviceId,
        authHeader: c.req.header('authorization'),
        claims,
        deviceCtx: buildDeviceContext(c, trustedProxyIps, deviceMeta),
      });

      if (db) {
        await mergeAccountPersonalizationData({
          db,
          fromAccountKey: deviceId,
          toAccountKey: linked.userId,
        }).catch(() => {});
        await reconcilePendingWebhooksForIdentities(db, [deviceId, linked.userId]);
      }

      return c.json(
        LinkAccountResponseSchema.parse({
          success: true,
          userId: linked.userId,
          accessToken: linked.accessToken,
          expiresAt: linked.expiresAt,
        }),
        200,
      );
    } catch (err) {
      const mapped = mapAuthErrorResponse(c, err);
      if (mapped) return mapped;
      return c.json(
        {
          code: 'unauthorized',
          message: 'Failed to verify provider credential.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }
  });

  // POST /v1/auth/logout (Vacate current device slot and downgrade to anonymous session)
  app.post('/v1/auth/logout', authMiddleware, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Valid device auth required.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    try {
      const out = await sessionManager.logoutCurrentDevice({ deviceId });
      return c.json(
        LogoutResponseSchema.parse({
          success: true,
          signedOut: true,
          accessToken: out.accessToken,
          deviceId: out.deviceId,
          expiresAt: out.expiresAt,
        }),
        200,
      );
    } catch (err) {
      const mapped = mapAuthErrorResponse(c, err);
      if (mapped) return mapped;
      throw err;
    }
  });
}

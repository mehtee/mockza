import { randomUUID } from 'node:crypto';
import { loadEnv } from '@mockza/config';
import { describe, expect, it } from 'vitest';
import { createApiApp } from '../app.js';

function createGlbEnv() {
  return loadEnv({
    NODE_ENV: 'test',
    EDITION: 'glb',
    JWT_SECRET: 'test-jwt-secret-must-exceed-32-chars-minimum',
    ALLOW_DEV_AUTH_PROVIDERS: 'true',
  });
}

function createIrnEnv() {
  return loadEnv({
    NODE_ENV: 'test',
    EDITION: 'irn',
    JWT_SECRET: 'test-jwt-secret-must-exceed-32-chars-minimum',
    ALLOW_DEV_AUTH_PROVIDERS: 'true',
    ZARINPAL_SANDBOX: 'true',
  });
}

describe('W2.1 Auth Slot Takeover, IRN OTP, Web Billing & Audio MIME', () => {
  it('supports 1 Phone + 1 Desktop coexistence, returns occupying sessionId on 409, and replaces on replaceSessionId', async () => {
    const app = createApiApp(createGlbEnv());
    const email = `slot-${randomUUID().slice(0, 8)}@example.com`;
    const password = 'StrongPassword123!';
    const phoneId = randomUUID();
    const desktop1Id = randomUUID();
    const desktop2Id = randomUUID();

    // 1. Register from mobile phone
    const phoneRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        deviceId: phoneId,
        deviceMeta: {
          slotKind: 'mobile',
          platform: 'ios',
          appSurface: 'flutter_app',
          deviceName: 'iPhone 16',
        },
      }),
    });
    expect(phoneRes.status).toBe(201);
    const phoneJson = (await phoneRes.json()) as { accessToken: string };

    // 2. Sign in from Desktop Browser 1 (coexists cleanly with mobile phone)
    const d1Res = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        deviceId: desktop1Id,
        deviceMeta: {
          slotKind: 'desktop_web',
          platform: 'web_desktop',
          appSurface: 'web_app',
          deviceName: 'Chrome Linux',
        },
      }),
    });
    expect(d1Res.status).toBe(200);
    const d1Json = (await d1Res.json()) as {
      accessToken: string;
      currentSession: { sessionId: string; appSurface: string; slotKind: string };
      sessions: unknown[];
    };
    expect(d1Json.currentSession.appSurface).toBe('web_app');
    expect(d1Json.currentSession.slotKind).toBe('desktop_web');
    expect(d1Json.sessions).toHaveLength(2);

    // 3. Sign in from Desktop Browser 2 -> 409 with occupying sessionId
    const conflictRes = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        deviceId: desktop2Id,
        deviceMeta: {
          slotKind: 'desktop_web',
          platform: 'web_desktop',
          appSurface: 'web_app',
          deviceName: 'Firefox macOS',
        },
      }),
    });
    expect(conflictRes.status).toBe(409);
    const conflictJson = (await conflictRes.json()) as {
      code: string;
      details: { slotKind: string; occupyingDevice: { sessionId: string; deviceId: string } };
    };
    expect(conflictJson.code).toBe('device_slot_limit_reached');
    expect(conflictJson.details.occupyingDevice.sessionId).toBe(d1Json.currentSession.sessionId);

    // 4. Retry login with replaceSessionId -> 200, revokes Desktop 1 while Phone stays signed in
    const takeoverRes = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        deviceId: desktop2Id,
        replaceSessionId: conflictJson.details.occupyingDevice.sessionId,
        deviceMeta: {
          slotKind: 'desktop_web',
          platform: 'web_desktop',
          appSurface: 'web_app',
          deviceName: 'Firefox macOS',
        },
      }),
    });
    expect(takeoverRes.status).toBe(200);

    // Desktop 1 token is now evicted (401); Phone token still works (200)
    const evictedCheck = await app.request('/v1/account/devices', {
      headers: { authorization: `Bearer ${d1Json.accessToken}` },
    });
    expect(evictedCheck.status).toBe(401);

    const phoneCheck = await app.request('/v1/account/devices', {
      headers: { authorization: `Bearer ${phoneJson.accessToken}` },
    });
    expect(phoneCheck.status).toBe(200);
  });

  it('strictly blocks IRN-only OTP/Zarinpal endpoints on GLB and GLB billing endpoints on IRN', async () => {
    const glbApp = createApiApp(createGlbEnv());
    const irnApp = createApiApp(createIrnEnv());

    const glbProviders = (await (await glbApp.request('/v1/auth/providers')).json()) as {
      smsOtp?: { enabled: boolean };
    };
    expect(glbProviders.smsOtp?.enabled).toBe(false);

    const glbOtp = await glbApp.request('/v1/auth/otp/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneE164: '+989123456789' }),
    });
    expect(glbOtp.status).toBe(403);

    const glbZarinpal = await glbApp.request('/v1/billing/zarinpal/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(glbZarinpal.status).toBe(403);

    const irnGlbCheckout = await irnApp.request('/v1/billing/glb/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(irnGlbCheckout.status).toBe(403);
  });

  it('completes full IRN +98 SMS OTP flow, rate limits immediate resend, and supports Zarinpal checkout -> Pro quota', async () => {
    const app = createApiApp(createIrnEnv());
    const phone = '+989123456789';
    const desktopId = randomUUID();

    const providers = (await (await app.request('/v1/auth/providers')).json()) as {
      smsOtp?: { enabled: boolean; mode: string };
    };
    expect(providers.smsOtp).toEqual({ enabled: true, mode: 'dev_sandbox' });

    const reqRes = await app.request('/v1/auth/otp/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneE164: phone }),
    });
    expect(reqRes.status).toBe(200);
    const reqJson = (await reqRes.json()) as { retryAfterSec: number; devOtpHint?: string };
    expect(reqJson.retryAfterSec).toBe(60);
    expect(reqJson.devOtpHint).toMatch(/^\d{6}$/);

    // Immediate resend triggers 429 cooldown
    const resendRes = await app.request('/v1/auth/otp/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneE164: phone }),
    });
    expect(resendRes.status).toBe(429);

    // Wrong OTP fails 401
    const badVerify = await app.request('/v1/auth/otp/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        phoneE164: phone,
        otpCode: '000000',
        deviceId: desktopId,
      }),
    });
    expect(badVerify.status).toBe(401);

    // Correct OTP succeeds 200
    const verifyRes = await app.request('/v1/auth/otp/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        phoneE164: phone,
        otpCode: reqJson.devOtpHint,
        deviceId: desktopId,
        deviceMeta: { slotKind: 'desktop_web', platform: 'web_desktop', appSurface: 'web_app' },
      }),
    });
    expect(verifyRes.status).toBe(200);
    const session = (await verifyRes.json()) as {
      accessToken: string;
      user: { phoneE164: string; linkedProviders: string[] };
      currentSession: { authMethod: string };
    };
    expect(session.user.phoneE164).toBe(phone);
    expect(session.user.linkedProviders).toContain('sms_otp');
    expect(session.currentSession.authMethod).toBe('sms_otp');

    // Amount tampering on Zarinpal checkout fails 400
    const tamperedRes = await app.request('/v1/billing/zarinpal/request', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        planId: 'mockza_pro_monthly',
        amountRial: 1000,
        acceptedSingleDevicePerSlotTos: true,
        returnUrl: 'http://127.0.0.1:45280/app/paywall',
      }),
    });
    expect(tamperedRes.status).toBe(400);

    // Valid integer-Rial Zarinpal request -> verify -> Pro quota active
    const payReqRes = await app.request('/v1/billing/zarinpal/request', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        planId: 'mockza_pro_monthly',
        amountRial: 3_900_000,
        acceptedSingleDevicePerSlotTos: true,
        returnUrl: 'http://127.0.0.1:45280/app/paywall',
      }),
    });
    expect(payReqRes.status).toBe(200);
    const payReqJson = (await payReqRes.json()) as { authority: string; redirectUrl: string };
    expect(payReqJson.authority).toBeTruthy();

    const payVerifyRes = await app.request('/v1/billing/zarinpal/verify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ authority: payReqJson.authority, status: 'OK' }),
    });
    expect(payVerifyRes.status).toBe(200);
    const verifiedEnt = (await payVerifyRes.json()) as { isPro: boolean; activePlanId: string };
    expect(verifiedEnt.isPro).toBe(true);
    expect(verifiedEnt.activePlanId).toBe('mockza_pro_monthly');

    const quotaRes = await app.request('/v1/quota/me', {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(quotaRes.status).toBe(200);
    const quotaJson = (await quotaRes.json()) as {
      isPro: boolean;
      activePlanId: string;
      source: string;
    };
    expect(quotaJson.isPro).toBe(true);
    expect(quotaJson.activePlanId).toBe('mockza_pro_monthly');
    expect(quotaJson.source).toBe('zarinpal');
  });

  it('completes GLB web checkout & verify and normalizes audio/webm;codecs=opus upload presign', async () => {
    const app = createApiApp(createGlbEnv());
    const deviceId = randomUUID();

    const regRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: `glb-${randomUUID().slice(0, 8)}@example.com`,
        password: 'StrongPassword123!',
        deviceId,
        deviceMeta: { slotKind: 'desktop_web', platform: 'web_desktop', appSurface: 'web_app' },
      }),
    });
    expect(regRes.status).toBe(201);
    const { accessToken } = (await regRes.json()) as { accessToken: string };

    // Audio codec parameter normalization on presign
    const presignRes = await app.request('/v1/uploads/presign', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        attemptId: randomUUID(),
        partIndex: 1,
        byteLength: 4096,
        contentType: 'audio/webm;codecs=opus',
      }),
    });
    expect(presignRes.status).toBe(200);
    const presignJson = (await presignRes.json()) as { objectKey: string; uploadUrl: string };
    expect(presignJson.objectKey).toMatch(/\.webm$/);
    expect(presignJson.uploadUrl).toContain('contentType=audio%2Fwebm');

    // GLB web checkout + verify + portal
    const checkoutRes = await app.request('/v1/billing/glb/checkout', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        planId: 'mockza_quarterly',
        acceptedSingleDevicePerSlotTos: true,
        returnUrl: 'http://127.0.0.1:45280/app/paywall',
      }),
    });
    expect(checkoutRes.status).toBe(200);
    const { redirectUrl } = (await checkoutRes.json()) as { redirectUrl: string };
    const sessionId = new URL(redirectUrl).searchParams.get('session_id');
    expect(sessionId).toBeTruthy();

    const verifyRes = await app.request('/v1/billing/glb/verify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ sessionId }),
    });
    expect(verifyRes.status).toBe(200);
    const ent = (await verifyRes.json()) as { isPro: boolean; activePlanId: string };
    expect(ent.isPro).toBe(true);
    expect(ent.activePlanId).toBe('mockza_quarterly');

    const portalRes = await app.request('/v1/billing/glb/portal', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(portalRes.status).toBe(200);
  });
});

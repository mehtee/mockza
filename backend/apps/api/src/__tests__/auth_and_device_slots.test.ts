import { randomUUID } from 'node:crypto';
import { loadEnv } from '@mockza/config';
import {
  createDbClient,
  devices,
  entitlements,
  userDeviceSessions,
  userEntitlements,
  users,
  webhookEvents,
} from '@mockza/db';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApiApp } from '../app.js';

const testDbUrl =
  process.env['DATABASE_URL'] ?? 'postgres://mockza:mockza_dev_password@127.0.0.1:45432/mockza';

let pgReachable = false;
const { db, sql } = createDbClient(testDbUrl, { max: 8, prepare: false });

beforeAll(async () => {
  try {
    await sql`SELECT 1`;
    pgReachable = true;
  } catch {
    pgReachable = false;
  }
});

afterAll(async () => {
  await sql.end();
});

const MOBILE_ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const DESKTOP_LINUX_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const DESKTOP_MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function devOAuthToken(params: {
  provider: 'google' | 'apple';
  sub: string;
  email: string;
  name: string;
}): string {
  const encoded = Buffer.from(JSON.stringify(params), 'utf-8').toString('base64url');
  return `mockza_dev_oauth_v1.${encoded}`;
}

describe('Auth Providers, Dev OAuth Sandbox, & Strict 1-Phone + 1-Desktop-Web Slot Enforcement', () => {
  const devEnv = loadEnv({
    EDITION: 'glb',
    NODE_ENV: 'development',
    ALLOW_DEV_AUTH_PROVIDERS: 'true',
    JWT_SECRET: 'test-secret-at-least-32-chars-long-12345',
    REVENUECAT_WEBHOOK_SECRET: 'rc-webhook-secret-999',
  });

  const strictEnv = loadEnv({
    EDITION: 'glb',
    NODE_ENV: 'test',
    ALLOW_DEV_AUTH_PROVIDERS: 'false',
    JWT_SECRET: 'test-secret-at-least-32-chars-long-12345',
    REVENUECAT_WEBHOOK_SECRET: 'rc-webhook-secret-999',
  });

  it('GET /v1/auth/providers exposes dev_sandbox in dev and disabled in test without client IDs', async () => {
    const devApp = createApiApp(devEnv);
    const devRes = await devApp.request('/v1/auth/providers');
    expect(devRes.status).toBe(200);
    const devBody = (await devRes.json()) as {
      emailPasswordEnabled: boolean;
      google: { enabled: boolean; mode: string };
      apple: { enabled: boolean; mode: string };
      devicePolicy: { maxMobilePhones: number; maxDesktopWebInstances: number };
    };
    expect(devBody.emailPasswordEnabled).toBe(true);
    expect(devBody.google).toEqual({ enabled: true, mode: 'dev_sandbox' });
    expect(devBody.apple).toEqual({ enabled: true, mode: 'dev_sandbox' });
    expect(devBody.devicePolicy).toEqual({ maxMobilePhones: 1, maxDesktopWebInstances: 1 });

    const strictApp = createApiApp(strictEnv);
    const strictRes = await strictApp.request('/v1/auth/providers');
    expect(strictRes.status).toBe(200);
    const strictBody = (await strictRes.json()) as {
      google: { enabled: boolean; mode: string };
      apple: { enabled: boolean; mode: string };
    };
    expect(strictBody.google.mode).toBe('disabled');
    expect(strictBody.apple.mode).toBe('disabled');
  });

  it('handles email register/login, rejects duplicate email and wrong password, and enforces 1+1 device slots + remote revocation in memory mode', async () => {
    const app = createApiApp(devEnv);
    const phone1Id = randomUUID();
    const phone2Id = randomUUID();
    const web1Id = randomUUID();
    const web2Id = randomUUID();
    const email = `learner.${randomUUID().slice(0, 8)}@mockza.test`;
    const password = 'StrongPassword#2026';

    // 1. Register on Phone 1
    const regRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': MOBILE_ANDROID_UA,
        'x-geo-city': 'Tehran',
        'x-geo-country': 'IR',
      },
      body: JSON.stringify({
        email,
        password,
        displayName: 'Mahdi',
        deviceId: phone1Id,
        deviceMeta: {
          slotKind: 'mobile',
          platform: 'android',
          appSurface: 'flutter_app',
          timezone: 'Asia/Tehran',
        },
      }),
    });
    expect(regRes.status).toBe(201);
    const regBody = (await regRes.json()) as {
      accessToken: string;
      user: { userId: string; email: string; linkedProviders: string[] };
      currentSession: { deviceId: string; slotKind: string; locationLabel: string };
      sessions: Array<{ deviceId: string; slotKind: string; locationLabel: string }>;
    };
    expect(regBody.user.email).toBe(email);
    expect(regBody.user.linkedProviders).toContain('email');
    expect(regBody.currentSession.slotKind).toBe('mobile');
    expect(regBody.currentSession.locationLabel).toBe('Tehran, IR');

    // 2. Duplicate registration returns 409 email_already_registered
    const dupRes = await app.request('/v1/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, deviceId: phone2Id }),
    });
    expect(dupRes.status).toBe(409);
    const dupBody = (await dupRes.json()) as { code: string };
    expect(dupBody.code).toBe('email_already_registered');

    // 3. Wrong password returns 401 invalid_credentials
    const badPwRes = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrong-password', deviceId: phone2Id }),
    });
    expect(badPwRes.status).toBe(401);
    expect(((await badPwRes.json()) as { code: string }).code).toBe('invalid_credentials');

    // 4. Desktop Web 1 signs in concurrently -> ALLOWED (occupies desktop_web slot)
    const web1Res = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': DESKTOP_LINUX_UA,
      },
      body: JSON.stringify({
        email,
        password,
        deviceId: web1Id,
        deviceMeta: { appSurface: 'web_app', timezone: 'Europe/Berlin' },
      }),
    });
    expect(web1Res.status).toBe(200);
    const web1Body = (await web1Res.json()) as {
      accessToken: string;
      sessions: Array<{ deviceId: string; slotKind: string; appSurface: string }>;
    };
    expect(web1Body.sessions).toHaveLength(2);
    expect(web1Body.sessions.map((s) => s.slotKind).sort()).toEqual(['desktop_web', 'mobile']);

    // 5. Phone 2 tries to sign in -> BLOCKED (409 device_slot_limit_reached)
    const phone2Blocked = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': MOBILE_ANDROID_UA },
      body: JSON.stringify({ email, password, deviceId: phone2Id }),
    });
    expect(phone2Blocked.status).toBe(409);
    const p2Err = (await phone2Blocked.json()) as {
      code: string;
      details?: { slotKind: string; occupyingDevice?: { deviceId: string } };
    };
    expect(p2Err.code).toBe('device_slot_limit_reached');
    expect(p2Err.details?.slotKind).toBe('mobile');
    expect(p2Err.details?.occupyingDevice?.deviceId).toBe(phone1Id);

    // 6. Desktop Web 2 tries to sign in -> BLOCKED (409 device_slot_limit_reached)
    const web2Blocked = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': DESKTOP_MAC_UA },
      body: JSON.stringify({
        email,
        password,
        deviceId: web2Id,
        deviceMeta: { appSurface: 'web_app' },
      }),
    });
    expect(web2Blocked.status).toBe(409);
    expect(
      ((await web2Blocked.json()) as { details?: { slotKind: string } }).details?.slotKind,
    ).toBe('desktop_web');

    // 7. Desktop Web 1 terminates Phone 1 remotely via DELETE /v1/account/devices/:targetDeviceId
    const revokeRes = await app.request(`/v1/account/devices/${phone1Id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${web1Body.accessToken}` },
    });
    expect(revokeRes.status).toBe(200);
    const revokeBody = (await revokeRes.json()) as {
      revokedDeviceIds: string[];
      sessions: Array<{ deviceId: string }>;
    };
    expect(revokeBody.revokedDeviceIds).toEqual([phone1Id]);
    expect(revokeBody.sessions.map((s) => s.deviceId)).toEqual([web1Id]);

    // 8. Phone 1's old JWT is IMMEDIATELY rejected with 401
    const phone1OldRes = await app.request('/v1/account/devices', {
      headers: { authorization: `Bearer ${regBody.accessToken}` },
    });
    expect(phone1OldRes.status).toBe(401);

    // 9. Phone 2 can NOW sign in cleanly to the mobile slot
    const phone2Allowed = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': MOBILE_ANDROID_UA },
      body: JSON.stringify({ email, password, deviceId: phone2Id }),
    });
    expect(phone2Allowed.status).toBe(200);

    // 10. Anti-spoofing check: mobile browser claiming slotKind='desktop_web' cannot bypass mobile lock
    const phone3SpoofId = randomUUID();
    const spoofBlocked = await app.request('/v1/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': MOBILE_ANDROID_UA },
      body: JSON.stringify({
        email,
        password,
        deviceId: phone3SpoofId,
        deviceMeta: { slotKind: 'desktop_web', platform: 'web_desktop' },
      }),
    });
    expect(spoofBlocked.status).toBe(409);
    expect(
      ((await spoofBlocked.json()) as { details?: { slotKind: string } }).details?.slotKind,
    ).toBe('mobile');
  });

  it('supports Google & Apple dev sandbox OAuth tokens in dev mode and blocks them when disabled', async () => {
    const devApp = createApiApp(devEnv);
    const strictApp = createApiApp(strictEnv);
    const phoneId = randomUUID();
    const webId = randomUUID();
    const googleSub = `google-sub-${randomUUID().slice(0, 8)}`;
    const sharedEmail = `oauth.${randomUUID().slice(0, 8)}@mockza.test`;

    // Blocked when ALLOW_DEV_AUTH_PROVIDERS=false
    const blockedRes = await strictApp.request('/v1/auth/oauth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'google',
        idToken: devOAuthToken({
          provider: 'google',
          sub: googleSub,
          email: sharedEmail,
          name: 'Dev User',
        }),
        deviceId: phoneId,
      }),
    });
    expect(blockedRes.status).toBe(401);

    // Allowed on dev app: Phone signs in with Google sandbox token
    const googleRes = await devApp.request('/v1/auth/oauth', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': MOBILE_ANDROID_UA },
      body: JSON.stringify({
        provider: 'google',
        idToken: devOAuthToken({
          provider: 'google',
          sub: googleSub,
          email: sharedEmail,
          name: 'Dev Google User',
        }),
        deviceId: phoneId,
      }),
    });
    expect(googleRes.status).toBe(200);
    const googleBody = (await googleRes.json()) as {
      user: { userId: string; email: string; linkedProviders: string[] };
    };
    expect(googleBody.user.email).toBe(sharedEmail);
    expect(googleBody.user.linkedProviders).toContain('google');

    // Desktop Web signs into same account via Apple sandbox token with same verified email
    const appleRes = await devApp.request('/v1/auth/oauth', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': DESKTOP_LINUX_UA },
      body: JSON.stringify({
        provider: 'apple',
        idToken: devOAuthToken({
          provider: 'apple',
          sub: `apple-sub-${randomUUID().slice(0, 8)}`,
          email: sharedEmail,
          name: 'Dev Apple User',
        }),
        deviceId: webId,
        deviceMeta: { appSurface: 'web_app' },
      }),
    });
    expect(appleRes.status).toBe(200);
    const appleBody = (await appleRes.json()) as {
      user: { userId: string; linkedProviders: string[] };
      sessions: Array<{ deviceId: string }>;
    };
    expect(appleBody.user.userId).toBe(googleBody.user.userId);
    expect(appleBody.user.linkedProviders.sort()).toEqual(['apple', 'google']);
    expect(appleBody.sessions).toHaveLength(2);
  });

  it('Live Postgres: persists sessions, enforces partial unique indexes, tracks policy consent, and strips Pro from logged-out device', async (ctx) => {
    if (!pgReachable) return ctx.skip();

    const app = createApiApp(devEnv, { db });
    const phone1 = randomUUID();
    const phone2 = randomUUID();
    const web1 = randomUUID();
    const email = `pg.${randomUUID().slice(0, 8)}@mockza.test`;
    const password = 'PgStrongPassword#2026';
    const webhookId = `evt-pg-${randomUUID()}`;
    let userId: string | null = null;

    try {
      const regRes = await app.request('/v1/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': MOBILE_ANDROID_UA },
        body: JSON.stringify({
          email,
          password,
          displayName: 'PG Learner',
          deviceId: phone1,
          deviceMeta: { slotKind: 'mobile', platform: 'android', timezone: 'Asia/Tehran' },
        }),
      });
      expect(regRes.status).toBe(201);
      const regBody = (await regRes.json()) as {
        accessToken: string;
        user: { userId: string; isPro: boolean };
      };
      userId = regBody.user.userId;

      // Record ToS 1+1 device policy consent
      const consentRes = await app.request('/v1/account/device-policy-consent', {
        method: 'POST',
        headers: { authorization: `Bearer ${regBody.accessToken}` },
      });
      expect(consentRes.status).toBe(200);
      const consentBody = (await consentRes.json()) as { acceptedDevicePolicyAt: string | null };
      expect(consentBody.acceptedDevicePolicyAt).toBeTruthy();

      // Grant Pro via RevenueCat webhook targeting userId
      const rcRes = await app.request('/v1/webhooks/revenuecat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer rc-webhook-secret-999',
        },
        body: JSON.stringify({
          event: {
            id: webhookId,
            type: 'INITIAL_PURCHASE',
            app_user_id: userId,
            product_id: 'mockza_pro_monthly',
            entitlement_ids: ['pro'],
            expiration_at_ms: Date.now() + 86_400_000,
            event_timestamp_ms: Date.now(),
          },
        }),
      });
      expect(rcRes.status).toBe(200);

      // Quota reflects isPro = true on phone1 AND on newly signed-in desktop web1
      const phoneQuota = await app.request('/v1/quota/me', {
        headers: { authorization: `Bearer ${regBody.accessToken}` },
      });
      expect(phoneQuota.status).toBe(200);
      expect(((await phoneQuota.json()) as { isPro: boolean }).isPro).toBe(true);

      const webRes = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': DESKTOP_LINUX_UA },
        body: JSON.stringify({
          email,
          password,
          deviceId: web1,
          deviceMeta: { appSurface: 'web_app' },
        }),
      });
      expect(webRes.status).toBe(200);
      const webBody = (await webRes.json()) as { accessToken: string; user: { isPro: boolean } };
      expect(webBody.user.isPro).toBe(true);

      // Phone1 signs out -> receives downgraded anonymous JWT with isPro = false
      const logoutRes = await app.request('/v1/auth/logout', {
        method: 'POST',
        headers: { authorization: `Bearer ${regBody.accessToken}` },
      });
      expect(logoutRes.status).toBe(200);
      const logoutBody = (await logoutRes.json()) as { signedOut: boolean; accessToken: string };
      expect(logoutBody.signedOut).toBe(true);

      const postLogoutQuota = await app.request('/v1/quota/me', {
        headers: { authorization: `Bearer ${logoutBody.accessToken}` },
      });
      expect(postLogoutQuota.status).toBe(200);
      expect(((await postLogoutQuota.json()) as { isPro: boolean }).isPro).toBe(false);

      // Desktop Web STILL has Pro = true!
      const webQuota = await app.request('/v1/quota/me', {
        headers: { authorization: `Bearer ${webBody.accessToken}` },
      });
      expect(webQuota.status).toBe(200);
      expect(((await webQuota.json()) as { isPro: boolean }).isPro).toBe(true);

      // Phone2 can now occupy the vacated mobile slot AND inherits Pro = true!
      const phone2Res = await app.request('/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': MOBILE_ANDROID_UA },
        body: JSON.stringify({ email, password, deviceId: phone2 }),
      });
      expect(phone2Res.status).toBe(200);
      expect(((await phone2Res.json()) as { user: { isPro: boolean } }).user.isPro).toBe(true);
    } finally {
      await db.delete(webhookEvents).where(eq(webhookEvents.eventId, webhookId));
      await db
        .delete(userDeviceSessions)
        .where(inArray(userDeviceSessions.deviceId, [phone1, phone2, web1]));
      await db.delete(entitlements).where(inArray(entitlements.deviceId, [phone1, phone2, web1]));
      if (userId) {
        await db.delete(userEntitlements).where(eq(userEntitlements.userId, userId));
        await db.delete(users).where(eq(users.userId, userId));
      }
      await db.delete(devices).where(inArray(devices.deviceId, [phone1, phone2, web1]));
    }
  });
});

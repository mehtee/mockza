import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockzaDexieDb } from '@/adapters/dexie/mockza-db';
import { FakeAuthAdapter } from '@/adapters/fakes/fake-auth.adapter';
import { FakeClock } from '@/adapters/fakes/fake-clock';
import { GlbOAuthAuthAdapter } from '@/adapters/glb/oauth.adapter';
import { ApiClient, isSameApiOrigin, mapHttpErrorResponse } from '@/adapters/http/api-client';
import { IrnOtpAuthAdapter } from '@/adapters/irn/otp-auth.adapter';
import type { ActiveDeviceSlot, IAuthGateway, IDeviceSlotGateway } from '@/gateways/auth.gateway';

interface AuthContractHarness {
  readonly auth: IAuthGateway;
  readonly deviceSlots: IDeviceSlotGateway;
  readonly edition: 'glb' | 'irn';
  seedOccupyingDesktopSession(accountKey: string): ActiveDeviceSlot;
  seedMobileSessionForUser(accountKey: string): ActiveDeviceSlot;
  simulateSessionRevoked(): void;
  simulatePartialErasureNext(): void;
  getAnonymousAuthCalls?(): number;
  getLastOAuthIdToken?(): string | null;
  cleanup(): Promise<void>;
}

function createMockBackendFetch(edition: 'glb' | 'irn') {
  const usersByKey = new Map<
    string,
    { userId: string; email: string | null; phoneE164: string | null; password: string | null }
  >();
  const sessionsByUserId = new Map<string, ActiveDeviceSlot[]>();
  const otpCodes = new Map<string, string>();
  const pendingErasures = new Map<string, string>();
  let revokedToken = false;
  let partialErasureNext = false;
  let anonymousCalls = 0;
  let lastOAuthIdToken: string | null = null;
  let counter = 1;

  const jsonRes = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const fetchFn: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const path = new URL(url, 'https://api.example.test').pathname;
    const method = (init?.method ?? 'GET').toUpperCase();
    const body =
      typeof init?.body === 'string' && init.body.length > 0
        ? (JSON.parse(init.body) as Record<string, unknown>)
        : {};
    const headers = new Headers(init?.headers);
    const authHeader = headers.get('authorization');

    if (revokedToken && authHeader?.includes('user-jwt-')) {
      return jsonRes(
        {
          code: 'unauthorized',
          reasonCode: 'SESSION_REVOKED',
          message: 'Session revoked remotely',
        },
        401,
      );
    }

    if (path === '/v1/auth/providers' && method === 'GET') {
      return jsonRes({
        emailPasswordEnabled: true,
        smsOtpEnabled: edition === 'irn',
        google: { enabled: edition === 'glb', mode: edition === 'glb' ? 'dev_sandbox' : 'disabled' },
        apple: { enabled: edition === 'glb', mode: edition === 'glb' ? 'dev_sandbox' : 'disabled' },
        devicePolicy: { maxMobilePhones: 1, maxDesktopWebInstances: 1 },
      });
    }

    if (path === '/v1/auth/anonymous' && method === 'POST') {
      anonymousCalls++;
      return jsonRes(
        {
          accessToken: `anon-jwt-${counter++}`,
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          deviceId: String(body['deviceId']),
          deviceSecret: 'secret-1234567890abcdef',
          linkedUserId: null,
        },
        201,
      );
    }

    const claimSlot = (
      userId: string,
      email: string | null,
      phoneE164: string | null,
      deviceId: string,
      methodName: 'email' | 'google' | 'apple',
      replaceSessionId?: string,
    ) => {
      const list = sessionsByUserId.get(userId) ?? [];
      const conflict = list.find((s) => s.slotKind === 'desktop_web' && s.deviceId !== deviceId);
      if (conflict && conflict.sessionId !== replaceSessionId) {
        return jsonRes(
          {
            code: 'device_slot_limit_reached',
            conflictCode: 'DEVICE_SLOT_OCCUPIED',
            message: 'Desktop slot is already occupied.',
            details: {
              slotKind: 'desktop_web',
              occupyingDevice: {
                sessionId: conflict.sessionId,
                deviceId: conflict.deviceId,
                deviceName: conflict.deviceName,
                slotKind: conflict.slotKind,
                locationLabel: conflict.locationLabel,
                ipCountry: 'GB',
                city: 'London',
                lastSeenAt: conflict.lastSeenAt,
              },
            },
          },
          409,
        );
      }

      const nextList = list.filter((s) => s.sessionId !== replaceSessionId && s.deviceId !== deviceId);
      const sessionId = `sess-${counter++}`;
      const currentSlot: ActiveDeviceSlot = {
        sessionId,
        deviceId,
        deviceIdShort: `${deviceId.slice(0, 8)}...`,
        slotKind: 'desktop_web',
        platform: 'web_desktop',
        appSurface: 'web_app',
        deviceName: 'Chrome on Linux Desktop',
        locationLabel: 'Local',
        ipMasked: '127.0.0.***',
        authMethod: methodName,
        isCurrentDevice: true,
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      };
      nextList.push(currentSlot);
      sessionsByUserId.set(userId, nextList);
      revokedToken = false;

      return jsonRes({
        accessToken: `user-jwt-${userId}-${counter++}`,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        deviceId,
        deviceSecret: 'secret-1234567890abcdef',
        user: {
          userId,
          email,
          phoneE164,
          displayName: (body['displayName'] as string | undefined) ?? null,
          linkedProviders: [methodName],
          isPro: false,
          acceptedDevicePolicyAt: null,
        },
        currentSession: currentSlot,
        sessions: nextList,
      });
    };

    if (path === '/v1/auth/register' && method === 'POST') {
      const email = String(body['email']).toLowerCase();
      const password = String(body['password']);
      if (!email.includes('@') || password.length < 8) {
        return jsonRes({ code: 'validation_error', message: 'Invalid email or password.' }, 400);
      }
      const userId = `u-${counter++}`;
      usersByKey.set(email, { userId, email, phoneE164: null, password });
      return claimSlot(
        userId,
        email,
        null,
        String(body['deviceId']),
        'email',
        body['replaceSessionId'] as string | undefined,
      );
    }

    if (path === '/v1/auth/login' && method === 'POST') {
      const email = String(body['email']).toLowerCase();
      const user = usersByKey.get(email);
      if (!user || user.password !== String(body['password'])) {
        return jsonRes({ code: 'invalid_credentials', message: 'Invalid credentials' }, 401);
      }
      return claimSlot(
        user.userId,
        user.email,
        null,
        String(body['deviceId']),
        'email',
        body['replaceSessionId'] as string | undefined,
      );
    }

    if (path === '/v1/auth/oauth' && method === 'POST') {
      const provider = body['provider'] === 'apple' ? 'apple' : 'google';
      lastOAuthIdToken = String(body['idToken'] ?? '');
      const email = `${provider}@oauth.test`;
      let user = usersByKey.get(email);
      if (!user) {
        user = { userId: `u-oauth-${counter++}`, email, phoneE164: null, password: null };
        usersByKey.set(email, user);
      }
      return claimSlot(
        user.userId,
        email,
        null,
        String(body['deviceId']),
        provider,
        body['replaceSessionId'] as string | undefined,
      );
    }

    if (path === '/v1/auth/otp/request' && method === 'POST') {
      const phone = String(body['phoneE164']);
      otpCodes.set(phone, '123456');
      return jsonRes({ retryAfterSec: 60, devOtpHint: '123456' });
    }

    if (path === '/v1/auth/otp/verify' && method === 'POST') {
      const phone = String(body['phoneE164']);
      const code = String(body['otpCode']);
      if (otpCodes.get(phone) !== code) {
        return jsonRes({ code: 'invalid_credentials', message: 'Invalid OTP' }, 401);
      }
      let user = usersByKey.get(phone);
      if (!user) {
        user = { userId: `u-irn-${counter++}`, email: null, phoneE164: phone, password: null };
        usersByKey.set(phone, user);
      }
      return claimSlot(
        user.userId,
        null,
        phone,
        String(body['deviceId']),
        'email',
        body['replaceSessionId'] as string | undefined,
      );
    }

    if (path === '/v1/auth/logout' && method === 'POST') {
      return jsonRes({
        success: true,
        signedOut: true,
        accessToken: `anon-jwt-${counter++}`,
        deviceId: '00000000-0000-4000-8000-000000000001',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      });
    }

    if (path === '/v1/account/devices' && method === 'GET') {
      const userId = authHeader?.match(/user-jwt-(u[^-]*-[^-]*|[^-]+)/)?.[1];
      const all = Array.from(sessionsByUserId.values()).flat();
      return jsonRes({
        isAuthenticated: true,
        user: null,
        currentDeviceId: 'dev',
        sessions: userId ? (sessionsByUserId.get(userId) ?? all) : all,
      });
    }

    if (path === '/v1/account/devices/revoke-others' && method === 'POST') {
      for (const [uid, list] of sessionsByUserId.entries()) {
        sessionsByUserId.set(
          uid,
          list.filter((s) => s.isCurrentDevice),
        );
      }
      return jsonRes({
        success: true,
        revokedDeviceIds: ['other-dev'],
        signedOutCurrentDevice: false,
        sessions: Array.from(sessionsByUserId.values()).flat(),
      });
    }

    if (path.startsWith('/v1/account/devices/') && method === 'DELETE') {
      const targetId = decodeURIComponent(path.split('/').pop() ?? '');
      let found = false;
      for (const [uid, list] of sessionsByUserId.entries()) {
        if (list.some((s) => s.deviceId === targetId)) {
          found = true;
          sessionsByUserId.set(
            uid,
            list.filter((s) => s.deviceId !== targetId),
          );
        }
      }
      if (!found) {
        return jsonRes({ code: 'not_found', message: `Device not found: ${targetId}` }, 404);
      }
      return jsonRes({
        success: true,
        revokedDeviceIds: [targetId],
        signedOutCurrentDevice: false,
        sessions: Array.from(sessionsByUserId.values()).flat(),
      });
    }

    if (path === '/v1/account/device-policy-consent' && method === 'POST') {
      return jsonRes({
        acceptedDevicePolicyAt: new Date().toISOString(),
      });
    }

    if (path === '/v1/account' && method === 'DELETE') {
      usersByKey.clear();
      sessionsByUserId.clear();
      const erasureId = `erasure-${counter++}`;
      const receiptToken = `rcpt-${counter++}`;
      if (partialErasureNext) {
        partialErasureNext = false;
        pendingErasures.set(erasureId, receiptToken);
        return jsonRes(
          {
            code: 'erasure_incomplete',
            message: 'Account records were erased, but media storage deletion failed.',
            erasureId,
            receiptToken,
          },
          503,
        );
      }
      return jsonRes({
        success: true,
        deleted: true,
        erasureId,
        receiptToken,
      });
    }

    const retryMatch = path.match(/^\/v1\/erasure\/([^/]+)\/retry$/);
    if (retryMatch && method === 'POST') {
      const erasureId = decodeURIComponent(retryMatch[1] ?? '');
      const receipt = headers.get('x-erasure-receipt');
      if (!receipt || pendingErasures.get(erasureId) !== receipt) {
        return jsonRes({ code: 'unauthorized', message: 'Invalid erasure receipt.' }, 401);
      }
      pendingErasures.delete(erasureId);
      return jsonRes({
        success: true,
        erasureId,
        status: 'completed',
      });
    }

    return jsonRes({ code: 'not_found', message: `Unhandled ${method} ${path}` }, 404);
  };

  const seedSlotForAccount = (
    accountKey: string,
    slotKind: 'desktop_web' | 'mobile',
  ): ActiveDeviceSlot => {
    const key = accountKey.toLowerCase();
    let user = usersByKey.get(key);
    if (!user) {
      user = {
        userId: `u-seeded-${counter++}`,
        email: accountKey.includes('@') ? key : null,
        phoneE164: accountKey.startsWith('+') ? accountKey : null,
        password: 'password123',
      };
      usersByKey.set(key, user);
    }
    const deviceId =
      slotKind === 'mobile'
        ? '33333333-3333-4333-8333-333333333333'
        : '22222222-2222-4222-8222-222222222222';
    const slot: ActiveDeviceSlot = {
      sessionId: `sess-occupied-${counter++}`,
      deviceId,
      deviceIdShort: `${deviceId.slice(0, 8)}...`,
      slotKind,
      platform: slotKind === 'mobile' ? 'android' : 'web_desktop',
      appSurface: slotKind === 'mobile' ? 'flutter_app' : 'web_app',
      deviceName: slotKind === 'mobile' ? 'Pixel 8' : 'Safari on macOS',
      locationLabel: 'Berlin, DE',
      ipMasked: '198.51.100.***',
      authMethod: 'email',
      isCurrentDevice: false,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };
    const existing = sessionsByUserId.get(user.userId) ?? [];
    sessionsByUserId.set(user.userId, [...existing, slot]);
    return slot;
  };

  return {
    fetchFn,
    seedOccupyingDesktopSession: (accountKey: string) => seedSlotForAccount(accountKey, 'desktop_web'),
    seedMobileSessionForUser: (accountKey: string) => seedSlotForAccount(accountKey, 'mobile'),
    simulateSessionRevoked() {
      revokedToken = true;
    },
    simulatePartialErasureNext() {
      partialErasureNext = true;
    },
    getAnonymousAuthCalls: () => anonymousCalls,
    getLastOAuthIdToken: () => lastOAuthIdToken,
  };
}

function runAuthContractSuite(name: string, createHarness: () => Promise<AuthContractHarness>) {
  describe(`IAuthGateway & IDeviceSlotGateway LSP contract: ${name}`, () => {
    let harness: AuthContractHarness | null = null;

    afterEach(async () => {
      if (harness) {
        await harness.cleanup();
        harness = null;
      }
    });

    it('provides persistent desktop_web DeviceIdentity and single-flight anonymous auth', async () => {
      harness = await createHarness();
      const id1 = await harness.auth.getDeviceIdentity();
      const id2 = await harness.auth.getDeviceIdentity();
      expect(id1.ok).toBe(true);
      expect(id2.ok).toBe(true);
      if (id1.ok && id2.ok) {
        expect(id1.value.deviceInstallId).toBe(id2.value.deviceInstallId);
        expect(id1.value.slotKind).toBe('desktop_web');
        expect(id1.value.platform).toBe('web_desktop');
        expect(id1.value.appSurface).toBe('web_app');
      }

      const [a1, a2] = await Promise.all([
        harness.auth.ensureAuthenticated(),
        harness.auth.ensureAuthenticated(),
      ]);
      expect(a1.ok).toBe(true);
      expect(a2.ok).toBe(true);
      if (a1.ok && a2.ok) {
        expect(a1.value.accessToken).toBe(a2.value.accessToken);
      }
    });

    it('supports email sign-up, sign-in, session change listeners, device policy consent, and sign-out', async () => {
      harness = await createHarness();
      const events: (string | null)[] = [];
      const unsub = harness.auth.onSessionChanged((s) => {
        events.push(s?.user?.email ?? null);
      });

      const providers = await harness.auth.fetchAuthProviders();
      expect(providers.ok).toBe(true);
      if (providers.ok) {
        expect(providers.value.devicePolicy.maxDesktopWebInstances).toBe(1);
        expect(providers.value.devicePolicy.maxMobilePhones).toBe(1);
      }

      const signUp = await harness.auth.signUpWithEmail({
        email: 'learner@mockza.test',
        password: 'password123',
        displayName: 'Test Learner',
      });
      expect(signUp.ok).toBe(true);
      if (signUp.ok) {
        expect(signUp.value.isAuthenticated).toBe(true);
        expect(signUp.value.user?.email).toBe('learner@mockza.test');
      }

      const consent = await harness.deviceSlots.recordDevicePolicyConsent();
      expect(consent.ok).toBe(true);

      const devices = await harness.deviceSlots.listActiveDevices();
      expect(devices.ok).toBe(true);
      if (devices.ok) {
        expect(devices.value.length).toBeGreaterThanOrEqual(1);
      }

      const out = await harness.auth.signOutCurrentDevice();
      expect(out.ok).toBe(true);
      expect(events).toContain('learner@mockza.test');
      expect(events[events.length - 1]).toBeNull();
      const postSignOut = await harness.auth.getSession();
      expect(postSignOut.ok).toBe(true);
      if (postSignOut.ok) {
        expect(postSignOut.value?.isAuthenticated).toBe(false);
        expect(postSignOut.value?.user).toBeNull();
      }
      unsub();
    });

    it('handles signOutCurrentDevice() cleanly when initial session is null', async () => {
      harness = await createHarness();
      const before = await harness.auth.getSession();
      expect(before.ok && before.value).toBeNull();
      const res = await harness.auth.signOutCurrentDevice();
      expect(res.ok).toBe(true);
      const after = await harness.auth.getSession();
      expect(after.ok && after.value?.isAuthenticated).toBe(false);
    });

    it('revokes another device session by targetDeviceId (not sessionId)', async () => {
      harness = await createHarness();
      const mobileSlot = harness.seedMobileSessionForUser('mobile-owner@mockza.test');
      const signIn = await harness.auth.signInWithEmail({
        email: 'mobile-owner@mockza.test',
        password: 'password123',
      });
      expect(signIn.ok).toBe(true);

      // Passing sessionId instead of deviceId must fail cleanly
      const wrongIdRes = await harness.deviceSlots.revokeDeviceSession(mobileSlot.sessionId);
      expect(wrongIdRes.ok).toBe(false);

      const revokeRes = await harness.deviceSlots.revokeDeviceSession(mobileSlot.deviceId);
      expect(revokeRes.ok).toBe(true);
      if (revokeRes.ok) {
        expect(revokeRes.value.revokedDeviceIds).toContain(mobileSlot.deviceId);
        expect(revokeRes.value.sessions.some((s) => s.deviceId === mobileSlot.deviceId)).toBe(false);
      }
    });

    it('persists 503 pendingErasureReceipt, blocks ensureAuthenticated with ERASURE_PENDING, and resumes via retry', async () => {
      harness = await createHarness();
      const signUp = await harness.auth.signUpWithEmail({
        email: 'erase503@mockza.test',
        password: 'password123',
      });
      expect(signUp.ok).toBe(true);

      harness.simulatePartialErasureNext();
      const partialRes = await harness.auth.deleteRemoteAccount();
      expect(partialRes.ok).toBe(false);
      if (!partialRes.ok) {
        expect(partialRes.error.kind).toBe('network');
        if (partialRes.error.kind === 'network') {
          expect(partialRes.error.status).toBe(503);
        }
      }

      const blockedAuth = await harness.auth.ensureAuthenticated();
      expect(blockedAuth.ok).toBe(false);
      if (!blockedAuth.ok && blockedAuth.error.kind === 'validation') {
        expect(blockedAuth.error.code).toBe('ERASURE_PENDING');
      }

      const resumed = await harness.auth.deleteRemoteAccount();
      expect(resumed.ok).toBe(true);
      if (resumed.ok) {
        expect(resumed.value.deleted).toBe(true);
      }

      const authAfterRetry = await harness.auth.ensureAuthenticated();
      expect(authAfterRetry.ok).toBe(true);
    });

    it('enforces 409 DEVICE_SLOT_OCCUPIED and supports 1-click replaceSessionId takeover', async () => {
      harness = await createHarness();
      const occupying = harness.seedOccupyingDesktopSession('occupied@mockza.test');

      const blocked = await harness.auth.signInWithEmail({
        email: 'occupied@mockza.test',
        password: 'password123',
      });
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.error.kind).toBe('device_slot_occupied');
        if (blocked.error.kind === 'device_slot_occupied') {
          expect(blocked.error.conflictCode).toBe('DEVICE_SLOT_OCCUPIED');
          expect(blocked.error.occupyingDevice.sessionId).toBe(occupying.sessionId);
        }
      }

      const takeover = await harness.auth.signInWithEmail({
        email: 'occupied@mockza.test',
        password: 'password123',
        replaceSessionId: occupying.sessionId,
      });
      expect(takeover.ok).toBe(true);
      if (takeover.ok) {
        expect(takeover.value.isAuthenticated).toBe(true);
      }

      const revokeOthers = await harness.deviceSlots.revokeOtherDeviceSessions();
      expect(revokeOthers.ok).toBe(true);

      const deleted = await harness.auth.deleteRemoteAccount();
      expect(deleted.ok).toBe(true);
      if (deleted.ok) {
        expect(deleted.value.deleted).toBe(true);
      }
    });

    it('surfaces 401 SESSION_REVOKED when remote session is terminated without downgrading to anonymous auth', async () => {
      harness = await createHarness();
      const signUp = await harness.auth.signUpWithEmail({
        email: 'revoked@mockza.test',
        password: 'password123',
      });
      expect(signUp.ok).toBe(true);

      const anonCallsBefore = harness.getAnonymousAuthCalls?.() ?? 0;
      const sessionEvents: (boolean | null)[] = [];
      const unsub = harness.auth.onSessionChanged((s) => {
        sessionEvents.push(s === null ? null : s.isAuthenticated);
      });

      harness.simulateSessionRevoked();
      const devices = await harness.deviceSlots.listActiveDevices();
      expect(devices.ok).toBe(false);
      if (!devices.ok) {
        expect(devices.error.kind).toBe('unauthorized');
        if (devices.error.kind === 'unauthorized') {
          expect(devices.error.reasonCode).toBe('SESSION_REVOKED');
        }
      }

      expect(harness.getAnonymousAuthCalls?.() ?? 0).toBe(anonCallsBefore);
      expect(sessionEvents).toContain(null);
      const afterRevoke = await harness.auth.getSession();
      expect(afterRevoke.ok && afterRevoke.value).toBeNull();
      unsub();
    });

    it('exercises edition-specific auth methods (GLB OAuth / IRN +98 SMS OTP)', async () => {
      harness = await createHarness();
      if (harness.edition === 'glb' && harness.auth.signInWithOAuth) {
        const res = await harness.auth.signInWithOAuth({
          provider: 'google',
          idTokenOrCode: '',
          displayName: 'Google User',
        });
        expect(res.ok).toBe(true);
        const postedToken = harness.getLastOAuthIdToken?.();
        if (postedToken !== undefined) {
          expect(postedToken).toMatch(/^mockza_dev_oauth_v1\./);
        }
      } else if (harness.edition === 'irn' && harness.auth.requestSmsOtp && harness.auth.verifySmsOtp) {
        const bad = await harness.auth.requestSmsOtp({ phoneE164: '12345' });
        expect(bad.ok).toBe(false);
        const otp = await harness.auth.requestSmsOtp({ phoneE164: '09121234567' });
        expect(otp.ok).toBe(true);
        const verified = await harness.auth.verifySmsOtp({
          phoneE164: '989121234567',
          otpCode: '123456',
        });
        expect(verified.ok).toBe(true);
        if (verified.ok) {
          expect(verified.value.user?.phoneE164).toBe('+989121234567');
        }
      }
    });
  });
}

runAuthContractSuite('FakeAuthAdapter (GLB)', async () => {
  const fake = new FakeAuthAdapter({ edition: 'glb', allowDevAuth: true });
  return {
    auth: fake,
    deviceSlots: fake,
    edition: 'glb',
    seedOccupyingDesktopSession: (email) => fake.seedOccupyingDesktopSession(email),
    seedMobileSessionForUser: (email) =>
      fake.seedOccupyingDesktopSession(email, {
        deviceId: '33333333-3333-4333-8333-333333333333',
        slotKind: 'mobile',
        platform: 'android',
        appSurface: 'flutter_app',
        deviceName: 'Pixel 8',
      }),
    simulateSessionRevoked: () => fake.simulateRemoteSessionRevoked(),
    simulatePartialErasureNext: () => fake.simulatePartialErasureNext(true),
    cleanup: async () => {},
  };
});

runAuthContractSuite('FakeAuthAdapter (IRN)', async () => {
  const fake = new FakeAuthAdapter({ edition: 'irn', allowDevAuth: true });
  return {
    auth: fake,
    deviceSlots: fake,
    edition: 'irn',
    seedOccupyingDesktopSession: (key) => fake.seedOccupyingDesktopSession(key),
    seedMobileSessionForUser: (key) =>
      fake.seedOccupyingDesktopSession(key, {
        deviceId: '33333333-3333-4333-8333-333333333333',
        slotKind: 'mobile',
        platform: 'android',
        appSurface: 'flutter_app',
        deviceName: 'Pixel 8',
      }),
    simulateSessionRevoked: () => fake.simulateRemoteSessionRevoked(),
    simulatePartialErasureNext: () => fake.simulatePartialErasureNext(true),
    cleanup: async () => {},
  };
});

runAuthContractSuite('GlbOAuthAuthAdapter (HTTP)', async () => {
  const clock = new FakeClock();
  const db = new MockzaDexieDb(`auth-glb-${Date.now()}-${Math.random()}`);
  const backend = createMockBackendFetch('glb');
  let adapter: GlbOAuthAuthAdapter | null = null;
  const apiClient = new ApiClient({
    apiBaseUrl: 'https://api.mockza.com',
    edition: 'glb',
    fetchFn: backend.fetchFn,
    readAccessToken: () => adapter?.getCurrentAccessToken() ?? null,
    refreshAccessToken: async () => {
      if (!adapter) return null;
      const current = await adapter.getSession();
      const wasAuthenticated = current.ok && Boolean(current.value?.isAuthenticated);
      const res = await adapter.ensureAuthenticated(true);
      if (!res.ok) return null;
      if (wasAuthenticated && !res.value.isAuthenticated) {
        return null;
      }
      return res.value.accessToken;
    },
    onSessionRevoked: () => adapter?.handleRemoteSessionRevoked(),
  });
  adapter = new GlbOAuthAuthAdapter({ apiClient, db, clock, allowDevAuth: true });
  return {
    auth: adapter,
    deviceSlots: adapter,
    edition: 'glb',
    seedOccupyingDesktopSession: backend.seedOccupyingDesktopSession,
    seedMobileSessionForUser: backend.seedMobileSessionForUser,
    simulateSessionRevoked: backend.simulateSessionRevoked,
    simulatePartialErasureNext: backend.simulatePartialErasureNext,
    getAnonymousAuthCalls: backend.getAnonymousAuthCalls,
    getLastOAuthIdToken: backend.getLastOAuthIdToken,
    cleanup: async () => {
      await db.delete();
    },
  };
});

runAuthContractSuite('IrnOtpAuthAdapter (HTTP)', async () => {
  const clock = new FakeClock();
  const db = new MockzaDexieDb(`auth-irn-${Date.now()}-${Math.random()}`);
  const backend = createMockBackendFetch('irn');
  let adapter: IrnOtpAuthAdapter | null = null;
  const apiClient = new ApiClient({
    apiBaseUrl: 'https://api.sanjia.ir',
    edition: 'irn',
    fetchFn: backend.fetchFn,
    readAccessToken: () => adapter?.getCurrentAccessToken() ?? null,
    refreshAccessToken: async () => {
      if (!adapter) return null;
      const current = await adapter.getSession();
      const wasAuthenticated = current.ok && Boolean(current.value?.isAuthenticated);
      const res = await adapter.ensureAuthenticated(true);
      if (!res.ok) return null;
      if (wasAuthenticated && !res.value.isAuthenticated) {
        return null;
      }
      return res.value.accessToken;
    },
    onSessionRevoked: () => adapter?.handleRemoteSessionRevoked(),
  });
  adapter = new IrnOtpAuthAdapter({ apiClient, db, clock, allowDevAuth: true });
  return {
    auth: adapter,
    deviceSlots: adapter,
    edition: 'irn',
    seedOccupyingDesktopSession: backend.seedOccupyingDesktopSession,
    seedMobileSessionForUser: backend.seedMobileSessionForUser,
    simulateSessionRevoked: backend.simulateSessionRevoked,
    simulatePartialErasureNext: backend.simulatePartialErasureNext,
    getAnonymousAuthCalls: backend.getAnonymousAuthCalls,
    cleanup: async () => {
      await db.delete();
    },
  };
});

describe('ApiClient origin isolation, signed-PUT header stripping & single-flight 401 refresh', () => {
  it('strips authorization, x-mockza-edition, and credentials on cross-origin and signed-put URLs', async () => {
    const calls: { url: string; headers: Headers; credentials?: RequestCredentials }[] = [];
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push({
        url,
        headers: new Headers(init?.headers),
        credentials: init?.credentials,
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new ApiClient({
      apiBaseUrl: 'https://api.mockza.com',
      edition: 'glb',
      fetchFn: fetchMock,
      readAccessToken: () => 'secret-bearer-token',
    });

    await client.get('/v1/catalog/manifest');
    await client.put('https://s3.eu-central-1.amazonaws.com/bucket/clip.m4a?X-Amz-Signature=abc', 'audio');
    await client.put('/v1/uploads/signed-put?sig=xyz', 'audio');

    expect(calls[0]?.headers.get('authorization')).toBe('Bearer secret-bearer-token');
    expect(calls[0]?.headers.get('x-mockza-edition')).toBe('glb');
    expect(calls[0]?.credentials).toBe('include');

    expect(calls[1]?.headers.get('authorization')).toBeNull();
    expect(calls[1]?.headers.get('x-mockza-edition')).toBeNull();
    expect(calls[1]?.credentials).toBe('omit');

    expect(calls[2]?.headers.get('authorization')).toBeNull();
    expect(calls[2]?.headers.get('x-mockza-edition')).toBeNull();
    expect(calls[2]?.credentials).toBe('omit');
  });

  it('coalesces concurrent 401 responses onto a single-flight token refresh and retries once', async () => {
    let token = 'expired-token';
    let refreshCalls = 0;

    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      const auth = new Headers(init?.headers).get('authorization');
      if (auth === 'Bearer fresh-token') {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ code: 'unauthorized', message: 'Expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new ApiClient({
      apiBaseUrl: 'https://api.mockza.com',
      edition: 'glb',
      fetchFn: fetchMock,
      readAccessToken: () => token,
      refreshAccessToken: async () => {
        refreshCalls++;
        await new Promise((r) => setTimeout(r, 10));
        token = 'fresh-token';
        return token;
      },
    });

    const [r1, r2] = await Promise.all([
      client.get<{ ok: boolean }>('/v1/quota/me'),
      client.get<{ ok: boolean }>('/v1/catalog/manifest'),
    ]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(refreshCalls).toBe(1);
  });

  it('rejects protocol-relative //evil.com URLs in isSameApiOrigin and parses retry-after strictly', async () => {
    expect(isSameApiOrigin('//evil.com/x', '')).toBe(false);
    expect(isSameApiOrigin('//evil.com/x', 'https://api.mockza.com')).toBe(false);

    const dateErr = mapHttpErrorResponse(
      429,
      { code: 'quota_exceeded', message: 'Slow down' },
      new Headers({ 'retry-after': '12 Nov 2026 00:00:00 GMT' }),
    );
    expect(dateErr.kind).toBe('quota_exceeded');
    if (dateErr.kind === 'quota_exceeded') {
      expect(dateErr.retryAfterSec).toBeUndefined();
    }

    const intErr = mapHttpErrorResponse(
      429,
      { code: 'quota_exceeded', message: 'Slow down' },
      new Headers({ 'retry-after': '45' }),
    );
    expect(intErr.kind === 'quota_exceeded');
    if (intErr.kind === 'quota_exceeded') {
      expect(intErr.retryAfterSec).toBe(45);
    }
  });

  it('skips refreshAccessToken and fires onSessionRevoked on 401 SESSION_REVOKED', async () => {
    let refreshCalls = 0;
    let revokedCount = 0;

    const client = new ApiClient({
      apiBaseUrl: 'https://api.mockza.com',
      edition: 'glb',
      readAccessToken: () => 'user-jwt-123',
      refreshAccessToken: async () => {
        refreshCalls++;
        return 'anon-jwt-should-not-happen';
      },
      onSessionRevoked: () => {
        revokedCount++;
      },
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            code: 'unauthorized',
            reasonCode: 'SESSION_REVOKED',
            message: 'Session was terminated from another device.',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
    });

    const res = await client.get('/v1/account/devices');
    expect(res.ok).toBe(false);
    expect(refreshCalls).toBe(0);
    expect(revokedCount).toBe(1);
    if (!res.ok && res.error.kind === 'unauthorized') {
      expect(res.error.reasonCode).toBe('SESSION_REVOKED');
    }
  });
});

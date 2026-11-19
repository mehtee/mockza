import type {
  AccountDeletionReceipt,
  ActiveDeviceSlot,
  AuthenticatedUser,
  AuthGatewayError,
  AuthProvidersSnapshot,
  AuthSession,
  DeviceIdentity,
  DeviceSlotGatewayError,
  EmailSignInInput,
  EmailSignUpInput,
  IAuthGateway,
  IDeviceSlotGateway,
  OAuthSignInInput,
  RequestSmsOtpInput,
  RevokeDeviceSessionResult,
  SmsOtpChallengeResult,
  VerifySmsOtpInput,
} from '@/gateways/auth.gateway';
import {
  err,
  ok,
  type NetworkError,
  type Result,
  type StorageError,
  type UnexpectedError,
} from '@/gateways/result';
import type { IClock } from '@/gateways/telemetry.gateway';
import { FakeClock } from './fake-clock';

interface FakeUserAccount {
  readonly userId: string;
  readonly email: string | null;
  readonly phoneE164: string | null;
  readonly password: string | null;
  displayName: string | null;
  linkedProviders: ('email' | 'google' | 'apple' | 'sms_otp')[];
  isPro: boolean;
  acceptedDevicePolicyAt: string | null;
}

export interface FakeAuthAdapterOptions {
  readonly clock?: IClock;
  readonly deviceInstallId?: string;
  readonly edition?: 'glb' | 'irn';
  readonly simulateOffline?: boolean;
  readonly allowDevAuth?: boolean;
}

const IRAN_E164_REGEX = /^\+989\d{9}$/;

function normalizeIranPhoneE164(raw: string): string | null {
  const digitsAndPlus = raw.replace(/[\s\-()]/g, '').trim();
  let normalized = digitsAndPlus;
  if (/^09\d{9}$/.test(normalized)) {
    normalized = `+98${normalized.slice(1)}`;
  } else if (/^989\d{9}$/.test(normalized)) {
    normalized = `+${normalized}`;
  }
  return IRAN_E164_REGEX.test(normalized) ? normalized : null;
}

function encodeBase64UrlUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export class FakeAuthAdapter implements IAuthGateway, IDeviceSlotGateway {
  private readonly clock: IClock;
  private readonly edition: 'glb' | 'irn';
  private readonly deviceInstallId: string;
  private readonly allowDevAuth: boolean;
  private readonly listeners = new Set<(session: AuthSession | null) => void>();
  private readonly revokedListeners = new Set<() => void>();
  private readonly usersByKey = new Map<string, FakeUserAccount>();
  private readonly otpByPhone = new Map<string, string>();
  private readonly activeSessionsByUserId = new Map<string, ActiveDeviceSlot[]>();
  private currentSession: AuthSession | null = null;
  private nextCounter = 1;
  private simulateOffline: boolean;
  private sessionRevokedPending = false;
  private simulatePartialErasure = false;
  private pendingErasureReceipt: { readonly erasureId: string; readonly receiptToken: string } | null = null;

  constructor(options: FakeAuthAdapterOptions = {}) {
    this.clock = options.clock ?? new FakeClock();
    this.edition = options.edition ?? 'glb';
    this.deviceInstallId =
      options.deviceInstallId ?? '00000000-0000-4000-8000-000000000101';
    this.simulateOffline = options.simulateOffline ?? false;
    this.allowDevAuth = options.allowDevAuth ?? false;
  }

  setOffline(offline: boolean): void {
    this.simulateOffline = offline;
  }

  simulatePartialErasureNext(partial: boolean = true): void {
    this.simulatePartialErasure = partial;
  }

  seedOccupyingDesktopSession(
    accountKey: string,
    slot?: Partial<ActiveDeviceSlot>,
  ): ActiveDeviceSlot {
    const existing = this.usersByKey.get(accountKey);
    const userId =
      existing?.userId ?? `user-seeded-${this.nextCounter++}`;
    if (!existing) {
      this.usersByKey.set(accountKey, {
        userId,
        email: accountKey.includes('@') ? accountKey : null,
        phoneE164: accountKey.startsWith('+') ? accountKey : null,
        password: 'password123',
        displayName: 'Seeded Learner',
        linkedProviders: [accountKey.startsWith('+') ? 'sms_otp' : 'email'],
        isPro: false,
        acceptedDevicePolicyAt: null,
      });
    }

    const deviceSlot: ActiveDeviceSlot = {
      sessionId: slot?.sessionId ?? `sess-other-desktop-${this.nextCounter++}`,
      deviceId: slot?.deviceId ?? '11111111-1111-4111-8111-111111111111',
      deviceIdShort: '11111111...',
      slotKind: slot?.slotKind ?? 'desktop_web',
      platform: slot?.platform ?? 'web_desktop',
      appSurface: slot?.appSurface ?? 'web_app',
      deviceName: slot?.deviceName ?? 'Chrome on macOS',
      locationLabel: slot?.locationLabel ?? 'London, GB',
      ipMasked: slot?.ipMasked ?? '198.51.100.***',
      authMethod: slot?.authMethod ?? 'email',
      isCurrentDevice: false,
      createdAt: slot?.createdAt ?? this.clock.nowIso(),
      lastSeenAt: slot?.lastSeenAt ?? this.clock.nowIso(),
    };

    const list = this.activeSessionsByUserId.get(userId) ?? [];
    list.push(deviceSlot);
    this.activeSessionsByUserId.set(userId, list);
    return deviceSlot;
  }

  simulateRemoteSessionRevoked(): void {
    this.sessionRevokedPending = true;
    this.notifyListeners(null);
    for (const listener of this.revokedListeners) {
      listener();
    }
  }

  private notifyListeners(session: AuthSession | null): void {
    this.currentSession = session;
    for (const listener of this.listeners) {
      listener(session);
    }
  }

  private offlineError(): NetworkError {
    return {
      kind: 'network',
      message: 'FakeAuthAdapter is offline',
      retryable: true,
    };
  }

  async getDeviceIdentity(): Promise<Result<DeviceIdentity, StorageError | UnexpectedError>> {
    return ok({
      deviceInstallId: this.deviceInstallId,
      slotKind: 'desktop_web',
      platform: 'web_desktop',
      appSurface: 'web_app',
      deviceLabel: 'Fake Desktop Browser',
      timezone: 'UTC',
    });
  }

  async getSession(): Promise<Result<AuthSession | null, StorageError | UnexpectedError>> {
    return ok(this.currentSession);
  }

  async ensureAuthenticated(
    forceRefresh: boolean = false,
  ): Promise<Result<AuthSession, AuthGatewayError>> {
    if (this.pendingErasureReceipt) {
      return err({
        kind: 'validation',
        message: 'Finish account deletion before starting a new session.',
        code: 'ERASURE_PENDING',
      });
    }
    if (this.simulateOffline) return err(this.offlineError());
    if (this.sessionRevokedPending) {
      return err({
        kind: 'unauthorized',
        message: 'Session was revoked remotely.',
        reasonCode: 'SESSION_REVOKED',
      });
    }

    if (!forceRefresh && this.currentSession) {
      return ok(this.currentSession);
    }

    const session: AuthSession = {
      accessToken: `fake-anon-token-${this.nextCounter++}`,
      expiresAt: new Date(this.clock.nowMs() + 3600_000).toISOString(),
      deviceId: this.deviceInstallId,
      isAuthenticated: Boolean(this.currentSession?.user),
      user: this.currentSession?.user ?? null,
      currentSessionId: this.currentSession?.currentSessionId ?? null,
    };
    this.notifyListeners(session);
    return ok(session);
  }

  onSessionChanged(listener: (session: AuthSession | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onSessionRevoked(listener: () => void): () => void {
    this.revokedListeners.add(listener);
    return () => {
      this.revokedListeners.delete(listener);
    };
  }

  async fetchAuthProviders(): Promise<
    Result<AuthProvidersSnapshot, NetworkError | UnexpectedError>
  > {
    if (this.simulateOffline) return err(this.offlineError());
    return ok({
      emailPasswordEnabled: true,
      smsOtpEnabled: this.edition === 'irn',
      google: {
        enabled: this.edition === 'glb',
        mode: this.edition === 'glb' ? 'dev_sandbox' : 'disabled',
      },
      apple: {
        enabled: this.edition === 'glb',
        mode: this.edition === 'glb' ? 'dev_sandbox' : 'disabled',
      },
      devicePolicy: {
        maxMobilePhones: 1,
        maxDesktopWebInstances: 1,
      },
    });
  }

  private claimDesktopSlot(
    account: FakeUserAccount,
    authMethod: 'email' | 'google' | 'apple' | 'sms_otp',
    replaceSessionId?: string,
  ): Result<AuthSession, AuthGatewayError> {
    const slots = this.activeSessionsByUserId.get(account.userId) ?? [];
    const occupying = slots.find(
      (s) => s.slotKind === 'desktop_web' && s.deviceId !== this.deviceInstallId,
    );

    if (occupying && occupying.sessionId !== replaceSessionId) {
      return err({
        kind: 'device_slot_occupied',
        message: `Desktop Web slot already occupied by ${occupying.deviceName}`,
        conflictCode: 'DEVICE_SLOT_OCCUPIED',
        occupyingDevice: {
          sessionId: occupying.sessionId,
          deviceId: occupying.deviceId,
          deviceName: occupying.deviceName,
          slotKind: occupying.slotKind,
          locationLabel: occupying.locationLabel,
          ipCountry: null,
          city: null,
          lastSeenAt: occupying.lastSeenAt,
        },
      });
    }

    const filteredSlots = slots.filter(
      (s) => s.sessionId !== replaceSessionId && s.deviceId !== this.deviceInstallId,
    );
    const sessionId = `sess-web-${this.nextCounter++}`;
    const newSlot: ActiveDeviceSlot = {
      sessionId,
      deviceId: this.deviceInstallId,
      deviceIdShort: `${this.deviceInstallId.slice(0, 8)}...`,
      slotKind: 'desktop_web',
      platform: 'web_desktop',
      appSurface: 'web_app',
      deviceName: 'Fake Desktop Browser',
      locationLabel: 'Local Test',
      ipMasked: '127.0.0.***',
      authMethod,
      isCurrentDevice: true,
      createdAt: this.clock.nowIso(),
      lastSeenAt: this.clock.nowIso(),
    };
    filteredSlots.push(newSlot);
    this.activeSessionsByUserId.set(account.userId, filteredSlots);

    const user: AuthenticatedUser = {
      userId: account.userId,
      email: account.email,
      phoneE164: account.phoneE164,
      displayName: account.displayName,
      linkedProviders: [...account.linkedProviders],
      isPro: account.isPro,
      acceptedDevicePolicyAt: account.acceptedDevicePolicyAt,
    };

    const session: AuthSession = {
      accessToken: `fake-user-token-${this.nextCounter++}`,
      expiresAt: new Date(this.clock.nowMs() + 3600_000).toISOString(),
      deviceId: this.deviceInstallId,
      isAuthenticated: true,
      user,
      currentSessionId: sessionId,
    };
    this.sessionRevokedPending = false;
    this.notifyListeners(session);
    return ok(session);
  }

  async signUpWithEmail(input: EmailSignUpInput): Promise<Result<AuthSession, AuthGatewayError>> {
    if (this.simulateOffline) return err(this.offlineError());
    const email = input.email.trim().toLowerCase();
    if (!email.includes('@') || input.password.length < 8) {
      return err({
        kind: 'validation',
        field: !email.includes('@') ? 'email' : 'password',
        code: 'validation_error',
        message: 'Valid email and 8+ char password required.',
      });
    }
    if (this.usersByKey.has(email)) {
      return err({
        kind: 'validation',
        field: 'email',
        code: 'email_already_registered',
        message: 'Email already registered.',
      });
    }

    const account: FakeUserAccount = {
      userId: `user-${this.nextCounter++}`,
      email,
      phoneE164: null,
      password: input.password,
      displayName: input.displayName?.trim() ?? null,
      linkedProviders: ['email'],
      isPro: false,
      acceptedDevicePolicyAt: null,
    };
    this.usersByKey.set(email, account);
    return this.claimDesktopSlot(account, 'email', input.replaceSessionId);
  }

  async signInWithEmail(input: EmailSignInInput): Promise<Result<AuthSession, AuthGatewayError>> {
    if (this.simulateOffline) return err(this.offlineError());
    const email = input.email.trim().toLowerCase();
    const account = this.usersByKey.get(email);
    if (!account || account.password !== input.password) {
      return err({
        kind: 'unauthorized',
        reasonCode: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }
    return this.claimDesktopSlot(account, 'email', input.replaceSessionId);
  }

  async signInWithOAuth(input: OAuthSignInInput): Promise<Result<AuthSession, AuthGatewayError>> {
    if (this.simulateOffline) return err(this.offlineError());
    let token = input.idTokenOrCode.trim();
    if (!token) {
      if (!this.allowDevAuth) {
        return err({
          kind: 'validation',
          field: 'idTokenOrCode',
          code: 'OAUTH_TOKEN_REQUIRED',
          message: 'Missing OAuth token.',
        });
      }
      const devPayload = {
        provider: input.provider,
        sub: `dev-${input.provider}-${this.nextCounter}`,
        email: `dev.${input.provider}@mockza.local`,
        name: input.displayName?.trim() || `${input.provider} Dev User`,
      };
      token = `mockza_dev_oauth_v1.${encodeBase64UrlUtf8(JSON.stringify(devPayload))}`;
    }
    const email = `${input.provider}_${token.slice(0, 12)}@oauth.local`;
    let account = this.usersByKey.get(email);
    if (!account) {
      account = {
        userId: `user-oauth-${this.nextCounter++}`,
        email,
        phoneE164: null,
        password: null,
        displayName: input.displayName?.trim() ?? `${input.provider} User`,
        linkedProviders: [input.provider],
        isPro: false,
        acceptedDevicePolicyAt: null,
      };
      this.usersByKey.set(email, account);
    }
    return this.claimDesktopSlot(account, input.provider, input.replaceSessionId);
  }

  async requestSmsOtp(
    input: RequestSmsOtpInput,
  ): Promise<Result<SmsOtpChallengeResult, AuthGatewayError>> {
    if (this.simulateOffline) return err(this.offlineError());
    const phone = normalizeIranPhoneE164(input.phoneE164);
    if (!phone) {
      return err({
        kind: 'validation',
        field: 'phoneE164',
        code: 'INVALID_E164',
        message: 'Phone must match +989XXXXXXXXX.',
      });
    }
    const otp = '123456';
    this.otpByPhone.set(phone, otp);
    return ok({ retryAfterSec: 60, devOtpHint: otp });
  }

  async verifySmsOtp(input: VerifySmsOtpInput): Promise<Result<AuthSession, AuthGatewayError>> {
    if (this.simulateOffline) return err(this.offlineError());
    const phone = normalizeIranPhoneE164(input.phoneE164);
    if (!phone) {
      return err({
        kind: 'validation',
        field: 'phoneE164',
        code: 'INVALID_E164',
        message: 'Phone must match +989XXXXXXXXX.',
      });
    }
    const expected = this.otpByPhone.get(phone);
    if (!expected || expected !== input.otpCode.trim()) {
      return err({
        kind: 'unauthorized',
        reasonCode: 'INVALID_CREDENTIALS',
        message: 'Invalid or expired SMS OTP code.',
      });
    }
    this.otpByPhone.delete(phone);
    let account = this.usersByKey.get(phone);
    if (!account) {
      account = {
        userId: `user-irn-${this.nextCounter++}`,
        email: null,
        phoneE164: phone,
        password: null,
        displayName: input.displayName?.trim() ?? null,
        linkedProviders: ['sms_otp'],
        isPro: false,
        acceptedDevicePolicyAt: null,
      };
      this.usersByKey.set(phone, account);
    }
    return this.claimDesktopSlot(account, 'sms_otp', input.replaceSessionId);
  }

  async signOutCurrentDevice(): Promise<Result<void, AuthGatewayError>> {
    if (this.simulateOffline) return err(this.offlineError());
    const userId = this.currentSession?.user?.userId;
    if (userId) {
      const slots = this.activeSessionsByUserId.get(userId) ?? [];
      this.activeSessionsByUserId.set(
        userId,
        slots.filter((s) => s.deviceId !== this.deviceInstallId),
      );
    }
    this.notifyListeners({
      accessToken: `fake-anon-token-${this.nextCounter++}`,
      expiresAt: new Date(this.clock.nowMs() + 3600_000).toISOString(),
      deviceId: this.deviceInstallId,
      isAuthenticated: false,
      user: null,
      currentSessionId: null,
    });
    return ok(undefined);
  }

  async deleteRemoteAccount(): Promise<Result<AccountDeletionReceipt, AuthGatewayError>> {
    if (this.simulateOffline) return err(this.offlineError());
    if (this.pendingErasureReceipt) {
      if (this.simulatePartialErasure) {
        this.simulatePartialErasure = false;
        return err({
          kind: 'network',
          message: 'Media storage deletion still incomplete; retry with receipt.',
          retryable: true,
          status: 503,
        });
      }
      const receipt = this.pendingErasureReceipt;
      this.pendingErasureReceipt = null;
      this.notifyListeners(null);
      return ok({
        deleted: true,
        erasureId: receipt.erasureId,
        receiptToken: receipt.receiptToken,
      });
    }

    const userId = this.currentSession?.user?.userId;
    if (userId) {
      this.activeSessionsByUserId.delete(userId);
      for (const [key, account] of this.usersByKey.entries()) {
        if (account.userId === userId) {
          this.usersByKey.delete(key);
        }
      }
    }
    this.notifyListeners(null);

    const erasureId = `erasure-${this.nextCounter++}`;
    const receiptToken = 'fake-erasure-receipt';
    if (this.simulatePartialErasure) {
      this.simulatePartialErasure = false;
      this.pendingErasureReceipt = { erasureId, receiptToken };
      return err({
        kind: 'network',
        message: 'Account records were erased, but media storage deletion failed and has been queued for retry.',
        retryable: true,
        status: 503,
      });
    }

    return ok({
      deleted: true,
      erasureId,
      receiptToken,
    });
  }

  // --- IDeviceSlotGateway ---

  async listActiveDevices(): Promise<Result<readonly ActiveDeviceSlot[], DeviceSlotGatewayError>> {
    if (this.simulateOffline) return err(this.offlineError());
    if (this.sessionRevokedPending) {
      return err({
        kind: 'unauthorized',
        message: 'Session was revoked remotely.',
        reasonCode: 'SESSION_REVOKED',
      });
    }
    const userId = this.currentSession?.user?.userId;
    if (!userId) return ok([]);
    return ok([...(this.activeSessionsByUserId.get(userId) ?? [])]);
  }

  async revokeDeviceSession(
    targetDeviceId: string,
  ): Promise<Result<RevokeDeviceSessionResult, DeviceSlotGatewayError>> {
    if (this.simulateOffline) return err(this.offlineError());
    const userId = this.currentSession?.user?.userId;
    if (!userId) {
      return err({ kind: 'unauthorized', message: 'Authentication required.' });
    }
    const slots = this.activeSessionsByUserId.get(userId) ?? [];
    const target = slots.find((s) => s.deviceId === targetDeviceId);
    if (!target) {
      return err({
        kind: 'validation',
        code: 'not_found',
        message: `Device session not found: ${targetDeviceId}`,
      });
    }
    const remaining = slots.filter((s) => s.sessionId !== target.sessionId);
    this.activeSessionsByUserId.set(userId, remaining);
    const signedOutCurrentDevice = target.deviceId === this.deviceInstallId;
    if (signedOutCurrentDevice) {
      this.notifyListeners(null);
    }
    return ok({
      revokedDeviceIds: [target.deviceId],
      signedOutCurrentDevice,
      sessions: remaining,
    });
  }

  async revokeOtherDeviceSessions(): Promise<
    Result<RevokeDeviceSessionResult, DeviceSlotGatewayError>
  > {
    if (this.simulateOffline) return err(this.offlineError());
    const userId = this.currentSession?.user?.userId;
    if (!userId) {
      return err({ kind: 'unauthorized', message: 'Authentication required.' });
    }
    const slots = this.activeSessionsByUserId.get(userId) ?? [];
    const revokedDeviceIds = slots
      .filter((s) => s.deviceId !== this.deviceInstallId)
      .map((s) => s.deviceId);
    const remaining = slots.filter((s) => s.deviceId === this.deviceInstallId);
    this.activeSessionsByUserId.set(userId, remaining);
    return ok({
      revokedDeviceIds,
      signedOutCurrentDevice: false,
      sessions: remaining,
    });
  }

  async recordDevicePolicyConsent(): Promise<
    Result<{ readonly acceptedAt: string }, DeviceSlotGatewayError>
  > {
    if (this.simulateOffline) return err(this.offlineError());
    const userId = this.currentSession?.user?.userId;
    if (!userId) {
      return err({ kind: 'unauthorized', message: 'Authentication required.' });
    }
    const acceptedAt = this.clock.nowIso();
    for (const account of this.usersByKey.values()) {
      if (account.userId === userId) {
        account.acceptedDevicePolicyAt = acceptedAt;
      }
    }
    if (this.currentSession?.user) {
      this.notifyListeners({
        ...this.currentSession,
        user: {
          ...this.currentSession.user,
          acceptedDevicePolicyAt: acceptedAt,
        },
      });
    }
    return ok({ acceptedAt });
  }
}

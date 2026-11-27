import type { MockzaDexieDb } from '@/adapters/dexie/mockza-db';
import type {
  AccountDeletionReceipt,
  ActiveDeviceSlot,
  AuthenticatedUser,
  AuthGatewayError,
  AuthProviderKind,
  AuthProvidersSnapshot,
  AuthSession,
  DeviceIdentity,
  DeviceSlotGatewayError,
  EmailSignInInput,
  EmailSignUpInput,
  IAuthGateway,
  IDeviceSlotGateway,
  RevokeDeviceSessionResult,
} from '@/gateways/auth.gateway';
import {
  type NetworkError,
  type Result,
  type StorageError,
  type UnexpectedError,
  type ValidationError,
  err,
  ok,
} from '@/gateways/result';
import type { IClock } from '@/gateways/telemetry.gateway';
import type { ApiClient, ApiClientError } from './api-client';

export const DEVICE_INSTALL_ID_STORAGE_KEY = 'mockza_device_install_id_v1' as const;
export const AUTH_SESSION_STORAGE_PREFIX = 'mockza_auth_session_v1:' as const;

export interface HttpAuthAdapterOptions {
  readonly apiClient: ApiClient;
  readonly db: MockzaDexieDb;
  readonly clock: IClock;
  readonly appVersion?: string;
  readonly allowDevAuth?: boolean;
  readonly localStorage?: Storage | null;
}

function isValidAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user['userId'] === 'string' &&
    user['userId'].length > 0 &&
    (user['email'] === null || typeof user['email'] === 'string') &&
    (user['phoneE164'] === undefined ||
      user['phoneE164'] === null ||
      typeof user['phoneE164'] === 'string') &&
    (user['displayName'] === null || typeof user['displayName'] === 'string') &&
    Array.isArray(user['linkedProviders']) &&
    user['linkedProviders'].every((p) => typeof p === 'string') &&
    typeof user['isPro'] === 'boolean' &&
    (user['acceptedDevicePolicyAt'] === undefined ||
      user['acceptedDevicePolicyAt'] === null ||
      typeof user['acceptedDevicePolicyAt'] === 'string')
  );
}

function isPersistedAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  const hasValidUser = obj['user'] === null || isValidAuthenticatedUser(obj['user']);
  const hasValidSessionId =
    obj['currentSessionId'] === undefined ||
    obj['currentSessionId'] === null ||
    typeof obj['currentSessionId'] === 'string';
  return (
    typeof obj['accessToken'] === 'string' &&
    obj['accessToken'].length > 0 &&
    typeof obj['expiresAt'] === 'string' &&
    typeof obj['deviceId'] === 'string' &&
    typeof obj['isAuthenticated'] === 'boolean' &&
    hasValidUser &&
    hasValidSessionId
  );
}

function generateUuidV4(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function deriveDeviceLabel(): string {
  if (typeof navigator === 'undefined') {
    return 'Desktop Web Browser';
  }
  const ua = navigator.userAgent || '';
  const browser = ua.includes('Firefox')
    ? 'Firefox'
    : ua.includes('Edg/')
      ? 'Edge'
      : ua.includes('Chrome')
        ? 'Chrome'
        : ua.includes('Safari')
          ? 'Safari'
          : 'Browser';
  const os = ua.includes('Mac OS')
    ? 'macOS'
    : ua.includes('Windows')
      ? 'Windows'
      : ua.includes('Linux')
        ? 'Linux Desktop'
        : 'Desktop';
  return `${browser} on ${os}`;
}

function deriveTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function decodeJwtExpiryMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonText = new TextDecoder().decode(bytes);
    const payload = JSON.parse(jsonText) as { readonly exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function getSafeStorage(override?: Storage | null): Storage | null {
  if (override !== undefined) return override;
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function getSafeSessionStorage(override?: Storage | null): Storage | null {
  if (override !== undefined) return override;
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

interface RawAuthSessionResponse {
  readonly accessToken: string;
  readonly expiresAt: string;
  readonly deviceId: string;
  readonly deviceSecret?: string;
  readonly user?: {
    readonly userId: string;
    readonly email: string | null;
    readonly phoneE164?: string | null;
    readonly displayName: string | null;
    readonly linkedProviders: readonly AuthProviderKind[];
    readonly isPro: boolean;
    readonly acceptedDevicePolicyAt?: string | null;
  } | null;
  readonly currentSession?: { readonly sessionId: string } | null;
}

interface RawAnonymousAuthResponse {
  readonly accessToken: string;
  readonly expiresAt: string;
  readonly deviceId: string;
  readonly deviceSecret?: string;
  readonly linkedUserId?: string | null;
  readonly linkedEmail?: string | null;
}

interface RawAccountSessionsResponse {
  readonly isAuthenticated: boolean;
  readonly user: AuthenticatedUser | null;
  readonly currentDeviceId: string;
  readonly sessions: readonly ActiveDeviceSlot[];
}

interface RawRevokeResponse {
  readonly revokedDeviceIds: readonly string[];
  readonly signedOutCurrentDevice: boolean;
  readonly sessions: readonly ActiveDeviceSlot[];
}

export class HttpAuthAdapter implements IAuthGateway, IDeviceSlotGateway {
  protected readonly apiClient: ApiClient;
  protected readonly db: MockzaDexieDb;
  protected readonly clock: IClock;
  protected readonly appVersion: string;
  protected readonly allowDevAuth: boolean;
  private readonly storageOverride: Storage | null | undefined;
  private readonly sessionStorageKey: string;
  private readonly listeners = new Set<(session: AuthSession | null) => void>();
  private readonly revokedListeners = new Set<() => void>();
  private currentSession: AuthSession | null = null;
  private inflightAuth: Promise<Result<AuthSession, AuthGatewayError>> | null = null;

  constructor(options: HttpAuthAdapterOptions) {
    this.apiClient = options.apiClient;
    this.db = options.db;
    this.clock = options.clock;
    this.appVersion = options.appVersion ?? '1.0.0';
    this.allowDevAuth = options.allowDevAuth ?? false;
    this.storageOverride = options.localStorage;
    this.sessionStorageKey = `${AUTH_SESSION_STORAGE_PREFIX}${this.db.name}`;
    this.currentSession = this.readPersistedSession();
  }

  private readPersistedSession(): AuthSession | null {
    const storage = getSafeSessionStorage(this.storageOverride);
    if (!storage) return null;
    try {
      const raw = storage.getItem(this.sessionStorageKey);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isPersistedAuthSession(parsed)) {
        storage.removeItem(this.sessionStorageKey);
        return null;
      }
      return parsed;
    } catch {
      try {
        storage.removeItem(this.sessionStorageKey);
      } catch {
        // Ignore cleanup errors.
      }
      return null;
    }
  }

  private writePersistedSession(session: AuthSession | null): void {
    const storage = getSafeSessionStorage(this.storageOverride);
    if (!storage) return;
    try {
      if (session) {
        storage.setItem(this.sessionStorageKey, JSON.stringify(session));
      } else {
        storage.removeItem(this.sessionStorageKey);
      }
      // Clean up any legacy localStorage token entry when using default browser storage.
      if (this.storageOverride === undefined) {
        getSafeStorage(undefined)?.removeItem(this.sessionStorageKey);
      }
    } catch {
      // Ignore storage write errors in restricted contexts.
    }
  }

  getCurrentAccessToken(): string | null {
    return this.currentSession?.accessToken ?? null;
  }

  getFreshAccessToken(): string | null {
    if (!this.currentSession || !this.isSessionFresh(this.currentSession)) {
      return null;
    }
    return this.currentSession.accessToken;
  }

  protected notifySessionListeners(session: AuthSession | null): void {
    this.currentSession = session;
    this.writePersistedSession(session);
    for (const listener of this.listeners) {
      listener(session);
    }
  }

  handleRemoteSessionRevoked(): void {
    this.notifySessionListeners(null);
    for (const listener of this.revokedListeners) {
      listener();
    }
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

  async getDeviceIdentity(): Promise<Result<DeviceIdentity, StorageError | UnexpectedError>> {
    try {
      const existingRow = await this.db.deviceMeta.get('deviceInstallId');
      const storage = getSafeStorage(this.storageOverride);
      const backupId = storage?.getItem(DEVICE_INSTALL_ID_STORAGE_KEY) ?? null;

      let deviceInstallId = existingRow?.value ?? backupId;
      if (!deviceInstallId || deviceInstallId.trim().length === 0) {
        deviceInstallId = generateUuidV4();
      }

      if (!existingRow || existingRow.value !== deviceInstallId) {
        await this.db.deviceMeta.put({
          key: 'deviceInstallId',
          value: deviceInstallId,
          updatedAtMs: this.clock.nowMs(),
        });
      }
      if (storage && backupId !== deviceInstallId) {
        try {
          storage.setItem(DEVICE_INSTALL_ID_STORAGE_KEY, deviceInstallId);
        } catch {
          // Ignore storage write errors in restricted contexts.
        }
      }

      return ok({
        deviceInstallId,
        slotKind: 'desktop_web',
        platform: 'web_desktop',
        appSurface: 'web_app',
        deviceLabel: deriveDeviceLabel(),
        timezone: deriveTimezone(),
      });
    } catch (cause) {
      return err<StorageError>({
        kind: 'storage',
        message: `Failed to resolve DeviceIdentity: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    }
  }

  async getSession(): Promise<Result<AuthSession | null, StorageError | UnexpectedError>> {
    return ok(this.currentSession);
  }

  private isSessionFresh(session: AuthSession): boolean {
    if (!session.accessToken) return false;
    const expMs = Date.parse(session.expiresAt);
    const jwtExpMs = decodeJwtExpiryMs(session.accessToken);
    const effectiveExpMs = Number.isFinite(expMs) ? expMs : jwtExpMs;
    if (effectiveExpMs === null) return true;
    return effectiveExpMs - this.clock.nowMs() > 60_000;
  }

  async ensureAuthenticated(
    forceRefresh: boolean = false,
  ): Promise<Result<AuthSession, AuthGatewayError>> {
    try {
      const pendingErasure = await this.db.deviceMeta.get('pendingErasureReceipt');
      if (pendingErasure?.value) {
        return err<ValidationError>({
          kind: 'validation',
          message: 'Finish account deletion before starting a new session.',
          code: 'ERASURE_PENDING',
        });
      }
    } catch (cause) {
      return err<StorageError>({
        kind: 'storage',
        message: `Failed to read device meta: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
    }

    if (!forceRefresh && this.currentSession && this.isSessionFresh(this.currentSession)) {
      return ok(this.currentSession);
    }

    if (this.inflightAuth) {
      return this.inflightAuth;
    }

    const pending = this.performAnonymousAuth().finally(() => {
      if (this.inflightAuth === pending) {
        this.inflightAuth = null;
      }
    });
    this.inflightAuth = pending;
    return pending;
  }

  private async performAnonymousAuth(): Promise<Result<AuthSession, AuthGatewayError>> {
    const identityRes = await this.getDeviceIdentity();
    if (!identityRes.ok) return identityRes;
    const identity = identityRes.value;

    const secretRow = await this.db.deviceMeta.get('deviceSecret').catch(() => undefined);
    const deviceSecret = secretRow?.value;
    const currentToken = this.currentSession?.accessToken;

    const res = await this.apiClient.post<RawAnonymousAuthResponse>(
      '/v1/auth/anonymous',
      {
        deviceId: identity.deviceInstallId,
        appVersion: this.appVersion,
        deviceMeta: {
          slotKind: identity.slotKind,
          platform: identity.platform,
          appSurface: identity.appSurface,
          deviceName: identity.deviceLabel,
          timezone: identity.timezone,
        },
        ...(deviceSecret ? { deviceSecret } : {}),
      },
      {
        ...(currentToken ? { headers: { authorization: `Bearer ${currentToken}` } } : {}),
      },
    );

    if (!res.ok) {
      return err(this.mapApiErrorToAuthError(res.error));
    }

    if (!res.value?.accessToken) {
      return err<ValidationError>({
        kind: 'validation',
        message: 'Authentication response missing accessToken.',
        code: 'MISSING_ACCESS_TOKEN',
      });
    }

    if (res.value.deviceSecret) {
      await this.db.deviceMeta.put({
        key: 'deviceSecret',
        value: res.value.deviceSecret,
        updatedAtMs: this.clock.nowMs(),
      });
    }

    const linkedUserId = res.value.linkedUserId ?? null;
    if (this.currentSession?.isAuthenticated && !linkedUserId) {
      this.notifySessionListeners(null);
      return err({
        kind: 'unauthorized',
        message: 'Authenticated session can no longer be refreshed.',
        reasonCode: 'SESSION_REVOKED',
      });
    }
    const resolvedDeviceId = res.value.deviceId || identity.deviceInstallId;
    let resolvedUser: AuthenticatedUser | null = linkedUserId
      ? {
          userId: linkedUserId,
          email: res.value.linkedEmail ?? this.currentSession?.user?.email ?? null,
          phoneE164: this.currentSession?.user?.phoneE164 ?? null,
          displayName: this.currentSession?.user?.displayName ?? null,
          linkedProviders: this.currentSession?.user?.linkedProviders ?? ['email'],
          isPro: this.currentSession?.user?.isPro ?? false,
          acceptedDevicePolicyAt: this.currentSession?.user?.acceptedDevicePolicyAt ?? null,
        }
      : null;
    let resolvedSessionId: string | null = linkedUserId
      ? (this.currentSession?.currentSessionId ?? null)
      : null;

    if (linkedUserId) {
      this.currentSession = {
        accessToken: res.value.accessToken,
        expiresAt: res.value.expiresAt,
        deviceId: resolvedDeviceId,
        isAuthenticated: true,
        user: resolvedUser,
        currentSessionId: resolvedSessionId,
      };
      const meRes = await this.apiClient.get<RawAccountSessionsResponse>('/v1/account/me', {
        skipAuthRefresh: true,
        headers: { authorization: `Bearer ${res.value.accessToken}` },
      });
      if (meRes.ok && meRes.value.user) {
        resolvedUser = meRes.value.user;
        const activeSlot =
          meRes.value.sessions.find((s) => s.isCurrentDevice) ??
          meRes.value.sessions.find((s) => s.deviceId === resolvedDeviceId);
        if (activeSlot) {
          resolvedSessionId = activeSlot.sessionId;
        }
      }
    }

    const session: AuthSession = {
      accessToken: res.value.accessToken,
      expiresAt: res.value.expiresAt,
      deviceId: resolvedDeviceId,
      isAuthenticated: Boolean(linkedUserId),
      user: resolvedUser,
      ...(resolvedSessionId !== null ? { currentSessionId: resolvedSessionId } : {}),
    };

    this.notifySessionListeners(session);
    return ok(session);
  }

  async fetchAuthProviders(): Promise<
    Result<AuthProvidersSnapshot, NetworkError | UnexpectedError>
  > {
    const res = await this.apiClient.get<AuthProvidersSnapshot>('/v1/auth/providers');
    if (!res.ok) {
      if (res.error.kind === 'network') {
        return err(res.error);
      }
      return err<UnexpectedError>({
        kind: 'unexpected',
        message: res.error.message,
        cause: res.error,
      });
    }
    const snap = res.value;
    return ok({
      ...snap,
      smsOtpEnabled: snap.smsOtp?.enabled ?? snap.smsOtpEnabled ?? false,
    });
  }

  protected async submitSessionAuth(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<Result<AuthSession, AuthGatewayError>> {
    const identityRes = await this.getDeviceIdentity();
    if (!identityRes.ok) return identityRes;
    const identity = identityRes.value;

    const secretRow = await this.db.deviceMeta.get('deviceSecret').catch(() => undefined);
    const deviceSecret = secretRow?.value;
    const currentToken = this.currentSession?.accessToken;

    const res = await this.apiClient.post<RawAuthSessionResponse>(
      path,
      {
        ...payload,
        deviceId: identity.deviceInstallId,
        appVersion: this.appVersion,
        deviceMeta: {
          slotKind: identity.slotKind,
          platform: identity.platform,
          appSurface: identity.appSurface,
          deviceName: identity.deviceLabel,
          timezone: identity.timezone,
        },
        ...(deviceSecret ? { deviceSecret } : {}),
      },
      {
        ...(currentToken ? { headers: { authorization: `Bearer ${currentToken}` } } : {}),
      },
    );

    if (!res.ok) {
      return err(this.mapApiErrorToAuthError(res.error));
    }

    const data = res.value;
    if (!data || !data.accessToken) {
      return err<ValidationError>({
        kind: 'validation',
        message: 'Authentication response missing accessToken.',
        code: 'MISSING_ACCESS_TOKEN',
      });
    }

    if (data.deviceSecret) {
      await this.db.deviceMeta.put({
        key: 'deviceSecret',
        value: data.deviceSecret,
        updatedAtMs: this.clock.nowMs(),
      });
    }

    if (data.user?.userId) {
      await this.db.deviceMeta.put({
        key: 'lastUserId',
        value: data.user.userId,
        updatedAtMs: this.clock.nowMs(),
      });
    }

    const session: AuthSession = {
      accessToken: data.accessToken,
      expiresAt: data.expiresAt,
      deviceId: data.deviceId || identity.deviceInstallId,
      isAuthenticated: Boolean(data.user),
      user: data.user ?? null,
      currentSessionId: data.currentSession?.sessionId ?? null,
    };

    this.notifySessionListeners(session);
    return ok(session);
  }

  async signInWithEmail(input: EmailSignInInput): Promise<Result<AuthSession, AuthGatewayError>> {
    return this.submitSessionAuth('/v1/auth/login', {
      email: input.email.trim(),
      password: input.password,
      ...(input.replaceSessionId ? { replaceSessionId: input.replaceSessionId } : {}),
    });
  }

  async signUpWithEmail(input: EmailSignUpInput): Promise<Result<AuthSession, AuthGatewayError>> {
    const displayName = input.displayName?.trim();
    return this.submitSessionAuth('/v1/auth/register', {
      email: input.email.trim(),
      password: input.password,
      ...(displayName ? { displayName } : {}),
      ...(input.replaceSessionId ? { replaceSessionId: input.replaceSessionId } : {}),
    });
  }

  async signOutCurrentDevice(): Promise<Result<void, AuthGatewayError>> {
    if (!this.currentSession?.accessToken) {
      const ensured = await this.ensureAuthenticated();
      if (!ensured.ok) {
        return err(ensured.error);
      }
    }

    const res = await this.apiClient.post<{
      readonly accessToken?: string;
      readonly deviceId?: string;
      readonly expiresAt?: string;
    }>('/v1/auth/logout', undefined, { includeAuthOnAuthRoute: true });

    if (!res.ok) {
      return err(this.mapApiErrorToAuthError(res.error));
    }

    if (res.value?.accessToken && res.value.deviceId && res.value.expiresAt) {
      this.notifySessionListeners({
        accessToken: res.value.accessToken,
        deviceId: res.value.deviceId,
        expiresAt: res.value.expiresAt,
        isAuthenticated: false,
        user: null,
        currentSessionId: null,
      });
    } else {
      this.notifySessionListeners(null);
    }

    return ok(undefined);
  }

  async deleteRemoteAccount(): Promise<Result<AccountDeletionReceipt, AuthGatewayError>> {
    const pendingRow = await this.db.deviceMeta.get('pendingErasureReceipt').catch(() => undefined);
    if (pendingRow?.value) {
      try {
        const parsed = JSON.parse(pendingRow.value) as {
          readonly erasureId?: unknown;
          readonly receiptToken?: unknown;
        };
        if (
          typeof parsed.erasureId === 'string' &&
          parsed.erasureId.length > 0 &&
          typeof parsed.receiptToken === 'string' &&
          parsed.receiptToken.length > 0
        ) {
          const retryRes = await this.apiClient.post<{
            readonly erasureId?: string;
            readonly status?: string;
          }>(
            `/v1/erasure/${encodeURIComponent(parsed.erasureId)}/retry`,
            undefined,
            {
              headers: { 'x-erasure-receipt': parsed.receiptToken },
              skipAuthRefresh: true,
            },
          );
          if (!retryRes.ok) {
            return err(this.mapApiErrorToAuthError(retryRes.error));
          }
          await this.db.deviceMeta.delete('pendingErasureReceipt').catch(() => {});
          await this.db.deviceMeta.delete('deviceSecret').catch(() => {});
          await this.db.deviceMeta.delete('lastUserId').catch(() => {});
          this.notifySessionListeners(null);
          return ok({
            deleted: true,
            erasureId: parsed.erasureId,
            receiptToken: parsed.receiptToken,
          });
        }
      } catch {
        // Malformed stored receipt: fall through to fresh DELETE /v1/account.
      }
    }

    if (!this.currentSession?.accessToken) {
      const ensured = await this.ensureAuthenticated();
      if (!ensured.ok) {
        return err(ensured.error);
      }
    }

    const detailed = await this.apiClient.requestDetailed<{
      readonly deleted?: boolean;
      readonly erasureId?: string;
      readonly receiptToken?: string;
    }>('/v1/account', { method: 'DELETE' });

    if (!detailed.result.ok) {
      if (
        detailed.status === 503 &&
        typeof detailed.rawErrorBody === 'object' &&
        detailed.rawErrorBody !== null
      ) {
        const body = detailed.rawErrorBody as {
          readonly erasureId?: unknown;
          readonly receiptToken?: unknown;
        };
        if (
          typeof body.erasureId === 'string' &&
          body.erasureId.length > 0 &&
          typeof body.receiptToken === 'string' &&
          body.receiptToken.length > 0
        ) {
          await this.db.deviceMeta.put({
            key: 'pendingErasureReceipt',
            value: JSON.stringify({
              erasureId: body.erasureId,
              receiptToken: body.receiptToken,
            }),
            updatedAtMs: this.clock.nowMs(),
          });
          await this.db.deviceMeta.delete('deviceSecret').catch(() => {});
          await this.db.deviceMeta.delete('lastUserId').catch(() => {});
          this.notifySessionListeners(null);
        }
      }
      return err(this.mapApiErrorToAuthError(detailed.result.error));
    }

    await this.db.deviceMeta.delete('pendingErasureReceipt').catch(() => {});
    await this.db.deviceMeta.delete('deviceSecret').catch(() => {});
    await this.db.deviceMeta.delete('lastUserId').catch(() => {});
    this.notifySessionListeners(null);

    return ok({
      deleted: detailed.result.value?.deleted ?? true,
      ...(detailed.result.value?.erasureId ? { erasureId: detailed.result.value.erasureId } : {}),
      ...(detailed.result.value?.receiptToken
        ? { receiptToken: detailed.result.value.receiptToken }
        : {}),
    });
  }

  // --- IDeviceSlotGateway ---

  async listActiveDevices(): Promise<Result<readonly ActiveDeviceSlot[], DeviceSlotGatewayError>> {
    const res = await this.apiClient.get<RawAccountSessionsResponse>('/v1/account/devices');
    if (!res.ok) {
      return err(this.mapDeviceSlotError(res.error));
    }
    return ok(res.value.sessions ?? []);
  }

  async revokeDeviceSession(
    targetDeviceId: string,
  ): Promise<Result<RevokeDeviceSessionResult, DeviceSlotGatewayError>> {
    const res = await this.apiClient.delete<RawRevokeResponse>(
      `/v1/account/devices/${encodeURIComponent(targetDeviceId)}`,
    );
    if (!res.ok) {
      return err(this.mapDeviceSlotError(res.error));
    }
    if (res.value.signedOutCurrentDevice) {
      this.notifySessionListeners(null);
    }
    return ok({
      revokedDeviceIds: res.value.revokedDeviceIds ?? [],
      signedOutCurrentDevice: Boolean(res.value.signedOutCurrentDevice),
      sessions: res.value.sessions ?? [],
    });
  }

  async revokeOtherDeviceSessions(): Promise<
    Result<RevokeDeviceSessionResult, DeviceSlotGatewayError>
  > {
    const res = await this.apiClient.post<RawRevokeResponse>('/v1/account/devices/revoke-others');
    if (!res.ok) {
      return err(this.mapDeviceSlotError(res.error));
    }
    return ok({
      revokedDeviceIds: res.value.revokedDeviceIds ?? [],
      signedOutCurrentDevice: Boolean(res.value.signedOutCurrentDevice),
      sessions: res.value.sessions ?? [],
    });
  }

  async recordDevicePolicyConsent(): Promise<
    Result<{ readonly acceptedAt: string }, DeviceSlotGatewayError>
  > {
    const res = await this.apiClient.post<{ readonly acceptedDevicePolicyAt?: string | null }>(
      '/v1/account/device-policy-consent',
    );
    if (!res.ok) {
      return err(this.mapDeviceSlotError(res.error));
    }
    const acceptedAt = res.value?.acceptedDevicePolicyAt ?? this.clock.nowIso();
    if (this.currentSession?.user) {
      this.notifySessionListeners({
        ...this.currentSession,
        user: {
          ...this.currentSession.user,
          acceptedDevicePolicyAt: acceptedAt,
        },
      });
    }
    return ok({ acceptedAt });
  }

  protected mapApiErrorToAuthError(error: ApiClientError): AuthGatewayError {
    if (error.kind === 'entitlement_required') {
      return { kind: 'unexpected', message: error.message, cause: error };
    }
    return error;
  }

  private mapDeviceSlotError(error: ApiClientError): DeviceSlotGatewayError {
    switch (error.kind) {
      case 'network':
      case 'unauthorized':
      case 'validation':
        return error;
      case 'device_slot_occupied':
      case 'quota_exceeded':
      case 'entitlement_required':
        return { kind: 'unexpected', message: error.message, cause: error };
    }
  }
}

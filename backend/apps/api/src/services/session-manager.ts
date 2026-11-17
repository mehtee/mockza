import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AppEnv } from '@mockza/config';
import {
  accountLinks,
  devices,
  entitlements,
  type MockzaDb,
  userDeviceSessions,
  userEntitlements,
  users,
} from '@mockza/db';
import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { verify } from 'hono/jwt';
import { signDeviceToken, type TokenPayload } from '../middleware/auth.js';
import type {
  AppSurface,
  DevicePlatform,
  DeviceSlotKind,
  ResolvedDeviceContext,
} from './device-context.js';
import { hashPasswordScrypt, verifyDummyPassword, verifyPasswordScrypt } from './password-hash.js';
import type { VerifiedProviderClaims } from './provider-verify.js';

export type AuthMethod = 'email' | 'google' | 'apple';

export interface AccountUserPayload {
  userId: string;
  email: string | null;
  displayName: string | null;
  linkedProviders: AuthMethod[];
  isPro: boolean;
  acceptedDevicePolicyAt: string | null;
}

export interface DeviceSessionPayload {
  sessionId: string;
  deviceId: string;
  deviceIdShort: string;
  slotKind: DeviceSlotKind;
  platform: DevicePlatform;
  appSurface: AppSurface;
  deviceName: string;
  locationLabel: string;
  ipMasked: string | null;
  authMethod: AuthMethod;
  isCurrentDevice: boolean;
  createdAt: string;
  lastSeenAt: string;
}

export interface AuthSessionBundle {
  accessToken: string;
  expiresAt: string;
  deviceId: string;
  deviceSecret?: string;
  user: AccountUserPayload;
  currentSession: DeviceSessionPayload;
  sessions: DeviceSessionPayload[];
}

export interface AccountSessionsPayload {
  isAuthenticated: boolean;
  user: AccountUserPayload | null;
  currentDeviceId: string;
  devicePolicy: {
    maxMobilePhones: 1;
    maxDesktopWebInstances: 1;
    mobileOccupied: boolean;
    desktopWebOccupied: boolean;
  };
  sessions: DeviceSessionPayload[];
}

export class DeviceSlotLimitError extends Error {
  constructor(
    public readonly slotKind: DeviceSlotKind,
    public readonly occupyingDevice: {
      deviceId: string;
      deviceIdShort: string;
      deviceName: string;
      locationLabel: string;
      lastSeenAt: string;
    },
  ) {
    const slotLabel = slotKind === 'desktop_web' ? 'Desktop Web' : 'Mobile Phone';
    super(
      `Your ${slotLabel} slot is already signed in on ${occupyingDevice.deviceName} (${occupyingDevice.locationLabel}). Sign out of that device in Settings before signing in here.`,
    );
    this.name = 'DeviceSlotLimitError';
  }
}

export class AuthActionError extends Error {
  constructor(
    public readonly code:
      | 'unauthorized'
      | 'attempt_conflict'
      | 'invalid_credentials'
      | 'email_already_registered'
      | 'not_found',
    message: string,
    public readonly status: 401 | 404 | 409 = 401,
  ) {
    super(message);
    this.name = 'AuthActionError';
  }
}

function sha256Hex(secret: string): string {
  return createHash('sha256').update(secret, 'utf-8').digest('hex');
}

function timingSafeHexEqual(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'utf-8');
  const b = Buffer.from(bHex, 'utf-8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function formatDeviceShort(deviceId: string): string {
  return `${deviceId.slice(0, 8)}...`;
}

function mapSessionRow(
  row: {
    sessionId: string;
    deviceId: string;
    slotKind: string;
    platform: string;
    appSurface: string;
    deviceName: string;
    locationLabel: string;
    ipMasked: string | null;
    authMethod: string;
    createdAt: Date;
    lastSeenAt: Date;
  },
  callerDeviceId: string,
): DeviceSessionPayload {
  return {
    sessionId: row.sessionId,
    deviceId: row.deviceId,
    deviceIdShort: formatDeviceShort(row.deviceId),
    slotKind: row.slotKind === 'desktop_web' ? 'desktop_web' : 'mobile',
    platform: (['ios', 'android', 'web_mobile', 'web_desktop', 'unknown'].includes(row.platform)
      ? row.platform
      : 'unknown') as DevicePlatform,
    appSurface: (['flutter_app', 'flutter_web', 'web_app'].includes(row.appSurface)
      ? row.appSurface
      : 'flutter_app') as AppSurface,
    deviceName: row.deviceName,
    locationLabel: row.locationLabel,
    ipMasked: row.ipMasked,
    authMethod: (['email', 'google', 'apple'].includes(row.authMethod)
      ? row.authMethod
      : 'email') as AuthMethod,
    isCurrentDevice: row.deviceId === callerDeviceId,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
  };
}

interface MemoryUser {
  userId: string;
  email: string | null;
  displayName: string | null;
  passwordHash: string | null;
  createdAt: Date;
}

interface MemoryDevice {
  deviceId: string;
  secretHash: string;
  tokenVersion: number;
  linkedUserId: string | null;
  slotKind: DeviceSlotKind;
  platform: DevicePlatform;
  deviceName: string;
  appVersion?: string;
}

interface MemoryDeviceSession {
  sessionId: string;
  userId: string;
  deviceId: string;
  slotKind: DeviceSlotKind;
  platform: DevicePlatform;
  appSurface: AppSurface;
  deviceName: string;
  ipMasked: string | null;
  locationLabel: string;
  userAgent: string | null;
  authMethod: AuthMethod;
  createdAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
}

interface MemoryEntitlementState {
  isPro: boolean;
  expiresAt: Date | null;
  graceUntil: Date | null;
  acceptedDevicePolicyAt: Date | null;
}

export interface MemoryAuthState {
  devices: Map<string, MemoryDevice>;
  users: Map<string, MemoryUser>;
  accountLinks: Map<string, { userId: string; provider: 'google' | 'apple'; sub: string }>;
  sessions: Map<string, MemoryDeviceSession>;
  userEntitlements: Map<string, MemoryEntitlementState>;
  deviceEntitlements: Map<string, MemoryEntitlementState>;
}

export interface SessionManager {
  resolveMemoryDeviceState(deviceId: string): {
    exists: boolean;
    linkedUserId: string | null;
    tokenVersion: number;
  } | null;
  authenticateAnonymous(params: {
    deviceId: string;
    appVersion?: string;
    deviceSecret?: string;
    authHeader?: string;
    deviceCtx: ResolvedDeviceContext;
  }): Promise<{
    accessToken: string;
    deviceId: string;
    expiresAt: string;
    deviceSecret?: string;
    linkedUserId: string | null;
    linkedEmail: string | null;
  }>;
  registerWithEmail(params: {
    email: string;
    password: string;
    displayName?: string;
    deviceId: string;
    deviceSecret?: string;
    authHeader?: string;
    appVersion?: string;
    deviceCtx: ResolvedDeviceContext;
  }): Promise<AuthSessionBundle>;
  loginWithEmail(params: {
    email: string;
    password: string;
    deviceId: string;
    deviceSecret?: string;
    authHeader?: string;
    appVersion?: string;
    deviceCtx: ResolvedDeviceContext;
  }): Promise<AuthSessionBundle>;
  authenticateOAuth(params: {
    claims: VerifiedProviderClaims;
    displayName?: string;
    deviceId: string;
    deviceSecret?: string;
    authHeader?: string;
    appVersion?: string;
    deviceCtx: ResolvedDeviceContext;
  }): Promise<AuthSessionBundle>;
  linkAuthenticatedDevice(params: {
    deviceId: string;
    authHeader?: string;
    claims: VerifiedProviderClaims;
    deviceCtx: ResolvedDeviceContext;
  }): Promise<{ userId: string; accessToken: string; expiresAt: string }>;
  logoutCurrentDevice(params: {
    deviceId: string;
  }): Promise<{ accessToken: string; deviceId: string; expiresAt: string }>;
  getAccountSessions(params: {
    deviceId: string;
    userId: string | null;
  }): Promise<AccountSessionsPayload>;
  terminateDeviceSession(params: {
    callerDeviceId: string;
    userId: string;
    targetDeviceId: string;
  }): Promise<{
    revokedDeviceIds: string[];
    signedOutCurrentDevice: boolean;
    sessions: DeviceSessionPayload[];
  }>;
  terminateOtherSessions(params: { callerDeviceId: string; userId: string }): Promise<{
    revokedDeviceIds: string[];
    sessions: DeviceSessionPayload[];
  }>;
  recordDevicePolicyConsent(params: { userId: string }): Promise<AccountUserPayload>;
  isUserOrDevicePro(params: { deviceId: string; accountKey: string }): Promise<boolean>;
  wipeMemoryForAccount(params: { deviceIds: string[]; userId: string | null }): void;
}

export function createSessionManager(env: AppEnv, db?: MockzaDb): SessionManager {
  const memory: MemoryAuthState = {
    devices: new Map(),
    users: new Map(),
    accountLinks: new Map(),
    sessions: new Map(),
    userEntitlements: new Map(),
    deviceEntitlements: new Map(),
  };

  async function verifyBearerForDevice(
    authHeader: string | undefined,
    expectedDeviceId: string,
    expectedTokenVersion: number,
  ): Promise<boolean> {
    if (!authHeader?.startsWith('Bearer ')) return false;
    const rawToken = authHeader.slice('Bearer '.length).trim();
    if (!rawToken) return false;
    try {
      const decoded = (await verify(
        rawToken,
        env.JWT_SECRET,
        'HS256',
      )) as unknown as Partial<TokenPayload>;
      return (
        decoded.sub === expectedDeviceId &&
        decoded.type === 'device' &&
        decoded.edition === env.EDITION &&
        (decoded.tv === undefined || decoded.tv === expectedTokenVersion)
      );
    } catch {
      return false;
    }
  }

  function isEntActive(
    ent: { isPro: boolean; expiresAt: Date | null; graceUntil: Date | null } | undefined,
    now: Date,
  ): boolean {
    if (!ent?.isPro) return false;
    return !ent.expiresAt || ent.expiresAt > now || Boolean(ent.graceUntil && ent.graceUntil > now);
  }

  function resolveMemoryDeviceState(deviceId: string) {
    if (db) return null;
    const dev = memory.devices.get(deviceId);
    if (!dev) return null;
    return {
      exists: true,
      linkedUserId: dev.linkedUserId,
      tokenVersion: dev.tokenVersion,
    };
  }

  interface PreparedDevice {
    isNew: boolean;
    tokenVersion: number;
    issuedSecret?: string;
    secretHashToSave: string | null;
    linkedUserId: string | null;
  }

  async function prepareDeviceCheck(params: {
    deviceId: string;
    deviceSecret?: string;
    authHeader?: string;
  }): Promise<PreparedDevice> {
    const { deviceId, deviceSecret, authHeader } = params;
    const newSecret = randomBytes(32).toString('base64url');
    const newSecretHash = sha256Hex(newSecret);

    if (db) {
      const [existing] = await db
        .select({
          deviceId: devices.deviceId,
          deviceSecretHash: devices.deviceSecretHash,
          tokenVersion: devices.tokenVersion,
          linkedUserId: devices.linkedUserId,
        })
        .from(devices)
        .where(eq(devices.deviceId, deviceId))
        .limit(1);

      if (!existing) {
        return {
          isNew: true,
          tokenVersion: 1,
          issuedSecret: newSecret,
          secretHashToSave: newSecretHash,
          linkedUserId: null,
        };
      }

      const secretMatches =
        typeof deviceSecret === 'string' &&
        deviceSecret.length > 0 &&
        typeof existing.deviceSecretHash === 'string' &&
        existing.deviceSecretHash.length > 0 &&
        timingSafeHexEqual(sha256Hex(deviceSecret), existing.deviceSecretHash);
      const bearerMatches = await verifyBearerForDevice(
        authHeader,
        deviceId,
        existing.tokenVersion,
      );

      if (!secretMatches && !bearerMatches) {
        throw new AuthActionError(
          'unauthorized',
          'Existing device requires valid deviceSecret or active session token to renew.',
          401,
        );
      }

      let issuedSecret: string | undefined;
      let secretHashToSave = existing.deviceSecretHash;
      if (!secretHashToSave && bearerMatches) {
        issuedSecret = newSecret;
        secretHashToSave = newSecretHash;
      }

      return {
        isNew: false,
        tokenVersion: existing.tokenVersion,
        issuedSecret,
        secretHashToSave,
        linkedUserId: existing.linkedUserId ?? null,
      };
    }

    const existing = memory.devices.get(deviceId);
    if (!existing) {
      return {
        isNew: true,
        tokenVersion: 1,
        issuedSecret: newSecret,
        secretHashToSave: newSecretHash,
        linkedUserId: null,
      };
    }

    const secretMatches =
      typeof deviceSecret === 'string' &&
      deviceSecret.length > 0 &&
      timingSafeHexEqual(sha256Hex(deviceSecret), existing.secretHash);
    const bearerMatches = await verifyBearerForDevice(authHeader, deviceId, existing.tokenVersion);
    if (!secretMatches && !bearerMatches) {
      throw new AuthActionError(
        'unauthorized',
        'Existing device requires valid deviceSecret or active session token to renew.',
        401,
      );
    }

    return {
      isNew: false,
      tokenVersion: existing.tokenVersion,
      secretHashToSave: existing.secretHash,
      linkedUserId: existing.linkedUserId,
    };
  }

  async function persistPreparedDeviceDb(
    tx: DbTx,
    params: {
      deviceId: string;
      appVersion?: string;
      deviceCtx: ResolvedDeviceContext;
      prepared: PreparedDevice;
      now: Date;
    },
  ): Promise<void> {
    const { deviceId, appVersion, deviceCtx, prepared, now } = params;
    await tx
      .insert(devices)
      .values({
        deviceId,
        edition: env.EDITION,
        appVersion,
        slotKind: deviceCtx.slotKind,
        platform: deviceCtx.platform,
        deviceName: deviceCtx.deviceName,
        deviceSecretHash: prepared.secretHashToSave,
        tokenVersion: prepared.tokenVersion,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: devices.deviceId,
        set: {
          lastSeenAt: now,
          slotKind: deviceCtx.slotKind,
          platform: deviceCtx.platform,
          deviceName: deviceCtx.deviceName,
          appVersion: appVersion ?? sql`${devices.appVersion}`,
          deviceSecretHash: prepared.secretHashToSave ?? sql`${devices.deviceSecretHash}`,
        },
      });
  }

  function persistPreparedDeviceMemory(params: {
    deviceId: string;
    appVersion?: string;
    deviceCtx: ResolvedDeviceContext;
    prepared: PreparedDevice;
  }): void {
    const { deviceId, appVersion, deviceCtx, prepared } = params;
    const existing = memory.devices.get(deviceId);
    if (!existing) {
      memory.devices.set(deviceId, {
        deviceId,
        secretHash: prepared.secretHashToSave ?? '',
        tokenVersion: prepared.tokenVersion,
        linkedUserId: prepared.linkedUserId,
        slotKind: deviceCtx.slotKind,
        platform: deviceCtx.platform,
        deviceName: deviceCtx.deviceName,
        appVersion,
      });
    } else {
      existing.slotKind = deviceCtx.slotKind;
      existing.platform = deviceCtx.platform;
      existing.deviceName = deviceCtx.deviceName;
      if (appVersion) existing.appVersion = appVersion;
    }
  }

  async function ensureDeviceWithTx(params: {
    deviceId: string;
    deviceSecret?: string;
    authHeader?: string;
    appVersion?: string;
    deviceCtx: ResolvedDeviceContext;
    now: Date;
  }): Promise<{ tokenVersion: number; issuedSecret?: string; linkedUserId: string | null }> {
    const prepared = await prepareDeviceCheck(params);
    if (db) {
      await persistPreparedDeviceDb(db, { ...params, prepared });
    } else {
      persistPreparedDeviceMemory({ ...params, prepared });
    }
    return {
      tokenVersion: prepared.tokenVersion,
      issuedSecret: prepared.issuedSecret,
      linkedUserId: prepared.linkedUserId,
    };
  }

  type DbTx = Parameters<Parameters<MockzaDb['transaction']>[0]>[0] | MockzaDb;

  async function buildUserPayloadDb(
    tx: DbTx,
    userId: string,
    now: Date,
  ): Promise<AccountUserPayload> {
    const [u] = await tx
      .select({
        userId: users.userId,
        email: users.email,
        displayName: users.displayName,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    const links = await tx
      .select({ provider: accountLinks.provider })
      .from(accountLinks)
      .where(eq(accountLinks.userId, userId));

    const providersSet = new Set<AuthMethod>();
    if (u?.passwordHash) providersSet.add('email');
    for (const l of links) {
      if (l.provider === 'google' || l.provider === 'apple') {
        providersSet.add(l.provider);
      }
    }

    const [userEnt] = await tx
      .select()
      .from(userEntitlements)
      .where(eq(userEntitlements.userId, userId))
      .limit(1);

    const devEnts = await tx.select().from(entitlements).where(eq(entitlements.userId, userId));

    const isPro = isEntActive(userEnt, now) || devEnts.some((e) => isEntActive(e, now));
    return {
      userId,
      email: u?.email ?? null,
      displayName: u?.displayName ?? null,
      linkedProviders: Array.from(providersSet),
      isPro,
      acceptedDevicePolicyAt: userEnt?.acceptedDevicePolicyAt?.toISOString() ?? null,
    };
  }

  async function preserveDeviceProIntoUserDb(
    tx: DbTx,
    userId: string,
    deviceIds: string[],
    now: Date,
  ): Promise<void> {
    if (deviceIds.length === 0) return;
    const [existingUserEnt] = await tx
      .select()
      .from(userEntitlements)
      .where(eq(userEntitlements.userId, userId))
      .limit(1);
    if (isEntActive(existingUserEnt, now)) return;

    const devRows = await tx.select().from(entitlements).where(eq(entitlements.userId, userId));
    const directRows = await tx
      .select()
      .from(entitlements)
      .where(eq(entitlements.deviceId, deviceIds[0] ?? ''));
    const candidate = [...devRows, ...directRows].find((r) => isEntActive(r, now));
    if (!candidate) return;

    await tx
      .insert(userEntitlements)
      .values({
        userId,
        provider: candidate.provider,
        originalAppUserId: candidate.originalAppUserId ?? userId,
        productId: candidate.productId,
        isPro: candidate.isPro,
        expiresAt: candidate.expiresAt,
        graceUntil: candidate.graceUntil,
        lastVerifiedAt: candidate.lastVerifiedAt ?? now,
        lastEventAt: candidate.lastEventAt ?? now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userEntitlements.userId,
        set: {
          provider: candidate.provider,
          originalAppUserId: candidate.originalAppUserId ?? userId,
          productId: candidate.productId,
          isPro: candidate.isPro,
          expiresAt: candidate.expiresAt,
          graceUntil: candidate.graceUntil,
          lastVerifiedAt: candidate.lastVerifiedAt ?? now,
          lastEventAt: candidate.lastEventAt ?? now,
          updatedAt: now,
        },
      });
  }

  async function claimDeviceSlotDb(params: {
    tx: DbTx;
    userId: string;
    deviceId: string;
    authMethod: AuthMethod;
    deviceCtx: ResolvedDeviceContext;
    now: Date;
  }): Promise<{ currentSession: DeviceSessionPayload; sessions: DeviceSessionPayload[] }> {
    const { tx, userId, deviceId, authMethod, deviceCtx, now } = params;
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

    const activeRows = await tx
      .select()
      .from(userDeviceSessions)
      .where(and(eq(userDeviceSessions.userId, userId), isNull(userDeviceSessions.revokedAt)))
      .orderBy(desc(userDeviceSessions.lastSeenAt));

    const otherActive = activeRows.filter((row) => row.deviceId !== deviceId);
    const conflictingSlot = otherActive.find((row) => row.slotKind === deviceCtx.slotKind);
    if (conflictingSlot) {
      throw new DeviceSlotLimitError(deviceCtx.slotKind, {
        deviceId: conflictingSlot.deviceId,
        deviceIdShort: formatDeviceShort(conflictingSlot.deviceId),
        deviceName: conflictingSlot.deviceName,
        locationLabel: conflictingSlot.locationLabel,
        lastSeenAt: conflictingSlot.lastSeenAt.toISOString(),
      });
    }

    if (otherActive.length >= 2 && otherActive[0]) {
      throw new DeviceSlotLimitError(deviceCtx.slotKind, {
        deviceId: otherActive[0].deviceId,
        deviceIdShort: formatDeviceShort(otherActive[0].deviceId),
        deviceName: otherActive[0].deviceName,
        locationLabel: otherActive[0].locationLabel,
        lastSeenAt: otherActive[0].lastSeenAt.toISOString(),
      });
    }

    const existingSameDevice = activeRows.find((row) => row.deviceId === deviceId);
    if (existingSameDevice) {
      await tx
        .update(userDeviceSessions)
        .set({
          slotKind: deviceCtx.slotKind,
          platform: deviceCtx.platform,
          appSurface: deviceCtx.appSurface,
          deviceName: deviceCtx.deviceName,
          ipMasked: deviceCtx.ipMasked,
          locationLabel: deviceCtx.locationLabel,
          userAgent: deviceCtx.userAgent,
          authMethod,
          lastSeenAt: now,
        })
        .where(eq(userDeviceSessions.sessionId, existingSameDevice.sessionId));
    } else {
      await tx.insert(userDeviceSessions).values({
        sessionId: randomUUID(),
        userId,
        deviceId,
        slotKind: deviceCtx.slotKind,
        platform: deviceCtx.platform,
        appSurface: deviceCtx.appSurface,
        deviceName: deviceCtx.deviceName,
        ipMasked: deviceCtx.ipMasked,
        locationLabel: deviceCtx.locationLabel,
        userAgent: deviceCtx.userAgent,
        authMethod,
        createdAt: now,
        lastSeenAt: now,
      });
    }

    await tx
      .update(devices)
      .set({
        linkedUserId: userId,
        slotKind: deviceCtx.slotKind,
        platform: deviceCtx.platform,
        deviceName: deviceCtx.deviceName,
        lastSeenAt: now,
      })
      .where(eq(devices.deviceId, deviceId));

    await preserveDeviceProIntoUserDb(tx, userId, [deviceId], now);
    await tx
      .update(entitlements)
      .set({ userId, updatedAt: now })
      .where(eq(entitlements.deviceId, deviceId));

    const updatedRows = await tx
      .select()
      .from(userDeviceSessions)
      .where(and(eq(userDeviceSessions.userId, userId), isNull(userDeviceSessions.revokedAt)))
      .orderBy(desc(userDeviceSessions.lastSeenAt));

    const mapped = updatedRows.map((r) => mapSessionRow(r, deviceId));
    const currentSession = mapped.find((r) => r.deviceId === deviceId);
    if (!currentSession) {
      throw new AuthActionError('unauthorized', 'Failed to bind device session.', 401);
    }
    return { currentSession, sessions: mapped };
  }

  function claimDeviceSlotMemory(params: {
    userId: string;
    deviceId: string;
    authMethod: AuthMethod;
    deviceCtx: ResolvedDeviceContext;
    now: Date;
  }): { currentSession: DeviceSessionPayload; sessions: DeviceSessionPayload[] } {
    const { userId, deviceId, authMethod, deviceCtx, now } = params;
    const active = Array.from(memory.sessions.values()).filter(
      (s) => s.userId === userId && s.revokedAt === null,
    );
    const otherActive = active.filter((s) => s.deviceId !== deviceId);
    const conflict = otherActive.find((s) => s.slotKind === deviceCtx.slotKind);
    if (conflict) {
      throw new DeviceSlotLimitError(deviceCtx.slotKind, {
        deviceId: conflict.deviceId,
        deviceIdShort: formatDeviceShort(conflict.deviceId),
        deviceName: conflict.deviceName,
        locationLabel: conflict.locationLabel,
        lastSeenAt: conflict.lastSeenAt.toISOString(),
      });
    }

    const sameDevice = active.find((s) => s.deviceId === deviceId);
    if (sameDevice) {
      sameDevice.slotKind = deviceCtx.slotKind;
      sameDevice.platform = deviceCtx.platform;
      sameDevice.appSurface = deviceCtx.appSurface;
      sameDevice.deviceName = deviceCtx.deviceName;
      sameDevice.ipMasked = deviceCtx.ipMasked;
      sameDevice.locationLabel = deviceCtx.locationLabel;
      sameDevice.userAgent = deviceCtx.userAgent;
      sameDevice.authMethod = authMethod;
      sameDevice.lastSeenAt = now;
    } else {
      const sid = randomUUID();
      memory.sessions.set(sid, {
        sessionId: sid,
        userId,
        deviceId,
        slotKind: deviceCtx.slotKind,
        platform: deviceCtx.platform,
        appSurface: deviceCtx.appSurface,
        deviceName: deviceCtx.deviceName,
        ipMasked: deviceCtx.ipMasked,
        locationLabel: deviceCtx.locationLabel,
        userAgent: deviceCtx.userAgent,
        authMethod,
        createdAt: now,
        lastSeenAt: now,
        revokedAt: null,
        revokedReason: null,
      });
    }

    const dev = memory.devices.get(deviceId);
    if (dev) {
      dev.linkedUserId = userId;
      dev.slotKind = deviceCtx.slotKind;
      dev.platform = deviceCtx.platform;
      dev.deviceName = deviceCtx.deviceName;
    }
    const devEnt = memory.deviceEntitlements.get(deviceId);
    if (isEntActive(devEnt, now) && devEnt) {
      memory.userEntitlements.set(userId, { ...devEnt });
    }

    const list = Array.from(memory.sessions.values())
      .filter((s) => s.userId === userId && s.revokedAt === null)
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
      .map((r) => mapSessionRow(r, deviceId));
    const currentSession = list.find((s) => s.deviceId === deviceId);
    if (!currentSession) {
      throw new AuthActionError('unauthorized', 'Failed to bind device session.', 401);
    }
    return { currentSession, sessions: list };
  }

  function buildUserPayloadMemory(userId: string, now: Date): AccountUserPayload {
    const u = memory.users.get(userId);
    const providers = new Set<AuthMethod>();
    if (u?.passwordHash) providers.add('email');
    for (const l of memory.accountLinks.values()) {
      if (l.userId === userId) providers.add(l.provider);
    }
    const ent = memory.userEntitlements.get(userId);
    return {
      userId,
      email: u?.email ?? null,
      displayName: u?.displayName ?? null,
      linkedProviders: Array.from(providers),
      isPro: isEntActive(ent, now),
      acceptedDevicePolicyAt: ent?.acceptedDevicePolicyAt?.toISOString() ?? null,
    };
  }

  return {
    resolveMemoryDeviceState,

    async authenticateAnonymous({ deviceId, appVersion, deviceSecret, authHeader, deviceCtx }) {
      const now = new Date();
      const ensured = await ensureDeviceWithTx({
        deviceId,
        deviceSecret,
        authHeader,
        appVersion,
        deviceCtx,
        now,
      });

      let linkedEmail: string | null = null;
      if (ensured.linkedUserId) {
        if (db) {
          const [u] = await db
            .select({ email: users.email })
            .from(users)
            .where(eq(users.userId, ensured.linkedUserId))
            .limit(1);
          linkedEmail = u?.email ?? null;
          await db
            .update(userDeviceSessions)
            .set({ lastSeenAt: now })
            .where(
              and(
                eq(userDeviceSessions.deviceId, deviceId),
                eq(userDeviceSessions.userId, ensured.linkedUserId),
                isNull(userDeviceSessions.revokedAt),
              ),
            );
        } else {
          linkedEmail = memory.users.get(ensured.linkedUserId)?.email ?? null;
        }
      }

      const { token, expiresAt } = await signDeviceToken(
        deviceId,
        env,
        30 * 24 * 3600,
        ensured.tokenVersion,
        ensured.linkedUserId,
      );

      return {
        accessToken: token,
        deviceId,
        expiresAt,
        deviceSecret: ensured.issuedSecret,
        linkedUserId: ensured.linkedUserId,
        linkedEmail,
      };
    },

    async registerWithEmail({
      email,
      password,
      displayName,
      deviceId,
      deviceSecret,
      authHeader,
      appVersion,
      deviceCtx,
    }) {
      const now = new Date();
      const normalizedEmail = email.trim().toLowerCase();
      const cleanName = displayName?.trim() || normalizedEmail.split('@')[0] || 'Learner';

      if (db) {
        const [preExistingEmail] = await db
          .select({ userId: users.userId })
          .from(users)
          .where(sql`lower(${users.email}) = ${normalizedEmail}`)
          .limit(1);
        if (preExistingEmail) {
          throw new AuthActionError(
            'email_already_registered',
            'An account with this email already exists. Please sign in instead.',
            409,
          );
        }
      } else {
        for (const u of memory.users.values()) {
          if (u.email?.toLowerCase() === normalizedEmail) {
            throw new AuthActionError(
              'email_already_registered',
              'An account with this email already exists. Please sign in instead.',
              409,
            );
          }
        }
      }

      const prepared = await prepareDeviceCheck({
        deviceId,
        deviceSecret,
        authHeader,
      });

      if (prepared.linkedUserId) {
        throw new AuthActionError(
          'attempt_conflict',
          'This device is already signed in. Sign out first to register a different account.',
          409,
        );
      }

      const passwordHash = await hashPasswordScrypt(password);

      if (db) {
        const result = await db.transaction(async (tx) => {
          const existingEmail = await tx
            .select({ userId: users.userId })
            .from(users)
            .where(sql`lower(${users.email}) = ${normalizedEmail}`)
            .limit(1);
          if (existingEmail[0]) {
            throw new AuthActionError(
              'email_already_registered',
              'An account with this email already exists. Please sign in instead.',
              409,
            );
          }

          await persistPreparedDeviceDb(tx, {
            deviceId,
            appVersion,
            deviceCtx,
            prepared,
            now,
          });

          const userId = randomUUID();
          await tx.insert(users).values({
            userId,
            email: normalizedEmail,
            displayName: cleanName,
            passwordHash,
            createdAt: now,
            updatedAt: now,
          });

          const slotOutcome = await claimDeviceSlotDb({
            tx,
            userId,
            deviceId,
            authMethod: 'email',
            deviceCtx,
            now,
          });
          const userPayload = await buildUserPayloadDb(tx, userId, now);
          return { userId, userPayload, ...slotOutcome };
        });

        const { token, expiresAt } = await signDeviceToken(
          deviceId,
          env,
          30 * 24 * 3600,
          prepared.tokenVersion,
          result.userId,
        );
        return {
          accessToken: token,
          expiresAt,
          deviceId,
          deviceSecret: prepared.issuedSecret,
          user: result.userPayload,
          currentSession: result.currentSession,
          sessions: result.sessions,
        };
      }

      for (const u of memory.users.values()) {
        if (u.email?.toLowerCase() === normalizedEmail) {
          throw new AuthActionError(
            'email_already_registered',
            'An account with this email already exists. Please sign in instead.',
            409,
          );
        }
      }
      const userId = randomUUID();
      memory.users.set(userId, {
        userId,
        email: normalizedEmail,
        displayName: cleanName,
        passwordHash,
        createdAt: now,
      });
      persistPreparedDeviceMemory({
        deviceId,
        appVersion,
        deviceCtx,
        prepared,
      });
      const slotOutcome = claimDeviceSlotMemory({
        userId,
        deviceId,
        authMethod: 'email',
        deviceCtx,
        now,
      });
      const userPayload = buildUserPayloadMemory(userId, now);
      const { token, expiresAt } = await signDeviceToken(
        deviceId,
        env,
        30 * 24 * 3600,
        prepared.tokenVersion,
        userId,
      );
      return {
        accessToken: token,
        expiresAt,
        deviceId,
        deviceSecret: prepared.issuedSecret,
        user: userPayload,
        currentSession: slotOutcome.currentSession,
        sessions: slotOutcome.sessions,
      };
    },

    async loginWithEmail({
      email,
      password,
      deviceId,
      deviceSecret,
      authHeader,
      appVersion,
      deviceCtx,
    }) {
      const now = new Date();
      const normalizedEmail = email.trim().toLowerCase();

      if (db) {
        const [userRow] = await db
          .select()
          .from(users)
          .where(sql`lower(${users.email}) = ${normalizedEmail}`)
          .limit(1);

        if (!userRow?.passwordHash) {
          await verifyDummyPassword(password);
          throw new AuthActionError('invalid_credentials', 'Invalid email or password.', 401);
        }

        const ok = await verifyPasswordScrypt(password, userRow.passwordHash);
        if (!ok) {
          throw new AuthActionError('invalid_credentials', 'Invalid email or password.', 401);
        }

        const prepared = await prepareDeviceCheck({
          deviceId,
          deviceSecret,
          authHeader,
        });

        if (prepared.linkedUserId && prepared.linkedUserId !== userRow.userId) {
          throw new AuthActionError(
            'attempt_conflict',
            'This device is already signed in to a different user account. Sign out first.',
            409,
          );
        }

        const result = await db.transaction(async (tx) => {
          await persistPreparedDeviceDb(tx, {
            deviceId,
            appVersion,
            deviceCtx,
            prepared,
            now,
          });
          const slotOutcome = await claimDeviceSlotDb({
            tx,
            userId: userRow.userId,
            deviceId,
            authMethod: 'email',
            deviceCtx,
            now,
          });
          const userPayload = await buildUserPayloadDb(tx, userRow.userId, now);
          return { userPayload, ...slotOutcome };
        });

        const { token, expiresAt } = await signDeviceToken(
          deviceId,
          env,
          30 * 24 * 3600,
          prepared.tokenVersion,
          userRow.userId,
        );
        return {
          accessToken: token,
          expiresAt,
          deviceId,
          deviceSecret: prepared.issuedSecret,
          user: result.userPayload,
          currentSession: result.currentSession,
          sessions: result.sessions,
        };
      }

      let found: MemoryUser | undefined;
      for (const u of memory.users.values()) {
        if (u.email?.toLowerCase() === normalizedEmail) {
          found = u;
          break;
        }
      }
      if (!found?.passwordHash) {
        await verifyDummyPassword(password);
        throw new AuthActionError('invalid_credentials', 'Invalid email or password.', 401);
      }
      const ok = await verifyPasswordScrypt(password, found.passwordHash);
      if (!ok) {
        throw new AuthActionError('invalid_credentials', 'Invalid email or password.', 401);
      }
      const prepared = await prepareDeviceCheck({
        deviceId,
        deviceSecret,
        authHeader,
      });
      if (prepared.linkedUserId && prepared.linkedUserId !== found.userId) {
        throw new AuthActionError(
          'attempt_conflict',
          'This device is already signed in to a different user account. Sign out first.',
          409,
        );
      }
      const slotOutcome = claimDeviceSlotMemory({
        userId: found.userId,
        deviceId,
        authMethod: 'email',
        deviceCtx,
        now,
      });
      persistPreparedDeviceMemory({
        deviceId,
        appVersion,
        deviceCtx,
        prepared,
      });
      const devAfterClaim = memory.devices.get(deviceId);
      if (devAfterClaim) {
        devAfterClaim.linkedUserId = found.userId;
      }
      const userPayload = buildUserPayloadMemory(found.userId, now);
      const { token, expiresAt } = await signDeviceToken(
        deviceId,
        env,
        30 * 24 * 3600,
        prepared.tokenVersion,
        found.userId,
      );
      return {
        accessToken: token,
        expiresAt,
        deviceId,
        deviceSecret: prepared.issuedSecret,
        user: userPayload,
        currentSession: slotOutcome.currentSession,
        sessions: slotOutcome.sessions,
      };
    },

    async authenticateOAuth({
      claims,
      displayName,
      deviceId,
      deviceSecret,
      authHeader,
      appVersion,
      deviceCtx,
    }) {
      const now = new Date();
      const prepared = await prepareDeviceCheck({
        deviceId,
        deviceSecret,
        authHeader,
      });

      const resolvedName = displayName?.trim() || claims.name || claims.email?.split('@')[0];

      if (db) {
        const result = await db.transaction(async (tx) => {
          await persistPreparedDeviceDb(tx, {
            deviceId,
            appVersion,
            deviceCtx,
            prepared,
            now,
          });
          const [existingLink] = await tx
            .select({ userId: accountLinks.userId })
            .from(accountLinks)
            .where(
              and(
                eq(accountLinks.provider, claims.provider),
                eq(accountLinks.providerSubject, claims.sub),
              ),
            )
            .limit(1);

          let targetUserId: string;
          if (existingLink) {
            targetUserId = String(existingLink.userId);
            if (prepared.linkedUserId && prepared.linkedUserId !== targetUserId) {
              throw new AuthActionError(
                'attempt_conflict',
                'This device is already linked to a different user account.',
                409,
              );
            }
          } else {
            let matchedByEmailUserId: string | null = null;
            if (claims.email && claims.emailVerified) {
              const [byEmail] = await tx
                .select({ userId: users.userId })
                .from(users)
                .where(sql`lower(${users.email}) = ${claims.email.toLowerCase()}`)
                .limit(1);
              matchedByEmailUserId = byEmail?.userId ?? null;
            }

            if (
              prepared.linkedUserId &&
              matchedByEmailUserId &&
              prepared.linkedUserId !== matchedByEmailUserId
            ) {
              throw new AuthActionError(
                'attempt_conflict',
                'This device is already linked to a different user account.',
                409,
              );
            }

            targetUserId = prepared.linkedUserId ?? matchedByEmailUserId ?? randomUUID();
            const [existingUser] = await tx
              .select({ userId: users.userId, email: users.email, displayName: users.displayName })
              .from(users)
              .where(eq(users.userId, targetUserId))
              .limit(1);

            if (!existingUser) {
              await tx.insert(users).values({
                userId: targetUserId,
                email: claims.email ?? null,
                displayName: resolvedName ?? null,
                createdAt: now,
                updatedAt: now,
              });
            } else if (
              (!existingUser.email && claims.email) ||
              (!existingUser.displayName && resolvedName)
            ) {
              await tx
                .update(users)
                .set({
                  email: existingUser.email ?? claims.email ?? null,
                  displayName: existingUser.displayName ?? resolvedName ?? null,
                  updatedAt: now,
                })
                .where(eq(users.userId, targetUserId));
            }

            await tx
              .insert(accountLinks)
              .values({
                linkId: randomUUID(),
                userId: targetUserId,
                provider: claims.provider,
                providerSubject: claims.sub,
              })
              .onConflictDoNothing({
                target: [accountLinks.provider, accountLinks.providerSubject],
              });
          }

          const slotOutcome = await claimDeviceSlotDb({
            tx,
            userId: targetUserId,
            deviceId,
            authMethod: claims.provider,
            deviceCtx,
            now,
          });
          const userPayload = await buildUserPayloadDb(tx, targetUserId, now);
          return { userId: targetUserId, userPayload, ...slotOutcome };
        });

        const { token, expiresAt } = await signDeviceToken(
          deviceId,
          env,
          30 * 24 * 3600,
          prepared.tokenVersion,
          result.userId,
        );
        return {
          accessToken: token,
          expiresAt,
          deviceId,
          deviceSecret: prepared.issuedSecret,
          user: result.userPayload,
          currentSession: result.currentSession,
          sessions: result.sessions,
        };
      }

      const linkKey = `${claims.provider}:${claims.sub}`;
      const existingLink = memory.accountLinks.get(linkKey);
      let targetUserId: string;
      if (existingLink) {
        targetUserId = existingLink.userId;
        if (prepared.linkedUserId && prepared.linkedUserId !== targetUserId) {
          throw new AuthActionError(
            'attempt_conflict',
            'This device is already linked to a different user account.',
            409,
          );
        }
      } else {
        let byEmailId: string | null = null;
        if (claims.email && claims.emailVerified) {
          for (const u of memory.users.values()) {
            if (u.email?.toLowerCase() === claims.email.toLowerCase()) {
              byEmailId = u.userId;
              break;
            }
          }
        }
        targetUserId = prepared.linkedUserId ?? byEmailId ?? randomUUID();
      }

      const slotOutcome = claimDeviceSlotMemory({
        userId: targetUserId,
        deviceId,
        authMethod: claims.provider,
        deviceCtx,
        now,
      });

      if (!memory.users.has(targetUserId)) {
        memory.users.set(targetUserId, {
          userId: targetUserId,
          email: claims.email ?? null,
          displayName: resolvedName ?? null,
          passwordHash: null,
          createdAt: now,
        });
      }
      memory.accountLinks.set(linkKey, {
        userId: targetUserId,
        provider: claims.provider,
        sub: claims.sub,
      });
      persistPreparedDeviceMemory({
        deviceId,
        appVersion,
        deviceCtx,
        prepared,
      });
      const devAfterClaim = memory.devices.get(deviceId);
      if (devAfterClaim) {
        devAfterClaim.linkedUserId = targetUserId;
      }
      const userPayload = buildUserPayloadMemory(targetUserId, now);
      const { token, expiresAt } = await signDeviceToken(
        deviceId,
        env,
        30 * 24 * 3600,
        prepared.tokenVersion,
        targetUserId,
      );
      return {
        accessToken: token,
        expiresAt,
        deviceId,
        deviceSecret: prepared.issuedSecret,
        user: userPayload,
        currentSession: slotOutcome.currentSession,
        sessions: slotOutcome.sessions,
      };
    },

    async linkAuthenticatedDevice({ deviceId, authHeader, claims, deviceCtx }) {
      const bundle = await this.authenticateOAuth({
        claims,
        deviceId,
        authHeader,
        deviceCtx,
      });
      return {
        userId: bundle.user.userId,
        accessToken: bundle.accessToken,
        expiresAt: bundle.expiresAt,
      };
    },

    async logoutCurrentDevice({ deviceId }) {
      const now = new Date();
      let newTokenVersion = 1;

      if (db) {
        newTokenVersion = await db.transaction(async (tx) => {
          const [dev] = await tx
            .select({
              linkedUserId: devices.linkedUserId,
              tokenVersion: devices.tokenVersion,
            })
            .from(devices)
            .where(eq(devices.deviceId, deviceId))
            .limit(1);

          if (!dev) {
            throw new AuthActionError('unauthorized', 'Device session not found.', 401);
          }

          if (dev.linkedUserId) {
            await preserveDeviceProIntoUserDb(tx, dev.linkedUserId, [deviceId], now);
            await tx
              .update(userDeviceSessions)
              .set({ revokedAt: now, revokedReason: 'user_logout' })
              .where(
                and(
                  eq(userDeviceSessions.deviceId, deviceId),
                  isNull(userDeviceSessions.revokedAt),
                ),
              );
          }

          const nextTv = dev.tokenVersion + 1;
          await tx
            .update(devices)
            .set({ linkedUserId: null, tokenVersion: nextTv, lastSeenAt: now })
            .where(eq(devices.deviceId, deviceId));

          await tx
            .update(entitlements)
            .set({ isPro: false, userId: null, expiresAt: null, graceUntil: null, updatedAt: now })
            .where(eq(entitlements.deviceId, deviceId));

          return nextTv;
        });
      } else {
        const dev = memory.devices.get(deviceId);
        if (dev) {
          if (dev.linkedUserId) {
            for (const s of memory.sessions.values()) {
              if (s.deviceId === deviceId && s.revokedAt === null) {
                s.revokedAt = now;
                s.revokedReason = 'user_logout';
              }
            }
          }
          dev.linkedUserId = null;
          dev.tokenVersion += 1;
          newTokenVersion = dev.tokenVersion;
        }
        memory.deviceEntitlements.delete(deviceId);
      }

      const { token, expiresAt } = await signDeviceToken(
        deviceId,
        env,
        30 * 24 * 3600,
        newTokenVersion,
        null,
      );
      return { accessToken: token, deviceId, expiresAt };
    },

    async getAccountSessions({ deviceId, userId }) {
      const now = new Date();
      if (!userId) {
        return {
          isAuthenticated: false,
          user: null,
          currentDeviceId: deviceId,
          devicePolicy: {
            maxMobilePhones: 1,
            maxDesktopWebInstances: 1,
            mobileOccupied: false,
            desktopWebOccupied: false,
          },
          sessions: [],
        };
      }

      if (db) {
        await db
          .update(userDeviceSessions)
          .set({ lastSeenAt: now })
          .where(
            and(
              eq(userDeviceSessions.userId, userId),
              eq(userDeviceSessions.deviceId, deviceId),
              isNull(userDeviceSessions.revokedAt),
            ),
          );

        const activeRows = await db
          .select()
          .from(userDeviceSessions)
          .where(and(eq(userDeviceSessions.userId, userId), isNull(userDeviceSessions.revokedAt)))
          .orderBy(desc(userDeviceSessions.lastSeenAt));

        const sessions = activeRows.map((r) => mapSessionRow(r, deviceId));
        const userPayload = await buildUserPayloadDb(db, userId, now);
        return {
          isAuthenticated: true,
          user: userPayload,
          currentDeviceId: deviceId,
          devicePolicy: {
            maxMobilePhones: 1,
            maxDesktopWebInstances: 1,
            mobileOccupied: sessions.some((s) => s.slotKind === 'mobile'),
            desktopWebOccupied: sessions.some((s) => s.slotKind === 'desktop_web'),
          },
          sessions,
        };
      }

      const active = Array.from(memory.sessions.values())
        .filter((s) => s.userId === userId && s.revokedAt === null)
        .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime());
      for (const s of active) {
        if (s.deviceId === deviceId) s.lastSeenAt = now;
      }
      const sessions = active.map((r) => mapSessionRow(r, deviceId));
      return {
        isAuthenticated: true,
        user: buildUserPayloadMemory(userId, now),
        currentDeviceId: deviceId,
        devicePolicy: {
          maxMobilePhones: 1,
          maxDesktopWebInstances: 1,
          mobileOccupied: sessions.some((s) => s.slotKind === 'mobile'),
          desktopWebOccupied: sessions.some((s) => s.slotKind === 'desktop_web'),
        },
        sessions,
      };
    },

    async terminateDeviceSession({ callerDeviceId, userId, targetDeviceId }) {
      const now = new Date();

      if (db) {
        return db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

          const [targetRow] = await tx
            .select({ sessionId: userDeviceSessions.sessionId })
            .from(userDeviceSessions)
            .where(
              and(
                eq(userDeviceSessions.userId, userId),
                eq(userDeviceSessions.deviceId, targetDeviceId),
                isNull(userDeviceSessions.revokedAt),
              ),
            )
            .limit(1);

          if (!targetRow) {
            throw new AuthActionError('not_found', 'Active device session not found.', 404);
          }

          await preserveDeviceProIntoUserDb(tx, userId, [targetDeviceId], now);

          await tx
            .update(userDeviceSessions)
            .set({
              revokedAt: now,
              revokedReason: callerDeviceId === targetDeviceId ? 'user_logout' : 'remote_terminate',
            })
            .where(eq(userDeviceSessions.sessionId, targetRow.sessionId));

          await tx
            .update(devices)
            .set({
              linkedUserId: null,
              tokenVersion: sql`${devices.tokenVersion} + 1`,
            })
            .where(eq(devices.deviceId, targetDeviceId));

          await tx
            .update(entitlements)
            .set({ isPro: false, userId: null, expiresAt: null, graceUntil: null, updatedAt: now })
            .where(eq(entitlements.deviceId, targetDeviceId));

          const remaining = await tx
            .select()
            .from(userDeviceSessions)
            .where(and(eq(userDeviceSessions.userId, userId), isNull(userDeviceSessions.revokedAt)))
            .orderBy(desc(userDeviceSessions.lastSeenAt));

          return {
            revokedDeviceIds: [targetDeviceId],
            signedOutCurrentDevice: callerDeviceId === targetDeviceId,
            sessions: remaining.map((r) => mapSessionRow(r, callerDeviceId)),
          };
        });
      }

      const targetSession = Array.from(memory.sessions.values()).find(
        (s) => s.userId === userId && s.deviceId === targetDeviceId && s.revokedAt === null,
      );
      if (!targetSession) {
        throw new AuthActionError('not_found', 'Active device session not found.', 404);
      }
      targetSession.revokedAt = now;
      targetSession.revokedReason =
        callerDeviceId === targetDeviceId ? 'user_logout' : 'remote_terminate';
      const targetDev = memory.devices.get(targetDeviceId);
      if (targetDev) {
        targetDev.linkedUserId = null;
        targetDev.tokenVersion += 1;
      }
      memory.deviceEntitlements.delete(targetDeviceId);

      const remaining = Array.from(memory.sessions.values())
        .filter((s) => s.userId === userId && s.revokedAt === null)
        .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
        .map((r) => mapSessionRow(r, callerDeviceId));
      return {
        revokedDeviceIds: [targetDeviceId],
        signedOutCurrentDevice: callerDeviceId === targetDeviceId,
        sessions: remaining,
      };
    },

    async terminateOtherSessions({ callerDeviceId, userId }) {
      const now = new Date();
      if (db) {
        return db.transaction(async (tx) => {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
          const others = await tx
            .select({
              deviceId: userDeviceSessions.deviceId,
              sessionId: userDeviceSessions.sessionId,
            })
            .from(userDeviceSessions)
            .where(
              and(
                eq(userDeviceSessions.userId, userId),
                ne(userDeviceSessions.deviceId, callerDeviceId),
                isNull(userDeviceSessions.revokedAt),
              ),
            );
          const otherIds = others.map((o) => o.deviceId);
          if (otherIds.length > 0) {
            await preserveDeviceProIntoUserDb(tx, userId, otherIds, now);
            await tx
              .update(userDeviceSessions)
              .set({ revokedAt: now, revokedReason: 'revoke_others' })
              .where(
                and(
                  eq(userDeviceSessions.userId, userId),
                  ne(userDeviceSessions.deviceId, callerDeviceId),
                  isNull(userDeviceSessions.revokedAt),
                ),
              );
            for (const otherId of otherIds) {
              await tx
                .update(devices)
                .set({
                  linkedUserId: null,
                  tokenVersion: sql`${devices.tokenVersion} + 1`,
                })
                .where(eq(devices.deviceId, otherId));
              await tx
                .update(entitlements)
                .set({
                  isPro: false,
                  userId: null,
                  expiresAt: null,
                  graceUntil: null,
                  updatedAt: now,
                })
                .where(eq(entitlements.deviceId, otherId));
            }
          }

          const remaining = await tx
            .select()
            .from(userDeviceSessions)
            .where(and(eq(userDeviceSessions.userId, userId), isNull(userDeviceSessions.revokedAt)))
            .orderBy(desc(userDeviceSessions.lastSeenAt));
          return {
            revokedDeviceIds: otherIds,
            sessions: remaining.map((r) => mapSessionRow(r, callerDeviceId)),
          };
        });
      }

      const revokedIds: string[] = [];
      for (const s of memory.sessions.values()) {
        if (s.userId === userId && s.deviceId !== callerDeviceId && s.revokedAt === null) {
          s.revokedAt = now;
          s.revokedReason = 'revoke_others';
          revokedIds.push(s.deviceId);
          const d = memory.devices.get(s.deviceId);
          if (d) {
            d.linkedUserId = null;
            d.tokenVersion += 1;
          }
          memory.deviceEntitlements.delete(s.deviceId);
        }
      }
      const remaining = Array.from(memory.sessions.values())
        .filter((s) => s.userId === userId && s.revokedAt === null)
        .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
        .map((r) => mapSessionRow(r, callerDeviceId));
      return { revokedDeviceIds: revokedIds, sessions: remaining };
    },

    async recordDevicePolicyConsent({ userId }) {
      const now = new Date();
      if (db) {
        await db
          .insert(userEntitlements)
          .values({
            userId,
            provider: 'policy_consent',
            isPro: false,
            acceptedDevicePolicyAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: userEntitlements.userId,
            set: { acceptedDevicePolicyAt: now, updatedAt: now },
          });
        return buildUserPayloadDb(db, userId, now);
      }

      const existing = memory.userEntitlements.get(userId);
      memory.userEntitlements.set(userId, {
        isPro: existing?.isPro ?? false,
        expiresAt: existing?.expiresAt ?? null,
        graceUntil: existing?.graceUntil ?? null,
        acceptedDevicePolicyAt: now,
      });
      return buildUserPayloadMemory(userId, now);
    },

    async isUserOrDevicePro({ deviceId, accountKey }) {
      const now = new Date();
      if (accountKey !== deviceId) {
        return isEntActive(memory.userEntitlements.get(accountKey), now);
      }
      return isEntActive(memory.deviceEntitlements.get(deviceId), now);
    },

    wipeMemoryForAccount({ deviceIds, userId }) {
      for (const id of deviceIds) {
        memory.devices.delete(id);
        memory.deviceEntitlements.delete(id);
      }
      if (userId) {
        memory.users.delete(userId);
        memory.userEntitlements.delete(userId);
        for (const [k, v] of memory.accountLinks.entries()) {
          if (v.userId === userId) memory.accountLinks.delete(k);
        }
        for (const [sid, s] of memory.sessions.entries()) {
          if (s.userId === userId) memory.sessions.delete(sid);
        }
      }
    },
  };
}

import type {
  AppSurfaceSchema,
  DevicePlatformSchema,
  DevicePolicySummarySchema,
  DeviceSlotKindSchema,
  SocialProviderDescriptorSchema,
} from '@mockza/contracts';
import type {
  DeviceSlotOccupiedError,
  NetworkError,
  QuotaExceededError,
  Result,
  StorageError,
  UnauthorizedError,
  UnexpectedError,
  ValidationError,
} from './result';

export type DeviceSlotKind = (typeof DeviceSlotKindSchema)['_output'];
export type DevicePlatform = (typeof DevicePlatformSchema)['_output'];
export type AppSurface = (typeof AppSurfaceSchema)['_output'];

export interface DeviceIdentity {
  readonly deviceInstallId: string;
  readonly slotKind: 'desktop_web';
  readonly platform: 'web_desktop';
  readonly appSurface: 'web_app';
  readonly deviceLabel: string;
  readonly timezone: string;
}

export type AuthProviderKind = 'email' | 'google' | 'apple' | 'sms_otp';

export type SocialProviderDescriptor = Readonly<(typeof SocialProviderDescriptorSchema)['_output']>;
export type DevicePolicySummary = Readonly<(typeof DevicePolicySummarySchema)['_output']>;

export interface SmsOtpProviderDescriptor {
  readonly enabled: boolean;
  readonly mode: 'kavenegar' | 'dev_sandbox' | 'disabled';
}

export interface AuthProvidersSnapshot {
  readonly emailPasswordEnabled: boolean;
  readonly smsOtpEnabled?: boolean;
  readonly smsOtp?: SmsOtpProviderDescriptor;
  readonly google: SocialProviderDescriptor;
  readonly apple: SocialProviderDescriptor;
  readonly devicePolicy: DevicePolicySummary;
}

export interface AuthenticatedUser {
  readonly userId: string;
  readonly email: string | null;
  readonly phoneE164?: string | null;
  readonly displayName: string | null;
  readonly linkedProviders: readonly AuthProviderKind[];
  readonly isPro: boolean;
  readonly acceptedDevicePolicyAt?: string | null;
}

export interface AuthSession {
  readonly accessToken: string;
  readonly expiresAt: string;
  readonly deviceId: string;
  readonly isAuthenticated: boolean;
  readonly user: AuthenticatedUser | null;
  readonly currentSessionId?: string | null;
}

export interface ActiveDeviceSlot {
  readonly sessionId: string;
  readonly deviceId: string;
  readonly deviceIdShort: string;
  readonly slotKind: DeviceSlotKind;
  readonly platform: DevicePlatform;
  readonly appSurface: AppSurface;
  readonly deviceName: string;
  readonly locationLabel: string;
  readonly ipMasked: string | null;
  readonly authMethod: AuthProviderKind;
  readonly isCurrentDevice: boolean;
  readonly createdAt: string;
  readonly lastSeenAt: string;
}

export interface EmailSignInInput {
  readonly email: string;
  readonly password: string;
  readonly replaceSessionId?: string;
}

export interface EmailSignUpInput {
  readonly email: string;
  readonly password: string;
  readonly displayName?: string;
  readonly replaceSessionId?: string;
}

export interface OAuthSignInInput {
  readonly provider: 'google' | 'apple';
  readonly idTokenOrCode: string;
  readonly displayName?: string;
  readonly replaceSessionId?: string;
}

export interface RequestSmsOtpInput {
  readonly phoneE164: string;
}

export interface SmsOtpChallengeResult {
  readonly retryAfterSec: number;
  readonly devOtpHint?: string;
}

export interface VerifySmsOtpInput {
  readonly phoneE164: string;
  readonly otpCode: string;
  readonly displayName?: string;
  readonly replaceSessionId?: string;
}

export interface AccountDeletionReceipt {
  readonly deleted: boolean;
  readonly erasureId?: string;
  readonly receiptToken?: string;
}

export interface RevokeDeviceSessionResult {
  readonly revokedDeviceIds: readonly string[];
  readonly signedOutCurrentDevice: boolean;
  readonly sessions: readonly ActiveDeviceSlot[];
}

export type AuthGatewayError =
  | NetworkError
  | UnauthorizedError
  | DeviceSlotOccupiedError
  | ValidationError
  | QuotaExceededError
  | StorageError
  | UnexpectedError;

export type DeviceSlotGatewayError =
  | NetworkError
  | UnauthorizedError
  | ValidationError
  | UnexpectedError;

export interface IAuthGateway {
  getDeviceIdentity(): Promise<Result<DeviceIdentity, StorageError | UnexpectedError>>;
  getSession(): Promise<Result<AuthSession | null, StorageError | UnexpectedError>>;
  ensureAuthenticated(forceRefresh?: boolean): Promise<Result<AuthSession, AuthGatewayError>>;
  onSessionChanged(listener: (session: AuthSession | null) => void): () => void;
  fetchAuthProviders(): Promise<Result<AuthProvidersSnapshot, NetworkError | UnexpectedError>>;
  signInWithEmail(input: EmailSignInInput): Promise<Result<AuthSession, AuthGatewayError>>;
  signUpWithEmail(input: EmailSignUpInput): Promise<Result<AuthSession, AuthGatewayError>>;
  signInWithOAuth?(input: OAuthSignInInput): Promise<Result<AuthSession, AuthGatewayError>>;
  requestSmsOtp?(
    input: RequestSmsOtpInput,
  ): Promise<Result<SmsOtpChallengeResult, AuthGatewayError>>;
  verifySmsOtp?(input: VerifySmsOtpInput): Promise<Result<AuthSession, AuthGatewayError>>;
  signOutCurrentDevice(): Promise<Result<void, AuthGatewayError>>;
  deleteRemoteAccount(): Promise<Result<AccountDeletionReceipt, AuthGatewayError>>;
}

export interface IDeviceSlotGateway {
  listActiveDevices(): Promise<Result<readonly ActiveDeviceSlot[], DeviceSlotGatewayError>>;
  revokeDeviceSession(
    targetDeviceId: string,
  ): Promise<Result<RevokeDeviceSessionResult, DeviceSlotGatewayError>>;
  revokeOtherDeviceSessions(): Promise<Result<RevokeDeviceSessionResult, DeviceSlotGatewayError>>;
  recordDevicePolicyConsent(): Promise<
    Result<{ readonly acceptedAt: string }, DeviceSlotGatewayError>
  >;
}

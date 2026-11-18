import type { DeviceSlotKindSchema } from '@mockza/contracts';

export interface NetworkError {
  readonly kind: 'network';
  readonly message: string;
  readonly retryable: boolean;
  readonly status?: number;
}

export type UnauthorizedReasonCode =
  | 'SESSION_REVOKED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_CREDENTIALS';

export interface UnauthorizedError {
  readonly kind: 'unauthorized';
  readonly message: string;
  readonly reasonCode?: UnauthorizedReasonCode;
}

export interface OccupyingDeviceInfo {
  readonly sessionId: string;
  readonly deviceId: string;
  readonly deviceName: string;
  readonly slotKind: (typeof DeviceSlotKindSchema)['_output'];
  readonly locationLabel: string | null;
  readonly ipCountry: string | null;
  readonly city: string | null;
  readonly lastSeenAt: string;
}

export interface DeviceSlotOccupiedError {
  readonly kind: 'device_slot_occupied';
  readonly message: string;
  readonly conflictCode: 'DEVICE_SLOT_OCCUPIED';
  readonly occupyingDevice: OccupyingDeviceInfo;
}

export interface ValidationError {
  readonly kind: 'validation';
  readonly message: string;
  readonly field?: string;
  readonly code?: string;
}

export interface EntitlementRequiredError {
  readonly kind: 'entitlement_required';
  readonly message: string;
  readonly feature: string;
}

export interface QuotaExceededError {
  readonly kind: 'quota_exceeded';
  readonly message: string;
  readonly retryAfterSec?: number;
}

export type StorageErrorCode =
  | 'QUOTA_FULL'
  | 'SHA256_MISMATCH'
  | 'CORRUPT_DATA'
  | 'NOT_FOUND';

export interface StorageError {
  readonly kind: 'storage';
  readonly message: string;
  readonly code?: StorageErrorCode;
}

export type AudioErrorCode =
  | 'PERMISSION_DENIED'
  | 'NO_MICROPHONE'
  | 'MUTED_MICROPHONE'
  | 'LOCKED_EXAM_PLAYBACK'
  | 'CODEC_UNSUPPORTED'
  | 'RECORDING_FAILED'
  | 'PLAYBACK_FAILED';

export interface AudioError {
  readonly kind: 'audio';
  readonly message: string;
  readonly code: AudioErrorCode;
}

export type BillingErrorCode =
  | 'TOS_REQUIRED'
  | 'CHECKOUT_CANCELLED'
  | 'PAYMENT_FAILED'
  | 'VERIFICATION_FAILED'
  | 'PROVIDER_UNAVAILABLE';

export interface BillingError {
  readonly kind: 'billing';
  readonly message: string;
  readonly code: BillingErrorCode;
}

export interface UnexpectedError {
  readonly kind: 'unexpected';
  readonly message: string;
  readonly cause?: unknown;
}

export type GatewayError =
  | NetworkError
  | UnauthorizedError
  | DeviceSlotOccupiedError
  | ValidationError
  | EntitlementRequiredError
  | QuotaExceededError
  | StorageError
  | AudioError
  | BillingError
  | UnexpectedError;

export type OkResult<T> = { readonly ok: true; readonly value: T };
export type ErrResult<E> = { readonly ok: false; readonly error: E };

export type Result<T, E = GatewayError> = OkResult<T> | ErrResult<E>;

export function ok<T>(value: T): OkResult<T> {
  return { ok: true, value };
}

export function err<E>(error: E): ErrResult<E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is OkResult<T> {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is ErrResult<E> {
  return !result.ok;
}

export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

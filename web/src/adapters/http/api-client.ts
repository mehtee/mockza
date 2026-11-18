import type { EditionCode } from '@/edition/edition-config';
import type { BillingGatewayError } from '@/gateways/billing.gateway';
import type {
  DeviceSlotOccupiedError,
  EntitlementRequiredError,
  GatewayError,
  NetworkError,
  OccupyingDeviceInfo,
  QuotaExceededError,
  Result,
  UnauthorizedError,
  UnauthorizedReasonCode,
  ValidationError,
} from '@/gateways/result';
import type { OutboxTransport } from '@/adapters/dexie/dexie-outbox.adapter';
import type { SyncOutboxError } from '@/gateways/storage.gateway';
import { err, ok } from '@/gateways/result';

export const DEFAULT_API_TIMEOUT_MS = 15_000;

export interface ApiClientConfig {
  readonly apiBaseUrl: string;
  readonly edition: EditionCode;
  readonly fetchFn?: typeof fetch;
  readonly readAccessToken: () => Promise<string | null> | string | null;
  readonly refreshAccessToken?: () => Promise<string | null>;
  readonly onSessionRevoked?: () => void;
  readonly timeoutMs?: number;
}

export interface ApiRequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly rawBody?: BodyInit;
  readonly includeAuthOnAuthRoute?: boolean;
  readonly skipAuthRefresh?: boolean;
  readonly signal?: AbortSignal;
}

function normalizePort(url: URL): string {
  if (url.port) return url.port;
  if (url.protocol === 'https:') return '443';
  if (url.protocol === 'http:') return '80';
  return '';
}

export function isSameApiOrigin(requestUrl: string, apiBaseUrl: string): boolean {
  if (requestUrl.startsWith('//')) {
    if (typeof globalThis.location === 'undefined' || !globalThis.location.href) {
      return false;
    }
    try {
      const locUrl = new URL(globalThis.location.href);
      const reqUrl = new URL(requestUrl, locUrl);
      const trimmedBase = apiBaseUrl.trim();
      const baseUrl = trimmedBase.length > 0 ? new URL(trimmedBase) : locUrl;
      return (
        reqUrl.protocol === baseUrl.protocol &&
        reqUrl.hostname === baseUrl.hostname &&
        normalizePort(reqUrl) === normalizePort(baseUrl)
      );
    } catch {
      return false;
    }
  }

  if (!requestUrl.startsWith('http://') && !requestUrl.startsWith('https://')) {
    return true;
  }

  let reqUrl: URL;
  try {
    reqUrl = new URL(requestUrl);
  } catch {
    return false;
  }

  const trimmedBase = apiBaseUrl.trim();
  if (trimmedBase.length === 0) {
    if (typeof globalThis.location === 'undefined' || !globalThis.location.href) {
      return false;
    }
    try {
      const locUrl = new URL(globalThis.location.href);
      return (
        reqUrl.protocol === locUrl.protocol &&
        reqUrl.hostname === locUrl.hostname &&
        normalizePort(reqUrl) === normalizePort(locUrl)
      );
    } catch {
      return false;
    }
  }

  try {
    const apiUrl = new URL(trimmedBase);
    return (
      reqUrl.protocol === apiUrl.protocol &&
      reqUrl.hostname === apiUrl.hostname &&
      normalizePort(reqUrl) === normalizePort(apiUrl)
    );
  } catch {
    return false;
  }
}

export function isSignedPutUrl(url: string): boolean {
  return url.includes('/v1/uploads/signed-put');
}

export function isAuthEndpoint(url: string): boolean {
  return url.includes('/v1/auth/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(obj: Record<string, unknown>, key: string): string | undefined {
  const val = obj[key];
  return typeof val === 'string' && val.length > 0 ? val : undefined;
}

function readNullableString(obj: Record<string, unknown>, key: string): string | null {
  const val = obj[key];
  return typeof val === 'string' ? val : null;
}

function parseOccupyingDevice(body: Record<string, unknown>): OccupyingDeviceInfo {
  const details = isRecord(body['details']) ? body['details'] : undefined;
  const rawDevice = isRecord(body['occupyingDevice'])
    ? body['occupyingDevice']
    : details && isRecord(details['occupyingDevice'])
      ? details['occupyingDevice']
      : {};

  const rawSlotKind =
    readString(rawDevice, 'slotKind') ??
    (details ? readString(details, 'slotKind') : undefined);
  const slotKind = rawSlotKind === 'mobile' ? 'mobile' : 'desktop_web';

  const deviceId = readString(rawDevice, 'deviceId') ?? '';
  return {
    sessionId: readString(rawDevice, 'sessionId') ?? deviceId,
    deviceId,
    deviceName: readString(rawDevice, 'deviceName') ?? 'Desktop Browser',
    slotKind,
    locationLabel: readNullableString(rawDevice, 'locationLabel'),
    ipCountry: readNullableString(rawDevice, 'ipCountry'),
    city: readNullableString(rawDevice, 'city'),
    lastSeenAt: readString(rawDevice, 'lastSeenAt') ?? new Date(0).toISOString(),
  };
}

function parseUnauthorizedReasonCode(
  body: Record<string, unknown>,
): UnauthorizedReasonCode | undefined {
  const details = isRecord(body['details']) ? body['details'] : undefined;
  const rawReason =
    readString(body, 'reasonCode') ?? (details ? readString(details, 'reasonCode') : undefined);
  if (
    rawReason === 'SESSION_REVOKED' ||
    rawReason === 'TOKEN_EXPIRED' ||
    rawReason === 'INVALID_CREDENTIALS'
  ) {
    return rawReason;
  }
  const code = readString(body, 'code');
  if (code === 'invalid_credentials') {
    return 'INVALID_CREDENTIALS';
  }
  return undefined;
}

export type ApiClientError =
  | NetworkError
  | UnauthorizedError
  | DeviceSlotOccupiedError
  | ValidationError
  | EntitlementRequiredError
  | QuotaExceededError;

export function mapHttpErrorResponse(
  status: number,
  body: unknown,
  headers?: Headers,
  fallbackMessage?: string,
): ApiClientError {
  const obj = isRecord(body) ? body : {};
  const details = isRecord(obj['details']) ? obj['details'] : undefined;
  const code = readString(obj, 'code');
  const conflictCode = readString(obj, 'conflictCode');
  const message =
    readString(obj, 'message') ?? fallbackMessage ?? `HTTP request failed with status ${status}`;

  if (
    status === 409 &&
    (code === 'device_slot_limit_reached' || conflictCode === 'DEVICE_SLOT_OCCUPIED')
  ) {
    return {
      kind: 'device_slot_occupied',
      message,
      conflictCode: 'DEVICE_SLOT_OCCUPIED',
      occupyingDevice: parseOccupyingDevice(obj),
    };
  }

  if (status === 401 || code === 'unauthorized' || code === 'invalid_credentials') {
    const reasonCode = parseUnauthorizedReasonCode(obj);
    return reasonCode !== undefined
      ? { kind: 'unauthorized', message, reasonCode }
      : { kind: 'unauthorized', message };
  }

  if (status === 402 || code === 'entitlement_required') {
    const feature =
      readString(obj, 'feature') ??
      (details ? readString(details, 'feature') : undefined) ??
      'pro';
    return {
      kind: 'entitlement_required',
      message,
      feature,
    };
  }

  if (status === 429 || code === 'quota_exceeded') {
    const headerRetry = headers?.get('retry-after')?.trim();
    const parsedHeaderRetry =
      headerRetry && /^\d+$/.test(headerRetry) ? Number.parseInt(headerRetry, 10) : Number.NaN;
    const bodyRetry =
      typeof obj['retryAfterSec'] === 'number'
        ? obj['retryAfterSec']
        : details && typeof details['retryAfterSec'] === 'number'
          ? details['retryAfterSec']
          : undefined;
    const retryAfterSec = Number.isFinite(parsedHeaderRetry) ? parsedHeaderRetry : bodyRetry;
    return retryAfterSec !== undefined
      ? { kind: 'quota_exceeded', message, retryAfterSec }
      : { kind: 'quota_exceeded', message };
  }

  if (
    status === 400 ||
    status === 422 ||
    code === 'validation_error' ||
    code === 'email_already_registered' ||
    code === 'attempt_conflict'
  ) {
    const field =
      readString(obj, 'field') ?? (details ? readString(details, 'field') : undefined);
    return {
      kind: 'validation',
      message,
      ...(field !== undefined ? { field } : {}),
      ...(code !== undefined ? { code } : {}),
    };
  }

  return {
    kind: 'network',
    message,
    retryable: status >= 500 || status === 408 || status === 429,
    status,
  };
}

function stripRestrictedHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === 'authorization' || lower === 'x-mockza-edition') {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

export class ApiClient {
  private readonly apiBaseUrl: string;
  private readonly edition: EditionCode;
  private readonly fetchFn: typeof fetch;
  private readonly readAccessToken: () => Promise<string | null> | string | null;
  private readonly refreshAccessToken?: () => Promise<string | null>;
  private readonly onSessionRevoked?: () => void;
  private readonly timeoutMs: number;
  private refreshInFlight: Promise<string | null> | null = null;

  constructor(config: ApiClientConfig) {
    this.apiBaseUrl = config.apiBaseUrl.replace(/\/+$/, '');
    this.edition = config.edition;
    this.fetchFn = config.fetchFn ?? ((input, init) => globalThis.fetch(input, init));
    this.readAccessToken = config.readAccessToken;
    this.refreshAccessToken = config.refreshAccessToken;
    this.onSessionRevoked = config.onSessionRevoked;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  }

  getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }

  getEdition(): EditionCode {
    return this.edition;
  }

  resolveUrl(pathOrUrl: string): string {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    const normalized = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${this.apiBaseUrl}${normalized}`;
  }

  private async runSingleFlightRefresh(): Promise<string | null> {
    if (!this.refreshAccessToken) {
      return null;
    }
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }
    const pending = Promise.resolve(this.refreshAccessToken()).finally(() => {
      if (this.refreshInFlight === pending) {
        this.refreshInFlight = null;
      }
    });
    this.refreshInFlight = pending;
    return pending;
  }

  async request<T>(
    pathOrUrl: string,
    options: ApiRequestOptions = {},
  ): Promise<Result<T, ApiClientError>> {
    const detailed = await this.executeRequest<T>(pathOrUrl, options, false);
    return detailed.result;
  }

  async requestDetailed<T>(
    pathOrUrl: string,
    options: ApiRequestOptions = {},
  ): Promise<{
    readonly result: Result<T, ApiClientError>;
    readonly status?: number;
    readonly rawErrorBody?: unknown;
  }> {
    return this.executeRequest<T>(pathOrUrl, options, false);
  }

  get<T>(pathOrUrl: string, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) {
    return this.request<T>(pathOrUrl, { ...options, method: 'GET' });
  }

  post<T>(
    pathOrUrl: string,
    body?: unknown,
    options: Omit<ApiRequestOptions, 'method' | 'body'> = {},
  ) {
    return this.request<T>(pathOrUrl, { ...options, method: 'POST', body });
  }

  put<T>(
    pathOrUrl: string,
    body?: unknown,
    options: Omit<ApiRequestOptions, 'method' | 'body'> = {},
  ) {
    return this.request<T>(pathOrUrl, { ...options, method: 'PUT', body });
  }

  delete<T>(pathOrUrl: string, options: Omit<ApiRequestOptions, 'method'> = {}) {
    return this.request<T>(pathOrUrl, { ...options, method: 'DELETE' });
  }

  private async executeRequest<T>(
    pathOrUrl: string,
    options: ApiRequestOptions,
    alreadyRetried: boolean,
    overrideToken?: string,
  ): Promise<{
    readonly result: Result<T, ApiClientError>;
    readonly status?: number;
    readonly rawErrorBody?: unknown;
  }> {
    const resolvedUrl = this.resolveUrl(pathOrUrl);
    const sameOrigin = isSameApiOrigin(resolvedUrl, this.apiBaseUrl);
    const signedPut = isSignedPutUrl(resolvedUrl);
    const authRoute = isAuthEndpoint(resolvedUrl);

    const headers: Record<string, string> = {
      ...(options.headers ?? {}),
    };

    if (!sameOrigin || signedPut) {
      const cleaned = stripRestrictedHeaders(headers);
      for (const key of Object.keys(headers)) {
        delete headers[key];
      }
      Object.assign(headers, cleaned);
    } else {
      headers['x-mockza-edition'] = this.edition;
      if (!headers['accept']) {
        headers['accept'] = 'application/json';
      }
      if (!authRoute || options.includeAuthOnAuthRoute) {
        const token = overrideToken ?? (await this.readAccessToken());
        if (token && token.length > 0 && !headers['authorization'] && !headers['Authorization']) {
          headers['authorization'] = `Bearer ${token}`;
        }
      }
    }

    let bodyInit: BodyInit | undefined = options.rawBody;
    if (bodyInit === undefined && options.body !== undefined) {
      if (!headers['content-type'] && !headers['Content-Type']) {
        headers['content-type'] = 'application/json';
      }
      bodyInit = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timeoutId =
      this.timeoutMs > 0
        ? setTimeout(() => {
            controller.abort();
          }, this.timeoutMs)
        : undefined;

    const externalSignal = options.signal;
    const onExternalAbort = (): void => {
      controller.abort();
    };
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    try {
      const init: RequestInit = {
        method: options.method ?? 'GET',
        headers,
        signal: controller.signal,
        ...(bodyInit !== undefined ? { body: bodyInit } : {}),
        ...(sameOrigin && !signedPut ? { credentials: 'include' } : { credentials: 'omit' }),
      };

      const response = await this.fetchFn(resolvedUrl, init);

      const contentType = response.headers?.get?.('content-type') ?? '';
      let parsedBody: unknown = undefined;
      if (response.status !== 204) {
        if (contentType.includes('application/json') || contentType.length === 0) {
          try {
            const text = await response.text();
            parsedBody = text.length > 0 ? (JSON.parse(text) as unknown) : undefined;
          } catch {
            parsedBody = undefined;
          }
        }
      }

      if (!response.ok) {
        const mapped = mapHttpErrorResponse(response.status, parsedBody, response.headers);

        if (
          sameOrigin &&
          response.status === 401 &&
          !alreadyRetried &&
          !options.skipAuthRefresh &&
          !authRoute &&
          !signedPut &&
          this.refreshAccessToken &&
          !(
            mapped.kind === 'unauthorized' &&
            (mapped.reasonCode === 'SESSION_REVOKED' ||
              mapped.reasonCode === 'INVALID_CREDENTIALS')
          )
        ) {
          const refreshedToken = await this.runSingleFlightRefresh();
          if (refreshedToken && refreshedToken.length > 0) {
            return this.executeRequest<T>(pathOrUrl, options, true, refreshedToken);
          }
        }

        if (mapped.kind === 'unauthorized' && mapped.reasonCode === 'SESSION_REVOKED') {
          this.onSessionRevoked?.();
        }
        return {
          result: err(mapped),
          status: response.status,
          rawErrorBody: parsedBody,
        };
      }

      return {
        result: ok(parsedBody as T),
        status: response.status,
      };
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Network request failed';
      return {
        result: err<NetworkError>({
          kind: 'network',
          message: `HTTP request error: ${message}`,
          retryable: true,
        }),
      };
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
    }
  }
}

export function mapApiErrorToBillingError(error: ApiClientError): BillingGatewayError {
  switch (error.kind) {
    case 'network':
      return error;
    case 'unauthorized':
      return error;
    case 'validation':
      return error;
    default:
      return {
        kind: 'billing',
        code: 'PROVIDER_UNAVAILABLE',
        message: error.message,
      };
  }
}

export function mapGatewayErrorToSyncOutboxError(error: GatewayError): SyncOutboxError {
  switch (error.kind) {
    case 'network':
    case 'unauthorized':
    case 'quota_exceeded':
    case 'entitlement_required':
    case 'validation':
    case 'storage':
    case 'unexpected':
      return error;
    case 'device_slot_occupied':
      return { kind: 'unauthorized', message: error.message, reasonCode: 'SESSION_REVOKED' };
    case 'audio':
    case 'billing':
      return { kind: 'unexpected', message: error.message, cause: error };
  }
}

export function createHttpOutboxTransport(client: ApiClient): OutboxTransport {
  return {
    async enqueueWritingEvaluation(payload) {
      const res = await client.post<{ readonly jobId: string }>('/v1/evaluate/writing', payload);
      return res.ok ? res : err(mapGatewayErrorToSyncOutboxError(res.error));
    },
    async presignAudioUpload(input) {
      const res = await client.post<{ readonly uploadUrl: string; readonly objectKey: string }>(
        '/v1/uploads/presign',
        input,
      );
      return res.ok ? res : err(mapGatewayErrorToSyncOutboxError(res.error));
    },
    async enqueueSpeakingEvaluation(payload) {
      const res = await client.post<{ readonly jobId: string }>('/v1/evaluate/speaking', payload);
      return res.ok ? res : err(mapGatewayErrorToSyncOutboxError(res.error));
    },
    async flagQuestion(payload) {
      const res = await client.post<unknown>('/v1/feedback/question-flag', payload);
      return res.ok ? ok(undefined) : err(mapGatewayErrorToSyncOutboxError(res.error));
    },
  };
}

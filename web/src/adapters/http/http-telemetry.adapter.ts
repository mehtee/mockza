import { serialDayFromUtcMs, type SerialDay } from '@mockza/domain';
import { err, ok, type NetworkError, type Result, type UnexpectedError } from '@/gateways/result';
import type {
  IClock,
  ITelemetryGateway,
  TelemetryFlushReport,
  TelemetryProperties,
} from '@/gateways/telemetry.gateway';
import type { ApiClient } from './api-client';

const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|authorization|cookie|receipt|email|phone|phoneE164|otp|otpCode|jwt|bearer)/i;

export class SystemClock implements IClock {
  nowMs(): number {
    return Date.now();
  }

  nowIso(): string {
    return new Date(this.nowMs()).toISOString();
  }

  todaySerialDay(): SerialDay {
    return serialDayFromUtcMs(this.nowMs());
  }
}

export interface QueuedTelemetryEvent {
  readonly eventName: string;
  readonly properties?: TelemetryProperties;
  readonly timestamp: string;
}

export interface HttpTelemetryAdapterOptions {
  readonly apiClient: ApiClient;
  readonly clock: IClock;
  readonly maxQueueSize?: number;
  readonly endpointPath?: string;
}

function sanitizeProperties(
  properties?: TelemetryProperties,
): TelemetryProperties | undefined {
  if (!properties) return undefined;
  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class HttpTelemetryAdapter implements ITelemetryGateway {
  private readonly apiClient: ApiClient;
  private readonly clock: IClock;
  private readonly maxQueueSize: number;
  private readonly endpointPath: string;
  private buffer: QueuedTelemetryEvent[] = [];

  constructor(options: HttpTelemetryAdapterOptions) {
    this.apiClient = options.apiClient;
    this.clock = options.clock;
    this.maxQueueSize = options.maxQueueSize ?? 100;
    this.endpointPath = options.endpointPath ?? '/v1/telemetry/events';
  }

  getBufferedCount(): number {
    return this.buffer.length;
  }

  track(eventName: string, properties?: TelemetryProperties): void {
    const trimmed = eventName.trim();
    if (!trimmed) return;
    if (this.buffer.length >= this.maxQueueSize) {
      this.buffer.shift();
    }
    const cleanProps = sanitizeProperties(properties);
    this.buffer.push({
      eventName: trimmed,
      timestamp: this.clock.nowIso(),
      ...(cleanProps ? { properties: cleanProps } : {}),
    });
  }

  recordError(error: unknown, context?: TelemetryProperties): void {
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : 'Error';
    const cleanContext = sanitizeProperties(context);
    this.track('client_error', {
      errorName: name,
      errorMessage: message.slice(0, 300),
      ...(cleanContext ?? {}),
    });
  }

  async flush(): Promise<Result<TelemetryFlushReport, NetworkError | UnexpectedError>> {
    if (this.buffer.length === 0) {
      return ok({ acceptedCount: 0 });
    }

    const batch = this.buffer.splice(0, 100);
    const res = await this.apiClient.post<{ readonly acceptedCount?: number }>(
      this.endpointPath,
      { events: batch },
    );

    if (!res.ok) {
      const spaceLeft = Math.max(0, this.maxQueueSize - this.buffer.length);
      if (spaceLeft > 0) {
        const toRestore = batch.slice(Math.max(0, batch.length - spaceLeft));
        this.buffer.unshift(...toRestore);
      }
      if (res.error.kind === 'network') {
        return err(res.error);
      }
      return err<UnexpectedError>({
        kind: 'unexpected',
        message: res.error.message,
        cause: res.error,
      });
    }

    return ok({
      acceptedCount: res.value?.acceptedCount ?? batch.length,
    });
  }
}

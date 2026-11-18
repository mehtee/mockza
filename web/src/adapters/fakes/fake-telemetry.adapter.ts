import { ok, type NetworkError, type Result, type UnexpectedError } from '@/gateways/result';
import type {
  IClock,
  ITelemetryGateway,
  TelemetryFlushReport,
  TelemetryProperties,
} from '@/gateways/telemetry.gateway';
import { FakeClock } from './fake-clock';

const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|authorization|cookie|receipt|email|phone|phoneE164|otp|otpCode|jwt|bearer)/i;

export interface RecordedTelemetryEvent {
  readonly eventName: string;
  readonly properties?: TelemetryProperties;
  readonly timestamp: string;
}

export interface RecordedTelemetryError {
  readonly error: unknown;
  readonly context?: TelemetryProperties;
  readonly timestamp: string;
}

function redactProperties(properties?: TelemetryProperties): TelemetryProperties | undefined {
  if (!properties) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(properties)) {
    out[k] = SENSITIVE_KEY_PATTERN.test(k) ? '[REDACTED]' : v;
  }
  return out;
}

export class FakeTelemetryAdapter implements ITelemetryGateway {
  private readonly clock: IClock;
  private readonly maxQueueSize: number;
  readonly bufferedEvents: RecordedTelemetryEvent[] = [];
  readonly flushedEvents: RecordedTelemetryEvent[] = [];
  readonly recordedErrors: RecordedTelemetryError[] = [];

  constructor(options: { readonly clock?: IClock; readonly maxQueueSize?: number } = {}) {
    this.clock = options.clock ?? new FakeClock();
    this.maxQueueSize = options.maxQueueSize ?? 100;
  }

  track(eventName: string, properties?: TelemetryProperties): void {
    const trimmed = eventName.trim();
    if (!trimmed) return;
    if (this.bufferedEvents.length >= this.maxQueueSize) {
      this.bufferedEvents.shift();
    }
    const cleanProps = redactProperties(properties);
    this.bufferedEvents.push({
      eventName: trimmed,
      timestamp: this.clock.nowIso(),
      ...(cleanProps ? { properties: cleanProps } : {}),
    });
  }

  recordError(error: unknown, context?: TelemetryProperties): void {
    const cleanContext = redactProperties(context);
    this.recordedErrors.push({
      error,
      timestamp: this.clock.nowIso(),
      ...(cleanContext ? { context: cleanContext } : {}),
    });
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : 'Error';
    this.track('client_error', {
      errorName: name,
      errorMessage: message.slice(0, 300),
      ...(cleanContext ?? {}),
    });
  }

  async flush(): Promise<Result<TelemetryFlushReport, NetworkError | UnexpectedError>> {
    if (this.bufferedEvents.length === 0) {
      return ok({ acceptedCount: 0 });
    }
    const batch = this.bufferedEvents.splice(0, 100);
    this.flushedEvents.push(...batch);
    return ok({ acceptedCount: batch.length });
  }
}

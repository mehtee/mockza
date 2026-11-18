import type { SerialDay } from '@mockza/domain';
import type { NetworkError, Result, UnexpectedError } from './result';

export type TelemetryPrimitive = string | number | boolean | null;
export type TelemetryProperties = Readonly<Record<string, TelemetryPrimitive>>;

export interface IClock {
  nowMs(): number;
  nowIso(): string;
  todaySerialDay(): SerialDay;
}

export interface TelemetryFlushReport {
  readonly acceptedCount: number;
}

export interface ITelemetryGateway {
  track(eventName: string, properties?: TelemetryProperties): void;
  recordError(error: unknown, context?: TelemetryProperties): void;
  flush(): Promise<Result<TelemetryFlushReport, NetworkError | UnexpectedError>>;
}

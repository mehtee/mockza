import { serialDayFromUtcMs, type SerialDay } from '@mockza/domain';
import type { IClock } from '@/gateways/telemetry.gateway';

export const DEFAULT_FAKE_CLOCK_MS = Date.UTC(2026, 10, 18, 12, 0, 0);

export class FakeClock implements IClock {
  private currentMs: number;

  constructor(initialMs: number = DEFAULT_FAKE_CLOCK_MS) {
    this.currentMs = Math.trunc(initialMs);
  }

  nowMs(): number {
    return this.currentMs;
  }

  nowIso(): string {
    return new Date(this.currentMs).toISOString();
  }

  todaySerialDay(): SerialDay {
    return serialDayFromUtcMs(this.currentMs);
  }

  setNowMs(ms: number): void {
    this.currentMs = Math.trunc(ms);
  }

  advanceByMs(deltaMs: number): void {
    this.currentMs += Math.trunc(deltaMs);
  }

  advanceDays(days: number): void {
    this.currentMs += Math.trunc(days * 86_400_000);
  }
}

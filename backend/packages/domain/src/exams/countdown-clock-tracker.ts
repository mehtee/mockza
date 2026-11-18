export type NowMsProvider = () => number;

/**
 * Wall-clock countdown tracker resistant to background suspension and JS timer throttling.
 */
export class CountdownClockTracker {
  private readonly nowMs: NowMsProvider;
  private _totalSeconds = 0;
  private _remainingAtAnchor = 0;
  private _anchorTimeMs: number | null = null;
  private _isPaused = false;

  constructor(options?: { nowMs?: NowMsProvider }) {
    this.nowMs = options?.nowMs ?? (() => Date.now());
  }

  get totalSeconds(): number {
    return this._totalSeconds;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get isExpired(): boolean {
    return this.currentRemaining() <= 0;
  }

  /** Starts or resets the tracker at `remainingSeconds` out of `totalSeconds`. */
  start(params: { remainingSeconds: number; totalSeconds?: number }): void {
    this._totalSeconds = Math.max(0, params.totalSeconds ?? params.remainingSeconds);
    this._remainingAtAnchor = Math.max(0, Math.min(this._totalSeconds, params.remainingSeconds));
    this._anchorTimeMs = this._remainingAtAnchor > 0 ? this.nowMs() : null;
    this._isPaused = false;
  }

  /** Freezes remaining time at current elapsed value. */
  pause(): number {
    const rem = this.currentRemaining();
    this._remainingAtAnchor = rem;
    this._anchorTimeMs = null;
    this._isPaused = true;
    return rem;
  }

  /** Resumes counting down from the frozen remaining value. */
  resume(): void {
    if (!this._isPaused) return;
    this._isPaused = false;
    this._anchorTimeMs = this._remainingAtAnchor > 0 ? this.nowMs() : null;
  }

  /** Computes remaining seconds directly from elapsed wall clock time. */
  currentRemaining(): number {
    if (this._isPaused || this._anchorTimeMs === null) {
      return Math.max(0, Math.min(this._totalSeconds, this._remainingAtAnchor));
    }
    const elapsed = Math.trunc((this.nowMs() - this._anchorTimeMs) / 1000);
    if (elapsed <= 0) {
      return Math.max(0, Math.min(this._totalSeconds, this._remainingAtAnchor));
    }
    return Math.max(0, Math.min(this._totalSeconds, this._remainingAtAnchor - elapsed));
  }
}

import { CountdownClockTracker } from '@mockza/domain';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeps } from '@/spa/deps';

export interface UseCountdownClockOptions {
  readonly enabled: boolean;
  readonly isPaused: boolean;
  readonly initialSeconds: number;
  readonly onExpire?: () => void;
}

/**
 * Wall-clock countdown hook backed by `@mockza/domain`'s `CountdownClockTracker`.
 * Keeps timer side effects (`onExpire`) out of React state updaters and resists tab throttling.
 */
export function useCountdownClock({
  enabled,
  isPaused,
  initialSeconds,
  onExpire,
}: UseCountdownClockOptions) {
  const deps = useDeps();
  const safeInitial = Math.max(0, Math.trunc(initialSeconds));

  const trackerRef = useRef<CountdownClockTracker | null>(null);
  if (!trackerRef.current) {
    const tracker = new CountdownClockTracker({ nowMs: () => deps.clock.nowMs() });
    tracker.start({ remainingSeconds: safeInitial, totalSeconds: safeInitial });
    trackerRef.current = tracker;
  }

  const armedRef = useRef(safeInitial > 0);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const [remainingSeconds, setRemainingSeconds] = useState<number>(safeInitial);

  const resetClock = useCallback((nextRemaining: number, nextTotal?: number) => {
    const safeRem = Math.max(0, Math.trunc(nextRemaining));
    const safeTot = Math.max(safeRem, Math.trunc(nextTotal ?? safeRem));
    trackerRef.current?.start({ remainingSeconds: safeRem, totalSeconds: safeTot });
    armedRef.current = safeRem > 0;
    setRemainingSeconds(safeRem);
  }, []);

  useEffect(() => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    if (!enabled || isPaused) {
      tracker.pause();
      return;
    }
    tracker.resume();
  }, [enabled, isPaused]);

  useEffect(() => {
    const tracker = trackerRef.current;
    if (!tracker || !enabled || isPaused) return;
    const syncRemaining = () => {
      const next = tracker.currentRemaining();
      setRemainingSeconds((prev) => (prev === next ? prev : next));
    };
    syncRemaining();
    const intervalId = window.setInterval(syncRemaining, 500);
    return () => window.clearInterval(intervalId);
  }, [enabled, isPaused]);

  useEffect(() => {
    if (!enabled || isPaused) return;
    if (remainingSeconds <= 0 && armedRef.current) {
      armedRef.current = false;
      onExpireRef.current?.();
    }
  }, [enabled, isPaused, remainingSeconds]);

  return { remainingSeconds, resetClock };
}

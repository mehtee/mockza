import type { DroppedContentItem, LinguisticGatewayError } from '@/gateways/linguistic.gateway';
import type { Result } from '@/gateways/result';
import type { AppDependencies } from '@/spa/deps';

export interface ReadyBackgroundDrop {
  readonly jobId: string;
  readonly dropId: string;
  readonly title: string;
}

type ReadyDropListener = (ready: ReadyBackgroundDrop | null) => void;

const dropListeners = new Set<ReadyDropListener>();
let latestReadyDrop: ReadyBackgroundDrop | null = null;
const activeDropTimers = new Map<string, number>();

export function subscribeBackgroundDropReady(listener: ReadyDropListener): () => void {
  dropListeners.add(listener);
  listener(latestReadyDrop);
  return () => {
    dropListeners.delete(listener);
  };
}

export function clearBackgroundDropReady(): void {
  latestReadyDrop = null;
  for (const listener of dropListeners) {
    listener(null);
  }
}

export type AdvancedJobPollOutcome<T> =
  | { readonly kind: 'completed'; readonly result: T }
  | { readonly kind: 'failed'; readonly stage?: string }
  | { readonly kind: 'timeout'; readonly lastStage?: string }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'error'; readonly error: LinguisticGatewayError };

function delayForElapsed(elapsedMs: number): number {
  if (elapsedMs < 5_000) return 800;
  if (elapsedMs < 20_000) return 1_500;
  return 2_500;
}

/**
 * Progressive polling for Register Shifter and Drop Anything jobs up to [timeoutMs] (default 90s).
 */
export async function pollAdvancedJobUntilDone<T>(options: {
  readonly pollFn: () => Promise<
    Result<
      { readonly status: string; readonly stage?: string; readonly result?: T },
      LinguisticGatewayError
    >
  >;
  readonly timeoutMs?: number;
  readonly onStage?: (stage: string) => void;
  readonly isCancelled?: () => boolean;
}): Promise<AdvancedJobPollOutcome<T>> {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const startedAt = Date.now();
  let lastStage: string | undefined;

  while (Date.now() - startedAt < timeoutMs) {
    if (options.isCancelled?.()) {
      return { kind: 'cancelled' };
    }
    const res = await options.pollFn();
    if (!res.ok) {
      return { kind: 'error', error: res.error };
    }
    if (res.value.stage && res.value.stage !== lastStage) {
      lastStage = res.value.stage;
      options.onStage?.(res.value.stage);
    }
    if (res.value.status === 'completed' && res.value.result !== undefined) {
      return { kind: 'completed', result: res.value.result };
    }
    if (res.value.status === 'failed') {
      return { kind: 'failed', ...(lastStage ? { stage: lastStage } : {}) };
    }
    const elapsed = Date.now() - startedAt;
    const waitMs = Math.min(delayForElapsed(elapsed), Math.max(200, timeoutMs - elapsed));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, waitMs);
    });
  }

  return { kind: 'timeout', ...(lastStage ? { lastStage } : {}) };
}

/**
 * Continues polling a dropped-content extraction job if the user navigates away,
 * firing a ready toast once the study set finishes.
 */
export function watchDropJobInBackground(
  deps: Pick<AppDependencies, 'linguistic'>,
  jobId: string,
): void {
  if (typeof window === 'undefined' || activeDropTimers.has(jobId)) return;

  const startedAt = Date.now();
  const MAX_BG_MS = 120_000;

  const tick = async () => {
    const res = await deps.linguistic.pollAdvancedJob<DroppedContentItem>(jobId);
    if (!res.ok || res.value.status === 'failed') {
      activeDropTimers.delete(jobId);
      return;
    }
    if (res.value.status === 'completed' && res.value.result) {
      activeDropTimers.delete(jobId);
      latestReadyDrop = {
        jobId,
        dropId: res.value.result.dropId,
        title: res.value.result.title,
      };
      for (const listener of dropListeners) {
        listener(latestReadyDrop);
      }
      return;
    }
    const elapsed = Date.now() - startedAt;
    if (elapsed < MAX_BG_MS) {
      const nextTimer = window.setTimeout(() => void tick(), delayForElapsed(elapsed));
      activeDropTimers.set(jobId, nextTimer);
    } else {
      activeDropTimers.delete(jobId);
    }
  };

  const initialTimer = window.setTimeout(() => void tick(), 1_500);
  activeDropTimers.set(jobId, initialTimer);
}

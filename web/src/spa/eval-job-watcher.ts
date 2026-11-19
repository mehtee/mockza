import type { EvaluationOutputDto } from '@/gateways/storage.gateway';
import type { AppDependencies } from '@/spa/deps';

export interface ReadyBackgroundEvaluation {
  readonly jobId: string;
  readonly attemptId: string;
}

type ReadyListener = (ready: ReadyBackgroundEvaluation | null) => void;

const listeners = new Set<ReadyListener>();
let latestReady: ReadyBackgroundEvaluation | null = null;
const activeTimers = new Map<string, number>();

export function subscribeBackgroundEvaluationReady(listener: ReadyListener): () => void {
  listeners.add(listener);
  listener(latestReady);
  return () => {
    listeners.delete(listener);
  };
}

export function clearBackgroundEvaluationReady(): void {
  latestReady = null;
  for (const listener of listeners) {
    listener(null);
  }
}

export async function persistEvaluationJobCompletion(
  deps: Pick<AppDependencies, 'attemptStore' | 'clock'>,
  jobId: string,
  result: EvaluationOutputDto,
): Promise<void> {
  const nowMs = deps.clock.nowMs();
  const attemptRes = await deps.attemptStore.getAttemptById(result.attemptId);
  const existingAttempt = attemptRes.ok ? attemptRes.value : null;

  await deps.attemptStore.saveEvaluationResult({
    id: jobId,
    attemptId: result.attemptId,
    submissionId: jobId,
    examId: existingAttempt?.examId ?? 'ielts_academic',
    skill: existingAttempt?.skill ?? (result.transcriptSegments ? 'speaking' : 'writing'),
    overallBand: result.overallBand,
    resultJson: result,
    createdAtMs: nowMs,
  });

  if (existingAttempt) {
    await deps.attemptStore.saveAttemptRecord({
      ...existingAttempt,
      status: 'completed',
      syncStatus: 'synced',
      overallBand: result.overallBand,
      evaluationJson: JSON.stringify(result),
      updatedAtMs: nowMs,
    });
  }
}

/**
 * Continues polling an evaluation job after the user leaves `EvaluationPendingScreen`
 * via "Practice While Waiting", firing a toast notification when completed.
 */
export function watchEvaluationJobInBackground(
  deps: Pick<AppDependencies, 'evaluation' | 'attemptStore' | 'clock'>,
  jobId: string,
): void {
  if (typeof window === 'undefined' || activeTimers.has(jobId)) return;

  const startedAt = Date.now();
  const MAX_BG_POLL_MS = 120_000;

  const tick = async () => {
    const res = await deps.evaluation.pollEvaluationJob(jobId);
    if (!res.ok) {
      activeTimers.delete(jobId);
      return;
    }
    if (res.value.status === 'failed') {
      activeTimers.delete(jobId);
      return;
    }
    if (res.value.status === 'completed' && res.value.result) {
      await persistEvaluationJobCompletion(deps, jobId, res.value.result);
      activeTimers.delete(jobId);
      latestReady = { jobId, attemptId: res.value.result.attemptId };
      for (const listener of listeners) {
        listener(latestReady);
      }
      return;
    }
    if (Date.now() - startedAt < MAX_BG_POLL_MS) {
      const nextTimer = window.setTimeout(() => void tick(), 4000);
      activeTimers.set(jobId, nextTimer);
    } else {
      activeTimers.delete(jobId);
    }
  };

  const timer = window.setTimeout(() => void tick(), 2500);
  activeTimers.set(jobId, timer);
}

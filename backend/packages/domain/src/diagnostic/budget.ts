import type { DiagnosticMode } from './types.js';

/** Standard realistic rapid starting-level budget constants aligned with Flutter DiagnosticBudget. */
export const DIAGNOSTIC_BUDGET_SECONDS = {
  introMaxSeconds: 60,
  readingMaxSeconds: 210,
  listeningMaxSeconds: 210,
  writingMaxSeconds: 240,
  writingFollowUpMaxSeconds: 75,
  speakingPrepMaxSeconds: 35,
  speakingMainMaxSeconds: 60,
  speakingFollowUpMaxSeconds: 35,
  speakingMaxSeconds: 150,
  transitionMaxSeconds: 5,
  collectionTotalSeconds: 900,
  resultsWindowSeconds: 90,
  totalSessionSeconds: 990,
} as const;

/** Computes remaining whole seconds before `deadlineUtcMs`, clamped at zero. */
export function computeDiagnosticRemainingSeconds(params: {
  deadlineUtcMs: number;
  nowUtcMs?: number;
}): number {
  const nowMs = params.nowUtcMs ?? Date.now();
  const diffMs = params.deadlineUtcMs - nowMs;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / 1000);
}

/** Computes the bounded stage deadline (`min(now + stageCapSeconds, globalCollectionDeadlineUtcMs)`). */
export function computeBoundedStageDeadlineUtcMs(params: {
  stageCapSeconds: number;
  globalCollectionDeadlineUtcMs: number;
  mode: DiagnosticMode;
  nowUtcMs?: number;
}): number {
  const nowMs = params.nowUtcMs ?? Date.now();
  if (params.mode === 'extended') {
    return nowMs + params.stageCapSeconds * 3 * 1000;
  }
  const stageEnd = nowMs + params.stageCapSeconds * 1000;
  return Math.min(stageEnd, params.globalCollectionDeadlineUtcMs);
}

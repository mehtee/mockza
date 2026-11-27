import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MzBanner, MzButton, MzCard } from '@/components/ui';
import type { JobStatusResponse } from '@/gateways/evaluation.gateway';
import { createTranslator, type TranslationKey } from '@/i18n';
import { useDeps } from '@/spa/deps';
import {
  persistEvaluationJobCompletion,
  watchEvaluationJobInBackground,
} from '@/spa/eval-job-watcher';

export interface EvaluationPendingScreenProps {
  readonly jobId: string;
}

const ORDERED_STAGES: ReadonlyArray<{
  readonly key: 'queued' | 'processing_audio' | 'evaluating' | 'completed';
  readonly labelKey: TranslationKey;
}> = [
  { key: 'queued', labelKey: 'evalPendingStageQueued' },
  { key: 'processing_audio', labelKey: 'evalPendingStageProcessingAudio' },
  { key: 'evaluating', labelKey: 'evalPendingStageEvaluating' },
  { key: 'completed', labelKey: 'evalPendingStageCompleted' },
];

const MAX_ACTIVE_POLL_MS = 45_000;
const POLL_BACKOFF_SCHEDULE_MS = [1500, 3000, 6000] as const;

export function EvaluationPendingScreen({ jobId }: EvaluationPendingScreenProps) {
  const deps = useDeps();
  const t = useMemo(() => createTranslator(deps.edition), [deps.edition]);
  const navigate = useNavigate();

  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const nextDelayOverrideMsRef = useRef<number | null>(null);

  const pollOnce = useCallback(async () => {
    const res = await deps.evaluation.pollEvaluationJob(jobId);
    if (!res.ok) {
      if (res.error.kind === 'quota_exceeded') {
        nextDelayOverrideMsRef.current = Math.max(8000, (res.error.retryAfterSec ?? 8) * 1000);
        setErrorMsg(t('rateLimitFriendlyError'));
        return false;
      }
      setErrorMsg(res.error.message);
      return true;
    }

    nextDelayOverrideMsRef.current = null;
    setErrorMsg(null);
    setJob(res.value);

    if (res.value.status === 'failed') {
      setErrorMsg(
        res.value.quotaRefunded
          ? t('evalPendingRefundedNotice')
          : res.value.errorCode ?? t('evalPendingFailedFallback'),
      );
      return true;
    }

    if (res.value.status === 'completed' && res.value.result) {
      const output = res.value.result;
      await persistEvaluationJobCompletion(deps, jobId, output);

      await navigate({
        to: '/evaluation/result/$id',
        params: { id: output.attemptId },
      });
      return true;
    }

    return false;
  }, [deps, jobId, navigate, t]);

  useEffect(() => {
    let active = true;
    let timerId: number | null = null;
    const startedAt = Date.now();
    let attemptCount = 0;

    async function runLoop() {
      const done = await pollOnce();
      if (!active || done) return;

      if (Date.now() - startedAt >= MAX_ACTIVE_POLL_MS) {
        setPollTimedOut(true);
        watchEvaluationJobInBackground(deps, jobId);
        return;
      }

      const defaultDelayMs =
        POLL_BACKOFF_SCHEDULE_MS[
          Math.min(attemptCount, POLL_BACKOFF_SCHEDULE_MS.length - 1)
        ] ?? 6000;
      const delayMs = nextDelayOverrideMsRef.current ?? defaultDelayMs;
      nextDelayOverrideMsRef.current = null;
      attemptCount += 1;

      timerId = window.setTimeout(() => {
        void runLoop();
      }, delayMs);
    }

    void runLoop();
    return () => {
      active = false;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [deps, jobId, pollOnce]);

  const currentStatus = job?.status ?? 'queued';
  const activeStepIndex = ORDERED_STAGES.findIndex(
    (s) =>
      s.key === currentStatus ||
      (s.key === 'processing_audio' && currentStatus === 'transcoding') ||
      (s.key === 'evaluating' && currentStatus === 'repairing'),
  );

  return (
    <div data-testid="evaluation-pending-screen" className="mx-auto flex w-full max-w-6xl flex-col gap-5 py-8 text-start">
      <MzCard variant="hero">
        <div className="flex items-center gap-3">
          <Loader2
            className={currentStatus === 'failed' ? 'h-6 w-6 text-error' : 'h-6 w-6 animate-spin text-primary'}
            aria-hidden="true"
          />
          <div>
            <h1 className="text-xl font-bold text-text-primary">{t('evalPendingTitle')}</h1>
            <p className="mt-1 text-xs text-text-secondary">{t('evalPendingSubtitle')}</p>
          </div>
        </div>

        <ol className="mt-6 flex flex-col gap-3" data-testid="evaluation-pending-stepper">
          {ORDERED_STAGES.map((stage, idx) => {
            const isDone = activeStepIndex > idx || currentStatus === 'completed';
            const isCurrent = activeStepIndex === idx;
            return (
              <li
                key={stage.key}
                className="flex items-center gap-3 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas/70 px-3.5 py-2.5 text-xs"
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                ) : (
                  <Clock
                    className={isCurrent ? 'h-4 w-4 text-primary' : 'h-4 w-4 text-text-tertiary'}
                    aria-hidden="true"
                  />
                )}
                <span className={isCurrent ? 'font-bold text-primary' : 'font-medium text-text-primary'}>
                  {t(stage.labelKey)}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <MzButton
            variant="secondary"
            size="sm"
            data-testid="evaluation-manual-poll-btn"
            leadingIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={() => void pollOnce()}
          >
            {t('evalPendingRefreshStatus')}
          </MzButton>
          <Link
            to="/practice"
            data-testid="evaluation-pending-continue-link"
            onClick={() => watchEvaluationJobInBackground(deps, jobId)}
            className="inline-flex h-8 items-center rounded-[var(--mz-radius-compact)] bg-primary px-3 text-xs font-semibold text-on-primary hover:bg-primary-pressed"
          >
            {t('evalPendingContinueAction')}
          </Link>
        </div>
      </MzCard>

      {pollTimedOut ? (
        <MzBanner tone="warning" data-testid="evaluation-pending-timeout-banner">
          {t('evalPendingTimeoutWarning')}
        </MzBanner>
      ) : null}

      {errorMsg ? <MzBanner tone="danger">{errorMsg}</MzBanner> : null}
    </div>
  );
}

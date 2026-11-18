import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { MzBanner, MzButton, MzCard } from '@/components/ui';
import type { JobStatusResponse } from '@/gateways/evaluation.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';

export interface EvaluationPendingScreenProps {
  readonly jobId: string;
}

const ORDERED_STAGES = [
  { key: 'queued', label: 'Queued in grading pipeline' },
  { key: 'processing_audio', label: 'Normalizing media & transcript' },
  { key: 'evaluating', label: 'Scoring official rubric criteria' },
  { key: 'completed', label: 'Report ready' },
] as const;

export function EvaluationPendingScreen({ jobId }: EvaluationPendingScreenProps) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const navigate = useNavigate();

  const [job, setJob] = useState<JobStatusResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pollOnce = useCallback(async () => {
    const res = await deps.evaluation.pollEvaluationJob(jobId);
    if (!res.ok) {
      setErrorMsg(res.error.message);
      return true;
    }

    setJob(res.value);

    if (res.value.status === 'failed') {
      setErrorMsg(
        res.value.quotaRefunded
          ? t('evalPendingRefundedNotice')
          : res.value.errorCode ?? 'Evaluation failed.',
      );
      return true;
    }

    if (res.value.status === 'completed' && res.value.result) {
      const output = res.value.result;
      const nowMs = deps.clock.nowMs();
      const attemptRes = await deps.attemptStore.getAttemptById(output.attemptId);
      const existingAttempt = attemptRes.ok ? attemptRes.value : null;

      await deps.attemptStore.saveEvaluationResult({
        id: jobId,
        attemptId: output.attemptId,
        submissionId: jobId,
        examId: existingAttempt?.examId ?? 'ielts_academic',
        skill: existingAttempt?.skill ?? (output.transcriptSegments ? 'speaking' : 'writing'),
        overallBand: output.overallBand,
        resultJson: output,
        createdAtMs: nowMs,
      });

      if (existingAttempt) {
        await deps.attemptStore.saveAttemptRecord({
          ...existingAttempt,
          status: 'completed',
          syncStatus: 'synced',
          overallBand: output.overallBand,
          evaluationJson: JSON.stringify(output),
          updatedAtMs: nowMs,
        });
      }

      await navigate({
        to: '/evaluation/result/$id',
        params: { id: output.attemptId },
      });
      return true;
    }

    return false;
  }, [deps.attemptStore, deps.clock, deps.evaluation, jobId, navigate, t]);

  useEffect(() => {
    let active = true;
    let timerId: number | null = null;

    async function runLoop() {
      const done = await pollOnce();
      if (!active || done) return;
      timerId = window.setInterval(() => {
        void pollOnce().then((finished) => {
          if (finished && timerId !== null) {
            window.clearInterval(timerId);
            timerId = null;
          }
        });
      }, 1500);
    }

    void runLoop();
    return () => {
      active = false;
      if (timerId !== null) window.clearInterval(timerId);
    };
  }, [pollOnce]);

  const currentStatus = job?.status ?? 'queued';
  const activeStepIndex = ORDERED_STAGES.findIndex(
    (s) =>
      s.key === currentStatus ||
      (s.key === 'processing_audio' && currentStatus === 'transcoding') ||
      (s.key === 'evaluating' && currentStatus === 'repairing'),
  );

  return (
    <div data-testid="evaluation-pending-screen" className="mx-auto flex max-w-2xl flex-col gap-5 py-8 text-start">
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
                  {stage.label}
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
            Refresh Status
          </MzButton>
          <Link
            to="/practice"
            data-testid="evaluation-pending-continue-link"
            className="inline-flex h-8 items-center rounded-[var(--mz-radius-compact)] bg-primary px-3 text-xs font-semibold text-on-primary hover:bg-primary-strong"
          >
            {t('evalPendingContinueAction')}
          </Link>
        </div>
      </MzCard>

      {errorMsg ? <MzBanner tone="danger">{errorMsg}</MzBanner> : null}
    </div>
  );
}

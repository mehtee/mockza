import { formatExamScoreWithUnit } from '@mockza/domain';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, GitCompare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MzBanner, MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { formatDisplayDate } from '@/edition/calendar/jalali-edge';
import type { CompletedAttemptRecord, EvaluationOutputDto } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';

function parseCriteriaFromAttempt(
  attempt: CompletedAttemptRecord | undefined,
): EvaluationOutputDto['criteria'] {
  if (!attempt?.evaluationJson) return [];
  try {
    const parsed = JSON.parse(attempt.evaluationJson) as EvaluationOutputDto;
    return parsed.criteria ?? [];
  } catch {
    return [];
  }
}

interface TextMetricsSnapshot {
  readonly text: string;
  readonly wordCount: number;
  readonly wpm: number;
  readonly lexicalDiversityPercent: number;
}

function extractTextMetrics(attempt: CompletedAttemptRecord | undefined): TextMetricsSnapshot | null {
  if (!attempt) return null;
  let text = '';
  try {
    const parsed = JSON.parse(attempt.submissionJson) as {
      essayText?: unknown;
      turns?: readonly { promptText?: unknown }[];
    };
    if (typeof parsed.essayText === 'string') {
      text = parsed.essayText.trim();
    }
  } catch {
    // ignore malformed json
  }
  if (!text && attempt.evaluationJson) {
    try {
      const ev = JSON.parse(attempt.evaluationJson) as EvaluationOutputDto;
      const transcriptText = ev.transcriptSegments?.map((s) => s.text).join(' ').trim();
      if (transcriptText) text = transcriptText;
    } catch {
      // ignore
    }
  }
  if (!text) return null;
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9'-]/gi, ''))
    .filter(Boolean);
  if (words.length === 0) return null;
  const uniqueCount = new Set(words).size;
  const minutes = Math.max(1 / 6, attempt.durationSeconds / 60);
  return {
    text,
    wordCount: words.length,
    wpm: Math.round(words.length / minutes),
    lexicalDiversityPercent: Math.round((uniqueCount / words.length) * 100),
  };
}

function buildTokenDiff(baseText: string, nextText: string): readonly { readonly word: string; readonly kind: 'same' | 'added' }[] {
  const baseWords = new Set(
    baseText
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean),
  );
  return nextText
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({
      word,
      kind: baseWords.has(word.toLowerCase()) ? 'same' : 'added',
    }));
}

export function CompareAttemptsScreen() {
  const deps = useDeps();
  const t = createTranslator(deps.edition);

  const BackIcon = deps.edition === 'irn' ? ArrowRight : ArrowLeft;
  const [attempts, setAttempts] = useState<readonly CompletedAttemptRecord[]>([]);
  const [attemptAId, setAttemptAId] = useState<string>('');
  const [attemptBId, setAttemptBId] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    void deps.attemptStore.listCompletedAttempts().then((res) => {
      if (!mounted || !res.ok) return;
      const scored = res.value
        .filter((a) => typeof a.overallBand === 'number' && a.status === 'completed')
        .sort((a, b) => b.completedAtMs - a.completedAtMs);
      setAttempts(scored);
      if (scored.length >= 2) {
        setAttemptBId(scored[0]!.attemptId);
        setAttemptAId(scored[1]!.attemptId);
      } else if (scored.length === 1) {
        setAttemptAId(scored[0]!.attemptId);
        setAttemptBId(scored[0]!.attemptId);
      }
    });
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore]);

  const attemptA = attempts.find((a) => a.attemptId === attemptAId);
  const attemptB = attempts.find((a) => a.attemptId === attemptBId);

  const delta =
    attemptA && attemptB && attemptA.overallBand !== null && attemptB.overallBand !== null
      ? Number((attemptB.overallBand - attemptA.overallBand).toFixed(2))
      : null;

  const criteriaA = parseCriteriaFromAttempt(attemptA);
  const criteriaB = parseCriteriaFromAttempt(attemptB);
  const metricsA = extractTextMetrics(attemptA);
  const metricsB = extractTextMetrics(attemptB);
  const diffTokens = metricsA && metricsB ? buildTokenDiff(metricsA.text, metricsB.text) : [];

  return (
    <div data-testid="compare-attempts-screen" className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-12 text-start">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('comparePageTitle')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('comparePageSubtitle')}</p>
        </div>

        <Link
          to="/progress"
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--mz-radius-control)] border border-border-subtle bg-bg-raised px-3 text-xs font-semibold text-text-primary hover:bg-surface-hover"
        >
          <BackIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{t('navProgress')}</span>
        </Link>
      </div>

      {attempts.length < 2 ? (
        <MzCard variant="default" data-testid="compare-empty-state">
          <div className="flex flex-col items-start gap-3">
            <div className="flex items-center gap-2 text-primary">
              <GitCompare className="h-5 w-5" aria-hidden="true" />
              <h2 className="text-base font-bold text-text-primary">
                {deps.edition === 'irn'
                  ? 'حداقل دو آزمون نمره‌دار برای مقایسه لازم است'
                  : 'Complete at least two scored attempts to compare'}
              </h2>
            </div>
            <p className="text-sm text-text-secondary">{t('compareNeedTwoAttempts')}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                to="/practice"
                data-testid="compare-start-practice-cta"
                className="inline-flex min-h-10 items-center rounded-[var(--mz-radius-control)] bg-primary px-4 text-xs font-semibold text-on-primary hover:bg-primary-pressed"
              >
                {t('navPractice')}
              </Link>
              <Link
                to="/progress"
                className="inline-flex min-h-10 items-center rounded-[var(--mz-radius-control)] border border-border-subtle bg-canvas px-4 text-xs font-semibold text-text-primary hover:bg-surface-hover"
              >
                {t('navProgress')}
              </Link>
            </div>
          </div>
        </MzCard>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <MzCard variant="default">
              <label
                htmlFor="compare-select-a"
                className="block text-xs font-semibold text-text-secondary"
              >
                {t('compareAttemptALabel')}
              </label>
              <select
                id="compare-select-a"
                data-testid="compare-select-a"
                value={attemptAId}
                onChange={(e) => setAttemptAId(e.target.value)}
                className="mt-2 h-9 w-full rounded-[var(--mz-radius-control)] border border-border-subtle bg-canvas px-3 text-xs text-text-primary"
              >
                {attempts.map((a) => (
                  <option key={a.attemptId} value={a.attemptId}>
                    {`${a.skill.toUpperCase()} · ${formatExamScoreWithUnit(a.overallBand ?? 0, a.examId)} · ${formatDisplayDate(a.completedAtMs, deps.edition)}`}
                  </option>
                ))}
              </select>
              {attemptA ? (
                <div className="mt-3 text-xs text-text-secondary">
                  <LtrExamBoundary>
                    <p className="font-mono-exam text-xl font-bold text-text-primary">
                      {formatExamScoreWithUnit(attemptA.overallBand ?? 0, attemptA.examId)}
                    </p>
                  </LtrExamBoundary>
                  <p className="mt-1">
                    {t('compareDurationLabel')}: {attemptA.durationSeconds}s
                  </p>
                </div>
              ) : null}
            </MzCard>

            <MzCard variant="raised">
              <label
                htmlFor="compare-select-b"
                className="block text-xs font-semibold text-text-secondary"
              >
                {t('compareAttemptBLabel')}
              </label>
              <select
                id="compare-select-b"
                data-testid="compare-select-b"
                value={attemptBId}
                onChange={(e) => setAttemptBId(e.target.value)}
                className="mt-2 h-9 w-full rounded-[var(--mz-radius-control)] border border-border-subtle bg-canvas px-3 text-xs text-text-primary"
              >
                {attempts.map((a) => (
                  <option key={a.attemptId} value={a.attemptId}>
                    {`${a.skill.toUpperCase()} · ${formatExamScoreWithUnit(a.overallBand ?? 0, a.examId)} · ${formatDisplayDate(a.completedAtMs, deps.edition)}`}
                  </option>
                ))}
              </select>
              {attemptB ? (
                <div className="mt-3 text-xs text-text-secondary">
                  <LtrExamBoundary>
                    <p className="font-mono-exam text-xl font-bold text-primary">
                      {formatExamScoreWithUnit(attemptB.overallBand ?? 0, attemptB.examId)}
                    </p>
                  </LtrExamBoundary>
                  <p className="mt-1">
                    {t('compareDurationLabel')}: {attemptB.durationSeconds}s
                  </p>
                </div>
              ) : null}
            </MzCard>
          </div>

          {delta !== null ? (
            <MzCard variant="hero" data-testid="compare-delta-card">
              <div className="flex items-center gap-3">
                <GitCompare className="h-5 w-5 text-primary" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold text-text-secondary">
                    {t('compareDeltaLabel')}
                  </p>
                  <LtrExamBoundary>
                    <p
                      data-testid="compare-delta-value"
                      className={[
                        'font-mono-exam text-2xl font-bold',
                        delta >= 0 ? 'text-success' : 'text-error',
                      ].join(' ')}
                    >
                      {delta >= 0 ? `+${delta}` : String(delta)}
                    </p>
                  </LtrExamBoundary>
                </div>
              </div>
            </MzCard>
          ) : null}

          {criteriaA.length > 0 && criteriaB.length > 0 ? (
            <MzCard variant="default" data-testid="compare-criteria-table">
              <h2 className="mb-3 text-sm font-bold text-text-primary">
                {t('compareCriteriaHeading')}
              </h2>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {criteriaB.map((cb) => {
                  const ca = criteriaA.find((c) => c.code === cb.code);
                  const diff = ca ? Number((cb.band - ca.band).toFixed(2)) : 0;
                  return (
                    <div
                      key={cb.code}
                      className="flex items-center justify-between rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-3 py-2 text-xs"
                    >
                      <span className="font-semibold text-text-primary">{cb.label}</span>
                      <LtrExamBoundary>
                        <span className="font-mono-exam font-bold text-text-primary">
                          {ca ? `${ca.band} → ${cb.band}` : cb.band}{' '}
                          <span className={diff >= 0 ? 'text-success' : 'text-error'}>
                            ({diff >= 0 ? `+${diff}` : diff})
                          </span>
                        </span>
                      </LtrExamBoundary>
                    </div>
                  );
                })}
              </div>
            </MzCard>
          ) : null}
          {metricsA && metricsB ? (
            <MzCard variant="default" data-testid="compare-lexical-metrics">
              <h2 className="mb-3 text-sm font-bold text-text-primary">
                {t('compareLexicalMetricsHeading')}
              </h2>
              <LtrExamBoundary>
                <div className="grid gap-3 font-mono-exam text-xs sm:grid-cols-3">
                  <div className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas p-3">
                    <p className="text-text-secondary">Words</p>
                    <p className="mt-1 font-bold text-text-primary">
                      {metricsA.wordCount} → {metricsB.wordCount} (
                      {metricsB.wordCount - metricsA.wordCount >= 0 ? '+' : ''}
                      {metricsB.wordCount - metricsA.wordCount})
                    </p>
                  </div>
                  <div className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas p-3">
                    <p className="text-text-secondary">WPM</p>
                    <p className="mt-1 font-bold text-text-primary">
                      {metricsA.wpm} → {metricsB.wpm} (
                      {metricsB.wpm - metricsA.wpm >= 0 ? '+' : ''}
                      {metricsB.wpm - metricsA.wpm})
                    </p>
                  </div>
                  <div className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas p-3">
                    <p className="text-text-secondary">Lexical Diversity</p>
                    <p className="mt-1 font-bold text-text-primary">
                      {metricsA.lexicalDiversityPercent}% → {metricsB.lexicalDiversityPercent}%
                    </p>
                  </div>
                </div>
              </LtrExamBoundary>

              <div className="mt-4" data-testid="compare-diff-panel">
                <h3 className="mb-2 text-xs font-bold text-text-secondary">
                  {t('compareDiffHeading')}
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <LtrExamBoundary>
                    <p className="whitespace-pre-wrap rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs leading-relaxed text-text-secondary">
                      {metricsA.text}
                    </p>
                  </LtrExamBoundary>
                  <LtrExamBoundary>
                    <p className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs leading-relaxed text-text-primary">
                      {diffTokens.map((tok, idx) => (
                        <span
                          key={`${tok.word}-${idx}`}
                          className={
                            tok.kind === 'added'
                              ? 'me-1 inline rounded bg-mint-bg px-1 font-semibold text-success'
                              : 'me-1'
                          }
                        >
                          {tok.word}
                        </span>
                      ))}
                    </p>
                  </LtrExamBoundary>
                </div>
              </div>
            </MzCard>
          ) : null}
        </>
      )}
    </div>
  );
}

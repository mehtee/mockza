import {
  calculateCurrentStreak,
  calculateEstimatedOverallBand,
  calculateSkillMetrics,
  EXAM_TRACK_SPECS,
  formatExamScoreWithUnit,
  type SkillKind,
  type SupportedExamId,
} from '@mockza/domain';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight, Flame, GitCompare, Target, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { formatDisplayDate } from '@/edition/calendar/jalali-edge';
import type { CompletedAttemptRecord, DailyStudyLogRecord } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';

function attemptDetailPath(attempt: CompletedAttemptRecord): string {
  if (attempt.skill === 'writing' || attempt.skill === 'speaking') {
    return `/evaluation/result/${attempt.attemptId}`;
  }
  return `/practice/objective-result/${attempt.attemptId}`;
}

export function ProgressScreen() {
  const deps = useDeps();
  const t = createTranslator(deps.edition);

  const [examId, setExamId] = useState<SupportedExamId>('ielts_academic');
  const [targetBand, setTargetBand] = useState<number>(7.5);
  const [attempts, setAttempts] = useState<readonly CompletedAttemptRecord[]>([]);
  const [studyLogs, setStudyLogs] = useState<readonly DailyStudyLogRecord[]>([]);

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const [profileRes, logsRes] = await Promise.all([
        deps.attemptStore.getUserProfile(),
        deps.attemptStore.listRecentDailyStudyLogs(30),
      ]);
      if (!mounted) return;
      const activeExam = profileRes.ok && profileRes.value ? profileRes.value.examId : 'ielts_academic';
      setExamId(activeExam);
      if (profileRes.ok && profileRes.value) {
        setTargetBand(profileRes.value.targetBand);
      }
      if (logsRes.ok) {
        setStudyLogs(logsRes.value);
      }

      const attemptsRes = await deps.attemptStore.listCompletedAttempts({
        examId: activeExam,
      });
      if (!mounted) return;
      if (attemptsRes.ok) {
        setAttempts(attemptsRes.value);
      }
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore]);

  const scoredAttempts = useMemo(
    () =>
      attempts
        .filter((a) => typeof a.overallBand === 'number' && a.status === 'completed')
        .map((a) => ({
          attempt: a,
          score: a.overallBand as number,
          skill: a.skill,
          completedAtUtcMs: a.completedAtMs,
        }))
        .sort((a, b) => a.completedAtUtcMs - b.completedAtUtcMs),
    [attempts],
  );

  const overallSummary = useMemo(
    () =>
      calculateEstimatedOverallBand({
        scoredAttempts,
        track: examId,
        targetBand,
        currentUtcMs: deps.clock.nowMs(),
      }),
    [deps.clock, examId, scoredAttempts, targetBand],
  );

  const skillMetrics = useMemo(
    () =>
      calculateSkillMetrics({
        attempts: scoredAttempts.map((s) => ({ skill: s.skill, score: s.score })),
        track: examId,
      }),
    [examId, scoredAttempts],
  );

  const weakestMetric = useMemo(() => {
    const withScores = skillMetrics.filter((m) => m.score !== null);
    if (withScores.length === 0) return null;
    return withScores.reduce((min, cur) =>
      cur.normalizedPosition < min.normalizedPosition ? cur : min,
    );
  }, [skillMetrics]);

  const streakDays = useMemo(
    () =>
      calculateCurrentStreak({
        studyDays: studyLogs.map((l) => l.serialDay),
        today: deps.clock.todaySerialDay(),
      }),
    [deps.clock, studyLogs],
  );

  const trackSpec = EXAM_TRACK_SPECS[examId];
  const readinessGap =
    overallSummary.overallBand !== null
      ? Math.max(0, Number((targetBand - overallSummary.overallBand).toFixed(2)))
      : null;

  // Compute responsive SVG TrendChart points
  const chartPoints = useMemo(() => {
    if (scoredAttempts.length === 0) return [];
    const width = 620;
    const height = 160;
    const padX = 28;
    const padY = 20;
    const spanScore = Math.max(1, trackSpec.maxScore - trackSpec.minScore);

    return scoredAttempts.map((item, idx) => {
      const x =
        scoredAttempts.length === 1
          ? width / 2
          : padX + (idx / (scoredAttempts.length - 1)) * (width - padX * 2);
      const norm = (item.score - trackSpec.minScore) / spanScore;
      const y = height - padY - norm * (height - padY * 2);
      return { x: Math.round(x), y: Math.round(y), score: item.score, skill: item.skill };
    });
  }, [scoredAttempts, trackSpec.maxScore, trackSpec.minScore]);

  const targetLineY = useMemo(() => {
    const height = 160;
    const padY = 20;
    const spanScore = Math.max(1, trackSpec.maxScore - trackSpec.minScore);
    const norm = Math.max(0, Math.min(1, (targetBand - trackSpec.minScore) / spanScore));
    return Math.round(height - padY - norm * (height - padY * 2));
  }, [targetBand, trackSpec.maxScore, trackSpec.minScore]);

  const skillLabel = (skill: SkillKind) => {
    switch (skill) {
      case 'reading':
        return t('homeSkillReading');
      case 'listening':
        return t('homeSkillListening');
      case 'writing':
        return t('homeSkillWriting');
      case 'speaking':
        return t('homeSkillSpeaking');
      default:
        return skill;
    }
  };

  return (
    <div data-testid="progress-screen" className="mx-auto flex max-w-6xl flex-col gap-5 pb-12 text-start">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-primary">{trackSpec.displayName}</p>
          <h1 className="text-2xl font-bold text-text-primary">{t('progressPageTitle')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('progressPageSubtitle')}</p>
        </div>

        <Link
          to="/progress/compare"
          data-testid="progress-compare-cta"
          className="inline-flex h-10 items-center gap-2 rounded-[var(--mz-radius-control)] border border-border-subtle bg-bg-raised px-4 text-xs font-semibold text-text-primary hover:bg-surface-hover"
        >
          <GitCompare className="h-4 w-4 text-primary" aria-hidden="true" />
          <span>{t('progressCompareCta')}</span>
        </Link>
      </div>

      {/* Hero KPI Row */}
      <div className="grid gap-4 md:grid-cols-3">
        <MzCard variant="hero">
          <p className="text-xs font-semibold text-text-secondary">{trackSpec.displayName}</p>
          <LtrExamBoundary>
            <p data-testid="progress-overall-score" className="mt-2 font-mono-exam text-3xl font-bold text-primary">
              {overallSummary.overallBand !== null
                ? formatExamScoreWithUnit(overallSummary.overallBand, examId)
                : '—'}
            </p>
          </LtrExamBoundary>
          <p className="mt-2 text-xs text-text-secondary">
            {readinessGap === null
              ? overallSummary.scaleLabel
              : readinessGap === 0
                ? t('progressTargetReachedBadge')
                : t('progressReadinessGapLabel', { gap: readinessGap })}
          </p>
        </MzCard>

        <MzCard variant="default">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
            <Target className="h-4 w-4 text-focus" aria-hidden="true" />
            <span>Target</span>
          </div>
          <LtrExamBoundary>
            <p className="mt-2 font-mono-exam text-2xl font-bold text-text-primary">
              {formatExamScoreWithUnit(targetBand, examId)}
            </p>
          </LtrExamBoundary>
          {overallSummary.changeThisMonth !== null ? (
            <p className="mt-2 text-xs font-semibold text-success">
              {t('progressMonthlyDeltaLabel', {
                delta: `${overallSummary.changeThisMonth >= 0 ? '+' : ''}${overallSummary.changeThisMonth}`,
              })}
            </p>
          ) : null}
        </MzCard>

        <MzCard variant="default">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary">
            <Flame className="h-4 w-4 text-warning" aria-hidden="true" />
            <span>Streak & Samples</span>
          </div>
          <p className="mt-2 font-mono-exam text-2xl font-bold text-text-primary">
            {t('homeStudyStreakLabel', { days: streakDays })}
          </p>
          <p className="mt-2 text-xs text-text-secondary">
            {t('homeSamplesCountLabel', { count: scoredAttempts.length })}
          </p>
        </MzCard>
      </div>

      {/* SVG TrendChart */}
      <MzCard variant="default" data-testid="progress-trend-chart-card">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-bold text-text-primary">
            {t('progressTrendChartTitle', { count: scoredAttempts.length })}
          </h2>
        </div>

        {scoredAttempts.length === 0 ? (
          <p className="py-8 text-center text-xs text-text-secondary">
            {t('progressNoAttemptsEmpty')}
          </p>
        ) : (
          <LtrExamBoundary>
            <svg
              data-testid="progress-trend-chart"
              viewBox="0 0 620 160"
              role="img"
              aria-label="Exam score trajectory"
              className="h-44 w-full overflow-visible rounded-[var(--mz-radius-compact)] bg-canvas p-2"
            >
              {/* Target benchmark dashed line */}
              <line
                x1="28"
                y1={targetLineY}
                x2="592"
                y2={targetLineY}
                stroke="currentColor"
                strokeDasharray="4 4"
                className="text-focus/60"
              />
              {chartPoints.length > 1 ? (
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-primary"
                  points={chartPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                />
              ) : null}
              {chartPoints.map((pt, idx) => (
                <circle
                  key={`${pt.x}-${pt.y}-${idx}`}
                  cx={pt.x}
                  cy={pt.y}
                  r="4.5"
                  fill="currentColor"
                  className="text-primary"
                >
                  <title>{`${pt.skill}: ${pt.score}`}</title>
                </circle>
              ))}
            </svg>
          </LtrExamBoundary>
        )}
      </MzCard>

      {/* 4-Skill Breakdown & Weakness Priority */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {skillMetrics.map((metric) => {
          const isWeakest = weakestMetric?.skill === metric.skill;
          return (
            <MzCard
              key={metric.skill}
              variant={isWeakest ? 'raised' : 'default'}
              data-testid={`progress-skill-card-${metric.skill}`}
            >
              <p className="text-xs font-semibold text-text-secondary">
                {skillLabel(metric.skill)}
              </p>
              <LtrExamBoundary>
                <p className="mt-1.5 font-mono-exam text-xl font-bold text-text-primary">
                  {metric.score !== null ? metric.scoreLabel : '—'}
                </p>
              </LtrExamBoundary>
              <p className="mt-1 text-[11px] text-text-tertiary">
                {t('homeSamplesCountLabel', { count: metric.sampleCount })}
              </p>
            </MzCard>
          );
        })}
      </div>

      {weakestMetric ? (
        <MzCard variant="alt" data-testid="progress-weakest-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-primary">
                {t('progressWeakestSkillTitle', { skill: skillLabel(weakestMetric.skill) })}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {t('progressWeakestSkillHint')}
              </p>
            </div>
            <Link
              to="/practice/drills"
              className="inline-flex h-9 items-center rounded-[var(--mz-radius-control)] bg-primary px-4 text-xs font-semibold text-on-primary hover:bg-primary-pressed"
            >
              {t('homeQuickDrillsCta')}
            </Link>
          </div>
        </MzCard>
      ) : null}

      {/* Edition-specific verified admission partner handoff card (IRN only) */}
      {deps.edition === 'irn' && import.meta.env.PUBLIC_EDITION !== 'glb' ? (
        <MzCard variant="hero" data-testid="ecosystem-handoff-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-text-primary">
                {t('ecosystemHandoffTitle')}
              </h2>
              <p className="mt-1 text-xs text-text-secondary">
                {t('ecosystemHandoffSubtitle')}
              </p>
            </div>
            <a
              href={t('ecosystemHandoffUrl')}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="ecosystem-handoff-link"
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--mz-radius-control)] bg-primary px-4 text-xs font-semibold text-on-primary hover:bg-primary-pressed"
            >
              <span>{t('ecosystemEligibilityCta')}</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </MzCard>
      ) : null}

      {/* Recent Attempts Table */}
      {scoredAttempts.length > 0 ? (
        <MzCard variant="default">
          <h2 className="mb-3 text-sm font-bold text-text-primary">
            {t('progressRecentAttemptsTitle')}
          </h2>
          <div className="flex flex-col gap-2">
            {[...scoredAttempts].reverse().map(({ attempt, score }) => (
              <Link
                key={attempt.attemptId}
                to={attemptDetailPath(attempt)}
                data-testid={`progress-attempt-row-${attempt.attemptId}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-3.5 py-2.5 text-xs hover:bg-surface-hover"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-primary capitalize">{attempt.skill}</span>
                  <span className="text-text-secondary">
                    {formatDisplayDate(attempt.completedAtMs, deps.edition)}
                  </span>
                </div>
                <LtrExamBoundary>
                  <span className="font-mono-exam font-bold text-text-primary">
                    {formatExamScoreWithUnit(score, attempt.examId)}
                  </span>
                </LtrExamBoundary>
              </Link>
            ))}
          </div>
        </MzCard>
      ) : null}
    </div>
  );
}

import {
  formatExamScore,
  type SkillKind,
  SUPPORTED_EXAM_IDS,
  type SupportedExamId,
  utcMidnightMsFromSerialDay,
} from '@mockza/domain';
import { Link } from '@tanstack/react-router';
import {
  BookOpen,
  Calendar,
  Flame,
  Headphones,
  Layers,
  Mic,
  PenTool,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { formatDisplayDate } from '@/edition/calendar/jalali-edge';
import { getActiveEditionConfig } from '@/edition/edition-config';
import { createTranslator, type TranslationKey } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { useHomeController } from './useHomeController';

const TRACK_I18N_KEYS: Record<SupportedExamId, TranslationKey> = {
  ielts_academic: 'trackIeltsAcademic',
  ielts_general: 'trackIeltsGeneral',
  toefl_ibt: 'trackToeflIbt',
  pte_academic: 'trackPteAcademic',
  det: 'trackDet',
};

function getSkillMeta(
  skill: SkillKind,
  t: (key: TranslationKey) => string,
  descriptor: ReturnType<typeof useHomeController>['descriptor'],
) {
  switch (skill) {
    case 'speaking':
      return {
        label: t('homeSkillSpeaking'),
        Icon: Mic,
        to: '/practice/speaking/$packId' as const,
        packId: descriptor.speakingPackId,
      };
    case 'writing':
      return {
        label: t('homeSkillWriting'),
        Icon: PenTool,
        to: '/practice/writing/$packId' as const,
        packId: descriptor.writingPackId,
      };
    case 'reading':
      return {
        label: t('homeSkillReading'),
        Icon: BookOpen,
        to: '/practice/reading/$packId' as const,
        packId: descriptor.readingPackId,
      };
    case 'listening':
    case 'vocabulary':
      return {
        label: t('homeSkillListening'),
        Icon: Headphones,
        to: '/practice/listening/$packId' as const,
        packId: descriptor.listeningPackId,
      };
  }
}

export function HomeScreen() {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const editionConfig = getActiveEditionConfig();
  const ctrl = useHomeController();

  const {
    activeTrack,
    resumableDraft,
    trackSpec,
    descriptor,
    targetScore,
    targetDateSerial,
    estimatedSummary,
    skillMetrics,
    streakDays,
    studyWeek,
    dueCards,
    latestDiagnostic,
    detSubscores,
    toeflLegacy120,
  } = ctrl;

  const formattedTargetDate =
    targetDateSerial !== null
      ? formatDisplayDate(utcMidnightMsFromSerialDay(targetDateSerial), deps.edition)
      : null;

  const monthlyDeltaText =
    estimatedSummary.changeThisMonth !== null
      ? `${estimatedSummary.changeThisMonth >= 0 ? '+' : ''}${
          trackSpec.usesIntegerDisplay
            ? Math.round(estimatedSummary.changeThisMonth)
            : estimatedSummary.changeThisMonth.toFixed(1)
        }`
      : null;

  const resumeSkill = resumableDraft
    ? getSkillMeta(resumableDraft.skill, t, descriptor)
    : null;

  return (
    <div data-testid="home-screen" className="mx-auto flex max-w-6xl flex-col gap-6 pb-10 text-start">
      {/* Top Workspace Header + Instant 5-Track Switcher */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {editionConfig.brandName}
          </p>
          <h1 className="font-editorial mt-0.5 text-4xl text-text-primary">{t('homeStudyRoom')}</h1>
          <p className="mt-0.5 text-sm text-text-secondary">{t('homeStudyRoomDescription')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {formattedTargetDate ? (
            <span
              data-testid="home-target-date-badge"
              className="inline-flex items-center gap-1.5 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-surface-alt px-3 py-1 text-xs font-semibold text-text-secondary"
            >
              <Calendar className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {t('progressTargetDateLabel', { date: formattedTargetDate })}
            </span>
          ) : null}
        </div>
      </header>

      {/* Clear 2-Pillar Quick Switcher: Mock Exams vs Smart Coach */}
      <div
        data-testid="home-two-pillars"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <Link
          to="/practice"
          search={{ track: activeTrack }}
          className={`flex items-center justify-between rounded-[var(--mz-radius-compact)] border px-4 py-3 text-start transition-colors ${
            ctrl.studyFocus === 'exams'
              ? 'border-primary bg-surface-alt'
              : 'border-border-subtle bg-bg-surface hover:bg-surface-hover'
          }`}
        >
          <div>
            <p className="text-xs font-semibold text-primary">{t('navPractice')}</p>
            <p className="mt-0.5 text-[11px] text-text-secondary">
              {deps.edition === 'irn'
                ? 'آزمون‌های شبیه‌ساز زمان‌دار و تخمین دقیق نمره'
                : 'Timed simulations, section drills & accurate band estimates'}
            </p>
          </div>
          <span className="text-xs font-semibold text-primary">→</span>
        </Link>
        <Link
          to="/coach"
          data-testid="home-coach-hub-cta"
          className={`flex items-center justify-between rounded-[var(--mz-radius-compact)] border px-4 py-3 text-start transition-colors ${
            ctrl.studyFocus === 'coach'
              ? 'border-primary bg-surface-alt'
              : 'border-border-subtle bg-bg-surface hover:bg-surface-hover'
          }`}
        >
          <div>
            <p className="text-xs font-semibold text-primary">{t('navSmartCoach')}</p>
            <p className="mt-0.5 text-[11px] text-text-secondary">
              {t('smartCoachSubtitle')}
            </p>
          </div>
          <span className="text-xs font-semibold text-primary">→</span>
        </Link>
      </div>

      {ctrl.studyFocus === 'coach' ? (
        <>
          <MzCard variant="hero" data-testid="home-daily-mission-card">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('homeDailyMissionTitle')}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {deps.edition === 'irn'
                    ? 'یک تمرین ۱۰ دقیقه‌ای اختصاصی با ترکیب نقاط ضعف، واژگان امروز و موضوعات مورد علاقه شما'
                    : 'One 10-minute custom exercise mixing your weak spots, due words, and favorite topics.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/mission/$missionId"
                  params={{ missionId: 'today' }}
                  data-testid="home-daily-mission-cta"
                  className="inline-flex h-9 items-center rounded-[var(--mz-radius-compact)] bg-primary px-3.5 text-xs font-semibold text-on-primary"
                >
                  {t('homeDailyMissionStartCta')}
                </Link>
                <Link
                  to="/register-shifter"
                  data-testid="home-register-shifter-cta"
                  className="inline-flex h-9 items-center rounded-[var(--mz-radius-compact)] border border-border-strong px-3 text-xs font-semibold text-primary hover:bg-surface-hover"
                >
                  {t('homeRegisterShifterCta')}
                </Link>
                <Link
                  to="/drop"
                  data-testid="home-drop-anything-cta"
                  className="inline-flex h-9 items-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 text-xs font-semibold text-text-primary hover:bg-surface-hover"
                >
                  {t('homeDropAnythingCta')}
                </Link>
              </div>
            </div>
          </MzCard>

          <MzCard variant="default" data-testid="home-recommended-card">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 className="font-editorial text-3xl text-text-primary">
                  {resumeSkill?.label ?? latestDiagnostic?.recommendedFirstAction.title ?? t('homeRecommendedNextTitle')}
                </h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {resumeSkill ? t('homeResumeDescription') : latestDiagnostic?.recommendedFirstAction.description ?? descriptor.formatHint}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              {resumableDraft && resumeSkill ? (
                <Link
                  to={resumeSkill.to}
                  params={{ packId: resumableDraft.packId }}
                  className="inline-flex h-11 items-center rounded-[var(--mz-radius-compact)] bg-primary px-4 text-sm font-semibold text-on-primary"
                >
                  {t('homeResumeAttempt')}
                </Link>
              ) : !latestDiagnostic ? (
                <Link
                  to="/diagnostic/intro"
                  data-testid="home-diagnostic-cta"
                  search={{ track: activeTrack }}
                  className="inline-flex h-11 items-center rounded-[var(--mz-radius-compact)] bg-primary px-4 text-sm font-semibold text-on-primary"
                >
                  {t('homeStartDiagnosticCta')}
                </Link>
              ) : null}
              <Link to="/practice" search={{ track: activeTrack }} className="inline-flex h-11 items-center rounded-[var(--mz-radius-compact)] border border-border-strong px-4 text-sm font-semibold text-primary">
                {t('navPractice')}
              </Link>
              <Link
                to="/practice/drills"
                data-testid="home-drills-cta"
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--mz-radius-compact)] bg-surface-alt border border-primary/40 px-3.5 text-xs font-semibold text-primary hover:bg-surface-hover"
              >
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('homeQuickDrillsCta')}</span>
              </Link>
              <Link
                to="/practice/full-mock"
                data-testid="home-full-mock-cta"
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3.5 text-xs font-semibold text-text-primary hover:bg-surface-hover"
              >
                <span>{t('homeQuickFullMockCta')}</span>
              </Link>
            </div>
          </MzCard>
        </>
      ) : (
        <>
          <MzCard variant="hero" data-testid="home-recommended-card">
            <div className="flex items-start gap-2.5">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <h2 className="font-editorial text-3xl text-text-primary">
                  {resumeSkill?.label ?? latestDiagnostic?.recommendedFirstAction.title ?? t('homeRecommendedNextTitle')}
                </h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {resumeSkill ? t('homeResumeDescription') : latestDiagnostic?.recommendedFirstAction.description ?? descriptor.formatHint}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              {resumableDraft && resumeSkill ? (
                <Link
                  to={resumeSkill.to}
                  params={{ packId: resumableDraft.packId }}
                  className="inline-flex h-11 items-center rounded-[var(--mz-radius-compact)] bg-primary px-4 text-sm font-semibold text-on-primary"
                >
                  {t('homeResumeAttempt')}
                </Link>
              ) : !latestDiagnostic ? (
                <Link
                  to="/diagnostic/intro"
                  data-testid="home-diagnostic-cta"
                  search={{ track: activeTrack }}
                  className="inline-flex h-11 items-center rounded-[var(--mz-radius-compact)] bg-primary px-4 text-sm font-semibold text-on-primary"
                >
                  {t('homeStartDiagnosticCta')}
                </Link>
              ) : null}
              <Link to="/practice" search={{ track: activeTrack }} className="inline-flex h-11 items-center rounded-[var(--mz-radius-compact)] border border-border-strong px-4 text-sm font-semibold text-primary">
                {t('navPractice')}
              </Link>
              <Link
                to="/practice/drills"
                data-testid="home-drills-cta"
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--mz-radius-compact)] bg-surface-alt border border-primary/40 px-3.5 text-xs font-semibold text-primary hover:bg-surface-hover"
              >
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t('homeQuickDrillsCta')}</span>
              </Link>
              <Link
                to="/practice/full-mock"
                data-testid="home-full-mock-cta"
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3.5 text-xs font-semibold text-text-primary hover:bg-surface-hover"
              >
                <span>{t('homeQuickFullMockCta')}</span>
              </Link>
            </div>
          </MzCard>

          <MzCard variant="default" data-testid="home-daily-mission-card">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                  {t('homeDailyMissionTitle')}
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  {deps.edition === 'irn'
                    ? 'یک تمرین ۱۰ دقیقه‌ای اختصاصی با ترکیب نقاط ضعف، واژگان امروز و موضوعات مورد علاقه شما'
                    : 'One 10-minute custom exercise mixing your weak spots, due words, and favorite topics.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/mission/$missionId"
                  params={{ missionId: 'today' }}
                  data-testid="home-daily-mission-cta"
                  className="inline-flex h-9 items-center rounded-[var(--mz-radius-compact)] bg-primary px-3.5 text-xs font-semibold text-on-primary"
                >
                  {t('homeDailyMissionStartCta')}
                </Link>
                <Link
                  to="/register-shifter"
                  data-testid="home-register-shifter-cta"
                  className="inline-flex h-9 items-center rounded-[var(--mz-radius-compact)] border border-border-strong px-3 text-xs font-semibold text-primary hover:bg-surface-hover"
                >
                  {t('homeRegisterShifterCta')}
                </Link>
                <Link
                  to="/drop"
                  data-testid="home-drop-anything-cta"
                  className="inline-flex h-9 items-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 text-xs font-semibold text-text-primary hover:bg-surface-hover"
                >
                  {t('homeDropAnythingCta')}
                </Link>
              </div>
            </div>
          </MzCard>
        </>
      )}

      {/* Instant Track Switcher Strip */}
      <div
        role="radiogroup"
        aria-label={t('settingsExamTrackSection')}
        className="flex flex-wrap items-center gap-2"
      >
        {SUPPORTED_EXAM_IDS.map((trackId) => {
          const selected = activeTrack === trackId;
          return (
            <button
              key={trackId}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`home-track-${trackId}`}
              onClick={() => void ctrl.switchTrack(trackId)}
              className={[
                'rounded-[var(--mz-radius-pill)] border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                selected
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-border-subtle bg-bg-raised text-text-secondary hover:bg-surface-hover hover:text-text-primary',
              ].join(' ')}
            >
              {t(TRACK_I18N_KEYS[trackId])}
            </button>
          );
        })}
      </div>

      {/* Bento Grid Row 1: Readiness Hero (7) + Streak & Study Week (5) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <MzCard variant="hero" className="lg:col-span-7" data-testid="home-readiness-hero">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                {t('homeReadinessHeroTitle')} · {trackSpec.displayName}
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <LtrExamBoundary>
                  <span
                    data-testid="home-overall-score"
                    className="font-mono-exam text-4xl font-bold text-primary"
                  >
                    {estimatedSummary.overallBand !== null
                      ? formatExamScore(estimatedSummary.overallBand, activeTrack)
                      : '—'}
                  </span>
                </LtrExamBoundary>
                <span className="inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-canvas/70 px-2.5 py-0.5 text-xs font-semibold text-text-primary">
                  <Target className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  <span data-testid="home-target-score-pill">
                    {t('homeTargetBadge', {
                      score: formatExamScore(targetScore, activeTrack),
                    })}
                  </span>
                </span>
                {monthlyDeltaText ? (
                  <span className="inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] bg-mint-bg px-2.5 py-0.5 text-xs font-semibold text-success">
                    <TrendingUp className="h-3 w-3" aria-hidden="true" />
                    {t('homeMonthlyDeltaLabel', { delta: monthlyDeltaText })}
                  </span>
                ) : null}
              </div>

              {estimatedSummary.overallBand === null ? (
                <p className="mt-2 text-xs text-text-secondary">{t('homeUnestimatedLabel')}</p>
              ) : null}

              {/* Track-Specific Concordance Badges (TOEFL /120, DET 4 subscores) */}
              {toeflLegacy120 !== null ? (
                <div className="mt-3">
                  <span
                    data-testid="home-toefl-concordance"
                    className="inline-flex items-center rounded-[var(--mz-radius-pill)] border border-focus/40 bg-blue-bg px-2.5 py-0.5 font-mono-exam text-xs font-semibold text-focus"
                  >
                    ~{toeflLegacy120} / 120 TOEFL Concordance
                  </span>
                </div>
              ) : null}

              {detSubscores.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2" data-testid="home-det-subscores">
                  {detSubscores.map((sub) => (
                    <span
                      key={sub.label}
                      className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas/75 px-2.5 py-1 text-xs font-semibold text-text-primary"
                    >
                      {sub.label}: <span className="font-mono-exam text-primary">{sub.score}</span>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>

            {estimatedSummary.diagnosticRecommended && (resumableDraft || latestDiagnostic) ? (
              <Link
                to="/diagnostic/intro"
                data-testid="home-diagnostic-cta"
                search={{ track: activeTrack }}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--mz-radius-compact)] bg-primary px-4 text-xs font-semibold text-on-primary transition-colors hover:bg-primary-pressed"
              >
                <Rocket className="h-4 w-4" aria-hidden="true" />
                <span>{t('homeTakeDiagnosticCta')}</span>
              </Link>
            ) : null}
          </div>

          <div className="mt-5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-canvas/80">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(100, Math.round(estimatedSummary.progressToTarget * 100))}%`,
                }}
              />
            </div>
          </div>
        </MzCard>

        <MzCard variant="default" className="lg:col-span-5" data-testid="home-study-week-card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-text-primary">{t('homeStudyWeekTitle')}</h2>
            <span
              data-testid="home-streak-badge"
              className="inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] bg-amber-bg px-2.5 py-0.5 text-xs font-semibold text-warning"
            >
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              {t('homeStudyStreakLabel', { days: streakDays })}
            </span>
          </div>

          <LtrExamBoundary>
            <div className="mt-4 grid grid-cols-7 gap-2">
              {studyWeek.days.map((day) => (
                <div
                  key={day.daySerial}
                  className={[
                    'flex flex-col items-center justify-center rounded-[var(--mz-radius-compact)] border py-2.5 text-xs font-semibold',
                    day.isCompleted
                      ? 'border-success/55 bg-mint-bg text-success'
                      : day.isToday
                        ? 'border-primary bg-surface-alt text-primary'
                        : 'border-border-subtle bg-bg-raised text-text-tertiary',
                  ].join(' ')}
                >
                  <span>{day.dayLabel}</span>
                </div>
              ))}
            </div>
          </LtrExamBoundary>

          <p className="mt-3 text-xs text-text-secondary">{studyWeek.summaryLabel}</p>
        </MzCard>
      </div>

      {/* Row 2: 4-Skill Calibration Cards */}
      <section aria-label={t('homeFourSkillsTitle')}>
        <h2 className="mb-3 text-base font-semibold text-text-primary">
          {t('homeFourSkillsTitle')}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {skillMetrics.map((metric) => {
            const meta = getSkillMeta(metric.skill, t, descriptor);
            const Icon = meta.Icon;
            return (
              <MzCard
                key={metric.skill}
                variant="default"
                data-testid={`home-skill-card-${metric.skill}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                    {meta.label}
                  </span>
                  <LtrExamBoundary>
                    <span className="font-mono-exam text-xl font-bold text-primary">
                      {metric.scoreLabel}
                    </span>
                  </LtrExamBoundary>
                </div>

                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.round(metric.normalizedPosition * 100)}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-text-secondary">
                    {t('homeSamplesCountLabel', { count: metric.sampleCount })}
                  </span>
                  <Link
                    to={meta.to}
                    params={{ packId: meta.packId }}
                    className="font-semibold text-primary hover:underline"
                  >
                    {t('homePracticeSkillAction')}
                  </Link>
                </div>
              </MzCard>
            );
          })}
        </div>
      </section>

      {/* Due vocabulary */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <MzCard variant="default" className="lg:col-span-12" data-testid="home-due-vocab-card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  {t('homeDueVocabTitle')}
                </h2>
                <p className="text-xs text-text-secondary">
                  {dueCards.length > 0
                    ? t('homeDueVocabCount', { count: dueCards.length })
                    : t('homeDueVocabAllCaughtUp')}
                </p>
              </div>
            </div>
            <Link
              to="/vocabulary"
              className="text-xs font-semibold text-text-secondary hover:text-text-primary hover:underline"
            >
              {t('homeBrowseVocabAction')}
            </Link>
          </div>

          {dueCards.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-2">
              {dueCards.slice(0, 3).map((item) => (
                <li
                  key={item.card.cardId}
                  className="flex items-center justify-between gap-3 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 py-2 text-xs"
                >
                  <LtrExamBoundary>
                    <span className="font-semibold text-text-primary">{item.card.headword}</span>
                  </LtrExamBoundary>
                  <span className="truncate text-text-secondary">
                    {deps.edition === 'irn' && item.card.glossFa
                      ? item.card.glossFa
                      : item.card.definition}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4">
            <Link
              to="/vocabulary/review"
              data-testid="home-vocab-review-cta"
              className="inline-flex h-9 items-center justify-center rounded-[var(--mz-radius-compact)] bg-primary px-4 text-xs font-semibold text-on-primary transition-colors hover:bg-primary-pressed"
            >
              {t('homeStartReviewCta')}
            </Link>
          </div>
        </MzCard>
      </div>
    </div>
  );
}

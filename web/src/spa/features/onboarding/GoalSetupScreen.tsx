import { estimateToeflLegacy120, formatExamScore } from '@mockza/domain';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  Calendar,
  Minus,
  Plus,
  Rocket,
  Target,
} from 'lucide-react';
import { MzBanner, MzButton, MzCard, resolveOfficialCefrTier } from '@/components/ui';
import { BackArrowIcon } from '@/components/bidi/DirectionIcon';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { formatChromeNumber } from '@/edition/bidi/numerals';
import {
  formatTargetScoreHeading,
  formatTrackLocalizedName,
} from '@/components/bidi/topic-labels';
import { formatDisplayDate } from '@/edition/calendar/jalali-edge';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { utcMidnightMsFromSerialDay } from '@mockza/domain';
import { STARTER_INTEREST_TOPICS, useOnboardingController } from './useOnboardingController';

export function GoalSetupScreen() {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const navigate = useNavigate();
  const ctrl = useOnboardingController();

  const resolveCefrSummary = () => {
    const tier = resolveOfficialCefrTier(ctrl.targetScore, ctrl.selectedTrack);
    const tierKey =
      tier === 'C2'
        ? 'onboardingCefrC2'
        : tier === 'C1'
          ? 'onboardingCefrC1'
          : tier === 'B2'
            ? 'onboardingCefrB2'
            : tier === 'B1'
              ? 'onboardingCefrB1'
              : tier === 'A2'
                ? 'onboardingCefrA2'
                : 'onboardingCefrA1';
    const base = t(tierKey);

    if (ctrl.selectedTrack === 'toefl_ibt') {
      return `${base} · ~${formatChromeNumber(estimateToeflLegacy120(ctrl.targetScore), deps.edition)}/${formatChromeNumber(120, deps.edition)}`;
    }
    return base;
  };

  const formattedDate =
    ctrl.targetDateSerial !== null
      ? formatDisplayDate(utcMidnightMsFromSerialDay(ctrl.targetDateSerial), deps.edition)
      : null;

  const finishAndNavigate = async (destination: '/diagnostic/intro' | '/home' | '/mission/$missionId') => {
    const saved = await ctrl.saveProfile(true);
    if (!saved) return;
    if (destination === '/mission/$missionId') {
      await navigate({ to: '/mission/$missionId', params: { missionId: 'today' } });
      return;
    }
    await navigate({ to: destination });
  };

  const isIrn = deps.edition === 'irn';
  const targetScoreHeading = formatTargetScoreHeading(ctrl.trackSpec, deps.edition);

  return (
    <div data-testid="goal-setup-screen" className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10 text-start">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/welcome"
          data-testid="goal-back-welcome-link"
          className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
        >
          <BackArrowIcon edition={deps.edition} className="h-4 w-4" />
          <span>{t('onboardingBackToTrackAction')}</span>
        </Link>

        <span className="rounded-[var(--mz-radius-pill)] border border-primary/40 bg-surface-alt px-3 py-1 text-xs font-semibold text-primary">
          {formatTrackLocalizedName(ctrl.selectedTrack, deps.edition)}
        </span>
      </div>

      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t('onboardingStepBadge', {
            current: formatChromeNumber(2, deps.edition),
            total: formatChromeNumber(2, deps.edition),
          })}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary">{t('onboardingGoalHeadline')}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t('onboardingGoalSubtitle')}</p>
      </header>

      {/* Step 1 on Goal Setup: Prominent Screening (Mock Exams vs Smart Coach vs Both) */}
      <MzCard variant="hero" data-testid="goal-study-focus-card">
        <p className="text-sm font-semibold text-text-primary">
          {t('learningFocusHeadline')}
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          {t('learningFocusSubtitle')}
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
          {(
            [
              {
                key: 'both',
                title: t('learningFocusBothTitle'),
                subtitle: t('learningFocusBothDesc'),
              },
              {
                key: 'exams',
                title: t('learningFocusExamsTitle'),
                subtitle: t('learningFocusExamsDesc'),
              },
              {
                key: 'coach',
                title: t('learningFocusCoachTitle'),
                subtitle: t('learningFocusCoachDesc'),
              },
            ] as const
          ).map((option) => {
            const selected = ctrl.studyFocus === option.key;
            return (
              <button
                key={option.key}
                type="button"
                data-testid={`goal-focus-${option.key}`}
                aria-pressed={selected}
                onClick={() => ctrl.selectStudyFocus(option.key)}
                className={`rounded-[var(--mz-radius-compact)] border p-3 text-start transition-colors ${
                  selected
                    ? 'border-primary bg-canvas text-text-primary shadow-sm'
                    : 'border-border-subtle bg-bg-raised text-text-secondary hover:bg-surface-hover'
                }`}
              >
                <p className="text-xs font-semibold text-text-primary">
                  {option.title}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                  {option.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </MzCard>

      {/* 1-Tap Personal Interest Topics for Smart Coach */}
      <MzCard variant="default" data-testid="goal-interest-topics-card">
        <p className="text-sm font-semibold text-text-primary">
          {isIrn
            ? 'چه موضوعاتی برای تمرین‌های روزانه شما جذاب‌تر است؟ (اختیاری)'
            : 'Pick topics you actually enjoy talking about (optional)'}
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          {isIrn
            ? 'تمرین‌های کوتاه ۱۰ دقیقه‌ای شما بر اساس همین علایق شخصی‌سازی می‌شوند.'
            : "Your 10-minute Smart Coach prompts will use these topics instead of dry textbooks."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STARTER_INTEREST_TOPICS.map((topic) => {
            const active = ctrl.selectedTopics.includes(topic.key);
            const slug = topic.key.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            return (
              <button
                key={topic.key}
                type="button"
                data-testid={`goal-topic-chip-${slug}`}
                aria-pressed={active}
                onClick={() => ctrl.toggleTopic(topic.key)}
                className={`inline-flex min-h-11 items-center rounded-[var(--mz-radius-pill)] border px-3.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border-subtle bg-bg-raised text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                {isIrn ? topic.labelFa : topic.labelEn}
              </button>
            );
          })}
        </div>
      </MzCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Target Score Stepper + Slider */}
        <MzCard variant="hero" className="lg:col-span-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-text-secondary">
              {targetScoreHeading}
            </h2>
            <Target className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>

          <div className="my-5 flex flex-col items-center gap-2">
            <LtrExamBoundary>
              <span
                data-testid="goal-target-readout"
                className="font-mono-exam text-5xl font-bold text-primary"
              >
                {formatExamScore(ctrl.targetScore, ctrl.selectedTrack)}
              </span>
            </LtrExamBoundary>
            <span
              data-testid="goal-cefr-badge"
              className="rounded-[var(--mz-radius-pill)] border border-primary/40 bg-canvas/70 px-3 py-1 text-xs font-semibold text-text-primary"
            >
              {resolveCefrSummary()}
            </span>
          </div>

          <LtrExamBoundary className="flex items-center gap-3">
            <MzButton
              variant="secondary"
              size="sm"
              data-testid="goal-target-dec"
              disabled={ctrl.targetScore <= ctrl.trackSpec.minScore}
              onClick={() => ctrl.stepTargetScore(-1)}
              aria-label="Decrease target score"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </MzButton>

            <div className="flex-1">
              <input
                type="range"
                data-testid="goal-target-slider"
                aria-label={targetScoreHeading}
                min={ctrl.trackSpec.minScore}
                max={ctrl.trackSpec.maxScore}
                step={ctrl.trackSpec.scoreStep}
                value={ctrl.targetScore}
                onChange={(event) => ctrl.updateTargetScore(Number(event.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <MzButton
              variant="secondary"
              size="sm"
              data-testid="goal-target-inc"
              disabled={ctrl.targetScore >= ctrl.trackSpec.maxScore}
              onClick={() => ctrl.stepTargetScore(1)}
              aria-label="Increase target score"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </MzButton>
          </LtrExamBoundary>
        </MzCard>

        {/* Edition-Specific Exam Date Picker (Gregorian GLB vs Jalali IRN) */}
        <MzCard variant="default" className="lg:col-span-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-text-primary">
              {t('onboardingExamDateLabel')}
            </h2>
            <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[14, 30, 60, 90].map((days) => (
              <button
                key={days}
                type="button"
                data-testid={`goal-date-preset-${days}`}
                onClick={() => ctrl.setExamDateDaysFromNow(days)}
                className="inline-flex min-h-11 items-center rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-3.5 text-xs font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              >
                {t('onboardingPresetDays', {
                  days: formatChromeNumber(days, deps.edition),
                })}
              </button>
            ))}
            <button
              type="button"
              data-testid="goal-date-clear"
              onClick={() => ctrl.setExamDateDaysFromNow(null)}
              className="inline-flex min-h-11 items-center rounded-[var(--mz-radius-pill)] border border-border-subtle bg-canvas px-3.5 text-xs text-text-secondary hover:bg-surface-hover"
            >
              {t('onboardingClearDateAction')}
            </button>
          </div>

          <div className="mt-4">
            {deps.edition === 'irn' && import.meta.env.PUBLIC_EDITION !== 'glb' ? (
              <LtrExamBoundary>
                <div className="grid grid-cols-3 gap-2" data-testid="goal-jalali-inputs">
                  <label className="flex flex-col gap-1 text-center text-[11px] font-medium text-text-secondary">
                    <span dir="rtl">سال</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      data-testid="goal-jalali-year"
                      placeholder="1405"
                      value={ctrl.jalaliDraft.jy}
                      onChange={(e) => ctrl.handleJalaliFieldChange({ jy: e.target.value })}
                      className="h-11 w-full rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 text-center font-mono-exam text-sm text-text-primary focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-center text-[11px] font-medium text-text-secondary">
                    <span dir="rtl">ماه</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      data-testid="goal-jalali-month"
                      placeholder="08"
                      value={ctrl.jalaliDraft.jm}
                      onChange={(e) => ctrl.handleJalaliFieldChange({ jm: e.target.value })}
                      className="h-11 w-full rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 text-center font-mono-exam text-sm text-text-primary focus:border-primary focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-center text-[11px] font-medium text-text-secondary">
                    <span dir="rtl">روز</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      data-testid="goal-jalali-day"
                      placeholder="27"
                      value={ctrl.jalaliDraft.jd}
                      onChange={(e) => ctrl.handleJalaliFieldChange({ jd: e.target.value })}
                      className="h-11 w-full rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 text-center font-mono-exam text-sm text-text-primary focus:border-primary focus:outline-none"
                    />
                  </label>
                </div>
              </LtrExamBoundary>
            ) : (
              <LtrExamBoundary>
                <input
                  type="date"
                  data-testid="goal-gregorian-date"
                  aria-label={t('onboardingExamDateLabel')}
                  value={ctrl.gregorianInput}
                  onChange={(e) => ctrl.handleGregorianDateChange(e.target.value)}
                  className="h-11 w-full rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 font-mono-exam text-sm text-text-primary focus:border-primary focus:outline-none"
                />
              </LtrExamBoundary>
            )}
          </div>

          {ctrl.dateError ? (
            <div className="mt-3">
              <MzBanner tone="danger">{t('onboardingInvalidDateError')}</MzBanner>
            </div>
          ) : formattedDate ? (
            <p
              data-testid="goal-formatted-date"
              className="mt-3 text-xs font-medium text-success"
            >
              {t('progressTargetDateLabel', { date: formattedDate })}
            </p>
          ) : null}
        </MzCard>
      </div>

      {/* Primary Launch into Coach / Starting-Level Check OR Straight to Home */}
      <MzCard variant="default" className="sticky bottom-0 z-10 sm:static">
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <MzButton
            variant="ghost"
            size="md"
            className="w-full sm:w-auto"
            data-testid="goal-skip-home-btn"
            disabled={ctrl.isSaving || ctrl.dateError}
            onClick={() => void finishAndNavigate('/home')}
          >
            {t('onboardingSkipToHomeAction')}
          </MzButton>

          <MzButton
            variant="primary"
            size="lg"
            className="w-full sm:w-auto"
            data-testid="goal-start-diagnostic-btn"
            isLoading={ctrl.isSaving}
            disabled={ctrl.dateError}
            leadingIcon={<Rocket className="h-4 w-4" aria-hidden="true" />}
            onClick={() =>
              void finishAndNavigate(
                ctrl.studyFocus === 'coach' ? '/mission/$missionId' : '/diagnostic/intro',
              )
            }
          >
            {ctrl.studyFocus === 'coach'
              ? isIrn
                ? 'شروع مربی ۱۰ دقیقه‌ای امروز'
                : "Start Today's 10-Min Coach"
              : t('onboardingStartDiagnosticAction')}
          </MzButton>
        </div>
      </MzCard>
    </div>
  );
}

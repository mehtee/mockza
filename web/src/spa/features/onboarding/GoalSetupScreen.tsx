import { estimateToeflLegacy120, formatExamScore } from '@mockza/domain';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Minus,
  Plus,
  Rocket,
  Target,
} from 'lucide-react';
import { MzBanner, MzButton, MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { formatDisplayDate } from '@/edition/calendar/jalali-edge';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { utcMidnightMsFromSerialDay } from '@mockza/domain';
import { useOnboardingController } from './useOnboardingController';

export function GoalSetupScreen() {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const navigate = useNavigate();
  const ctrl = useOnboardingController();

  const BackIcon = deps.edition === 'irn' ? ArrowRight : ArrowLeft;

  const resolveCefrSummary = () => {
    const ratio = ctrl.qualityRatio;
    const base =
      ratio >= 0.82
        ? t('onboardingCefrC2')
        : ratio >= 0.65
          ? t('onboardingCefrC1')
          : ratio >= 0.45
            ? t('onboardingCefrB2')
            : t('onboardingCefrB1');

    if (ctrl.selectedTrack === 'toefl_ibt') {
      return `${base} · ~${estimateToeflLegacy120(ctrl.targetScore)}/120`;
    }
    return base;
  };

  const formattedDate =
    ctrl.targetDateSerial !== null
      ? formatDisplayDate(utcMidnightMsFromSerialDay(ctrl.targetDateSerial), deps.edition)
      : null;

  const finishAndNavigate = async (destination: '/diagnostic/intro' | '/home') => {
    const saved = await ctrl.saveProfile(true);
    if (!saved) return;
    await navigate({ to: destination });
  };

  return (
    <div data-testid="goal-setup-screen" className="mx-auto flex max-w-4xl flex-col gap-6 pb-10 text-start">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/welcome"
          data-testid="goal-back-welcome-link"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
        >
          <BackIcon className="h-4 w-4" aria-hidden="true" />
          <span>{t('onboardingBackToTrackAction')}</span>
        </Link>

        <span className="rounded-[var(--mz-radius-pill)] border border-primary/40 bg-surface-alt px-3 py-1 text-xs font-semibold text-primary">
          {ctrl.trackSpec.displayName}
        </span>
      </div>

      <header>
        <h1 className="text-2xl font-bold text-text-primary">{t('onboardingGoalHeadline')}</h1>
        <p className="mt-1 text-sm text-text-secondary">{t('onboardingGoalSubtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Target Score Stepper + Slider */}
        <MzCard variant="hero" className="lg:col-span-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-text-secondary">
              {t('settingsTargetScoreLabel', { unit: ctrl.trackSpec.unitLabel })}
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

          <div className="flex items-center gap-3">
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

            <LtrExamBoundary className="flex-1">
              <input
                type="range"
                data-testid="goal-target-slider"
                aria-label={t('settingsTargetScoreLabel', { unit: ctrl.trackSpec.unitLabel })}
                min={ctrl.trackSpec.minScore}
                max={ctrl.trackSpec.maxScore}
                step={ctrl.trackSpec.scoreStep}
                value={ctrl.targetScore}
                onChange={(event) => ctrl.updateTargetScore(Number(event.target.value))}
                className="w-full accent-primary"
              />
            </LtrExamBoundary>

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
          </div>
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
                className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              >
                {t('onboardingPresetDays', { days })}
              </button>
            ))}
            <button
              type="button"
              data-testid="goal-date-clear"
              onClick={() => ctrl.setExamDateDaysFromNow(null)}
              className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-canvas px-3 py-1 text-xs text-text-secondary hover:bg-surface-hover"
            >
              {t('onboardingClearDateAction')}
            </button>
          </div>

          <div className="mt-4">
            {deps.edition === 'irn' && import.meta.env.PUBLIC_EDITION !== 'glb' ? (
              <LtrExamBoundary>
                <div className="grid grid-cols-3 gap-2" data-testid="goal-jalali-inputs">
                  <input
                    type="text"
                    inputMode="numeric"
                    data-testid="goal-jalali-year"
                    placeholder="1405"
                    value={ctrl.jalaliDraft.jy}
                    onChange={(e) => ctrl.handleJalaliFieldChange({ jy: e.target.value })}
                    className="h-10 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 text-center font-mono-exam text-sm text-text-primary focus:border-primary focus:outline-none"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    data-testid="goal-jalali-month"
                    placeholder="08"
                    value={ctrl.jalaliDraft.jm}
                    onChange={(e) => ctrl.handleJalaliFieldChange({ jm: e.target.value })}
                    className="h-10 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 text-center font-mono-exam text-sm text-text-primary focus:border-primary focus:outline-none"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    data-testid="goal-jalali-day"
                    placeholder="27"
                    value={ctrl.jalaliDraft.jd}
                    onChange={(e) => ctrl.handleJalaliFieldChange({ jd: e.target.value })}
                    className="h-10 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 text-center font-mono-exam text-sm text-text-primary focus:border-primary focus:outline-none"
                  />
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
                  className="h-10 w-full rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3 font-mono-exam text-sm text-text-primary focus:border-primary focus:outline-none"
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

      {/* Primary Launch into Rapid Starting-Level Check OR Straight to Home */}
      <MzCard variant="default">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MzButton
            variant="ghost"
            size="md"
            data-testid="goal-skip-home-btn"
            disabled={ctrl.isSaving || ctrl.dateError}
            onClick={() => void finishAndNavigate('/home')}
          >
            {t('onboardingSkipToHomeAction')}
          </MzButton>

          <MzButton
            variant="primary"
            size="lg"
            data-testid="goal-start-diagnostic-btn"
            isLoading={ctrl.isSaving}
            disabled={ctrl.dateError}
            leadingIcon={<Rocket className="h-4 w-4" aria-hidden="true" />}
            onClick={() => void finishAndNavigate('/diagnostic/intro')}
          >
            {t('onboardingStartDiagnosticAction')}
          </MzButton>
        </div>
      </MzCard>
    </div>
  );
}

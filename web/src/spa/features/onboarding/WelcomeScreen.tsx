import {
  EXAM_DESCRIPTORS,
  EXAM_TRACK_SPECS,
  formatExamScore,
  SUPPORTED_EXAM_IDS,
  type SupportedExamId,
} from '@mockza/domain';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Compass, Info } from 'lucide-react';
import { MzButton, MzCard } from '@/components/ui';
import { getActiveEditionConfig } from '@/edition/edition-config';
import { createTranslator, type TranslationKey } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { useOnboardingController } from './useOnboardingController';

const TRACK_I18N_KEYS: Record<SupportedExamId, TranslationKey> = {
  ielts_academic: 'trackIeltsAcademic',
  ielts_general: 'trackIeltsGeneral',
  toefl_ibt: 'trackToeflIbt',
  pte_academic: 'trackPteAcademic',
  det: 'trackDet',
};

export function WelcomeScreen() {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const navigate = useNavigate();
  const editionConfig = getActiveEditionConfig();
  const ctrl = useOnboardingController();

  const ForwardIcon = deps.edition === 'irn' ? ArrowLeft : ArrowRight;

  const handleContinue = async () => {
    await ctrl.saveProfile(false);
    await navigate({ to: '/onboarding/goal' });
  };

  return (
    <div data-testid="welcome-screen" className="mx-auto flex max-w-6xl flex-col gap-6 pb-10 text-start">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: 5 Exam Track Cards */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Compass className="h-3.5 w-3.5" aria-hidden="true" />
              {editionConfig.brandName}
            </p>
            <h1 className="mt-1 text-3xl font-bold text-text-primary">
              {t('onboardingWelcomeHeadline')}
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              {t('onboardingWelcomeSubtitle')}
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label={t('onboardingWelcomeHeadline')}
            className="flex flex-col gap-2.5"
          >
            {SUPPORTED_EXAM_IDS.map((trackId) => {
              const selected = ctrl.selectedTrack === trackId;
              const descriptor = EXAM_DESCRIPTORS[trackId];
              return (
                <button
                  key={trackId}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`welcome-track-${trackId}`}
                  onClick={() => ctrl.selectTrack(trackId)}
                  className={[
                    'flex items-center justify-between gap-4 rounded-[var(--mz-radius-card)] border p-4 text-start transition-colors',
                    selected
                      ? 'border-2 border-primary bg-surface-alt'
                      : 'border-border-subtle bg-surface hover:bg-surface-hover',
                  ].join(' ')}
                >
                  <div className="min-w-0">
                    <p className="text-base font-bold text-text-primary">
                      {t(TRACK_I18N_KEYS[trackId])}
                    </p>
                    <p className="mt-0.5 text-xs text-text-secondary">{descriptor.subtitle}</p>
                  </div>
                  {selected ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-text-tertiary" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Track Preview + Continue + Sign In */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          <MzCard variant="hero">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {t(TRACK_I18N_KEYS[ctrl.selectedTrack])}
            </p>
            <h2 className="mt-1 text-lg font-bold text-text-primary">
              {EXAM_TRACK_SPECS[ctrl.selectedTrack].displayName}
            </h2>

            <dl className="mt-4 flex flex-col gap-3 border-t border-border-subtle pt-4 text-xs">
              <div>
                <dt className="font-semibold text-text-secondary">{t('onboardingFormatLabel')}</dt>
                <dd className="mt-0.5 text-text-primary">{ctrl.trackDescriptor.formatHint}</dd>
              </div>
              <div>
                <dt className="font-semibold text-text-secondary">{t('onboardingScaleLabel')}</dt>
                <dd className="mt-0.5 font-mono-exam text-sm font-bold text-primary">
                  {formatExamScore(ctrl.trackSpec.minScore, ctrl.selectedTrack)} –{' '}
                  {formatExamScore(ctrl.trackSpec.maxScore, ctrl.selectedTrack)} (
                  {ctrl.trackSpec.unitLabel})
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-col gap-2.5">
              <MzButton
                variant="primary"
                size="lg"
                className="w-full"
                data-testid="welcome-continue-btn"
                isLoading={ctrl.isSaving}
                onClick={() => void handleContinue()}
              >
                <span>{t('onboardingContinueToGoalAction')}</span>
                <ForwardIcon className="h-4 w-4" aria-hidden="true" />
              </MzButton>

              <Link
                to="/auth/login"
                search={{ returnTo: '/app/home' }}
                data-testid="welcome-signin-link"
                className="inline-flex h-10 items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-4 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                {t('onboardingHaveAccountAction')}
              </Link>
            </div>
          </MzCard>

          <MzCard variant="alt">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-text-secondary">
                {t('settingsDisclaimerBody')}
              </p>
            </div>
          </MzCard>
        </div>
      </div>
    </div>
  );
}

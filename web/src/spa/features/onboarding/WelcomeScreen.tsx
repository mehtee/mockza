import { Link, useNavigate } from '@tanstack/react-router';
import { Check, Compass } from 'lucide-react';
import { ForwardArrowIcon } from '@/components/bidi/DirectionIcon';
import {
  ExamTrackSelector,
  MzButton,
  MzCard,
  TRACK_TITLE_KEYS,
} from '@/components/ui';
import { getActiveEditionConfig } from '@/edition/edition-config';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { useOnboardingController } from './useOnboardingController';

export function WelcomeScreen() {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const navigate = useNavigate();
  const editionConfig = getActiveEditionConfig();
  const ctrl = useOnboardingController();

  const handleContinue = async () => {
    await ctrl.saveProfile(false);
    await navigate({ to: '/onboarding/goal' });
  };

  return (
    <div data-testid="welcome-screen" className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10 text-start">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Track Options */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Compass className="h-3.5 w-3.5" aria-hidden="true" />
              {editionConfig.brandName} · {t('onboardingStepBadge', { current: 1, total: 2 })}
            </p>
            <h1 className="mt-1.5 text-2xl font-bold text-text-primary sm:text-3xl">
              {t('onboardingWelcomeHeadline')}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {t('onboardingWelcomeSubtitle')}
            </p>
          </div>

          <ExamTrackSelector
            value={ctrl.selectedTrack}
            onChange={ctrl.selectTrack}
            edition={deps.edition}
            ariaLabel={t('onboardingWelcomeHeadline')}
            testIdPrefix="welcome-track"
            columns={1}
          />
        </div>

        {/* Focused Continue Card */}
        <div className="flex flex-col gap-3 lg:col-span-5 lg:mt-14">
          <MzCard variant="hero">
            <div className="inline-flex items-center gap-2 rounded-[var(--mz-radius-pill)] border border-primary/30 bg-surface px-3 py-1 text-xs font-bold text-primary">
              {t(TRACK_TITLE_KEYS[ctrl.selectedTrack])}
            </div>

            <ul className="mt-4 flex flex-col gap-2.5 text-xs text-text-secondary sm:text-sm">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{t('onboardingNextTargetHint')}</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{t('onboardingChangeAnytimeHint')}</span>
              </li>
            </ul>

            <div className="sticky bottom-0 z-10 -mx-4 mt-5 flex flex-col gap-2.5 border-t border-border-subtle bg-bg-canvas/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0">
              <MzButton
                variant="primary"
                size="lg"
                className="w-full"
                data-testid="welcome-continue-btn"
                isLoading={ctrl.isSaving}
                trailingIcon={<ForwardArrowIcon edition={deps.edition} className="h-4 w-4" />}
                onClick={() => void handleContinue()}
              >
                {t('onboardingContinueToGoalAction')}
              </MzButton>

              <Link
                to="/auth/login"
                search={{ returnTo: '/app/home' }}
                data-testid="welcome-signin-link"
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-4 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                {t('onboardingHaveAccountAction')}
              </Link>
            </div>
          </MzCard>

          <p className="px-1 text-[11px] leading-relaxed text-text-tertiary">
            {t('onboardingCompactDisclaimer')}
          </p>
        </div>
      </div>
    </div>
  );
}

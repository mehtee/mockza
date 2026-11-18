import { Link } from '@tanstack/react-router';
import {
  Check,
  CheckCircle2,
  Crown,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  MzBanner,
  MzButton,
  MzCard,
  MzCheckbox,
} from '@/components/ui';
import { formatDisplayDate } from '@/edition/calendar/jalali-edge';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { type PaywallStatusBanner, usePaywallController } from './usePaywallController';

export interface PaywallScreenProps {
  readonly callbackSearch?: string;
  readonly returnUrl?: string;
  readonly onExternalRedirect?: (url: string) => void;
}

export function PaywallScreen({
  callbackSearch,
  returnUrl,
  onExternalRedirect,
}: PaywallScreenProps = {}) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const ctrl = usePaywallController({ callbackSearch, returnUrl, onExternalRedirect });

  const isPro = Boolean(ctrl.entitlement?.isPro || ctrl.session?.user?.isPro);
  const isAuthenticated = Boolean(ctrl.session?.isAuthenticated);
  const expiresTimestamp = ctrl.entitlement?.expiresAt
    ? Date.parse(ctrl.entitlement.expiresAt)
    : Number.NaN;
  const formattedExpiry = Number.isFinite(expiresTimestamp)
    ? formatDisplayDate(expiresTimestamp, deps.edition)
    : null;

  const renderBannerMessage = (banner: PaywallStatusBanner): string => {
    switch (banner.kind) {
      case 'raw':
        return banner.message;
      case 'tos_required':
        return t('paywallTosRequiredError');
      case 'redirecting':
        return t('paywallRedirectNotice');
      case 'pro_activated':
        return t('paywallProActivatedBanner', { plan: banner.planLabel });
      case 'checkout_cancelled':
        return t('paywallCheckoutCancelledBanner');
      case 'verification_failed':
        return t('paywallVerificationFailedBanner', { reason: banner.reason });
    }
  };

  const allowanceBullets = [
    t('paywallAllowanceSpeakingWriting'),
    t('paywallAllowanceMonthly'),
    t('paywallAllowanceVocab'),
    t('paywallAllowanceOffline'),
    t('paywallAllowanceTutor'),
  ] as const;

  const comparisonRows = [
    {
      label: t('paywallCompEvaluations'),
      freeValue: t('paywallCompFreeEvaluations'),
      proValue: t('paywallCompProEvaluations'),
    },
    {
      label: t('paywallCompOffline'),
      freeValue: t('paywallCompFreeOffline'),
      proValue: t('paywallCompProOffline'),
    },
    {
      label: t('paywallCompTutor'),
      freeValue: t('paywallCompFreeTutor'),
      proValue: t('paywallCompProTutor'),
    },
    {
      label: t('paywallCompDevices'),
      freeValue: t('paywallCompBothDevices'),
      proValue: t('paywallCompBothDevices'),
    },
  ] as const;

  return (
    <div data-testid="paywall-screen" className="mx-auto flex max-w-6xl flex-col gap-6 pb-10 text-start">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {t('paywallPageTitle')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-text-primary">{t('paywallHeroHeadline')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-secondary">{t('paywallHeroSubtitle')}</p>
        </div>

        <Link
          to="/settings"
          className="text-xs font-semibold text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
        >
          {t('navSettings')}
        </Link>
      </header>

      {ctrl.banner ? (
        <MzBanner
          tone={ctrl.banner.tone}
          actions={
            <button
              type="button"
              onClick={ctrl.dismissBanner}
              aria-label="Dismiss"
              className="rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          }
        >
          {renderBannerMessage(ctrl.banner)}
        </MzBanner>
      ) : null}

      {isPro ? (
        <MzCard variant="hero">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-mint-bg text-success">
                <Crown className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-bold text-text-primary">
                  {t('paywallAlreadyProBanner', {
                    plan: ctrl.entitlement?.activePlanId ?? 'Pro',
                  })}
                </p>
                {formattedExpiry ? (
                  <p className="text-xs text-text-secondary">
                    {t('settingsExpiresLabel', { date: formattedExpiry })}
                  </p>
                ) : null}
              </div>
            </div>

            {ctrl.canOpenPortal ? (
              <MzButton
                variant="secondary"
                size="sm"
                data-testid="paywall-portal-btn"
                isLoading={ctrl.isOpeningPortal}
                leadingIcon={<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() => void ctrl.openPortal()}
              >
                {t('paywallManagePortalAction')}
              </MzButton>
            ) : null}
          </div>
        </MzCard>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Fair-Use Allowance + Free vs Pro Comparison Matrix */}
        <div className="flex flex-col gap-6 lg:col-span-6">
          <MzCard variant="hero">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                {t('paywallFairUseHeader')}
              </h2>
            </div>

            <ul className="mt-4 flex flex-col gap-2.5 text-sm text-text-primary">
              {allowanceBullets.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </MzCard>

          <MzCard variant="default">
            <h2 className="text-base font-semibold text-text-primary">
              {t('paywallComparisonHeader')}
            </h2>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-start text-xs">
                <thead>
                  <tr className="border-b border-border-subtle text-text-secondary">
                    <th className="py-2 pe-3 font-semibold">{t('paywallFeatureCol')}</th>
                    <th className="px-3 py-2 font-semibold">{t('paywallFreeCol')}</th>
                    <th className="py-2 ps-3 font-bold text-primary">{t('paywallProCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.label} className="border-b border-border-subtle last:border-b-0">
                      <td className="py-3 pe-3 font-medium text-text-primary">{row.label}</td>
                      <td className="px-3 py-3 text-text-secondary">{row.freeValue}</td>
                      <td className="py-3 ps-3 font-semibold text-text-primary">{row.proValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </MzCard>
        </div>

        {/* Right: Plan Cards + Mandatory 1+1 ToS Checkbox + Checkout Button */}
        <div className="flex flex-col gap-5 lg:col-span-6">
          <MzCard variant="default">
            <h2 className="text-base font-semibold text-text-primary">
              {t('paywallSelectPlanHeader')}
            </h2>

            <div className="mt-4 flex flex-col gap-3" role="radiogroup" aria-label={t('paywallSelectPlanHeader')}>
              {ctrl.plans.map((plan) => {
                const selected = ctrl.selectedPlanId === plan.planId;
                return (
                  <button
                    key={plan.planId}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-testid={`paywall-plan-${plan.planId}`}
                    onClick={() => ctrl.selectPlan(plan.planId)}
                    className={[
                      'flex items-center justify-between gap-4 rounded-[var(--mz-radius-control)] border p-4 text-start transition-colors',
                      selected
                        ? 'border-primary bg-surface-alt'
                        : 'border-border-subtle bg-bg-raised hover:bg-surface-hover',
                    ].join(' ')}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-text-primary">{plan.title}</span>
                        {plan.isRecommended ? (
                          <span className="rounded-[var(--mz-radius-pill)] bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            {t('paywallRecommendedBadge')}
                          </span>
                        ) : null}
                        {plan.badgeText ? (
                          <span className="rounded-[var(--mz-radius-pill)] bg-mint-bg px-2 py-0.5 text-[11px] font-semibold text-success">
                            {plan.badgeText}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-text-secondary">{plan.subtitle}</p>
                    </div>

                    <div className="shrink-0 text-end">
                      <p
                        className={[
                          'text-base font-bold text-primary',
                          deps.edition === 'irn' ? '' : 'font-mono-exam',
                        ].join(' ')}
                      >
                        {plan.formattedPrice}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-start gap-2.5 rounded-[var(--mz-radius-control)] border border-border-subtle bg-surface-alt p-3.5 text-xs text-text-secondary">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p>{t('authPolicyNoticeBody')}</p>
            </div>

            <div className="mt-3">
              <MzCheckbox
                testId="paywall-tos-checkbox"
                checked={ctrl.tosAccepted}
                onCheckedChange={ctrl.setTosAccepted}
                label={t('paywallTosConsentLabel')}
              />
            </div>

            {!isAuthenticated && !isPro ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs">
                <span className="text-text-secondary">{t('paywallSignInNotice')}</span>
                <Link
                  to="/auth/login"
                  search={{ returnTo: '/app/paywall' }}
                  data-testid="paywall-signin-link"
                  className="font-semibold text-primary hover:underline"
                >
                  {t('paywallSignInAction')}
                </Link>
              </div>
            ) : null}

            <div className="mt-5">
              <MzButton
                variant="primary"
                size="lg"
                className="w-full"
                data-testid="paywall-checkout-btn"
                disabled={isPro || !ctrl.tosAccepted || ctrl.plans.length === 0}
                isLoading={ctrl.isCheckingOut}
                onClick={() => void ctrl.startCheckout()}
              >
                {isPro
                  ? t('settingsProActiveBadge')
                  : t('paywallSubscribeAction')}
              </MzButton>
            </div>
          </MzCard>
        </div>
      </div>
    </div>
  );
}

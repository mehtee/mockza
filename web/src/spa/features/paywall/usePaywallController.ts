import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BillingCatalogSnapshot,
  BillingPlanDescriptor,
  EntitlementSnapshot,
} from '@/gateways/billing.gateway';
import { useDeps } from '@/spa/deps';
import { useAuthSession } from '@/spa/stores/auth-session';

export type PaywallStatusBanner =
  | { readonly tone: 'info' | 'success' | 'warning' | 'danger'; readonly kind: 'raw'; readonly message: string }
  | { readonly tone: 'warning'; readonly kind: 'tos_required' }
  | { readonly tone: 'info'; readonly kind: 'redirecting' }
  | { readonly tone: 'success'; readonly kind: 'pro_activated'; readonly planLabel: string }
  | { readonly tone: 'warning'; readonly kind: 'checkout_cancelled' }
  | { readonly tone: 'danger'; readonly kind: 'verification_failed'; readonly reason: string };

export interface PaywallControllerOptions {
  readonly callbackSearch?: string;
  readonly returnUrl?: string;
  readonly onExternalRedirect?: (url: string) => void;
}

const CALLBACK_PARAM_KEYS = [
  'Authority',
  'authority',
  'Status',
  'status',
  'session_id',
  'checkout_session_id',
  'canceled',
  'cancelled',
] as const;

function hasBillingCallbackParams(params: URLSearchParams): boolean {
  return CALLBACK_PARAM_KEYS.some((key) => params.has(key));
}

export function usePaywallController(options: PaywallControllerOptions = {}) {
  const deps = useDeps();
  const { session } = useAuthSession(deps.auth);

  const [isLoading, setIsLoading] = useState(true);
  const [catalog, setCatalog] = useState<BillingCatalogSnapshot | null>(null);
  const [entitlement, setEntitlement] = useState<EntitlementSnapshot | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [tosAccepted, setTosAccepted] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [redirectedUrl, setRedirectedUrl] = useState<string | null>(null);
  const [banner, setBanner] = useState<PaywallStatusBanner | null>(null);

  const verifiedCallbackSearchRef = useRef<string | null>(null);

  const loadCatalog = useCallback(async () => {
    const res = await deps.billing.getPlansAndEntitlement();
    if (!res.ok) {
      setBanner({ tone: 'danger', kind: 'raw', message: res.error.message });
      setIsLoading(false);
      return;
    }
    setCatalog(res.value);
    setEntitlement(res.value.entitlement);

    const recommended =
      res.value.plans.find((plan) => plan.isRecommended) ?? res.value.plans[0];
    setSelectedPlanId((current) => current || (recommended?.planId ?? ''));
    setIsLoading(false);
  }, [deps.billing]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const searchStr =
      options.callbackSearch ??
      (typeof window !== 'undefined' ? window.location.search : '');
    if (!searchStr || verifiedCallbackSearchRef.current === searchStr) {
      return;
    }
    const params = new URLSearchParams(searchStr);
    if (!hasBillingCallbackParams(params)) {
      return;
    }

    verifiedCallbackSearchRef.current = searchStr;
    let mounted = true;

    async function verify() {
      const res = await deps.billing.verifyCallback(params);
      if (!mounted) return;
      if (!res.ok) {
        if (res.error.kind === 'billing' && res.error.code === 'CHECKOUT_CANCELLED') {
          setBanner({ tone: 'warning', kind: 'checkout_cancelled' });
        } else {
          setBanner({
            tone: 'danger',
            kind: 'verification_failed',
            reason: res.error.message,
          });
        }
        return;
      }
      setEntitlement(res.value);
      setBanner({
        tone: 'success',
        kind: 'pro_activated',
        planLabel: res.value.activePlanId ?? 'Pro',
      });
    }

    void verify();
    return () => {
      mounted = false;
    };
  }, [deps.billing, options.callbackSearch]);

  const plans: readonly BillingPlanDescriptor[] = catalog?.plans ?? [];
  const selectedPlan = plans.find((plan) => plan.planId === selectedPlanId) ?? plans[0] ?? null;

  const startCheckout = useCallback(async () => {
    if (!tosAccepted) {
      setBanner({ tone: 'warning', kind: 'tos_required' });
      return;
    }
    const plan = selectedPlan;
    if (!plan) return;

    setIsCheckingOut(true);
    setBanner(null);

    if (session?.isAuthenticated) {
      const consentRes = await deps.deviceSlots.recordDevicePolicyConsent();
      if (!consentRes.ok) {
        setIsCheckingOut(false);
        setBanner({ tone: 'danger', kind: 'raw', message: consentRes.error.message });
        return;
      }
    }

    const returnUrl =
      options.returnUrl ??
      (typeof window !== 'undefined'
        ? `${window.location.origin}/app/paywall`
        : '/app/paywall');

    const checkoutRes = await deps.billing.startCheckout({
      planId: plan.planId,
      acceptedSingleDevicePerSlotTos: true,
      returnUrl,
    });
    setIsCheckingOut(false);

    if (!checkoutRes.ok) {
      setBanner({ tone: 'danger', kind: 'raw', message: checkoutRes.error.message });
      return;
    }

    if ('activatedSession' in checkoutRes.value) {
      setEntitlement(checkoutRes.value.activatedSession);
      setBanner({
        tone: 'success',
        kind: 'pro_activated',
        planLabel: plan.title,
      });
      return;
    }

    const targetUrl = checkoutRes.value.redirectUrl;
    setRedirectedUrl(targetUrl);
    setBanner({ tone: 'info', kind: 'redirecting' });
    if (options.onExternalRedirect) {
      options.onExternalRedirect(targetUrl);
    } else if (typeof window !== 'undefined') {
      window.location.assign(targetUrl);
    }
  }, [
    deps.billing,
    deps.deviceSlots,
    options,
    selectedPlan,
    session?.isAuthenticated,
    tosAccepted,
  ]);

  const openPortal = useCallback(async () => {
    if (!deps.billing.openCustomerPortal) return;
    setIsOpeningPortal(true);
    const res = await deps.billing.openCustomerPortal();
    setIsOpeningPortal(false);
    if (!res.ok) {
      setBanner({ tone: 'danger', kind: 'raw', message: res.error.message });
      return;
    }
    setRedirectedUrl(res.value.portalUrl);
    if (options.onExternalRedirect) {
      options.onExternalRedirect(res.value.portalUrl);
    } else if (typeof window !== 'undefined') {
      window.location.assign(res.value.portalUrl);
    }
  }, [deps.billing, options]);

  return {
    session,
    isLoading,
    currencyKind: catalog?.currencyKind ?? deps.billing.currencyKind,
    plans,
    selectedPlan,
    selectedPlanId: selectedPlan?.planId ?? selectedPlanId,
    entitlement,
    tosAccepted,
    isCheckingOut,
    isOpeningPortal,
    canOpenPortal: Boolean(deps.billing.openCustomerPortal),
    redirectedUrl,
    banner,
    selectPlan: setSelectedPlanId,
    setTosAccepted,
    startCheckout,
    openPortal,
    dismissBanner: () => setBanner(null),
  };
}

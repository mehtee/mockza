import { type ApiClient, mapApiErrorToBillingError } from '@/adapters/http/api-client';
import type {
  BillingCatalogSnapshot,
  BillingGatewayError,
  BillingPlanDescriptor,
  EntitlementSnapshot,
  IBillingGateway,
  StartCheckoutInput,
  StartCheckoutOutcome,
} from '@/gateways/billing.gateway';
import { err, ok, type Result } from '@/gateways/result';

export const DEFAULT_GLB_USD_PLANS: readonly BillingPlanDescriptor[] = [
  {
    planId: 'mockza_cram_weekly',
    title: 'Exam Cram Pass',
    subtitle: 'Full Pro AI evaluation allowance for 7 days (10 Speaking + 10 Writing daily).',
    interval: 'week',
    currencyKind: 'USD',
    amountMinor: 999,
    formattedPrice: '$9.99',
  },
  {
    planId: 'mockza_pro_monthly',
    title: 'Pro Monthly',
    subtitle: 'Pro Speaking & Writing AI reviews (10+10 daily, 150/month) + Explanations.',
    interval: 'month',
    currencyKind: 'USD',
    amountMinor: 1999,
    formattedPrice: '$19.99',
    isRecommended: true,
    badgeText: 'Most Popular',
  },
  {
    planId: 'mockza_quarterly',
    title: 'Quarterly Bundle',
    subtitle: 'Full 3-month preparation window with max savings.',
    interval: 'quarter',
    currencyKind: 'USD',
    amountMinor: 4499,
    formattedPrice: '$44.99',
    badgeText: 'Save 25%',
  },
] as const;

export interface StripeBillingAdapterOptions {
  readonly apiClient: ApiClient;
  readonly allowDevAuth?: boolean;
}

export class StripeBillingAdapter implements IBillingGateway {
  readonly currencyKind = 'USD' as const;
  private readonly apiClient: ApiClient;
  private readonly allowDevAuth: boolean;

  constructor(options: StripeBillingAdapterOptions) {
    this.apiClient = options.apiClient;
    this.allowDevAuth = options.allowDevAuth ?? false;
  }

  async getPlansAndEntitlement(): Promise<Result<BillingCatalogSnapshot, BillingGatewayError>> {
    const quotaRes = await this.apiClient.get<{
      readonly isPro: boolean;
      readonly freeDiagnosticUsed: boolean;
      readonly activePlanId?: string | null;
      readonly expiresAt?: string | null;
      readonly source?: EntitlementSnapshot['source'];
    }>('/v1/quota/me');

    if (!quotaRes.ok) {
      if (quotaRes.error.kind === 'unauthorized') {
        return ok({
          currencyKind: 'USD',
          plans: DEFAULT_GLB_USD_PLANS,
          entitlement: {
            isPro: false,
            activePlanId: null,
            expiresAt: null,
            source: 'none',
            freeDiagnosticUsed: false,
          },
        });
      }
      return err(mapApiErrorToBillingError(quotaRes.error));
    }

    return ok({
      currencyKind: 'USD',
      plans: DEFAULT_GLB_USD_PLANS,
      entitlement: {
        isPro: Boolean(quotaRes.value.isPro),
        activePlanId: quotaRes.value.activePlanId ?? null,
        expiresAt: quotaRes.value.expiresAt ?? null,
        source: quotaRes.value.source ?? (quotaRes.value.isPro ? 'stripe' : 'none'),
        freeDiagnosticUsed: Boolean(quotaRes.value.freeDiagnosticUsed),
      },
    });
  }

  async startCheckout(
    input: StartCheckoutInput,
  ): Promise<Result<StartCheckoutOutcome, BillingGatewayError>> {
    if (input.acceptedSingleDevicePerSlotTos !== true) {
      return err({
        kind: 'billing',
        code: 'TOS_REQUIRED',
        message:
          'You must accept the 1 Phone + 1 Desktop Web slot policy before starting checkout.',
      });
    }

    const plan = DEFAULT_GLB_USD_PLANS.find((p) => p.planId === input.planId);
    if (!plan) {
      return err({
        kind: 'validation',
        field: 'planId',
        code: 'UNKNOWN_PLAN',
        message: `Unknown GLB billing plan: ${input.planId}`,
      });
    }

    const res = await this.apiClient.post<{
      readonly redirectUrl?: string;
      readonly activatedSession?: EntitlementSnapshot;
    }>('/v1/billing/glb/checkout', {
      planId: input.planId,
      acceptedSingleDevicePerSlotTos: true,
      returnUrl: input.returnUrl,
    });

    if (!res.ok) {
      if (
        this.allowDevAuth &&
        res.error.kind === 'network' &&
        (res.error.status === 404 || res.error.status === 501)
      ) {
        return ok({
          activatedSession: {
            isPro: true,
            activePlanId: input.planId,
            expiresAt: null,
            source: 'dev_sandbox',
            freeDiagnosticUsed: false,
          },
        });
      }
      return err(mapApiErrorToBillingError(res.error));
    }

    if (res.value.activatedSession) {
      return ok({ activatedSession: res.value.activatedSession });
    }
    if (res.value.redirectUrl) {
      return ok({ redirectUrl: res.value.redirectUrl });
    }
    return err({
      kind: 'billing',
      code: 'PROVIDER_UNAVAILABLE',
      message: 'GLB checkout response missing redirectUrl or activatedSession.',
    });
  }

  async verifyCallback(
    params: URLSearchParams,
  ): Promise<Result<EntitlementSnapshot, BillingGatewayError>> {
    const canceled = params.get('canceled') ?? params.get('cancelled');
    const status = params.get('status')?.toLowerCase();
    if (canceled === 'true' || status === 'cancelled' || status === 'canceled') {
      return err({
        kind: 'billing',
        code: 'CHECKOUT_CANCELLED',
        message: 'Checkout was cancelled before payment completed.',
      });
    }

    const sessionId = params.get('session_id') ?? params.get('checkout_session_id');
    if (!sessionId || sessionId.trim().length === 0) {
      return err({
        kind: 'billing',
        code: 'VERIFICATION_FAILED',
        message: 'Missing Stripe/RevenueCat checkout session_id callback parameter.',
      });
    }

    const res = await this.apiClient.post<EntitlementSnapshot>('/v1/billing/glb/verify', {
      sessionId: sessionId.trim(),
    });
    if (!res.ok) {
      return err(mapApiErrorToBillingError(res.error));
    }
    return ok(res.value);
  }

  async openCustomerPortal(): Promise<
    Result<{ readonly portalUrl: string }, BillingGatewayError>
  > {
    const res = await this.apiClient.post<{ readonly portalUrl?: string }>(
      '/v1/billing/glb/portal',
    );
    if (!res.ok) {
      return err(mapApiErrorToBillingError(res.error));
    }
    if (!res.value?.portalUrl) {
      return err({
        kind: 'billing',
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Billing portal URL is unavailable.',
      });
    }
    return ok({ portalUrl: res.value.portalUrl });
  }
}

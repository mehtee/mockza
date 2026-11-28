import { formatTomanFromRial } from '@/edition/bidi/numerals';
import type {
  BillingCatalogSnapshot,
  BillingCurrencyKind,
  BillingGatewayError,
  BillingPlanDescriptor,
  EntitlementSnapshot,
  IBillingGateway,
  StartCheckoutInput,
  StartCheckoutOutcome,
} from '@/gateways/billing.gateway';
import { err, ok, type Result } from '@/gateways/result';

const FAKE_USD_PLANS: readonly BillingPlanDescriptor[] = [
  {
    planId: 'mockza_cram_weekly',
    title: 'Exam Cram Pass',
    subtitle: '7-day Pro AI evaluation access.',
    interval: 'week',
    currencyKind: 'USD',
    amountMinor: 999,
    formattedPrice: '$9.99',
  },
  {
    planId: 'mockza_pro_monthly',
    title: 'Pro Monthly',
    subtitle: 'Monthly Pro AI evaluation access.',
    interval: 'month',
    currencyKind: 'USD',
    amountMinor: 1999,
    formattedPrice: '$19.99',
    isRecommended: true,
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
];

const FAKE_IRR_PLANS: readonly BillingPlanDescriptor[] = [
  {
    planId: 'mockza_cram_weekly',
    title: 'گذرنامه فشرده ۷ روزه',
    subtitle: 'دسترسی ۷ روزه ارزیابی هوشمند.',
    interval: 'week',
    currencyKind: 'IRR',
    amountMinor: 1_990_000,
    formattedPrice: formatTomanFromRial(1_990_000),
  },
  {
    planId: 'mockza_pro_monthly',
    title: 'اشتراک ماهانه پرو',
    subtitle: 'دسترسی ماهانه ارزیابی هوشمند.',
    interval: 'month',
    currencyKind: 'IRR',
    amountMinor: 3_900_000,
    formattedPrice: formatTomanFromRial(3_900_000),
    isRecommended: true,
  },
  {
    planId: 'mockza_quarterly',
    title: 'بسته سه‌ماهه آمادگی کامل',
    subtitle: 'صرفه‌جویی ویژه برای دوره آمادگی ۹۰ روزه.',
    interval: 'quarter',
    currencyKind: 'IRR',
    amountMinor: 8_900_000,
    formattedPrice: formatTomanFromRial(8_900_000),
    // 390,000 × 3 = 1,170,000 vs 890,000 -> 23.93% (~24% savings)
    badgeText: '۲۴٪ تخفیف',
  },
];

export interface FakeBillingAdapterOptions {
  readonly currencyKind?: BillingCurrencyKind;
  readonly initialPro?: boolean;
  readonly instantActivateOnCheckout?: boolean;
}

export class FakeBillingAdapter implements IBillingGateway {
  readonly currencyKind: BillingCurrencyKind;
  readonly openCustomerPortal?: () => Promise<
    Result<{ readonly portalUrl: string }, BillingGatewayError>
  >;
  private readonly plans: readonly BillingPlanDescriptor[];
  private readonly instantActivateOnCheckout: boolean;
  private entitlement: EntitlementSnapshot;
  private pendingPlanId: string | null = null;

  constructor(options: FakeBillingAdapterOptions = {}) {
    this.currencyKind = options.currencyKind ?? 'USD';
    this.plans = this.currencyKind === 'IRR' ? FAKE_IRR_PLANS : FAKE_USD_PLANS;
    this.instantActivateOnCheckout = options.instantActivateOnCheckout ?? false;
    this.entitlement = {
      isPro: options.initialPro ?? false,
      activePlanId: options.initialPro ? (this.plans[0]?.planId ?? null) : null,
      expiresAt: null,
      source: options.initialPro ? 'dev_sandbox' : 'none',
      freeDiagnosticUsed: false,
    };
    if (this.currencyKind === 'USD') {
      this.openCustomerPortal = async () => ok({ portalUrl: 'https://billing.mockza.local/portal' });
    }
  }

  async getPlansAndEntitlement(): Promise<Result<BillingCatalogSnapshot, BillingGatewayError>> {
    return ok({
      currencyKind: this.currencyKind,
      plans: this.plans,
      entitlement: this.entitlement,
    });
  }

  async startCheckout(
    input: StartCheckoutInput,
  ): Promise<Result<StartCheckoutOutcome, BillingGatewayError>> {
    if (input.acceptedSingleDevicePerSlotTos !== true) {
      return err({
        kind: 'billing',
        code: 'TOS_REQUIRED',
        message: 'Single-device-per-slot Terms of Service acceptance is required.',
      });
    }

    const plan = this.plans.find((p) => p.planId === input.planId);
    if (!plan) {
      return err({
        kind: 'validation',
        field: 'planId',
        code: 'UNKNOWN_PLAN',
        message: `Unknown billing plan: ${input.planId}`,
      });
    }

    this.pendingPlanId = plan.planId;
    if (this.instantActivateOnCheckout) {
      this.entitlement = {
        ...this.entitlement,
        isPro: true,
        activePlanId: plan.planId,
        source: 'dev_sandbox',
      };
      return ok({ activatedSession: this.entitlement });
    }

    const tokenParam =
      this.currencyKind === 'IRR'
        ? 'Authority=fake-auth-001&Status=OK'
        : 'session_id=fake-cs-001';
    const separator = input.returnUrl.includes('?') ? '&' : '?';
    return ok({ redirectUrl: `${input.returnUrl}${separator}${tokenParam}` });
  }

  async verifyCallback(
    params: URLSearchParams,
  ): Promise<Result<EntitlementSnapshot, BillingGatewayError>> {
    const status = (params.get('Status') ?? params.get('status') ?? '').toUpperCase();
    const canceled = params.get('canceled') ?? params.get('cancelled');
    if (canceled === 'true' || status === 'NOK' || status === 'CANCELLED' || status === 'CANCELED') {
      return err({
        kind: 'billing',
        code: 'CHECKOUT_CANCELLED',
        message: 'Payment checkout was cancelled.',
      });
    }

    const hasToken =
      this.currencyKind === 'IRR'
        ? status === 'OK' && Boolean(params.get('Authority'))
        : Boolean(params.get('session_id') ?? params.get('checkout_session_id'));

    if (!hasToken) {
      return err({
        kind: 'billing',
        code: 'VERIFICATION_FAILED',
        message: 'Missing or invalid billing callback parameters.',
      });
    }

    this.entitlement = {
      ...this.entitlement,
      isPro: true,
      activePlanId: this.pendingPlanId ?? this.plans[0]?.planId ?? 'mockza_pro_monthly',
      source: 'dev_sandbox',
    };
    this.pendingPlanId = null;
    return ok(this.entitlement);
  }
}

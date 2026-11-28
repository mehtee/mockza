import { type ApiClient, mapApiErrorToBillingError } from '@/adapters/http/api-client';
import { formatTomanFromRial } from '@/edition/bidi/numerals';
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

export function getDefaultIrnIrrPlans(): readonly BillingPlanDescriptor[] {
  return [
    {
      planId: 'mockza_cram_weekly',
      title: 'گذرنامه فشرده ۷ روزه',
      subtitle: 'دسترسی کامل به ارزیابی هوشمند رایتینگ و اسپیکینگ برای ۷ روز',
      interval: 'week',
      currencyKind: 'IRR',
      amountMinor: 1_990_000,
      formattedPrice: formatTomanFromRial(1_990_000),
    },
    {
      planId: 'mockza_pro_monthly',
      title: 'اشتراک ماهانه پرو',
      subtitle: 'ارزیابی روزانه رایتینگ و اسپیکینگ + تحلیل هوشمند ریدینگ و لیسنینگ',
      interval: 'month',
      currencyKind: 'IRR',
      amountMinor: 3_900_000,
      formattedPrice: formatTomanFromRial(3_900_000),
      isRecommended: true,
      badgeText: 'محبوب‌ترین',
    },
    {
      planId: 'mockza_quarterly',
      title: 'بسته سه‌ماهه آمادگی کامل',
      subtitle: 'صرفه‌جویی ویژه برای دوره آمادگی ۹۰ روزه',
      interval: 'quarter',
      currencyKind: 'IRR',
      amountMinor: 8_900_000,
      formattedPrice: formatTomanFromRial(8_900_000),
      // 390,000 × 3 = 1,170,000 vs 890,000 -> 23.93% (~24% savings)
      badgeText: '۲۴٪ تخفیف',
    },
  ];
}

export interface ZarinpalBillingAdapterOptions {
  readonly apiClient: ApiClient;
  readonly allowDevAuth?: boolean;
}

export class ZarinpalBillingAdapter implements IBillingGateway {
  readonly currencyKind = 'IRR' as const;
  private readonly apiClient: ApiClient;
  private readonly allowDevAuth: boolean;

  constructor(options: ZarinpalBillingAdapterOptions) {
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
          currencyKind: 'IRR',
          plans: getDefaultIrnIrrPlans(),
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
      currencyKind: 'IRR',
      plans: getDefaultIrnIrrPlans(),
      entitlement: {
        isPro: Boolean(quotaRes.value.isPro),
        activePlanId: quotaRes.value.activePlanId ?? null,
        expiresAt: quotaRes.value.expiresAt ?? null,
        source: quotaRes.value.source ?? (quotaRes.value.isPro ? 'zarinpal' : 'none'),
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
          'تایید قوانین استفاده هم‌زمان روی ۱ گوشی و ۱ مرورگر دسکتاپ پیش از پرداخت الزامی است.',
      });
    }

    const plan = getDefaultIrnIrrPlans().find((p) => p.planId === input.planId);
    if (!plan || !Number.isInteger(plan.amountMinor) || plan.amountMinor <= 0) {
      return err({
        kind: 'validation',
        field: 'planId',
        code: 'UNKNOWN_PLAN',
        message: `Unknown IRN billing plan: ${input.planId}`,
      });
    }

    const res = await this.apiClient.post<{
      readonly redirectUrl?: string;
      readonly paymentUrl?: string;
      readonly authority?: string;
      readonly activatedSession?: EntitlementSnapshot;
    }>('/v1/billing/zarinpal/request', {
      planId: input.planId,
      amountRial: plan.amountMinor,
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
    const redirectUrl = res.value.redirectUrl ?? res.value.paymentUrl;
    if (redirectUrl) {
      return ok({ redirectUrl });
    }
    return err({
      kind: 'billing',
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Zarinpal request response missing redirectUrl.',
    });
  }

  async verifyCallback(
    params: URLSearchParams,
  ): Promise<Result<EntitlementSnapshot, BillingGatewayError>> {
    const status = (params.get('Status') ?? params.get('status') ?? '').toUpperCase();
    const authority = params.get('Authority') ?? params.get('authority') ?? '';

    if (status === 'NOK' || status === 'CANCELLED' || status === 'CANCELED') {
      return err({
        kind: 'billing',
        code: 'CHECKOUT_CANCELLED',
        message: 'پرداخت توسط کاربر لغو شد.',
      });
    }

    if (!authority.trim() || status !== 'OK') {
      return err({
        kind: 'billing',
        code: 'VERIFICATION_FAILED',
        message: 'پارامترهای بازگشت زرین‌پال نامعتبر است.',
      });
    }

    const res = await this.apiClient.post<EntitlementSnapshot>('/v1/billing/zarinpal/verify', {
      authority: authority.trim(),
      status,
    });

    if (!res.ok) {
      return err(mapApiErrorToBillingError(res.error));
    }
    return ok(res.value);
  }
}

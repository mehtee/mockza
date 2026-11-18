import type {
  BillingError,
  NetworkError,
  Result,
  UnauthorizedError,
  UnexpectedError,
  ValidationError,
} from './result';

export type BillingCurrencyKind = 'USD' | 'IRR';

export type BillingPlanInterval = 'week' | 'month' | 'quarter' | 'year';

export type EntitlementSource =
  | 'stripe'
  | 'revenuecat'
  | 'zarinpal'
  | 'zibal'
  | 'dev_sandbox'
  | 'none';

export interface BillingPlanDescriptor {
  readonly planId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly interval: BillingPlanInterval;
  readonly currencyKind: BillingCurrencyKind;
  readonly amountMinor: number;
  readonly formattedPrice: string;
  readonly isRecommended?: boolean;
  readonly badgeText?: string;
}

export interface EntitlementSnapshot {
  readonly isPro: boolean;
  readonly activePlanId: string | null;
  readonly expiresAt: string | null;
  readonly source: EntitlementSource;
  readonly freeDiagnosticUsed: boolean;
}

export interface BillingCatalogSnapshot {
  readonly currencyKind: BillingCurrencyKind;
  readonly plans: readonly BillingPlanDescriptor[];
  readonly entitlement: EntitlementSnapshot;
}

export interface StartCheckoutInput {
  readonly planId: string;
  readonly acceptedSingleDevicePerSlotTos: true;
  readonly returnUrl: string;
}

export type StartCheckoutOutcome =
  | { readonly redirectUrl: string }
  | { readonly activatedSession: EntitlementSnapshot };

export type BillingGatewayError =
  | BillingError
  | NetworkError
  | UnauthorizedError
  | ValidationError
  | UnexpectedError;

export interface IBillingGateway {
  readonly currencyKind: BillingCurrencyKind;
  getPlansAndEntitlement(): Promise<Result<BillingCatalogSnapshot, BillingGatewayError>>;
  startCheckout(
    input: StartCheckoutInput,
  ): Promise<Result<StartCheckoutOutcome, BillingGatewayError>>;
  verifyCallback(params: URLSearchParams): Promise<Result<EntitlementSnapshot, BillingGatewayError>>;
  openCustomerPortal?(): Promise<Result<{ readonly portalUrl: string }, BillingGatewayError>>;
}

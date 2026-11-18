import { randomUUID } from 'node:crypto';
import type { AppEnv } from '@mockza/config';
import {
  billingOrders,
  devices,
  entitlements,
  type MockzaDb,
  userDeviceSessions,
  userEntitlements,
} from '@mockza/db';
import { and, eq, inArray, isNull } from 'drizzle-orm';

export interface PlanPricingSpec {
  readonly planId: string;
  readonly durationDays: number;
  readonly irrMinorRials: number;
  readonly usdMinorCents: number;
  readonly descriptionFa: string;
  readonly descriptionEn: string;
}

export const WEB_BILLING_PLANS: Readonly<Record<string, PlanPricingSpec>> = {
  mockza_cram_weekly: {
    planId: 'mockza_cram_weekly',
    durationDays: 7,
    irrMinorRials: 1_990_000,
    usdMinorCents: 999,
    descriptionFa: 'گذرنامه فشرده ۷ روزه سنجیا',
    descriptionEn: 'Mockza Exam Cram Pass (7 Days)',
  },
  mockza_pro_monthly: {
    planId: 'mockza_pro_monthly',
    durationDays: 30,
    irrMinorRials: 3_900_000,
    usdMinorCents: 1999,
    descriptionFa: 'اشتراک ماهانه پرو سنجیا',
    descriptionEn: 'Mockza Pro Monthly',
  },
  mockza_quarterly: {
    planId: 'mockza_quarterly',
    durationDays: 90,
    irrMinorRials: 8_900_000,
    usdMinorCents: 4499,
    descriptionFa: 'بسته سه‌ماهه آمادگی کامل سنجیا',
    descriptionEn: 'Mockza Quarterly Bundle',
  },
};

export type EntitlementSource =
  | 'revenuecat'
  | 'stripe'
  | 'zarinpal'
  | 'bazaar'
  | 'myket'
  | 'dev_sandbox'
  | 'none';

export interface EntitlementSnapshot {
  readonly isPro: boolean;
  readonly activePlanId: string | null;
  readonly expiresAt: string | null;
  readonly source: EntitlementSource;
  readonly freeDiagnosticUsed: boolean;
}

export class WebBillingError extends Error {
  constructor(
    public readonly code:
      | 'validation_error'
      | 'edition_forbidden'
      | 'billing_unavailable'
      | 'provider_not_configured'
      | 'not_found',
    message: string,
    public readonly status: 400 | 403 | 404 | 502 | 503,
  ) {
    super(message);
    this.name = 'WebBillingError';
  }
}

export interface MemoryBillingOrder {
  orderId: string;
  userId: string | null;
  deviceId: string;
  edition: 'glb' | 'irn';
  provider: 'zarinpal' | 'stripe' | 'dev_sandbox';
  planId: string;
  currency: 'IRR' | 'USD';
  amountMinor: number;
  authority: string;
  refId: string | null;
  status: 'pending' | 'verified' | 'cancelled' | 'failed';
  acceptedDevicePolicyAt: Date;
  createdAt: Date;
  verifiedAt: Date | null;
}

export interface WebBillingService {
  requestZarinpal(params: {
    userId: string | null;
    deviceId: string;
    planId: string;
    amountRial: number;
    returnUrl: string;
  }): Promise<{
    redirectUrl?: string;
    paymentUrl?: string;
    authority?: string;
    activatedSession?: EntitlementSnapshot;
  }>;
  verifyZarinpal(params: {
    userId: string | null;
    deviceId: string;
    authority: string;
    status?: string;
  }): Promise<EntitlementSnapshot>;
  createGlbCheckout(params: {
    userId: string | null;
    deviceId: string;
    planId: string;
    returnUrl: string;
  }): Promise<{
    redirectUrl?: string;
    activatedSession?: EntitlementSnapshot;
  }>;
  verifyGlbCheckout(params: {
    userId: string | null;
    deviceId: string;
    sessionId: string;
  }): Promise<EntitlementSnapshot>;
  createGlbPortal(params: {
    userId: string | null;
    returnUrl?: string;
  }): Promise<{ portalUrl: string }>;
}

function appendQueryParams(rawUrl: string, extra: Record<string, string>): string {
  const url = new URL(rawUrl);
  for (const [k, v] of Object.entries(extra)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

export function createWebBillingService(
  env: AppEnv,
  db?: MockzaDb,
  options: {
    fetchFn?: typeof fetch;
    onMemoryEntitlementGranted?: (params: {
      userId: string | null;
      deviceId: string;
      planId: string;
      expiresAt: Date;
    }) => void;
  } = {},
): WebBillingService {
  const fetchFn = options.fetchFn ?? fetch;
  const memoryOrders = new Map<string, MemoryBillingOrder>();

  async function grantProEntitlement(params: {
    userId: string | null;
    deviceId: string;
    planId: string;
    provider: 'zarinpal' | 'stripe' | 'dev_sandbox';
    durationDays: number;
    acceptedDevicePolicyAt: Date;
  }): Promise<EntitlementSnapshot> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + params.durationDays * 24 * 60 * 60 * 1000);
    let freeDiagnosticUsed = false;

    if (db) {
      await db.transaction(async (tx) => {
        if (params.userId) {
          await tx
            .insert(userEntitlements)
            .values({
              userId: params.userId,
              provider: params.provider,
              originalAppUserId: params.userId,
              productId: params.planId,
              isPro: true,
              acceptedDevicePolicyAt: params.acceptedDevicePolicyAt,
              expiresAt,
              graceUntil: null,
              lastVerifiedAt: now,
              lastEventAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: userEntitlements.userId,
              set: {
                provider: params.provider,
                productId: params.planId,
                isPro: true,
                acceptedDevicePolicyAt: params.acceptedDevicePolicyAt,
                expiresAt,
                graceUntil: null,
                lastVerifiedAt: now,
                lastEventAt: now,
                updatedAt: now,
              },
            });

          const activeSessionRows = await tx
            .select({ deviceId: userDeviceSessions.deviceId })
            .from(userDeviceSessions)
            .where(
              and(
                eq(userDeviceSessions.userId, params.userId),
                isNull(userDeviceSessions.revokedAt),
              ),
            );
          const targetDeviceIds = Array.from(
            new Set([params.deviceId, ...activeSessionRows.map((r) => r.deviceId)]),
          );

          for (const targetDeviceId of targetDeviceIds) {
            await tx
              .insert(entitlements)
              .values({
                deviceId: targetDeviceId,
                userId: params.userId,
                provider: params.provider,
                originalAppUserId: params.userId ?? targetDeviceId,
                productId: params.planId,
                isPro: true,
                expiresAt,
                graceUntil: null,
                lastVerifiedAt: now,
                lastEventAt: now,
                updatedAt: now,
              })
              .onConflictDoUpdate({
                target: entitlements.deviceId,
                set: {
                  userId: params.userId,
                  provider: params.provider,
                  productId: params.planId,
                  isPro: true,
                  expiresAt,
                  graceUntil: null,
                  lastVerifiedAt: now,
                  lastEventAt: now,
                  updatedAt: now,
                },
              });
          }

          const devRows = await tx
            .select({ freeDiagnosticUsed: devices.freeDiagnosticUsed })
            .from(devices)
            .where(inArray(devices.deviceId, targetDeviceIds));
          freeDiagnosticUsed = devRows.some((r) => r.freeDiagnosticUsed);
        } else {
          await tx
            .insert(entitlements)
            .values({
              deviceId: params.deviceId,
              userId: null,
              provider: params.provider,
              originalAppUserId: params.deviceId,
              productId: params.planId,
              isPro: true,
              expiresAt,
              graceUntil: null,
              lastVerifiedAt: now,
              lastEventAt: now,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: entitlements.deviceId,
              set: {
                provider: params.provider,
                productId: params.planId,
                isPro: true,
                expiresAt,
                graceUntil: null,
                lastVerifiedAt: now,
                lastEventAt: now,
                updatedAt: now,
              },
            });

          const [dev] = await tx
            .select({ freeDiagnosticUsed: devices.freeDiagnosticUsed })
            .from(devices)
            .where(eq(devices.deviceId, params.deviceId))
            .limit(1);
          freeDiagnosticUsed = Boolean(dev?.freeDiagnosticUsed);
        }
      });
    } else {
      options.onMemoryEntitlementGranted?.({
        userId: params.userId,
        deviceId: params.deviceId,
        planId: params.planId,
        expiresAt,
      });
    }

    return {
      isPro: true,
      activePlanId: params.planId,
      expiresAt: expiresAt.toISOString(),
      source: params.provider,
      freeDiagnosticUsed,
    };
  }

  async function saveOrder(order: MemoryBillingOrder): Promise<void> {
    if (db) {
      await db.insert(billingOrders).values(order);
    } else {
      memoryOrders.set(order.authority, order);
    }
  }

  async function findOrderByAuthority(authority: string): Promise<MemoryBillingOrder | null> {
    if (db) {
      const [row] = await db
        .select()
        .from(billingOrders)
        .where(eq(billingOrders.authority, authority))
        .limit(1);
      if (!row) return null;
      return {
        ...row,
        edition: row.edition === 'irn' ? 'irn' : 'glb',
        provider: (row.provider as MemoryBillingOrder['provider']) ?? 'dev_sandbox',
        currency: row.currency === 'IRR' ? 'IRR' : 'USD',
        status: row.status as MemoryBillingOrder['status'],
      };
    }
    return memoryOrders.get(authority) ?? null;
  }

  async function updateOrderStatus(
    orderId: string,
    authority: string,
    status: MemoryBillingOrder['status'],
    refId: string | null,
    verifiedAt: Date | null,
  ): Promise<void> {
    if (db) {
      await db
        .update(billingOrders)
        .set({ status, refId, verifiedAt })
        .where(eq(billingOrders.orderId, orderId));
    } else {
      const existing = memoryOrders.get(authority);
      if (existing) {
        existing.status = status;
        existing.refId = refId;
        existing.verifiedAt = verifiedAt;
      }
    }
  }

  function isSandboxBillingAllowed(): boolean {
    return env.NODE_ENV !== 'production' && (env.ALLOW_DEV_AUTH_PROVIDERS || env.ZARINPAL_SANDBOX);
  }

  return {
    async requestZarinpal({ userId, deviceId, planId, amountRial, returnUrl }) {
      const plan = WEB_BILLING_PLANS[planId];
      if (!plan) {
        throw new WebBillingError('validation_error', `Unknown planId: ${planId}`, 400);
      }
      if (amountRial !== plan.irrMinorRials) {
        throw new WebBillingError(
          'validation_error',
          `Plan ${planId} requires integer amountRial=${plan.irrMinorRials}.`,
          400,
        );
      }

      const now = new Date();
      const merchantId = env.ZARINPAL_MERCHANT_ID.trim();
      if (merchantId.length > 0) {
        const host = env.ZARINPAL_SANDBOX
          ? 'https://sandbox.zarinpal.com'
          : 'https://payment.zarinpal.com';
        const res = await fetchFn(`${host}/pg/v4/payment/request.json`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            merchant_id: merchantId,
            amount: plan.irrMinorRials,
            currency: 'IRR',
            callback_url: returnUrl,
            description: plan.descriptionFa,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          data?: { code?: number; authority?: string };
        };
        const authority = json.data?.authority;
        if (!res.ok || json.data?.code !== 100 || !authority) {
          throw new WebBillingError(
            'billing_unavailable',
            'Zarinpal payment initialization failed.',
            502,
          );
        }
        await saveOrder({
          orderId: randomUUID(),
          userId,
          deviceId,
          edition: 'irn',
          provider: 'zarinpal',
          planId,
          currency: 'IRR',
          amountMinor: plan.irrMinorRials,
          authority,
          refId: null,
          status: 'pending',
          acceptedDevicePolicyAt: now,
          createdAt: now,
          verifiedAt: null,
        });
        const paymentUrl = `${host}/pg/StartPay/${authority}`;
        return { authority, paymentUrl, redirectUrl: paymentUrl };
      }

      if (!isSandboxBillingAllowed()) {
        throw new WebBillingError(
          'provider_not_configured',
          'Zarinpal merchant credentials are not configured.',
          503,
        );
      }

      const sandboxAuthority = `S00000000000000000000000000${randomUUID().replace(/-/g, '').slice(0, 9)}`;
      await saveOrder({
        orderId: randomUUID(),
        userId,
        deviceId,
        edition: 'irn',
        provider: 'dev_sandbox',
        planId,
        currency: 'IRR',
        amountMinor: plan.irrMinorRials,
        authority: sandboxAuthority,
        refId: null,
        status: 'pending',
        acceptedDevicePolicyAt: now,
        createdAt: now,
        verifiedAt: null,
      });

      const redirectUrl = appendQueryParams(returnUrl, {
        Status: 'OK',
        Authority: sandboxAuthority,
      });
      return { authority: sandboxAuthority, redirectUrl };
    },

    async verifyZarinpal({ userId, deviceId, authority, status }) {
      const order = await findOrderByAuthority(authority);
      if (order?.edition !== 'irn') {
        throw new WebBillingError('not_found', 'Payment order not found.', 404);
      }
      if (order.userId && userId && order.userId !== userId) {
        throw new WebBillingError(
          'not_found',
          'Payment order does not belong to this account.',
          404,
        );
      }
      const plan = WEB_BILLING_PLANS[order.planId];
      if (!plan) {
        throw new WebBillingError('validation_error', 'Order references an unknown plan.', 400);
      }

      if (status && status.toUpperCase() !== 'OK') {
        await updateOrderStatus(order.orderId, authority, 'cancelled', null, null);
        throw new WebBillingError('billing_unavailable', 'Payment cancelled by user.', 400);
      }

      if (order.status === 'verified') {
        return {
          isPro: true,
          activePlanId: order.planId,
          expiresAt: order.verifiedAt
            ? new Date(order.verifiedAt.getTime() + plan.durationDays * 86_400_000).toISOString()
            : null,
          source: order.provider,
          freeDiagnosticUsed: false,
        };
      }

      const merchantId = env.ZARINPAL_MERCHANT_ID.trim();
      let refId = `SANDBOX-${order.orderId.slice(0, 8)}`;
      if (order.provider === 'zarinpal' && merchantId.length > 0) {
        const host = env.ZARINPAL_SANDBOX
          ? 'https://sandbox.zarinpal.com'
          : 'https://payment.zarinpal.com';
        const res = await fetchFn(`${host}/pg/v4/payment/verify.json`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({
            merchant_id: merchantId,
            amount: order.amountMinor,
            authority,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          data?: { code?: number; ref_id?: number | string };
        };
        if (!res.ok || (json.data?.code !== 100 && json.data?.code !== 101)) {
          await updateOrderStatus(order.orderId, authority, 'failed', null, null);
          throw new WebBillingError('billing_unavailable', 'Zarinpal verification failed.', 502);
        }
        if (json.data?.ref_id !== undefined) {
          refId = String(json.data.ref_id);
        }
      }

      const now = new Date();
      await updateOrderStatus(order.orderId, authority, 'verified', refId, now);
      return grantProEntitlement({
        userId: order.userId ?? userId,
        deviceId: order.deviceId || deviceId,
        planId: order.planId,
        provider: order.provider,
        durationDays: plan.durationDays,
        acceptedDevicePolicyAt: order.acceptedDevicePolicyAt,
      });
    },

    async createGlbCheckout({ userId, deviceId, planId, returnUrl }) {
      const plan = WEB_BILLING_PLANS[planId];
      if (!plan) {
        throw new WebBillingError('validation_error', `Unknown planId: ${planId}`, 400);
      }
      const now = new Date();
      const stripeKey = env.STRIPE_SECRET_KEY.trim();

      if (stripeKey.length > 0) {
        const form = new URLSearchParams();
        form.set('mode', 'payment');
        form.set(
          'success_url',
          appendQueryParams(returnUrl, { session_id: '{CHECKOUT_SESSION_ID}' }),
        );
        form.set('cancel_url', appendQueryParams(returnUrl, { canceled: 'true' }));
        form.set('line_items[0][quantity]', '1');
        form.set('line_items[0][price_data][currency]', 'usd');
        form.set('line_items[0][price_data][unit_amount]', String(plan.usdMinorCents));
        form.set('line_items[0][price_data][product_data][name]', plan.descriptionEn);
        if (userId) form.set('client_reference_id', userId);

        const res = await fetchFn('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${stripeKey}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        });
        const json = (await res.json().catch(() => ({}))) as { id?: string; url?: string };
        if (!res.ok || !json.id || !json.url) {
          throw new WebBillingError('billing_unavailable', 'Stripe checkout creation failed.', 502);
        }

        await saveOrder({
          orderId: randomUUID(),
          userId,
          deviceId,
          edition: 'glb',
          provider: 'stripe',
          planId,
          currency: 'USD',
          amountMinor: plan.usdMinorCents,
          authority: json.id,
          refId: null,
          status: 'pending',
          acceptedDevicePolicyAt: now,
          createdAt: now,
          verifiedAt: null,
        });
        return { redirectUrl: json.url };
      }

      if (!(env.NODE_ENV !== 'production' && env.ALLOW_DEV_AUTH_PROVIDERS)) {
        throw new WebBillingError(
          'provider_not_configured',
          'Stripe/RevenueCat Web billing is not configured.',
          503,
        );
      }

      const sandboxSessionId = `cs_sandbox_${randomUUID().replace(/-/g, '')}`;
      await saveOrder({
        orderId: randomUUID(),
        userId,
        deviceId,
        edition: 'glb',
        provider: 'dev_sandbox',
        planId,
        currency: 'USD',
        amountMinor: plan.usdMinorCents,
        authority: sandboxSessionId,
        refId: null,
        status: 'pending',
        acceptedDevicePolicyAt: now,
        createdAt: now,
        verifiedAt: null,
      });

      const redirectUrl = appendQueryParams(returnUrl, {
        session_id: sandboxSessionId,
      });
      return { redirectUrl };
    },

    async verifyGlbCheckout({ userId, deviceId, sessionId }) {
      const order = await findOrderByAuthority(sessionId);
      if (order?.edition !== 'glb') {
        throw new WebBillingError('not_found', 'Checkout session not found.', 404);
      }
      if (order.userId && userId && order.userId !== userId) {
        throw new WebBillingError(
          'not_found',
          'Checkout session belongs to a different account.',
          404,
        );
      }
      const plan = WEB_BILLING_PLANS[order.planId];
      if (!plan) {
        throw new WebBillingError('validation_error', 'Order references an unknown plan.', 400);
      }

      if (order.status === 'verified') {
        return {
          isPro: true,
          activePlanId: order.planId,
          expiresAt: order.verifiedAt
            ? new Date(order.verifiedAt.getTime() + plan.durationDays * 86_400_000).toISOString()
            : null,
          source: order.provider,
          freeDiagnosticUsed: false,
        };
      }

      const stripeKey = env.STRIPE_SECRET_KEY.trim();
      let refId = `SANDBOX-${order.orderId.slice(0, 8)}`;
      if (order.provider === 'stripe' && stripeKey.length > 0) {
        const res = await fetchFn(
          `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
          { headers: { authorization: `Bearer ${stripeKey}` } },
        );
        const json = (await res.json().catch(() => ({}))) as {
          payment_status?: string;
          payment_intent?: string;
        };
        if (!res.ok || json.payment_status !== 'paid') {
          throw new WebBillingError(
            'billing_unavailable',
            'Stripe checkout session is not marked paid yet.',
            400,
          );
        }
        if (json.payment_intent) refId = json.payment_intent;
      }

      const now = new Date();
      await updateOrderStatus(order.orderId, sessionId, 'verified', refId, now);
      return grantProEntitlement({
        userId: order.userId ?? userId,
        deviceId: order.deviceId || deviceId,
        planId: order.planId,
        provider: order.provider,
        durationDays: plan.durationDays,
        acceptedDevicePolicyAt: order.acceptedDevicePolicyAt,
      });
    },

    async createGlbPortal({ returnUrl }) {
      const fallbackUrl = returnUrl || `${env.WEB_PUBLIC_BASE_URL.replace(/\/$/, '')}/app/settings`;
      if (env.NODE_ENV !== 'production' && env.ALLOW_DEV_AUTH_PROVIDERS) {
        return { portalUrl: fallbackUrl };
      }
      if (!env.STRIPE_SECRET_KEY.trim()) {
        throw new WebBillingError(
          'provider_not_configured',
          'Billing customer portal is not configured.',
          503,
        );
      }
      return { portalUrl: fallbackUrl };
    },
  };
}

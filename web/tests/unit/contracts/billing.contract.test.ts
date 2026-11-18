import { describe, expect, it } from 'vitest';
import { FakeBillingAdapter } from '@/adapters/fakes/fake-billing.adapter';
import { StripeBillingAdapter } from '@/adapters/glb/stripe-billing.adapter';
import { ApiClient } from '@/adapters/http/api-client';
import { ZarinpalBillingAdapter } from '@/adapters/irn/zarinpal-billing.adapter';
import type { IBillingGateway, StartCheckoutInput } from '@/gateways/billing.gateway';

interface BillingHarness {
  readonly gateway: IBillingGateway;
  readonly expectedCurrency: 'USD' | 'IRR';
  readonly validCallbackParams: URLSearchParams;
  readonly cancelledCallbackParams: URLSearchParams;
}

function createBillingMockFetch(edition: 'glb' | 'irn'): typeof fetch {
  let isPro = false;
  let activePlanId: string | null = null;

  return async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString();
    const path = new URL(url, 'https://api.example.test').pathname;
    const body =
      typeof init?.body === 'string' && init.body.length > 0
        ? (JSON.parse(init.body) as Record<string, unknown>)
        : {};

    if (path === '/v1/quota/me') {
      return new Response(
        JSON.stringify({
          isPro,
          freeDiagnosticUsed: false,
          activePlanId,
          source: isPro ? (edition === 'irn' ? 'zarinpal' : 'stripe') : 'none',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (path === '/v1/billing/glb/checkout') {
      activePlanId = String(body['planId']);
      return new Response(
        JSON.stringify({ redirectUrl: 'https://checkout.stripe.test/c/cs_test_123' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (path === '/v1/billing/glb/verify') {
      isPro = true;
      return new Response(
        JSON.stringify({
          isPro: true,
          activePlanId: activePlanId ?? 'mockza_pro_monthly',
          expiresAt: null,
          source: 'stripe',
          freeDiagnosticUsed: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (path === '/v1/billing/glb/portal') {
      return new Response(
        JSON.stringify({ portalUrl: 'https://billing.stripe.test/p/session_123' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (path === '/v1/billing/zarinpal/request') {
      activePlanId = String(body['planId']);
      return new Response(
        JSON.stringify({ redirectUrl: 'https://sandbox.zarinpal.test/pg/StartPay/A00001' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (path === '/v1/billing/zarinpal/verify') {
      isPro = true;
      return new Response(
        JSON.stringify({
          isPro: true,
          activePlanId: activePlanId ?? 'mockza_pro_monthly',
          expiresAt: null,
          source: 'zarinpal',
          freeDiagnosticUsed: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({ code: 'not_found', message: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}

function runBillingContractSuite(name: string, createHarness: () => BillingHarness) {
  describe(`IBillingGateway LSP contract: ${name}`, () => {
    it('exposes currency-appropriate plans and integer minor/Rial amounts', async () => {
      const h = createHarness();
      expect(h.gateway.currencyKind).toBe(h.expectedCurrency);

      const snapshotRes = await h.gateway.getPlansAndEntitlement();
      expect(snapshotRes.ok).toBe(true);
      if (snapshotRes.ok) {
        expect(snapshotRes.value.currencyKind).toBe(h.expectedCurrency);
        expect(snapshotRes.value.plans).toHaveLength(3);
        expect(snapshotRes.value.plans.map((p) => p.planId)).toEqual([
          'mockza_cram_weekly',
          'mockza_pro_monthly',
          'mockza_quarterly',
        ]);
        for (const plan of snapshotRes.value.plans) {
          expect(plan.currencyKind).toBe(h.expectedCurrency);
          expect(Number.isInteger(plan.amountMinor)).toBe(true);
          expect(plan.amountMinor).toBeGreaterThan(0);
        }
      }
    });

    it('rejects checkout unless acceptedSingleDevicePerSlotTos === true', async () => {
      const h = createHarness();
      const missingTos = await h.gateway.startCheckout({
        planId: 'mockza_pro_monthly',
        acceptedSingleDevicePerSlotTos: false as unknown as true,
        returnUrl: 'https://app.mockza.test/app/paywall',
      } satisfies StartCheckoutInput);

      expect(missingTos.ok).toBe(false);
      if (!missingTos.ok) {
        expect(missingTos.error.kind).toBe('billing');
        if (missingTos.error.kind === 'billing') {
          expect(missingTos.error.code).toBe('TOS_REQUIRED');
        }
      }
    });

    it('completes checkout -> verifyCallback lifecycle and detects cancellation', async () => {
      const h = createHarness();
      const checkoutRes = await h.gateway.startCheckout({
        planId: 'mockza_pro_monthly',
        acceptedSingleDevicePerSlotTos: true,
        returnUrl: 'https://app.mockza.test/app/paywall',
      });
      expect(checkoutRes.ok).toBe(true);
      if (checkoutRes.ok) {
        expect(
          'redirectUrl' in checkoutRes.value || 'activatedSession' in checkoutRes.value,
        ).toBe(true);
      }

      const cancelRes = await h.gateway.verifyCallback(h.cancelledCallbackParams);
      expect(cancelRes.ok).toBe(false);
      if (!cancelRes.ok && cancelRes.error.kind === 'billing') {
        expect(cancelRes.error.code).toBe('CHECKOUT_CANCELLED');
      }

      const verifyRes = await h.gateway.verifyCallback(h.validCallbackParams);
      expect(verifyRes.ok).toBe(true);
      if (verifyRes.ok) {
        expect(verifyRes.value.isPro).toBe(true);
      }

      if (h.expectedCurrency === 'IRR') {
        expect(h.gateway.openCustomerPortal).toBeUndefined();
      } else {
        expect(h.gateway.openCustomerPortal).toBeDefined();
        if (h.gateway.openCustomerPortal) {
          const portal = await h.gateway.openCustomerPortal();
          expect(portal.ok).toBe(true);
          if (portal.ok) {
            expect(portal.value.portalUrl).toContain('http');
          }
        }
      }
    });
  });
}

runBillingContractSuite('FakeBillingAdapter (USD)', () => ({
  gateway: new FakeBillingAdapter({ currencyKind: 'USD' }),
  expectedCurrency: 'USD',
  validCallbackParams: new URLSearchParams('session_id=fake-cs-001'),
  cancelledCallbackParams: new URLSearchParams('canceled=true'),
}));

runBillingContractSuite('FakeBillingAdapter (IRR)', () => ({
  gateway: new FakeBillingAdapter({ currencyKind: 'IRR' }),
  expectedCurrency: 'IRR',
  validCallbackParams: new URLSearchParams('Authority=A00001&Status=OK'),
  cancelledCallbackParams: new URLSearchParams('Authority=A00001&Status=NOK'),
}));

runBillingContractSuite('StripeBillingAdapter (GLB HTTP)', () => ({
  gateway: new StripeBillingAdapter({
    apiClient: new ApiClient({
      apiBaseUrl: 'https://api.mockza.com',
      edition: 'glb',
      fetchFn: createBillingMockFetch('glb'),
      readAccessToken: () => 'test-token',
    }),
  }),
  expectedCurrency: 'USD',
  validCallbackParams: new URLSearchParams('session_id=cs_test_123'),
  cancelledCallbackParams: new URLSearchParams('canceled=true'),
}));

runBillingContractSuite('ZarinpalBillingAdapter (IRN HTTP)', () => ({
  gateway: new ZarinpalBillingAdapter({
    apiClient: new ApiClient({
      apiBaseUrl: 'https://api.sanjia.ir',
      edition: 'irn',
      fetchFn: createBillingMockFetch('irn'),
      readAccessToken: () => 'test-token',
    }),
  }),
  expectedCurrency: 'IRR',
  validCallbackParams: new URLSearchParams('Authority=A00001&Status=OK'),
  cancelledCallbackParams: new URLSearchParams('Authority=A00001&Status=NOK'),
}));

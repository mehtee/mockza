import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import {
  BillingCheckoutOutcomeSchema,
  CustomerPortalResponseSchema,
  EntitlementSnapshotSchema,
  GlbCheckoutRequestSchema,
  GlbVerifyRequestSchema,
  ZarinpalRequestSchema,
  ZarinpalVerifySchema,
} from '@mockza/contracts';
import type { MockzaDb } from '@mockza/db';
import type { Context } from 'hono';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';
import type { SessionManager } from '../services/session-manager.js';
import {
  createWebBillingService,
  WebBillingError,
  type WebBillingService,
} from '../services/web-billing.js';

export function registerWebBillingRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
  sessionManager?: SessionManager,
  serviceOverride?: WebBillingService,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db, sessionManager);
  const service =
    serviceOverride ??
    createWebBillingService(env, db, {
      onMemoryEntitlementGranted: ({ userId, deviceId, planId, expiresAt }) => {
        sessionManager?.grantMemoryProEntitlement?.({
          userId,
          deviceId,
          planId,
          expiresAt,
          source: env.EDITION === 'irn' ? 'zarinpal' : 'stripe',
        });
      },
    });

  app.use('/v1/billing/zarinpal/*', async (c, next) => {
    if (env.EDITION !== 'irn') {
      return c.json(
        {
          code: 'edition_forbidden',
          message: 'Zarinpal billing is only available in the IRN (Sanjia) edition.',
          requestId: c.get('requestId'),
        },
        403,
      );
    }
    await next();
  });
  app.use('/v1/billing/glb/*', async (c, next) => {
    if (env.EDITION !== 'glb') {
      return c.json(
        {
          code: 'edition_forbidden',
          message: 'GLB Stripe/RevenueCat checkout is only available in the GLB edition.',
          requestId: c.get('requestId'),
        },
        403,
      );
    }
    await next();
  });
  app.use('/v1/billing/zarinpal/*', authMiddleware);
  app.use('/v1/billing/glb/*', authMiddleware);

  function mapBillingError(c: Context<{ Variables: RequestVariables }>, err: unknown): Response {
    if (err instanceof WebBillingError) {
      return c.json(
        {
          code: err.code,
          message: err.message,
          requestId: c.get('requestId'),
        },
        err.status,
      );
    }
    throw err;
  }

  function requireCallerContext(
    c: Context<{ Variables: RequestVariables }>,
  ): { deviceId: string; userId: string | null } | Response {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Device authentication required.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }
    return {
      deviceId,
      userId: c.get('userId') ?? null,
    };
  }

  // POST /v1/billing/zarinpal/request (IRN edition only)
  app.post('/v1/billing/zarinpal/request', async (c) => {
    if (env.EDITION !== 'irn') {
      return c.json(
        {
          code: 'edition_forbidden',
          message: 'Zarinpal checkout is only available in the IRN (Sanjia) edition.',
          requestId: c.get('requestId'),
        },
        403,
      );
    }
    const caller = requireCallerContext(c);
    if (caller instanceof Response) return caller;

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json(
        {
          code: 'validation_error',
          message: 'Valid JSON Zarinpal checkout payload required.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const parsed = ZarinpalRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        {
          code: 'validation_error',
          message:
            'Accept the 1 Phone + 1 Desktop Web slot policy and pass valid planId, integer amountRial, and returnUrl.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    try {
      const outcome = await service.requestZarinpal({
        userId: caller.userId,
        deviceId: caller.deviceId,
        planId: parsed.data.planId,
        amountRial: parsed.data.amountRial,
        returnUrl: parsed.data.returnUrl,
      });
      return c.json(BillingCheckoutOutcomeSchema.parse(outcome), 200);
    } catch (err) {
      return mapBillingError(c, err);
    }
  });

  // POST /v1/billing/zarinpal/verify (IRN edition only)
  app.post('/v1/billing/zarinpal/verify', async (c) => {
    if (env.EDITION !== 'irn') {
      return c.json(
        {
          code: 'edition_forbidden',
          message: 'Zarinpal verification is only available in the IRN (Sanjia) edition.',
          requestId: c.get('requestId'),
        },
        403,
      );
    }
    const caller = requireCallerContext(c);
    if (caller instanceof Response) return caller;

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json(
        {
          code: 'validation_error',
          message: 'Valid JSON Zarinpal verification payload required.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const parsed = ZarinpalVerifySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        {
          code: 'validation_error',
          message: 'Invalid Zarinpal authority or status.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    try {
      const snapshot = await service.verifyZarinpal({
        userId: caller.userId,
        deviceId: caller.deviceId,
        authority: parsed.data.authority,
        status: parsed.data.status,
      });
      return c.json(EntitlementSnapshotSchema.parse(snapshot), 200);
    } catch (err) {
      return mapBillingError(c, err);
    }
  });

  // POST /v1/billing/glb/checkout (GLB edition only)
  app.post('/v1/billing/glb/checkout', async (c) => {
    if (env.EDITION !== 'glb') {
      return c.json(
        {
          code: 'edition_forbidden',
          message: 'GLB Stripe/RevenueCat checkout is only available in the GLB edition.',
          requestId: c.get('requestId'),
        },
        403,
      );
    }
    const caller = requireCallerContext(c);
    if (caller instanceof Response) return caller;

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json(
        {
          code: 'validation_error',
          message: 'Valid JSON GLB checkout payload required.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const parsed = GlbCheckoutRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        {
          code: 'validation_error',
          message:
            'Accept the 1 Phone + 1 Desktop Web slot policy and pass valid planId and returnUrl.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    try {
      const outcome = await service.createGlbCheckout({
        userId: caller.userId,
        deviceId: caller.deviceId,
        planId: parsed.data.planId,
        returnUrl: parsed.data.returnUrl,
      });
      return c.json(BillingCheckoutOutcomeSchema.parse(outcome), 200);
    } catch (err) {
      return mapBillingError(c, err);
    }
  });

  // POST /v1/billing/glb/verify (GLB edition only)
  app.post('/v1/billing/glb/verify', async (c) => {
    if (env.EDITION !== 'glb') {
      return c.json(
        {
          code: 'edition_forbidden',
          message: 'GLB checkout verification is only available in the GLB edition.',
          requestId: c.get('requestId'),
        },
        403,
      );
    }
    const caller = requireCallerContext(c);
    if (caller instanceof Response) return caller;

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json(
        {
          code: 'validation_error',
          message: 'Valid JSON verification payload required.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const parsed = GlbVerifyRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        {
          code: 'validation_error',
          message: 'Missing checkout sessionId.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    try {
      const snapshot = await service.verifyGlbCheckout({
        userId: caller.userId,
        deviceId: caller.deviceId,
        sessionId: parsed.data.sessionId,
      });
      return c.json(EntitlementSnapshotSchema.parse(snapshot), 200);
    } catch (err) {
      return mapBillingError(c, err);
    }
  });

  // POST /v1/billing/glb/portal (GLB edition only)
  app.post('/v1/billing/glb/portal', async (c) => {
    if (env.EDITION !== 'glb') {
      return c.json(
        {
          code: 'edition_forbidden',
          message: 'Billing customer portal is only available in the GLB edition.',
          requestId: c.get('requestId'),
        },
        403,
      );
    }
    const caller = requireCallerContext(c);
    if (caller instanceof Response) return caller;

    try {
      const outcome = await service.createGlbPortal({ userId: caller.userId });
      return c.json(CustomerPortalResponseSchema.parse(outcome), 200);
    } catch (err) {
      return mapBillingError(c, err);
    }
  });
}

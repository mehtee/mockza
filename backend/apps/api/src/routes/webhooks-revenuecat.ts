import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import { devices, entitlements, type MockzaDb, webhookEvents } from '@mockza/db';
import { eq } from 'drizzle-orm';
import type { RequestVariables } from '../middleware/request-id.js';

export function registerBillingWebhookRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: Pick<AppEnv, 'EDITION' | 'REVENUECAT_WEBHOOK_SECRET'>,
  db?: MockzaDb,
): void {
  app.post('/v1/webhooks/revenuecat', async (c) => {
    if (env.EDITION !== 'glb') {
      return c.json(
        {
          code: 'edition_mismatch',
          message: 'RevenueCat webhook disabled for irn edition.',
          requestId: c.get('requestId'),
        },
        403,
      );
    }

    const auth = c.req.header('authorization');
    if (env.REVENUECAT_WEBHOOK_SECRET && auth !== `Bearer ${env.REVENUECAT_WEBHOOK_SECRET}`) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Invalid webhook secret.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    let payload: Record<string, any>;
    try {
      payload = await c.req.json();
    } catch (_e) {
      return c.json({ code: 'validation_error', message: 'Invalid JSON payload' }, 400);
    }

    const event = payload['event'] ?? payload;
    const eventId = String(event['id'] ?? event['transaction_id'] ?? Date.now());
    const eventType = String(event['type'] ?? 'UNKNOWN');
    const appUserId = String(event['app_user_id'] ?? '');
    const productId = event['product_id'] ? String(event['product_id']) : undefined;
    const expirationAtMs = event['expiration_at_ms']
      ? Number(event['expiration_at_ms'])
      : undefined;
    const graceUntilMs = event['grace_period_expires_date_ms']
      ? Number(event['grace_period_expires_date_ms'])
      : undefined;

    if (db && eventId) {
      // 1. Deduplicate event
      const existing = await db
        .select({ eventId: webhookEvents.eventId })
        .from(webhookEvents)
        .where(eq(webhookEvents.eventId, eventId))
        .limit(1);

      if (existing[0]) {
        return c.json({ received: true, deduplicated: true }, 200);
      }

      await db
        .insert(webhookEvents)
        .values({
          eventId,
          provider: 'revenuecat',
          eventType,
          payloadJson: payload,
        })
        .onConflictDoNothing();

      // 2. Resolve target device/user and update entitlements
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(appUserId)) {
        let isPro = true;
        const now = new Date();
        const expiresAt = expirationAtMs ? new Date(expirationAtMs) : null;
        const graceUntil = graceUntilMs ? new Date(graceUntilMs) : null;

        if (eventType === 'EXPIRATION' || (expiresAt && expiresAt < now)) {
          isPro = false;
        }

        // Check if appUserId is a deviceId or linked user
        const dev = await db
          .select({ deviceId: devices.deviceId, linkedUserId: devices.linkedUserId })
          .from(devices)
          .where(eq(devices.deviceId, appUserId))
          .limit(1);

        if (dev[0]) {
          await db
            .insert(entitlements)
            .values({
              deviceId: dev[0].deviceId,
              userId: dev[0].linkedUserId,
              provider: 'revenuecat',
              originalAppUserId: appUserId,
              productId,
              isPro,
              expiresAt,
              graceUntil,
              lastVerifiedAt: now,
            })
            .onConflictDoUpdate({
              target: entitlements.deviceId,
              set: {
                isPro,
                productId: productId ?? entitlements.productId,
                expiresAt,
                graceUntil,
                lastVerifiedAt: now,
                updatedAt: now,
              },
            });
        }
      }
    }

    return c.json({ received: true }, 200);
  });
}

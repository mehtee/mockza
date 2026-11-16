import { timingSafeEqual } from 'node:crypto';
import { type OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import { devices, entitlements, type MockzaDb, users, webhookEvents } from '@mockza/db';
import { eq, inArray, or } from 'drizzle-orm';
import type { RequestVariables } from '../middleware/request-id.js';

const SUPPORTED_PRO_PRODUCTS = new Set<string>([
  'mockza_cram_weekly',
  'mockza_pro_monthly',
  'mockza_quarterly',
]);

const GRANT_EVENT_TYPES = new Set<string>([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TRANSFER',
]);

const REVOKE_EVENT_TYPES = new Set<string>(['EXPIRATION', 'REFUND', 'REVOKE']);

const RevenueCatEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  app_user_id: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  transferred_to: z.array(z.string()).optional(),
  product_id: z.string().optional(),
  entitlement_ids: z.array(z.string()).optional(),
  expiration_at_ms: z.number().finite().nullable().optional(),
  grace_period_expires_date_ms: z.number().finite().nullable().optional(),
  event_timestamp_ms: z.number().finite().optional(),
});

function constantTimeBearerMatch(header: string | undefined, expectedSecret: string): boolean {
  if (!header || !expectedSecret) return false;
  const expected = `Bearer ${expectedSecret}`;
  const a = Buffer.from(header, 'utf-8');
  const b = Buffer.from(expected, 'utf-8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerBillingWebhookRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: Pick<AppEnv, 'EDITION' | 'REVENUECAT_WEBHOOK_SECRET'> & {
    BILLING_WEBHOOK_DISABLED?: boolean;
  },
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

    if (env.BILLING_WEBHOOK_DISABLED || !env.REVENUECAT_WEBHOOK_SECRET) {
      return c.json(
        {
          code: 'billing_unavailable',
          message: 'Billing webhook is disabled or unconfigured.',
          requestId: c.get('requestId'),
        },
        503,
      );
    }

    const auth = c.req.header('authorization');
    if (!constantTimeBearerMatch(auth, env.REVENUECAT_WEBHOOK_SECRET)) {
      return c.json(
        {
          code: 'unauthorized',
          message: 'Invalid webhook secret.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    let rawPayload: unknown;
    try {
      rawPayload = await c.req.json();
    } catch {
      return c.json(
        {
          code: 'validation_error',
          message: 'Invalid JSON payload',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const candidate =
      typeof rawPayload === 'object' &&
      rawPayload !== null &&
      'event' in rawPayload &&
      typeof (rawPayload as { event?: unknown }).event === 'object'
        ? (rawPayload as { event: unknown }).event
        : rawPayload;

    const parsedEvent = RevenueCatEventSchema.safeParse(candidate);
    if (!parsedEvent.success) {
      return c.json(
        {
          code: 'validation_error',
          message: 'Invalid RevenueCat webhook event payload.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const event = parsedEvent.data;
    const now = new Date();
    const eventTime = event.event_timestamp_ms ? new Date(event.event_timestamp_ms) : now;
    const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
    const graceUntil = event.grace_period_expires_date_ms
      ? new Date(event.grace_period_expires_date_ms)
      : null;

    if (db) {
      const outcome = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(webhookEvents)
          .values({
            eventId: event.id,
            provider: 'revenuecat',
            eventType: event.type,
            payloadJson: rawPayload as Record<string, unknown>,
          })
          .onConflictDoNothing({ target: webhookEvents.eventId })
          .returning({ eventId: webhookEvents.eventId });

        if (inserted.length === 0) {
          return { deduplicated: true as const };
        }

        const candidateIds = new Set<string>();
        for (const id of [
          event.app_user_id,
          ...(event.transferred_to ?? []),
          ...(event.aliases ?? []),
        ]) {
          if (id && UUID_REGEX.test(id)) {
            candidateIds.add(id);
          }
        }

        if (candidateIds.size === 0) {
          return { deduplicated: false as const };
        }

        const idList = Array.from(candidateIds);
        const matchingUsers = await tx
          .select({ userId: users.userId })
          .from(users)
          .where(inArray(users.userId, idList));
        const userIds = matchingUsers.map((u) => u.userId);

        const matchingDevices = await tx
          .select({
            deviceId: devices.deviceId,
            linkedUserId: devices.linkedUserId,
          })
          .from(devices)
          .where(
            userIds.length > 0
              ? or(inArray(devices.deviceId, idList), inArray(devices.linkedUserId, userIds))
              : inArray(devices.deviceId, idList),
          );

        if (matchingDevices.length === 0) {
          return { deduplicated: false as const };
        }

        const productValid = !event.product_id || SUPPORTED_PRO_PRODUCTS.has(event.product_id);
        const entitlementValid =
          !event.entitlement_ids ||
          event.entitlement_ids.length === 0 ||
          event.entitlement_ids.includes('pro');

        let nextIsPro: boolean | null = null;
        if (REVOKE_EVENT_TYPES.has(event.type)) {
          nextIsPro = false;
        } else if (event.type === 'BILLING_ISSUE') {
          nextIsPro = Boolean(graceUntil && graceUntil > now);
        } else if (event.type === 'CANCELLATION') {
          nextIsPro = Boolean(expiresAt && expiresAt > now && productValid && entitlementValid);
        } else if (GRANT_EVENT_TYPES.has(event.type)) {
          nextIsPro = Boolean(productValid && entitlementValid && (!expiresAt || expiresAt > now));
        }

        if (nextIsPro === null) {
          // Informational / non-entitlement event (e.g. TEST, SUBSCRIBER_ALIAS)
          return { deduplicated: false as const };
        }

        for (const target of matchingDevices) {
          const existingEnt = await tx
            .select({ lastEventAt: entitlements.lastEventAt })
            .from(entitlements)
            .where(eq(entitlements.deviceId, target.deviceId))
            .limit(1);

          const prevEventAt = existingEnt[0]?.lastEventAt;
          if (prevEventAt && prevEventAt > eventTime) {
            // Out-of-order stale event; ignore state overwrite while retaining receipt.
            continue;
          }

          await tx
            .insert(entitlements)
            .values({
              deviceId: target.deviceId,
              userId: target.linkedUserId ?? userIds[0] ?? null,
              provider: 'revenuecat',
              originalAppUserId: event.app_user_id ?? target.deviceId,
              productId: event.product_id,
              isPro: nextIsPro,
              expiresAt,
              graceUntil,
              lastVerifiedAt: now,
              lastEventAt: eventTime,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: entitlements.deviceId,
              set: {
                userId: target.linkedUserId ?? userIds[0] ?? entitlements.userId,
                originalAppUserId: event.app_user_id ?? entitlements.originalAppUserId,
                productId: event.product_id ?? entitlements.productId,
                isPro: nextIsPro,
                expiresAt,
                graceUntil,
                lastVerifiedAt: now,
                lastEventAt: eventTime,
                updatedAt: now,
              },
            });
        }

        return { deduplicated: false as const };
      });

      if (outcome.deduplicated) {
        return c.json({ received: true, deduplicated: true }, 200);
      }
    }

    return c.json({ received: true }, 200);
  });
}

import { timingSafeEqual } from 'node:crypto';
import { type OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import { devices, entitlements, type MockzaDb, users, webhookEvents } from '@mockza/db';
import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
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

export const RevenueCatEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  app_user_id: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  transferred_from: z.array(z.string()).optional(),
  transferred_to: z.array(z.string()).optional(),
  product_id: z.string().optional(),
  entitlement_ids: z.array(z.string()).optional(),
  expiration_at_ms: z.number().finite().nullable().optional(),
  grace_period_expires_date_ms: z.number().finite().nullable().optional(),
  event_timestamp_ms: z.number().finite().optional(),
});

export type RevenueCatEvent = z.infer<typeof RevenueCatEventSchema>;

function constantTimeBearerMatch(header: string | undefined, expectedSecret: string): boolean {
  if (!header || !expectedSecret) return false;
  const expected = `Bearer ${expectedSecret}`;
  const a = Buffer.from(header, 'utf-8');
  const b = Buffer.from(expected, 'utf-8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DbTx = Parameters<Parameters<MockzaDb['transaction']>[0]>[0] | MockzaDb;

async function findMatchingDevicesForIds(
  tx: DbTx,
  rawIds: Array<string | undefined>,
): Promise<Array<{ deviceId: string; linkedUserId: string | null }>> {
  const validIds = Array.from(
    new Set(rawIds.filter((id): id is string => Boolean(id && UUID_REGEX.test(id)))),
  );
  if (validIds.length === 0) return [];

  const matchingUsers = await tx
    .select({ userId: users.userId })
    .from(users)
    .where(inArray(users.userId, validIds));
  const userIds = matchingUsers.map((u) => u.userId);

  return tx
    .select({
      deviceId: devices.deviceId,
      linkedUserId: devices.linkedUserId,
    })
    .from(devices)
    .where(
      userIds.length > 0
        ? or(inArray(devices.deviceId, validIds), inArray(devices.linkedUserId, userIds))
        : inArray(devices.deviceId, validIds),
    );
}

async function atomicConditionalUpsertEntitlement(params: {
  tx: DbTx;
  deviceId: string;
  userId: string | null;
  originalAppUserId: string;
  productId: string | null;
  isPro: boolean;
  expiresAt: Date | null;
  graceUntil: Date | null;
  eventTime: Date;
  now: Date;
}): Promise<void> {
  // Single-statement atomic PostgreSQL ordering fence: stale concurrent events are ignored at write time (`RR-04`).
  await params.tx
    .insert(entitlements)
    .values({
      deviceId: params.deviceId,
      userId: params.userId,
      provider: 'revenuecat',
      originalAppUserId: params.originalAppUserId,
      productId: params.productId,
      isPro: params.isPro,
      expiresAt: params.expiresAt,
      graceUntil: params.graceUntil,
      lastVerifiedAt: params.now,
      lastEventAt: params.eventTime,
      updatedAt: params.now,
    })
    .onConflictDoUpdate({
      target: entitlements.deviceId,
      set: {
        userId: params.userId ?? entitlements.userId,
        originalAppUserId: params.originalAppUserId,
        productId: params.productId ?? entitlements.productId,
        isPro: params.isPro,
        expiresAt: params.expiresAt,
        graceUntil: params.graceUntil,
        lastVerifiedAt: params.now,
        lastEventAt: params.eventTime,
        updatedAt: params.now,
      },
      setWhere: or(
        isNull(entitlements.lastEventAt),
        lte(entitlements.lastEventAt, params.eventTime),
      ),
    });
}

export async function applyRevenueCatEventTx(params: {
  tx: DbTx;
  event: RevenueCatEvent;
  now: Date;
}): Promise<{ matched: boolean; primaryIdentity: string | null }> {
  const { tx, event, now } = params;
  const eventTime = event.event_timestamp_ms ? new Date(event.event_timestamp_ms) : now;
  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;
  const graceUntil = event.grace_period_expires_date_ms
    ? new Date(event.grace_period_expires_date_ms)
    : null;

  const isTransfer = event.type === 'TRANSFER';
  const targetRawIds = isTransfer
    ? [...(event.transferred_to ?? []), ...(event.aliases ?? [])]
    : [event.app_user_id, ...(event.transferred_to ?? []), ...(event.aliases ?? [])];
  const primaryIdentity =
    targetRawIds.find((id): id is string => Boolean(id && UUID_REGEX.test(id))) ?? null;

  const hasKnownProduct = Boolean(event.product_id && SUPPORTED_PRO_PRODUCTS.has(event.product_id));
  const hasProEntitlement =
    Array.isArray(event.entitlement_ids) && event.entitlement_ids.includes('pro');
  const hasExplicitGrantAuthority = hasKnownProduct || hasProEntitlement;
  const productAllowed = !event.product_id || hasKnownProduct;
  const entitlementAllowed =
    !event.entitlement_ids || event.entitlement_ids.length === 0 || hasProEntitlement;
  const hasValidFutureExpiration = Boolean(expiresAt && expiresAt > now);

  let nextIsPro: boolean | null = null;
  if (REVOKE_EVENT_TYPES.has(event.type)) {
    nextIsPro = false;
  } else if (event.type === 'BILLING_ISSUE') {
    nextIsPro = Boolean(graceUntil && graceUntil > now);
  } else if (event.type === 'CANCELLATION') {
    nextIsPro = Boolean(productAllowed && entitlementAllowed && hasValidFutureExpiration);
  } else if (GRANT_EVENT_TYPES.has(event.type)) {
    // Reject empty/unbounded grant payloads lacking authoritative product/entitlement or expiration (`RR-04`).
    nextIsPro = Boolean(
      hasExplicitGrantAuthority && productAllowed && entitlementAllowed && hasValidFutureExpiration,
    );
  }

  if (nextIsPro === null) {
    return { matched: true, primaryIdentity };
  }

  if (isTransfer && event.transferred_from && event.transferred_from.length > 0) {
    const sourceDevices = await findMatchingDevicesForIds(tx, event.transferred_from);
    for (const src of sourceDevices) {
      await atomicConditionalUpsertEntitlement({
        tx,
        deviceId: src.deviceId,
        userId: src.linkedUserId,
        originalAppUserId: event.transferred_from[0] ?? src.deviceId,
        productId: event.product_id ?? null,
        isPro: false,
        expiresAt: null,
        graceUntil: null,
        eventTime,
        now,
      });
    }
  }

  const targetDevices = await findMatchingDevicesForIds(tx, targetRawIds);
  if (targetDevices.length === 0) {
    return { matched: false, primaryIdentity };
  }

  for (const target of targetDevices) {
    await atomicConditionalUpsertEntitlement({
      tx,
      deviceId: target.deviceId,
      userId: target.linkedUserId,
      originalAppUserId: event.app_user_id ?? primaryIdentity ?? target.deviceId,
      productId: event.product_id ?? null,
      isPro: nextIsPro,
      expiresAt,
      graceUntil,
      eventTime,
      now,
    });
  }

  return { matched: true, primaryIdentity };
}

/** Reconciles any webhook receipts received before [identityIds] registered or linked (`RR-04`). */
export async function reconcilePendingWebhooksForIdentities(
  db: MockzaDb,
  identityIds: string[],
): Promise<number> {
  const validIds = Array.from(new Set(identityIds.filter((id) => UUID_REGEX.test(id))));
  if (validIds.length === 0) return 0;

  const pending = await db
    .select()
    .from(webhookEvents)
    .where(
      and(
        eq(webhookEvents.status, 'pending_reconciliation'),
        inArray(webhookEvents.targetIdentity, validIds),
      ),
    );
  if (pending.length === 0) return 0;

  let reconciled = 0;
  const now = new Date();
  for (const row of pending) {
    const raw = row.payloadJson;
    const candidate =
      typeof raw === 'object' &&
      raw !== null &&
      'event' in raw &&
      typeof (raw as { event?: unknown }).event === 'object'
        ? (raw as { event: unknown }).event
        : raw;
    const parsed = RevenueCatEventSchema.safeParse(candidate);
    if (!parsed.success) continue;

    await db.transaction(async (tx) => {
      const res = await applyRevenueCatEventTx({ tx, event: parsed.data, now });
      if (res.matched) {
        await tx
          .update(webhookEvents)
          .set({ status: 'processed' })
          .where(eq(webhookEvents.eventId, row.eventId));
        reconciled += 1;
      }
    });
  }
  return reconciled;
}

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

    if (db) {
      const outcome = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(webhookEvents)
          .values({
            eventId: event.id,
            provider: 'revenuecat',
            eventType: event.type,
            status: 'processed',
            payloadJson: rawPayload as Record<string, unknown>,
          })
          .onConflictDoNothing({ target: webhookEvents.eventId })
          .returning({ eventId: webhookEvents.eventId });

        if (inserted.length === 0) {
          return { deduplicated: true as const };
        }

        const applied = await applyRevenueCatEventTx({ tx, event, now });
        if (!applied.matched) {
          // Retain unresolved receipt as pending_reconciliation for late registration/linking (`RR-04`).
          await tx
            .update(webhookEvents)
            .set({
              status: 'pending_reconciliation',
              targetIdentity: applied.primaryIdentity,
            })
            .where(eq(webhookEvents.eventId, event.id));
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

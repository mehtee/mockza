import { randomUUID } from 'node:crypto';
import {
  EntitlementRequiredDomainError,
  evaluateQuotaEligibility,
  QuotaExceededDomainError,
} from '@mockza/domain';
import { and, eq, or, sql } from 'drizzle-orm';
import type { MockzaDb } from './client.js';
import {
  dailyQuotaUsage,
  devices,
  entitlements,
  monthlyQuotaUsage,
  quotaReservations,
} from './schema.js';

export type DbOrTx = MockzaDb | Parameters<Parameters<MockzaDb['transaction']>[0]>[0];

export function getUtcDayString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getUtcMonthString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export async function getAccountQuotaStatus(params: {
  db: DbOrTx;
  accountKey: string;
  deviceId: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const utcDay = getUtcDayString(now);
  const utcMonth = getUtcMonthString(now);

  const isLinkedUser = params.accountKey !== params.deviceId;
  const deviceRows = await params.db
    .select({
      freeDiagnosticUsed: devices.freeDiagnosticUsed,
    })
    .from(devices)
    .where(
      isLinkedUser
        ? or(eq(devices.deviceId, params.deviceId), eq(devices.linkedUserId, params.accountKey))
        : eq(devices.deviceId, params.deviceId),
    );

  const freeDiagnosticUsed = deviceRows.some((r) => r.freeDiagnosticUsed);

  const entRows = await params.db
    .select({
      isPro: entitlements.isPro,
      expiresAt: entitlements.expiresAt,
      graceUntil: entitlements.graceUntil,
    })
    .from(entitlements)
    .where(
      isLinkedUser
        ? or(eq(entitlements.deviceId, params.deviceId), eq(entitlements.userId, params.accountKey))
        : eq(entitlements.deviceId, params.deviceId),
    );

  const isPro = entRows.some(
    (e) =>
      e.isPro && (!e.expiresAt || e.expiresAt > now || Boolean(e.graceUntil && e.graceUntil > now)),
  );

  const dailyKey = `${params.accountKey}:${utcDay}`;
  const dailyRows = await params.db
    .select({
      speakingUsed: dailyQuotaUsage.speakingUsed,
      writingUsed: dailyQuotaUsage.writingUsed,
    })
    .from(dailyQuotaUsage)
    .where(eq(dailyQuotaUsage.counterKey, dailyKey))
    .limit(1);

  const speakingUsedToday = dailyRows[0]?.speakingUsed ?? 0;
  const writingUsedToday = dailyRows[0]?.writingUsed ?? 0;

  const monthlyKey = `${params.accountKey}:${utcMonth}`;
  const monthlyRows = await params.db
    .select({
      totalUsed: monthlyQuotaUsage.totalUsed,
    })
    .from(monthlyQuotaUsage)
    .where(eq(monthlyQuotaUsage.counterKey, monthlyKey))
    .limit(1);

  const monthlyUsed = monthlyRows[0]?.totalUsed ?? 0;

  return {
    isPro,
    freeDiagnosticUsed,
    speakingUsedToday,
    writingUsedToday,
    monthlyUsed,
    utcDay,
    utcMonth,
  };
}

async function runWithAccountLockAndTx<T>(
  db: DbOrTx,
  accountKey: string,
  fn: (tx: DbOrTx) => Promise<T>,
): Promise<T> {
  if ('transaction' in db && typeof db.transaction === 'function') {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${accountKey}))`);
      return await fn(tx);
    });
  }
  await db.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${accountKey}))`);
  return await fn(db);
}

/**
 * Serializes quota eligibility checks and reservations under a per-account PostgreSQL
 * advisory transaction lock so concurrent bursts never overspend limits (`TD-11`).
 */
export async function reserveQuotaAtomic(params: {
  db: DbOrTx;
  accountKey: string;
  deviceId: string;
  attemptId: string;
  skill: 'speaking' | 'writing';
  allowRetryRefunded?: boolean;
  now?: Date;
}): Promise<{ isDiagnostic: boolean }> {
  const now = params.now ?? new Date();
  const utcDay = getUtcDayString(now);
  const utcMonth = getUtcMonthString(now);

  return await runWithAccountLockAndTx(params.db, params.accountKey, async (tx) => {
    const existingRes = await tx
      .select({
        reservationId: quotaReservations.reservationId,
        status: quotaReservations.status,
        isDiagnostic: quotaReservations.isDiagnostic,
      })
      .from(quotaReservations)
      .where(eq(quotaReservations.attemptId, params.attemptId))
      .limit(1);

    const existing = existingRes[0];
    if (existing) {
      if (existing.status === 'reserved' || existing.status === 'committed') {
        return { isDiagnostic: existing.isDiagnostic };
      }
      if (existing.status === 'refunded' && !params.allowRetryRefunded) {
        return { isDiagnostic: existing.isDiagnostic };
      }
    }

    const status = await getAccountQuotaStatus({
      db: tx,
      accountKey: params.accountKey,
      deviceId: params.deviceId,
      now,
    });

    const eligibility = evaluateQuotaEligibility({
      isPro: status.isPro,
      freeDiagnosticUsed: status.freeDiagnosticUsed,
      speakingUsedToday: status.speakingUsedToday,
      writingUsedToday: status.writingUsedToday,
      monthlyUsed: status.monthlyUsed,
      skill: params.skill,
      now,
    });

    if (!eligibility.allowed) {
      if (eligibility.reason === 'diagnostic_already_used') {
        throw new EntitlementRequiredDomainError(
          'Free diagnostic evaluation has already been used. Please subscribe to Mockza Pro to continue.',
        );
      }
      throw new QuotaExceededDomainError(
        `Evaluation quota exceeded (${eligibility.reason ?? 'limit reached'}). Resets at ${eligibility.dailyResetAt}.`,
      );
    }

    const reservationId = existing?.reservationId ?? randomUUID();
    const dailyKey = `${params.accountKey}:${utcDay}`;
    const monthlyKey = `${params.accountKey}:${utcMonth}`;

    if (existing) {
      // Explicit retry re-reserving a previously refunded reservation.
      await tx
        .update(quotaReservations)
        .set({
          accountKey: params.accountKey,
          deviceId: params.deviceId,
          utcDay,
          utcMonth,
          status: 'reserved',
          isDiagnostic: eligibility.isDiagnostic,
          updatedAt: now,
        })
        .where(
          and(
            eq(quotaReservations.attemptId, params.attemptId),
            eq(quotaReservations.status, 'refunded'),
          ),
        );
    } else {
      await tx.insert(quotaReservations).values({
        reservationId,
        attemptId: params.attemptId,
        accountKey: params.accountKey,
        deviceId: params.deviceId,
        skill: params.skill,
        utcDay,
        utcMonth,
        status: 'reserved',
        isDiagnostic: eligibility.isDiagnostic,
      });
    }

    await tx
      .insert(dailyQuotaUsage)
      .values({
        counterKey: dailyKey,
        accountKey: params.accountKey,
        utcDay,
        speakingUsed: params.skill === 'speaking' ? 1 : 0,
        writingUsed: params.skill === 'writing' ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: dailyQuotaUsage.counterKey,
        set: {
          speakingUsed:
            params.skill === 'speaking'
              ? sql`${dailyQuotaUsage.speakingUsed} + 1`
              : dailyQuotaUsage.speakingUsed,
          writingUsed:
            params.skill === 'writing'
              ? sql`${dailyQuotaUsage.writingUsed} + 1`
              : dailyQuotaUsage.writingUsed,
          updatedAt: now,
        },
      });

    await tx
      .insert(monthlyQuotaUsage)
      .values({
        counterKey: monthlyKey,
        accountKey: params.accountKey,
        utcMonth,
        totalUsed: 1,
      })
      .onConflictDoUpdate({
        target: monthlyQuotaUsage.counterKey,
        set: {
          totalUsed: sql`${monthlyQuotaUsage.totalUsed} + 1`,
          updatedAt: now,
        },
      });

    if (eligibility.isDiagnostic) {
      await tx
        .update(devices)
        .set({ freeDiagnosticUsed: true })
        .where(eq(devices.deviceId, params.deviceId));
    }

    return { isDiagnostic: eligibility.isDiagnostic };
  });
}

/**
 * Transitions a `reserved` quota reservation to `committed` conditionally so a late commit
 * can never overwrite an already `refunded` reservation (`TD-12` / `TD-15`).
 */
export async function commitQuotaReservationAtomic(params: {
  db: DbOrTx;
  attemptId: string;
  now?: Date;
}): Promise<boolean> {
  const now = params.now ?? new Date();
  const updated = await params.db
    .update(quotaReservations)
    .set({ status: 'committed', updatedAt: now })
    .where(
      and(
        eq(quotaReservations.attemptId, params.attemptId),
        eq(quotaReservations.status, 'reserved'),
      ),
    )
    .returning({ reservationId: quotaReservations.reservationId });
  return updated.length === 1;
}

/**
 * Conditionally refunds one eligible reservation inside a transaction.
 * Concurrent refunds decrement shared counters at most once and restore
 * `freeDiagnosticUsed` accurately across both device-scoped and linked accounts (`TD-12`).
 */
export async function refundQuotaAtomic(params: {
  db: DbOrTx;
  attemptId: string;
  now?: Date;
}): Promise<boolean> {
  const now = params.now ?? new Date();

  const preRows = await params.db
    .select({ accountKey: quotaReservations.accountKey })
    .from(quotaReservations)
    .where(eq(quotaReservations.attemptId, params.attemptId))
    .limit(1);

  const accountKey = preRows[0]?.accountKey;
  if (!accountKey) return false;

  return await runWithAccountLockAndTx(params.db, accountKey, async (tx) => {
    const transitioned = await tx
      .update(quotaReservations)
      .set({ status: 'refunded', updatedAt: now })
      .where(
        and(
          eq(quotaReservations.attemptId, params.attemptId),
          eq(quotaReservations.status, 'reserved'),
        ),
      )
      .returning();

    const res = transitioned[0];
    if (!res) {
      return false;
    }

    const dailyKey = `${res.accountKey}:${res.utcDay}`;
    const monthlyKey = `${res.accountKey}:${res.utcMonth}`;

    await tx
      .update(dailyQuotaUsage)
      .set({
        speakingUsed:
          res.skill === 'speaking'
            ? sql`GREATEST(0, ${dailyQuotaUsage.speakingUsed} - 1)`
            : dailyQuotaUsage.speakingUsed,
        writingUsed:
          res.skill === 'writing'
            ? sql`GREATEST(0, ${dailyQuotaUsage.writingUsed} - 1)`
            : dailyQuotaUsage.writingUsed,
        updatedAt: now,
      })
      .where(eq(dailyQuotaUsage.counterKey, dailyKey));

    await tx
      .update(monthlyQuotaUsage)
      .set({
        totalUsed: sql`GREATEST(0, ${monthlyQuotaUsage.totalUsed} - 1)`,
        updatedAt: now,
      })
      .where(eq(monthlyQuotaUsage.counterKey, monthlyKey));

    if (res.isDiagnostic) {
      if (res.deviceId) {
        await tx
          .update(devices)
          .set({ freeDiagnosticUsed: false })
          .where(eq(devices.deviceId, res.deviceId));
      } else {
        await tx
          .update(devices)
          .set({ freeDiagnosticUsed: false })
          .where(
            or(eq(devices.deviceId, res.accountKey), eq(devices.linkedUserId, res.accountKey)),
          );
      }
    }

    return true;
  });
}

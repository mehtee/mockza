import { randomUUID } from 'node:crypto';
import {
  EntitlementRequiredDomainError,
  evaluateQuotaEligibility,
  QuotaExceededDomainError,
} from '@mockza/domain';
import { eq, sql } from 'drizzle-orm';
import type { MockzaDb } from './client.js';
import {
  dailyQuotaUsage,
  devices,
  entitlements,
  monthlyQuotaUsage,
  quotaReservations,
} from './schema.js';

export function getUtcDayString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getUtcMonthString(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export async function getAccountQuotaStatus(params: {
  db: MockzaDb;
  accountKey: string;
  deviceId: string;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const utcDay = getUtcDayString(now);
  const utcMonth = getUtcMonthString(now);

  const deviceRows = await params.db
    .select({
      freeDiagnosticUsed: devices.freeDiagnosticUsed,
    })
    .from(devices)
    .where(eq(devices.deviceId, params.deviceId))
    .limit(1);

  const freeDiagnosticUsed = deviceRows[0]?.freeDiagnosticUsed ?? false;

  const entRows = await params.db
    .select({
      isPro: entitlements.isPro,
      expiresAt: entitlements.expiresAt,
    })
    .from(entitlements)
    .where(eq(entitlements.deviceId, params.deviceId))
    .limit(1);

  const isPro = Boolean(entRows[0]?.isPro && (!entRows[0].expiresAt || entRows[0].expiresAt > now));

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

export async function reserveQuotaAtomic(params: {
  db: MockzaDb;
  accountKey: string;
  deviceId: string;
  attemptId: string;
  skill: 'speaking' | 'writing';
  now?: Date;
}): Promise<{ isDiagnostic: boolean }> {
  const now = params.now ?? new Date();
  const utcDay = getUtcDayString(now);
  const utcMonth = getUtcMonthString(now);

  const existingRes = await params.db
    .select({
      reservationId: quotaReservations.reservationId,
      status: quotaReservations.status,
      isDiagnostic: quotaReservations.isDiagnostic,
    })
    .from(quotaReservations)
    .where(eq(quotaReservations.attemptId, params.attemptId))
    .limit(1);

  if (existingRes[0]) {
    if (existingRes[0].status === 'reserved' || existingRes[0].status === 'committed') {
      return { isDiagnostic: existingRes[0].isDiagnostic };
    }
  }

  const status = await getAccountQuotaStatus({
    db: params.db,
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

  const reservationId = randomUUID();
  const dailyKey = `${params.accountKey}:${utcDay}`;
  const monthlyKey = `${params.accountKey}:${utcMonth}`;

  await params.db.transaction(async (tx) => {
    await tx.insert(quotaReservations).values({
      reservationId,
      attemptId: params.attemptId,
      accountKey: params.accountKey,
      skill: params.skill,
      utcDay,
      utcMonth,
      status: 'reserved',
      isDiagnostic: eligibility.isDiagnostic,
    });

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
  });

  return { isDiagnostic: eligibility.isDiagnostic };
}

export async function refundQuotaAtomic(params: {
  db: MockzaDb;
  attemptId: string;
  now?: Date;
}): Promise<boolean> {
  const now = params.now ?? new Date();

  const resRows = await params.db
    .select()
    .from(quotaReservations)
    .where(eq(quotaReservations.attemptId, params.attemptId))
    .limit(1);

  const res = resRows[0];
  if (!res || res.status === 'refunded') {
    return false;
  }

  const dailyKey = `${res.accountKey}:${res.utcDay}`;
  const monthlyKey = `${res.accountKey}:${res.utcMonth}`;

  await params.db.transaction(async (tx) => {
    await tx
      .update(quotaReservations)
      .set({ status: 'refunded', updatedAt: now })
      .where(eq(quotaReservations.attemptId, params.attemptId));

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
      await tx
        .update(devices)
        .set({ freeDiagnosticUsed: false })
        .where(eq(devices.deviceId, res.accountKey));
    }
  });

  return true;
}

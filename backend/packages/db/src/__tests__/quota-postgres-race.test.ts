import { randomUUID } from 'node:crypto';
import { EntitlementRequiredDomainError, QuotaExceededDomainError } from '@mockza/domain';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDbClient } from '../client.js';
import {
  commitQuotaReservationAtomic,
  refundQuotaAtomic,
  reserveQuotaAtomic,
} from '../quota-service.js';
import {
  dailyQuotaUsage,
  devices,
  entitlements,
  monthlyQuotaUsage,
  quotaReservations,
} from '../schema.js';

const testDbUrl =
  process.env['DATABASE_URL'] ?? 'postgres://mockza:mockza_dev_password@127.0.0.1:45432/mockza';

let pgReachable = false;
const { db, sql } = createDbClient(testDbUrl, { max: 12, prepare: false });

beforeAll(async () => {
  try {
    await sql`SELECT 1`;
    pgReachable = true;
  } catch {
    pgReachable = false;
  }
});

afterAll(async () => {
  await sql.end();
});

describe('Phase 3 Live PostgreSQL Quota Concurrency & Refund Atomicity (TD-11, TD-12, TD-15)', () => {
  it('TD-11: concurrent free-diagnostic burst admits strictly 1 attempt and rejects 4 with 402 domain error', async (ctx) => {
    if (!pgReachable) {
      ctx.skip();
      return;
    }

    const deviceId = randomUUID();
    const attemptIds = Array.from({ length: 5 }, () => randomUUID());
    const now = new Date('2026-11-16T12:00:00.000Z');
    const utcDay = '2026-11-16';
    const utcMonth = '2026-11';

    await db.insert(devices).values({
      deviceId,
      deviceSecretHash: 'test-hash-for-race',
      edition: 'glb',
      freeDiagnosticUsed: false,
    });

    try {
      const outcomes = await Promise.allSettled(
        attemptIds.map((attemptId) =>
          reserveQuotaAtomic({
            db,
            accountKey: deviceId,
            deviceId,
            attemptId,
            skill: 'writing',
            now,
          }),
        ),
      );

      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o): o is PromiseRejectedResult => o.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(4);
      for (const r of rejected) {
        expect(r.reason).toBeInstanceOf(EntitlementRequiredDomainError);
      }

      const [devRow] = await db
        .select({ freeDiagnosticUsed: devices.freeDiagnosticUsed })
        .from(devices)
        .where(eq(devices.deviceId, deviceId));
      expect(devRow?.freeDiagnosticUsed).toBe(true);
    } finally {
      await db.delete(quotaReservations).where(eq(quotaReservations.accountKey, deviceId));
      await db
        .delete(dailyQuotaUsage)
        .where(eq(dailyQuotaUsage.counterKey, `${deviceId}:${utcDay}`));
      await db
        .delete(monthlyQuotaUsage)
        .where(eq(monthlyQuotaUsage.counterKey, `${deviceId}:${utcMonth}`));
      await db.delete(devices).where(eq(devices.deviceId, deviceId));
    }
  });

  it('TD-11: concurrent Pro daily burst respects exact remaining daily slots without overspend', async (ctx) => {
    if (!pgReachable) {
      ctx.skip();
      return;
    }

    const deviceId = randomUUID();
    const attemptIds = Array.from({ length: 5 }, () => randomUUID());
    const now = new Date('2026-11-16T12:00:00.000Z');
    const utcDay = '2026-11-16';
    const utcMonth = '2026-11';

    await db.insert(devices).values({
      deviceId,
      deviceSecretHash: 'test-hash-pro-race',
      edition: 'glb',
      freeDiagnosticUsed: true,
    });
    await db.insert(entitlements).values({
      provider: 'revenuecat',
      deviceId,
      isPro: true,
      productId: 'mockza_pro_monthly',
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    });
    await db.insert(dailyQuotaUsage).values({
      counterKey: `${deviceId}:${utcDay}`,
      accountKey: deviceId,
      utcDay,
      speakingUsed: 0,
      writingUsed: 8, // Pro daily writing limit is 10 -> strictly 2 slots left
    });
    await db.insert(monthlyQuotaUsage).values({
      counterKey: `${deviceId}:${utcMonth}`,
      accountKey: deviceId,
      utcMonth,
      totalUsed: 8,
    });

    try {
      const outcomes = await Promise.allSettled(
        attemptIds.map((attemptId) =>
          reserveQuotaAtomic({
            db,
            accountKey: deviceId,
            deviceId,
            attemptId,
            skill: 'writing',
            now,
          }),
        ),
      );

      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o): o is PromiseRejectedResult => o.status === 'rejected');

      expect(fulfilled).toHaveLength(2);
      expect(rejected).toHaveLength(3);
      for (const r of rejected) {
        expect(r.reason).toBeInstanceOf(QuotaExceededDomainError);
      }

      const [dailyRow] = await db
        .select({ writingUsed: dailyQuotaUsage.writingUsed })
        .from(dailyQuotaUsage)
        .where(eq(dailyQuotaUsage.counterKey, `${deviceId}:${utcDay}`));
      expect(dailyRow?.writingUsed).toBe(10);
    } finally {
      await db.delete(quotaReservations).where(eq(quotaReservations.accountKey, deviceId));
      await db
        .delete(dailyQuotaUsage)
        .where(eq(dailyQuotaUsage.counterKey, `${deviceId}:${utcDay}`));
      await db
        .delete(monthlyQuotaUsage)
        .where(eq(monthlyQuotaUsage.counterKey, `${deviceId}:${utcMonth}`));
      await db.delete(entitlements).where(eq(entitlements.deviceId, deviceId));
      await db.delete(devices).where(eq(devices.deviceId, deviceId));
    }
  });

  it('TD-12 & TD-15: concurrent refunds run at most once and committed reservations ignore late refunds', async (ctx) => {
    if (!pgReachable) {
      ctx.skip();
      return;
    }

    const deviceId = randomUUID();
    const refundedAttempt = randomUUID();
    const committedAttempt = randomUUID();
    const now = new Date('2026-11-16T12:00:00.000Z');
    const utcDay = '2026-11-16';
    const utcMonth = '2026-11';

    await db.insert(devices).values({
      deviceId,
      deviceSecretHash: 'test-hash-refund-race',
      edition: 'glb',
      freeDiagnosticUsed: false,
    });
    await db.insert(entitlements).values({
      provider: 'revenuecat',
      deviceId,
      isPro: true,
      productId: 'mockza_pro_monthly',
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    });

    try {
      await reserveQuotaAtomic({
        db,
        accountKey: deviceId,
        deviceId,
        attemptId: refundedAttempt,
        skill: 'speaking',
        now,
      });
      await reserveQuotaAtomic({
        db,
        accountKey: deviceId,
        deviceId,
        attemptId: committedAttempt,
        skill: 'speaking',
        now,
      });

      // Concurrent refunds on refundedAttempt -> strictly 1 succeeds
      const refundResults = await Promise.all([
        refundQuotaAtomic({ db, attemptId: refundedAttempt, now }),
        refundQuotaAtomic({ db, attemptId: refundedAttempt, now }),
        refundQuotaAtomic({ db, attemptId: refundedAttempt, now }),
      ]);
      expect(refundResults.filter(Boolean)).toHaveLength(1);

      // Commit committedAttempt then try refunding it -> commit wins, late refund is no-op
      const committed = await commitQuotaReservationAtomic({
        db,
        attemptId: committedAttempt,
        now,
      });
      expect(committed).toBe(true);

      const lateRefund = await refundQuotaAtomic({
        db,
        attemptId: committedAttempt,
        now,
      });
      expect(lateRefund).toBe(false);

      const [dailyRow] = await db
        .select({ speakingUsed: dailyQuotaUsage.speakingUsed })
        .from(dailyQuotaUsage)
        .where(eq(dailyQuotaUsage.counterKey, `${deviceId}:${utcDay}`));
      expect(dailyRow?.speakingUsed).toBe(1);

      const [monthlyRow] = await db
        .select({ totalUsed: monthlyQuotaUsage.totalUsed })
        .from(monthlyQuotaUsage)
        .where(eq(monthlyQuotaUsage.counterKey, `${deviceId}:${utcMonth}`));
      expect(monthlyRow?.totalUsed).toBe(1);
    } finally {
      await db.delete(quotaReservations).where(eq(quotaReservations.accountKey, deviceId));
      await db
        .delete(dailyQuotaUsage)
        .where(eq(dailyQuotaUsage.counterKey, `${deviceId}:${utcDay}`));
      await db
        .delete(monthlyQuotaUsage)
        .where(eq(monthlyQuotaUsage.counterKey, `${deviceId}:${utcMonth}`));
      await db.delete(entitlements).where(eq(entitlements.deviceId, deviceId));
      await db.delete(devices).where(eq(devices.deviceId, deviceId));
    }
  });
});

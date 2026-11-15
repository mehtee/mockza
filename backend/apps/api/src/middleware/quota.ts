import type { MockzaDb } from '@mockza/db';
import { evaluateQuotaEligibility, hasRemainingQuota } from '@mockza/domain';
import type { MiddlewareHandler } from 'hono';
import { getAccountQuotaStatus } from '../services/quota.js';
import type { RequestVariables } from './request-id.js';

export function createQuotaCheckMiddleware(
  skill: 'speaking' | 'writing',
  db?: MockzaDb,
): MiddlewareHandler<{
  Variables: RequestVariables;
}> {
  return async (c, next) => {
    const deviceId = c.get('deviceId');
    const accountKey = c.get('accountKey') ?? deviceId;

    if (db && deviceId && accountKey) {
      const status = await getAccountQuotaStatus({
        db,
        accountKey,
        deviceId,
      });

      const eligibility = evaluateQuotaEligibility({
        isPro: status.isPro,
        freeDiagnosticUsed: status.freeDiagnosticUsed,
        speakingUsedToday: status.speakingUsedToday,
        writingUsedToday: status.writingUsedToday,
        monthlyUsed: status.monthlyUsed,
        skill,
      });

      if (!eligibility.allowed) {
        if (eligibility.reason === 'diagnostic_already_used') {
          return c.json(
            {
              code: 'entitlement_required',
              message:
                'Free diagnostic evaluation has already been used. Please subscribe to Mockza Pro.',
              requestId: c.get('requestId'),
            },
            402,
          );
        }
        return c.json(
          {
            code: 'quota_exceeded',
            message: `Evaluation quota exceeded (${eligibility.reason}). Daily reset at ${eligibility.dailyResetAt}.`,
            requestId: c.get('requestId'),
          },
          429,
        );
      }
    } else {
      // Fallback for tests when DB is not provided
      const allowed = hasRemainingQuota({ usedToday: 0, skill, isPro: false });
      if (!allowed) {
        return c.json(
          {
            code: 'quota_exceeded',
            message: `Daily ${skill} quota exceeded.`,
            requestId: c.get('requestId'),
          },
          429,
        );
      }
    }

    await next();
  };
}

import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import { ApiErrorSchema, QuotaStatusResponseSchema } from '@mockza/contracts';
import type { MockzaDb } from '@mockza/db';
import { getNextUtcDayReset, getNextUtcMonthReset } from '@mockza/domain';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';
import { getAccountQuotaStatus } from '../services/quota.js';
import type { SessionManager } from '../services/session-manager.js';

export function registerQuotaRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
  sessionManager?: SessionManager,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db, sessionManager);
  app.use('/v1/quota/*', authMiddleware);

  const getQuotaRoute = createRoute({
    method: 'get',
    path: '/v1/quota/me',
    responses: {
      200: {
        description: 'Current user quota status and allowance.',
        content: { 'application/json': { schema: QuotaStatusResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(getQuotaRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized', message: 'Device auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;

    if (db) {
      const status = await getAccountQuotaStatus({ db, accountKey, deviceId });
      return c.json(
        QuotaStatusResponseSchema.parse({
          isPro: status.isPro,
          activePlanId: status.activePlanId,
          expiresAt: status.expiresAt,
          source: status.source,
          freeDiagnosticUsed: status.freeDiagnosticUsed,
          dailySpeakingUsed: status.speakingUsedToday,
          dailySpeakingLimit: status.isPro ? 10 : status.freeDiagnosticUsed ? 0 : 1,
          dailyWritingUsed: status.writingUsedToday,
          dailyWritingLimit: status.isPro ? 10 : status.freeDiagnosticUsed ? 0 : 1,
          monthlyUsed: status.monthlyUsed,
          monthlyLimit: status.isPro ? 150 : 1,
          dailyResetAt: getNextUtcDayReset(),
          monthlyResetAt: getNextUtcMonthReset(),
        }),
        200,
      );
    }

    const memSnap = sessionManager?.getMemoryEntitlementSnapshot
      ? sessionManager.getMemoryEntitlementSnapshot({ deviceId, accountKey })
      : {
          isPro: sessionManager
            ? await sessionManager.isUserOrDevicePro({ deviceId, accountKey })
            : false,
          activePlanId: null,
          expiresAt: null,
          source: 'none' as const,
        };

    return c.json(
      QuotaStatusResponseSchema.parse({
        isPro: memSnap.isPro,
        activePlanId: memSnap.activePlanId,
        expiresAt: memSnap.expiresAt,
        source: memSnap.source,
        freeDiagnosticUsed: false,
        dailySpeakingUsed: 0,
        dailySpeakingLimit: memSnap.isPro ? 10 : 1,
        dailyWritingUsed: 0,
        dailyWritingLimit: memSnap.isPro ? 10 : 1,
        monthlyUsed: 0,
        monthlyLimit: memSnap.isPro ? 150 : 1,
        dailyResetAt: getNextUtcDayReset(),
        monthlyResetAt: getNextUtcMonthReset(),
      }),
      200,
    );
  });
}

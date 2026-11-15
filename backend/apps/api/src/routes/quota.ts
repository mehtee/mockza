import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import { ApiErrorSchema, QuotaStatusResponseSchema } from '@mockza/contracts';
import type { MockzaDb } from '@mockza/db';
import { getNextUtcDayReset, getNextUtcMonthReset } from '@mockza/domain';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';
import { getAccountQuotaStatus } from '../services/quota.js';

export function registerQuotaRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db);
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

    return c.json(
      QuotaStatusResponseSchema.parse({
        isPro: false,
        freeDiagnosticUsed: false,
        dailySpeakingUsed: 0,
        dailySpeakingLimit: 1,
        dailyWritingUsed: 0,
        dailyWritingLimit: 1,
        monthlyUsed: 0,
        monthlyLimit: 1,
        dailyResetAt: getNextUtcDayReset(),
        monthlyResetAt: getNextUtcMonthReset(),
      }),
      200,
    );
  });
}

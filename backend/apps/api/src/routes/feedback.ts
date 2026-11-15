import { randomUUID } from 'node:crypto';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import {
  FlagQuestionRequestSchema,
  FlagQuestionResponseSchema,
  TelemetryBatchRequestSchema,
  TelemetryBatchResponseSchema,
} from '@mockza/contracts';
import { type MockzaDb, questionFlags } from '@mockza/db';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';

export function registerFeedbackRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db);

  // POST /v1/feedback/question-flag
  app.post('/v1/feedback/question-flag', authMiddleware, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json({ code: 'unauthorized', message: 'Device authentication required' }, 401);
    }

    const body = await c.req.json();
    const parsed = FlagQuestionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ code: 'validation_error', message: 'Invalid flag payload' }, 400);
    }

    const flagId = randomUUID();
    if (db) {
      await db.insert(questionFlags).values({
        flagId,
        questionId: parsed.data.questionId,
        packId: parsed.data.packId,
        reason: parsed.data.reason,
        note: parsed.data.note,
        deviceId,
      });
    }

    return c.json(FlagQuestionResponseSchema.parse({ success: true, flagId }), 200);
  });

  // POST /v1/events (Telemetry batch sink)
  app.post('/v1/events', authMiddleware, async (c) => {
    const body = await c.req.json();
    const parsed = TelemetryBatchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ code: 'validation_error', message: 'Invalid events payload' }, 400);
    }

    return c.json(
      TelemetryBatchResponseSchema.parse({
        acceptedCount: parsed.data.events.length,
      }),
      200,
    );
  });
}

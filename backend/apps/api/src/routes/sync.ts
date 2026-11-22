import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import {
  ApiErrorSchema,
  SyncPullResponseSchema,
  VocabBatchSyncRequestSchema,
  VocabWaveSummarySchema,
} from '@mockza/contracts';
import {
  computeFullPersonalizationState,
  type MockzaDb,
  pronunciationPractices,
  recordUserActivityLedger,
  upsertVocabSrsSyncBatch,
  userActivityLedger,
  userAttemptsSync,
  userVocabSrsSync,
} from '@mockza/db';
import { and, desc, eq, gte } from 'drizzle-orm';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';

export function registerSyncRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db);
  app.use('/v1/sync/*', authMiddleware);
  const memoryVocabSync = new Map<
    string,
    Array<(typeof VocabBatchSyncRequestSchema)['_output']['cards'][number]>
  >();

  const pullRoute = createRoute({
    method: 'get',
    path: '/v1/sync/pull',
    request: {
      query: z.object({
        since: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Cross-device state snapshot (supports optional ?since=<ISO> incremental delta).',
        content: { 'application/json': { schema: SyncPullResponseSchema } },
      },
      401: { description: 'Unauthorized.', content: { 'application/json': { schema: ApiErrorSchema } } },
    },
  });

  app.openapi(pullRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const { since } = c.req.valid('query');
    const parsedSince = since ? new Date(since) : null;
    const sinceDate = parsedSince && !Number.isNaN(parsedSince.getTime()) ? parsedSince : null;

    if (!db) {
      return c.json(
        SyncPullResponseSchema.parse({
          profile: null,
          liveBand: null,
          roadmap: null,
          attempts: [],
          vocabSrs: memoryVocabSync.get(`${env.EDITION}:${accountKey}`) ?? [],
          pronunciationPractices: [],
          recentActivities: [],
          syncedAt: new Date().toISOString(),
        }),
        200,
      );
    }

    const attemptConditions = [
      eq(userAttemptsSync.accountKey, accountKey),
      eq(userAttemptsSync.edition, env.EDITION),
      ...(sinceDate ? [gte(userAttemptsSync.updatedAt, sinceDate)] : []),
    ];
    const vocabConditions = [
      eq(userVocabSrsSync.accountKey, accountKey),
      eq(userVocabSrsSync.edition, env.EDITION),
      ...(sinceDate ? [gte(userVocabSrsSync.updatedAt, sinceDate)] : []),
    ];
    const pronConditions = [
      eq(pronunciationPractices.accountKey, accountKey),
      eq(pronunciationPractices.edition, env.EDITION),
      ...(sinceDate ? [gte(pronunciationPractices.createdAt, sinceDate)] : []),
    ];
    const activityConditions = [
      eq(userActivityLedger.accountKey, accountKey),
      eq(userActivityLedger.edition, env.EDITION),
      ...(sinceDate ? [gte(userActivityLedger.createdAt, sinceDate)] : []),
    ];

    const [pState, attemptRows, vocabRows, pronRows, activityRows] = await Promise.all([
      computeFullPersonalizationState({
        db,
        accountKey,
        edition: env.EDITION,
        persistLiveBand: false,
      }),
      db
        .select()
        .from(userAttemptsSync)
        .where(and(...attemptConditions))
        .orderBy(desc(userAttemptsSync.updatedAt))
        .limit(100),
      db
        .select()
        .from(userVocabSrsSync)
        .where(and(...vocabConditions)),
      db
        .select()
        .from(pronunciationPractices)
        .where(and(...pronConditions))
        .orderBy(desc(pronunciationPractices.createdAt))
        .limit(60),
      db
        .select()
        .from(userActivityLedger)
        .where(and(...activityConditions))
        .orderBy(desc(userActivityLedger.createdAt))
        .limit(60),
    ]);

    return c.json(
      SyncPullResponseSchema.parse({
        profile: pState.profile,
        liveBand: pState.liveBand,
        roadmap: pState.roadmap,
        attempts: attemptRows.map((a) => ({
          attemptId: a.attemptId,
          packId: a.packId,
          examId: a.examId,
          skill: a.skill,
          mode: a.mode,
          status: a.status,
          scoreBand: a.scoreBand ?? null,
          durationSeconds: a.durationSeconds,
          answersJson: a.answersJson ?? null,
          feedbackJson: a.feedbackJson ?? null,
          updatedAt: a.updatedAt.toISOString(),
        })),
        vocabSrs: vocabRows.map((v) => ({
          cardId: v.cardId,
          easeFactorMilli: v.easeFactorMilli,
          intervalDays: v.intervalDays,
          repetitions: v.repetitions,
          dueSerialDay: v.dueSerialDay,
          lapses: v.lapses,
          lastReviewedAt: v.lastReviewedAt ? v.lastReviewedAt.toISOString() : null,
          sourceKind: v.sourceKind,
          cardSnapshotJson: v.cardSnapshotJson ?? null,
        })),
        pronunciationPractices: pronRows.map((r) => ({
          practiceId: r.practiceId,
          targetText: r.targetText,
          practiceKind: r.practiceKind,
          sourceRefType: r.sourceRefType ?? null,
          sourceRefId: r.sourceRefId ?? null,
          objectKey: r.objectKey,
          audioPlayUrl: `/v1/pronunciation/audio/${r.practiceId}`,
          referenceTtsUrl: null,
          transcript: r.transcript ?? null,
          accuracyScore: r.accuracyScore ?? null,
          fluencyScore: r.fluencyScore ?? null,
          intonationScore: r.intonationScore ?? null,
          stressScore: r.stressScore ?? null,
          overallScore: r.overallScore ?? null,
          bandImpactLabel: r.bandImpactLabel ?? null,
          summaryEn: r.summaryEn ?? null,
          summaryFa: r.summaryFa ?? null,
          mouthTipEn: r.mouthTipEn ?? null,
          mouthTipFa: r.mouthTipFa ?? null,
          actionableRetryEn: r.actionableRetryEn ?? null,
          actionableRetryFa: r.actionableRetryFa ?? null,
          wordsFeedback: r.wordsFeedbackJson as never[],
          status: r.status,
          modelUsed: r.modelUsed ?? null,
          estimatedCostUsdMicros: r.estimatedCostUsdMicros,
          createdAt: r.createdAt.toISOString(),
        })),
        recentActivities: activityRows.map((act) => ({
          activityId: act.activityId,
          activityKind: act.activityKind,
          entityType: act.entityType,
          entityId: act.entityId,
          topicKey: act.topicKey ?? null,
          durationSeconds: act.durationSeconds ?? null,
          createdAt: act.createdAt.toISOString(),
        })),
        syncedAt: new Date().toISOString(),
      }),
      200,
    );
  });

  const vocabBatchRoute = createRoute({
    method: 'post',
    path: '/v1/sync/vocab-batch',
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: VocabBatchSyncRequestSchema } },
      },
    },
    responses: {
      200: {
        description: 'Synced vocab SRS batch and returned updated wave summary.',
        content: { 'application/json': { schema: VocabWaveSummarySchema } },
      },
      401: { description: 'Unauthorized.', content: { 'application/json': { schema: ApiErrorSchema } } },
    },
  });

  app.openapi(vocabBatchRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const body = c.req.valid('json');
    if (!db) {
      const memKey = `${env.EDITION}:${accountKey}`;
      const existing = memoryVocabSync.get(memKey) ?? [];
      const mergedMap = new Map(existing.map((card) => [card.cardId, card]));
      for (const card of body.cards) {
        mergedMap.set(card.cardId, card);
      }
      const nextCards = Array.from(mergedMap.values());
      memoryVocabSync.set(memKey, nextCards);
      return c.json(
        VocabWaveSummarySchema.parse({
          unlockedWave: 1,
          totalWaves: 1,
          currentWaveTotal: nextCards.length,
          currentWaveLearned: nextCards.filter((x) => x.repetitions >= 1).length,
          readyToUnlockNext: false,
          dailyNewRemaining: 10,
        }),
        200,
      );
    }

    await upsertVocabSrsSyncBatch({
      db,
      accountKey,
      edition: env.EDITION,
      cards: body.cards,
    });

    await recordUserActivityLedger({
      db,
      accountKey,
      deviceId,
      edition: env.EDITION,
      activityKind: 'vocab_review_sync',
      entityType: 'vocab_batch',
      entityId: accountKey,
      metadata: { count: body.cards.length },
    });

    const pState = await computeFullPersonalizationState({
      db,
      accountKey,
      edition: env.EDITION,
      recalibrateRoadmap: false,
    });
    return c.json(VocabWaveSummarySchema.parse(pState.vocabWaveSummary), 200);
  });
}

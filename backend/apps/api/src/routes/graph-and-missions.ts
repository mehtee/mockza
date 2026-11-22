import { randomUUID } from 'node:crypto';
import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import {
  buildCuratedStarterMission,
  evaluateMissionResponseGraph,
  planDailyMissionDemoOnly,
  planDailyMissionGraph,
  prepareAudioForModel,
  bufferAudioStream,
  updateLinguisticGraphSignals,
  type AiUsageRecord,
} from '@mockza/ai';
import type { AppEnv } from '@mockza/config';
import {
  ApiErrorSchema,
  CompleteDailyMissionRequestSchema,
  DailyMissionResponseSchema,
  LinguisticGraphResponseSchema,
  RefreshDailyMissionRequestSchema,
  UpdateGraphInterestsRequestSchema,
} from '@mockza/contracts';
import {
  computeFullPersonalizationState,
  dailyMissions,
  getUtcDaySerial,
  learnerTopicWeaknessCoverage,
  listLinguisticGraphForAccount,
  type MockzaDb,
  recordAiUsageLedger,
  recordUserActivityLedger,
  updateGraphInterestPreferences,
  upsertLinguisticGraphSignals,
} from '@mockza/db';
import {
  normalizeCanonicalTopicKey,
  normalizeFavoriteTopicList,
  rankTopMissionTargets,
  selectNextCoachTopic,
  slugifyTopicCanonicalKey,
  type CanonicalTopicKey,
  type TopicWeaknessCoverageEntry,
} from '@mockza/domain';
import { createAudioS3Client } from '@mockza/storage';
import { and, eq } from 'drizzle-orm';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';

function mapNodeRowToDto(row: {
  nodeId: string;
  edition: string;
  nodeKind: string;
  canonicalKey: string;
  displayLabelEn: string;
  displayLabelFa: string | null;
  masteryScoreMilli: number;
  signalWeightMilli: number;
  evidenceCount: number;
  lastSeenDaySerial: number;
  lastExampleEn: string | null;
  coachNoteEn: string | null;
  coachNoteFa: string | null;
  isPinned: boolean;
  isMuted: boolean;
}) {
  return {
    nodeId: row.nodeId,
    edition: (row.edition === 'irn' ? 'irn' : 'glb') as 'glb' | 'irn',
    nodeKind: row.nodeKind as 'bottleneck' | 'target_structure' | 'interest_topic',
    canonicalKey: row.canonicalKey,
    displayLabelEn: row.displayLabelEn,
    displayLabelFa: row.displayLabelFa,
    masteryScoreMilli: row.masteryScoreMilli,
    signalWeightMilli: row.signalWeightMilli,
    evidenceCount: row.evidenceCount,
    lastSeenDaySerial: row.lastSeenDaySerial,
    lastExampleEn: row.lastExampleEn,
    coachNoteEn: row.coachNoteEn,
    coachNoteFa: row.coachNoteFa,
    isPinned: row.isPinned,
    isMuted: row.isMuted,
  };
}

export function registerGraphAndMissionRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
  s3Client?: S3Client,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db);
  app.use('/v1/graph/*', authMiddleware);
  app.use('/v1/missions/*', authMiddleware);
  const internalS3 = s3Client ?? createAudioS3Client(env);

  const memoryMissions = new Map<string, z.infer<typeof DailyMissionResponseSchema>>();
  const dailyRefreshCounts = new Map<string, number>();

  app.use('/v1/graph/*', async (c, next) => {
    if (!env.ENABLE_LINGUISTIC_GRAPH) {
      return c.json(
        {
          code: 'feature_disabled',
          message: 'Linguistic graph feature is disabled.',
          requestId: c.get('requestId'),
        },
        404,
      );
    }
    return next();
  });

  app.use('/v1/missions/*', async (c, next) => {
    if (!env.ENABLE_LINGUISTIC_GRAPH) {
      return c.json(
        {
          code: 'feature_disabled',
          message: 'Daily Missions feature is disabled.',
          requestId: c.get('requestId'),
        },
        404,
      );
    }
    return next();
  });

  const getGraphRoute = createRoute({
    method: 'get',
    path: '/v1/graph/me',
    responses: {
      200: {
        description: 'Current account persistent Linguistic Graph nodes.',
        content: { 'application/json': { schema: LinguisticGraphResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(getGraphRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        {
          code: 'unauthorized' as const,
          message: 'Auth required',
          requestId: c.get('requestId'),
        },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    if (!db) {
      return c.json(
        LinguisticGraphResponseSchema.parse({
          bottlenecks: [],
          targetStructures: [],
          interestTopics: [],
          totalEvidenceCount: 0,
        }),
        200,
      );
    }
    const graph = await listLinguisticGraphForAccount({
      db,
      accountKey,
      edition: env.EDITION,
    });
    return c.json(
      LinguisticGraphResponseSchema.parse({
        bottlenecks: graph.bottlenecks.map(mapNodeRowToDto),
        targetStructures: graph.targetStructures.map(mapNodeRowToDto),
        interestTopics: graph.interestTopics.map(mapNodeRowToDto),
        totalEvidenceCount: graph.totalEvidenceCount,
      }),
      200,
    );
  });

  const patchInterestsRoute = createRoute({
    method: 'patch',
    path: '/v1/graph/interests',
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: UpdateGraphInterestsRequestSchema } },
      },
    },
    responses: {
      200: {
        description: 'Updated interest topic preferences inside Linguistic Graph.',
        content: { 'application/json': { schema: LinguisticGraphResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(patchInterestsRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        {
          code: 'unauthorized' as const,
          message: 'Auth required',
          requestId: c.get('requestId'),
        },
        401,
      );
    }
    const body = c.req.valid('json');
    const accountKey = c.get('accountKey') ?? deviceId;
    if (!db) {
      return c.json(
        LinguisticGraphResponseSchema.parse({
          bottlenecks: [],
          targetStructures: [],
          interestTopics: body.pinTopics.map((topic) => ({
            nodeId: randomUUID(),
            edition: env.EDITION,
            nodeKind: 'interest_topic',
            canonicalKey: slugifyTopicCanonicalKey(topic),
            displayLabelEn: topic,
            displayLabelFa: topic,
            masteryScoreMilli: 500,
            signalWeightMilli: 800,
            evidenceCount: 1,
            lastSeenDaySerial: getUtcDaySerial(),
            isPinned: true,
            isMuted: false,
          })),
          totalEvidenceCount: body.pinTopics.length,
        }),
        200,
      );
    }

    await updateGraphInterestPreferences({
      db,
      accountKey,
      edition: env.EDITION,
      pinTopics: body.pinTopics,
      muteTopics: body.muteTopics,
    });
    const updated = await listLinguisticGraphForAccount({
      db,
      accountKey,
      edition: env.EDITION,
    });
    return c.json(
      LinguisticGraphResponseSchema.parse({
        bottlenecks: updated.bottlenecks.map(mapNodeRowToDto),
        targetStructures: updated.targetStructures.map(mapNodeRowToDto),
        interestTopics: updated.interestTopics.map(mapNodeRowToDto),
        totalEvidenceCount: updated.totalEvidenceCount,
      }),
      200,
    );
  });

  const getTodayMissionRoute = createRoute({
    method: 'get',
    path: '/v1/missions/today',
    request: {
      query: z.object({
        examTrack: z.string().default('ielts_academic'),
        dueWords: z.string().max(400).optional(),
      }),
    },
    responses: {
      200: {
        description: "Today's lazy-synthesized 10-minute Daily Mission.",
        content: { 'application/json': { schema: DailyMissionResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      503: {
        description: 'Mission AI service unavailable.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(getTodayMissionRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        {
          code: 'unauthorized' as const,
          message: 'Auth required',
          requestId: c.get('requestId'),
        },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const { examTrack, dueWords } = c.req.valid('query');
    const daySerial = getUtcDaySerial();

    if (db) {
      const existingRows = await db
        .select()
        .from(dailyMissions)
        .where(
          and(
            eq(dailyMissions.accountKey, accountKey),
            eq(dailyMissions.edition, env.EDITION),
            eq(dailyMissions.missionDaySerial, daySerial),
          ),
        )
        .limit(1);

      if (existingRows[0]) {
        const row = existingRows[0];
        return c.json(
          DailyMissionResponseSchema.parse({
            missionId: row.missionId,
            edition: env.EDITION,
            examTrack: row.examTrack,
            missionDaySerial: row.missionDaySerial,
            status: row.status,
            focusTopic: row.focusTopic,
            payload: row.missionPayloadJson,
            evaluationResult: row.evaluationResultJson ?? null,
          }),
          200,
        );
      }
    } else {
      const mem = memoryMissions.get(`${accountKey}:${env.EDITION}:${daySerial}`);
      if (mem) return c.json(mem, 200);
    }

    const graph = db
      ? await listLinguisticGraphForAccount({ db, accountKey, edition: env.EDITION })
      : { bottlenecks: [], targetStructures: [], interestTopics: [], totalEvidenceCount: 0 };

    const activeInterests = graph.interestTopics.filter((t) => !t.isMuted);
    let focusTopic =
      activeInterests.find((t) => t.isPinned)?.displayLabelEn ??
      activeInterests[0]?.displayLabelEn ??
      'Technology & AI';
    let activePhase: 'favorite_topics' | 'weakness_transfer' | 'exam_breadth' = 'favorite_topics';
    let phaseReasonEn = 'Starting inside your favorite topics.';
    let phaseReasonFa = 'شروع تمرین در موضوعات مورد علاقه شما.';
    let currentBand: number | undefined;
    let targetBand: number | undefined;

    if (db) {
      const [pState, covRows] = await Promise.all([
        computeFullPersonalizationState({ db, accountKey, edition: env.EDITION }).catch(() => null),
        db
          .select()
          .from(learnerTopicWeaknessCoverage)
          .where(
            and(
              eq(learnerTopicWeaknessCoverage.accountKey, accountKey),
              eq(learnerTopicWeaknessCoverage.edition, env.EDITION),
            ),
          ),
      ]);
      if (pState) {
        currentBand = pState.liveBand.currentBand ?? undefined;
        targetBand = pState.profile.targetBand;
        const covEntries: TopicWeaknessCoverageEntry[] = covRows.map((c) => ({
          weaknessKey: c.weaknessKey,
          topicKey: normalizeCanonicalTopicKey(c.topicKey) ?? 'academic_core',
          practiceCount: c.attemptsCount,
          passCount: c.successesCount,
          lastMasteryMilli: c.masteredInTopic ? 820 : 400,
          lastPracticedDaySerial: c.lastPracticedAt ? getUtcDaySerial(c.lastPracticedAt) : daySerial - 5,
        }));
        const selected = selectNextCoachTopic({
          favoriteTopics: normalizeFavoriteTopicList(pState.profile.favoriteTopics),
          weaknessNodes: graph.bottlenecks
            .filter((b) => !b.isMuted)
            .map((b) => ({
              nodeId: b.nodeId,
              nodeKind: 'bottleneck',
              canonicalKey: b.canonicalKey,
              masteryScoreMilli: b.masteryScoreMilli,
              signalWeightMilli: b.signalWeightMilli,
              evidenceCount: b.evidenceCount,
              lastSeenDaySerial: b.lastSeenDaySerial,
            })),
          coverage: covEntries,
          currentDaySerial: daySerial,
        });
        focusTopic = selected.topicKey;
        activePhase =
          selected.phase === 'cross_topic_transfer'
            ? 'weakness_transfer'
            : selected.phase === 'exam_breadth'
              ? 'exam_breadth'
              : 'favorite_topics';
        phaseReasonEn = selected.reasonEn;
        phaseReasonFa = selected.reasonFa;
      }
    }

    const ranked = rankTopMissionTargets({
      nodes: [...graph.bottlenecks, ...graph.targetStructures].map((n) => ({
        nodeId: n.nodeId,
        nodeKind: n.nodeKind as 'bottleneck' | 'target_structure' | 'interest_topic',
        canonicalKey: n.canonicalKey,
        masteryScoreMilli: n.masteryScoreMilli,
        signalWeightMilli: n.signalWeightMilli,
        evidenceCount: n.evidenceCount,
        lastSeenDaySerial: n.lastSeenDaySerial,
      })),
      dueCardIds: (dueWords ?? '').split(',').filter(Boolean),
      currentDaySerial: daySerial,
      maxBottlenecks: 2,
    });

    const bottlenecks = ranked.bottlenecks
      .map((r) => graph.bottlenecks.find((b) => b.canonicalKey === r.canonicalKey))
      .filter((b): b is NonNullable<typeof b> => Boolean(b))
      .map((b) => ({
        canonicalKey: b.canonicalKey,
        displayLabelEn: b.displayLabelEn,
        displayLabelFa: b.displayLabelFa,
        lastExampleEn: b.lastExampleEn,
      }));

    const parsedDueWords = (dueWords ?? '')
      .split(',')
      .map((w) => w.trim())
      .filter((w) => w.length > 0)
      .slice(0, 5)
      .map((word, idx) => ({
        cardId: `due-card-${idx + 1}`,
        word,
      }));

    let synthesized;
    const isColdStartUser = graph.bottlenecks.length === 0 && graph.targetStructures.length === 0;
    const planUsages: AiUsageRecord[] = [];
    if (isColdStartUser) {
      synthesized = buildCuratedStarterMission({
        edition: env.EDITION,
        examTrack,
        focusTopic,
        activePhase,
        phaseReasonEn,
        phaseReasonFa,
        currentBand,
        targetBand,
        bottlenecks,
        dueCards: parsedDueWords,
      });
    } else {
      synthesized = await Promise.race([
        planDailyMissionGraph(
          {
            edition: env.EDITION,
            examTrack,
            focusTopic,
            activePhase,
            phaseReasonEn,
            phaseReasonFa,
            currentBand,
            targetBand,
            bottlenecks,
            dueCards: parsedDueWords,
          },
          {
            allowDemoEvaluator: env.ALLOW_DEMO_EVALUATOR || !env.OPENROUTER_API_KEY,
            routingTier: 'flex',
            onUsage: (u) => {
              planUsages.push(u);
            },
          },
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('mission_synthesis_timeout')), 10_000),
        ),
      ]).catch(() =>
        buildCuratedStarterMission({
          edition: env.EDITION,
          examTrack,
          focusTopic,
          activePhase,
          phaseReasonEn,
          phaseReasonFa,
          currentBand,
          targetBand,
          bottlenecks,
          dueCards: parsedDueWords,
        }),
      );
    }

    const missionId = randomUUID();
    if (db && planUsages.length > 0) {
      for (const u of planUsages) {
        await recordAiUsageLedger({
          db,
          accountKey,
          deviceId,
          edition: env.EDITION,
          featureKind: u.featureKind,
          entityType: 'daily_mission',
          entityId: missionId,
          modelId: u.modelId,
          providerRequestId: u.providerRequestId,
          promptTokens: u.promptTokens,
          completionTokens: u.completionTokens,
          cachedTokens: u.cachedTokens,
          totalTokens: u.totalTokens,
          estimatedCostUsdMicros: u.estimatedCostUsdMicros,
          costUsdSource: u.costUsdSource,
          latencyMs: u.latencyMs,
        }).catch(() => {});
      }
    }
    const targetKeys = synthesized.payload.forcedTargets.map((t) => t.canonicalKey);
    const dueCardIds = synthesized.payload.warmupCardIds;

    if (db) {
      await db
        .insert(dailyMissions)
        .values({
          missionId,
          accountKey,
          edition: env.EDITION,
          examTrack,
          missionDaySerial: daySerial,
          status: 'ready',
          targetNodeKeysJson: targetKeys,
          dueCardIdsJson: dueCardIds,
          focusTopic,
          missionPayloadJson: synthesized.payload,
          modelId: synthesized.modelId,
          promptVersion: synthesized.promptVersion,
        })
        .onConflictDoNothing();

      const [stored] = await db
        .select()
        .from(dailyMissions)
        .where(
          and(
            eq(dailyMissions.accountKey, accountKey),
            eq(dailyMissions.edition, env.EDITION),
            eq(dailyMissions.missionDaySerial, daySerial),
          ),
        )
        .limit(1);

      if (stored) {
        return c.json(
          DailyMissionResponseSchema.parse({
            missionId: stored.missionId,
            edition: env.EDITION,
            examTrack: stored.examTrack,
            missionDaySerial: stored.missionDaySerial,
            status: stored.status,
            focusTopic: stored.focusTopic,
            payload: stored.missionPayloadJson,
            evaluationResult: stored.evaluationResultJson ?? null,
          }),
          200,
        );
      }
    }

    const dto = DailyMissionResponseSchema.parse({
      missionId,
      edition: env.EDITION,
      examTrack,
      missionDaySerial: daySerial,
      status: 'ready',
      focusTopic,
      payload: synthesized.payload,
      evaluationResult: null,
    });
    memoryMissions.set(`${accountKey}:${env.EDITION}:${daySerial}`, dto);
    return c.json(dto, 200);
  });

  const completeMissionRoute = createRoute({
    method: 'post',
    path: '/v1/missions/{missionId}/complete',
    request: {
      params: z.object({ missionId: z.string().uuid() }),
      body: {
        required: true,
        content: { 'application/json': { schema: CompleteDailyMissionRequestSchema } },
      },
    },
    responses: {
      200: {
        description: 'Mission completed and Linguistic Graph updated.',
        content: { 'application/json': { schema: DailyMissionResponseSchema } },
      },
      400: {
        description: 'Missing responseText or audioObjectKey.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      404: {
        description: 'Mission not found.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(completeMissionRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        {
          code: 'unauthorized' as const,
          message: 'Auth required',
          requestId: c.get('requestId'),
        },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const { missionId } = c.req.param();
    const body = c.req.valid('json');

    if (!body.responseText && !body.audioObjectKey) {
      return c.json(
        {
          code: 'validation_error' as const,
          message: 'Provide either responseText or audioObjectKey.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    let missionRow: typeof dailyMissions.$inferSelect | undefined;
    let memMission: z.infer<typeof DailyMissionResponseSchema> | undefined;

    if (db) {
      const [row] = await db
        .select()
        .from(dailyMissions)
        .where(
          and(
            eq(dailyMissions.missionId, missionId),
            eq(dailyMissions.accountKey, accountKey),
            eq(dailyMissions.edition, env.EDITION),
          ),
        )
        .limit(1);
      if (!row) {
        return c.json(
          {
            code: 'not_found' as const,
            message: 'Mission not found.',
            requestId: c.get('requestId'),
          },
          404,
        );
      }
      missionRow = row;
    } else {
      for (const item of memoryMissions.values()) {
        if (item.missionId === missionId) {
          memMission = item;
          break;
        }
      }
      if (!memMission) {
        return c.json(
          {
            code: 'not_found' as const,
            message: 'Mission not found.',
            requestId: c.get('requestId'),
          },
          404,
        );
      }
    }

    const missionPayload = (missionRow?.missionPayloadJson ?? memMission!.payload) as z.infer<
      typeof DailyMissionResponseSchema
    >['payload'];
    const forcedTargets = missionPayload.forcedTargets ?? [];
    const targetPhrases = forcedTargets.map((t) => t.phraseEn);

    let sampleText = body.responseText ?? '';
    let preparedAudio: { base64Data: string; format: 'm4a' | 'mp3' | 'wav' } | undefined;
    if (!sampleText && body.audioObjectKey) {
      if (!body.audioObjectKey.startsWith(`users/${deviceId}/`)) {
        return c.json(
          {
            code: 'validation_error' as const,
            message: 'Audio objectKey does not belong to authenticated device.',
            requestId: c.get('requestId'),
          },
          400,
        );
      }
      const obj = await internalS3.send(
        new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: body.audioObjectKey }),
      );
      if (obj.Body) {
        const buf = await bufferAudioStream(obj.Body as NodeJS.ReadableStream);
        preparedAudio = await prepareAudioForModel(buf, body.audioObjectKey, {
          maxDurationSeconds: 180,
        });
        sampleText = `Spoken mission submission (${preparedAudio.format})`;
      }
    }

    let evaluationResult: z.infer<typeof DailyMissionResponseSchema>['evaluationResult'];
    const evalUsages: AiUsageRecord[] = [];
    try {
      evaluationResult = await evaluateMissionResponseGraph(
        {
          edition: env.EDITION,
          examTrack: missionRow?.examTrack ?? memMission?.examTrack ?? 'ielts_academic',
          focusTopic: missionRow?.focusTopic ?? memMission?.focusTopic ?? 'General',
          forcedTargets: forcedTargets.map((f) => ({ phraseEn: f.phraseEn })),
          responseText: sampleText && !sampleText.startsWith('Spoken mission submission') ? sampleText : undefined,
          base64AudioData: preparedAudio?.base64Data,
          audioFormat: preparedAudio?.format,
        },
        {
          allowDemoEvaluator: env.ALLOW_DEMO_EVALUATOR || !env.OPENROUTER_API_KEY,
          routingTier: 'standard',
          onUsage: (u) => {
            evalUsages.push(u);
          },
        },
      );
    } catch {
      const lower = sampleText.toLowerCase();
      const matched = targetPhrases.filter((p) => {
        const core = p.toLowerCase().replace(/\.\.\./g, '').trim().split(/\s+/).slice(0, 2).join(' ');
        return core.length >= 3 && lower.includes(core);
      });
      const missed = targetPhrases.filter((p) => !matched.includes(p));
      evaluationResult = {
        matchedTargets: matched,
        missedTargets: missed,
        feedbackEn:
          matched.length > 0
            ? `Great transfer! Integrated ${matched.join(', ')} directly in context.`
            : 'Submitted! Try recycling one target expression explicitly in your opening sentence next time.',
        feedbackFa:
          env.EDITION === 'irn'
            ? matched.length > 0
              ? `عالی بود! ساختار هدف (${matched.join('، ')}) را به‌درستی در پاسخ به کار بردید.`
              : 'پاسخ ثبت شد؛ در تمرین بعدی سعی کنید هر دو ساختار هدف را صریح‌تر در جمله اول بیاورید.'
            : null,
        clarityScore1To5: matched.length > 0 ? 5 : 4,
        transcriptEn: sampleText || null,
        inlineUpgrades: [],
        modelRewriteEn: null,
      };
    }

    const effectiveSampleForGraph =
      evaluationResult.transcriptEn?.trim() ||
      (sampleText && !sampleText.startsWith('Spoken mission submission') ? sampleText : '');

    if (db && missionRow) {
      await db
        .update(dailyMissions)
        .set({
          status: 'completed',
          evaluationResultJson: evaluationResult,
          completedAt: new Date(),
        })
        .where(eq(dailyMissions.missionId, missionId));

      for (const u of evalUsages) {
        await recordAiUsageLedger({
          db,
          accountKey,
          deviceId,
          edition: env.EDITION,
          featureKind: u.featureKind,
          entityType: 'daily_mission',
          entityId: missionId,
          modelId: u.modelId,
          providerRequestId: u.providerRequestId,
          promptTokens: u.promptTokens,
          completionTokens: u.completionTokens,
          cachedTokens: u.cachedTokens,
          totalTokens: u.totalTokens,
          estimatedCostUsdMicros: u.estimatedCostUsdMicros,
          costUsdSource: u.costUsdSource,
          latencyMs: u.latencyMs,
        }).catch(() => {});
      }
      await recordUserActivityLedger({
        db,
        accountKey,
        deviceId,
        edition: env.EDITION,
        activityKind: 'mission_completed',
        entityType: 'daily_mission',
        entityId: missionId,
        topicKey: normalizeCanonicalTopicKey(missionRow.focusTopic) ?? missionRow.focusTopic,
        metadata: { clarityScore1To5: evaluationResult.clarityScore1To5 },
      }).catch(() => {});

      if (effectiveSampleForGraph.length >= 10) {
        // Non-blocking background graph update so HTTP 200 returns without delay.
        void (async () => {
          try {
            const graphOut = await updateLinguisticGraphSignals(
              {
                edition: env.EDITION,
                sourceKind: 'mission',
                textSample: effectiveSampleForGraph,
                dueTargetPhrases: evaluationResult.matchedTargets,
                topicHint: missionRow.focusTopic,
              },
              { allowDemoEvaluator: env.ALLOW_DEMO_EVALUATOR || !env.OPENROUTER_API_KEY },
            );
            await upsertLinguisticGraphSignals({
              db,
              accountKey,
              edition: env.EDITION,
              sourceKind: 'mission',
              sourceRefId: missionId,
              signals: graphOut.signals,
            });
          } catch {
            // Non-blocking graph update
          }
        })();
      }

      return c.json(
        DailyMissionResponseSchema.parse({
          missionId: missionRow.missionId,
          edition: env.EDITION,
          examTrack: missionRow.examTrack,
          missionDaySerial: missionRow.missionDaySerial,
          status: 'completed',
          focusTopic: missionRow.focusTopic,
          payload: missionPayload,
          evaluationResult,
        }),
        200,
      );
    }

    const updatedMem = DailyMissionResponseSchema.parse({
      ...memMission!,
      status: 'completed',
      evaluationResult,
    });
    memoryMissions.set(`${accountKey}:${env.EDITION}:${updatedMem.missionDaySerial}`, updatedMem);
    return c.json(updatedMem, 200);
  });

  const refreshTodayMissionRoute = createRoute({
    method: 'post',
    path: '/v1/missions/today/refresh',
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: RefreshDailyMissionRequestSchema } },
      },
    },
    responses: {
      200: {
        description: "Updates today's uncompleted Daily Coach session to a newly picked topic (max 2/day).",
        content: { 'application/json': { schema: DailyMissionResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      429: {
        description: 'Daily topic refresh limit (2/day) reached.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(refreshTodayMissionRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const { focusTopic, examTrack } = c.req.valid('json');
    const daySerial = getUtcDaySerial();
    const refreshKey = `${accountKey}:${env.EDITION}:${daySerial}`;
    const usedRefreshes = dailyRefreshCounts.get(refreshKey) ?? 0;
    if (usedRefreshes >= 2) {
      return c.json(
        {
          code: 'quota_exceeded' as const,
          message: 'You can switch today’s Coach topic up to 2 times per day.',
          requestId: c.get('requestId'),
        },
        429,
      );
    }
    dailyRefreshCounts.set(refreshKey, usedRefreshes + 1);

    const synthesized = buildCuratedStarterMission({
      edition: env.EDITION,
      examTrack,
      focusTopic,
      bottlenecks: [],
      dueCards: [],
    });

    if (db) {
      await updateGraphInterestPreferences({
        db,
        accountKey,
        edition: env.EDITION,
        pinTopics: [focusTopic],
        muteTopics: [],
      }).catch(() => {});

      const existingRows = await db
        .select()
        .from(dailyMissions)
        .where(
          and(
            eq(dailyMissions.accountKey, accountKey),
            eq(dailyMissions.edition, env.EDITION),
            eq(dailyMissions.missionDaySerial, daySerial),
          ),
        )
        .limit(1);

      const existing = existingRows[0];
      if (existing && existing.status === 'ready') {
        await db
          .update(dailyMissions)
          .set({
            focusTopic,
            examTrack,
            missionPayloadJson: synthesized.payload,
            modelId: synthesized.modelId,
            promptVersion: synthesized.promptVersion,
          })
          .where(eq(dailyMissions.missionId, existing.missionId));

        return c.json(
          DailyMissionResponseSchema.parse({
            missionId: existing.missionId,
            edition: env.EDITION,
            examTrack,
            missionDaySerial: daySerial,
            status: 'ready',
            focusTopic,
            payload: synthesized.payload,
            evaluationResult: null,
          }),
          200,
        );
      }

      if (!existing) {
        const missionId = randomUUID();
        await db
          .insert(dailyMissions)
          .values({
            missionId,
            accountKey,
            edition: env.EDITION,
            examTrack,
            missionDaySerial: daySerial,
            status: 'ready',
            targetNodeKeysJson: synthesized.payload.forcedTargets.map((t) => t.canonicalKey),
            dueCardIdsJson: [],
            focusTopic,
            missionPayloadJson: synthesized.payload,
            modelId: synthesized.modelId,
            promptVersion: synthesized.promptVersion,
          })
          .onConflictDoNothing();

        return c.json(
          DailyMissionResponseSchema.parse({
            missionId,
            edition: env.EDITION,
            examTrack,
            missionDaySerial: daySerial,
            status: 'ready',
            focusTopic,
            payload: synthesized.payload,
            evaluationResult: null,
          }),
          200,
        );
      }

      return c.json(
        DailyMissionResponseSchema.parse({
          missionId: existing.missionId,
          edition: env.EDITION,
          examTrack: existing.examTrack,
          missionDaySerial: existing.missionDaySerial,
          status: existing.status,
          focusTopic: existing.focusTopic,
          payload: existing.missionPayloadJson,
          evaluationResult: existing.evaluationResultJson ?? null,
        }),
        200,
      );
    }

    const dto = DailyMissionResponseSchema.parse({
      missionId: randomUUID(),
      edition: env.EDITION,
      examTrack,
      missionDaySerial: daySerial,
      status: 'ready',
      focusTopic,
      payload: synthesized.payload,
      evaluationResult: null,
    });
    memoryMissions.set(refreshKey, dto);
    return c.json(dto, 200);
  });
}

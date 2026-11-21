import { randomUUID } from 'node:crypto';
import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import {
  planDailyMissionDemoOnly,
  planDailyMissionGraph,
  prepareAudioForModel,
  bufferAudioStream,
  OpenRouterAlphaClient,
  updateLinguisticGraphSignals,
} from '@mockza/ai';
import type { AppEnv } from '@mockza/config';
import {
  ApiErrorSchema,
  CompleteDailyMissionRequestSchema,
  DailyMissionResponseSchema,
  LinguisticGraphResponseSchema,
  UpdateGraphInterestsRequestSchema,
} from '@mockza/contracts';
import {
  dailyMissions,
  getUtcDaySerial,
  listLinguisticGraphForAccount,
  type MockzaDb,
  updateGraphInterestPreferences,
  upsertLinguisticGraphSignals,
} from '@mockza/db';
import { rankTopMissionTargets } from '@mockza/domain';
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
            canonicalKey: `topic:${topic.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
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
    const pinnedInterest = activeInterests.find((t) => t.isPinned);
    const focusTopic =
      pinnedInterest?.displayLabelEn ??
      activeInterests[0]?.displayLabelEn ??
      'Technology & Modern Work';

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

    const synthesized = await planDailyMissionGraph(
      {
        edition: env.EDITION,
        examTrack,
        focusTopic,
        bottlenecks,
        dueCards: parsedDueWords,
      },
      {
        allowDemoEvaluator: env.ALLOW_DEMO_EVALUATOR || !env.OPENROUTER_API_KEY,
        routingTier: 'flex',
      },
    ).catch((err) => {
      if (env.NODE_ENV !== 'production') {
        return planDailyMissionDemoOnly({
          edition: env.EDITION,
          examTrack,
          focusTopic,
          bottlenecks,
          dueCards: parsedDueWords,
        });
      }
      throw err;
    });

    const missionId = randomUUID();
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
    if (!sampleText && body.audioObjectKey && s3Client) {
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

    let matchedTargets: string[] = [];
    let clarityScore = 4;

    if (env.OPENROUTER_API_KEY && (sampleText || preparedAudio)) {
      try {
        const alpha = new OpenRouterAlphaClient({ apiKey: env.OPENROUTER_API_KEY });
        const checkRes = await alpha.callDecisionsApi({
          routingTier: 'standard',
          messages: [
            {
              role: 'system',
              content: 'Evaluate daily mission response against forced linguistic targets.',
            },
            preparedAudio
              ? {
                  role: 'user',
                  content: [
                    { type: 'text', text: `Targets: ${targetPhrases.join(', ')}` },
                    {
                      type: 'input_audio',
                      input_audio: { data: preparedAudio.base64Data, format: preparedAudio.format },
                    },
                  ],
                }
              : {
                  role: 'user',
                  content: `Targets: ${targetPhrases.join(', ')}\nLearner response:\n${sampleText}`,
                },
          ],
          questions: [
            ...targetPhrases.map((phrase, idx) => ({
              id: `target_${idx}`,
              kind: 'noul' as const,
              prompt: `Did the learner meaningfully incorporate "${phrase}" or an equivalent target clause?`,
            })),
            {
              id: 'clarity_1_to_5',
              kind: 'score' as const,
              prompt: 'Rate clarity and natural cohesion from 1 to 5.',
              minScore: 1,
              maxScore: 5,
            },
          ],
        });
        matchedTargets = targetPhrases.filter(
          (_p, idx) => checkRes.outcomes[`target_${idx}`]?.boolValue === true,
        );
        clarityScore = checkRes.outcomes['clarity_1_to_5']?.scoreValue ?? 4;
      } catch {
        const lower = sampleText.toLowerCase();
        matchedTargets = targetPhrases.filter((p) => lower.includes(p.toLowerCase()));
      }
    } else {
      const lower = sampleText.toLowerCase();
      matchedTargets = targetPhrases.filter((p) => lower.includes(p.toLowerCase()));
      clarityScore = matchedTargets.length > 0 ? 5 : 4;
    }

    const evaluationResult = {
      matchedTargets,
      feedbackEn:
        matchedTargets.length > 0
          ? `Great transfer! Integrated ${matchedTargets.join(', ')} directly in context.`
          : 'Submitted! Try recycling one forced target explicitly in your opening clause next time.',
      feedbackFa:
        env.EDITION === 'irn'
          ? matchedTargets.length > 0
            ? `عالی بود! ساختار هدف (${matchedTargets.join('، ')}) را به‌درستی در پاسخ به کار بردید.`
            : 'پاسخ ثبت شد؛ در مأموریت بعدی سعی کنید هر دو ساختار هدف را صریح‌تر در جمله اول بیاورید.'
          : null,
      clarityScore1To5: clarityScore,
    };

    if (db && missionRow) {
      await db
        .update(dailyMissions)
        .set({
          status: 'completed',
          evaluationResultJson: evaluationResult,
          completedAt: new Date(),
        })
        .where(eq(dailyMissions.missionId, missionId));

      try {
        const graphOut = await updateLinguisticGraphSignals(
          {
            edition: env.EDITION,
            sourceKind: 'mission',
            textSample: sampleText || `Mission completed: ${missionRow.focusTopic}`,
            dueTargetPhrases: matchedTargets,
            topicHint: missionRow.focusTopic,
          },
          { allowDemoEvaluator: true },
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
}

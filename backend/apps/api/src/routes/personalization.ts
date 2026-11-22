import { randomUUID } from 'node:crypto';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import {
  AckBandShiftResponseSchema,
  ApiErrorSchema,
  PersonalizationStateResponseSchema,
  RecordBandEventRequestSchema,
  RoadmapStepActionRequestSchema,
  UpdatePersonalizationProfileRequestSchema,
} from '@mockza/contracts';
import {
  acknowledgeBandShift,
  advanceRoadmapStep,
  computeFullPersonalizationState,
  type MockzaDb,
  recordBandEventAndRecalculate,
  recordUserActivityLedger,
  updateLearnerProfile,
  upsertUserAttemptSync,
} from '@mockza/db';
import {
  type CoreExamSkill,
  generateOrRecalibrateRoadmap,
  normalizeFavoriteTopicList,
  normalizeSupportedExamId,
} from '@mockza/domain';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';

export function registerPersonalizationRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db);
  app.use('/v1/personalization/*', authMiddleware);

  const memoryProfiles = new Map<
    string,
    {
      examTrack: string;
      targetBand: number;
      targetDateIso: string | null;
      dailyMinutesGoal: number;
      studyFocus: 'exams' | 'coach' | 'both' | 'speaking_only';
      favoriteTopics: string[];
      vocabUnlockedWave: number;
      dailyNewVocabCap: number;
      preferredTtsAccent: 'us' | 'uk';
      bandShiftAcknowledged: boolean;
      onboardingCompleted: boolean;
    }
  >();

  function buildMemoryState(accountKey: string) {
    const prof = memoryProfiles.get(accountKey) ?? {
      examTrack: 'ielts_academic',
      targetBand: 7.5,
      targetDateIso: null,
      dailyMinutesGoal: 30,
      studyFocus: 'both' as const,
      favoriteTopics: ['technology_ai', 'career_workplace'],
      vocabUnlockedWave: 1,
      dailyNewVocabCap: 10,
      preferredTtsAccent: 'us' as const,
      bandShiftAcknowledged: false,
      onboardingCompleted: false,
    };
    const examId = normalizeSupportedExamId(prof.examTrack);
    const favs = normalizeFavoriteTopicList(prof.favoriteTopics);
    const roadmap = generateOrRecalibrateRoadmap({
      examId,
      currentBand: null,
      targetBand: prof.targetBand,
      targetDateSerial: null,
      todaySerial: Math.floor(Date.now() / 86_400_000),
      studyFocus:
        prof.studyFocus === 'speaking_only' || prof.studyFocus === 'coach'
          ? 'coach'
          : prof.studyFocus === 'exams'
            ? 'exams'
            : 'both',
      dailyMinutesGoal: prof.dailyMinutesGoal,
      favoriteTopics: favs,
      weaknessNodes: [],
      coverage: [],
      packs: [],
      drills: [],
      diagnosticDone: false,
      currentVocabWave: prof.vocabUnlockedWave,
    });
    const planId = randomUUID();
    const mappedSteps = roadmap.steps.map((s) => ({
      stepId: s.stepKey,
      milestoneIndex: s.milestoneIndex,
      stepOrder: s.stepOrder,
      stepKind: s.stepKind,
      skill: s.skill,
      titleEn: s.titleEn,
      titleFa: s.titleFa,
      reasonEn: s.reasonEn,
      reasonFa: s.reasonFa,
      topicKey: s.topicKey,
      weaknessKey: s.weaknessKey,
      targetRoute: s.stepKind === 'vocab_wave' ? '/vocab' : '/roadmap',
      targetEntityId: s.targetRefId,
      status: s.status === 'locked_preview' ? ('locked' as const) : s.status,
      estimatedMinutes: s.estimatedMinutes,
    }));
    const baseline = Math.max(5.0, prof.targetBand - 1.0);
    return PersonalizationStateResponseSchema.parse({
      profile: {
        examTrack: examId,
        targetBand: prof.targetBand,
        targetDateIso: prof.targetDateIso,
        dailyMinutesGoal: prof.dailyMinutesGoal,
        studyFocus: prof.studyFocus,
        favoriteTopics: favs,
        activeWeaknessPhase: 'favorite_topics',
        vocabUnlockedWave: prof.vocabUnlockedWave,
        dailyNewVocabCap: prof.dailyNewVocabCap,
        preferredTtsAccent: prof.preferredTtsAccent,
        bandShiftAcknowledged: prof.bandShiftAcknowledged,
        onboardingCompleted: prof.onboardingCompleted,
      },
      liveBand: {
        examTrack: examId,
        currentBand: null,
        targetBand: prof.targetBand,
        bandShift: 0,
        confidence: 'provisional',
        skills: {
          reading: { score: null, confidence: 'provisional', evidenceCount: 0, lastUpdatedAt: null, trendDelta: null },
          listening: { score: null, confidence: 'provisional', evidenceCount: 0, lastUpdatedAt: null, trendDelta: null },
          writing: { score: null, confidence: 'provisional', evidenceCount: 0, lastUpdatedAt: null, trendDelta: null },
          speaking: { score: null, confidence: 'provisional', evidenceCount: 0, lastUpdatedAt: null, trendDelta: null },
        },
      },
      weaknesses: [],
      roadmap: {
        planId,
        examTrack: examId,
        planRevision: 1,
        baselineBand: baseline,
        targetBand: prof.targetBand,
        isSprintMode: roadmap.isSprintMode,
        milestones: roadmap.milestones.map((m) => ({
          index: m.index,
          titleEn: m.titleEn,
          titleFa: m.titleFa,
          phaseLabelEn: m.goalEn,
          phaseLabelFa: m.goalFa,
          targetBandDelta: Number((m.targetBandMarker - baseline).toFixed(1)),
          status: m.status === 'upcoming' ? 'locked' : m.status,
        })),
        currentStep: mappedSteps[0] ?? null,
        steps: mappedSteps,
      },
      nextRecommendedPack: null,
      nextRecommendedDrill: null,
      recommendedPacks: [],
      recommendedDrills: [],
      vocabWaveSummary: {
        unlockedWave: prof.vocabUnlockedWave,
        totalWaves: 1,
        currentWaveTotal: 0,
        currentWaveLearned: 0,
        readyToUnlockNext: false,
        dailyNewRemaining: 10,
      },
      topicCoverageSummary: {
        phase: 'favorite_topics',
        masteredInFavoriteTopicsCount: 0,
        transferredToOtherTopicsCount: 0,
      },
    });
  }

  const getStateRoute = createRoute({
    method: 'get',
    path: '/v1/personalization/state',
    responses: {
      200: {
        description: 'Unified adaptive personalization state, live band, roadmap, and vocab waves.',
        content: { 'application/json': { schema: PersonalizationStateResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(getStateRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    if (!db) {
      return c.json(buildMemoryState(accountKey), 200);
    }
    const state = await computeFullPersonalizationState({
      db,
      accountKey,
      edition: env.EDITION,
      recalibrateRoadmap: false,
    });
    return c.json(PersonalizationStateResponseSchema.parse(state), 200);
  });

  const updateProfileRoute = createRoute({
    method: 'put',
    path: '/v1/personalization/profile',
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: UpdatePersonalizationProfileRequestSchema } },
      },
    },
    responses: {
      200: {
        description: 'Updated learner profile and recalibrated roadmap.',
        content: { 'application/json': { schema: PersonalizationStateResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(updateProfileRoute, async (c) => {
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
      const cur = memoryProfiles.get(accountKey) ?? {
        examTrack: 'ielts_academic',
        targetBand: 7.5,
        targetDateIso: null,
        dailyMinutesGoal: 30,
        studyFocus: 'both' as const,
        favoriteTopics: ['technology_ai', 'career_workplace'],
        vocabUnlockedWave: 1,
        dailyNewVocabCap: 10,
        preferredTtsAccent: 'us' as const,
        bandShiftAcknowledged: false,
        onboardingCompleted: false,
      };
      memoryProfiles.set(accountKey, {
        examTrack: body.examTrack ?? cur.examTrack,
        targetBand: body.targetBand ?? cur.targetBand,
        targetDateIso: body.targetDateIso !== undefined ? body.targetDateIso : cur.targetDateIso,
        dailyMinutesGoal: body.dailyMinutesGoal ?? cur.dailyMinutesGoal,
        studyFocus: body.studyFocus ?? cur.studyFocus,
        favoriteTopics: body.favoriteTopics ?? cur.favoriteTopics,
        vocabUnlockedWave: body.unlockNextVocabWave
          ? cur.vocabUnlockedWave + 1
          : cur.vocabUnlockedWave,
        dailyNewVocabCap: body.dailyNewVocabCap ?? cur.dailyNewVocabCap,
        preferredTtsAccent: body.preferredTtsAccent ?? cur.preferredTtsAccent,
        bandShiftAcknowledged: cur.bandShiftAcknowledged,
        onboardingCompleted: body.onboardingCompleted ?? cur.onboardingCompleted,
      });
      return c.json(buildMemoryState(accountKey), 200);
    }

    const updated = await updateLearnerProfile({
      db,
      accountKey,
      edition: env.EDITION,
      patch: body,
    });
    await recordUserActivityLedger({
      db,
      accountKey,
      deviceId,
      edition: env.EDITION,
      activityKind: body.unlockNextVocabWave ? 'vocab_wave_unlock' : 'profile_update',
      entityType: 'learner_profile',
      entityId: accountKey,
      topicKey: body.favoriteTopics?.[0] ?? null,
    });
    return c.json(PersonalizationStateResponseSchema.parse(updated), 200);
  });

  const recordBandEventRoute = createRoute({
    method: 'post',
    path: '/v1/personalization/band-event',
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: RecordBandEventRequestSchema } },
      },
    },
    responses: {
      200: {
        description: 'Recorded band evidence event and recalculated roadmap.',
        content: { 'application/json': { schema: PersonalizationStateResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(recordBandEventRoute, async (c) => {
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
      const cur = memoryProfiles.get(accountKey);
      if (cur) {
        memoryProfiles.set(accountKey, { ...cur, bandShiftAcknowledged: false });
      }
      return c.json(buildMemoryState(accountKey), 200);
    }

    const nextState = await recordBandEventAndRecalculate({
      db,
      accountKey,
      edition: env.EDITION,
      examTrack: body.examTrack,
      skill: body.skill as CoreExamSkill,
      sourceKind: body.sourceKind,
      sourceId: body.sourceId,
      rawScore: body.rawScore,
      cefrEstimate: body.cefrEstimate ?? null,
      durationSeconds: body.durationSeconds,
      accuracyRatio: body.accuracyRatio,
      topicKeys: body.topicKeys,
      questionTypeStats: body.questionTypeStats,
    });

    if (body.attemptId && body.packId) {
      await upsertUserAttemptSync({
        db,
        attemptId: body.attemptId,
        accountKey,
        edition: env.EDITION,
        packId: body.packId,
        examId: normalizeSupportedExamId(body.examTrack),
        skill: body.skill,
        mode: body.sourceKind,
        status: 'completed',
        scoreBand: body.scoreBand ?? body.rawScore,
        durationSeconds: body.durationSeconds ?? 0,
        answersJson: body.answersJson ?? null,
        feedbackJson: body.feedbackJson ?? null,
        topicKeys: body.topicKeys,
        deviceId,
      });
    }

    await recordUserActivityLedger({
      db,
      accountKey,
      deviceId,
      edition: env.EDITION,
      activityKind: `${body.sourceKind}_completed`,
      entityType: body.packId ? 'exam_pack' : body.sourceKind,
      entityId: body.packId ?? body.sourceId,
      topicKey: body.topicKeys[0] ?? null,
      durationSeconds: body.durationSeconds ?? null,
      metadata: {
        skill: body.skill,
        rawScore: body.rawScore,
        accuracyRatio: body.accuracyRatio ?? null,
      },
    });

    return c.json(PersonalizationStateResponseSchema.parse(nextState), 200);
  });

  const stepActionRoute = createRoute({
    method: 'post',
    path: '/v1/personalization/roadmap/steps/{stepId}/action',
    request: {
      params: z.object({ stepId: z.string().min(1) }),
      body: {
        required: true,
        content: { 'application/json': { schema: RoadmapStepActionRequestSchema } },
      },
    },
    responses: {
      200: {
        description: 'Advanced roadmap step status.',
        content: { 'application/json': { schema: PersonalizationStateResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(stepActionRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const { stepId } = c.req.valid('param');
    const body = c.req.valid('json');
    if (!db) {
      return c.json(buildMemoryState(accountKey), 200);
    }

    const updated = await advanceRoadmapStep({
      db,
      accountKey,
      edition: env.EDITION,
      stepId,
      status: body.status,
    });
    await recordUserActivityLedger({
      db,
      accountKey,
      deviceId,
      edition: env.EDITION,
      activityKind: `roadmap_step_${body.status}`,
      entityType: 'roadmap_step',
      entityId: stepId,
    });
    return c.json(PersonalizationStateResponseSchema.parse(updated), 200);
  });

  const ackBandShiftRoute = createRoute({
    method: 'post',
    path: '/v1/personalization/band-shift/ack',
    responses: {
      200: {
        description: 'Acknowledge band shift banner.',
        content: { 'application/json': { schema: AckBandShiftResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(ackBandShiftRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    if (db) {
      await acknowledgeBandShift({ db, accountKey, edition: env.EDITION });
    } else {
      const cur = memoryProfiles.get(accountKey) ?? {
        examTrack: 'ielts_academic',
        targetBand: 7.5,
        targetDateIso: null,
        dailyMinutesGoal: 30,
        studyFocus: 'both' as const,
        favoriteTopics: ['technology_ai', 'career_workplace'],
        vocabUnlockedWave: 1,
        dailyNewVocabCap: 10,
        preferredTtsAccent: 'us' as const,
        bandShiftAcknowledged: true,
        onboardingCompleted: false,
      };
      memoryProfiles.set(accountKey, { ...cur, bandShiftAcknowledged: true });
    }
    return c.json(AckBandShiftResponseSchema.parse({ ok: true, bandShift: 0 }), 200);
  });
}

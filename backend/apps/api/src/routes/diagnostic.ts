import { createHash, randomUUID } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import {
  ApiErrorSchema,
  CreateDiagnosticSessionRequestSchema,
  DiagnosticBankResponseSchema,
  DiagnosticSessionResponseSchema,
  RetakeDiagnosticSkillRequestSchema,
  SubmitDiagnosticSessionRequestSchema,
} from '@mockza/contracts';
import {
  audioAssets,
  DIAGNOSTIC_ALT_SPEAKING_PROMPT,
  DIAGNOSTIC_ALT_WRITING_PROMPT,
  DIAGNOSTIC_EXAM_SCALE_INFO,
  DIAGNOSTIC_LISTENING_BANK,
  DIAGNOSTIC_READING_BANK,
  DIAGNOSTIC_SPEAKING_PROMPT,
  DIAGNOSTIC_WORKED_EXAMPLES,
  DIAGNOSTIC_WRITING_PROMPT,
  diagnosticSessions,
  evaluationJobs,
  jobDispatchOutbox,
  type MockzaDb,
  quotaReservations,
  recordBandEventAndRecalculate,
  recordUserActivityLedger,
} from '@mockza/db';
import {
  type AuthoringTier,
  type BlockAttemptRecord,
  classifyBlockOutcome,
  DIAGNOSTIC_POLICY_VERSION,
  type DiagnosticBlockDef,
  type DiagnosticSkill,
  mapCefrTierToExamScore,
  normalizeSupportedExamId,
  type DiagnosticSkillStatus,
  type DiagnosticStopReason,
  DomainError,
  deriveObjectivePlacement,
  type NoEvidenceReason,
  type ObjectivePlacementResult,
  STANDARD_DIAGNOSTIC_BUDGET_SECONDS,
} from '@mockza/domain';
import { createAudioS3Client, verifyUploadedAudioObject } from '@mockza/storage';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type PgBoss from 'pg-boss';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import type { RequestVariables } from '../middleware/request-id.js';
import { reserveQuotaAtomic } from '../services/quota.js';
import { SPEAKING_QUEUE, WRITING_QUEUE } from './evaluate.js';

const DIAGNOSTIC_CONTENT_VERSION = 'diag-2026-11-17.v1';
const COLLECTION_BUDGET_MS = STANDARD_DIAGNOSTIC_BUDGET_SECONDS.collectionTotal * 1000;
const TOTAL_BUDGET_MS = STANDARD_DIAGNOSTIC_BUDGET_SECONDS.total * 1000;

interface SkillOutcomeDto {
  skill: DiagnosticSkill;
  status: DiagnosticSkillStatus;
  suggestedPracticeLevel: string | null;
  suggestedTier?: AuthoringTier | null;
  observations: string[];
  weaknessFocus: string | null;
  recommendedDrillType?: string | null;
  jobId?: string | null;
  attemptId?: string | null;
  errorCode?: string | null;
  quotaRefunded: boolean;
  reducedSampling: boolean;
  hasContradictoryEvidence: boolean;
  stopReason?: DiagnosticStopReason | null;
}

function sha256Json(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function toSkillBlockDto(b: DiagnosticBlockDef) {
  return {
    blockId: b.blockId,
    skill: b.skill,
    tier: b.tier,
    scenarioId: b.scenarioId,
    title: b.title,
    ...(b.passageText ? { passageText: b.passageText } : {}),
    ...(b.scriptText ? { scriptText: b.scriptText } : {}),
    ...(b.mediaObjectKey ? { mediaUrl: `/v1/media/${b.mediaObjectKey}` } : {}),
    ...(b.durationSeconds !== undefined ? { durationSeconds: b.durationSeconds } : {}),
    minRequiredSeconds: b.minRequiredSeconds,
    questions: b.questions,
  };
}

function recomputeObjectiveSkill(params: {
  skill: 'reading' | 'listening';
  bank: readonly DiagnosticBlockDef[];
  inputs: ReadonlyArray<{
    blockId: string;
    tier: AuthoringTier;
    selectedOptionIndices: Array<number | null>;
    noEvidenceReason?: NoEvidenceReason;
    elapsedSeconds?: number;
  }>;
  stopReason: DiagnosticStopReason | null;
  skipped: boolean;
}): ObjectivePlacementResult {
  const byId = new Map(params.bank.map((b) => [b.blockId, b] as const));
  const history: BlockAttemptRecord[] = [];
  for (const item of params.inputs) {
    const def = byId.get(item.blockId);
    if (!def) continue;
    const classified = classifyBlockOutcome({
      questions: def.questions,
      selectedOptionIndices: item.selectedOptionIndices,
      noEvidenceReason: item.noEvidenceReason,
    });
    history.push({
      blockId: def.blockId,
      tier: def.tier,
      category: classified.category,
      selectedOptionIndices: item.selectedOptionIndices,
      correctCount: classified.correctCount,
      noEvidenceReason: classified.noEvidenceReason,
      elapsedSeconds: item.elapsedSeconds,
    });
  }

  return deriveObjectivePlacement({
    skill: params.skill,
    history,
    bank: params.bank,
    stopReason: params.stopReason,
    skippedByUser: params.skipped,
  });
}

function buildDiagnosticQuestionTypeStats(
  bank: readonly DiagnosticBlockDef[],
  inputs: ReadonlyArray<{
    blockId: string;
    selectedOptionIndices: Array<number | null>;
  }>,
): Array<{ questionType: string; correct: number; total: number }> {
  const byId = new Map(bank.map((b) => [b.blockId, b] as const));
  const counts = new Map<string, { correct: number; total: number }>();
  for (const item of inputs) {
    const def = byId.get(item.blockId);
    if (!def) continue;
    def.questions.forEach((q, idx) => {
      const tag = q.focusTag || 'general';
      const entry = counts.get(tag) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (item.selectedOptionIndices[idx] === q.correctIndex) {
        entry.correct += 1;
      }
      counts.set(tag, entry);
    });
  }
  return Array.from(counts.entries()).map(([questionType, v]) => ({
    questionType,
    correct: v.correct,
    total: v.total,
  }));
}

function mapObjectiveToDto(res: ObjectivePlacementResult): SkillOutcomeDto {
  const tier = res.suggestedTierRange?.maxTier ?? null;
  return {
    skill: res.skill,
    status: res.status,
    suggestedPracticeLevel: res.suggestedPracticeLevel,
    suggestedTier: tier,
    observations: res.observations,
    weaknessFocus: res.weaknessFocus,
    recommendedDrillType: res.weaknessFocus
      ? res.skill === 'reading'
        ? 'reading_paraphrase'
        : 'listening_inference'
      : null,
    jobId: null,
    attemptId: null,
    errorCode: null,
    quotaRefunded: false,
    reducedSampling: res.reducedSampling,
    hasContradictoryEvidence: res.hasContradictoryEvidence,
    stopReason: res.stopReason,
  };
}

function extractProductiveSkillDto(params: {
  skill: 'writing' | 'speaking';
  storedFallback?: Partial<SkillOutcomeDto> | null;
  job?: typeof evaluationJobs.$inferSelect | null;
  quotaRefunded: boolean;
}): SkillOutcomeDto {
  const fb = params.storedFallback;
  if (!params.job) {
    return {
      skill: params.skill,
      status: fb?.status ?? 'insufficient_evidence',
      suggestedPracticeLevel: fb?.suggestedPracticeLevel ?? null,
      suggestedTier: fb?.suggestedTier ?? null,
      observations: fb?.observations ?? [`More ${params.skill} evidence is needed.`],
      weaknessFocus: fb?.weaknessFocus ?? null,
      recommendedDrillType: fb?.recommendedDrillType ?? null,
      jobId: null,
      attemptId: fb?.attemptId ?? null,
      errorCode: fb?.errorCode ?? null,
      quotaRefunded: fb?.quotaRefunded ?? false,
      reducedSampling: fb?.reducedSampling ?? true,
      hasContradictoryEvidence: false,
      stopReason: fb?.stopReason ?? null,
    };
  }

  const job = params.job;
  if (job.status === 'completed' && job.resultJson && typeof job.resultJson === 'object') {
    const res = job.resultJson as Record<string, unknown>;
    const status = (
      res['status'] === 'provisional' ||
      res['status'] === 'insufficient_evidence' ||
      res['status'] === 'unscorable'
        ? res['status']
        : 'provisional'
    ) as DiagnosticSkillStatus;
    const observations = Array.isArray(res['observations'])
      ? res['observations'].filter((s): s is string => typeof s === 'string')
      : [];
    return {
      skill: params.skill,
      status,
      suggestedPracticeLevel:
        status === 'provisional' && typeof res['suggestedPracticeLevel'] === 'string'
          ? res['suggestedPracticeLevel']
          : null,
      suggestedTier:
        status === 'provisional' && typeof res['tierHint'] === 'string'
          ? (res['tierHint'] as AuthoringTier)
          : null,
      observations:
        observations.length > 0 ? observations : [`Short ${params.skill} response reviewed.`],
      weaknessFocus: typeof res['weaknessFocus'] === 'string' ? res['weaknessFocus'] : null,
      recommendedDrillType:
        typeof res['recommendedDrillType'] === 'string' ? res['recommendedDrillType'] : null,
      jobId: job.jobId,
      attemptId: job.attemptId,
      errorCode: null,
      quotaRefunded: params.quotaRefunded,
      reducedSampling: status !== 'provisional',
      hasContradictoryEvidence: false,
      stopReason: 'sampling_complete',
    };
  }

  if (job.status === 'failed') {
    return {
      skill: params.skill,
      status: job.errorCode === 'audio_missing' ? 'unscorable' : 'failed',
      suggestedPracticeLevel: null,
      suggestedTier: null,
      observations: [
        job.errorCode === 'audio_missing'
          ? 'Recording was unavailable or could not be decoded.'
          : 'Evaluation did not complete. Retry when ready.',
      ],
      weaknessFocus: null,
      recommendedDrillType: null,
      jobId: job.jobId,
      attemptId: job.attemptId,
      errorCode: job.errorCode ?? 'internal_error',
      quotaRefunded: params.quotaRefunded,
      reducedSampling: true,
      hasContradictoryEvidence: false,
      stopReason: null,
    };
  }

  return {
    skill: params.skill,
    status: 'pending',
    suggestedPracticeLevel: null,
    suggestedTier: null,
    observations: [job.stageDetail ?? `Evaluating your ${params.skill} response...`],
    weaknessFocus: null,
    recommendedDrillType: null,
    jobId: job.jobId,
    attemptId: job.attemptId,
    errorCode: null,
    quotaRefunded: false,
    reducedSampling: false,
    hasContradictoryEvidence: false,
    stopReason: null,
  };
}

function buildRecommendedFirstAction(skills: {
  reading: SkillOutcomeDto;
  listening: SkillOutcomeDto;
  writing: SkillOutcomeDto;
  speaking: SkillOutcomeDto;
}) {
  const all = [skills.reading, skills.listening, skills.writing, skills.speaking];
  const withWeakness = all.find(
    (s) => s.status === 'provisional' && s.weaknessFocus && s.weaknessFocus.trim().length > 0,
  );
  if (withWeakness) {
    return {
      title: `Practice ${withWeakness.skill[0]?.toUpperCase()}${withWeakness.skill.slice(1)}: ${withWeakness.weaknessFocus}`,
      description:
        'Targeted short practice based directly on what appeared in your starting check.',
      drillType: withWeakness.recommendedDrillType ?? null,
      targetSkill: withWeakness.skill,
    };
  }
  return {
    title: 'Explore starter practice across skills',
    description:
      'A short starting check. Your profile improves as you complete everyday Reading, Listening, Writing, and Speaking practice.',
    drillType: null,
    targetSkill: null,
  };
}

export function registerDiagnosticRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
  boss?: PgBoss,
  s3Client?: S3Client,
  isQueueReady?: () => boolean,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db);
  app.use('/v1/diagnostic/sessions*', authMiddleware);

  const getBankRoute = createRoute({
    method: 'get',
    path: '/v1/diagnostic/packs',
    responses: {
      200: {
        description: 'Rapid starting-level check scenario bank and audio references.',
        content: { 'application/json': { schema: DiagnosticBankResponseSchema } },
      },
    },
  });

  app.openapi(getBankRoute, async (c) => {
    const isAlternate = c.req.query('form') === 'alternate';
    const orderFilter = (blocks: readonly DiagnosticBlockDef[]) =>
      isAlternate
        ? [...blocks].sort((a, b) =>
            a.scenarioId === 'learning_routines'
              ? -1
              : b.scenarioId === 'learning_routines'
                ? 1
                : 0,
          )
        : blocks;
    return c.json(
      {
        policyVersion: DIAGNOSTIC_POLICY_VERSION,
        contentVersion: isAlternate
          ? `${DIAGNOSTIC_CONTENT_VERSION}:alt`
          : DIAGNOSTIC_CONTENT_VERSION,
        preflightAudioUrl: '/v1/media/media/listening/diagnostic/preflight_check.m4a',
        budgetSeconds: STANDARD_DIAGNOSTIC_BUDGET_SECONDS,
        workedExamples: {
          reading: DIAGNOSTIC_WORKED_EXAMPLES.reading,
          listening: {
            skill: 'listening' as const,
            passageOrTranscript: DIAGNOSTIC_WORKED_EXAMPLES.listening.passageOrTranscript,
            mediaUrl: `/v1/media/${DIAGNOSTIC_WORKED_EXAMPLES.listening.mediaObjectKey}`,
            questionPrompt: DIAGNOSTIC_WORKED_EXAMPLES.listening.questionPrompt,
            options: DIAGNOSTIC_WORKED_EXAMPLES.listening.options,
            correctIndex: DIAGNOSTIC_WORKED_EXAMPLES.listening.correctIndex,
            explanation: DIAGNOSTIC_WORKED_EXAMPLES.listening.explanation,
          },
        },
        readingBlocks: orderFilter(DIAGNOSTIC_READING_BANK).map(toSkillBlockDto),
        listeningBlocks: orderFilter(DIAGNOSTIC_LISTENING_BANK).map(toSkillBlockDto),
        writingPrompt: isAlternate ? DIAGNOSTIC_ALT_WRITING_PROMPT : DIAGNOSTIC_WRITING_PROMPT,
        speakingPrompt: isAlternate ? DIAGNOSTIC_ALT_SPEAKING_PROMPT : DIAGNOSTIC_SPEAKING_PROMPT,
        examScaleInfo: [...DIAGNOSTIC_EXAM_SCALE_INFO],
      },
      200,
    );
  });

  const createSessionRoute = createRoute({
    method: 'post',
    path: '/v1/diagnostic/sessions',
    request: {
      body: { content: { 'application/json': { schema: CreateDiagnosticSessionRequestSchema } } },
    },
    responses: {
      200: {
        description: 'Diagnostic session created or resumed.',
        content: { 'application/json': { schema: DiagnosticSessionResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      403: {
        description: 'Forbidden.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(createSessionRoute, async (c) => {
    const payload = c.req.valid('json');
    const deviceId = c.get('deviceId');
    const accountKey = c.get('accountKey') ?? deviceId;
    if (!deviceId || !accountKey) {
      return c.json(
        {
          code: 'unauthorized' as const,
          message: 'Device auth required',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    const now = new Date();
    const startedAt = now;
    const collectionDeadlineAt = new Date(startedAt.getTime() + COLLECTION_BUDGET_MS);
    const resultsDeadlineAt = new Date(startedAt.getTime() + TOTAL_BUDGET_MS);
    const selectionSeed = payload.selectionSeed ?? payload.diagId;

    if (!db) {
      const emptySkill = (skill: DiagnosticSkill): SkillOutcomeDto => ({
        skill,
        status: 'pending',
        suggestedPracticeLevel: null,
        observations: [],
        weaknessFocus: null,
        quotaRefunded: false,
        reducedSampling: true,
        hasContradictoryEvidence: false,
      });
      const skills = {
        reading: emptySkill('reading'),
        listening: emptySkill('listening'),
        writing: emptySkill('writing'),
        speaking: emptySkill('speaking'),
      };
      return c.json(
        {
          diagId: payload.diagId,
          examId: payload.examId,
          mode: payload.mode,
          policyVersion: DIAGNOSTIC_POLICY_VERSION,
          contentVersion: DIAGNOSTIC_CONTENT_VERSION,
          status: 'in_progress' as const,
          startedAt: startedAt.toISOString(),
          collectionDeadlineAt: collectionDeadlineAt.toISOString(),
          resultsDeadlineAt: resultsDeadlineAt.toISOString(),
          resultRevision: 1,
          skills,
          recommendedFirstAction: buildRecommendedFirstAction(skills),
        },
        200,
      );
    }

    const existingRows = await db
      .select()
      .from(diagnosticSessions)
      .where(eq(diagnosticSessions.diagId, payload.diagId))
      .limit(1);

    let row = existingRows[0];
    if (row) {
      if (row.accountKey !== accountKey && row.deviceId !== deviceId) {
        return c.json(
          {
            code: 'unauthorized' as const,
            message: 'Diagnostic session belongs to a different account.',
            requestId: c.get('requestId'),
          },
          403,
        );
      }
    } else {
      const [inserted] = await db
        .insert(diagnosticSessions)
        .values({
          diagId: payload.diagId,
          accountKey,
          deviceId,
          examId: payload.examId,
          mode: payload.mode,
          policyVersion: DIAGNOSTIC_POLICY_VERSION,
          contentVersion: DIAGNOSTIC_CONTENT_VERSION,
          selectionSeed,
          startedAt,
          collectionDeadlineAt,
          resultsDeadlineAt,
          currentStage: 'intro',
          status: 'in_progress',
          resultRevision: 1,
        })
        .returning();
      row = inserted;
    }

    if (!row) {
      throw new DomainError('internal_error', 'Failed to create or load diagnostic session.');
    }
    const responsePayload = await assembleSessionResponse(db, row);
    return c.json(responsePayload, 200);
  });

  const submitSessionRoute = createRoute({
    method: 'post',
    path: '/v1/diagnostic/sessions/{diagId}/submit',
    request: {
      params: z.object({ diagId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: SubmitDiagnosticSessionRequestSchema } } },
    },
    responses: {
      200: {
        description: 'Diagnostic session submitted and objective skills scored.',
        content: { 'application/json': { schema: DiagnosticSessionResponseSchema } },
      },
      400: {
        description: 'Validation error.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      403: {
        description: 'Forbidden.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      404: {
        description: 'Not found.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      409: {
        description: 'Conflict.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      503: {
        description: 'Queue unavailable.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(submitSessionRoute, async (c) => {
    const diagId = c.req.param('diagId');
    const payload = c.req.valid('json');
    const deviceId = c.get('deviceId');
    const accountKey = c.get('accountKey') ?? deviceId;
    if (!deviceId || !accountKey) {
      return c.json(
        {
          code: 'unauthorized' as const,
          message: 'Device auth required',
          requestId: c.get('requestId'),
        },
        401,
      );
    }

    if (!db) {
      return c.json(
        {
          code: 'not_found' as const,
          message: 'Database unavailable.',
          requestId: c.get('requestId'),
        },
        404,
      );
    }

    const rows = await db
      .select()
      .from(diagnosticSessions)
      .where(eq(diagnosticSessions.diagId, diagId))
      .limit(1);

    const session = rows[0];
    if (!session) {
      return c.json(
        {
          code: 'not_found' as const,
          message: `Diagnostic session ${diagId} not found.`,
          requestId: c.get('requestId'),
        },
        404,
      );
    }
    if (session.accountKey !== accountKey && session.deviceId !== deviceId) {
      return c.json(
        {
          code: 'unauthorized' as const,
          message: 'Diagnostic session belongs to a different account.',
          requestId: c.get('requestId'),
        },
        403,
      );
    }

    // Recompute Reading & Listening deterministically on server.
    const readingPlacement = recomputeObjectiveSkill({
      skill: 'reading',
      bank: DIAGNOSTIC_READING_BANK,
      inputs: payload.readingHistory,
      stopReason: payload.readingStopReason ?? null,
      skipped: payload.readingSkipped,
    });
    const listeningPlacement = recomputeObjectiveSkill({
      skill: 'listening',
      bank: DIAGNOSTIC_LISTENING_BANK,
      inputs: payload.listeningHistory,
      stopReason: payload.listeningStopReason ?? null,
      skipped: payload.listeningSkipped,
    });

    const readingDto = mapObjectiveToDto(readingPlacement);
    const listeningDto = mapObjectiveToDto(listeningPlacement);

    const outboxToSend: Array<{
      jobId: string;
      queueName: string;
      dispatchKey: string;
      payload: Record<string, unknown>;
    }> = [];

    let writingAttemptId: string | null = session.writingAttemptId ?? null;
    let writingJobId: string | null = session.writingJobId ?? null;
    let writingFallback: SkillOutcomeDto = {
      skill: 'writing',
      status: payload.writing?.skipped ? 'skipped' : 'insufficient_evidence',
      suggestedPracticeLevel: null,
      observations: [
        payload.writing?.skipped
          ? 'Writing was skipped during this starting check.'
          : 'No usable Writing sample was submitted.',
      ],
      weaknessFocus: null,
      quotaRefunded: false,
      reducedSampling: true,
      hasContradictoryEvidence: false,
    };

    if (payload.writing && !payload.writing.skipped) {
      const combined =
        `${payload.writing.baseResponse} ${payload.writing.followUpResponse ?? ''}`.trim();
      const wordCount = combined.split(/\s+/).filter((w) => w.length > 0).length;
      if (wordCount >= 6) {
        if (isQueueReady && !isQueueReady()) {
          writingFallback = {
            ...writingFallback,
            status: 'failed',
            errorCode: 'model_unavailable',
            observations: ['Writing evaluation service is temporarily unavailable. Retry shortly.'],
          };
        } else {
          try {
            const existingWriting = await db
              .select({
                jobId: evaluationJobs.jobId,
                accountKey: evaluationJobs.accountKey,
                deviceId: evaluationJobs.deviceId,
              })
              .from(evaluationJobs)
              .where(eq(evaluationJobs.attemptId, payload.writing.attemptId))
              .limit(1);

            if (existingWriting[0]) {
              writingAttemptId = payload.writing.attemptId;
              writingJobId = existingWriting[0].jobId;
            } else {
              const writingInput = payload.writing;
              const jId = randomUUID();
              const jobPayload = {
                jobId: jId,
                executionGeneration: 1,
                attemptId: writingInput.attemptId,
                packId: 'diag-writing-pack-v1',
                examId: payload.examId ?? session.examId,
                taskType: 'diagnostic_writing' as const,
                promptTitle: writingInput.promptTitle,
                promptBody: writingInput.basePrompt,
                basePrompt: writingInput.basePrompt,
                followUpPrompt: writingInput.followUpPrompt,
                baseResponse: writingInput.baseResponse,
                followUpResponse: writingInput.followUpResponse,
                essayText: combined,
              };
              const dispatchKey = `${writingInput.attemptId}:gen:1`;
              await db.transaction(async (tx) => {
                await reserveQuotaAtomic({
                  db: tx,
                  accountKey,
                  deviceId,
                  attemptId: writingInput.attemptId,
                  skill: 'writing',
                  diagSessionId: diagId,
                });
                await tx.insert(evaluationJobs).values({
                  jobId: jId,
                  attemptId: writingInput.attemptId,
                  accountKey,
                  deviceId,
                  packId: 'diag-writing-pack-v1',
                  examId: payload.examId ?? session.examId,
                  taskType: 'diagnostic_writing',
                  skill: 'writing',
                  status: 'queued',
                  stageDetail: 'Queued for short Writing baseline review',
                  inputHash: sha256Json(jobPayload),
                  inputJson: jobPayload,
                  executionGeneration: 1,
                });
                await tx.insert(jobDispatchOutbox).values({
                  jobId: jId,
                  queueName: WRITING_QUEUE,
                  dispatchKey,
                  payloadJson: jobPayload,
                  status: 'pending',
                });
              });
              writingAttemptId = payload.writing.attemptId;
              writingJobId = jId;
              outboxToSend.push({
                jobId: jId,
                queueName: WRITING_QUEUE,
                dispatchKey,
                payload: jobPayload,
              });
            }
          } catch (err) {
            if (err instanceof DomainError) {
              writingFallback = {
                ...writingFallback,
                status: 'failed',
                errorCode: err.code,
                observations: [err.message],
              };
            } else {
              throw err;
            }
          }
        }
      }
    }

    let speakingAttemptId: string | null = session.speakingAttemptId ?? null;
    let speakingJobId: string | null = session.speakingJobId ?? null;
    let speakingFallback: SkillOutcomeDto = {
      skill: 'speaking',
      status: payload.speaking?.skipped ? 'skipped' : 'insufficient_evidence',
      suggestedPracticeLevel: null,
      observations: [
        payload.speaking?.skipped
          ? 'Speaking was skipped during this starting check.'
          : payload.speaking?.noEvidenceReason === 'mic_denied'
            ? 'Microphone permission was unavailable during this check.'
            : 'No usable Speaking recording was received.',
      ],
      weaknessFocus: null,
      quotaRefunded: false,
      reducedSampling: true,
      hasContradictoryEvidence: false,
    };

    if (payload.speaking && !payload.speaking.skipped && payload.speaking.turns.length > 0) {
      if (isQueueReady && !isQueueReady()) {
        speakingFallback = {
          ...speakingFallback,
          status: 'failed',
          errorCode: 'model_unavailable',
          observations: ['Speaking evaluation service is temporarily unavailable. Retry shortly.'],
        };
      } else {
        const s3 = s3Client ?? createAudioS3Client(env);
        let verifiedTurns = true;
        try {
          for (const turn of payload.speaking.turns) {
            const head = await verifyUploadedAudioObject({
              client: s3,
              bucket: env.S3_BUCKET,
              objectKey: turn.objectKey,
              expectedDeviceId: deviceId,
              maxBytes: env.MAX_AUDIO_MB * 1024 * 1024,
            });
            await db
              .insert(audioAssets)
              .values({
                objectKey: turn.objectKey,
                deviceId,
                attemptId: payload.speaking.attemptId,
                byteLength: head.byteLength,
                expiresAt: new Date(Date.now() + env.AUDIO_TTL_DAYS * 86_400_000),
              })
              .onConflictDoNothing();
          }
        } catch (err) {
          verifiedTurns = false;
          speakingFallback = {
            ...speakingFallback,
            status: 'unscorable',
            errorCode: err instanceof DomainError ? err.code : 'audio_missing',
            observations: ['Uploaded audio could not be verified. Recording was not charged.'],
          };
        }

        if (verifiedTurns) {
          try {
            const existingSpeaking = await db
              .select({ jobId: evaluationJobs.jobId })
              .from(evaluationJobs)
              .where(eq(evaluationJobs.attemptId, payload.speaking.attemptId))
              .limit(1);
            if (existingSpeaking[0]) {
              speakingAttemptId = payload.speaking.attemptId;
              speakingJobId = existingSpeaking[0].jobId;
            } else {
              const speakingInput = payload.speaking;
              const jId = randomUUID();
              const jobPayload = {
                jobId: jId,
                executionGeneration: 1,
                attemptId: speakingInput.attemptId,
                packId: 'diag-speaking-pack-v1',
                examId: payload.examId ?? session.examId,
                partSequence: 'diagnostic' as const,
                basePrompt: speakingInput.basePrompt,
                followUpPrompt: speakingInput.followUpPrompt,
                turns: speakingInput.turns,
              };
              const dispatchKey = `${speakingInput.attemptId}:gen:1`;
              await db.transaction(async (tx) => {
                await reserveQuotaAtomic({
                  db: tx,
                  accountKey,
                  deviceId,
                  attemptId: speakingInput.attemptId,
                  skill: 'speaking',
                  diagSessionId: diagId,
                });
                await tx.insert(evaluationJobs).values({
                  jobId: jId,
                  attemptId: speakingInput.attemptId,
                  accountKey,
                  deviceId,
                  packId: 'diag-speaking-pack-v1',
                  examId: payload.examId ?? session.examId,
                  taskType: 'diagnostic_speaking',
                  skill: 'speaking',
                  status: 'queued',
                  stageDetail: 'Queued for short Speaking baseline review',
                  inputHash: sha256Json(jobPayload),
                  inputJson: jobPayload,
                  executionGeneration: 1,
                });
                await tx.insert(jobDispatchOutbox).values({
                  jobId: jId,
                  queueName: SPEAKING_QUEUE,
                  dispatchKey,
                  payloadJson: jobPayload,
                  status: 'pending',
                });
              });
              speakingAttemptId = payload.speaking.attemptId;
              speakingJobId = jId;
              outboxToSend.push({
                jobId: jId,
                queueName: SPEAKING_QUEUE,
                dispatchKey,
                payload: jobPayload,
              });
            }
          } catch (err) {
            if (err instanceof DomainError) {
              speakingFallback = {
                ...speakingFallback,
                status: 'failed',
                errorCode: err.code,
                observations: [err.message],
              };
            } else {
              throw err;
            }
          }
        }
      }
    }

    // Best-effort pg-boss dispatch (transactional outbox guarantees recovery on failure)
    if (boss) {
      for (const item of outboxToSend) {
        try {
          await boss.send(item.queueName, item.payload, {
            singletonKey: item.dispatchKey,
            retryLimit: 3,
            retryBackoff: true,
          });
          await db
            .update(jobDispatchOutbox)
            .set({ status: 'dispatched', updatedAt: new Date() })
            .where(
              and(
                eq(jobDispatchOutbox.jobId, item.jobId),
                eq(jobDispatchOutbox.dispatchKey, item.dispatchKey),
                eq(jobDispatchOutbox.status, 'pending'),
              ),
            );
        } catch (err) {
          await db
            .update(jobDispatchOutbox)
            .set({
              attempts: 1,
              lastError: (err as Error).message.slice(0, 500),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(jobDispatchOutbox.jobId, item.jobId),
                eq(jobDispatchOutbox.dispatchKey, item.dispatchKey),
                eq(jobDispatchOutbox.status, 'pending'),
              ),
            );
        }
      }
    }

    const updatedObjectiveState = {
      reading: readingDto,
      listening: listeningDto,
      writingFallback,
      speakingFallback,
    };

    const [updatedRow] = await db
      .update(diagnosticSessions)
      .set({
        examId: payload.examId ?? session.examId,
        mode: payload.mode ?? session.mode,
        currentStage: 'results',
        status: outboxToSend.length > 0 ? 'submitted' : 'completed',
        objectiveStateJson: updatedObjectiveState,
        writingAttemptId,
        writingJobId,
        speakingAttemptId,
        speakingJobId,
        resultRevision: sql`${diagnosticSessions.resultRevision} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(diagnosticSessions.diagId, diagId))
      .returning();

    const responsePayload = await assembleSessionResponse(db, updatedRow ?? session);

    // Seed initial dynamic band scores & extracted weaknesses for Reading & Listening immediately
    const effectiveExamId = normalizeSupportedExamId(payload.examId ?? session.examId);
    const readingStats = buildDiagnosticQuestionTypeStats(
      DIAGNOSTIC_READING_BANK,
      payload.readingHistory,
    );
    const listeningStats = buildDiagnosticQuestionTypeStats(
      DIAGNOSTIC_LISTENING_BANK,
      payload.listeningHistory,
    );
    if (readingDto.suggestedTier) {
      await recordBandEventAndRecalculate({
        db,
        accountKey,
        edition: env.EDITION,
        examTrack: effectiveExamId,
        skill: 'reading',
        sourceKind: 'diagnostic',
        sourceId: diagId,
        rawScore: mapCefrTierToExamScore(readingDto.suggestedTier as AuthoringTier, effectiveExamId),
        cefrEstimate: readingDto.suggestedTier,
        questionTypeStats: readingStats,
      }).catch(() => {});
    }
    if (listeningDto.suggestedTier) {
      await recordBandEventAndRecalculate({
        db,
        accountKey,
        edition: env.EDITION,
        examTrack: effectiveExamId,
        skill: 'listening',
        sourceKind: 'diagnostic',
        sourceId: diagId,
        rawScore: mapCefrTierToExamScore(listeningDto.suggestedTier as AuthoringTier, effectiveExamId),
        cefrEstimate: listeningDto.suggestedTier,
        questionTypeStats: listeningStats,
      }).catch(() => {});
    }
    await recordUserActivityLedger({
      db,
      accountKey,
      deviceId,
      edition: env.EDITION,
      activityKind: 'diagnostic_submitted',
      entityType: 'diagnostic_session',
      entityId: diagId,
    }).catch(() => {});

    return c.json(responsePayload, 200);
  });

  const getSessionRoute = createRoute({
    method: 'get',
    path: '/v1/diagnostic/sessions/{diagId}',
    request: {
      params: z.object({ diagId: z.string().uuid() }),
    },
    responses: {
      200: {
        description: 'Live 4-skill diagnostic placement state.',
        content: { 'application/json': { schema: DiagnosticSessionResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      403: {
        description: 'Forbidden.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      404: {
        description: 'Not found.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(getSessionRoute, async (c) => {
    const diagId = c.req.param('diagId');
    const deviceId = c.get('deviceId');
    const accountKey = c.get('accountKey') ?? deviceId;
    if (!deviceId || !accountKey) {
      return c.json(
        {
          code: 'unauthorized' as const,
          message: 'Device auth required',
          requestId: c.get('requestId'),
        },
        401,
      );
    }
    if (!db) {
      return c.json(
        {
          code: 'not_found' as const,
          message: 'Database unavailable.',
          requestId: c.get('requestId'),
        },
        404,
      );
    }

    const rows = await db
      .select()
      .from(diagnosticSessions)
      .where(eq(diagnosticSessions.diagId, diagId))
      .limit(1);
    const session = rows[0];
    if (!session) {
      return c.json(
        {
          code: 'not_found' as const,
          message: `Diagnostic session ${diagId} not found.`,
          requestId: c.get('requestId'),
        },
        404,
      );
    }
    if (session.accountKey !== accountKey && session.deviceId !== deviceId) {
      return c.json(
        {
          code: 'unauthorized' as const,
          message: 'Diagnostic session belongs to a different account.',
          requestId: c.get('requestId'),
        },
        403,
      );
    }

    const assembled = await assembleSessionResponse(db, session);
    return c.json(assembled, 200);
  });

  const retakeSkillRoute = createRoute({
    method: 'post',
    path: '/v1/diagnostic/sessions/{diagId}/retake-skill',
    request: {
      params: z.object({ diagId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: RetakeDiagnosticSkillRequestSchema } } },
    },
    responses: {
      200: {
        description: 'Single-skill retake processed while preserving other skills.',
        content: { 'application/json': { schema: DiagnosticSessionResponseSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      403: {
        description: 'Forbidden.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      404: {
        description: 'Not found.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(retakeSkillRoute, async (c) => {
    const diagId = c.req.param('diagId');
    const payload = c.req.valid('json');
    const deviceId = c.get('deviceId');
    const accountKey = c.get('accountKey') ?? deviceId;
    if (!deviceId || !accountKey) {
      return c.json(
        {
          code: 'unauthorized' as const,
          message: 'Device auth required',
          requestId: c.get('requestId'),
        },
        401,
      );
    }
    if (!db) {
      return c.json(
        {
          code: 'not_found' as const,
          message: 'Database unavailable.',
          requestId: c.get('requestId'),
        },
        404,
      );
    }

    const rows = await db
      .select()
      .from(diagnosticSessions)
      .where(eq(diagnosticSessions.diagId, diagId))
      .limit(1);
    const session = rows[0];
    if (!session) {
      return c.json(
        {
          code: 'not_found' as const,
          message: `Diagnostic session ${diagId} not found.`,
          requestId: c.get('requestId'),
        },
        404,
      );
    }
    if (session.accountKey !== accountKey && session.deviceId !== deviceId) {
      return c.json(
        {
          code: 'unauthorized' as const,
          message: 'Diagnostic session belongs to a different account.',
          requestId: c.get('requestId'),
        },
        403,
      );
    }

    const existingObj = (session.objectiveStateJson ?? {}) as Record<string, unknown>;
    const nextObj: Record<string, unknown> = { ...existingObj };
    let nextWritingAttemptId = session.writingAttemptId;
    let nextWritingJobId = session.writingJobId;
    let nextSpeakingAttemptId = session.speakingAttemptId;
    let nextSpeakingJobId = session.speakingJobId;
    const toDispatch: Array<{
      jobId: string;
      queueName: string;
      dispatchKey: string;
      payload: Record<string, unknown>;
    }> = [];

    if (payload.skill === 'reading') {
      nextObj['reading'] = mapObjectiveToDto(
        recomputeObjectiveSkill({
          skill: 'reading',
          bank: DIAGNOSTIC_READING_BANK,
          inputs: payload.readingHistory ?? [],
          stopReason: payload.readingStopReason ?? null,
          skipped: false,
        }),
      );
    } else if (payload.skill === 'listening') {
      nextObj['listening'] = mapObjectiveToDto(
        recomputeObjectiveSkill({
          skill: 'listening',
          bank: DIAGNOSTIC_LISTENING_BANK,
          inputs: payload.listeningHistory ?? [],
          stopReason: payload.listeningStopReason ?? null,
          skipped: false,
        }),
      );
    } else if (payload.skill === 'writing' && payload.writing) {
      const writingInput = payload.writing;
      const combined = `${writingInput.baseResponse} ${writingInput.followUpResponse ?? ''}`.trim();
      const jId = randomUUID();
      const jobPayload = {
        jobId: jId,
        executionGeneration: 1,
        attemptId: writingInput.attemptId,
        packId: 'diag-writing-pack-v1',
        examId: session.examId,
        taskType: 'diagnostic_writing' as const,
        promptTitle: writingInput.promptTitle,
        promptBody: writingInput.basePrompt,
        basePrompt: writingInput.basePrompt,
        followUpPrompt: writingInput.followUpPrompt,
        baseResponse: writingInput.baseResponse,
        followUpResponse: writingInput.followUpResponse,
        essayText: combined,
      };
      const dispatchKey = `${writingInput.attemptId}:gen:1`;
      try {
        await db.transaction(async (tx) => {
          await reserveQuotaAtomic({
            db: tx,
            accountKey,
            deviceId,
            attemptId: writingInput.attemptId,
            skill: 'writing',
          });
          await tx.insert(evaluationJobs).values({
            jobId: jId,
            attemptId: writingInput.attemptId,
            accountKey,
            deviceId,
            packId: 'diag-writing-pack-v1',
            examId: session.examId,
            taskType: 'diagnostic_writing',
            skill: 'writing',
            status: 'queued',
            stageDetail: 'Queued for standalone Writing retake check',
            inputHash: sha256Json(jobPayload),
            inputJson: jobPayload,
            executionGeneration: 1,
          });
          await tx.insert(jobDispatchOutbox).values({
            jobId: jId,
            queueName: WRITING_QUEUE,
            dispatchKey,
            payloadJson: jobPayload,
            status: 'pending',
          });
        });
        nextWritingAttemptId = writingInput.attemptId;
        nextWritingJobId = jId;
        toDispatch.push({ jobId: jId, queueName: WRITING_QUEUE, dispatchKey, payload: jobPayload });
      } catch (err) {
        if (err instanceof DomainError) {
          nextObj['writingFallback'] = {
            skill: 'writing',
            status: 'failed',
            suggestedPracticeLevel: null,
            observations: [err.message],
            weaknessFocus: null,
            quotaRefunded: false,
            reducedSampling: true,
            hasContradictoryEvidence: false,
            errorCode: err.code,
          };
          nextWritingJobId = null;
        } else {
          throw err;
        }
      }
    } else if (
      payload.skill === 'speaking' &&
      payload.speaking &&
      payload.speaking.turns.length > 0
    ) {
      const speakingInput = payload.speaking;
      const s3 = s3Client ?? createAudioS3Client(env);
      for (const turn of speakingInput.turns) {
        const head = await verifyUploadedAudioObject({
          client: s3,
          bucket: env.S3_BUCKET,
          objectKey: turn.objectKey,
          expectedDeviceId: deviceId,
          maxBytes: env.MAX_AUDIO_MB * 1024 * 1024,
        });
        await db
          .insert(audioAssets)
          .values({
            objectKey: turn.objectKey,
            deviceId,
            attemptId: speakingInput.attemptId,
            byteLength: head.byteLength,
            expiresAt: new Date(Date.now() + env.AUDIO_TTL_DAYS * 86_400_000),
          })
          .onConflictDoNothing();
      }
      const jId = randomUUID();
      const jobPayload = {
        jobId: jId,
        executionGeneration: 1,
        attemptId: speakingInput.attemptId,
        packId: 'diag-speaking-pack-v1',
        examId: session.examId,
        partSequence: 'diagnostic' as const,
        basePrompt: speakingInput.basePrompt,
        followUpPrompt: speakingInput.followUpPrompt,
        turns: speakingInput.turns,
      };
      const dispatchKey = `${speakingInput.attemptId}:gen:1`;
      try {
        await db.transaction(async (tx) => {
          await reserveQuotaAtomic({
            db: tx,
            accountKey,
            deviceId,
            attemptId: speakingInput.attemptId,
            skill: 'speaking',
          });
          await tx.insert(evaluationJobs).values({
            jobId: jId,
            attemptId: speakingInput.attemptId,
            accountKey,
            deviceId,
            packId: 'diag-speaking-pack-v1',
            examId: session.examId,
            taskType: 'diagnostic_speaking',
            skill: 'speaking',
            status: 'queued',
            stageDetail: 'Queued for standalone Speaking retake check',
            inputHash: sha256Json(jobPayload),
            inputJson: jobPayload,
            executionGeneration: 1,
          });
          await tx.insert(jobDispatchOutbox).values({
            jobId: jId,
            queueName: SPEAKING_QUEUE,
            dispatchKey,
            payloadJson: jobPayload,
            status: 'pending',
          });
        });
        nextSpeakingAttemptId = speakingInput.attemptId;
        nextSpeakingJobId = jId;
        toDispatch.push({
          jobId: jId,
          queueName: SPEAKING_QUEUE,
          dispatchKey,
          payload: jobPayload,
        });
      } catch (err) {
        if (err instanceof DomainError) {
          nextObj['speakingFallback'] = {
            skill: 'speaking',
            status: 'failed',
            suggestedPracticeLevel: null,
            observations: [err.message],
            weaknessFocus: null,
            quotaRefunded: false,
            reducedSampling: true,
            hasContradictoryEvidence: false,
            errorCode: err.code,
          };
          nextSpeakingJobId = null;
        } else {
          throw err;
        }
      }
    }

    if (boss) {
      for (const item of toDispatch) {
        try {
          await boss.send(item.queueName, item.payload, {
            singletonKey: item.dispatchKey,
            retryLimit: 3,
            retryBackoff: true,
          });
          await db
            .update(jobDispatchOutbox)
            .set({ status: 'dispatched', updatedAt: new Date() })
            .where(eq(jobDispatchOutbox.jobId, item.jobId));
        } catch {
          // Outbox sweeper handles dispatch recovery.
        }
      }
    }

    const [updatedRow] = await db
      .update(diagnosticSessions)
      .set({
        objectiveStateJson: nextObj,
        writingAttemptId: nextWritingAttemptId,
        writingJobId: nextWritingJobId,
        speakingAttemptId: nextSpeakingAttemptId,
        speakingJobId: nextSpeakingJobId,
        status: toDispatch.length > 0 ? 'submitted' : session.status,
        resultRevision: sql`${diagnosticSessions.resultRevision} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(diagnosticSessions.diagId, diagId))
      .returning();

    const assembled = await assembleSessionResponse(db, updatedRow ?? session);
    return c.json(assembled, 200);
  });
}

async function assembleSessionResponse(
  db: MockzaDb,
  session: typeof diagnosticSessions.$inferSelect,
) {
  const obj = (session.objectiveStateJson ?? {}) as {
    reading?: SkillOutcomeDto;
    listening?: SkillOutcomeDto;
    writingFallback?: SkillOutcomeDto;
    speakingFallback?: SkillOutcomeDto;
  };

  const defaultSkill = (skill: DiagnosticSkill): SkillOutcomeDto => ({
    skill,
    status: 'insufficient_evidence',
    suggestedPracticeLevel: null,
    observations: ['No responses collected yet.'],
    weaknessFocus: null,
    quotaRefunded: false,
    reducedSampling: true,
    hasContradictoryEvidence: false,
  });

  const jobIds = [session.writingJobId, session.speakingJobId].filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  const attemptIds = [session.writingAttemptId, session.speakingAttemptId].filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );

  const jobsById = new Map<string, typeof evaluationJobs.$inferSelect>();
  if (jobIds.length > 0) {
    const jobRows = await db
      .select()
      .from(evaluationJobs)
      .where(inArray(evaluationJobs.jobId, jobIds));
    for (const row of jobRows) {
      jobsById.set(row.jobId, row);
    }
  }

  const refundedAttempts = new Set<string>();
  if (attemptIds.length > 0) {
    const resRows = await db
      .select({ attemptId: quotaReservations.attemptId, status: quotaReservations.status })
      .from(quotaReservations)
      .where(inArray(quotaReservations.attemptId, attemptIds));
    for (const row of resRows) {
      if (row.status === 'refunded') {
        refundedAttempts.add(row.attemptId);
      }
    }
  }

  const writingJob = session.writingJobId ? (jobsById.get(session.writingJobId) ?? null) : null;
  const speakingJob = session.speakingJobId ? (jobsById.get(session.speakingJobId) ?? null) : null;

  const reading = obj.reading ?? defaultSkill('reading');
  const listening = obj.listening ?? defaultSkill('listening');
  const writing = extractProductiveSkillDto({
    skill: 'writing',
    storedFallback: obj.writingFallback,
    job: writingJob,
    quotaRefunded: session.writingAttemptId
      ? refundedAttempts.has(session.writingAttemptId)
      : false,
  });
  const speaking = extractProductiveSkillDto({
    skill: 'speaking',
    storedFallback: obj.speakingFallback,
    job: speakingJob,
    quotaRefunded: session.speakingAttemptId
      ? refundedAttempts.has(session.speakingAttemptId)
      : false,
  });

  const stillPending = writing.status === 'pending' || speaking.status === 'pending';
  const effectiveStatus =
    session.status === 'in_progress' ? 'in_progress' : stillPending ? 'submitted' : 'completed';

  const skills = { reading, listening, writing, speaking };
  return {
    diagId: session.diagId,
    examId: session.examId,
    mode: session.mode as 'standard' | 'extended' | 'accessible',
    policyVersion: session.policyVersion,
    contentVersion: session.contentVersion,
    status: effectiveStatus as 'in_progress' | 'submitted' | 'completed' | 'abandoned',
    startedAt: session.startedAt.toISOString(),
    collectionDeadlineAt: session.collectionDeadlineAt.toISOString(),
    resultsDeadlineAt: session.resultsDeadlineAt.toISOString(),
    resultRevision: session.resultRevision,
    skills,
    recommendedFirstAction: buildRecommendedFirstAction(skills),
  };
}

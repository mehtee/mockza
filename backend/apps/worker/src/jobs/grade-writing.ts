import { randomUUID } from 'node:crypto';
import {
  type AiUsageRecord,
  type DiagnosticWritingInput,
  EvaluationModelError,
  gradeWritingDiagnosticGraph,
  gradeWritingGraph,
  type WritingGraphInput,
  type WritingGraphOutput,
  type WritingInvokeOptions,
} from '@mockza/ai';
import {
  commitQuotaReservationAtomic,
  evaluationJobs,
  type MockzaDb,
  recordAiUsageLedger,
  recordBandEventAndRecalculate,
  recordUserActivityLedger,
  refundQuotaAtomic,
  upsertUserAttemptSync,
} from '@mockza/db';
import { mapCefrTierToExamScore, normalizeSupportedExamId, type AuthoringTier } from '@mockza/domain';
import { and, eq, isNull, lt, notInArray, or } from 'drizzle-orm';
import { JOB_LEASE_DURATION_MS, startEvaluationLeaseRenewal } from './evaluation-lease.js';
import { recordPostEvaluationLinguisticSignals } from './record-linguistic-signals.js';

export const WRITING_JOB_QUEUE = 'evaluation.writing';

export interface WorkerRetryContext {
  attemptNumber?: number;
  maxAttempts?: number;
}

export async function handleGradeWritingJob(
  payload: WritingGraphInput & { jobId: string; executionGeneration?: number },
  db?: MockzaDb,
  invokeOptions?: WritingInvokeOptions,
  retryCtx: WorkerRetryContext = {},
): Promise<WritingGraphOutput | null> {
  const startMs = Date.now();
  const attemptNumber = retryCtx.attemptNumber ?? 1;
  const maxAttempts = retryCtx.maxAttempts ?? 3;
  const expectedGeneration = payload.executionGeneration ?? 1;
  const claimToken = randomUUID();

  let claimedAccountKey: string | undefined;
  let claimedDeviceId: string | undefined;

  if (db && payload.jobId) {
    const claimExpiresAt = new Date(Date.now() + JOB_LEASE_DURATION_MS);

    // Atomic generation-fenced lease acquisition BEFORE invoking the paid AI model (`RR-03`).
    const claimed = await db
      .update(evaluationJobs)
      .set({
        status: 'evaluating',
        stageDetail: 'Analyzing essay structure, lexical variety and grammar',
        claimToken,
        claimExpiresAt,
        attemptsCount: attemptNumber,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(evaluationJobs.jobId, payload.jobId),
          eq(evaluationJobs.executionGeneration, expectedGeneration),
          notInArray(evaluationJobs.status, ['completed', 'failed']),
          or(
            isNull(evaluationJobs.claimToken),
            lt(evaluationJobs.claimExpiresAt, new Date()),
            eq(evaluationJobs.status, 'queued'),
            eq(evaluationJobs.status, 'repairing'),
          ),
        ),
      )
      .returning({
        jobId: evaluationJobs.jobId,
        accountKey: evaluationJobs.accountKey,
        deviceId: evaluationJobs.deviceId,
      });

    if (claimed.length === 0) {
      const [existing] = await db
        .select({ status: evaluationJobs.status, resultJson: evaluationJobs.resultJson })
        .from(evaluationJobs)
        .where(eq(evaluationJobs.jobId, payload.jobId))
        .limit(1);
      if (existing?.status === 'completed') {
        return (
          (existing.resultJson as Awaited<ReturnType<typeof gradeWritingGraph.invoke>> | null) ??
          null
        );
      }
      // Absent, stale generation, failed, or actively leased by another worker.
      return null;
    }
    claimedAccountKey = claimed[0]?.accountKey;
    claimedDeviceId = claimed[0]?.deviceId;
  }

  const stopLeaseRenewal =
    db && payload.jobId
      ? startEvaluationLeaseRenewal({
          db,
          jobId: payload.jobId,
          generation: expectedGeneration,
          claimToken,
        })
      : () => {};

  try {
    const rawPayload = payload as Omit<WritingGraphInput, 'taskType'> & {
      jobId: string;
      executionGeneration?: number;
      taskType: string;
      basePrompt?: string;
      followUpPrompt?: string;
      baseResponse?: string;
      followUpResponse?: string;
    };
    const isDiagnosticTask = rawPayload.taskType === 'diagnostic_writing';
    const effectiveEdition =
      rawPayload.edition ?? (process.env['EDITION'] === 'irn' ? 'irn' : 'glb');
    const collectedUsages: AiUsageRecord[] = [];
    const trackedOptions: WritingInvokeOptions = {
      ...invokeOptions,
      onUsage: async (u) => {
        collectedUsages.push(u);
        await invokeOptions?.onUsage?.(u);
      },
    };
    const result = isDiagnosticTask
      ? await gradeWritingDiagnosticGraph.invoke(
          {
            attemptId: rawPayload.attemptId,
            edition: effectiveEdition,
            promptTitle: rawPayload.promptTitle || 'Writing Starting Check',
            basePrompt: rawPayload.basePrompt ?? rawPayload.promptBody,
            followUpPrompt: rawPayload.followUpPrompt,
            baseResponse: rawPayload.baseResponse ?? rawPayload.essayText,
            followUpResponse: rawPayload.followUpResponse,
          } satisfies DiagnosticWritingInput,
          trackedOptions,
        )
      : await gradeWritingGraph.invoke({ ...payload, edition: effectiveEdition }, trackedOptions);
    const latencyMs = Date.now() - startMs;
    const numericBand = 'overallBand' in result ? result.overallBand : null;
    const primaryUsage = collectedUsages[0] ?? null;

    if (db && payload.jobId) {
      await db.transaction(async (tx) => {
        const updated = await tx
          .update(evaluationJobs)
          .set({
            status: 'completed',
            stageDetail: 'Evaluation complete',
            overallBand: numericBand,
            resultJson: result,
            modelId: result.modelId,
            rubricVersion: result.rubricVersion,
            latencyMs,
            tokenUsageJson: primaryUsage,
            estimatedCostUsdMicros: primaryUsage?.estimatedCostUsdMicros ?? 0,
            errorCode: null,
            claimToken: null,
            claimExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(evaluationJobs.jobId, payload.jobId),
              eq(evaluationJobs.executionGeneration, expectedGeneration),
              eq(evaluationJobs.claimToken, claimToken),
              notInArray(evaluationJobs.status, ['completed', 'failed']),
            ),
          )
          .returning({ jobId: evaluationJobs.jobId });

        if (updated.length > 0) {
          if (isDiagnosticTask && 'status' in result && result.status !== 'provisional') {
            await refundQuotaAtomic({ db: tx, attemptId: payload.attemptId });
          } else {
            await commitQuotaReservationAtomic({ db: tx, attemptId: payload.attemptId });
          }
        }
      });

      const writingSample = rawPayload.baseResponse ?? rawPayload.essayText ?? '';
      await recordPostEvaluationLinguisticSignals({
        db,
        jobId: payload.jobId,
        edition: effectiveEdition,
        sourceKind: isDiagnosticTask ? 'diagnostic' : 'writing',
        sourceRefId: payload.attemptId,
        textSample: writingSample,
      });

      if (claimedAccountKey) {
        for (const u of collectedUsages) {
          await recordAiUsageLedger({
            db,
            accountKey: claimedAccountKey,
            deviceId: claimedDeviceId ?? null,
            edition: effectiveEdition,
            featureKind: u.featureKind,
            entityType: isDiagnosticTask ? 'diagnostic_writing' : 'writing_eval',
            entityId: payload.attemptId,
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
        const effectiveExam = normalizeSupportedExamId(rawPayload.examId);
        const derivedScore =
          numericBand ??
          ('tierHint' in result && result.tierHint
            ? mapCefrTierToExamScore(result.tierHint as AuthoringTier, effectiveExam)
            : null);
        if (derivedScore != null) {
          await recordBandEventAndRecalculate({
            db,
            accountKey: claimedAccountKey,
            edition: effectiveEdition,
            examTrack: effectiveExam,
            skill: 'writing',
            sourceKind: isDiagnosticTask ? 'diagnostic' : 'writing_eval',
            sourceId: payload.attemptId,
            rawScore: derivedScore,
            cefrEstimate: 'tierHint' in result ? (result.tierHint ?? null) : null,
            durationSeconds: rawPayload.durationSeconds ?? undefined,
          }).catch(() => {});
        }
        await upsertUserAttemptSync({
          db,
          attemptId: payload.attemptId,
          accountKey: claimedAccountKey,
          edition: effectiveEdition,
          packId: rawPayload.packId,
          examId: effectiveExam,
          skill: 'writing',
          mode: isDiagnosticTask ? 'diagnostic' : 'timed_exam',
          status: 'completed',
          scoreBand: derivedScore,
          durationSeconds: rawPayload.durationSeconds ?? 0,
          feedbackJson: result as unknown as Record<string, unknown>,
          deviceId: claimedDeviceId ?? null,
        }).catch(() => {});
        await recordUserActivityLedger({
          db,
          accountKey: claimedAccountKey,
          deviceId: claimedDeviceId ?? null,
          edition: effectiveEdition,
          activityKind: isDiagnosticTask ? 'diagnostic_writing_done' : 'writing_eval_done',
          entityType: 'evaluation_job',
          entityId: payload.jobId,
          metadata: { band: derivedScore },
        }).catch(() => {});
      }
    }

    return (isDiagnosticTask ? null : result) as WritingGraphOutput | null;
  } catch (error) {
    const retryable = !(error instanceof EvaluationModelError && !error.retryable);
    const willRetry = retryable && attemptNumber < maxAttempts;

    if (db && payload.jobId) {
      if (willRetry) {
        await db
          .update(evaluationJobs)
          .set({
            status: 'repairing',
            stageDetail: `Temporary evaluator issue — automatic retry ${attemptNumber}/${maxAttempts} scheduled`,
            attemptsCount: attemptNumber,
            claimToken: null,
            claimExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(evaluationJobs.jobId, payload.jobId),
              eq(evaluationJobs.executionGeneration, expectedGeneration),
              eq(evaluationJobs.claimToken, claimToken),
              notInArray(evaluationJobs.status, ['completed', 'failed']),
            ),
          );
      } else {
        const errorCode = error instanceof EvaluationModelError ? error.code : 'internal_error';
        await db.transaction(async (tx) => {
          const updated = await tx
            .update(evaluationJobs)
            .set({
              status: 'failed',
              stageDetail: 'Evaluation failed',
              errorCode,
              attemptsCount: attemptNumber,
              claimToken: null,
              claimExpiresAt: null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(evaluationJobs.jobId, payload.jobId),
                eq(evaluationJobs.executionGeneration, expectedGeneration),
                eq(evaluationJobs.claimToken, claimToken),
                notInArray(evaluationJobs.status, ['completed']),
              ),
            )
            .returning({ jobId: evaluationJobs.jobId });

          if (updated.length > 0) {
            await refundQuotaAtomic({ db: tx, attemptId: payload.attemptId });
          }
        });
      }
    }
    throw error;
  } finally {
    stopLeaseRenewal();
  }
}

import { randomUUID } from 'node:crypto';
import {
  EvaluationModelError,
  gradeWritingGraph,
  type WritingGraphInput,
  type WritingInvokeOptions,
} from '@mockza/ai';
import {
  commitQuotaReservationAtomic,
  evaluationJobs,
  type MockzaDb,
  refundQuotaAtomic,
} from '@mockza/db';
import { and, eq, isNull, lt, notInArray, or } from 'drizzle-orm';
import { JOB_LEASE_DURATION_MS, startEvaluationLeaseRenewal } from './evaluation-lease.js';

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
) {
  const startMs = Date.now();
  const attemptNumber = retryCtx.attemptNumber ?? 1;
  const maxAttempts = retryCtx.maxAttempts ?? 3;
  const expectedGeneration = payload.executionGeneration ?? 1;
  const claimToken = randomUUID();

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
      .returning({ jobId: evaluationJobs.jobId });

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
    const result = await gradeWritingGraph.invoke(payload, invokeOptions);
    const latencyMs = Date.now() - startMs;

    if (db && payload.jobId) {
      await db.transaction(async (tx) => {
        const updated = await tx
          .update(evaluationJobs)
          .set({
            status: 'completed',
            stageDetail: 'Evaluation complete',
            overallBand: result.overallBand,
            resultJson: result,
            modelId: result.modelId,
            rubricVersion: result.rubricVersion,
            latencyMs,
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
          await commitQuotaReservationAtomic({ db: tx, attemptId: payload.attemptId });
        }
      });
    }

    return result;
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

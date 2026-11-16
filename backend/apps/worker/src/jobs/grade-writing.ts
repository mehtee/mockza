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
import { and, eq, notInArray } from 'drizzle-orm';

export const WRITING_JOB_QUEUE = 'evaluation.writing';

export interface WorkerRetryContext {
  attemptNumber?: number;
  maxAttempts?: number;
}

export async function handleGradeWritingJob(
  payload: WritingGraphInput & { jobId: string },
  db?: MockzaDb,
  invokeOptions?: WritingInvokeOptions,
  retryCtx: WorkerRetryContext = {},
) {
  const startMs = Date.now();
  const attemptNumber = retryCtx.attemptNumber ?? 1;
  const maxAttempts = retryCtx.maxAttempts ?? 3;

  if (db && payload.jobId) {
    // Fence deleted or already-terminal jobs (`TD-09` / `TD-15`).
    const [existing] = await db
      .select({ status: evaluationJobs.status, resultJson: evaluationJobs.resultJson })
      .from(evaluationJobs)
      .where(eq(evaluationJobs.jobId, payload.jobId))
      .limit(1);

    if (!existing) {
      return null;
    }
    if (existing.status === 'completed' || existing.status === 'failed') {
      return (
        (existing.resultJson as Awaited<ReturnType<typeof gradeWritingGraph.invoke>> | null) ?? null
      );
    }

    await db
      .update(evaluationJobs)
      .set({
        status: 'evaluating',
        stageDetail: 'Analyzing essay structure, lexical variety and grammar',
        attemptsCount: attemptNumber,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(evaluationJobs.jobId, payload.jobId),
          notInArray(evaluationJobs.status, ['completed', 'failed']),
        ),
      );
  }

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
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(evaluationJobs.jobId, payload.jobId),
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
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(evaluationJobs.jobId, payload.jobId),
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
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(evaluationJobs.jobId, payload.jobId),
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
  }
}

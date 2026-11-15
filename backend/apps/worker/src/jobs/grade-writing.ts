import { gradeWritingGraph, type WritingGraphInput } from '@mockza/ai';
import { evaluationJobs, type MockzaDb, quotaReservations, refundQuotaAtomic } from '@mockza/db';
import { eq } from 'drizzle-orm';

export const WRITING_JOB_QUEUE = 'evaluation.writing';

export async function handleGradeWritingJob(
  payload: WritingGraphInput & { jobId: string },
  db?: MockzaDb,
) {
  const startMs = Date.now();

  if (db && payload.jobId) {
    // 1. Transition to evaluating
    await db
      .update(evaluationJobs)
      .set({
        status: 'evaluating',
        stageDetail: 'Analyzing essay structure, lexical variety and grammar',
        updatedAt: new Date(),
      })
      .where(eq(evaluationJobs.jobId, payload.jobId));
  }

  try {
    const result = await gradeWritingGraph.invoke(payload);
    const latencyMs = Date.now() - startMs;

    if (db && payload.jobId) {
      // 2. Transition to completed
      await db
        .update(evaluationJobs)
        .set({
          status: 'completed',
          stageDetail: 'Evaluation complete',
          overallBand: result.overallBand,
          resultJson: result,
          modelId: result.modelId,
          rubricVersion: result.rubricVersion,
          latencyMs,
          updatedAt: new Date(),
        })
        .where(eq(evaluationJobs.jobId, payload.jobId));

      // 3. Commit quota reservation
      await db
        .update(quotaReservations)
        .set({ status: 'committed', updatedAt: new Date() })
        .where(eq(quotaReservations.attemptId, payload.attemptId));
    }

    return result;
  } catch (error) {
    if (db && payload.jobId) {
      // Automatic transactional quota refund on failure (B5.1)
      await refundQuotaAtomic({ db, attemptId: payload.attemptId });

      await db
        .update(evaluationJobs)
        .set({
          status: 'failed',
          stageDetail: `Failed: ${(error as Error).message}`,
          errorCode: 'internal_error',
          updatedAt: new Date(),
        })
        .where(eq(evaluationJobs.jobId, payload.jobId));
    }
    throw error;
  }
}

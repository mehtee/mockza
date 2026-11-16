import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import {
  bufferAudioStream,
  EvaluationModelError,
  gradeSpeakingGraph,
  prepareAudioForModel,
  type SpeakingGraphInput,
  type SpeakingInvokeOptions,
} from '@mockza/ai';
import {
  commitQuotaReservationAtomic,
  evaluationJobs,
  type MockzaDb,
  refundQuotaAtomic,
} from '@mockza/db';
import { and, eq, notInArray } from 'drizzle-orm';
import type { WorkerRetryContext } from './grade-writing.js';

export const SPEAKING_JOB_QUEUE = 'evaluation.speaking';

export async function handleGradeSpeakingJob(
  payload: SpeakingGraphInput & { jobId: string },
  db?: MockzaDb,
  s3Client?: S3Client,
  bucket?: string,
  invokeOptions?: SpeakingInvokeOptions,
  retryCtx: WorkerRetryContext = {},
) {
  const startMs = Date.now();
  const attemptNumber = retryCtx.attemptNumber ?? 1;
  const maxAttempts = retryCtx.maxAttempts ?? 3;

  if (db && payload.jobId) {
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
        (existing.resultJson as Awaited<ReturnType<typeof gradeSpeakingGraph.invoke>> | null) ??
        null
      );
    }

    await db
      .update(evaluationJobs)
      .set({
        status: 'processing_audio',
        stageDetail: 'Fetching audio recording from storage and preparing stream',
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
    let turnAudios = payload.turnAudios;

    // Fetch, validate, and transcode ALL turns from S3 in order (never only turns[0]).
    if (s3Client && bucket && (!turnAudios || turnAudios.length === 0)) {
      const turns = payload.turns ?? [];
      const preparedTurns: NonNullable<SpeakingGraphInput['turnAudios']> = [];

      for (const turn of turns) {
        const getRes = await s3Client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: turn.objectKey,
          }),
        );

        if (!getRes.Body) {
          throw new EvaluationModelError(
            'audio_missing',
            `S3 object ${turn.objectKey} has empty body.`,
            false,
          );
        }

        const rawBuffer = await bufferAudioStream(getRes.Body as NodeJS.ReadableStream);
        const prepared = await prepareAudioForModel(rawBuffer, turn.objectKey);
        preparedTurns.push({
          partIndex: turn.partIndex,
          promptText: turn.promptText,
          base64AudioData: prepared.base64Data,
          format: prepared.format,
        });
      }

      if (preparedTurns.length > 0) {
        turnAudios = preparedTurns;
      }
    }

    if (db && payload.jobId) {
      await db
        .update(evaluationJobs)
        .set({
          status: 'evaluating',
          stageDetail: 'Evaluating pronunciation, fluency, and spoken lexical range',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(evaluationJobs.jobId, payload.jobId),
            notInArray(evaluationJobs.status, ['completed', 'failed']),
          ),
        );
    }

    const result = await gradeSpeakingGraph.invoke(
      {
        ...payload,
        turnAudios,
      },
      invokeOptions,
    );
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

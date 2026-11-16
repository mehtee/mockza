import { randomUUID } from 'node:crypto';
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
import { and, eq, isNull, lt, notInArray, or } from 'drizzle-orm';
import type { WorkerRetryContext } from './grade-writing.js';

export const SPEAKING_JOB_QUEUE = 'evaluation.speaking';
const JOB_LEASE_DURATION_MS = 180_000;

export async function handleGradeSpeakingJob(
  payload: SpeakingGraphInput & { jobId: string; executionGeneration?: number },
  db?: MockzaDb,
  s3Client?: S3Client,
  bucket?: string,
  invokeOptions?: SpeakingInvokeOptions,
  retryCtx: WorkerRetryContext = {},
) {
  const startMs = Date.now();
  const attemptNumber = retryCtx.attemptNumber ?? 1;
  const maxAttempts = retryCtx.maxAttempts ?? 3;
  const expectedGeneration = payload.executionGeneration ?? 1;
  const claimToken = randomUUID();

  if (db && payload.jobId) {
    const claimExpiresAt = new Date(Date.now() + JOB_LEASE_DURATION_MS);

    // Atomic generation-fenced lease acquisition BEFORE S3 download & paid AI model (`RR-03`).
    const claimed = await db
      .update(evaluationJobs)
      .set({
        status: 'processing_audio',
        stageDetail: 'Fetching audio recording from storage and preparing stream',
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
          (existing.resultJson as Awaited<ReturnType<typeof gradeSpeakingGraph.invoke>> | null) ??
          null
        );
      }
      return null;
    }
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
      const stillOwner = await db
        .update(evaluationJobs)
        .set({
          status: 'evaluating',
          stageDetail: 'Evaluating pronunciation, fluency, and spoken lexical range',
          claimExpiresAt: new Date(Date.now() + JOB_LEASE_DURATION_MS),
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

      if (stillOwner.length === 0) {
        return null;
      }
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
  }
}

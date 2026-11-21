import { randomUUID } from 'node:crypto';
import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import {
  bufferAudioStream,
  EvaluationModelError,
  prepareAudioForModel,
  type RegisterShifterResult,
  shiftRegisterGraph,
  type ShiftRegisterOptions,
} from '@mockza/ai';
import {
  commitQuotaReservationAtomic,
  evaluationJobs,
  type MockzaDb,
  refundQuotaAtomic,
} from '@mockza/db';
import { and, eq, isNull, lt, notInArray, or } from 'drizzle-orm';
import { JOB_LEASE_DURATION_MS, startEvaluationLeaseRenewal } from './evaluation-lease.js';
import type { WorkerRetryContext } from './grade-writing.js';
import { recordPostEvaluationLinguisticSignals } from './record-linguistic-signals.js';

export const REGISTER_SHIFTER_JOB_QUEUE = 'advanced.register-shifter';

export interface RegisterShifterJobPayload {
  jobId: string;
  attemptId: string;
  accountKey: string;
  deviceId: string;
  edition: 'glb' | 'irn';
  objectKey?: string;
  rawText?: string;
  examTrack: string;
  topicHint?: string;
  durationSeconds?: number;
  base64AudioData?: string;
  sourceTextFallback?: string;
  executionGeneration?: number;
}

export async function handleRegisterShifterJob(
  payload: RegisterShifterJobPayload,
  db?: MockzaDb,
  s3Client?: S3Client,
  bucket?: string,
  invokeOptions?: ShiftRegisterOptions,
  retryCtx: WorkerRetryContext = {},
): Promise<RegisterShifterResult | null> {
  const startMs = Date.now();
  const attemptNumber = retryCtx.attemptNumber ?? 1;
  const maxAttempts = retryCtx.maxAttempts ?? 2;
  const expectedGeneration = payload.executionGeneration ?? 1;
  const claimToken = randomUUID();

  if (db && payload.jobId) {
    const claimExpiresAt = new Date(Date.now() + JOB_LEASE_DURATION_MS);
    const claimed = await db
      .update(evaluationJobs)
      .set({
        status: 'processing_audio',
        stageDetail: 'Shifting your spoken idea into Casual, Workplace, and Academic registers',
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
    let preparedAudio: { base64Data: string; format: 'm4a' | 'mp3' | 'wav' } | undefined;
    if (payload.base64AudioData) {
      preparedAudio = { base64Data: payload.base64AudioData, format: 'm4a' };
    } else if (s3Client && bucket && payload.objectKey) {
      const obj = await s3Client.send(
        new GetObjectCommand({ Bucket: bucket, Key: payload.objectKey }),
      );
      if (obj.Body) {
        const buf = await bufferAudioStream(obj.Body as NodeJS.ReadableStream);
        preparedAudio = await prepareAudioForModel(buf, payload.objectKey, {
          maxDurationSeconds: 45,
        });
      }
    }

    const result = await shiftRegisterGraph(
      {
        runId: payload.jobId,
        edition: payload.edition,
        examTrack: payload.examTrack,
        topicHint: payload.topicHint,
        base64AudioData: preparedAudio?.base64Data,
        audioFormat: preparedAudio?.format,
        sourceTextFallback: payload.rawText ?? payload.sourceTextFallback,
      },
      {
        ...invokeOptions,
        allowDemoEvaluator:
          invokeOptions?.allowDemoEvaluator ??
          (process.env['ALLOW_DEMO_EVALUATOR'] === 'true' || !process.env['OPENROUTER_API_KEY']),
      },
    );

    const latencyMs = Date.now() - startMs;

    if (db && payload.jobId) {
      await db.transaction(async (tx) => {
        const updated = await tx
          .update(evaluationJobs)
          .set({
            status: 'completed',
            stageDetail: 'Register shift complete',
            resultJson: result,
            modelId: 'google/gemini-3.1-flash-lite',
            rubricVersion: 'register-shifter-v1',
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

      await recordPostEvaluationLinguisticSignals({
        db,
        accountKey: payload.accountKey,
        edition: payload.edition,
        sourceKind: 'register_shifter',
        sourceRefId: payload.jobId,
        textSample: result.sourceTranscript,
        topicHint: payload.topicHint,
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
            stageDetail: `Retrying register shift (${attemptNumber}/${maxAttempts})`,
            attemptsCount: attemptNumber,
            claimToken: null,
            claimExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(evaluationJobs.jobId, payload.jobId),
              eq(evaluationJobs.claimToken, claimToken),
            ),
          );
      } else {
        const errorCode = error instanceof EvaluationModelError ? error.code : 'internal_error';
        await db.transaction(async (tx) => {
          const updated = await tx
            .update(evaluationJobs)
            .set({
              status: 'failed',
              stageDetail: 'Register shift failed',
              errorCode,
              claimToken: null,
              claimExpiresAt: null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(evaluationJobs.jobId, payload.jobId),
                eq(evaluationJobs.claimToken, claimToken),
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

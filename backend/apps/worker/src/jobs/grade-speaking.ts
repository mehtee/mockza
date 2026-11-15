import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import {
  bufferAudioStream,
  encodeAudioForModel,
  gradeSpeakingGraph,
  type SpeakingGraphInput,
  trimAudioSilence,
} from '@mockza/ai';
import { evaluationJobs, type MockzaDb, quotaReservations, refundQuotaAtomic } from '@mockza/db';
import { eq } from 'drizzle-orm';

export const SPEAKING_JOB_QUEUE = 'evaluation.speaking';

export async function handleGradeSpeakingJob(
  payload: SpeakingGraphInput & { jobId: string },
  db?: MockzaDb,
  s3Client?: S3Client,
  bucket?: string,
) {
  const startMs = Date.now();

  if (db && payload.jobId) {
    await db
      .update(evaluationJobs)
      .set({
        status: 'processing_audio',
        stageDetail: 'Fetching audio recording from storage and preparing stream',
        updatedAt: new Date(),
      })
      .where(eq(evaluationJobs.jobId, payload.jobId));
  }

  let base64AudioData: string | undefined = payload.base64AudioData;

  // Fetch audio from S3 if client and object key available
  const objectKey = payload.turns?.[0]?.objectKey ?? payload.audioObjectKeys?.[0];
  if (s3Client && bucket && objectKey && !base64AudioData) {
    try {
      const getRes = await s3Client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
      );

      if (getRes.Body) {
        const rawBuffer = await bufferAudioStream(getRes.Body as NodeJS.ReadableStream);
        const trimmedBuffer = await trimAudioSilence(rawBuffer, objectKey);
        const encoded = encodeAudioForModel(trimmedBuffer);
        base64AudioData = encoded.base64Data;
      }
    } catch (_s3Err) {
      // In offline/test environments, proceed without live audio
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
      .where(eq(evaluationJobs.jobId, payload.jobId));
  }

  try {
    const result = await gradeSpeakingGraph.invoke({
      ...payload,
      base64AudioData,
    });
    const latencyMs = Date.now() - startMs;

    if (db && payload.jobId) {
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

      await db
        .update(quotaReservations)
        .set({ status: 'committed', updatedAt: new Date() })
        .where(eq(quotaReservations.attemptId, payload.attemptId));
    }

    return result;
  } catch (error) {
    if (db && payload.jobId) {
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

import { randomUUID } from 'node:crypto';
import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import {
  analyzePronunciationGraph,
  type AnalyzePronunciationOptions,
  type AiUsageRecord,
  bufferAudioStream,
  EvaluationModelError,
  prepareAudioForModel,
  type PronunciationAnalysisResult,
} from '@mockza/ai';
import {
  evaluationJobs,
  type MockzaDb,
  pronunciationPractices,
  recordAiUsageLedger,
  recordUserActivityLedger,
  upsertLinguisticGraphSignals,
} from '@mockza/db';
import { and, eq, isNull, lt, notInArray, or } from 'drizzle-orm';
import { JOB_LEASE_DURATION_MS, startEvaluationLeaseRenewal } from './evaluation-lease.js';
import type { WorkerRetryContext } from './grade-writing.js';

export const ANALYZE_PRONUNCIATION_JOB_QUEUE = 'advanced.analyze-pronunciation';

export interface AnalyzePronunciationJobPayload {
  jobId: string;
  practiceId: string;
  attemptId: string;
  accountKey: string;
  deviceId: string;
  edition: 'glb' | 'irn';
  examTrack: string;
  targetText: string;
  practiceKind: 'word' | 'sentence' | 'reading_excerpt' | 'feedback_shadow';
  sourceRefType?: string | null;
  sourceRefId?: string | null;
  objectKey: string;
  durationMs?: number | null;
  base64AudioData?: string;
  executionGeneration?: number;
}

export async function handleAnalyzePronunciationJob(
  payload: AnalyzePronunciationJobPayload,
  db?: MockzaDb,
  s3Client?: S3Client,
  bucket?: string,
  invokeOptions?: AnalyzePronunciationOptions,
  retryCtx: WorkerRetryContext = {},
): Promise<PronunciationAnalysisResult | null> {
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
        status: 'evaluating',
        stageDetail: 'Checking phonemes, word stress, and intonation with Gemini 3.1 Flash Lite',
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

  const collectedUsages: AiUsageRecord[] = [];
  const mergedOptions: AnalyzePronunciationOptions = {
    ...invokeOptions,
    allowDemoEvaluator:
      invokeOptions?.allowDemoEvaluator ??
      (process.env['ALLOW_DEMO_EVALUATOR'] === 'true' || !process.env['OPENROUTER_API_KEY']),
    onUsage: async (u) => {
      collectedUsages.push(u);
      await invokeOptions?.onUsage?.(u);
    },
  };

  try {
    let base64Data = payload.base64AudioData ?? '';
    let audioFormat: 'm4a' | 'mp3' | 'wav' = 'm4a';

    if (!base64Data && s3Client && bucket && payload.objectKey) {
      const obj = await s3Client.send(
        new GetObjectCommand({ Bucket: bucket, Key: payload.objectKey }),
      );
      if (obj.Body) {
        const buf = await bufferAudioStream(obj.Body as NodeJS.ReadableStream);
        const prepared = await prepareAudioForModel(buf, payload.objectKey, {
          maxDurationSeconds: 60,
        });
        base64Data = prepared.base64Data;
        audioFormat = prepared.format;
      }
    }

    const { result, usage } = await analyzePronunciationGraph(
      {
        edition: payload.edition,
        examTrack: payload.examTrack,
        targetText: payload.targetText,
        practiceKind: payload.practiceKind,
        base64AudioData: base64Data,
        audioFormat,
      },
      mergedOptions,
    );

    const latencyMs = Date.now() - startMs;
    const primaryUsage = usage ?? collectedUsages[0] ?? null;

    if (db && payload.jobId) {
      await db.transaction(async (tx) => {
        await tx
          .update(pronunciationPractices)
          .set({
            transcript: result.transcript,
            accuracyScore: result.accuracyScore,
            fluencyScore: result.fluencyScore,
            intonationScore: result.intonationScore,
            stressScore: result.stressScore,
            overallScore: result.overallScore,
            bandImpactLabel: result.bandImpactLabel,
            summaryEn: result.summaryEn,
            summaryFa: result.summaryFa,
            mouthTipEn: result.mouthTipEn,
            mouthTipFa: result.mouthTipFa,
            actionableRetryEn: result.actionableRetryEn,
            actionableRetryFa: result.actionableRetryFa,
            wordsFeedbackJson: result.wordsFeedback as unknown as Array<Record<string, unknown>>,
            weaknessSignalKey: result.weaknessSignalKey,
            status: 'completed',
            modelUsed: result.modelUsed,
            providerRequestId: primaryUsage?.providerRequestId ?? null,
            promptTokens: primaryUsage?.promptTokens ?? 0,
            completionTokens: primaryUsage?.completionTokens ?? 0,
            cachedTokens: primaryUsage?.cachedTokens ?? 0,
            estimatedCostUsdMicros: primaryUsage?.estimatedCostUsdMicros ?? 0,
          })
          .where(eq(pronunciationPractices.practiceId, payload.practiceId));

        await tx
          .update(evaluationJobs)
          .set({
            status: 'completed',
            stageDetail: 'Pronunciation analysis complete',
            overallBand: null,
            resultJson: result as unknown as Record<string, unknown>,
            modelId: result.modelUsed,
            rubricVersion: 'pronunciation-v1',
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
          );
      });

      if (primaryUsage) {
        await recordAiUsageLedger({
          db,
          accountKey: payload.accountKey,
          deviceId: payload.deviceId,
          edition: payload.edition,
          featureKind: 'pronunciation',
          entityType: 'pronunciation_practice',
          entityId: payload.practiceId,
          modelId: primaryUsage.modelId,
          providerRequestId: primaryUsage.providerRequestId,
          promptTokens: primaryUsage.promptTokens,
          completionTokens: primaryUsage.completionTokens,
          cachedTokens: primaryUsage.cachedTokens,
          totalTokens: primaryUsage.totalTokens,
          estimatedCostUsdMicros: primaryUsage.estimatedCostUsdMicros,
          costUsdSource: primaryUsage.costUsdSource,
          latencyMs,
          audioDurationMs: payload.durationMs ?? null,
        });
      }

      if (result.weaknessSignalKey) {
        await upsertLinguisticGraphSignals({
          db,
          accountKey: payload.accountKey,
          edition: payload.edition,
          sourceKind: 'pronunciation',
          sourceRefId: payload.practiceId,
          signals: [
            {
              nodeKind: result.overallScore >= 85 ? 'target_structure' : 'bottleneck',
              canonicalKey: result.weaknessSignalKey,
              displayLabelEn: result.weaknessSignalKey.replace(/^phonetics:/, '').replace(/_/g, ' '),
              displayLabelFa: result.mouthTipFa ?? result.weaknessSignalKey,
              coachNoteEn: result.mouthTipEn,
              coachNoteFa: result.mouthTipFa ?? result.mouthTipEn,
              observedPolarity: result.overallScore >= 85 ? 'target_used' : 'gap_observed',
              excerptText: result.transcript,
              skill: 'speaking',
              detectedFrom: 'pronunciation',
            },
          ],
        });
      }

      await recordUserActivityLedger({
        db,
        accountKey: payload.accountKey,
        deviceId: payload.deviceId,
        edition: payload.edition,
        activityKind: 'pronunciation_practice',
        entityType: 'pronunciation_practice',
        entityId: payload.practiceId,
        weaknessKeys: result.weaknessSignalKey ? [result.weaknessSignalKey] : [],
        durationSeconds: payload.durationMs ? Math.ceil(payload.durationMs / 1000) : null,
        metadata: {
          targetText: payload.targetText,
          overallScore: result.overallScore,
        },
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
            attemptsCount: attemptNumber,
            claimToken: null,
            claimExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(eq(evaluationJobs.jobId, payload.jobId));
      } else {
        const errorCode = error instanceof EvaluationModelError ? error.code : 'internal_error';
        await db
          .update(evaluationJobs)
          .set({
            status: 'failed',
            errorCode,
            attemptsCount: attemptNumber,
            claimToken: null,
            claimExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(eq(evaluationJobs.jobId, payload.jobId));
        await db
          .update(pronunciationPractices)
          .set({ status: 'failed' })
          .where(eq(pronunciationPractices.practiceId, payload.practiceId));
      }
    }
    throw error;
  } finally {
    stopLeaseRenewal();
  }
}

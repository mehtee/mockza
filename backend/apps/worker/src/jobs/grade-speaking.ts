import { randomUUID } from 'node:crypto';
import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import {
  type AiUsageRecord,
  bufferAudioStream,
  type DiagnosticSpeakingInput,
  EvaluationModelError,
  gradeSpeakingDiagnosticGraph,
  gradeSpeakingGraph,
  prepareAudioForModel,
  type SpeakingGraphInput,
  type SpeakingGraphOutput,
  type SpeakingInvokeOptions,
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
import type { WorkerRetryContext } from './grade-writing.js';
import { recordPostEvaluationLinguisticSignals } from './record-linguistic-signals.js';

export const SPEAKING_JOB_QUEUE = 'evaluation.speaking';

export async function handleGradeSpeakingJob(
  payload: SpeakingGraphInput & { jobId: string; executionGeneration?: number },
  db?: MockzaDb,
  s3Client?: S3Client,
  bucket?: string,
  invokeOptions?: SpeakingInvokeOptions,
  retryCtx: WorkerRetryContext = {},
): Promise<SpeakingGraphOutput | null> {
  const startMs = Date.now();
  const attemptNumber = retryCtx.attemptNumber ?? 1;
  const maxAttempts = retryCtx.maxAttempts ?? 3;
  const expectedGeneration = payload.executionGeneration ?? 1;
  const claimToken = randomUUID();

  let claimedAccountKey: string | undefined;
  let claimedDeviceId: string | undefined;

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
          (existing.resultJson as Awaited<ReturnType<typeof gradeSpeakingGraph.invoke>> | null) ??
          null
        );
      }
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

    const rawPayload = payload as SpeakingGraphInput & {
      jobId: string;
      executionGeneration?: number;
      basePrompt?: string;
      followUpPrompt?: string;
    };
    const isDiagnosticTask = (rawPayload.partSequence as string) === 'diagnostic';
    const effectiveEdition =
      rawPayload.edition ?? (process.env['EDITION'] === 'irn' ? 'irn' : 'glb');
    const collectedUsages: AiUsageRecord[] = [];
    const trackedOptions: SpeakingInvokeOptions = {
      ...invokeOptions,
      onUsage: async (u) => {
        collectedUsages.push(u);
        await invokeOptions?.onUsage?.(u);
      },
    };
    const result = isDiagnosticTask
      ? await gradeSpeakingDiagnosticGraph.invoke(
          {
            attemptId: rawPayload.attemptId,
            edition: effectiveEdition,
            basePrompt: rawPayload.basePrompt ?? rawPayload.turns?.[0]?.promptText ?? '',
            followUpPrompt: rawPayload.followUpPrompt ?? rawPayload.turns?.[1]?.promptText,
            turnAudios,
          } satisfies DiagnosticSpeakingInput,
          trackedOptions,
        )
      : await gradeSpeakingGraph.invoke(
          {
            ...payload,
            edition: effectiveEdition,
            turnAudios,
          },
          trackedOptions,
        );
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

      const spokenTranscript =
        'transcriptSegments' in result && Array.isArray(result.transcriptSegments)
          ? result.transcriptSegments.map((seg) => seg.text).join(' ')
          : '';
      if (spokenTranscript.trim().length > 0) {
        await recordPostEvaluationLinguisticSignals({
          db,
          jobId: payload.jobId,
          edition: effectiveEdition,
          sourceKind: isDiagnosticTask ? 'diagnostic' : 'speaking',
          sourceRefId: payload.attemptId,
          textSample: spokenTranscript,
        });
      }

      if (claimedAccountKey) {
        for (const u of collectedUsages) {
          await recordAiUsageLedger({
            db,
            accountKey: claimedAccountKey,
            deviceId: claimedDeviceId ?? null,
            edition: effectiveEdition,
            featureKind: u.featureKind,
            entityType: isDiagnosticTask ? 'diagnostic_speaking' : 'speaking_eval',
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
            skill: 'speaking',
            sourceKind: isDiagnosticTask ? 'diagnostic' : 'speaking_eval',
            sourceId: payload.attemptId,
            rawScore: derivedScore,
            cefrEstimate: 'tierHint' in result ? (result.tierHint ?? null) : null,
          }).catch(() => {});
        }
        await upsertUserAttemptSync({
          db,
          attemptId: payload.attemptId,
          accountKey: claimedAccountKey,
          edition: effectiveEdition,
          packId: rawPayload.packId,
          examId: effectiveExam,
          skill: 'speaking',
          mode: isDiagnosticTask ? 'diagnostic' : 'timed_exam',
          status: 'completed',
          scoreBand: derivedScore,
          feedbackJson: result as unknown as Record<string, unknown>,
          deviceId: claimedDeviceId ?? null,
        }).catch(() => {});
        await recordUserActivityLedger({
          db,
          accountKey: claimedAccountKey,
          deviceId: claimedDeviceId ?? null,
          edition: effectiveEdition,
          activityKind: isDiagnosticTask ? 'diagnostic_speaking_done' : 'speaking_eval_done',
          entityType: 'evaluation_job',
          entityId: payload.jobId,
          metadata: { band: derivedScore },
        }).catch(() => {});
      }
    }

    return (isDiagnosticTask ? null : result) as SpeakingGraphOutput | null;
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

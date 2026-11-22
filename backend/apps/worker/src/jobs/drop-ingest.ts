import { createHash, randomUUID } from 'node:crypto';
import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import {
  type AiUsageRecord,
  bufferAudioStream,
  EvaluationModelError,
  ingestDroppedContentGraph,
  type IngestDroppedContentOptions,
  prepareAudioForModel,
  validateAndStripImageForModel,
} from '@mockza/ai';
import {
  commitQuotaReservationAtomic,
  droppedContents,
  evaluationJobs,
  type MockzaDb,
  recordAiUsageLedger,
  recordUserActivityLedger,
  refundQuotaAtomic,
} from '@mockza/db';
import {
  safeFetchBinaryUrl,
  safeFetchReadableUrl,
  SafeUrlFetchError,
} from '@mockza/storage';
import { and, eq, isNull, lt, notInArray, or } from 'drizzle-orm';
import { JOB_LEASE_DURATION_MS, startEvaluationLeaseRenewal } from './evaluation-lease.js';
import type { WorkerRetryContext } from './grade-writing.js';
import { recordPostEvaluationLinguisticSignals } from './record-linguistic-signals.js';

export const DROP_INGEST_JOB_QUEUE = 'advanced.drop-ingest';

export interface DropIngestJobPayload {
  jobId: string;
  attemptId: string;
  dropId: string;
  accountKey: string;
  deviceId: string;
  edition: 'glb' | 'irn';
  request:
    | { inputKind: 'text_url'; sourceUrl: string; examTrack: string }
    | { inputKind: 'text'; rawText: string; sourceLabel?: string; examTrack: string }
    | {
        inputKind: 'image';
        imageObjectKeys?: string[];
        imageUrls?: string[];
        examTrack: string;
      }
    | {
        inputKind: 'audio';
        audioObjectKey?: string;
        audioUrl?: string;
        durationSeconds: number;
        examTrack: string;
      };
  executionGeneration?: number;
}

export async function handleDropIngestJob(
  payload: DropIngestJobPayload,
  db?: MockzaDb,
  s3Client?: S3Client,
  bucket?: string,
  invokeOptions?: IngestDroppedContentOptions & { ttlDays?: number },
  retryCtx: WorkerRetryContext = {},
) {
  const startMs = Date.now();
  const attemptNumber = retryCtx.attemptNumber ?? 1;
  const maxAttempts = retryCtx.maxAttempts ?? 2;
  const expectedGeneration = payload.executionGeneration ?? 1;
  const claimToken = randomUUID();
  const ttlDays = invokeOptions?.ttlDays ?? 30;

  if (db && payload.jobId) {
    const claimExpiresAt = new Date(Date.now() + JOB_LEASE_DURATION_MS);
    const claimed = await db
      .update(evaluationJobs)
      .set({
        status: 'evaluating',
        stageDetail: 'Extracting key expressions and synthesizing 2-minute micro-drill',
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
    const req = payload.request;
    let sourceDomainOrLabel = 'Personal Paste';
    let titleHint: string | undefined;
    let rawText: string | undefined;
    let imageDataUris: string[] | undefined;
    let audioBase64: string | undefined;
    let audioFormat: 'm4a' | 'mp3' | 'wav' | undefined;
    const mediaKeys: string[] = [];

    if (req.inputKind === 'text_url') {
      const fetched = await safeFetchReadableUrl(req.sourceUrl, {
        allowHttpInNonProd: process.env['NODE_ENV'] !== 'production',
      });
      sourceDomainOrLabel = fetched.sourceDomain;
      titleHint = fetched.title;
      rawText = fetched.extractedText;
    } else if (req.inputKind === 'text') {
      sourceDomainOrLabel = req.sourceLabel || 'Personal Snippet';
      rawText = req.rawText;
    } else if (req.inputKind === 'image') {
      if (db && payload.jobId) {
        await db
          .update(evaluationJobs)
          .set({ stageDetail: 'Reading uploaded image(s)', updatedAt: new Date() })
          .where(eq(evaluationJobs.jobId, payload.jobId))
          .catch(() => {});
      }
      sourceDomainOrLabel = 'Screenshot Upload';
      imageDataUris = [];
      for (const objKey of req.imageObjectKeys ?? []) {
        if (s3Client && bucket) {
          const obj = await s3Client.send(
            new GetObjectCommand({ Bucket: bucket, Key: objKey }),
          );
          if (obj.Body) {
            const buf = await bufferAudioStream(
              obj.Body as NodeJS.ReadableStream,
              5 * 1024 * 1024,
            );
            const stripped = validateAndStripImageForModel(buf);
            imageDataUris.push(stripped.dataUri);
            mediaKeys.push(objKey);
          }
        }
      }
      for (const imgUrl of (req.imageUrls ?? []).slice(0, 4)) {
        const fetchedImg = await safeFetchBinaryUrl(imgUrl, {
          allowHttpInNonProd: process.env['NODE_ENV'] !== 'production',
          maxBytes: 5 * 1024 * 1024,
        });
        const stripped = validateAndStripImageForModel(fetchedImg.body);
        imageDataUris.push(stripped.dataUri);
        if (sourceDomainOrLabel === 'Screenshot Upload') {
          sourceDomainOrLabel = fetchedImg.sourceDomain;
        }
      }
    } else if (req.inputKind === 'audio') {
      sourceDomainOrLabel = 'Bounded Audio Drop';
      if (req.audioObjectKey && s3Client && bucket) {
        const obj = await s3Client.send(
          new GetObjectCommand({ Bucket: bucket, Key: req.audioObjectKey }),
        );
        if (obj.Body) {
          const buf = await bufferAudioStream(obj.Body as NodeJS.ReadableStream, 5 * 1024 * 1024);
          const prepared = await prepareAudioForModel(buf, req.audioObjectKey, {
            maxDurationSeconds: 180,
          });
          audioBase64 = prepared.base64Data;
          audioFormat = prepared.format;
          mediaKeys.push(req.audioObjectKey);
        }
      } else if (req.audioUrl) {
        const fetchedAudio = await safeFetchBinaryUrl(req.audioUrl, {
          allowHttpInNonProd: process.env['NODE_ENV'] !== 'production',
          maxBytes: 5 * 1024 * 1024,
        });
        const ctLower = fetchedAudio.contentType.toLowerCase();
        const extHint = ctLower.includes('mpeg') || req.audioUrl.endsWith('.mp3')
          ? 'drop.mp3'
          : ctLower.includes('wav') || req.audioUrl.endsWith('.wav')
            ? 'drop.wav'
            : 'drop.m4a';
        const prepared = await prepareAudioForModel(fetchedAudio.body, extHint, {
          maxDurationSeconds: 180,
        });
        audioBase64 = prepared.base64Data;
        audioFormat = prepared.format;
        sourceDomainOrLabel = fetchedAudio.sourceDomain;
      }
    }

    if (db && payload.jobId) {
      await db
        .update(evaluationJobs)
        .set({ stageDetail: 'Picking high-value expressions & building 2-min drill', updatedAt: new Date() })
        .where(eq(evaluationJobs.jobId, payload.jobId))
        .catch(() => {});
    }

    const collectedUsages: AiUsageRecord[] = [];
    const result = await ingestDroppedContentGraph(
      {
        dropId: payload.dropId,
        edition: payload.edition,
        inputKind: req.inputKind,
        examTrack: req.examTrack,
        sourceDomainOrLabel,
        titleHint,
        rawText,
        imageDataUris,
        audioBase64,
        audioFormat,
      },
      {
        ...invokeOptions,
        allowDemoEvaluator:
          invokeOptions?.allowDemoEvaluator ??
          (process.env['ALLOW_DEMO_EVALUATOR'] === 'true' || !process.env['OPENROUTER_API_KEY']),
        onUsage: async (u) => {
          collectedUsages.push(u);
          await invokeOptions?.onUsage?.(u);
        },
      },
    );

    const primaryUsage = collectedUsages.reduce<AiUsageRecord | null>((acc, u) => {
      if (!acc) return { ...u };
      return {
        ...acc,
        promptTokens: acc.promptTokens + u.promptTokens,
        completionTokens: acc.completionTokens + u.completionTokens,
        cachedTokens: acc.cachedTokens + u.cachedTokens,
        totalTokens: acc.totalTokens + u.totalTokens,
        estimatedCostUsdMicros: acc.estimatedCostUsdMicros + u.estimatedCostUsdMicros,
      };
    }, null);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
    const sourceHash = createHash('sha256')
      .update(rawText ?? sourceDomainOrLabel)
      .digest('hex');

    const responseDto = {
      dropId: payload.dropId,
      edition: payload.edition,
      inputKind: req.inputKind,
      sourceDomainOrLabel,
      title: result.title,
      cefrEstimate: result.cefrEstimate,
      detectedTopics: result.detectedTopics,
      extractedPhrases: result.extractedPhrases,
      drillPayload: result.drillPayload,
      createdAt: now.toISOString(),
    };

    const latencyMs = Date.now() - startMs;

    if (db && payload.jobId) {
      await db.transaction(async (tx) => {
        await tx
          .insert(droppedContents)
          .values({
            dropId: payload.dropId,
            accountKey: payload.accountKey,
            edition: payload.edition,
            inputKind: req.inputKind,
            sourceRefHash: sourceHash,
            sourceDomainOrLabel,
            title: result.title,
            cefrEstimate: result.cefrEstimate,
            detectedTopicsJson: result.detectedTopics,
            extractedPhrasesJson: result.extractedPhrases,
            drillPayloadJson: result.drillPayload,
            mediaObjectKeysJson: mediaKeys,
            expiresAt,
          })
          .onConflictDoNothing();

        const updated = await tx
          .update(evaluationJobs)
          .set({
            status: 'completed',
            stageDetail: 'Micro-drill ready',
            resultJson: responseDto,
            modelId:
              req.inputKind === 'audio' ? 'google/gemini-3.1-flash-lite' : 'cloudflare/clairic',
            rubricVersion: 'drop-ingest-v1',
            latencyMs,
            tokenUsageJson: primaryUsage,
            estimatedCostUsdMicros: primaryUsage?.estimatedCostUsdMicros ?? 0,
            errorCode: null,
            claimToken: null,
            claimExpiresAt: null,
            updatedAt: now,
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
        sourceKind: 'drop_anything',
        sourceRefId: payload.dropId,
        textSample: result.excerptForGraph,
        topicHint: result.detectedTopics[0],
      });

      for (const u of collectedUsages) {
        await recordAiUsageLedger({
          db,
          accountKey: payload.accountKey,
          deviceId: payload.deviceId,
          edition: payload.edition,
          featureKind: u.featureKind,
          entityType: 'drop_anything',
          entityId: payload.dropId,
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
      await recordUserActivityLedger({
        db,
        accountKey: payload.accountKey,
        deviceId: payload.deviceId,
        edition: payload.edition,
        activityKind: 'drop_ingest_done',
        entityType: 'dropped_content',
        entityId: payload.dropId,
        topicKey: result.detectedTopics[0] ?? null,
      }).catch(() => {});
    }

    return responseDto;
  } catch (error) {
    const isNonRetryable =
      error instanceof SafeUrlFetchError ||
      (error instanceof EvaluationModelError && !error.retryable);
    const willRetry = !isNonRetryable && attemptNumber < maxAttempts;

    if (db && payload.jobId) {
      if (willRetry) {
        await db
          .update(evaluationJobs)
          .set({
            status: 'repairing',
            stageDetail: `Retrying Drop extraction (${attemptNumber}/${maxAttempts})`,
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
        const errorCode =
          error instanceof SafeUrlFetchError
            ? error.code
            : error instanceof EvaluationModelError
              ? error.code === 'audio_too_long'
                ? 'DROP_AUDIO_TOO_LONG'
                : error.code
              : 'internal_error';

        await db.transaction(async (tx) => {
          const updated = await tx
            .update(evaluationJobs)
            .set({
              status: 'failed',
              stageDetail: error instanceof Error ? error.message.slice(0, 200) : 'Drop failed',
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

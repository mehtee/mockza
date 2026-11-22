import { createHash } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import {
  EvaluationModelError,
  OpenRouterClient,
  resolveTtsDefaultVoice,
  resolveTtsModelId,
} from '@mockza/ai';
import type { AppEnv } from '@mockza/config';
import {
  ApiErrorSchema,
  TtsSynthesizeRequestSchema,
  TtsSynthesizeResponseSchema,
} from '@mockza/contracts';
import {
  aiUsageLedger,
  type MockzaDb,
  recordAiUsageLedger,
  recordUserActivityLedger,
  ttsAudioCache,
} from '@mockza/db';
import { createAudioS3Client, getMediaObject, putObjectBuffer } from '@mockza/storage';
import { and, eq, gte, sql } from 'drizzle-orm';
import { createDeviceAuthMiddleware } from '../middleware/auth.js';
import { createRateLimitMiddleware } from '../middleware/rate-limit.js';
import type { RequestVariables } from '../middleware/request-id.js';
import { getAccountQuotaStatus } from '../services/quota.js';

const MAX_DEV_MEMORY_AUDIO_ENTRIES = 64;
const MAX_DEV_MEMORY_AUDIO_BYTES = 16 * 1024 * 1024;
const FREE_DAILY_UNCACHED_TTS_LIMIT = 80;
const PRO_DAILY_UNCACHED_TTS_LIMIT = 500;

function normalizeTtsText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function registerTtsRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
  s3Client?: S3Client,
): void {
  const authMiddleware = createDeviceAuthMiddleware(env, db);
  app.use('/v1/tts/*', authMiddleware);
  app.use(
    '/v1/tts/synthesize',
    createRateLimitMiddleware({
      windowMs: 60_000,
      maxRequests: 60,
      keyByAccount: true,
    }),
  );
  const internalS3 = s3Client ?? createAudioS3Client(env);
  const usePersistentStorage = Boolean(db || s3Client);
  const memoryAudioCache = new Map<
    string,
    { bytes: Uint8Array; modelUsed: string; voice: string; format: string }
  >();
  let memoryAudioCacheBytes = 0;

  function putMemoryAudioCache(
    key: string,
    entry: { bytes: Uint8Array; modelUsed: string; voice: string; format: string },
  ) {
    if (usePersistentStorage) return;
    const existing = memoryAudioCache.get(key);
    if (existing) {
      memoryAudioCacheBytes -= existing.bytes.byteLength;
      memoryAudioCache.delete(key);
    }
    while (
      memoryAudioCache.size >= MAX_DEV_MEMORY_AUDIO_ENTRIES ||
      memoryAudioCacheBytes + entry.bytes.byteLength > MAX_DEV_MEMORY_AUDIO_BYTES
    ) {
      const oldestKey = memoryAudioCache.keys().next().value;
      if (!oldestKey) break;
      const oldest = memoryAudioCache.get(oldestKey);
      memoryAudioCache.delete(oldestKey);
      if (oldest) memoryAudioCacheBytes -= oldest.bytes.byteLength;
    }
    memoryAudioCache.set(key, entry);
    memoryAudioCacheBytes += entry.bytes.byteLength;
  }

  const synthesizeRoute = createRoute({
    method: 'post',
    path: '/v1/tts/synthesize',
    request: {
      body: {
        required: true,
        content: { 'application/json': { schema: TtsSynthesizeRequestSchema } },
      },
    },
    responses: {
      200: {
        description: 'Cached or newly synthesized OpenRouter Kokoro-82m speech URL.',
        content: { 'application/json': { schema: TtsSynthesizeResponseSchema } },
      },
      400: {
        description: 'Input text exceeds allowed ceiling.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      401: {
        description: 'Unauthorized.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      503: {
        description: 'OpenRouter TTS unavailable.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
      429: {
        description: 'Daily uncached TTS synthesis limit reached.',
        content: { 'application/json': { schema: ApiErrorSchema } },
      },
    },
  });

  app.openapi(synthesizeRoute, async (c) => {
    const deviceId = c.get('deviceId');
    if (!deviceId) {
      return c.json(
        { code: 'unauthorized' as const, message: 'Auth required', requestId: c.get('requestId') },
        401,
      );
    }
    const accountKey = c.get('accountKey') ?? deviceId;
    const body = c.req.valid('json');
    const normalizedText = normalizeTtsText(body.text);

    if (normalizedText.length === 0 || normalizedText.length > env.TTS_MAX_CHARS) {
      return c.json(
        {
          code: 'validation_error' as const,
          message: `TTS text length must be 1..${env.TTS_MAX_CHARS} characters.`,
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const modelId = resolveTtsModelId(env.OPENROUTER_TTS_MODEL);
    const voice = resolveTtsDefaultVoice(body.voice ?? env.OPENROUTER_TTS_DEFAULT_VOICE);
    const speed = body.speed ?? 1;
    const speedMilli = Math.round(speed * 1000);
    const textHash = sha256Hex(normalizedText);
    const cacheKey = sha256Hex(`${modelId}|${voice}|${speedMilli}|mp3|${normalizedText}`);

    // Tier 1 DB/S3 cache lookup
    if (db) {
      const [cachedRow] = await db
        .select()
        .from(ttsAudioCache)
        .where(eq(ttsAudioCache.cacheKey, cacheKey))
        .limit(1);
      if (cachedRow) {
        await db
          .update(ttsAudioCache)
          .set({
            hitCount: sql`${ttsAudioCache.hitCount} + 1`,
            lastAccessedAt: new Date(),
          })
          .where(eq(ttsAudioCache.cacheKey, cacheKey));
        await recordUserActivityLedger({
          db,
          accountKey,
          deviceId,
          edition: env.EDITION,
          activityKind: 'tts_listen',
          entityType: 'tts_cache',
          entityId: cacheKey,
          metadata: { cached: true, voice, context: body.sourceContext ?? 'vocab' },
        });
        return c.json(
          TtsSynthesizeResponseSchema.parse({
            cacheKey,
            audioUrl: `/v1/tts/audio/${cacheKey}`,
            cached: true,
            modelUsed: cachedRow.modelId,
            voice: cachedRow.voice,
            format: cachedRow.format,
          }),
          200,
        );
      }
    } else {
      const memHit = memoryAudioCache.get(cacheKey);
      if (memHit) {
        return c.json(
          TtsSynthesizeResponseSchema.parse({
            cacheKey,
            audioUrl: `/v1/tts/audio/${cacheKey}`,
            cached: true,
            modelUsed: memHit.modelUsed,
            voice: memHit.voice,
            format: memHit.format,
          }),
          200,
        );
      }
    }

    if (!env.OPENROUTER_API_KEY) {
      return c.json(
        {
          code: 'model_unavailable' as const,
          message: 'OpenRouter TTS unavailable: OPENROUTER_API_KEY is not configured.',
          requestId: c.get('requestId'),
        },
        503,
      );
    }

    if (db) {
      const todayMidnight = new Date();
      todayMidnight.setUTCHours(0, 0, 0, 0);
      const [quotaStatus, ttsUsedRows] = await Promise.all([
        getAccountQuotaStatus({ db, accountKey, deviceId }),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(aiUsageLedger)
          .where(
            and(
              eq(aiUsageLedger.accountKey, accountKey),
              eq(aiUsageLedger.featureKind, 'tts'),
              gte(aiUsageLedger.createdAt, todayMidnight),
            ),
          ),
      ]);
      const dailyLimit = quotaStatus.isPro
        ? PRO_DAILY_UNCACHED_TTS_LIMIT
        : FREE_DAILY_UNCACHED_TTS_LIMIT;
      if (Number(ttsUsedRows[0]?.count ?? 0) >= dailyLimit) {
        return c.json(
          {
            code: 'quota_exceeded' as const,
            message: `Daily new speech synthesis limit (${dailyLimit}) reached. Cached phrases remain available.`,
            requestId: c.get('requestId'),
          },
          429,
        );
      }
    }

    const client = new OpenRouterClient({ apiKey: env.OPENROUTER_API_KEY, timeoutMs: 20_000 });
    let speech: Awaited<ReturnType<OpenRouterClient['createSpeech']>>;
    try {
      speech = await client.createSpeech({
        text: normalizedText,
        model: modelId,
        voice,
        speed,
        responseFormat: 'mp3',
      });
    } catch (err) {
      const message =
        err instanceof EvaluationModelError
          ? err.message
          : 'OpenRouter speech synthesis failed unexpectedly.';
      return c.json(
        {
          code: 'model_unavailable' as const,
          message,
          requestId: c.get('requestId'),
        },
        503,
      );
    }

    const objectKey = `media/tts/${cacheKey}.mp3`;
    if (s3Client || db) {
      await putObjectBuffer({
        client: internalS3,
        bucket: env.S3_BUCKET,
        objectKey,
        body: speech.audioBytes,
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=31536000',
      });
    } else {
      putMemoryAudioCache(cacheKey, {
        bytes: speech.audioBytes,
        modelUsed: speech.modelUsed,
        voice: speech.voice,
        format: 'mp3',
      });
    }

    if (db) {
      await db
        .insert(ttsAudioCache)
        .values({
          cacheKey,
          textHash,
          normalizedText,
          voice: speech.voice,
          modelId: speech.modelUsed,
          speedMilli,
          format: 'mp3',
          objectKey,
          byteLength: speech.audioBytes.byteLength,
          charCount: speech.characters,
          estimatedCostUsdMicros: speech.estimatedCostUsdMicros,
          hitCount: 1,
          lastAccessedAt: new Date(),
          createdAt: new Date(),
        })
        .onConflictDoNothing();

      await recordAiUsageLedger({
        db,
        accountKey,
        deviceId,
        edition: env.EDITION,
        featureKind: 'tts',
        entityType: body.sourceContext ?? 'tts',
        entityId: cacheKey,
        modelId: speech.modelUsed,
        providerRequestId: speech.providerRequestId,
        estimatedCostUsdMicros: speech.estimatedCostUsdMicros,
        costUsdSource: speech.providerRequestId ? 'openrouter_usage' : 'registry_estimate',
        latencyMs: speech.latencyMs,
        ttsCharacters: speech.characters,
      });

      await recordUserActivityLedger({
        db,
        accountKey,
        deviceId,
        edition: env.EDITION,
        activityKind: 'tts_listen',
        entityType: 'tts_cache',
        entityId: cacheKey,
        metadata: { cached: false, voice: speech.voice, chars: speech.characters },
      });
    }

    return c.json(
      TtsSynthesizeResponseSchema.parse({
        cacheKey,
        audioUrl: `/v1/tts/audio/${cacheKey}`,
        cached: false,
        modelUsed: speech.modelUsed,
        voice: speech.voice,
        format: 'mp3',
      }),
      200,
    );
  });

  const getTtsAudioRoute = createRoute({
    method: 'get',
    path: '/v1/tts/audio/{cacheKey}',
    request: {
      params: z.object({ cacheKey: z.string().regex(/^[a-f0-9]{16,64}$/i) }),
    },
    responses: {
      200: { description: 'MP3 speech stream' },
      404: { description: 'Cached TTS audio not found' },
    },
  });

  app.openapi(getTtsAudioRoute, async (c) => {
    const { cacheKey } = c.req.valid('param');
    const mem = memoryAudioCache.get(cacheKey);
    if (mem) {
      c.header('Content-Type', 'audio/mpeg');
      c.header('Cache-Control', 'public, max-age=31536000, immutable');
      return c.body(Buffer.from(mem.bytes) as never, 200);
    }

    const objectKey = `media/tts/${cacheKey}.mp3`;
    const obj = await getMediaObject({
      client: internalS3,
      bucket: env.S3_BUCKET,
      objectKey,
    });
    if (!obj) {
      return c.json(
        { code: 'not_found', message: 'TTS audio not found.', requestId: c.get('requestId') },
        404,
      );
    }
    const chunks: Uint8Array[] = [];
    for await (const chunk of obj.body) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Uint8Array));
    }
    const buf = Buffer.concat(chunks);
    c.header('Content-Type', 'audio/mpeg');
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
    return c.body(buf as never, 200);
  });
}

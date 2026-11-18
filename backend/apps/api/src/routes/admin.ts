import { timingSafeEqual } from 'node:crypto';
import type { S3Client } from '@aws-sdk/client-s3';
import { type OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import { CatalogTrackSchema, SupportedExamIdSchema } from '@mockza/contracts';
import {
  catalogPacks,
  examQuestions,
  examSections,
  type MockzaDb,
  microDrills,
  vocabDeckCards,
} from '@mockza/db';
import {
  checkCleanRoomSafety,
  normalizeQuestionType,
  validateExamBundleIntegrity,
} from '@mockza/domain';
import { contentTypeFromKey, putObjectBuffer } from '@mockza/storage';
import { asc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { RequestVariables } from '../middleware/request-id.js';

const AdminSectionInputSchema = z.object({
  sectionId: z.string().min(1),
  sectionIndex: z.number().int().positive(),
  sectionType: z.string().min(1),
  title: z.string().min(1),
  instructions: z.string().default(''),
  contentText: z.string().default(''),
  paragraphs: z.record(z.string(), z.string()).nullable().optional(),
  transcript: z
    .array(
      z.object({
        speaker: z.string(),
        startMs: z.number().int().nonnegative(),
        endMs: z.number().int().nonnegative(),
        text: z.string(),
      }),
    )
    .nullable()
    .optional(),
  mediaObjectKey: z.string().nullable().optional(),
  durationSeconds: z.number().int().nonnegative().default(0),
  wordCount: z.number().int().nonnegative().default(0),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

const AdminQuestionInputSchema = z.object({
  questionId: z.string().min(1),
  sectionId: z.string().min(1),
  questionNumber: z.number().int().positive(),
  questionType: z.string().min(1),
  prompt: z.string().min(1),
  options: z.array(z.string()).nullable().optional(),
  acceptedAnswers: z.array(z.string()),
  maxWords: z.number().int().positive().max(40).optional(),
  evidence: z.record(z.string(), z.unknown()).nullable().optional(),
  cueTimestampMs: z.number().int().nonnegative().nullable().optional(),
});

const AdminUpsertExamSchema = z.object({
  packId: z.string().min(3).max(120),
  edition: z.enum(['glb', 'irn', 'all']).default('all'),
  examId: SupportedExamIdSchema.default('ielts_academic'),
  skill: z.enum(['reading', 'listening', 'writing', 'speaking', 'fullMock']),
  track: CatalogTrackSchema.default('academic'),
  title: z.string().min(1),
  description: z.string().default(''),
  durationSeconds: z.number().int().nonnegative().default(900),
  accent: z.string().nullable().optional(),
  mediaObjectKey: z.string().nullable().optional(),
  version: z.string().min(1).default('1.0.0'),
  contentOrigin: z
    .enum(['authored_original', 'cc_by_sa_adapted', 'open_corpus'])
    .default('authored_original'),
  humanQaReviewed: z.literal(true),
  isFreeSample: z.boolean().default(false),
  isPublished: z.boolean().default(true),
  sections: z.array(AdminSectionInputSchema).min(1),
  questions: z.array(AdminQuestionInputSchema).min(1),
});

const AdminUpsertDrillSchema = z.object({
  drillId: z.string().min(3),
  edition: z.enum(['glb', 'irn', 'all']).default('all'),
  title: z.string().min(1),
  drillType: z.string().min(1),
  skill: z.string().min(1),
  durationSeconds: z.number().int().positive().default(180),
  isPublished: z.boolean().default(true),
  items: z.array(
    z.object({
      id: z.string().min(1),
      prompt: z.string().min(1),
      options: z.array(z.string()).default([]),
      answer: z.string().min(1),
      explanation: z.string().default(''),
    }),
  ),
});

const AdminUpsertVocabSchema = z.object({
  cards: z
    .array(
      z.object({
        cardId: z.string().min(1),
        headword: z.string().min(1),
        ipa: z.string().default(''),
        definition: z.string().min(1),
        topicTag: z.string().min(1),
        contextSentence: z.string().min(1),
        paraphrases: z.array(z.string()).default([]),
        collocations: z.array(z.string()).default([]),
        easeFactorMilli: z.number().int().positive().default(2500),
        isPublished: z.boolean().default(true),
      }),
    )
    .min(1)
    .max(500),
});

function hasValidAdminKey(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createAdminRoutes(env: AppEnv, db?: MockzaDb, s3Client?: S3Client) {
  const router = new Hono<{ Variables: RequestVariables }>();

  router.use('*', async (c, next) => {
    const provided = c.req.header('x-admin-api-key');
    if (!hasValidAdminKey(provided, env.ADMIN_API_KEY)) {
      return c.json(
        {
          code: 'unauthorized_admin',
          message: 'Valid x-admin-api-key required.',
          requestId: c.get('requestId'),
        },
        401,
      );
    }
    return next();
  });

  router.get('/exams', async (c) => {
    if (!db) {
      return c.json(
        { code: 'db_unavailable', message: 'Database unavailable.', requestId: c.get('requestId') },
        503,
      );
    }
    const rows = await db
      .select()
      .from(catalogPacks)
      .orderBy(asc(catalogPacks.skill), asc(catalogPacks.packId));
    return c.json({ packs: rows }, 200);
  });

  router.post('/exams', async (c) => {
    if (!db) {
      return c.json(
        { code: 'db_unavailable', message: 'Database unavailable.', requestId: c.get('requestId') },
        503,
      );
    }
    const raw = await c.req.json();
    const parsed = AdminUpsertExamSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { code: 'validation_error', message: parsed.error.message, requestId: c.get('requestId') },
        400,
      );
    }

    const body = parsed.data;
    const serialized = JSON.stringify(body);
    const normalizedQuestions = body.questions.map((q) => {
      const mergedEvidence: Record<string, unknown> | null =
        q.evidence || q.maxWords != null
          ? { ...(q.evidence ?? {}), ...(q.maxWords != null ? { maxWords: q.maxWords } : {}) }
          : null;
      return {
        questionId: q.questionId,
        packId: body.packId,
        sectionId: q.sectionId,
        questionNumber: q.questionNumber,
        questionType: normalizeQuestionType(q.questionType),
        prompt: q.prompt,
        optionsJson: q.options ?? null,
        acceptedAnswersJson: q.acceptedAnswers,
        evidenceJson: mergedEvidence,
        cueTimestampMs: q.cueTimestampMs ?? null,
      };
    });

    const integrity = validateExamBundleIntegrity({
      packId: body.packId,
      skill: body.skill,
      humanQaReviewed: body.humanQaReviewed,
      rawTextForSafetyCheck: serialized,
      sections: body.sections,
      questions: normalizedQuestions.map((q) => ({
        questionId: q.questionId,
        sectionId: q.sectionId,
        questionNumber: q.questionNumber,
        questionType: q.questionType,
        prompt: q.prompt,
        options: q.optionsJson,
        acceptedAnswers: q.acceptedAnswersJson,
        evidence: q.evidenceJson,
        cueTimestampMs: q.cueTimestampMs,
      })),
    });

    if (!integrity.valid) {
      return c.json(
        {
          code: 'validation_error',
          message: integrity.errors.join(' '),
          requestId: c.get('requestId'),
        },
        400,
      );
    }

    const { sha256, byteLength } = integrity.computedDigest;
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .insert(catalogPacks)
        .values({
          packId: body.packId,
          edition: body.edition,
          examId: body.examId,
          skill: body.skill,
          track: body.track,
          title: body.title,
          description: body.description,
          durationSeconds: body.durationSeconds,
          questionCount: body.questions.length,
          accent: body.accent ?? null,
          mediaObjectKey: body.mediaObjectKey ?? null,
          version: body.version,
          sha256,
          byteLength,
          cdnRelativePath: body.mediaObjectKey ?? '',
          contentOrigin: body.contentOrigin,
          humanQaReviewed: body.humanQaReviewed,
          isFreeSample: body.isFreeSample,
          isPublished: body.isPublished,
          publishedAt: body.isPublished ? now : null,
        })
        .onConflictDoUpdate({
          target: catalogPacks.packId,
          set: {
            edition: body.edition,
            examId: body.examId,
            skill: body.skill,
            track: body.track,
            title: body.title,
            description: body.description,
            durationSeconds: body.durationSeconds,
            questionCount: body.questions.length,
            accent: body.accent ?? null,
            mediaObjectKey: body.mediaObjectKey ?? null,
            version: body.version,
            sha256,
            byteLength,
            cdnRelativePath: body.mediaObjectKey ?? '',
            contentOrigin: body.contentOrigin,
            humanQaReviewed: body.humanQaReviewed,
            isFreeSample: body.isFreeSample,
            isPublished: body.isPublished,
            publishedAt: body.isPublished ? now : null,
          },
        });

      await tx.delete(examQuestions).where(eq(examQuestions.packId, body.packId));
      await tx.delete(examSections).where(eq(examSections.packId, body.packId));

      await tx.insert(examSections).values(
        body.sections.map((s) => ({
          sectionId: s.sectionId,
          packId: body.packId,
          sectionIndex: s.sectionIndex,
          sectionType: s.sectionType,
          title: s.title,
          instructions: s.instructions,
          contentText: s.contentText,
          paragraphsJson: s.paragraphs ?? null,
          transcriptJson: s.transcript ?? null,
          mediaObjectKey: s.mediaObjectKey ?? null,
          durationSeconds: s.durationSeconds,
          wordCount: s.wordCount,
          metadataJson: s.metadata ?? null,
        })),
      );

      await tx.insert(examQuestions).values(normalizedQuestions);
    });

    return c.json(
      { ok: true, packId: body.packId, sha256, questionCount: body.questions.length },
      201,
    );
  });

  router.patch('/exams/:packId/publish', async (c) => {
    if (!db) {
      return c.json(
        { code: 'db_unavailable', message: 'Database unavailable.', requestId: c.get('requestId') },
        503,
      );
    }
    const packId = c.req.param('packId');
    const body = (await c.req.json()) as { isPublished?: boolean };
    const isPublished = Boolean(body.isPublished);

    const [packRow] = await db
      .select()
      .from(catalogPacks)
      .where(eq(catalogPacks.packId, packId))
      .limit(1);
    if (!packRow) {
      return c.json(
        { code: 'not_found', message: `Pack ${packId} not found.`, requestId: c.get('requestId') },
        404,
      );
    }

    if (isPublished) {
      const [sections, questions] = await Promise.all([
        db
          .select()
          .from(examSections)
          .where(eq(examSections.packId, packId))
          .orderBy(asc(examSections.sectionIndex)),
        db
          .select()
          .from(examQuestions)
          .where(eq(examQuestions.packId, packId))
          .orderBy(asc(examQuestions.questionNumber)),
      ]);

      const integrity = validateExamBundleIntegrity({
        packId: packRow.packId,
        skill: packRow.skill,
        humanQaReviewed: packRow.humanQaReviewed,
        declaredSha256: packRow.sha256,
        rawTextForSafetyCheck: JSON.stringify({ pack: packRow, sections, questions }),
        sections: sections.map((s) => ({
          sectionId: s.sectionId,
          sectionIndex: s.sectionIndex,
          sectionType: s.sectionType,
          title: s.title,
          instructions: s.instructions,
          contentText: s.contentText,
          paragraphs: s.paragraphsJson,
          transcript: s.transcriptJson,
          mediaObjectKey: s.mediaObjectKey,
          durationSeconds: s.durationSeconds,
          wordCount: s.wordCount,
          metadata: s.metadataJson,
        })),
        questions: questions.map((q) => ({
          questionId: q.questionId,
          sectionId: q.sectionId,
          questionNumber: q.questionNumber,
          questionType: q.questionType,
          prompt: q.prompt,
          options: q.optionsJson,
          acceptedAnswers: q.acceptedAnswersJson,
          evidence: q.evidenceJson,
          cueTimestampMs: q.cueTimestampMs,
        })),
      });

      if (!integrity.valid) {
        return c.json(
          {
            code: 'publish_validation_failed',
            message: integrity.errors.join(' '),
            requestId: c.get('requestId'),
          },
          400,
        );
      }
    }

    await db
      .update(catalogPacks)
      .set({ isPublished, publishedAt: isPublished ? new Date() : null })
      .where(eq(catalogPacks.packId, packId));
    return c.json({ ok: true, packId, isPublished }, 200);
  });

  router.delete('/exams/:packId', async (c) => {
    if (!db) {
      return c.json(
        { code: 'db_unavailable', message: 'Database unavailable.', requestId: c.get('requestId') },
        503,
      );
    }
    const packId = c.req.param('packId');
    await db.delete(catalogPacks).where(eq(catalogPacks.packId, packId));
    return c.json({ ok: true, packId }, 200);
  });

  router.post('/drills', async (c) => {
    if (!db) {
      return c.json(
        { code: 'db_unavailable', message: 'Database unavailable.', requestId: c.get('requestId') },
        503,
      );
    }
    const parsed = AdminUpsertDrillSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json(
        { code: 'validation_error', message: parsed.error.message, requestId: c.get('requestId') },
        400,
      );
    }
    const body = parsed.data;
    const safety = checkCleanRoomSafety(JSON.stringify(body));
    if (!safety.safe) {
      return c.json(
        {
          code: 'copyright_policy_violation',
          message: safety.violations.join(', '),
          requestId: c.get('requestId'),
        },
        400,
      );
    }
    await db
      .insert(microDrills)
      .values({
        drillId: body.drillId,
        edition: body.edition,
        title: body.title,
        drillType: body.drillType,
        skill: body.skill,
        durationSeconds: body.durationSeconds,
        itemsJson: body.items,
        isPublished: body.isPublished,
      })
      .onConflictDoUpdate({
        target: microDrills.drillId,
        set: {
          edition: body.edition,
          title: body.title,
          drillType: body.drillType,
          skill: body.skill,
          durationSeconds: body.durationSeconds,
          itemsJson: body.items,
          isPublished: body.isPublished,
        },
      });
    return c.json({ ok: true, drillId: body.drillId }, 201);
  });

  router.post('/vocab', async (c) => {
    if (!db) {
      return c.json(
        { code: 'db_unavailable', message: 'Database unavailable.', requestId: c.get('requestId') },
        503,
      );
    }
    const parsed = AdminUpsertVocabSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json(
        { code: 'validation_error', message: parsed.error.message, requestId: c.get('requestId') },
        400,
      );
    }
    const safety = checkCleanRoomSafety(JSON.stringify(parsed.data));
    if (!safety.safe) {
      return c.json(
        {
          code: 'copyright_policy_violation',
          message: safety.violations.join(', '),
          requestId: c.get('requestId'),
        },
        400,
      );
    }
    const rows = parsed.data.cards.map((card) => ({
      cardId: card.cardId,
      headword: card.headword,
      ipa: card.ipa,
      definition: card.definition,
      topicTag: card.topicTag,
      contextSentence: card.contextSentence,
      paraphrasesJson: card.paraphrases,
      collocationsJson: card.collocations,
      easeFactorMilli: card.easeFactorMilli,
      isPublished: card.isPublished,
    }));
    await db
      .insert(vocabDeckCards)
      .values(rows)
      .onConflictDoUpdate({
        target: vocabDeckCards.cardId,
        set: {
          headword: sql`excluded.headword`,
          ipa: sql`excluded.ipa`,
          definition: sql`excluded.definition`,
          topicTag: sql`excluded.topic_tag`,
          contextSentence: sql`excluded.context_sentence`,
          paraphrasesJson: sql`excluded.paraphrases_json`,
          collocationsJson: sql`excluded.collocations_json`,
          easeFactorMilli: sql`excluded.ease_factor_milli`,
          isPublished: sql`excluded.is_published`,
        },
      });
    return c.json({ ok: true, count: rows.length }, 201);
  });

  router.put('/media/upload', async (c) => {
    if (!s3Client) {
      return c.json(
        {
          code: 'storage_unavailable',
          message: 'S3 client unavailable.',
          requestId: c.get('requestId'),
        },
        503,
      );
    }
    const objectKey = c.req.query('key') ?? '';
    if (!objectKey.startsWith('media/') || objectKey.includes('..')) {
      return c.json(
        {
          code: 'invalid_key',
          message: 'Media objectKey must start with media/.',
          requestId: c.get('requestId'),
        },
        400,
      );
    }
    const buf = Buffer.from(await c.req.arrayBuffer());
    if (buf.length === 0) {
      return c.json(
        { code: 'empty_body', message: 'Empty media body.', requestId: c.get('requestId') },
        400,
      );
    }
    const contentType = c.req.header('content-type') || contentTypeFromKey(objectKey);
    await putObjectBuffer({
      client: s3Client,
      bucket: env.S3_MEDIA_BUCKET,
      objectKey,
      body: buf,
      contentType,
      cacheControl: 'public, max-age=86400',
    });
    return c.json(
      { ok: true, objectKey, mediaUrl: `/v1/media/${objectKey}`, byteLength: buf.length },
      201,
    );
  });

  return router;
}

export function registerAdminRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
  s3Client?: S3Client,
): void {
  const adminRouter = createAdminRoutes(env, db, s3Client);
  app.route('/v1/admin', adminRouter);
}

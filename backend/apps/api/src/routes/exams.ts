import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import type { AppEnv } from '@mockza/config';
import {
  CatalogTrackSchema,
  ExamBundleResponseSchema,
  MicroDrillsResponseSchema,
  VocabDeckResponseSchema,
} from '@mockza/contracts';
import {
  catalogPacks,
  examQuestions,
  examSections,
  type MockzaDb,
  microDrills,
  vocabDeckCards,
} from '@mockza/db';
import { extractQuestionMaxWords, normalizeQuestionType } from '@mockza/domain';
import { and, asc, count, eq, inArray } from 'drizzle-orm';
import type { RequestVariables } from '../middleware/request-id.js';

const LEGACY_PACK_ID_ALIASES: Record<string, string> = {
  'pte-ac-writ-01': 'pte-writing-pack-01',
  'det-writ-01': 'det-writing-pack-01',
};

export function registerContentRoutes(
  app: OpenAPIHono<{ Variables: RequestVariables }>,
  env: AppEnv,
  db?: MockzaDb,
): void {
  const edition = env.EDITION === 'irn' ? 'irn' : 'glb';

  const getExamByIdRoute = createRoute({
    method: 'get',
    path: '/v1/exams/{packId}',
    tags: ['Content'],
    request: {
      params: z.object({ packId: z.string().min(1) }),
    },
    responses: {
      200: {
        description:
          'Full exam sections, passages/scripts, media URLs, and questions from PostgreSQL.',
        content: { 'application/json': { schema: ExamBundleResponseSchema } },
      },
      404: {
        description: 'Exam pack not found.',
        content: {
          'application/json': {
            schema: z.object({ code: z.string(), message: z.string(), requestId: z.string() }),
          },
        },
      },
    },
  });

  app.openapi(getExamByIdRoute, async (c) => {
    const rawPackId = c.req.valid('param').packId;
    const packId = LEGACY_PACK_ID_ALIASES[rawPackId] ?? rawPackId;
    if (!db) {
      return c.json(
        {
          code: 'not_found',
          message: `Exam ${rawPackId} unavailable (database not connected).`,
          requestId: c.get('requestId'),
        },
        404,
      );
    }

    const [packRow] = await db
      .select()
      .from(catalogPacks)
      .where(
        and(
          eq(catalogPacks.packId, packId),
          eq(catalogPacks.isPublished, true),
          inArray(catalogPacks.edition, [edition, 'all']),
        ),
      )
      .limit(1);

    if (!packRow) {
      return c.json(
        {
          code: 'not_found',
          message: `Exam pack ${packId} was not found.`,
          requestId: c.get('requestId'),
        },
        404,
      );
    }

    const sections = await db
      .select()
      .from(examSections)
      .where(eq(examSections.packId, packId))
      .orderBy(asc(examSections.sectionIndex));

    const questions = await db
      .select()
      .from(examQuestions)
      .where(eq(examQuestions.packId, packId))
      .orderBy(asc(examQuestions.questionNumber));

    c.header('Cache-Control', 'public, max-age=120');

    return c.json(
      {
        pack: {
          packId: packRow.packId,
          edition: edition as 'glb' | 'irn',
          examId: packRow.examId,
          skill: packRow.skill,
          track: CatalogTrackSchema.catch('academic').parse(packRow.track),
          title: packRow.title,
          description: packRow.description,
          durationSeconds: packRow.durationSeconds,
          questionCount: packRow.questionCount,
          accent: packRow.accent ?? null,
          mediaUrl: packRow.mediaObjectKey ? `/v1/media/${packRow.mediaObjectKey}` : null,
          version: packRow.version,
          sha256: packRow.sha256,
          byteLength: packRow.byteLength,
          downloadUrl: `/v1/exams/${packRow.packId}`,
          contentOrigin: (packRow.contentOrigin === 'cc_by_sa_adapted' ||
          packRow.contentOrigin === 'open_corpus'
            ? packRow.contentOrigin
            : 'authored_original') as 'authored_original' | 'cc_by_sa_adapted' | 'open_corpus',
          humanQaReviewed: packRow.humanQaReviewed,
          isFreeSample: packRow.isFreeSample,
          topicKeys: packRow.topicKeysJson,
          weaknessTargets: packRow.weaknessTargetsJson,
          cefrMin: packRow.cefrMin,
          cefrMax: packRow.cefrMax,
          roadmapOrder: packRow.roadmapOrder,
        },
        sections: sections.map((s) => ({
          sectionId: s.sectionId,
          sectionIndex: s.sectionIndex,
          sectionType: s.sectionType,
          title: s.title,
          instructions: s.instructions,
          contentText: s.contentText,
          paragraphs: s.paragraphsJson ?? null,
          transcript: s.transcriptJson ?? null,
          mediaUrl: s.mediaObjectKey ? `/v1/media/${s.mediaObjectKey}` : null,
          durationSeconds: s.durationSeconds,
          wordCount: s.wordCount,
          metadata: s.metadataJson ?? null,
        })),
        questions: questions.map((q) => ({
          questionId: q.questionId,
          sectionId: q.sectionId,
          questionNumber: q.questionNumber,
          questionType: normalizeQuestionType(q.questionType),
          prompt: q.prompt,
          options: q.optionsJson ?? null,
          acceptedAnswers: q.acceptedAnswersJson,
          maxWords: extractQuestionMaxWords({
            questionType: q.questionType,
            evidence: q.evidenceJson ?? null,
            prompt: q.prompt,
            acceptedAnswers: q.acceptedAnswersJson,
          }),
          evidence: q.evidenceJson ?? null,
          cueTimestampMs: q.cueTimestampMs ?? null,
        })),
      },
      200,
    );
  });

  const getDrillsRoute = createRoute({
    method: 'get',
    path: '/v1/drills',
    tags: ['Content'],
    request: {
      query: z.object({
        skill: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'Published micro-drills from PostgreSQL.',
        content: { 'application/json': { schema: MicroDrillsResponseSchema } },
      },
    },
  });

  app.openapi(getDrillsRoute, async (c) => {
    const { skill } = c.req.valid('query');
    if (!db) {
      return c.json({ drills: [] }, 200);
    }

    const conditions = [
      eq(microDrills.isPublished, true),
      inArray(microDrills.edition, [edition, 'all']),
    ];
    if (skill) {
      conditions.push(eq(microDrills.skill, skill));
    }

    const rows = await db
      .select()
      .from(microDrills)
      .where(and(...conditions))
      .orderBy(asc(microDrills.drillId));

    c.header('Cache-Control', 'public, max-age=120');
    return c.json(
      {
        drills: rows.map((d) => ({
          drillId: d.drillId,
          title: d.title,
          drillType: d.drillType,
          skill: d.skill,
          durationSeconds: d.durationSeconds,
          items: d.itemsJson,
          topicKeys: d.topicKeysJson,
          weaknessTargets: d.weaknessTargetsJson,
          cefrMin: d.cefrMin,
          cefrMax: d.cefrMax,
        })),
      },
      200,
    );
  });

  const getVocabDeckRoute = createRoute({
    method: 'get',
    path: '/v1/vocab/deck',
    tags: ['Content'],
    request: {
      query: z.object({
        topic: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(1000).default(500),
        offset: z.coerce.number().int().min(0).default(0),
      }),
    },
    responses: {
      200: {
        description: 'Vocabulary deck cards stored in PostgreSQL.',
        content: { 'application/json': { schema: VocabDeckResponseSchema } },
      },
    },
  });

  app.openapi(getVocabDeckRoute, async (c) => {
    const { topic, limit, offset } = c.req.valid('query');
    if (!db) {
      return c.json({ totalCount: 0, cards: [] }, 200);
    }

    const conditions = [eq(vocabDeckCards.isPublished, true)];
    if (topic && topic !== 'all') {
      conditions.push(eq(vocabDeckCards.topicTag, topic));
    }

    const [totalRow] = await db
      .select({ total: count() })
      .from(vocabDeckCards)
      .where(and(...conditions));

    const rows = await db
      .select()
      .from(vocabDeckCards)
      .where(and(...conditions))
      .orderBy(asc(vocabDeckCards.cardId))
      .limit(limit)
      .offset(offset);

    c.header('Cache-Control', 'public, max-age=120');
    return c.json(
      {
        totalCount: totalRow?.total ?? rows.length,
        cards: rows.map((card) => ({
          cardId: card.cardId,
          headword: card.headword,
          ipa: card.ipa,
          definition: card.definition,
          topicTag: card.topicTag,
          contextSentence: card.contextSentence,
          paraphrases: card.paraphrasesJson,
          collocations: card.collocationsJson,
          easeFactorMilli: card.easeFactorMilli,
          canonicalTopic: card.canonicalTopic,
          cefrLevel: card.cefrLevel,
          baseWaveOrder: card.baseWaveOrder,
        })),
      },
      200,
    );
  });
}

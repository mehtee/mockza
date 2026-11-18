import { loadEnv } from '@mockza/config';
import { extractQuestionMaxWords, normalizeQuestionType } from '@mockza/domain';
import { computeBundleContentDigest } from '@mockza/domain/node';
import { count, sql } from 'drizzle-orm';
import { createDbClient, type MockzaDb } from './client.js';
import {
  catalogPacks,
  examQuestions,
  examSections,
  microDrills,
  vocabDeckCards,
} from './schema.js';
import { STARTER_MICRO_DRILLS } from './seed-data/starter-drills.js';
import { STARTER_EXAM_BUNDLES } from './seed-data/starter-exams.js';
import { STARTER_VOCAB_CARDS } from './seed-data/starter-vocab.js';

export interface SeedResult {
  packsUpserted: number;
  sectionsUpserted: number;
  questionsUpserted: number;
  drillsUpserted: number;
  vocabUpserted: number;
  skippedReason?: string;
}

/**
 * Idempotently seeds or updates starter exam packs, sections, questions,
 * micro-drills, and IELTS academic vocabulary cards into PostgreSQL.
 */
export async function seedDatabase(
  db: MockzaDb,
  options: { onlyIfEmpty?: boolean } = {},
): Promise<SeedResult> {
  if (options.onlyIfEmpty) {
    const [packCount] = await db.select({ total: count() }).from(examSections);
    const [drillCount] = await db.select({ total: count() }).from(microDrills);
    const [vocabCount] = await db.select({ total: count() }).from(vocabDeckCards);
    if (
      (packCount?.total ?? 0) > 0 &&
      (drillCount?.total ?? 0) > 0 &&
      (vocabCount?.total ?? 0) > 0
    ) {
      return {
        packsUpserted: 0,
        sectionsUpserted: 0,
        questionsUpserted: 0,
        drillsUpserted: 0,
        vocabUpserted: 0,
        skippedReason: 'already_populated',
      };
    }
  }

  let sectionsUpserted = 0;
  let questionsUpserted = 0;
  const now = new Date();

  await db.transaction(async (tx) => {
    for (const bundle of STARTER_EXAM_BUNDLES) {
      const p = bundle.pack;
      const normalizedQuestions = bundle.questions.map((q) => ({
        ...q,
        questionType: normalizeQuestionType(q.questionType),
      }));
      const sortedSections = [...bundle.sections].sort((a, b) => a.sectionIndex - b.sectionIndex);
      const sortedQuestions = [...normalizedQuestions].sort(
        (a, b) => a.questionNumber - b.questionNumber,
      );
      const digest = computeBundleContentDigest({
        sections: sortedSections.map((s) => ({
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
        questions: sortedQuestions.map((q) => ({
          questionId: q.questionId,
          sectionId: q.sectionId,
          questionNumber: q.questionNumber,
          questionType: q.questionType,
          prompt: q.prompt,
          options: q.optionsJson ?? null,
          acceptedAnswers: q.acceptedAnswersJson,
          maxWords: extractQuestionMaxWords({
            evidence: q.evidenceJson ?? null,
            prompt: q.prompt,
            acceptedAnswers: q.acceptedAnswersJson,
          }),
          evidence: q.evidenceJson ?? null,
          cueTimestampMs: q.cueTimestampMs ?? null,
        })),
      });

      await tx
        .insert(catalogPacks)
        .values({
          ...p,
          sha256: digest.sha256,
          byteLength: digest.byteLength,
          publishedAt: p.isPublished ? now : null,
        })
        .onConflictDoUpdate({
          target: catalogPacks.packId,
          set: {
            edition: p.edition,
            examId: p.examId,
            skill: p.skill,
            track: p.track,
            title: p.title,
            description: p.description,
            durationSeconds: p.durationSeconds,
            questionCount: p.questionCount,
            accent: p.accent,
            mediaObjectKey: p.mediaObjectKey,
            version: p.version,
            sha256: digest.sha256,
            byteLength: digest.byteLength,
            cdnRelativePath: p.cdnRelativePath,
            contentOrigin: p.contentOrigin,
            humanQaReviewed: p.humanQaReviewed,
            isFreeSample: p.isFreeSample,
            isPublished: p.isPublished,
            publishedAt: p.isPublished ? now : null,
          },
        });

      if (bundle.sections.length > 0) {
        await tx
          .insert(examSections)
          .values(bundle.sections)
          .onConflictDoUpdate({
            target: examSections.sectionId,
            set: {
              sectionIndex: sql`excluded.section_index`,
              sectionType: sql`excluded.section_type`,
              title: sql`excluded.title`,
              instructions: sql`excluded.instructions`,
              contentText: sql`excluded.content_text`,
              paragraphsJson: sql`excluded.paragraphs_json`,
              transcriptJson: sql`excluded.transcript_json`,
              mediaObjectKey: sql`excluded.media_object_key`,
              durationSeconds: sql`excluded.duration_seconds`,
              wordCount: sql`excluded.word_count`,
              metadataJson: sql`excluded.metadata_json`,
            },
          });
        sectionsUpserted += bundle.sections.length;
      }

      if (normalizedQuestions.length > 0) {
        await tx
          .insert(examQuestions)
          .values(normalizedQuestions)
          .onConflictDoUpdate({
            target: examQuestions.questionId,
            set: {
              sectionId: sql`excluded.section_id`,
              questionNumber: sql`excluded.question_number`,
              questionType: sql`excluded.question_type`,
              prompt: sql`excluded.prompt`,
              optionsJson: sql`excluded.options_json`,
              acceptedAnswersJson: sql`excluded.accepted_answers_json`,
              evidenceJson: sql`excluded.evidence_json`,
              cueTimestampMs: sql`excluded.cue_timestamp_ms`,
            },
          });
        questionsUpserted += normalizedQuestions.length;
      }
    }

    if (STARTER_MICRO_DRILLS.length > 0) {
      await tx
        .insert(microDrills)
        .values(STARTER_MICRO_DRILLS)
        .onConflictDoUpdate({
          target: microDrills.drillId,
          set: {
            edition: sql`excluded.edition`,
            title: sql`excluded.title`,
            drillType: sql`excluded.drill_type`,
            skill: sql`excluded.skill`,
            durationSeconds: sql`excluded.duration_seconds`,
            itemsJson: sql`excluded.items_json`,
            isPublished: sql`excluded.is_published`,
          },
        });
    }

    const vocabBatchSize = 100;
    for (let i = 0; i < STARTER_VOCAB_CARDS.length; i += vocabBatchSize) {
      const batch = STARTER_VOCAB_CARDS.slice(i, i + vocabBatchSize).map((c) => ({
        ...c,
        isPublished: true,
      }));
      await tx
        .insert(vocabDeckCards)
        .values(batch)
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
    }
  });

  return {
    packsUpserted: STARTER_EXAM_BUNDLES.length,
    sectionsUpserted,
    questionsUpserted,
    drillsUpserted: STARTER_MICRO_DRILLS.length,
    vocabUpserted: STARTER_VOCAB_CARDS.length,
  };
}

async function runCli(): Promise<void> {
  const env = loadEnv();
  const { db, sql: client } = createDbClient(env.DATABASE_URL, { max: 1, prepare: false });
  try {
    const result = await seedDatabase(db);
    process.stdout.write(`mockza-db seeded: ${JSON.stringify(result)}\n`);
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runCli();
}

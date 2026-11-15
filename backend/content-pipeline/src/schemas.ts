import { z } from 'zod';

export const ContentOriginSchema = z.enum([
  'authored_original',
  'public_domain_adapted',
  'licensed_partner',
]);

export const EvidenceSpanSchema = z.object({
  paragraphIndex: z.number().int().nonnegative(),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  exactQuote: z.string().min(1),
});

export const ReadingQuestionTypeSchema = z.enum([
  'TFNG', // True / False / Not Given
  'YNNG', // Yes / No / Not Given
  'MCQ', // Multiple Choice Single / Multi
  'MatchingHeadings',
  'MatchingInformation',
  'SummaryGapFill',
  'SentenceCompletion',
]);

export const ReadingQuestionSchema = z.object({
  questionId: z.string().min(1),
  questionType: ReadingQuestionTypeSchema,
  prompt: z.string().min(1),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  acceptedVariants: z.array(z.string()).default([]),
  maxWords: z.number().int().positive().optional(),
  evidenceSpan: EvidenceSpanSchema.optional(),
  notGivenOmissionReason: z.string().optional(),
});

export const ReadingPassageSchema = z.object({
  passageIndex: z.number().int().min(1).max(3),
  title: z.string().min(1),
  paragraphs: z.array(z.string().min(1)).min(3),
  wordCount: z.number().int().min(400).max(1200),
  questions: z.array(ReadingQuestionSchema).min(10).max(15),
});

export const ReadingPackContentSchema = z.object({
  examId: z.enum(['ielts_academic', 'ielts_general']),
  passages: z.array(ReadingPassageSchema).length(3),
  totalQuestions: z.literal(40),
});

export const ListeningDistractorMarkerSchema = z.object({
  timestampMs: z.number().int().nonnegative(),
  correctionType: z.enum(['self_correction', 'speaker_disagreement', 'distractor_trap']),
  note: z.string().optional(),
});

export const ListeningTurnSchema = z.object({
  speaker: z.string().min(1),
  accent: z.enum(['UK', 'AU', 'US', 'NZ', 'CA']),
  text: z.string().min(1),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
  distractors: z.array(ListeningDistractorMarkerSchema).default([]),
});

export const ListeningSectionSchema = z.object({
  sectionIndex: z.number().int().min(1).max(4),
  audioRef: z.string().min(1), // relative path or CDN key to .m4a
  audioByteLength: z.number().int().positive().optional(),
  audioSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  turns: z.array(ListeningTurnSchema).min(1),
  questions: z
    .array(
      z.object({
        questionId: z.string().min(1),
        prompt: z.string().min(1),
        correctAnswer: z.string().min(1),
        acceptedVariants: z.array(z.string()).default([]),
        maxWords: z.number().int().positive().optional(),
      }),
    )
    .min(10)
    .max(10),
});

export const ListeningPackContentSchema = z.object({
  examId: z.literal('ielts_listening'),
  sections: z.array(ListeningSectionSchema).length(4),
  totalQuestions: z.literal(40),
});

export const WritingPromptSchema = z.object({
  taskId: z.string().min(1),
  taskType: z.enum(['task1Academic', 'task1General', 'task2Essay']),
  title: z.string().min(1),
  promptBody: z.string().min(20),
  diagramSvg: z.string().optional(),
  minWords: z.number().int().positive(),
  recommendedMinutes: z.number().int().positive(),
});

export const SpeakingPromptSchema = z.object({
  sessionId: z.string().min(1),
  part1: z.array(z.object({ questionId: z.string(), promptText: z.string() })).min(3),
  part2CueCard: z.object({
    topic: z.string(),
    bulletPoints: z.array(z.string()).min(3),
    prepSeconds: z.literal(60),
    speakSeconds: z.literal(120),
  }),
  part3: z.array(z.object({ questionId: z.string(), promptText: z.string() })).min(3),
});

export const VocabStarterCardSchema = z.object({
  wordId: z.string().min(1),
  term: z.string().min(1),
  ipa: z.string().optional(),
  definition: z.string().min(5),
  partOfSpeech: z.enum(['noun', 'verb', 'adjective', 'adverb', 'phrase']),
  contextSentence: z.string().min(10),
  paraphraseHints: z.array(z.string()).default([]),
  targetBand: z.number().min(6).max(9),
});

export const CompletePackSchema = z.object({
  packId: z.string().min(3),
  edition: z.enum(['glb', 'irn']).default('glb'),
  examId: z.string().min(1),
  skill: z.enum(['speaking', 'writing', 'reading', 'listening', 'vocabulary', 'fullMock']),
  version: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  provenance: ContentOriginSchema,
  humanQaReviewed: z.literal(true),
  isFreeSample: z.boolean().default(false),
  readingContent: ReadingPackContentSchema.optional(),
  listeningContent: ListeningPackContentSchema.optional(),
  writingContent: z.array(WritingPromptSchema).optional(),
  speakingContent: SpeakingPromptSchema.optional(),
  vocabCards: z.array(VocabStarterCardSchema).optional(),
});

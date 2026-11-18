import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

/** Canonical banned trademark / copyright string patterns shared by all content validators (TD-31). */
export const BANNED_PATTERNS = [
  /\bcambridge\s+(ielts|esol|university\s+press)\b/i,
  /\bcambridge\s+english\b/i,
  /\beducational\s+testing\s+service\b/i,
  /\bets\b/i,
  /\bpearson\s+plc\b/i,
  /\bbritish\s+council\b/i,
  /\bidp\s+education\b/i,
  /\bcc\s+by-nc\b/i,
];

/** Enforces ADR-008 content provenance, SHA-256 checksum, and evidence spans. */
export const ContentPackManifestSchema = z.object({
  packId: z.string().min(3),
  skill: z.enum(['speaking', 'writing', 'reading', 'listening', 'fullMock']),
  version: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  provenance: z.enum(['authored_original', 'public_domain_adapted']),
  reviewedByHuman: z.literal(true),
});

export type ContentPackManifest = z.infer<typeof ContentPackManifestSchema>;

export function validatePackManifest(input: unknown): ContentPackManifest {
  return ContentPackManifestSchema.parse(input);
}

export function computeSha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJsonStringify(v)}`).join(',')}}`;
}

function normalizeCanonicalQuestionType(raw: string): string {
  switch (raw.trim().toLowerCase()) {
    case 'tfng':
    case 'true_false_not_given':
      return 'tfng';
    case 'ynng':
    case 'yes_no_not_given':
      return 'ynng';
    case 'mcq_single':
    case 'mcqsingle':
    case 'mcq':
    case 'multiple_choice':
      return 'mcq_single';
    case 'mcq_multi':
    case 'mcqmulti':
    case 'multiple_choice_multi':
      return 'mcq_multi';
    case 'matching_headings':
    case 'matchingheadings':
    case 'matching':
      return 'matching_headings';
    case 'summary_gap_fill':
    case 'summarygapfill':
    case 'gap_fill':
    case 'form_completion':
    case 'sentence_completion':
      return 'summary_gap_fill';
    case 'binary_choice':
      return 'binary_choice';
    case 'word_completion':
      return 'word_completion';
    case 'reorder_sequence':
      return 'reorder_sequence';
    case 'dictation':
      return 'dictation';
    case 'writing_prompt':
      return 'writing_prompt';
    case 'speaking_part1':
      return 'speaking_part1';
    case 'speaking_part2':
      return 'speaking_part2';
    case 'speaking_part3':
      return 'speaking_part3';
    case 'speaking_part4':
      return 'speaking_part4';
    default:
      return 'short_answer';
  }
}

function extractCanonicalMaxWords(params: {
  questionType?: string;
  evidence?: Record<string, unknown> | null;
  prompt?: string;
  acceptedAnswers?: string[];
}): number | null {
  const explicit = params.evidence?.['maxWords'];
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) {
    return Math.trunc(explicit);
  }
  const promptUpper = (params.prompt ?? '').toUpperCase();
  if (promptUpper.includes('ONE WORD ONLY') || promptUpper.includes('NO MORE THAN ONE WORD')) {
    return 1;
  }
  if (promptUpper.includes('NO MORE THAN TWO WORDS')) {
    return 2;
  }
  if (promptUpper.includes('NO MORE THAN THREE WORDS')) {
    return 3;
  }
  if (Array.isArray(params.acceptedAnswers) && params.acceptedAnswers.length > 0) {
    let maxWords = 0;
    for (const ans of params.acceptedAnswers) {
      const count = ans.trim().split(/\s+/).filter(Boolean).length;
      if (count > maxWords) maxWords = count;
    }
    if (maxWords > 3) {
      return maxWords;
    }
  }
  const normalizedType = params.questionType
    ? normalizeCanonicalQuestionType(params.questionType)
    : null;
  if (normalizedType === 'dictation' || normalizedType === 'reorder_sequence') {
    return 25;
  }
  return null;
}

export function checkCopyrightSafety(text: string): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(pattern.toString());
    }
  }
  return { safe: violations.length === 0, violations };
}

export interface ValidationSummary {
  totalPacksChecked: number;
  seedPacksChecked: number;
  cdnPacksChecked: number;
  allEvidenceVerified: boolean;
  zeroTrademarkViolations: boolean;
  sha256IntegrityOk: boolean;
}

interface ParsedExamBundle {
  pack: {
    packId: string;
    skill: string;
    version: string;
    sha256: string;
    contentOrigin: string;
    humanQaReviewed: boolean;
    mediaObjectKey?: string | null;
  };
  sections: Array<{
    sectionId: string;
    sectionIndex: number;
    sectionType: string;
    title: string;
    instructions: string;
    contentText: string;
    paragraphsJson?: Record<string, string> | null;
    transcriptJson?: unknown[] | null;
    mediaObjectKey?: string | null;
    durationSeconds: number;
    wordCount: number;
    metadataJson?: Record<string, unknown> | null;
  }>;
  questions: Array<{
    questionId: string;
    sectionId: string;
    questionNumber: number;
    questionType: string;
    prompt: string;
    optionsJson?: string[] | null;
    acceptedAnswersJson: string[];
    evidenceJson?: Record<string, unknown> | null;
    cueTimestampMs?: number | null;
  }>;
}

const VALID_SEED_QUESTION_TYPES = new Set([
  'tfng',
  'true_false_not_given',
  'ynng',
  'yes_no_not_given',
  'mcq_single',
  'mcq_multi',
  'multiple_choice',
  'matching_headings',
  'summary_gap_fill',
  'gap_fill',
  'form_completion',
  'short_answer',
  'binary_choice',
  'word_completion',
  'reorder_sequence',
  'dictation',
  'writing_prompt',
  'speaking_part1',
  'speaking_part2',
  'speaking_part3',
  'speaking_part4',
]);

async function loadStarterBundles(currentFile: string): Promise<ParsedExamBundle[]> {
  const currentDir = dirname(currentFile);
  const candidates = currentFile.endsWith('.ts')
    ? [
        resolve(currentDir, '../../packages/db/src/seed-data/starter-exams.ts'),
        resolve(currentDir, '../../packages/db/dist/seed-data/starter-exams.js'),
      ]
    : [
        resolve(currentDir, '../../packages/db/dist/seed-data/starter-exams.js'),
        resolve(currentDir, '../../packages/db/src/seed-data/starter-exams.ts'),
      ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const mod = (await import(pathToFileURL(candidate).href)) as {
        STARTER_EXAM_BUNDLES?: ParsedExamBundle[];
      };
      if (Array.isArray(mod.STARTER_EXAM_BUNDLES)) {
        return mod.STARTER_EXAM_BUNDLES;
      }
    }
  }
  throw new Error(`Missing Postgres seed data module in: ${candidates.join(', ')}`);
}

function normalizeWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export async function validateAllPacks(): Promise<ValidationSummary> {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = dirname(currentFile);
  const seedDataDir = resolve(currentDir, '../../packages/db/src/seed-data');
  const distSeedDataDir = resolve(currentDir, '../../packages/db/dist/seed-data');
  const drillsPath = existsSync(resolve(seedDataDir, 'starter-drills.ts'))
    ? resolve(seedDataDir, 'starter-drills.ts')
    : resolve(distSeedDataDir, 'starter-drills.js');
  const vocabPath = existsSync(resolve(seedDataDir, 'starter-vocab.ts'))
    ? resolve(seedDataDir, 'starter-vocab.ts')
    : resolve(distSeedDataDir, 'starter-vocab.js');

  let totalPacksChecked = 0;
  let allEvidenceOk = true;
  let zeroViolations = true;
  let sha256Ok = true;

  const bundles = await loadStarterBundles(currentFile);
  for (const bundle of bundles) {
    totalPacksChecked += 1;
    const rawStr = JSON.stringify(bundle);
    const safety = checkCopyrightSafety(rawStr);
    if (!safety.safe) {
      process.stderr.write(
        `FAIL: Trademark violation in exam ${bundle.pack.packId}: ${safety.violations.join(', ')}\n`,
      );
      zeroViolations = false;
    }

    if (!/^[a-f0-9]{64}$/.test(bundle.pack.sha256)) {
      process.stderr.write(`FAIL: Invalid SHA-256 format in exam ${bundle.pack.packId}\n`);
      sha256Ok = false;
    }

    const sortedSections = [...bundle.sections].sort((a, b) => a.sectionIndex - b.sectionIndex);
    const sortedQuestions = [...bundle.questions]
      .map((q) => ({ ...q, questionType: normalizeCanonicalQuestionType(q.questionType) }))
      .sort((a, b) => a.questionNumber - b.questionNumber);
    const canonicalPayload = stableJsonStringify({
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
        maxWords: extractCanonicalMaxWords({
          questionType: q.questionType,
          evidence: q.evidenceJson ?? null,
          prompt: q.prompt,
          acceptedAnswers: q.acceptedAnswersJson,
        }),
        evidence: q.evidenceJson ?? null,
        cueTimestampMs: q.cueTimestampMs ?? null,
      })),
    });
    const computedDigest = computeSha256(canonicalPayload);
    if (bundle.pack.sha256 !== computedDigest) {
      process.stderr.write(
        `FAIL: SHA-256 mismatch in exam ${bundle.pack.packId} (declared=${bundle.pack.sha256}, computed=${computedDigest})\n`,
      );
      sha256Ok = false;
    }

    const seenSectionIds = new Set<string>();
    for (const s of bundle.sections) {
      if (seenSectionIds.has(s.sectionId)) {
        process.stderr.write(
          `FAIL: Duplicate sectionId ${s.sectionId} in exam ${bundle.pack.packId}\n`,
        );
        allEvidenceOk = false;
      }
      seenSectionIds.add(s.sectionId);
    }

    const seenQuestionIds = new Set<string>();
    for (const q of bundle.questions) {
      if (seenQuestionIds.has(q.questionId)) {
        process.stderr.write(
          `FAIL: Duplicate questionId ${q.questionId} in exam ${bundle.pack.packId}\n`,
        );
        allEvidenceOk = false;
      }
      seenQuestionIds.add(q.questionId);
      if (!VALID_SEED_QUESTION_TYPES.has(q.questionType.trim().toLowerCase())) {
        process.stderr.write(
          `FAIL: Unknown questionType "${q.questionType}" in ${bundle.pack.packId} / ${q.questionId}\n`,
        );
        allEvidenceOk = false;
      }
      if (!seenSectionIds.has(q.sectionId)) {
        process.stderr.write(
          `FAIL: Question ${q.questionId} references missing sectionId ${q.sectionId}\n`,
        );
        allEvidenceOk = false;
      }
    }

    if (!bundle.pack.humanQaReviewed) {
      allEvidenceOk = false;
    }

    if (bundle.pack.skill === 'reading') {
      const fullPassage = normalizeWs(bundle.sections.map((s) => s.contentText).join('\n'));
      for (const q of bundle.questions) {
        const quote = q.evidenceJson?.['exactQuote'];
        if (typeof quote === 'string' && quote.length > 0) {
          if (!fullPassage.includes(normalizeWs(quote))) {
            process.stderr.write(
              `FAIL: Reading evidence quote missing in ${bundle.pack.packId} / ${q.questionId}\n`,
            );
            allEvidenceOk = false;
          }
        }
      }
    }
  }

  for (const extraPath of [drillsPath, vocabPath]) {
    if (existsSync(extraPath)) {
      const safety = checkCopyrightSafety(readFileSync(extraPath, 'utf-8'));
      if (!safety.safe) {
        zeroViolations = false;
      }
    }
  }

  process.stdout.write(
    `Validated ${totalPacksChecked} Postgres seed exam bundles (evidence=${allEvidenceOk}, copyright=${zeroViolations}, sha256=${sha256Ok}).\n`,
  );

  return {
    totalPacksChecked,
    seedPacksChecked: totalPacksChecked,
    cdnPacksChecked: 0,
    allEvidenceVerified: allEvidenceOk,
    zeroTrademarkViolations: zeroViolations,
    sha256IntegrityOk: sha256Ok,
  };
}

const invokedPath = process.argv[1];
if (invokedPath && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  validateAllPacks()
    .then((summary) => {
      if (
        !summary.allEvidenceVerified ||
        !summary.zeroTrademarkViolations ||
        !summary.sha256IntegrityOk
      ) {
        process.exit(1);
      }
    })
    .catch((err: unknown) => {
      process.stderr.write(`${String(err)}\n`);
      process.exit(1);
    });
}

import { createHash } from 'node:crypto';

export const BANNED_CONTENT_PATTERNS: RegExp[] = [
  /\bcambridge\s+(ielts|esol|university\s+press)\b/i,
  /\bets\b/i,
  /\bpearson\s+plc\b/i,
  /\bbritish\s+council\b/i,
  /\bidp\s+education\b/i,
];

export function computeContentSha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function checkCleanRoomSafety(text: string): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const pattern of BANNED_CONTENT_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(pattern.source);
    }
  }
  return { safe: violations.length === 0, violations };
}

export type CanonicalQuestionType =
  | 'tfng'
  | 'ynng'
  | 'mcq_single'
  | 'mcq_multi'
  | 'matching_headings'
  | 'summary_gap_fill'
  | 'short_answer'
  | 'binary_choice'
  | 'word_completion'
  | 'reorder_sequence'
  | 'dictation'
  | 'writing_prompt'
  | 'speaking_part1'
  | 'speaking_part2'
  | 'speaking_part3'
  | 'speaking_part4';

/**
 * Normalizes backend/seed/admin question-type strings into the canonical vocabulary
 * consumed by clients and content validators (`TD-27`).
 */
export function normalizeQuestionType(raw: string): CanonicalQuestionType {
  const normalized = raw.trim().toLowerCase();
  switch (normalized) {
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

/** Extracts or infers an IELTS/exam word-count limit from question metadata/prompt/answers (`TD-28`). */
export function extractQuestionMaxWords(params: {
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
  const normalizedType = params.questionType ? normalizeQuestionType(params.questionType) : null;
  if (normalizedType === 'dictation' || normalizedType === 'reorder_sequence') {
    return 25;
  }
  return null;
}

/** Deterministic recursive canonical JSON serialization for content SHA-256 checks (`TD-31`/`TD-32`). */
export function stableJsonStringify(value: unknown): string {
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

/** Computes canonical SHA-256 and UTF-8 byteLength over normalized sections + questions. */
export function computeBundleContentDigest(payload: {
  sections: unknown[];
  questions: unknown[];
}): { sha256: string; byteLength: number } {
  const canonical = stableJsonStringify({
    sections: payload.sections,
    questions: payload.questions,
  });
  return {
    sha256: computeContentSha256(canonical),
    byteLength: Buffer.byteLength(canonical, 'utf8'),
  };
}

export interface BundleIntegritySectionInput {
  sectionId: string;
  sectionIndex: number;
  sectionType: string;
  title: string;
  instructions: string;
  contentText: string;
  paragraphs?: Record<string, string> | null;
  transcript?: unknown[] | null;
  mediaObjectKey?: string | null;
  durationSeconds: number;
  wordCount: number;
  metadata?: Record<string, unknown> | null;
}

export interface BundleIntegrityQuestionInput {
  questionId: string;
  sectionId: string;
  questionNumber: number;
  questionType: string;
  prompt: string;
  options?: string[] | null;
  acceptedAnswers: string[];
  maxWords?: number | null;
  evidence?: Record<string, unknown> | null;
  cueTimestampMs?: number | null;
}

function normalizeWs(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Shared ADR-008 integrity validator used at admin upsert and publish gates (`RR-14`).
 */
export function validateExamBundleIntegrity(params: {
  packId: string;
  skill: string;
  humanQaReviewed: boolean;
  declaredSha256?: string | null;
  rawTextForSafetyCheck?: string;
  sections: BundleIntegritySectionInput[];
  questions: BundleIntegrityQuestionInput[];
}): { valid: boolean; errors: string[]; computedDigest: { sha256: string; byteLength: number } } {
  const errors: string[] = [];

  if (!params.humanQaReviewed) {
    errors.push(`Pack ${params.packId} is missing humanQaReviewed=true.`);
  }
  if (params.sections.length === 0) {
    errors.push(`Pack ${params.packId} has no exam sections.`);
  }
  if (params.questions.length === 0) {
    errors.push(`Pack ${params.packId} has no exam questions.`);
  }

  const safetyPayload =
    params.rawTextForSafetyCheck ??
    JSON.stringify({
      packId: params.packId,
      sections: params.sections,
      questions: params.questions,
    });
  const safety = checkCleanRoomSafety(safetyPayload);
  if (!safety.safe) {
    errors.push(`Copyright policy violation: ${safety.violations.join(', ')}`);
  }

  const seenSectionIds = new Set<string>();
  for (const s of params.sections) {
    if (seenSectionIds.has(s.sectionId)) {
      errors.push(`Duplicate sectionId ${s.sectionId} in ${params.packId}.`);
    }
    seenSectionIds.add(s.sectionId);
  }

  const seenQuestionIds = new Set<string>();
  for (const q of params.questions) {
    if (seenQuestionIds.has(q.questionId)) {
      errors.push(`Duplicate questionId ${q.questionId} in ${params.packId}.`);
    }
    seenQuestionIds.add(q.questionId);
    if (!seenSectionIds.has(q.sectionId)) {
      errors.push(`Question ${q.questionId} references unknown sectionId ${q.sectionId}.`);
    }
  }

  if (params.skill === 'reading') {
    const fullPassage = normalizeWs(params.sections.map((s) => s.contentText).join('\n'));
    for (const q of params.questions) {
      const quote = q.evidence?.['exactQuote'];
      if (typeof quote === 'string' && quote.trim().length > 0) {
        if (!fullPassage.includes(normalizeWs(quote))) {
          errors.push(`Reading evidence exactQuote missing in passage for ${q.questionId}.`);
        }
      }
    }
  }

  const sortedSections = [...params.sections].sort((a, b) => a.sectionIndex - b.sectionIndex);
  const sortedQuestions = [...params.questions]
    .map((q) => ({
      ...q,
      questionType: normalizeQuestionType(q.questionType),
    }))
    .sort((a, b) => a.questionNumber - b.questionNumber);

  const computedDigest = computeBundleContentDigest({
    sections: sortedSections.map((s) => ({
      sectionId: s.sectionId,
      sectionIndex: s.sectionIndex,
      sectionType: s.sectionType,
      title: s.title,
      instructions: s.instructions,
      contentText: s.contentText,
      paragraphs: s.paragraphs ?? null,
      transcript: s.transcript ?? null,
      mediaUrl: s.mediaObjectKey ? `/v1/media/${s.mediaObjectKey}` : null,
      durationSeconds: s.durationSeconds,
      wordCount: s.wordCount,
      metadata: s.metadata ?? null,
    })),
    questions: sortedQuestions.map((q) => ({
      questionId: q.questionId,
      sectionId: q.sectionId,
      questionNumber: q.questionNumber,
      questionType: q.questionType,
      prompt: q.prompt,
      options: q.options ?? null,
      acceptedAnswers: q.acceptedAnswers,
      maxWords:
        q.maxWords ??
        extractQuestionMaxWords({
          evidence: q.evidence ?? null,
          prompt: q.prompt,
          acceptedAnswers: q.acceptedAnswers,
        }),
      evidence: q.evidence ?? null,
      cueTimestampMs: q.cueTimestampMs ?? null,
    })),
  });

  if (params.declaredSha256 != null && params.declaredSha256 !== computedDigest.sha256) {
    errors.push(
      `SHA-256 mismatch for ${params.packId}: declared=${params.declaredSha256} computed=${computedDigest.sha256}.`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    computedDigest,
  };
}

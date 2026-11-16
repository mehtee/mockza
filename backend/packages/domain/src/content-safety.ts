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
  | 'writing_prompt'
  | 'speaking_part1'
  | 'speaking_part2'
  | 'speaking_part3';

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
    case 'writing_prompt':
      return 'writing_prompt';
    case 'speaking_part1':
      return 'speaking_part1';
    case 'speaking_part2':
      return 'speaking_part2';
    case 'speaking_part3':
      return 'speaking_part3';
    default:
      return 'short_answer';
  }
}

/** Extracts or infers an IELTS word-count limit from question metadata/prompt/answers (`TD-28`). */
export function extractQuestionMaxWords(params: {
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

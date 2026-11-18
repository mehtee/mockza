import type { SupportedExamId } from '../rubrics.js';
import { getExamDescriptor, scoreObjectiveForTrack } from './exam-descriptor.js';
import {
  type ExamModuleType,
  normalizeObjectiveQuestionType,
  type ObjectiveQuestionType,
  type SkillKind,
} from './exam-spec.js';

/** Common UK to US spelling normalization map (31 pairs) for objective answers. */
export const UK_TO_US_SPELLINGS: Readonly<Record<string, string>> = {
  colour: 'color',
  colours: 'colors',
  flavour: 'flavor',
  flavours: 'flavors',
  humour: 'humor',
  neighbour: 'neighbor',
  neighbours: 'neighbors',
  organisation: 'organization',
  organisations: 'organizations',
  organise: 'organize',
  organised: 'organized',
  recognise: 'recognize',
  recognised: 'recognized',
  centre: 'center',
  centres: 'centers',
  theatre: 'theater',
  theatres: 'theaters',
  metre: 'meter',
  metres: 'meters',
  litre: 'liter',
  litres: 'liters',
  travelling: 'traveling',
  travelled: 'traveled',
  cancelling: 'canceling',
  cancelled: 'canceled',
  favourite: 'favorite',
  defence: 'defense',
  licence: 'license',
  programme: 'program',
  programmes: 'programs',
  grey: 'gray',
};

/** Common small English numeral words mapped to numeric digits (11 pairs: zero..ten). */
export const WORD_TO_DIGITS: Readonly<Record<string, string>> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
};

export interface ObjectiveQuestionAnswer {
  readonly questionId: string;
  readonly acceptedAnswers: readonly string[];
  readonly userAnswer: string | null | undefined;
  readonly maxWords?: number;
  readonly questionType?: ObjectiveQuestionType | string;
}

export interface ObjectiveScoreReport {
  readonly correctCount: number;
  readonly totalCount: number;
  readonly bandScore: number;
  readonly questionCorrectness: Record<string, boolean>;
  readonly isCalibratedFullPack: boolean;
  readonly accuracyPercent: number;
}

/**
 * Normalizes whitespace, hyphens, apostrophes, UK/US spellings, and small numerals
 * while preserving decimals, currency symbols, percent signs, and time colons (`TD-33`).
 */
export function normalizeObjectiveAnswer(raw: string): string {
  let text = raw.trim().toLowerCase();
  text = text.replace(/['’`]/g, "'");
  text = text.replace(/[-—–]/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length === 0) return '';

  const tokens = text
    .split(' ')
    .map((token) => {
      let cleanToken = token;
      cleanToken = cleanToken.replace(/^[^\w$£€']+/, '');
      cleanToken = cleanToken.replace(/[^\w%]+$/, '');
      cleanToken = cleanToken.replace(/(\d),(\d)/g, '$1$2');
      const usEquivalent = Object.hasOwn(UK_TO_US_SPELLINGS, cleanToken)
        ? UK_TO_US_SPELLINGS[cleanToken]
        : undefined;
      if (usEquivalent !== undefined) return usEquivalent;
      const digitEquivalent = Object.hasOwn(WORD_TO_DIGITS, cleanToken)
        ? WORD_TO_DIGITS[cleanToken]
        : undefined;
      if (digitEquivalent !== undefined) return digitEquivalent;
      return cleanToken;
    })
    .filter((t) => t.length > 0);

  return tokens.join(' ').trim();
}

/** Counts words in an objective answer string. */
export function countObjectiveWords(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Normalizes ordered sequence answers (`A|B|C|D`, `A, B, C, D`, `ABCD`)
 * into a canonical pipe-delimited uppercase token string.
 */
export function normalizeObjectiveSequence(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.length === 0) return '';
  if (/^[A-Z]{2,8}$/.test(trimmed)) {
    return trimmed.split('').join('|');
  }
  const tokens = trimmed
    .split(/[\s|,;]+/)
    .map((t) => t.replace(/[^A-Z0-9]/g, ''))
    .filter((t) => t.length > 0);
  return tokens.join('|');
}

/** Scores objective answers locally and computes the corresponding exam-scaled score. */
export function scoreObjectiveAnswers(params: {
  answers: readonly ObjectiveQuestionAnswer[];
  skill: SkillKind;
  moduleType?: ExamModuleType;
  track?: SupportedExamId;
}): ObjectiveScoreReport {
  let correct = 0;
  const perQuestion: Record<string, boolean> = {};

  for (const item of params.answers) {
    const candidate = item.userAnswer;
    let isMatch = false;

    if (candidate != null && candidate.trim().length > 0) {
      const qType = normalizeObjectiveQuestionType(item.questionType ?? 'short_answer');
      if (qType === 'reorder_sequence') {
        const normalizedSeq = normalizeObjectiveSequence(candidate);
        isMatch = item.acceptedAnswers.some(
          (key) => normalizeObjectiveSequence(key) === normalizedSeq,
        );
      } else {
        const baseMaxWords = item.maxWords ?? 3;
        const effectiveMaxWords =
          qType === 'dictation' || qType === 'binary_choice'
            ? Math.max(baseMaxWords, 25)
            : baseMaxWords;
        const wordCount = countObjectiveWords(candidate);
        if (wordCount <= effectiveMaxWords) {
          const normalizedCandidate = normalizeObjectiveAnswer(candidate);
          isMatch = item.acceptedAnswers.some((key) => {
            if (normalizeObjectiveAnswer(key) === normalizedCandidate) return true;
            if (key.trim().toLowerCase() === candidate.trim().toLowerCase()) return true;
            return false;
          });
        }
      }
    }

    Object.defineProperty(perQuestion, item.questionId, {
      value: isMatch,
      enumerable: true,
      writable: true,
      configurable: true,
    });
    if (isMatch) correct += 1;
  }

  const resolvedTrack: SupportedExamId =
    params.track ?? (params.moduleType === 'general_training' ? 'ielts_general' : 'ielts_academic');
  const descriptor = getExamDescriptor(resolvedTrack);
  const totalCount = params.answers.length;
  const isFullLength = totalCount >= descriptor.minCalibratedObjectiveCount;
  const bandScore = scoreObjectiveForTrack({
    track: resolvedTrack,
    skill: params.skill,
    correctCount: correct,
    totalCount,
    isFullLength,
  });
  const accuracyPercent = totalCount === 0 ? 0 : Math.round((correct / totalCount) * 100);

  return {
    correctCount: correct,
    totalCount,
    bandScore,
    questionCorrectness: perQuestion,
    isCalibratedFullPack: isFullLength,
    accuracyPercent,
  };
}

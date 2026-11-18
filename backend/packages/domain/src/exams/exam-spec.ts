import { normalizeQuestionType } from '../content-safety.js';
import {
  EXAM_SCALES,
  normalizeSupportedExamId,
  quantizeExamScore,
  roundIeltsBand,
  type SupportedExamId,
  type SupportedWritingTaskType,
} from '../rubrics.js';

export {
  computeOverallWritingBand,
  EXAM_SCALES,
  estimateToeflLegacy120,
  normalizeScoreToQualityRatio,
  normalizeSupportedExamId,
  quantizeExamScore,
  roundIeltsBand,
  SUPPORTED_EXAM_IDS,
  SUPPORTED_WRITING_TASK_TYPES,
  type SupportedExamId,
  type SupportedWritingTaskType,
  scoreFromNormalizedQuality,
} from '../rubrics.js';

export const SKILL_KINDS = ['speaking', 'writing', 'reading', 'listening', 'vocabulary'] as const;
export type SkillKind = (typeof SKILL_KINDS)[number];

export const EXAM_MODULE_TYPES = ['academic', 'general_training'] as const;
export type ExamModuleType = (typeof EXAM_MODULE_TYPES)[number];

export const OBJECTIVE_QUESTION_TYPES = [
  'tfng',
  'ynng',
  'mcq_single',
  'mcq_multi',
  'matching_headings',
  'summary_gap_fill',
  'short_answer',
  'binary_choice',
  'word_completion',
  'reorder_sequence',
  'dictation',
] as const;
export type ObjectiveQuestionType = (typeof OBJECTIVE_QUESTION_TYPES)[number];

const OBJECTIVE_QUESTION_TYPE_SET: ReadonlySet<string> = new Set(OBJECTIVE_QUESTION_TYPES);

/** Parses backend/wire questionType string into canonical ObjectiveQuestionType. */
export function normalizeObjectiveQuestionType(raw: string): ObjectiveQuestionType {
  const canonical = normalizeQuestionType(raw);
  if (OBJECTIVE_QUESTION_TYPE_SET.has(canonical)) {
    return canonical as ObjectiveQuestionType;
  }
  return 'short_answer';
}

export interface ExamTrackSpec {
  readonly id: SupportedExamId;
  readonly displayName: string;
  readonly shortName: string;
  readonly scaleLabel: string;
  readonly unitLabel: string;
  readonly catalogTrack: 'academic' | 'general' | 'toefl' | 'pte' | 'det';
  readonly minScore: number;
  readonly maxScore: number;
  readonly scoreStep: number;
  readonly targetScoreDefault: number;
  readonly isIelts: boolean;
  readonly usesIntegerDisplay: boolean;
}

export const EXAM_TRACK_SPECS: Record<SupportedExamId, ExamTrackSpec> = {
  ielts_academic: {
    id: 'ielts_academic',
    displayName: 'IELTS Academic',
    shortName: 'IELTS Academic',
    scaleLabel: 'Estimated Band',
    unitLabel: 'Band',
    catalogTrack: 'academic',
    minScore: EXAM_SCALES.ielts_academic.min,
    maxScore: EXAM_SCALES.ielts_academic.max,
    scoreStep: EXAM_SCALES.ielts_academic.step,
    targetScoreDefault: EXAM_SCALES.ielts_academic.targetDefault,
    isIelts: true,
    usesIntegerDisplay: false,
  },
  ielts_general: {
    id: 'ielts_general',
    displayName: 'IELTS General Training',
    shortName: 'IELTS General',
    scaleLabel: 'Estimated Band',
    unitLabel: 'Band',
    catalogTrack: 'general',
    minScore: EXAM_SCALES.ielts_general.min,
    maxScore: EXAM_SCALES.ielts_general.max,
    scoreStep: EXAM_SCALES.ielts_general.step,
    targetScoreDefault: EXAM_SCALES.ielts_general.targetDefault,
    isIelts: true,
    usesIntegerDisplay: false,
  },
  toefl_ibt: {
    id: 'toefl_ibt',
    displayName: 'TOEFL iBT',
    shortName: 'TOEFL iBT',
    scaleLabel: 'Estimated Band',
    unitLabel: 'Band',
    catalogTrack: 'toefl',
    minScore: EXAM_SCALES.toefl_ibt.min,
    maxScore: EXAM_SCALES.toefl_ibt.max,
    scoreStep: EXAM_SCALES.toefl_ibt.step,
    targetScoreDefault: EXAM_SCALES.toefl_ibt.targetDefault,
    isIelts: false,
    usesIntegerDisplay: false,
  },
  pte_academic: {
    id: 'pte_academic',
    displayName: 'PTE Academic',
    shortName: 'PTE Academic',
    scaleLabel: 'Estimated Score',
    unitLabel: 'Score',
    catalogTrack: 'pte',
    minScore: EXAM_SCALES.pte_academic.min,
    maxScore: EXAM_SCALES.pte_academic.max,
    scoreStep: EXAM_SCALES.pte_academic.step,
    targetScoreDefault: EXAM_SCALES.pte_academic.targetDefault,
    isIelts: false,
    usesIntegerDisplay: true,
  },
  det: {
    id: 'det',
    displayName: 'Duolingo English Test',
    shortName: 'Duolingo (DET)',
    scaleLabel: 'Estimated Score',
    unitLabel: 'Score',
    catalogTrack: 'det',
    minScore: EXAM_SCALES.det.min,
    maxScore: EXAM_SCALES.det.max,
    scoreStep: EXAM_SCALES.det.step,
    targetScoreDefault: EXAM_SCALES.det.targetDefault,
    isIelts: false,
    usesIntegerDisplay: true,
  },
} as const;

function getExamTrackSpec(examId: SupportedExamId): ExamTrackSpec {
  return Object.hasOwn(EXAM_TRACK_SPECS, examId)
    ? EXAM_TRACK_SPECS[examId]
    : EXAM_TRACK_SPECS[normalizeSupportedExamId(examId)];
}

export function isIeltsTrack(examId: SupportedExamId): boolean {
  return getExamTrackSpec(examId).isIelts;
}

/**
 * Resolves the target score when switching from `previous` to `target`.
 * Preserves the learner's target only when both tracks share the IELTS 0-9 band scale;
 * otherwise resets to `targetScoreDefault`.
 */
export function nextTargetWhenSwitchingFrom(params: {
  target: SupportedExamId;
  previous: SupportedExamId;
  previousTarget: number;
}): number {
  const targetSpec = getExamTrackSpec(params.target);
  if (isIeltsTrack(params.previous) && targetSpec.isIelts) {
    return quantizeExamScore(params.previousTarget, params.target);
  }
  return targetSpec.targetScoreDefault;
}

/** Formats score according to the track's decimal granularity. */
export function formatExamScore(score: number, examId: SupportedExamId): string {
  const spec = getExamTrackSpec(examId);
  const normalized = quantizeExamScore(score, examId);
  if (spec.usesIntegerDisplay) {
    const rounded = Math.round(normalized);
    return String(rounded === 0 ? 0 : rounded);
  }
  return normalized.toFixed(1);
}

/** Formats score prefixed with the track's unit (e.g. `Band 5.0`, `Score 68`). */
export function formatExamScoreWithUnit(score: number, examId: SupportedExamId): string {
  const spec = getExamTrackSpec(examId);
  return `${spec.unitLabel} ${formatExamScore(score, examId)}`;
}

/** Resolves effective exam track from an explicit packId prefix when present, else profileExamId. */
export function resolveExamTrackForPackOrProfile(params: {
  packId: string;
  profileExamId: string;
}): SupportedExamId {
  const lower = params.packId.trim().toLowerCase();
  if (lower.startsWith('toefl')) return 'toefl_ibt';
  if (lower.startsWith('pte')) return 'pte_academic';
  if (lower.startsWith('det')) return 'det';
  if (lower.includes('-gt-')) return 'ielts_general';
  if (lower.includes('-acad-')) return 'ielts_academic';
  return normalizeSupportedExamId(params.profileExamId);
}

export const EXAM_SPEC_CONSTANTS = {
  minBand: 0,
  maxBand: 9,
  readingQuestionCount: 40,
  readingDurationSeconds: 60 * 60,
  listeningQuestionCount: 40,
  writingTask1DurationSeconds: 20 * 60,
  writingTask2DurationSeconds: 40 * 60,
  speakingCuePrepSeconds: 60,
  speakingCueTurnSeconds: 120,
} as const;

export { roundIeltsBand as roundIeltsBandMean };

const ROMAN_NUMERALS = [
  'i',
  'ii',
  'iii',
  'iv',
  'v',
  'vi',
  'vii',
  'viii',
  'ix',
  'x',
  'xi',
  'xii',
] as const;

/**
 * Parses an MCQ or Matching Headings option string (e.g. `"ii. Heading"`, `"B. Text"`, or plain text)
 * into its pill label, clean display text, and canonical submitted value (`BF-01`).
 */
export function parseObjectiveChoiceOption(params: {
  questionType: ObjectiveQuestionType;
  rawOption: string;
  index: number;
  acceptedVariants: readonly string[];
}): { label: string; displayText: string; value: string } {
  const trimmed = params.rawOption.trim();

  if (params.questionType === 'matching_headings') {
    const romanMatch = /^(i{1,3}|iv|vi{0,3}|ix|x|xi|xii)[.)]\s+(.+)$/i.exec(trimmed);
    if (romanMatch?.[1] && romanMatch[2]) {
      const roman = romanMatch[1].toLowerCase();
      const body = romanMatch[2].trim();
      return { label: roman, displayText: body, value: roman };
    }
    const fallbackRoman = ROMAN_NUMERALS[params.index] ?? String(params.index + 1);
    return { label: fallbackRoman, displayText: trimmed, value: fallbackRoman };
  }

  const letterMatch = /^([A-Za-z])[.)]\s+(.+)$/.exec(trimmed);
  if (letterMatch?.[1] && letterMatch[2]) {
    const letter = letterMatch[1].toUpperCase();
    const body = letterMatch[2].trim();
    return { label: letter, displayText: body, value: letter };
  }

  const fallbackLetter = String.fromCharCode(65 + params.index);
  const expectsSingleLetter = params.acceptedVariants.some((v) => /^[A-Za-z]$/.test(v.trim()));
  return {
    label: fallbackLetter,
    displayText: trimmed,
    value: expectsSingleLetter ? fallbackLetter : trimmed,
  };
}

export interface WritingTaskSpecMeta {
  readonly taskType: SupportedWritingTaskType;
  readonly shortTabLabel: string;
  readonly fullTitle: string;
  readonly defaultMinWords: number;
  readonly defaultMaxWords: number | null;
  readonly defaultDurationSeconds: number;
  readonly requiresSingleSentence: boolean;
}

export const WRITING_TASK_SPECS: Record<SupportedWritingTaskType, WritingTaskSpecMeta> = {
  task1Academic: {
    taskType: 'task1Academic',
    shortTabLabel: 'Task 1',
    fullTitle: 'Academic Writing Task 1 (Chart/Diagram)',
    defaultMinWords: 150,
    defaultMaxWords: null,
    defaultDurationSeconds: 1200,
    requiresSingleSentence: false,
  },
  task1General: {
    taskType: 'task1General',
    shortTabLabel: 'Task 1',
    fullTitle: 'General Training Writing Task 1 (Letter)',
    defaultMinWords: 150,
    defaultMaxWords: null,
    defaultDurationSeconds: 1200,
    requiresSingleSentence: false,
  },
  task2Essay: {
    taskType: 'task2Essay',
    shortTabLabel: 'Task 2',
    fullTitle: 'IELTS Writing Task 2 (Essay)',
    defaultMinWords: 250,
    defaultMaxWords: null,
    defaultDurationSeconds: 2400,
    requiresSingleSentence: false,
  },
  toeflSentenceBuild: {
    taskType: 'toeflSentenceBuild',
    shortTabLabel: 'Task 1 · Build',
    fullTitle: 'TOEFL Task 1 (Build a Sentence)',
    defaultMinWords: 15,
    defaultMaxWords: null,
    defaultDurationSeconds: 360,
    requiresSingleSentence: false,
  },
  toeflEmail: {
    taskType: 'toeflEmail',
    shortTabLabel: 'Task 2 · Email',
    fullTitle: 'TOEFL Task 2 (Write an Email)',
    defaultMinWords: 85,
    defaultMaxWords: null,
    defaultDurationSeconds: 420,
    requiresSingleSentence: false,
  },
  toeflAcademicDiscussion: {
    taskType: 'toeflAcademicDiscussion',
    shortTabLabel: 'Task 3 · Discuss',
    fullTitle: 'TOEFL Task 3 (Academic Discussion)',
    defaultMinWords: 100,
    defaultMaxWords: null,
    defaultDurationSeconds: 600,
    requiresSingleSentence: false,
  },
  pteSummarizeWrittenText: {
    taskType: 'pteSummarizeWrittenText',
    shortTabLabel: 'Task 1 · Summary',
    fullTitle: 'PTE Task 1 (Summarize Written Text)',
    defaultMinWords: 5,
    defaultMaxWords: 75,
    defaultDurationSeconds: 600,
    requiresSingleSentence: true,
  },
  pteEssay: {
    taskType: 'pteEssay',
    shortTabLabel: 'Task 2 · Essay',
    fullTitle: 'PTE Task 2 (Write Essay)',
    defaultMinWords: 200,
    defaultMaxWords: 300,
    defaultDurationSeconds: 1200,
    requiresSingleSentence: false,
  },
  detWriteAboutPhoto: {
    taskType: 'detWriteAboutPhoto',
    shortTabLabel: 'Task 1 · Photo',
    fullTitle: 'DET Task 1 (Write About the Photo)',
    defaultMinWords: 25,
    defaultMaxWords: null,
    defaultDurationSeconds: 60,
    requiresSingleSentence: false,
  },
  detInteractiveWriting: {
    taskType: 'detInteractiveWriting',
    shortTabLabel: 'Task 2 · Interact',
    fullTitle: 'DET Task 2 (Interactive Writing)',
    defaultMinWords: 60,
    defaultMaxWords: null,
    defaultDurationSeconds: 480,
    requiresSingleSentence: false,
  },
  detWritingSample: {
    taskType: 'detWritingSample',
    shortTabLabel: 'Task 3 · Sample',
    fullTitle: 'DET Task 3 (Writing Sample)',
    defaultMinWords: 100,
    defaultMaxWords: null,
    defaultDurationSeconds: 300,
    requiresSingleSentence: false,
  },
} as const;

export function normalizeWritingTaskType(raw: string): SupportedWritingTaskType {
  switch (raw.trim()) {
    case 'task1Academic':
    case 'task1_academic':
      return 'task1Academic';
    case 'task1General':
    case 'task1_general':
      return 'task1General';
    case 'toeflSentenceBuild':
    case 'toefl_sentence_build':
      return 'toeflSentenceBuild';
    case 'toeflEmail':
    case 'toefl_email':
      return 'toeflEmail';
    case 'toeflAcademicDiscussion':
    case 'toefl_academic_discussion':
      return 'toeflAcademicDiscussion';
    case 'pteSummarizeWrittenText':
    case 'pte_summarize_written_text':
      return 'pteSummarizeWrittenText';
    case 'pteEssay':
    case 'pte_essay':
      return 'pteEssay';
    case 'detWriteAboutPhoto':
    case 'det_write_about_photo':
      return 'detWriteAboutPhoto';
    case 'detInteractiveWriting':
    case 'det_interactive_writing':
      return 'detInteractiveWriting';
    case 'detWritingSample':
    case 'det_writing_sample':
      return 'detWritingSample';
    default:
      return 'task2Essay';
  }
}

export function getWritingTaskSpec(raw: string): WritingTaskSpecMeta {
  return WRITING_TASK_SPECS[normalizeWritingTaskType(raw)];
}

/** Human-readable micro-drill category label avoiding raw snake_case identifiers (`UX-17`). */
export function formatMicroDrillCategoryLabel(weaknessCode: string): string {
  switch (weaknessCode.trim().toLowerCase()) {
    case 'speed_tfng':
      return 'True / False / Not Given';
    case 'speed_ynng':
      return 'Yes / No / Not Given';
    case 'summary_gap_fill':
    case 'gap_fill':
      return 'Summary Completion';
    case 'complex_grammar':
      return 'Complex Grammar';
    case 'pronunciation_rhythm':
      return 'Pronunciation & Rhythm';
    case 'coherence_linking':
      return 'Coherence & Linking';
    case 'lexical_precision':
      return 'Lexical Precision';
    default:
      return weaknessCode
        .split('_')
        .filter((part) => part.length > 0)
        .map((part) =>
          part.length <= 3
            ? part.toUpperCase()
            : `${(part[0] ?? '').toUpperCase()}${part.slice(1)}`,
        )
        .join(' ');
  }
}

/** Question prompt header tailored to question format (`UX-17`). */
export function getMicroDrillItemHeaderTitle(weaknessCode: string): string {
  const normalized = weaknessCode.trim().toLowerCase();
  if (normalized.includes('tfng')) return 'True / False / Not Given';
  if (normalized.includes('ynng')) return 'Yes / No / Not Given';
  if (normalized.includes('gap') || normalized.includes('summary')) {
    return 'Complete the Summary';
  }
  return 'Choose the Best Answer';
}

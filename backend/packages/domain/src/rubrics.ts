/** Rounds a 4-criterion mean score to the nearest official IELTS 0.5 band. */
export function roundIeltsBand(rawMean: number): number {
  if (!Number.isFinite(rawMean)) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(9, rawMean));
  const halfSteps = Math.round(clamped * 2) / 2;
  return Math.max(0, Math.min(9, halfSteps));
}

export function computeOverallBandFromCriteria(
  bands: readonly [number, number, number, number],
): number {
  const sum = bands[0] + bands[1] + bands[2] + bands[3];
  return roundIeltsBand(sum / 4);
}

/** Computes official IELTS overall writing band with Task 2 weighted 2x (PDR.md Sec. 10 / ADR-008). */
export function computeOverallWritingBand(task1Band: number, task2Band: number): number {
  const weightedMean = (task1Band + 2 * task2Band) / 3;
  return roundIeltsBand(weightedMean);
}

export const WRITING_CRITERIA_TASK1 = ['TA', 'CC', 'LR', 'GRA'] as const;
export const WRITING_CRITERIA_TASK2 = ['TR', 'CC', 'LR', 'GRA'] as const;
export const SPEAKING_CRITERIA = ['FC', 'LR', 'GRA', 'PR'] as const;

export const ALL_CRITERION_CODES = [
  'FC',
  'LR',
  'GRA',
  'PR',
  'TA',
  'TR',
  'CC',
  'CONTENT',
  'ORG',
  'VOCAB',
  'GRAM',
  'MECH',
  'DELIVERY',
  'COH',
] as const;

export type WritingCriterionCode = (typeof WRITING_CRITERIA_TASK1)[number] | 'TR';
export type SpeakingCriterionCode = (typeof SPEAKING_CRITERIA)[number];
export type CriterionCode = (typeof ALL_CRITERION_CODES)[number];

export const SUPPORTED_EXAM_IDS = [
  'ielts_academic',
  'ielts_general',
  'toefl_ibt',
  'pte_academic',
  'det',
] as const;

export type SupportedExamId = (typeof SUPPORTED_EXAM_IDS)[number];

export const SUPPORTED_WRITING_TASK_TYPES = [
  'task1Academic',
  'task1General',
  'task2Essay',
  'toeflSentenceBuild',
  'toeflEmail',
  'toeflAcademicDiscussion',
  'pteSummarizeWrittenText',
  'pteEssay',
  'detWriteAboutPhoto',
  'detInteractiveWriting',
  'detWritingSample',
] as const;

export type SupportedWritingTaskType = (typeof SUPPORTED_WRITING_TASK_TYPES)[number];

export interface ExamScaleSpec {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly targetDefault: number;
  readonly unit: string;
  readonly label: string;
}

export const EXAM_SCALES = {
  ielts_academic: {
    min: 0,
    max: 9,
    step: 0.5,
    targetDefault: 7.5,
    unit: 'Band',
    label: 'IELTS Academic',
  },
  ielts_general: {
    min: 0,
    max: 9,
    step: 0.5,
    targetDefault: 7.0,
    unit: 'Band',
    label: 'IELTS General Training',
  },
  toefl_ibt: {
    min: 1,
    max: 6,
    step: 0.5,
    targetDefault: 5.0,
    unit: 'Band',
    label: 'TOEFL iBT',
  },
  pte_academic: {
    min: 10,
    max: 90,
    step: 1,
    targetDefault: 65,
    unit: 'Score',
    label: 'PTE Academic',
  },
  det: {
    min: 10,
    max: 160,
    step: 5,
    targetDefault: 125,
    unit: 'Score',
    label: 'Duolingo English Test',
  },
} as const satisfies Record<SupportedExamId, ExamScaleSpec>;

export function normalizeSupportedExamId(raw?: string | null): SupportedExamId {
  const normalized = (raw ?? '').trim().toLowerCase();
  if (
    normalized === 'ielts_general' ||
    normalized === 'general' ||
    normalized === 'ielts-general'
  ) {
    return 'ielts_general';
  }
  if (normalized === 'toefl_ibt' || normalized === 'toefl' || normalized === 'toefl-ibt') {
    return 'toefl_ibt';
  }
  if (normalized === 'pte_academic' || normalized === 'pte' || normalized === 'pte-academic') {
    return 'pte_academic';
  }
  if (normalized === 'det' || normalized === 'duolingo' || normalized === 'duolingo_english_test') {
    return 'det';
  }
  return 'ielts_academic';
}

function getExamScale(examId: SupportedExamId): ExamScaleSpec {
  return Object.hasOwn(EXAM_SCALES, examId)
    ? EXAM_SCALES[examId]
    : EXAM_SCALES[normalizeSupportedExamId(examId)];
}

export function quantizeExamScore(raw: number, examId: SupportedExamId): number {
  const scale = getExamScale(examId);
  if (!Number.isFinite(raw)) {
    return scale.min;
  }
  const clamped = Math.min(scale.max, Math.max(scale.min, raw));
  const quantized = Math.round((clamped - scale.min) / scale.step) * scale.step + scale.min;
  const bounded = Math.min(scale.max, Math.max(scale.min, quantized));
  return Number(bounded.toFixed(2));
}

export function scoreFromNormalizedQuality(ratio: number, examId: SupportedExamId): number {
  const scale = getExamScale(examId);
  const clampedRatio = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  return quantizeExamScore(scale.min + clampedRatio * (scale.max - scale.min), examId);
}

export function normalizeScoreToQualityRatio(score: number, examId: SupportedExamId): number {
  const scale = getExamScale(examId);
  const span = scale.max - scale.min;
  if (span <= 0 || !Number.isFinite(score)) {
    return 0;
  }
  return Math.min(1, Math.max(0, (score - scale.min) / span));
}

const TOEFL_LEGACY_120_ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [1.0, 5],
  [1.5, 14],
  [2.0, 25],
  [2.5, 38],
  [3.0, 51],
  [3.5, 64],
  [4.0, 78],
  [4.5, 90],
  [5.0, 100],
  [5.5, 110],
  [6.0, 117],
];

export function estimateToeflLegacy120(band: number): number {
  const clamped = Math.min(6, Math.max(1, Number.isFinite(band) ? band : 1));
  for (let i = 0; i < TOEFL_LEGACY_120_ANCHORS.length - 1; i++) {
    const a0 = TOEFL_LEGACY_120_ANCHORS[i];
    const a1 = TOEFL_LEGACY_120_ANCHORS[i + 1];
    if (!a0 || !a1) continue;
    const [b0, s0] = a0;
    const [b1, s1] = a1;
    if (clamped >= b0 && clamped <= b1) {
      const t = (clamped - b0) / (b1 - b0);
      return Math.round(s0 + t * (s1 - s0));
    }
  }
  return 117;
}

export function computeExamOverallFromCriteria(values: number[], examId: SupportedExamId): number {
  if (values.length === 0) {
    return getExamScale(examId).min;
  }
  const avg = values.reduce((sum, item) => sum + item, 0) / values.length;
  if (examId === 'ielts_academic' || examId === 'ielts_general') {
    return roundIeltsBand(avg);
  }
  return quantizeExamScore(avg, examId);
}

export interface RubricCriterionSpec {
  readonly code: CriterionCode;
  readonly label: string;
  readonly description: string;
}

export interface ExamRubricSpec {
  readonly examId: SupportedExamId;
  readonly scale: ExamScaleSpec;
  readonly promptLabel: string;
  readonly scoringRules: string;
  readonly minRecommendedWords?: number;
  readonly maxRecommendedWords?: number;
  readonly criteria: readonly RubricCriterionSpec[];
}

export function getExamRubricSpec(
  examId: SupportedExamId,
  skill: 'writing' | 'speaking',
  taskType?: string,
): ExamRubricSpec {
  const scale = getExamScale(examId);

  if (skill === 'writing') {
    switch (examId) {
      case 'toefl_ibt': {
        const minWords =
          taskType === 'toeflSentenceBuild' ? 8 : taskType === 'toeflAcademicDiscussion' ? 100 : 85;
        const maxWords = taskType === 'toeflSentenceBuild' ? 40 : undefined;
        return {
          examId,
          scale,
          promptLabel: `TOEFL iBT (2026 format, 1.0–6.0 scale in 0.5 steps; task: ${taskType ?? 'toeflEmail'})`,
          scoringRules:
            'Score on the official TOEFL iBT 2026 1.0–6.0 scale (0.5 increments). Reward direct task fulfillment, clear pragmatics/register (email vs academic discussion), cohesive development with concrete support, accurate vocabulary, and syntactic variety.',
          minRecommendedWords: minWords,
          maxRecommendedWords: maxWords,
          criteria: [
            {
              code: 'TR',
              label: 'Task Fulfillment',
              description: 'Addresses all prompt goals, register, and audience.',
            },
            {
              code: 'ORG',
              label: 'Organization & Progression',
              description: 'Clear structure and smooth logical transitions.',
            },
            {
              code: 'VOCAB',
              label: 'Lexical Sophistication',
              description: 'Precise, natural word choice and idiomatic control.',
            },
            {
              code: 'GRAM',
              label: 'Grammatical Control',
              description: 'Accurate, varied clause and sentence structures.',
            },
          ],
        };
      }
      case 'pte_academic': {
        const isSwt = taskType === 'pteSummarizeWrittenText';
        return {
          examId,
          scale,
          promptLabel: `PTE Academic Writing (${isSwt ? 'Summarize Written Text' : 'Write Essay'}, 10–90 GSE score)`,
          scoringRules: isSwt
            ? 'Score on the 10–90 PTE Academic scale. Summarize Written Text MUST be a SINGLE complete sentence between 5 and 75 words. Multiple sentences or counts outside 5–75 words heavily penalize Form (MECH). Penalize memorized templates or lifted phrasing.'
            : 'Score on the 10–90 PTE Academic scale. Ideal Write Essay length is 200–300 words. Evaluate argument depth, formal academic register, cohesion, and grammar while penalizing generic memorized essay templates.',
          minRecommendedWords: isSwt ? 5 : 200,
          maxRecommendedWords: isSwt ? 75 : 300,
          criteria: [
            {
              code: 'CONTENT',
              label: 'Content Coverage',
              description: 'Captures core ideas, arguments, and prompt relevance.',
            },
            {
              code: 'MECH',
              label: isSwt ? 'Form & Single-Sentence Rule' : 'Form & Length Compliance',
              description: isSwt
                ? 'One grammatically complete sentence strictly within 5–75 words.'
                : 'Stays in the 200–300 word academic essay window with sound mechanics.',
            },
            {
              code: 'VOCAB',
              label: 'Academic Vocabulary',
              description: 'Precise paraphrasing without robotic templates.',
            },
            {
              code: 'GRAM',
              label: 'Grammar & Spelling',
              description: 'Standard punctuation, spelling, and complex syntax.',
            },
          ],
        };
      }
      case 'det': {
        const minWords =
          taskType === 'detWriteAboutPhoto' ? 25 : taskType === 'detInteractiveWriting' ? 60 : 100;
        return {
          examId,
          scale,
          promptLabel: `Duolingo English Test Writing (${taskType ?? 'detWritingSample'}, 10–160 scale in 5-point steps)`,
          scoringRules:
            'Score on the 10–160 DET scale rounded to multiples of 5. Evaluate Communicative Effectiveness, Grammatical Accuracy & Complexity, Lexical Sophistication & Diversity, and Coherence (contributing to Production and Literacy subscores).',
          minRecommendedWords: minWords,
          criteria: [
            {
              code: 'CONTENT',
              label: 'Task Relevance (Production)',
              description: 'Directly describes/responds with relevant specifics and depth.',
            },
            {
              code: 'COH',
              label: 'Coherence & Flow',
              description: 'Clear logical connection across ideas and follow-up turns.',
            },
            {
              code: 'VOCAB',
              label: 'Lexical Sophistication (Literacy)',
              description: 'Varied, topic-appropriate vocabulary without repetition.',
            },
            {
              code: 'GRAM',
              label: 'Grammatical Accuracy & Range',
              description: 'Accurate, diverse clauses supporting high Production.',
            },
          ],
        };
      }
      default: {
        const isTask1 = taskType === 'task1Academic' || taskType === 'task1General';
        return {
          examId,
          scale,
          promptLabel: `${scale.label} Writing (${isTask1 ? 'Task 1' : 'Task 2'}, 0–9 scale in 0.5 steps)`,
          scoringRules:
            'Score using official IELTS Writing band descriptors on 0–9 in 0.5-band increments across all four criteria.',
          minRecommendedWords: isTask1 ? 150 : 250,
          criteria: [
            {
              code: isTask1 ? 'TA' : 'TR',
              label: isTask1 ? 'Task Achievement' : 'Task Response',
              description: isTask1
                ? 'Covers key features/purpose clearly and accurately.'
                : 'Presents a clear position with well-supported ideas.',
            },
            {
              code: 'CC',
              label: 'Coherence & Cohesion',
              description: 'Logical paragraphing and cohesive referencing.',
            },
            {
              code: 'LR',
              label: 'Lexical Resource',
              description: 'Natural collocations and precise word choice.',
            },
            {
              code: 'GRA',
              label: 'Grammatical Range & Accuracy',
              description: 'Varied sentence structures with minimal errors.',
            },
          ],
        };
      }
    }
  }

  // Speaking rubrics
  switch (examId) {
    case 'toefl_ibt':
      return {
        examId,
        scale,
        promptLabel:
          'TOEFL iBT Speaking (2026 format: Listen & Repeat / Take an Interview, 1.0–6.0 scale in 0.5 steps)',
        scoringRules:
          'Score on the TOEFL iBT 2026 1.0–6.0 scale (0.5 steps). For Listen and Repeat turns check accurate verbatim recall, natural stress, and rhythm; for Take an Interview turns reward spontaneous, direct, detailed spoken responses with smooth delivery and clear pronunciation.',
        criteria: [
          {
            code: 'DELIVERY',
            label: 'Delivery & Fluency',
            description: 'Natural pace, clear speech, minimal hesitation, good intonation.',
          },
          {
            code: 'VOCAB',
            label: 'Language Use — Vocabulary',
            description: 'Precise, natural spoken vocabulary and phrasing.',
          },
          {
            code: 'GRAM',
            label: 'Language Use — Grammar',
            description: 'Spontaneous, accurate grammatical structures.',
          },
          {
            code: 'CONTENT',
            label: 'Topic Development',
            description: 'Accurate repetition or relevant, well-elaborated interview answers.',
          },
        ],
      };
    case 'pte_academic':
      return {
        examId,
        scale,
        promptLabel:
          'PTE Academic Speaking (Read Aloud / Repeat Sentence / Describe Image / Retell Lecture / Respond to a Situation / Summarize Group Discussion, 10–90 GSE)',
        scoringRules:
          'Score on the 10–90 PTE Academic scale. Prioritize Oral Fluency (smooth rhythm, zero unnatural pauses/self-corrections), Pronunciation clarity, and Content coverage without memorized placeholder templates.',
        criteria: [
          {
            code: 'DELIVERY',
            label: 'Oral Fluency',
            description: 'Smooth, natural speech rate without hesitation or false starts.',
          },
          {
            code: 'PR',
            label: 'Pronunciation',
            description: 'Native-like clarity of vowels, consonants, and sentence stress.',
          },
          {
            code: 'CONTENT',
            label: 'Content & Task Coverage',
            description: 'Covers source elements/situation accurately without filler templates.',
          },
          {
            code: 'GRAM',
            label: 'Spoken Grammar & Range',
            description: 'Natural grammatical phrasing in spontaneous turns.',
          },
        ],
      };
    case 'det':
      return {
        examId,
        scale,
        promptLabel:
          'Duolingo English Test Speaking (Read Then Speak / Interactive Speaking / Speaking Sample, 10–160 in 5-point steps)',
        scoringRules:
          'Score on the 10–160 DET scale rounded to multiples of 5. Evaluate Fluency & Pronunciation (Conversation), Lexical Diversity, Grammatical Accuracy, and Depth of spontaneous elaboration (Production).',
        criteria: [
          {
            code: 'DELIVERY',
            label: 'Conversation Fluency & Clarity',
            description: 'Smooth delivery, intelligible pronunciation, natural pacing.',
          },
          {
            code: 'VOCAB',
            label: 'Lexical Sophistication',
            description: 'Wide range of accurate vocabulary during unscripted speech.',
          },
          {
            code: 'GRAM',
            label: 'Grammatical Range & Control',
            description: 'Consistent accuracy across complex spoken clauses.',
          },
          {
            code: 'CONTENT',
            label: 'Spontaneous Elaboration (Production)',
            description: 'Direct, substantive answers to follow-up prompts.',
          },
        ],
      };
    default:
      return {
        examId,
        scale,
        promptLabel: `${scale.label} Speaking (Parts 1–3, 0–9 scale in 0.5 steps)`,
        scoringRules:
          'Score using official IELTS Speaking band descriptors on 0–9 in 0.5-band increments.',
        criteria: [
          {
            code: 'FC',
            label: 'Fluency & Coherence',
            description: 'Flow of speech, linking, and logical extension.',
          },
          {
            code: 'LR',
            label: 'Lexical Resource',
            description: 'Idiomatic vocabulary and paraphrasing flexibility.',
          },
          {
            code: 'GRA',
            label: 'Grammatical Range & Accuracy',
            description: 'Complex spoken structures with high accuracy.',
          },
          {
            code: 'PR',
            label: 'Pronunciation',
            description: 'Intelligibility, stress, rhythm, and intonation.',
          },
        ],
      };
  }
}

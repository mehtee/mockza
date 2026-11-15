/** Rounds a 4-criterion mean score to the nearest official IELTS 0.5 band. */
export function roundIeltsBand(rawMean: number): number {
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

export type WritingCriterionCode = (typeof WRITING_CRITERIA_TASK1)[number] | 'TR';
export type SpeakingCriterionCode = (typeof SPEAKING_CRITERIA)[number];

export const EXAM_SCALES = {
  ielts_academic: {
    min: 0,
    max: 9,
    step: 0.5,
    unit: 'Band',
    label: 'IELTS Academic',
  },
  ielts_general: {
    min: 0,
    max: 9,
    step: 0.5,
    unit: 'Band',
    label: 'IELTS General Training',
  },
  pte_academic: {
    min: 10,
    max: 90,
    step: 1,
    unit: 'Score',
    label: 'PTE Academic',
  },
  toefl_ibt: {
    min: 0,
    max: 120,
    step: 1,
    unit: 'Score',
    label: 'TOEFL iBT',
  },
  det: {
    min: 10,
    max: 160,
    step: 5,
    unit: 'Score',
    label: 'Duolingo English Test',
  },
} as const;

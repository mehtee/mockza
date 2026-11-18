import type { SupportedExamId, SupportedWritingTaskType } from '../rubrics.js';
import {
  estimateToeflLegacy120,
  normalizeSupportedExamId,
  quantizeExamScore,
  scoreFromNormalizedQuality,
} from '../rubrics.js';
import { listeningBandFor, readingBandFor } from './band-conversion.js';
import { EXAM_TRACK_SPECS, formatExamScore, isIeltsTrack, type SkillKind } from './exam-spec.js';

export const DET_SUBSCORE_KEYS = [
  'literacy',
  'comprehension',
  'conversation',
  'production',
] as const;

export interface DetSubscores {
  readonly literacy: number | null;
  readonly comprehension: number | null;
  readonly conversation: number | null;
  readonly production: number | null;
}

function pairAvgDet(a?: number | null, b?: number | null): number | null {
  if (a == null && b == null) return null;
  if (a != null && b != null) {
    return quantizeExamScore((a + b) / 2, 'det');
  }
  return quantizeExamScore((a ?? b) as number, 'det');
}

/** Computes DET's 4 integrated subscores (`Literacy`, `Comprehension`, `Conversation`, `Production`). */
export function computeDetSubscores(params: {
  reading?: number | null;
  listening?: number | null;
  writing?: number | null;
  speaking?: number | null;
}): DetSubscores {
  return {
    literacy: pairAvgDet(params.reading, params.writing),
    comprehension: pairAvgDet(params.reading, params.listening),
    conversation: pairAvgDet(params.listening, params.speaking),
    production: pairAvgDet(params.writing, params.speaking),
  };
}

/** Returns non-null labeled DET subscore entries ready for badge display. */
export function getPopulatedDetSubscoreEntries(
  subscores: DetSubscores,
): Array<{ label: string; score: number }> {
  const entries: Array<{ label: string; score: number }> = [];
  if (subscores.literacy !== null) {
    entries.push({ label: 'Literacy', score: subscores.literacy });
  }
  if (subscores.comprehension !== null) {
    entries.push({ label: 'Comprehension', score: subscores.comprehension });
  }
  if (subscores.conversation !== null) {
    entries.push({ label: 'Conversation', score: subscores.conversation });
  }
  if (subscores.production !== null) {
    entries.push({ label: 'Production', score: subscores.production });
  }
  return entries;
}

export interface ExamDescriptor {
  readonly track: SupportedExamId;
  readonly subtitle: string;
  readonly formatHint: string;
  readonly readingPackId: string;
  readonly listeningPackId: string;
  readonly writingPackId: string;
  readonly speakingPackId: string;
  readonly drillPackId: string;
  readonly writingTasks: readonly SupportedWritingTaskType[];
  readonly fullMockTotalSeconds: number;
  readonly speakingDefaultPrepSeconds: number;
  readonly speakingDefaultSpeakSeconds: number;
  readonly minCalibratedObjectiveCount: number;
}

export const EXAM_DESCRIPTORS: Record<SupportedExamId, ExamDescriptor> = {
  ielts_academic: {
    track: 'ielts_academic',
    subtitle: 'University & Professional · Bands 0–9 (0.5 steps)',
    formatHint: 'Reading 60m · Listening 30m · Writing 60m · Speaking ~14m',
    readingPackId: 'ielts-acad-reading-seed-01',
    listeningPackId: 'ielts-listening-seed-01',
    writingPackId: 'ielts-writing-seed-01',
    speakingPackId: 'ielts-speaking-seed-01',
    drillPackId: 'ielts-micro-drill-01',
    writingTasks: ['task1Academic', 'task2Essay'],
    fullMockTotalSeconds: 164 * 60,
    speakingDefaultPrepSeconds: 60,
    speakingDefaultSpeakSeconds: 120,
    minCalibratedObjectiveCount: 40,
  },
  ielts_general: {
    track: 'ielts_general',
    subtitle: 'Migration & Career · Bands 0–9 (0.5 steps)',
    formatHint: 'Everyday & Workplace texts · Letter + Essay · Speaking ~14m',
    readingPackId: 'ielts-gt-reading-seed-01',
    listeningPackId: 'ielts-listening-seed-01',
    writingPackId: 'ielts-gt-writing-pack-01',
    speakingPackId: 'ielts-speaking-seed-01',
    drillPackId: 'ielts-micro-drill-01',
    writingTasks: ['task1General', 'task2Essay'],
    fullMockTotalSeconds: 164 * 60,
    speakingDefaultPrepSeconds: 60,
    speakingDefaultSpeakSeconds: 120,
    minCalibratedObjectiveCount: 40,
  },
  toefl_ibt: {
    track: 'toefl_ibt',
    subtitle: '2026 Format · 1.0–6.0 Scale (+ 0–120 bridge)',
    formatHint: 'Adaptive R & L · Build Sentence/Email/Discussion · Repeat & Interview',
    readingPackId: 'toefl-reading-pack-01',
    listeningPackId: 'toefl-listening-pack-01',
    writingPackId: 'toefl-writing-pack-01',
    speakingPackId: 'toefl-speaking-pack-01',
    drillPackId: 'toefl-micro-drill-01',
    writingTasks: ['toeflSentenceBuild', 'toeflEmail', 'toeflAcademicDiscussion'],
    fullMockTotalSeconds: 90 * 60,
    speakingDefaultPrepSeconds: 0,
    speakingDefaultSpeakSeconds: 45,
    minCalibratedObjectiveCount: 4,
  },
  pte_academic: {
    track: 'pte_academic',
    subtitle: 'Latest GSE Format · Score 10–90 (1-pt steps)',
    formatHint: 'Integrated S&W · Re-order Paragraphs · Situation & Discussion',
    readingPackId: 'pte-reading-pack-01',
    listeningPackId: 'pte-listening-pack-01',
    writingPackId: 'pte-writing-pack-01',
    speakingPackId: 'pte-speaking-pack-01',
    drillPackId: 'pte-micro-drill-01',
    writingTasks: ['pteSummarizeWrittenText', 'pteEssay'],
    fullMockTotalSeconds: 120 * 60,
    speakingDefaultPrepSeconds: 25,
    speakingDefaultSpeakSeconds: 40,
    minCalibratedObjectiveCount: 4,
  },
  det: {
    track: 'det',
    subtitle: 'Latest Adaptive Format · Score 10–160 (5-pt steps)',
    formatHint: 'Literacy, Comprehension, Conversation & Production subscores',
    readingPackId: 'det-reading-pack-01',
    listeningPackId: 'det-listening-pack-01',
    writingPackId: 'det-writing-pack-01',
    speakingPackId: 'det-speaking-pack-01',
    drillPackId: 'det-micro-drill-01',
    writingTasks: ['detWriteAboutPhoto', 'detInteractiveWriting', 'detWritingSample'],
    fullMockTotalSeconds: 60 * 60,
    speakingDefaultPrepSeconds: 20,
    speakingDefaultSpeakSeconds: 90,
    minCalibratedObjectiveCount: 4,
  },
} as const;

export function getExamDescriptor(examId: SupportedExamId | string): ExamDescriptor {
  return EXAM_DESCRIPTORS[normalizeSupportedExamId(examId)];
}

export function defaultPackIdForSkill(descriptor: ExamDescriptor, skill: SkillKind): string {
  switch (skill) {
    case 'reading':
      return descriptor.readingPackId;
    case 'listening':
      return descriptor.listeningPackId;
    case 'writing':
      return descriptor.writingPackId;
    case 'speaking':
      return descriptor.speakingPackId;
    case 'vocabulary':
      return descriptor.drillPackId;
  }
}

/** Computes a track-accurate objective score for Reading or Listening. */
export function scoreObjectiveForTrack(params: {
  track: SupportedExamId;
  skill: SkillKind;
  correctCount: number;
  totalCount: number;
  isFullLength?: boolean;
}): number {
  const resolvedTrack = normalizeSupportedExamId(params.track);
  const trackSpec = EXAM_TRACK_SPECS[resolvedTrack];
  if (params.skill !== 'reading' && params.skill !== 'listening') {
    return trackSpec.minScore;
  }
  if (isIeltsTrack(resolvedTrack)) {
    const scaledCorrect =
      params.totalCount > 0 && params.totalCount !== 40
        ? Math.max(0, Math.min(40, Math.round((params.correctCount / params.totalCount) * 40)))
        : params.correctCount;
    if (params.skill === 'listening') {
      return listeningBandFor(scaledCorrect);
    }
    return readingBandFor(
      scaledCorrect,
      resolvedTrack === 'ielts_general' ? 'general_training' : 'academic',
    );
  }

  if (params.totalCount <= 0) return trackSpec.minScore;
  const ratio = Math.min(1, Math.max(0, params.correctCount / params.totalCount));
  return scoreFromNormalizedQuality(ratio, resolvedTrack);
}

/** Computes supplementary score context badges (TOEFL legacy `/120`, DET 4 subscores). */
export function buildScoreInsights(params: {
  track: SupportedExamId;
  overallScore: number;
  reading?: number | null;
  listening?: number | null;
  writing?: number | null;
  speaking?: number | null;
}): Array<{ label: string; detail: string }> {
  if (params.track === 'toefl_ibt') {
    const legacy = estimateToeflLegacy120(params.overallScore);
    return [{ label: 'Comparable 0–120', detail: `${legacy} / 120` }];
  }
  if (params.track === 'det') {
    const subs = computeDetSubscores({
      reading: params.reading,
      listening: params.listening,
      writing: params.writing,
      speaking: params.speaking,
    });
    return getPopulatedDetSubscoreEntries(subs).map((e) => ({
      label: e.label,
      detail: formatExamScore(e.score, 'det'),
    }));
  }
  return [];
}

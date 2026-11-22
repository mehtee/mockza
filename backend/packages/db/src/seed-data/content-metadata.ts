import {
  type AuthoringTier,
  type CanonicalTopicKey,
  mapLegacyVocabTopicTag,
} from '@mockza/domain';

export interface PackMetadataTag {
  readonly topicKeys: CanonicalTopicKey[];
  readonly cefrMin: AuthoringTier;
  readonly cefrMax: AuthoringTier;
  readonly weaknessTags: string[];
}

export interface DrillMetadataTag {
  readonly examId: 'ielts_academic' | 'ielts_general' | 'toefl_ibt' | 'pte_academic' | 'det';
  readonly topicKeys: CanonicalTopicKey[];
  readonly cefrMin: AuthoringTier;
  readonly cefrMax: AuthoringTier;
  readonly weaknessTags: string[];
}

export const PACK_METADATA_BY_ID: Record<string, PackMetadataTag> = {
  'ielts-acad-reading-seed-01': {
    topicKeys: ['urban_society', 'science_climate'],
    cefrMin: 'B1',
    cefrMax: 'B2',
    weaknessTags: ['reading:tfng_trap', 'reading:summary_completion'],
  },
  'ielts-acad-reading-pack-01': {
    topicKeys: ['science_climate'],
    cefrMin: 'B2',
    cefrMax: 'C1',
    weaknessTags: ['reading:matching_headings', 'reading:paraphrase_matching'],
  },
  'ielts-acad-reading-pack-02': {
    topicKeys: ['technology_ai'],
    cefrMin: 'B2',
    cefrMax: 'C1',
    weaknessTags: ['reading:tfng_trap', 'reading:paraphrase_matching'],
  },
  'ielts-acad-reading-pack-03': {
    topicKeys: ['science_climate', 'business_finance'],
    cefrMin: 'B1',
    cefrMax: 'B2',
    weaknessTags: ['reading:tfng_trap', 'reading:summary_completion'],
  },
  'ielts-acad-reading-pack-04': {
    topicKeys: ['science_climate'],
    cefrMin: 'B2',
    cefrMax: 'C1',
    weaknessTags: ['reading:matching_headings', 'reading:paraphrase_matching'],
  },
  'ielts-acad-reading-pack-05': {
    topicKeys: ['urban_society', 'technology_ai'],
    cefrMin: 'B2',
    cefrMax: 'C1',
    weaknessTags: ['reading:summary_completion', 'reading:tfng_trap'],
  },
  'ielts-acad-reading-pack-06': {
    topicKeys: ['health_sports', 'education_campus'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['reading:paraphrase_matching', 'reading:matching_headings'],
  },
  'ielts-gt-reading-seed-01': {
    topicKeys: ['urban_society', 'education_campus'],
    cefrMin: 'B1',
    cefrMax: 'B2',
    weaknessTags: ['reading:tfng_trap', 'reading:detail_capture', 'reading:summary_completion'],
  },
  'ielts-listening-seed-01': {
    topicKeys: ['science_climate', 'urban_society'],
    cefrMin: 'B1',
    cefrMax: 'B2',
    weaknessTags: ['listening:distractor_traps', 'listening:detail_capture'],
  },
  'ielts-listening-pack-01-uk': {
    topicKeys: ['education_campus'],
    cefrMin: 'B1',
    cefrMax: 'B2',
    weaknessTags: ['listening:detail_capture', 'listening:distractor_traps'],
  },
  'ielts-listening-pack-02-au': {
    topicKeys: ['science_climate', 'travel_culture'],
    cefrMin: 'B2',
    cefrMax: 'C1',
    weaknessTags: ['listening:distractor_traps', 'listening:multiple_choice_attitude'],
  },
  'ielts-listening-pack-03-us': {
    topicKeys: ['science_climate', 'technology_ai'],
    cefrMin: 'B2',
    cefrMax: 'C1',
    weaknessTags: ['listening:multiple_choice_attitude', 'listening:detail_capture'],
  },
  'ielts-listening-pack-04-nz': {
    topicKeys: ['travel_culture', 'health_sports'],
    cefrMin: 'B1',
    cefrMax: 'B2',
    weaknessTags: ['listening:distractor_traps', 'listening:detail_capture'],
  },
  'ielts-writing-seed-01': {
    topicKeys: ['education_campus', 'urban_society'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['writing:cohesion_linkers', 'writing:task_response', 'grammar:tense_consistency'],
  },
  'ielts-writing-pack-01': {
    topicKeys: ['technology_ai', 'career_workplace'],
    cefrMin: 'B2',
    cefrMax: 'C1',
    weaknessTags: ['writing:cohesion_linkers', 'writing:task_response'],
  },
  'ielts-writing-pack-02': {
    topicKeys: ['business_finance', 'urban_society'],
    cefrMin: 'B1',
    cefrMax: 'B2',
    weaknessTags: ['writing:task_response', 'grammar:tense_consistency'],
  },
  'ielts-writing-pack-03': {
    topicKeys: ['education_campus', 'science_climate'],
    cefrMin: 'B2',
    cefrMax: 'C1',
    weaknessTags: ['writing:cohesion_linkers', 'vocab:academic_collocation'],
  },
  'ielts-writing-pack-04': {
    topicKeys: ['travel_culture', 'science_climate'],
    cefrMin: 'B2',
    cefrMax: 'C1',
    weaknessTags: ['writing:cohesion_linkers', 'writing:task_response'],
  },
  'ielts-writing-gt-01': {
    topicKeys: ['career_workplace', 'urban_society'],
    cefrMin: 'B1',
    cefrMax: 'B2',
    weaknessTags: ['writing:task_response', 'writing:cohesion_linkers'],
  },
  'ielts-speaking-seed-01': {
    topicKeys: ['technology_ai', 'urban_society'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['speaking:fluency_fillers', 'speaking:lexical_precision'],
  },
  'ielts-speaking-pack-01': {
    topicKeys: ['arts_media', 'technology_ai'],
    cefrMin: 'B2',
    cefrMax: 'C1',
    weaknessTags: ['speaking:lexical_precision', 'pronunciation:word_stress'],
  },
  'ielts-speaking-pack-02': {
    topicKeys: ['travel_culture'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['speaking:fluency_fillers', 'pronunciation:word_stress'],
  },
  'ielts-speaking-pack-03': {
    topicKeys: ['technology_ai', 'arts_media'],
    cefrMin: 'B1',
    cefrMax: 'B2',
    weaknessTags: ['speaking:lexical_precision', 'speaking:fluency_fillers'],
  },
  'ielts-speaking-pack-04': {
    topicKeys: ['health_sports'],
    cefrMin: 'B1',
    cefrMax: 'B2',
    weaknessTags: ['speaking:fluency_fillers', 'pronunciation:th_dental_fricative'],
  },
  'toefl-reading-pack-01': {
    topicKeys: ['education_campus', 'science_climate'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['reading:paraphrase_matching', 'reading:summary_completion'],
  },
  'toefl-listening-pack-01': {
    topicKeys: ['education_campus', 'science_climate'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['listening:multiple_choice_attitude', 'listening:distractor_traps'],
  },
  'toefl-writing-pack-01': {
    topicKeys: ['education_campus', 'career_workplace'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['writing:cohesion_linkers', 'writing:task_response'],
  },
  'toefl-speaking-pack-01': {
    topicKeys: ['education_campus'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['speaking:fluency_fillers', 'pronunciation:word_stress'],
  },
  'pte-reading-pack-01': {
    topicKeys: ['academic_core', 'technology_ai'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['reading:matching_headings', 'vocab:academic_collocation'],
  },
  'pte-listening-pack-01': {
    topicKeys: ['academic_core', 'education_campus'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['listening:detail_capture', 'listening:distractor_traps'],
  },
  'pte-writing-pack-01': {
    topicKeys: ['academic_core', 'business_finance'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['writing:cohesion_linkers', 'writing:task_response'],
  },
  'pte-speaking-pack-01': {
    topicKeys: ['academic_core', 'education_campus'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['speaking:fluency_fillers', 'pronunciation:word_stress'],
  },
  'det-reading-pack-01': {
    topicKeys: ['academic_core', 'technology_ai'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['reading:paraphrase_matching', 'vocab:academic_collocation'],
  },
  'det-listening-pack-01': {
    topicKeys: ['academic_core', 'education_campus'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['listening:detail_capture', 'listening:distractor_traps'],
  },
  'det-writing-pack-01': {
    topicKeys: ['academic_core', 'urban_society'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['writing:task_response', 'grammar:tense_consistency'],
  },
  'det-speaking-pack-01': {
    topicKeys: ['academic_core', 'travel_culture'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['speaking:lexical_precision', 'pronunciation:word_stress'],
  },
};

export const DRILL_METADATA_BY_ID: Record<string, DrillMetadataTag> = {
  'ielts-micro-drill-01': {
    examId: 'ielts_academic',
    topicKeys: ['science_climate', 'urban_society'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['reading:tfng_trap'],
  },
  'ielts-micro-drill-02': {
    examId: 'ielts_academic',
    topicKeys: ['academic_core', 'technology_ai'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['vocab:academic_collocation', 'writing:cohesion_linkers'],
  },
  'ielts-micro-drill-03': {
    examId: 'ielts_academic',
    topicKeys: ['education_campus', 'travel_culture'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['listening:distractor_traps'],
  },
  'ielts-micro-drill-04': {
    examId: 'ielts_academic',
    topicKeys: ['academic_core', 'science_climate'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['reading:paraphrase_matching'],
  },
  'toefl-micro-drill-01': {
    examId: 'toefl_ibt',
    topicKeys: ['education_campus'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['reading:paraphrase_matching', 'vocab:academic_collocation'],
  },
  'pte-micro-drill-01': {
    examId: 'pte_academic',
    topicKeys: ['academic_core'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['reading:matching_headings', 'writing:cohesion_linkers'],
  },
  'det-micro-drill-01': {
    examId: 'det',
    topicKeys: ['academic_core'],
    cefrMin: 'B1',
    cefrMax: 'C1',
    weaknessTags: ['vocab:academic_collocation', 'reading:paraphrase_matching'],
  },
};

export function resolvePackMetadata(packId: string): PackMetadataTag {
  return (
    PACK_METADATA_BY_ID[packId] ?? {
      topicKeys: ['academic_core'],
      cefrMin: 'B1',
      cefrMax: 'C1',
      weaknessTags: [],
    }
  );
}

export function resolveDrillMetadata(drillId: string): DrillMetadataTag {
  return (
    DRILL_METADATA_BY_ID[drillId] ?? {
      examId: 'ielts_academic',
      topicKeys: ['academic_core'],
      cefrMin: 'B1',
      cefrMax: 'C1',
      weaknessTags: [],
    }
  );
}

export function deriveVocabCardMetadata(card: {
  cardId: string;
  headword: string;
  topicTag: string;
  easeFactorMilli?: number;
}, index: number): {
  canonicalTopicKey: CanonicalTopicKey;
  cefrLevel: 'B1' | 'B2' | 'C1' | 'C2';
  bandTarget: number;
  weaknessTagsJson: string[];
  waveOrder: number;
} {
  const canonicalTopicKey = mapLegacyVocabTopicTag(card.topicTag);
  const len = card.headword.length;
  const cefrLevel: 'B1' | 'B2' | 'C1' | 'C2' =
    len <= 7 && index % 3 === 0 ? 'B1' : len >= 12 ? 'C1' : 'B2';
  const bandTarget = cefrLevel === 'B1' ? 5.5 : cefrLevel === 'C1' ? 7.5 : 6.5;

  const weaknessTagsJson: string[] = [];
  if (card.topicTag === 'academic_linking') {
    weaknessTagsJson.push('writing:cohesion_linkers');
  } else if (card.topicTag === 'reading_synonyms') {
    weaknessTagsJson.push('reading:paraphrase_matching');
  } else {
    weaknessTagsJson.push('vocab:academic_collocation');
  }

  return {
    canonicalTopicKey,
    cefrLevel,
    bandTarget,
    weaknessTagsJson,
    waveOrder: index + 1,
  };
}

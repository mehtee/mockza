export type CanonicalTopicKey =
  | 'technology_ai'
  | 'career_workplace'
  | 'travel_culture'
  | 'health_sports'
  | 'science_climate'
  | 'arts_media'
  | 'business_finance'
  | 'education_campus'
  | 'urban_society'
  | 'academic_core';

export {
  CANONICAL_TOPICS,
  getTopicLabel,
  mapLegacyVocabTopicTag,
  normalizeCanonicalTopicKey,
  normalizeFavoriteTopicList,
  TOPIC_METADATA,
  type TopicMeta,
} from './topic-taxonomy.impl.js';

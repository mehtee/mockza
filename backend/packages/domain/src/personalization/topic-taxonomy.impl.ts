import type { CanonicalTopicKey } from './topic-taxonomy.js';

export type { CanonicalTopicKey };

export interface TopicMeta {
  readonly key: CanonicalTopicKey;
  readonly labelEn: string;
  readonly labelFa: string;
  readonly onboardingKey: string;
}

export const CANONICAL_TOPICS: readonly CanonicalTopicKey[] = [
  'technology_ai',
  'career_workplace',
  'travel_culture',
  'health_sports',
  'science_climate',
  'arts_media',
  'business_finance',
  'education_campus',
  'urban_society',
  'academic_core',
] as const;

export const TOPIC_METADATA: Record<CanonicalTopicKey, TopicMeta> = {
  technology_ai: {
    key: 'technology_ai',
    labelEn: 'Technology & AI',
    labelFa: 'فناوری و هوش مصنوعی',
    onboardingKey: 'Technology & AI',
  },
  career_workplace: {
    key: 'career_workplace',
    labelEn: 'Career & Workplace',
    labelFa: 'کار و حرفه',
    onboardingKey: 'Career & Workplace',
  },
  travel_culture: {
    key: 'travel_culture',
    labelEn: 'Travel & Culture',
    labelFa: 'سفر و فرهنگ',
    onboardingKey: 'Travel & Culture',
  },
  health_sports: {
    key: 'health_sports',
    labelEn: 'Health & Sports',
    labelFa: 'سلامت و ورزش',
    onboardingKey: 'Health & Fitness',
  },
  science_climate: {
    key: 'science_climate',
    labelEn: 'Science & Climate',
    labelFa: 'علم و محیط زیست',
    onboardingKey: 'Science & Climate',
  },
  arts_media: {
    key: 'arts_media',
    labelEn: 'Cinema & Arts',
    labelFa: 'سینما و هنر',
    onboardingKey: 'Cinema & Arts',
  },
  business_finance: {
    key: 'business_finance',
    labelEn: 'Business & Finance',
    labelFa: 'کسب‌وکار و مالی',
    onboardingKey: 'Business & Finance',
  },
  education_campus: {
    key: 'education_campus',
    labelEn: 'Education & Research',
    labelFa: 'آموزش و دانشگاه',
    onboardingKey: 'Education & Research',
  },
  urban_society: {
    key: 'urban_society',
    labelEn: 'Cities & Society',
    labelFa: 'شهرسازی و جامعه',
    onboardingKey: 'Cities & Society',
  },
  academic_core: {
    key: 'academic_core',
    labelEn: 'Core Exam Language',
    labelFa: 'ساختارهای کلیدی آزمون',
    onboardingKey: 'Core Exam Language',
  },
};

export function normalizeCanonicalTopicKey(raw?: string | null): CanonicalTopicKey {
  const s = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^topic:/, '');
  if (!s) return 'academic_core';

  if ((CANONICAL_TOPICS as readonly string[]).includes(s)) {
    return s as CanonicalTopicKey;
  }
  if (
    s.includes('tech') ||
    s === 'technology' ||
    s.includes('ai') ||
    s.includes('هوش') ||
    s.includes('فناوری')
  ) {
    return 'technology_ai';
  }
  if (
    s.includes('career') ||
    s.includes('work') ||
    s.includes('job') ||
    s.includes('کار') ||
    s.includes('حرفه')
  ) {
    return 'career_workplace';
  }
  if (s.includes('travel') || s.includes('cultur') || s.includes('سفر') || s.includes('فرهنگ')) {
    return 'travel_culture';
  }
  if (
    s.includes('sport') ||
    s.includes('health') ||
    s.includes('fitness') ||
    s.includes('football') ||
    s.includes('سلامت') ||
    s.includes('ورزش') ||
    s.includes('فوتبال')
  ) {
    return 'health_sports';
  }
  if (
    s.includes('science') ||
    s.includes('climate') ||
    s.includes('environ') ||
    s.includes('علم') ||
    s.includes('محیط')
  ) {
    return 'science_climate';
  }
  if (
    s.includes('cinema') ||
    s.includes('art') ||
    s.includes('media') ||
    s.includes('سینما') ||
    s.includes('هنر')
  ) {
    return 'arts_media';
  }
  if (
    s.includes('business') ||
    s.includes('finance') ||
    s.includes('econ') ||
    s.includes('society_economics') ||
    s.includes('کسب') ||
    s.includes('مالی')
  ) {
    return 'business_finance';
  }
  if (
    s.includes('edu') ||
    s.includes('campus') ||
    s.includes('research') ||
    s.includes('آموزش') ||
    s.includes('دانشگاه')
  ) {
    return 'education_campus';
  }
  if (
    s.includes('urban') ||
    s.includes('city') ||
    s.includes('cities') ||
    s.includes('infra') ||
    s.includes('شهر') ||
    s.includes('جامعه')
  ) {
    return 'urban_society';
  }
  return 'academic_core';
}

export function mapLegacyVocabTopicTag(legacyTag: string): CanonicalTopicKey {
  const clean = legacyTag.trim().toLowerCase();
  switch (clean) {
    case 'technology':
      return 'technology_ai';
    case 'environment':
      return 'science_climate';
    case 'education':
      return 'education_campus';
    case 'society_economics':
      return 'business_finance';
    case 'urbanization':
      return 'urban_society';
    case 'academic_linking':
    case 'reading_synonyms':
    default:
      return 'academic_core';
  }
}

export function getTopicLabel(key: CanonicalTopicKey, edition: 'glb' | 'irn'): string {
  const meta = TOPIC_METADATA[key] ?? TOPIC_METADATA.academic_core;
  return edition === 'irn' ? meta.labelFa : meta.labelEn;
}

export function normalizeFavoriteTopicList(rawTopics: readonly string[]): CanonicalTopicKey[] {
  const seen = new Set<CanonicalTopicKey>();
  const out: CanonicalTopicKey[] = [];
  for (const raw of rawTopics) {
    const key = normalizeCanonicalTopicKey(raw);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

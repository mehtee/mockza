import {
  TOPIC_METADATA,
  getTopicLabel,
  normalizeCanonicalTopicKey,
  type CanonicalTopicKey,
  type SkillKind,
  type SupportedExamId,
} from '@mockza/domain';
import type { EditionCode } from '@/edition/edition-config';
import { translate } from '@/i18n';

const EXTRA_TOPIC_LABELS: Readonly<
  Record<string, { readonly en: string; readonly fa: string }>
> = {
  academic_linking: { en: 'Academic Cohesion', fa: 'انسجام و ربط آکادمیک' },
  reading_synonyms: { en: 'Reading Paraphrases', fa: 'مترادف‌های ریدینگ' },
  marine_biology: { en: 'Marine Biology', fa: 'زیست‌شناسی دریایی' },
  mistake_to_deck: { en: 'Saved Mistake', fa: 'از اشتباهات شما' },
  evaluation_upgrade: { en: 'Score Upgrade', fa: 'پیشنهاد ارتقای نمره' },
  register_shifter: { en: 'Speaking Upgrade', fa: 'ارتقای لحن گفتار' },
  drop_extract: { en: 'Personal Study', fa: 'محتوای شخصی' },
  drop_anything: { en: 'Personal Study', fa: 'محتوای شخصی' },
  seeded: { en: 'Core Academic', fa: 'واژه پایه آکادمیک' },
  writing_grammar: { en: 'Writing Grammar', fa: 'گرامر رایتینگ' },
  speaking_fluency: { en: 'Speaking Fluency', fa: 'روانی گفتار' },
};

export function formatTopicLabel(
  rawKey: string | null | undefined,
  edition: EditionCode,
): string {
  const trimmed = (rawKey ?? '').trim();
  if (!trimmed) {
    return getTopicLabel('academic_core', edition);
  }
  const lower = trimmed.toLowerCase();
  const extra = EXTRA_TOPIC_LABELS[lower];
  if (extra) {
    return edition === 'irn' ? extra.fa : extra.en;
  }
  if (Object.hasOwn(TOPIC_METADATA, lower)) {
    return getTopicLabel(lower as CanonicalTopicKey, edition);
  }
  const normalized = normalizeCanonicalTopicKey(trimmed);
  if (normalized !== 'academic_core' || lower === 'academic_core') {
    return getTopicLabel(normalized, edition);
  }
  return trimmed.replace(/_/g, ' ');
}

export function formatTrackLocalizedName(
  trackId: SupportedExamId,
  edition: EditionCode,
): string {
  switch (trackId) {
    case 'ielts_academic':
      return translate(edition, 'trackNameIeltsAcademic');
    case 'ielts_general':
      return translate(edition, 'trackNameIeltsGeneral');
    case 'toefl_ibt':
      return translate(edition, 'trackNameToeflIbt');
    case 'pte_academic':
      return translate(edition, 'trackNamePteAcademic');
    case 'det':
      return translate(edition, 'trackNameDet');
  }
}

export function formatTrackSubtitle(
  trackId: SupportedExamId,
  edition: EditionCode,
): string {
  switch (trackId) {
    case 'ielts_academic':
      return translate(edition, 'trackSubtitleIeltsAcademic');
    case 'ielts_general':
      return translate(edition, 'trackSubtitleIeltsGeneral');
    case 'toefl_ibt':
      return translate(edition, 'trackSubtitleToeflIbt');
    case 'pte_academic':
      return translate(edition, 'trackSubtitlePteAcademic');
    case 'det':
      return translate(edition, 'trackSubtitleDet');
  }
}

export function formatTrackFormatHint(
  trackId: SupportedExamId,
  edition: EditionCode,
): string {
  switch (trackId) {
    case 'ielts_academic':
      return translate(edition, 'trackFormatHintIeltsAcademic');
    case 'ielts_general':
      return translate(edition, 'trackFormatHintIeltsGeneral');
    case 'toefl_ibt':
      return translate(edition, 'trackFormatHintToeflIbt');
    case 'pte_academic':
      return translate(edition, 'trackFormatHintPteAcademic');
    case 'det':
      return translate(edition, 'trackFormatHintDet');
  }
}

export function formatSkillLabel(
  skill: SkillKind | 'fullMock' | string,
  edition: EditionCode,
): string {
  switch (skill) {
    case 'reading':
      return translate(edition, 'skillLabelReading');
    case 'listening':
      return translate(edition, 'skillLabelListening');
    case 'writing':
      return translate(edition, 'skillLabelWriting');
    case 'speaking':
      return translate(edition, 'skillLabelSpeaking');
    case 'fullMock':
      return translate(edition, 'skillLabelFullMock');
    default:
      return formatTopicLabel(skill, edition);
  }
}

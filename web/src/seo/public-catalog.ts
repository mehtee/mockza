import type { SupportedExamId } from '@mockza/domain';
import {
  GLB_EXAM_PILLARS,
  GLB_PUBLIC_COPY,
  type ExamPillarGuide,
  type ExamPillarSlug,
  type PublicSiteCopy,
} from './public-catalog-glb';
import { IRN_EXAM_PILLARS, IRN_PUBLIC_COPY } from './public-catalog-irn';

export type { ExamPillarFaqItem, ExamPillarGuide, ExamPillarSlug, PublicSiteCopy } from './public-catalog-glb';

export function getPublicSiteCopyForBuild(): PublicSiteCopy {
  if (import.meta.env.PUBLIC_EDITION === 'irn') {
    return IRN_PUBLIC_COPY;
  }
  return GLB_PUBLIC_COPY;
}

export function getExamPillarsForBuild(): readonly ExamPillarGuide[] {
  if (import.meta.env.PUBLIC_EDITION === 'irn') {
    return IRN_EXAM_PILLARS;
  }
  return GLB_EXAM_PILLARS;
}

export function getExamPillarBySlug(slug: string): ExamPillarGuide | undefined {
  return getExamPillarsForBuild().find((item) => item.slug === slug);
}

export function getExamSlugForTrack(examId: SupportedExamId): ExamPillarSlug {
  switch (examId) {
    case 'ielts_general':
      return 'ielts-general';
    case 'toefl_ibt':
      return 'toefl-ibt';
    case 'pte_academic':
      return 'pte-academic';
    case 'det':
      return 'duolingo-english-test';
    default:
      return 'ielts-academic';
  }
}

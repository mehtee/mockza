import { describe, expect, it } from 'vitest';
import { SUPPORTED_EXAM_IDS } from '@mockza/domain';
import { getExamSlugForTrack } from '@/seo/public-catalog';
import { GLB_EXAM_PILLARS } from '@/seo/public-catalog-glb';
import { IRN_EXAM_PILLARS } from '@/seo/public-catalog-irn';

describe('W7.1 Public Exam Pillar Catalog & Clean-Room Metadata', () => {
  it('covers all 5 supported exam tracks in both GLB and IRN catalogs', () => {
    expect(GLB_EXAM_PILLARS.length).toBe(5);
    expect(IRN_EXAM_PILLARS.length).toBe(5);

    for (const examId of SUPPORTED_EXAM_IDS) {
      const slug = getExamSlugForTrack(examId);
      expect(GLB_EXAM_PILLARS.some((p) => p.examId === examId && p.slug === slug)).toBe(true);
      expect(IRN_EXAM_PILLARS.some((p) => p.examId === examId && p.slug === slug)).toBe(true);
    }
  });

  it('keeps GLB catalog completely isolated from IRN brand identifiers', () => {
    const serialized = JSON.stringify(GLB_EXAM_PILLARS).toLowerCase();
    expect(serialized).not.toContain('sanjia');
    expect(serialized).not.toContain('zarinpal');
    expect(serialized).not.toContain('navia');
  });
});

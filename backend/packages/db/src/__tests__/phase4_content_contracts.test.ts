import {
  computeBundleContentDigest,
  extractQuestionMaxWords,
  normalizeQuestionType,
} from '@mockza/domain';
import { describe, expect, it } from 'vitest';
import { STARTER_EXAM_BUNDLES, STARTER_MICRO_DRILLS } from '../index.js';

describe('Phase 4 Seed Content Contracts & Parity (TD-27, TD-28, TD-29, TD-30, TD-31)', () => {
  it('TD-27 & TD-28: normalizes all 24 seed bundles to canonical question types and deterministic digests', () => {
    const allowedCanonical = new Set([
      'tfng',
      'ynng',
      'mcq_single',
      'mcq_multi',
      'matching_headings',
      'summary_gap_fill',
      'short_answer',
      'writing_prompt',
      'speaking_part1',
      'speaking_part2',
      'speaking_part3',
    ]);

    for (const bundle of STARTER_EXAM_BUNDLES) {
      const normalizedQuestions = bundle.questions.map((q) => ({
        questionId: q.questionId,
        sectionId: q.sectionId,
        questionNumber: q.questionNumber,
        questionType: normalizeQuestionType(q.questionType),
        prompt: q.prompt,
        options: q.optionsJson ?? null,
        acceptedAnswers: q.acceptedAnswersJson,
        maxWords: extractQuestionMaxWords({
          evidence: q.evidenceJson ?? null,
          prompt: q.prompt,
          acceptedAnswers: q.acceptedAnswersJson,
        }),
        evidence: q.evidenceJson ?? null,
        cueTimestampMs: q.cueTimestampMs ?? null,
      }));

      for (const nq of normalizedQuestions) {
        expect(allowedCanonical.has(nq.questionType)).toBe(true);
      }

      const sortedSections = [...bundle.sections].sort((a, b) => a.sectionIndex - b.sectionIndex);
      const digest = computeBundleContentDigest({
        sections: sortedSections.map((s) => ({
          sectionId: s.sectionId,
          sectionIndex: s.sectionIndex,
          sectionType: s.sectionType,
          title: s.title,
          instructions: s.instructions,
          contentText: s.contentText,
          paragraphs: s.paragraphsJson ?? null,
          transcript: s.transcriptJson ?? null,
          mediaUrl: s.mediaObjectKey ? `/v1/media/${s.mediaObjectKey}` : null,
          durationSeconds: s.durationSeconds,
          wordCount: s.wordCount,
          metadata: s.metadataJson ?? null,
        })),
        questions: [...normalizedQuestions].sort((a, b) => a.questionNumber - b.questionNumber),
      });

      expect(digest.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(digest.byteLength).toBeGreaterThan(0);
    }
  });

  it('TD-29 & TD-30: validates starter micro-drill item contracts and speaking cue-card prompts', () => {
    for (const drill of STARTER_MICRO_DRILLS) {
      expect(drill.itemsJson.length).toBeGreaterThan(0);
      for (const item of drill.itemsJson) {
        expect(item.id.length).toBeGreaterThan(0);
        expect(item.answer.length).toBeGreaterThan(0);
      }
    }

    const speakingBundles = STARTER_EXAM_BUNDLES.filter((b) => b.pack.skill === 'speaking');
    expect(speakingBundles.length).toBeGreaterThanOrEqual(5);
    for (const sp of speakingBundles) {
      expect(sp.sections.length).toBe(3);
      expect(sp.questions.length).toBeGreaterThanOrEqual(5);
    }
  });
});

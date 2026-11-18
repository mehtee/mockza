import { describe, expect, it } from 'vitest';
import {
  API_ERROR_CODES,
  computeExamOverallFromCriteria,
  computeOverallBandFromCriteria,
  computeOverallWritingBand,
  EXAM_SCALES,
  estimateToeflLegacy120,
  evaluateQuotaEligibility,
  extractQuestionMaxWords,
  getExamRubricSpec,
  normalizeQuestionType,
  normalizeSupportedExamId,
  quantizeExamScore,
  roundIeltsBand,
  scoreFromNormalizedQuality,
} from '../index.js';

describe('@mockza/domain rubrics & quota', () => {
  it('rounds IELTS criterion average to nearest 0.5 band', () => {
    expect(roundIeltsBand(6.25)).toBe(6.5);
    expect(roundIeltsBand(6.75)).toBe(7);
    expect(computeOverallBandFromCriteria([7, 7, 6.5, 6.5])).toBe(7);
  });

  it('weights IELTS Task 2 by 2x for overall writing band', () => {
    // Task 1 = 6.0, Task 2 = 7.0 -> (6 + 2*7)/3 = 20/3 = 6.666 -> rounds to 6.5
    expect(computeOverallWritingBand(6.0, 7.0)).toBe(6.5);
    // Task 1 = 6.0, Task 2 = 7.5 -> (6 + 2*7.5)/3 = 21/3 = 7.0
    expect(computeOverallWritingBand(6.0, 7.5)).toBe(7.0);
    // Task 1 = 8.0, Task 2 = 6.0 -> (8 + 12)/3 = 6.666 -> rounds to 6.5
    expect(computeOverallWritingBand(8.0, 6.0)).toBe(6.5);
  });

  it('enforces Free tier = 1 lifetime diagnostic evaluation across speaking or writing', () => {
    // Unused diagnostic
    const firstCheck = evaluateQuotaEligibility({
      isPro: false,
      freeDiagnosticUsed: false,
      speakingUsedToday: 0,
      writingUsedToday: 0,
      monthlyUsed: 0,
      skill: 'speaking',
    });
    expect(firstCheck.allowed).toBe(true);
    expect(firstCheck.isDiagnostic).toBe(true);

    // After diagnostic is used, Free tier is blocked
    const secondCheck = evaluateQuotaEligibility({
      isPro: false,
      freeDiagnosticUsed: true,
      speakingUsedToday: 1,
      writingUsedToday: 0,
      monthlyUsed: 1,
      skill: 'writing',
    });
    expect(secondCheck.allowed).toBe(false);
    expect(secondCheck.reason).toBe('diagnostic_already_used');
  });

  it('enforces Pro tier = 10 speaking + 10 writing per UTC day and 150 monthly cap', () => {
    // 9 speaking used today -> allowed
    const canSpeak = evaluateQuotaEligibility({
      isPro: true,
      freeDiagnosticUsed: true,
      speakingUsedToday: 9,
      writingUsedToday: 2,
      monthlyUsed: 50,
      skill: 'speaking',
    });
    expect(canSpeak.allowed).toBe(true);
    expect(canSpeak.dailySpeakingRemaining).toBe(1);

    // 10 speaking used today -> speaking blocked
    const speakLimitReached = evaluateQuotaEligibility({
      isPro: true,
      freeDiagnosticUsed: true,
      speakingUsedToday: 10,
      writingUsedToday: 2,
      monthlyUsed: 50,
      skill: 'speaking',
    });
    expect(speakLimitReached.allowed).toBe(false);
    expect(speakLimitReached.reason).toBe('daily_speaking_quota_exceeded');

    // writing still allowed if under 10
    const writeStillAllowed = evaluateQuotaEligibility({
      isPro: true,
      freeDiagnosticUsed: true,
      speakingUsedToday: 10,
      writingUsedToday: 2,
      monthlyUsed: 50,
      skill: 'writing',
    });
    expect(writeStillAllowed.allowed).toBe(true);
    expect(writeStillAllowed.dailyWritingRemaining).toBe(8);

    // monthly 150 reached -> both blocked
    const monthCapReached = evaluateQuotaEligibility({
      isPro: true,
      freeDiagnosticUsed: true,
      speakingUsedToday: 1,
      writingUsedToday: 1,
      monthlyUsed: 150,
      skill: 'writing',
    });
    expect(monthCapReached.allowed).toBe(false);
    expect(monthCapReached.reason).toBe('monthly_quota_exceeded');
  });

  it('standardizes domain error codes', () => {
    expect(API_ERROR_CODES.VALIDATION_ERROR).toBe('validation_error');
    expect(API_ERROR_CODES.UNAUTHORIZED).toBe('unauthorized');
    expect(API_ERROR_CODES.QUOTA_EXCEEDED).toBe('quota_exceeded');
    expect(API_ERROR_CODES.ENTITLEMENT_REQUIRED).toBe('entitlement_required');
    expect(API_ERROR_CODES.ATTEMPT_CONFLICT).toBe('attempt_conflict');
  });

  it('normalizes supported exam IDs and quantizes scores per official scale', () => {
    expect(normalizeSupportedExamId('toefl')).toBe('toefl_ibt');
    expect(normalizeSupportedExamId('pte-academic')).toBe('pte_academic');
    expect(normalizeSupportedExamId('duolingo')).toBe('det');
    expect(normalizeSupportedExamId('general')).toBe('ielts_general');
    expect(normalizeSupportedExamId(undefined)).toBe('ielts_academic');

    expect(EXAM_SCALES.toefl_ibt.min).toBe(1);
    expect(EXAM_SCALES.toefl_ibt.max).toBe(6);
    expect(EXAM_SCALES.toefl_ibt.step).toBe(0.5);

    expect(quantizeExamScore(4.74, 'toefl_ibt')).toBe(4.5);
    expect(quantizeExamScore(4.76, 'toefl_ibt')).toBe(5);
    expect(quantizeExamScore(0, 'toefl_ibt')).toBe(1);
    expect(quantizeExamScore(7.2, 'toefl_ibt')).toBe(6);

    expect(quantizeExamScore(66.6, 'pte_academic')).toBe(67);
    expect(quantizeExamScore(4, 'pte_academic')).toBe(10);

    expect(quantizeExamScore(127.4, 'det')).toBe(125);
    expect(quantizeExamScore(128, 'det')).toBe(130);
    expect(quantizeExamScore(165, 'det')).toBe(160);

    expect(estimateToeflLegacy120(5.0)).toBe(100);
    expect(estimateToeflLegacy120(6.0)).toBe(117);
    expect(scoreFromNormalizedQuality(0.5, 'toefl_ibt')).toBe(3.5);
    expect(computeExamOverallFromCriteria([5, 5.5, 5, 4.5], 'toefl_ibt')).toBe(5);
    expect(computeExamOverallFromCriteria([71, 69, 73, 72], 'pte_academic')).toBe(71);
    expect(computeExamOverallFromCriteria([120, 125, 130, 120], 'det')).toBe(125);
  });

  it('builds exam-aware writing & speaking rubric specs and canonical question types', () => {
    const pteSwt = getExamRubricSpec('pte_academic', 'writing', 'pteSummarizeWrittenText');
    expect(pteSwt.criteria.map((c) => c.code)).toEqual(['CONTENT', 'MECH', 'VOCAB', 'GRAM']);
    expect(pteSwt.minRecommendedWords).toBe(5);
    expect(pteSwt.maxRecommendedWords).toBe(75);

    const toeflSpeak = getExamRubricSpec('toefl_ibt', 'speaking');
    expect(toeflSpeak.scale.max).toBe(6);
    expect(toeflSpeak.criteria.map((c) => c.code)).toEqual([
      'DELIVERY',
      'VOCAB',
      'GRAM',
      'CONTENT',
    ]);

    const detWrite = getExamRubricSpec('det', 'writing', 'detWriteAboutPhoto');
    expect(detWrite.scale.max).toBe(160);
    expect(detWrite.scale.step).toBe(5);

    expect(normalizeQuestionType('binary_choice')).toBe('binary_choice');
    expect(normalizeQuestionType('word_completion')).toBe('word_completion');
    expect(normalizeQuestionType('reorder_sequence')).toBe('reorder_sequence');
    expect(normalizeQuestionType('dictation')).toBe('dictation');
    expect(normalizeQuestionType('speaking_part4')).toBe('speaking_part4');
    expect(extractQuestionMaxWords({ questionType: 'dictation' })).toBe(25);
  });
});

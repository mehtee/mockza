import { describe, expect, it } from 'vitest';
import {
  API_ERROR_CODES,
  computeOverallBandFromCriteria,
  computeOverallWritingBand,
  evaluateQuotaEligibility,
  roundIeltsBand,
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
});

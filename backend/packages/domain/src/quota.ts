/** Quota allocation matrix according to PDR.md Sec. 10 & ADR-007. */
export const FREE_LIFETIME_DIAGNOSTIC_QUOTA = 1;
export const FREE_DAILY_VOCAB_REVIEWS = 20;

export const PRO_DAILY_SPEAKING_QUOTA = 10;
export const PRO_DAILY_WRITING_QUOTA = 10;
export const PRO_MONTHLY_TOTAL_QUOTA = 150;

export interface QuotaEligibilityParams {
  isPro: boolean;
  freeDiagnosticUsed: boolean;
  speakingUsedToday: number;
  writingUsedToday: number;
  monthlyUsed: number;
  skill: 'speaking' | 'writing';
  now?: Date;
}

export interface QuotaEligibilityResult {
  allowed: boolean;
  isDiagnostic: boolean;
  reason?:
    | 'diagnostic_already_used'
    | 'daily_speaking_quota_exceeded'
    | 'daily_writing_quota_exceeded'
    | 'monthly_quota_exceeded';
  dailySpeakingRemaining: number;
  dailyWritingRemaining: number;
  monthlyRemaining: number;
  dailySpeakingLimit: number;
  dailyWritingLimit: number;
  monthlyLimit: number;
  dailyResetAt: string;
  monthlyResetAt: string;
}

/** Calculates next UTC midnight ISO string. */
export function getNextUtcDayReset(now: Date = new Date()): string {
  const nextDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return nextDay.toISOString();
}

/** Calculates next UTC 1st-of-month midnight ISO string. */
export function getNextUtcMonthReset(now: Date = new Date()): string {
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return nextMonth.toISOString();
}

/** Evaluates quota eligibility and returns detailed remaining counts and limits. */
export function evaluateQuotaEligibility(params: QuotaEligibilityParams): QuotaEligibilityResult {
  const now = params.now ?? new Date();
  const dailyResetAt = getNextUtcDayReset(now);
  const monthlyResetAt = getNextUtcMonthReset(now);

  if (!params.isPro) {
    // Free tier: exactly 1 lifetime diagnostic evaluation across speaking OR writing
    const allowed = !params.freeDiagnosticUsed;
    return {
      allowed,
      isDiagnostic: allowed,
      reason: allowed ? undefined : 'diagnostic_already_used',
      dailySpeakingRemaining: allowed && params.skill === 'speaking' ? 1 : 0,
      dailyWritingRemaining: allowed && params.skill === 'writing' ? 1 : 0,
      monthlyRemaining: allowed ? 1 : 0,
      dailySpeakingLimit: 1,
      dailyWritingLimit: 1,
      monthlyLimit: 1,
      dailyResetAt,
      monthlyResetAt,
    };
  }

  // Pro tier checks
  const dailySpeakingRemaining = Math.max(0, PRO_DAILY_SPEAKING_QUOTA - params.speakingUsedToday);
  const dailyWritingRemaining = Math.max(0, PRO_DAILY_WRITING_QUOTA - params.writingUsedToday);
  const monthlyRemaining = Math.max(0, PRO_MONTHLY_TOTAL_QUOTA - params.monthlyUsed);

  if (monthlyRemaining <= 0) {
    return {
      allowed: false,
      isDiagnostic: false,
      reason: 'monthly_quota_exceeded',
      dailySpeakingRemaining,
      dailyWritingRemaining,
      monthlyRemaining: 0,
      dailySpeakingLimit: PRO_DAILY_SPEAKING_QUOTA,
      dailyWritingLimit: PRO_DAILY_WRITING_QUOTA,
      monthlyLimit: PRO_MONTHLY_TOTAL_QUOTA,
      dailyResetAt,
      monthlyResetAt,
    };
  }

  if (params.skill === 'speaking' && dailySpeakingRemaining <= 0) {
    return {
      allowed: false,
      isDiagnostic: false,
      reason: 'daily_speaking_quota_exceeded',
      dailySpeakingRemaining: 0,
      dailyWritingRemaining,
      monthlyRemaining,
      dailySpeakingLimit: PRO_DAILY_SPEAKING_QUOTA,
      dailyWritingLimit: PRO_DAILY_WRITING_QUOTA,
      monthlyLimit: PRO_MONTHLY_TOTAL_QUOTA,
      dailyResetAt,
      monthlyResetAt,
    };
  }

  if (params.skill === 'writing' && dailyWritingRemaining <= 0) {
    return {
      allowed: false,
      isDiagnostic: false,
      reason: 'daily_writing_quota_exceeded',
      dailySpeakingRemaining,
      dailyWritingRemaining: 0,
      monthlyRemaining,
      dailySpeakingLimit: PRO_DAILY_SPEAKING_QUOTA,
      dailyWritingLimit: PRO_DAILY_WRITING_QUOTA,
      monthlyLimit: PRO_MONTHLY_TOTAL_QUOTA,
      dailyResetAt,
      monthlyResetAt,
    };
  }

  return {
    allowed: true,
    isDiagnostic: false,
    dailySpeakingRemaining,
    dailyWritingRemaining,
    monthlyRemaining,
    dailySpeakingLimit: PRO_DAILY_SPEAKING_QUOTA,
    dailyWritingLimit: PRO_DAILY_WRITING_QUOTA,
    monthlyLimit: PRO_MONTHLY_TOTAL_QUOTA,
    dailyResetAt,
    monthlyResetAt,
  };
}

/** Legacy helper wrapping evaluateQuotaEligibility for simple boolean checks. */
export function hasRemainingQuota(params: {
  usedToday: number;
  skill: 'speaking' | 'writing';
  isPro: boolean;
  freeDiagnosticUsed?: boolean;
  monthlyUsed?: number;
}): boolean {
  return evaluateQuotaEligibility({
    isPro: params.isPro,
    freeDiagnosticUsed: params.freeDiagnosticUsed ?? false,
    speakingUsedToday: params.skill === 'speaking' ? params.usedToday : 0,
    writingUsedToday: params.skill === 'writing' ? params.usedToday : 0,
    monthlyUsed: params.monthlyUsed ?? 0,
    skill: params.skill,
  }).allowed;
}

export const PRO_DAILY_SHIFTER_QUOTA = 5;
export const PRO_DAILY_DROP_QUOTA = 5;
export const PRO_DAILY_DROP_AUDIO_QUOTA = 3;

export type AdvancedQuotaFeature = 'register_shifter' | 'drop_text_image' | 'drop_audio';

export interface AdvancedQuotaParams {
  feature: AdvancedQuotaFeature;
  isPro: boolean;
  freeSampleUsed: boolean;
  speakingUsedToday: number;
  shifterUsedToday: number;
  dropsUsedToday: number;
  audioDropsUsedToday: number;
  monthlyUsed: number;
  edition: 'glb' | 'irn';
}

export interface AdvancedQuotaResult {
  allowed: boolean;
  reason?:
    | 'free_sample_used'
    | 'pro_required_for_audio_drop'
    | 'daily_shifter_quota_exceeded'
    | 'daily_speaking_quota_exceeded'
    | 'daily_drop_quota_exceeded'
    | 'daily_audio_drop_quota_exceeded'
    | 'monthly_quota_exceeded';
  shifterRemaining: number;
  dropsRemaining: number;
  monthlyRemaining: number;
}

/**
 * Evaluates Register Shifter & Drop Anything allowances preserving 10+10/day
 * and 150/mo (GLB) / 120/mo (IRN) unit-economics ceilings (advanced_plan.md Sec. 2.5).
 */
export function evaluateAdvancedFeatureQuota(
  params: AdvancedQuotaParams,
): AdvancedQuotaResult {
  const monthlyCap = params.edition === 'irn' ? 120 : PRO_MONTHLY_TOTAL_QUOTA;
  const monthlyRemaining = Math.max(0, monthlyCap - params.monthlyUsed);

  if (!params.isPro) {
    if (params.feature === 'drop_audio') {
      return {
        allowed: false,
        reason: 'pro_required_for_audio_drop',
        shifterRemaining: 0,
        dropsRemaining: 0,
        monthlyRemaining: 0,
      };
    }
    const allowed = !params.freeSampleUsed;
    return {
      allowed,
      reason: allowed ? undefined : 'free_sample_used',
      shifterRemaining: params.feature === 'register_shifter' && allowed ? 1 : 0,
      dropsRemaining: params.feature === 'drop_text_image' && allowed ? 1 : 0,
      monthlyRemaining: allowed ? 1 : 0,
    };
  }

  const shifterRemaining = Math.max(
    0,
    Math.min(
      PRO_DAILY_SHIFTER_QUOTA - params.shifterUsedToday,
      PRO_DAILY_SPEAKING_QUOTA - params.speakingUsedToday,
    ),
  );
  const dropsRemaining = Math.max(0, PRO_DAILY_DROP_QUOTA - params.dropsUsedToday);

  if (monthlyRemaining <= 0) {
    return {
      allowed: false,
      reason: 'monthly_quota_exceeded',
      shifterRemaining,
      dropsRemaining,
      monthlyRemaining: 0,
    };
  }

  if (params.feature === 'register_shifter') {
    if (params.speakingUsedToday >= PRO_DAILY_SPEAKING_QUOTA) {
      return {
        allowed: false,
        reason: 'daily_speaking_quota_exceeded',
        shifterRemaining: 0,
        dropsRemaining,
        monthlyRemaining,
      };
    }
    if (params.shifterUsedToday >= PRO_DAILY_SHIFTER_QUOTA) {
      return {
        allowed: false,
        reason: 'daily_shifter_quota_exceeded',
        shifterRemaining: 0,
        dropsRemaining,
        monthlyRemaining,
      };
    }
    return {
      allowed: true,
      shifterRemaining,
      dropsRemaining,
      monthlyRemaining,
    };
  }

  if (params.dropsUsedToday >= PRO_DAILY_DROP_QUOTA) {
    return {
      allowed: false,
      reason: 'daily_drop_quota_exceeded',
      shifterRemaining,
      dropsRemaining: 0,
      monthlyRemaining,
    };
  }

  if (params.feature === 'drop_audio') {
    if (params.speakingUsedToday >= PRO_DAILY_SPEAKING_QUOTA) {
      return {
        allowed: false,
        reason: 'daily_speaking_quota_exceeded',
        shifterRemaining,
        dropsRemaining,
        monthlyRemaining,
      };
    }
    if (params.audioDropsUsedToday >= PRO_DAILY_DROP_AUDIO_QUOTA) {
      return {
        allowed: false,
        reason: 'daily_audio_drop_quota_exceeded',
        shifterRemaining,
        dropsRemaining,
        monthlyRemaining,
      };
    }
  }

  return {
    allowed: true,
    shifterRemaining,
    dropsRemaining,
    monthlyRemaining,
  };
}

export const FREE_DAILY_PRONUNCIATION_QUOTA = 5;
export const PRO_DAILY_PRONUNCIATION_QUOTA = 30;

export function evaluatePronunciationQuota(params: {
  isPro: boolean;
  usedToday: number;
}): { allowed: boolean; limit: number; remaining: number } {
  const limit = params.isPro ? PRO_DAILY_PRONUNCIATION_QUOTA : FREE_DAILY_PRONUNCIATION_QUOTA;
  const remaining = Math.max(0, limit - Math.max(0, params.usedToday));
  return {
    allowed: remaining > 0,
    limit,
    remaining,
  };
}

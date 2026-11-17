import {
  AUTHORING_TIERS,
  type AuthoringTier,
  type BlockAttemptRecord,
  type DiagnosticBlockDef,
  type DiagnosticQuestionDef,
  type DiagnosticStopReason,
  type NextBlockSelectionResult,
  type NoEvidenceReason,
  type ObjectivePlacementResult,
  type RoutingCategory,
} from './types.js';

export const DIAGNOSTIC_POLICY_VERSION = '2026-11-17.v1';

export const STANDARD_DIAGNOSTIC_BUDGET_SECONDS = {
  intro: 45,
  reading: 120,
  listening: 120,
  writing: 135,
  speaking: 105,
  transitions: 15,
  collectionTotal: 540,
  resultsWindow: 60,
  total: 600,
} as const;

export const DIAGNOSTIC_STAGE_LIMITS = {
  reading: { targetValidBlocks: 3, maxPresentedBlocks: 4 },
  listening: { targetValidBlocks: 3, maxPresentedBlocks: 3 },
} as const;

export function tierToIndex(tier: AuthoringTier): number {
  return AUTHORING_TIERS.indexOf(tier);
}

export function indexToTier(index: number): AuthoringTier {
  const clamped = Math.max(0, Math.min(AUTHORING_TIERS.length - 1, index));
  return AUTHORING_TIERS[clamped] ?? 'B1';
}

export function deterministicSeedHash(seed: string, candidateId: string): number {
  const input = `${seed}:${candidateId}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function classifyBlockOutcome(params: {
  questions: readonly DiagnosticQuestionDef[];
  selectedOptionIndices: ReadonlyArray<number | null>;
  noEvidenceReason?: NoEvidenceReason;
}): { category: RoutingCategory; correctCount: number; noEvidenceReason?: NoEvidenceReason } {
  if (params.noEvidenceReason) {
    return {
      category: 'no_evidence',
      correctCount: 0,
      noEvidenceReason: params.noEvidenceReason,
    };
  }

  const s0 = params.selectedOptionIndices[0] ?? null;
  const s1 = params.selectedOptionIndices[1] ?? null;
  if (s0 === null || s1 === null) {
    return {
      category: 'no_evidence',
      correctCount: 0,
      noEvidenceReason: 'empty_timeout',
    };
  }

  let correctCount = 0;
  if (s0 === params.questions[0]?.correctIndex) correctCount += 1;
  if (s1 === params.questions[1]?.correctIndex) correctCount += 1;

  const category: RoutingCategory =
    correctCount >= 2 ? 'strong' : correctCount === 1 ? 'mixed' : 'low';
  return { category, correctCount };
}

function summarizeHistory(history: readonly BlockAttemptRecord[]): {
  validCount: number;
  strongIndices: number[];
  lowIndices: number[];
  hasContradiction: boolean;
  lowestConflictingLowIdx: number | null;
  consecutiveDirectionCount: number;
  evidenceCheckTriggered: boolean;
} {
  let validCount = 0;
  const strongIndices: number[] = [];
  const lowIndices: number[] = [];
  let streakType: 'strong' | 'low' | null = null;
  let streakLen = 0;

  for (const item of history) {
    if (item.category === 'no_evidence') {
      streakType = null;
      streakLen = 0;
      continue;
    }
    validCount += 1;
    const idx = tierToIndex(item.tier);
    if (item.category === 'strong') {
      strongIndices.push(idx);
      streakLen = streakType === 'strong' ? streakLen + 1 : 1;
      streakType = 'strong';
    } else if (item.category === 'low') {
      lowIndices.push(idx);
      streakLen = streakType === 'low' ? streakLen + 1 : 1;
      streakType = 'low';
    } else {
      streakType = null;
      streakLen = 0;
    }
  }

  const maxStrong = strongIndices.length > 0 ? Math.max(...strongIndices) : null;
  const minLow = lowIndices.length > 0 ? Math.min(...lowIndices) : null;
  const hasContradiction = maxStrong !== null && minLow !== null && maxStrong > minLow;
  const lowestConflictingLowIdx = hasContradiction ? minLow : null;

  return {
    validCount,
    strongIndices,
    lowIndices,
    hasContradiction,
    lowestConflictingLowIdx,
    consecutiveDirectionCount: streakLen,
    evidenceCheckTriggered: streakLen >= 2,
  };
}

function pickUnusedBlock(params: {
  bank: readonly DiagnosticBlockDef[];
  usedIds: ReadonlySet<string>;
  targetTier: AuthoringTier;
  selectionSeed: string;
}): DiagnosticBlockDef | undefined {
  const candidates = params.bank
    .filter((b) => b.tier === params.targetTier && !params.usedIds.has(b.blockId))
    .sort((a, b) => {
      const ha = deterministicSeedHash(params.selectionSeed, a.blockId);
      const hb = deterministicSeedHash(params.selectionSeed, b.blockId);
      return ha !== hb ? ha - hb : a.blockId.localeCompare(b.blockId);
    });
  return candidates[0];
}

function needsFourthReadingInvestigation(
  history: readonly BlockAttemptRecord[],
  summary: ReturnType<typeof summarizeHistory>,
): boolean {
  if (summary.hasContradiction) return true;
  const validRecords = history.filter((h) => h.category !== 'no_evidence');
  const lastValid = validRecords[validRecords.length - 1];
  if (lastValid?.category === 'mixed') return true;
  const allLow = validRecords.length > 0 && validRecords.every((r) => r.category === 'low');
  if (allLow && summary.lowIndices.length > 0 && Math.min(...summary.lowIndices) > 0) {
    return true;
  }
  return false;
}

/**
 * Pure deterministic objective-task router matching RAPID_DIAGNOSTIC_PLAN.md Sec. 5.
 * Ordering strictly enforces:
 * 1) Global expiry -> 2) Stage expiry -> 3) Sampling complete -> 4) Presentation cap
 * -> 5) Bank availability & timing fit check.
 */
export function selectNextObjectiveBlock(params: {
  skill: 'reading' | 'listening';
  bank: readonly DiagnosticBlockDef[];
  history: readonly BlockAttemptRecord[];
  remainingStageSeconds: number;
  remainingGlobalSeconds: number;
  selectionSeed: string;
  initialTier?: AuthoringTier;
  strictMode?: boolean;
}): NextBlockSelectionResult {
  const limits = DIAGNOSTIC_STAGE_LIMITS[params.skill];
  const strict = params.strictMode ?? true;
  const summary = summarizeHistory(params.history);
  const presentedCount = params.history.length;
  const reducedSampling = summary.validCount < limits.targetValidBlocks;

  const coincidentReasons: DiagnosticStopReason[] = [];
  if (strict && params.remainingGlobalSeconds <= 0) {
    coincidentReasons.push('global_timeout');
  }
  if (strict && params.remainingStageSeconds <= 0) {
    coincidentReasons.push('stage_timeout');
  }
  if (summary.validCount >= limits.targetValidBlocks) {
    coincidentReasons.push('sampling_complete');
  }
  if (presentedCount >= limits.maxPresentedBlocks) {
    coincidentReasons.push('presentation_limit');
  }

  // 1 & 2. Deadline precedence (Global > Stage)
  if (strict && params.remainingGlobalSeconds <= 0) {
    return {
      action: 'stop',
      stopReason: 'global_timeout',
      coincidentReasons,
      reducedSampling,
      hasContradictoryEvidence: summary.hasContradiction,
      consecutiveSameDirectionCount: summary.consecutiveDirectionCount,
      evidenceCheckTriggered: summary.evidenceCheckTriggered,
    };
  }
  if (strict && params.remainingStageSeconds <= 0) {
    return {
      action: 'stop',
      stopReason: 'stage_timeout',
      coincidentReasons,
      reducedSampling,
      hasContradictoryEvidence: summary.hasContradiction,
      consecutiveSameDirectionCount: summary.consecutiveDirectionCount,
      evidenceCheckTriggered: summary.evidenceCheckTriggered,
    };
  }

  // 3. Sampling completion target (3 valid blocks; Reading may take a 4th only to investigate unresolved cases)
  const allowExtraReadingInvestigation =
    params.skill === 'reading' &&
    presentedCount < limits.maxPresentedBlocks &&
    needsFourthReadingInvestigation(params.history, summary);

  if (summary.validCount >= limits.targetValidBlocks && !allowExtraReadingInvestigation) {
    return {
      action: 'stop',
      stopReason: 'sampling_complete',
      coincidentReasons,
      reducedSampling: false,
      hasContradictoryEvidence: summary.hasContradiction,
      consecutiveSameDirectionCount: summary.consecutiveDirectionCount,
      evidenceCheckTriggered: summary.evidenceCheckTriggered,
    };
  }

  // 4. Presentation cap
  if (presentedCount >= limits.maxPresentedBlocks) {
    return {
      action: 'stop',
      stopReason:
        summary.validCount >= limits.targetValidBlocks ? 'sampling_complete' : 'presentation_limit',
      coincidentReasons,
      reducedSampling,
      hasContradictoryEvidence: summary.hasContradiction,
      consecutiveSameDirectionCount: summary.consecutiveDirectionCount,
      evidenceCheckTriggered: summary.evidenceCheckTriggered,
    };
  }

  // 5. Select candidate tier per Section 5.1 rules
  const usedIds = new Set(params.history.map((h) => h.blockId));
  const startTier: AuthoringTier = params.initialTier ?? 'B1';
  const lastRecord = params.history[params.history.length - 1];
  const validRecords = params.history.filter((h) => h.category !== 'no_evidence');
  const lastValid = validRecords[validRecords.length - 1];

  let targetIdx = tierToIndex(startTier);
  let chosenBlock: DiagnosticBlockDef | undefined;

  if (!lastRecord) {
    targetIdx = tierToIndex(startTier);
  } else if (lastRecord.category === 'no_evidence') {
    if (lastRecord.noEvidenceReason === 'dont_know') {
      targetIdx = Math.max(0, tierToIndex(lastRecord.tier) - 1);
    } else {
      targetIdx = tierToIndex(lastRecord.tier);
    }
  } else if (lastValid) {
    const currentIdx = tierToIndex(lastValid.tier);
    if (lastValid.category === 'low') {
      // Rule 1: strictly below lowest failed tier seen so far (bounded at A1).
      const minLowIdx =
        summary.lowIndices.length > 0 ? Math.min(...summary.lowIndices) : currentIdx;
      targetIdx = minLowIdx > 0 ? minLowIdx - 1 : 0;
    } else if (lastValid.category === 'mixed') {
      // Rule 3: fresh same-tier block.
      targetIdx = currentIdx;
    } else if (lastValid.category === 'strong') {
      // Rule 4 takes precedence on contradiction: probe lowest conflicting low tier if unused block exists.
      if (summary.hasContradiction && summary.lowestConflictingLowIdx !== null) {
        const conflictTier = indexToTier(summary.lowestConflictingLowIdx);
        const conflictBlock = pickUnusedBlock({
          bank: params.bank,
          usedIds,
          targetTier: conflictTier,
          selectionSeed: params.selectionSeed,
        });
        if (conflictBlock) {
          targetIdx = summary.lowestConflictingLowIdx;
          chosenBlock = conflictBlock;
        }
      }

      if (!chosenBlock) {
        // Rule 2: check observed low tiers above currentIdx.
        const lowsAbove = summary.lowIndices.filter((i) => i > currentIdx);
        if (lowsAbove.length > 0) {
          const minLowAbove = Math.min(...lowsAbove);
          const untestedBetween: number[] = [];
          for (let i = currentIdx + 1; i < minLowAbove; i += 1) {
            const tier = indexToTier(i);
            const hasUnused = Boolean(
              pickUnusedBlock({
                bank: params.bank,
                usedIds,
                targetTier: tier,
                selectionSeed: params.selectionSeed,
              }),
            );
            const alreadyTested = validRecords.some((r) => tierToIndex(r.tier) === i);
            if (!alreadyTested && hasUnused) {
              untestedBetween.push(i);
            }
          }
          if (untestedBetween.length > 0) {
            targetIdx = untestedBetween[Math.floor(untestedBetween.length / 2)] ?? currentIdx;
          } else {
            // Confirm current successful tier with a fresh block.
            targetIdx = currentIdx;
          }
        } else {
          // Move one tier harder (bounded at C2); at C2 confirm with fresh C2 block.
          targetIdx = Math.min(AUTHORING_TIERS.length - 1, currentIdx + 1);
        }
      }
    }
  }

  const targetTier = indexToTier(targetIdx);
  chosenBlock =
    chosenBlock ??
    pickUnusedBlock({
      bank: params.bank,
      usedIds,
      targetTier,
      selectionSeed: params.selectionSeed,
    });

  if (!chosenBlock) {
    const fallbackCoincident = [...coincidentReasons, 'content_limit' as const];
    return {
      action: 'stop',
      targetTier,
      stopReason:
        summary.validCount >= limits.targetValidBlocks ? 'sampling_complete' : 'content_limit',
      coincidentReasons: fallbackCoincident,
      reducedSampling,
      hasContradictoryEvidence: summary.hasContradiction,
      consecutiveSameDirectionCount: summary.consecutiveDirectionCount,
      evidenceCheckTriggered: summary.evidenceCheckTriggered,
    };
  }

  // Timing fit check before presenting next block
  if (strict) {
    const bindingBudget = Math.min(params.remainingStageSeconds, params.remainingGlobalSeconds);
    if (chosenBlock.minRequiredSeconds > bindingBudget) {
      const stopReason: DiagnosticStopReason =
        params.remainingGlobalSeconds <= params.remainingStageSeconds
          ? 'global_timeout'
          : 'stage_timeout';
      return {
        action: 'stop',
        targetTier,
        stopReason:
          summary.validCount >= limits.targetValidBlocks ? 'sampling_complete' : stopReason,
        coincidentReasons: [...coincidentReasons, stopReason],
        reducedSampling,
        hasContradictoryEvidence: summary.hasContradiction,
        consecutiveSameDirectionCount: summary.consecutiveDirectionCount,
        evidenceCheckTriggered: summary.evidenceCheckTriggered,
      };
    }
  }

  return {
    action: 'present',
    block: chosenBlock,
    targetTier,
    coincidentReasons: [],
    reducedSampling,
    hasContradictoryEvidence: summary.hasContradiction,
    consecutiveSameDirectionCount: summary.consecutiveDirectionCount,
    evidenceCheckTriggered: summary.evidenceCheckTriggered,
  };
}

function broadBandLabelForTier(tier: AuthoringTier): string {
  switch (tier) {
    case 'A1':
    case 'A2':
      return 'Foundational';
    case 'B1':
    case 'B2':
      return 'Intermediate';
    case 'C1':
    case 'C2':
      return 'Upper-Intermediate to Advanced';
  }
}

/**
 * Produces broad provisional practice guidance from the full observed pattern of responses
 * without averaging ordinal CEFR labels or inventing numerical exam bands (Sec. 6.1).
 */
export function deriveObjectivePlacement(params: {
  skill: 'reading' | 'listening';
  history: readonly BlockAttemptRecord[];
  bank: readonly DiagnosticBlockDef[];
  stopReason: DiagnosticStopReason | null;
  skippedByUser?: boolean;
}): ObjectivePlacementResult {
  const limits = DIAGNOSTIC_STAGE_LIMITS[params.skill];
  const valid = params.history.filter((h) => h.category !== 'no_evidence');
  const summary = summarizeHistory(params.history);
  const reducedSampling = valid.length < limits.targetValidBlocks;

  if (params.skippedByUser) {
    return {
      skill: params.skill,
      status: 'skipped',
      suggestedPracticeLevel: null,
      suggestedTierRange: null,
      observations: [`This ${params.skill} check was skipped, so no placement estimate was made.`],
      weaknessFocus: null,
      reducedSampling: true,
      hasContradictoryEvidence: false,
      stopReason: params.stopReason,
      validBlockCount: valid.length,
      presentedBlockCount: params.history.length,
    };
  }

  if (valid.length === 0) {
    const hadPlaybackFail = params.history.some((h) => h.noEvidenceReason === 'playback_failed');
    return {
      skill: params.skill,
      status: 'insufficient_evidence',
      suggestedPracticeLevel: null,
      suggestedTierRange: null,
      observations: [
        hadPlaybackFail
          ? 'Audio playback was unavailable before usable evidence could be collected.'
          : 'Too few completed answers to suggest a practice level yet.',
      ],
      weaknessFocus: null,
      reducedSampling: true,
      hasContradictoryEvidence: false,
      stopReason: params.stopReason,
      validBlockCount: 0,
      presentedBlockCount: params.history.length,
    };
  }

  const blockById = new Map(params.bank.map((b) => [b.blockId, b] as const));
  const missedTags = new Map<string, number>();
  const strongTiers: AuthoringTier[] = [];
  const mixedTiers: AuthoringTier[] = [];
  const lowTiers: AuthoringTier[] = [];

  for (const item of valid) {
    if (item.category === 'strong') strongTiers.push(item.tier);
    if (item.category === 'mixed') mixedTiers.push(item.tier);
    if (item.category === 'low') lowTiers.push(item.tier);

    const def = blockById.get(item.blockId);
    if (def) {
      item.selectedOptionIndices.forEach((choice, qIdx) => {
        const q = def.questions[qIdx];
        if (q && choice !== null && choice !== q.correctIndex) {
          missedTags.set(q.focusTag, (missedTags.get(q.focusTag) ?? 0) + 1);
        }
      });
    }
  }

  let minTierIdx = 0;
  let maxTierIdx = 0;
  const highestStrongIdx =
    strongTiers.length > 0 ? Math.max(...strongTiers.map(tierToIndex)) : null;
  const highestMixedIdx = mixedTiers.length > 0 ? Math.max(...mixedTiers.map(tierToIndex)) : null;
  const lowestLowIdx = lowTiers.length > 0 ? Math.min(...lowTiers.map(tierToIndex)) : null;

  if (highestStrongIdx !== null && lowestLowIdx !== null) {
    if (highestStrongIdx < lowestLowIdx) {
      minTierIdx = highestStrongIdx;
      maxTierIdx = Math.max(highestStrongIdx, lowestLowIdx - 1);
    } else {
      // Contradictory range spans both strong and low evidence
      minTierIdx = Math.max(0, lowestLowIdx - 1);
      maxTierIdx = highestStrongIdx;
    }
  } else if (highestStrongIdx !== null) {
    minTierIdx = highestStrongIdx;
    maxTierIdx = Math.min(AUTHORING_TIERS.length - 1, highestStrongIdx + 1);
  } else if (highestMixedIdx !== null) {
    minTierIdx = Math.max(0, highestMixedIdx - 1);
    maxTierIdx = highestMixedIdx;
  } else if (lowestLowIdx !== null) {
    minTierIdx = 0;
    maxTierIdx = Math.max(0, lowestLowIdx - 1);
  }

  const minTier = indexToTier(minTierIdx);
  const maxTier = indexToTier(maxTierIdx);
  const bandLabel = broadBandLabelForTier(minTier === maxTier ? minTier : maxTier);
  const provisionalSuffix = reducedSampling ? 'provisional (reduced sampling)' : 'provisional';
  const suggestedPracticeLevel = `Suggested practice: ${bandLabel} (${minTier}–${maxTier} focus) — ${provisionalSuffix}`;

  const observations: string[] = [];
  if (strongTiers.length > 0) {
    observations.push(
      `Answered all questions accurately on ${[...new Set(strongTiers)].join(', ')}-oriented ${params.skill} tasks.`,
    );
  }
  if (lowTiers.length > 0) {
    observations.push(
      `Found ${[...new Set(lowTiers)].join(', ')}-oriented ${params.skill} tasks challenging.`,
    );
  } else if (mixedTiers.length > 0) {
    observations.push(
      `Showed partial accuracy on ${[...new Set(mixedTiers)].join(', ')}-oriented ${params.skill} tasks.`,
    );
  }
  if (summary.hasContradiction) {
    observations.push(
      'Responses across difficulty tiers were mixed; additional practice will sharpen placement.',
    );
  }
  if (reducedSampling && observations.length < 2) {
    observations.push('Collected fewer than three blocks within the time limit.');
  }

  const sortedMissed = [...missedTags.entries()].sort((a, b) => b[1] - a[1]);
  const weaknessFocus = sortedMissed[0]?.[0] ?? null;

  return {
    skill: params.skill,
    status: 'provisional',
    suggestedPracticeLevel,
    suggestedTierRange: { minTier, maxTier },
    observations: observations.slice(0, 2),
    weaknessFocus,
    reducedSampling,
    hasContradictoryEvidence: summary.hasContradiction,
    stopReason: params.stopReason,
    validBlockCount: valid.length,
    presentedBlockCount: params.history.length,
  };
}

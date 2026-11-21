export type LinguisticNodeKind = 'bottleneck' | 'target_structure' | 'interest_topic';

export type EvidencePolarity = 'gap_observed' | 'target_used' | 'interest_matched';

export interface LinguisticNodeSummary {
  nodeId: string;
  nodeKind: LinguisticNodeKind;
  canonicalKey: string;
  masteryScoreMilli: number;
  signalWeightMilli: number;
  evidenceCount: number;
  lastSeenDaySerial: number;
}

export interface RankedMissionTargets {
  bottlenecks: LinguisticNodeSummary[];
  targetStructures: LinguisticNodeSummary[];
  interestTopics: LinguisticNodeSummary[];
  suggestedCardIds: string[];
}

export interface Utf16SpanResult {
  startUtf16: number;
  endUtf16: number;
  excerpt: string;
}

export function clampMilli(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1000, Math.round(value)));
}

/** Unicode-safe canonical key slugifier preserving Persian (`fa-IR`), Arabic & Latin topic labels (`TD-CL-14`). */
export function slugifyTopicCanonicalKey(rawTopic: string): string {
  const trimmed = rawTopic.trim();
  const strippedPrefix = trimmed.startsWith('topic:') ? trimmed.slice('topic:'.length) : trimmed;
  const slug = strippedPrefix
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return `topic:${slug || 'general'}`;
}

/** Deterministic mastery EMA update bounded strictly to [0, 1000]. */
export function computeNextMasteryMilli(params: {
  currentMilli: number;
  polarity: EvidencePolarity;
  evidenceCount: number;
}): number {
  const current = clampMilli(params.currentMilli);
  const count = Math.max(0, Math.round(params.evidenceCount));

  switch (params.polarity) {
    case 'gap_observed': {
      const stepDown = Math.max(40, 140 - Math.min(count, 10) * 8);
      return clampMilli(current - stepDown);
    }
    case 'target_used': {
      const stepUp = Math.max(60, Math.round((1000 - current) * 0.25));
      return clampMilli(current + stepUp);
    }
    case 'interest_matched': {
      return clampMilli(current + 120);
    }
  }
}

/** Computes urgency-decayed priority score for mission planning (0..1000). */
export function computeNodePriorityScore(params: {
  node: Pick<
    LinguisticNodeSummary,
    'nodeKind' | 'masteryScoreMilli' | 'signalWeightMilli' | 'lastSeenDaySerial'
  >;
  currentDaySerial: number;
}): number {
  const ageDays = Math.max(0, params.currentDaySerial - params.node.lastSeenDaySerial);
  const decayFactor = 0.95 ** Math.min(ageDays, 60);
  const rawNeed =
    params.node.nodeKind === 'bottleneck'
      ? Math.max(100, 1000 - clampMilli(params.node.masteryScoreMilli))
      : clampMilli(params.node.signalWeightMilli);
  return clampMilli(rawNeed * decayFactor);
}

/** Ranks active bottlenecks, structures, and interest topics for Daily 10-Min Mission planning. */
export function rankTopMissionTargets(params: {
  nodes: readonly LinguisticNodeSummary[];
  dueCardIds: readonly string[];
  currentDaySerial: number;
  maxBottlenecks?: number;
  maxTargets?: number;
  maxInterests?: number;
  maxCards?: number;
}): RankedMissionTargets {
  const scoreFor = (node: LinguisticNodeSummary) =>
    computeNodePriorityScore({ node, currentDaySerial: params.currentDaySerial });

  const byPriorityDesc = (a: LinguisticNodeSummary, b: LinguisticNodeSummary) => {
    const diff = scoreFor(b) - scoreFor(a);
    if (diff !== 0) return diff;
    return a.canonicalKey.localeCompare(b.canonicalKey);
  };

  const bottlenecks = params.nodes
    .filter((n) => n.nodeKind === 'bottleneck')
    .sort(byPriorityDesc)
    .slice(0, params.maxBottlenecks ?? 2);

  const targetStructures = params.nodes
    .filter((n) => n.nodeKind === 'target_structure')
    .sort(byPriorityDesc)
    .slice(0, params.maxTargets ?? 2);

  const interestTopics = params.nodes
    .filter((n) => n.nodeKind === 'interest_topic')
    .sort(byPriorityDesc)
    .slice(0, params.maxInterests ?? 2);

  const suggestedCardIds = params.dueCardIds.slice(0, params.maxCards ?? 5);

  return {
    bottlenecks,
    targetStructures,
    interestTopics,
    suggestedCardIds,
  };
}

function isLowSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xdc00 && codeUnit <= 0xdfff;
}

/**
 * Normalizes extracted character span offsets cleanly onto valid UTF-16 code-unit
 * boundaries so highlighters never split surrogate pairs or slice out-of-bounds.
 */
export function normalizeUtf16Span(
  sourceText: string,
  rawStart: number,
  rawEnd: number,
): Utf16SpanResult {
  const len = sourceText.length;
  let start = Number.isFinite(rawStart) ? Math.max(0, Math.min(len, Math.trunc(rawStart))) : 0;
  let end = Number.isFinite(rawEnd) ? Math.max(start, Math.min(len, Math.trunc(rawEnd))) : start;

  if (start > 0 && start < len && isLowSurrogate(sourceText.charCodeAt(start))) {
    start -= 1;
  }
  if (end > start && end < len && isLowSurrogate(sourceText.charCodeAt(end))) {
    end = Math.min(len, end + 1);
  }

  return {
    startUtf16: start,
    endUtf16: end,
    excerpt: sourceText.slice(start, end),
  };
}

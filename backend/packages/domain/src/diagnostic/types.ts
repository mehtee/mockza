export const AUTHORING_TIERS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type AuthoringTier = (typeof AUTHORING_TIERS)[number];

export type DiagnosticSkill = 'reading' | 'listening' | 'writing' | 'speaking';

export type RoutingCategory = 'strong' | 'mixed' | 'low' | 'no_evidence';

export type NoEvidenceReason =
  | 'skipped'
  | 'dont_know'
  | 'playback_failed'
  | 'mic_denied'
  | 'empty_timeout'
  | 'unusable_audio';

export type DiagnosticStopReason =
  | 'sampling_complete'
  | 'stage_timeout'
  | 'global_timeout'
  | 'presentation_limit'
  | 'content_limit';

export type DiagnosticMode = 'standard' | 'extended' | 'accessible';

export type DiagnosticSkillStatus =
  | 'provisional'
  | 'pending'
  | 'insufficient_evidence'
  | 'unscorable'
  | 'failed'
  | 'skipped';

export interface DiagnosticQuestionDef {
  questionId: string;
  prompt: string;
  options: [string, string, string];
  correctIndex: 0 | 1 | 2;
  focusTag: string;
}

export interface DiagnosticBlockDef {
  blockId: string;
  skill: 'reading' | 'listening';
  tier: AuthoringTier;
  scenarioId: string;
  title: string;
  passageText?: string;
  scriptText?: string;
  mediaObjectKey?: string;
  durationSeconds?: number;
  minRequiredSeconds: number;
  questions: [DiagnosticQuestionDef, DiagnosticQuestionDef];
}

export interface BlockAttemptRecord {
  blockId: string;
  tier: AuthoringTier;
  category: RoutingCategory;
  selectedOptionIndices: Array<number | null>;
  correctCount: number;
  noEvidenceReason?: NoEvidenceReason;
  elapsedSeconds?: number;
}

export interface NextBlockSelectionResult {
  action: 'present' | 'stop';
  block?: DiagnosticBlockDef;
  targetTier?: AuthoringTier;
  stopReason?: DiagnosticStopReason;
  coincidentReasons: DiagnosticStopReason[];
  reducedSampling: boolean;
  hasContradictoryEvidence: boolean;
  consecutiveSameDirectionCount: number;
  evidenceCheckTriggered: boolean;
}

export interface ObjectivePlacementResult {
  skill: 'reading' | 'listening';
  status: DiagnosticSkillStatus;
  suggestedPracticeLevel: string | null;
  suggestedTierRange: { minTier: AuthoringTier; maxTier: AuthoringTier } | null;
  observations: string[];
  weaknessFocus: string | null;
  reducedSampling: boolean;
  hasContradictoryEvidence: boolean;
  stopReason: DiagnosticStopReason | null;
  validBlockCount: number;
  presentedBlockCount: number;
}

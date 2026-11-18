import {
  type BlockAttemptRecord,
  classifyBlockOutcome,
  DIAGNOSTIC_BUDGET_SECONDS,
  type DiagnosticBlockDef,
  type DiagnosticMode,
  type DiagnosticSkill,
  type DiagnosticStopReason,
  type NoEvidenceReason,
  selectNextObjectiveBlock,
} from '@mockza/domain';
import type {
  DiagnosticBankDto,
  DiagnosticBlockDto,
  DiagnosticSessionDto,
} from '@/gateways/diagnostic.gateway';
import type { DiagnosticSessionRecord } from '@/gateways/storage.gateway';

export interface DiagnosticPersistedState {
  readonly diagId: string;
  readonly examId: string;
  readonly mode: DiagnosticMode;
  readonly skipSpeaking: boolean;
  readonly retakeSkill: DiagnosticSkill | null;
  readonly currentStage: 'reading' | 'listening' | 'writing' | 'speaking';
  readonly readingHistory: readonly BlockAttemptRecord[];
  readonly readingStopReason: DiagnosticStopReason | null;
  readonly readingSkipped: boolean;
  readonly listeningHistory: readonly BlockAttemptRecord[];
  readonly listeningStopReason: DiagnosticStopReason | null;
  readonly listeningSkipped: boolean;
  readonly writingAttemptId: string;
  readonly writingText: string;
  readonly writingSkipped: boolean;
  readonly speakingAttemptId: string;
  readonly speakingTurns: readonly {
    readonly partIndex: number;
    readonly promptText: string;
    readonly objectKey: string;
    readonly durationMs?: number;
  }[];
  readonly speakingSkipped: boolean;
  readonly remoteSession: DiagnosticSessionDto | null;
}

export function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return '00000000-0000-4000-8000-000000000000'.replace(/[0]/g, () =>
    Math.floor(Math.random() * 16).toString(16),
  );
}

function clampCorrectIndex(idx: number): 0 | 1 | 2 {
  return idx === 1 ? 1 : idx === 2 ? 2 : 0;
}

function toDomainQuestion(
  q: DiagnosticBlockDto['questions'][number],
): DiagnosticBlockDef['questions'][number] {
  return {
    questionId: q.questionId,
    prompt: q.prompt,
    options: [q.options[0], q.options[1], q.options[2]],
    correctIndex: clampCorrectIndex(q.correctIndex),
    focusTag: q.focusTag,
  };
}

export function toDomainDiagnosticBlocks(
  dtos: readonly DiagnosticBlockDto[],
): DiagnosticBlockDef[] {
  return dtos.map((b) => ({
    blockId: b.blockId,
    skill: b.skill,
    tier: b.tier,
    scenarioId: b.scenarioId,
    title: b.title,
    passageText: b.passageText,
    scriptText: b.scriptText,
    durationSeconds: b.durationSeconds,
    minRequiredSeconds: b.minRequiredSeconds,
    questions: [toDomainQuestion(b.questions[0]), toDomainQuestion(b.questions[1])],
  }));
}

export function createInitialPersistedState(params: {
  readonly diagId: string;
  readonly examId: string;
  readonly mode: DiagnosticMode;
  readonly skipSpeaking: boolean;
}): DiagnosticPersistedState {
  return {
    diagId: params.diagId,
    examId: params.examId,
    mode: params.mode,
    skipSpeaking: params.skipSpeaking,
    retakeSkill: null,
    currentStage: 'reading',
    readingHistory: [],
    readingStopReason: null,
    readingSkipped: false,
    listeningHistory: [],
    listeningStopReason: null,
    listeningSkipped: false,
    writingAttemptId: generateUuidV4(),
    writingText: '',
    writingSkipped: false,
    speakingAttemptId: generateUuidV4(),
    speakingTurns: [],
    speakingSkipped: params.skipSpeaking,
    remoteSession: null,
  };
}

export function serializeDiagnosticRecord(
  state: DiagnosticPersistedState,
  bank: DiagnosticBankDto,
  nowMs: number,
): DiagnosticSessionRecord {
  const startedMs = state.remoteSession
    ? Date.parse(state.remoteSession.startedAt) || nowMs
    : nowMs;
  const budgetMult = state.mode === 'extended' ? 3 : 1;
  return {
    diagId: state.diagId,
    examId: state.examId as DiagnosticSessionRecord['examId'],
    mode: state.mode,
    policyVersion: bank.policyVersion,
    contentVersion: bank.contentVersion,
    selectionSeed: state.diagId,
    startedAtUtcMs: startedMs,
    collectionDeadlineUtcMs:
      startedMs + DIAGNOSTIC_BUDGET_SECONDS.collectionTotalSeconds * budgetMult * 1000,
    resultsDeadlineUtcMs:
      startedMs + DIAGNOSTIC_BUDGET_SECONDS.totalSessionSeconds * budgetMult * 1000,
    currentStage: state.remoteSession?.status === 'completed' ? 'results' : state.currentStage,
    status: state.remoteSession?.status ?? 'in_progress',
    stateJson: JSON.stringify(state),
    createdAtMs: startedMs,
    updatedAtMs: nowMs,
  };
}

export function parseDiagnosticStateJson(
  record: DiagnosticSessionRecord | null,
): DiagnosticPersistedState | null {
  if (!record?.stateJson) return null;
  try {
    return JSON.parse(record.stateJson) as DiagnosticPersistedState;
  } catch {
    return null;
  }
}

export function pickNextAdaptiveBlock(params: {
  readonly skill: 'reading' | 'listening';
  readonly blocks: readonly DiagnosticBlockDto[];
  readonly history: readonly BlockAttemptRecord[];
  readonly selectionSeed: string;
  readonly remainingStageSeconds: number;
  readonly remainingGlobalSeconds: number;
  readonly mode: DiagnosticMode;
}) {
  const domainBank = toDomainDiagnosticBlocks(params.blocks);
  const res = selectNextObjectiveBlock({
    skill: params.skill,
    bank: domainBank,
    history: [...params.history],
    selectionSeed: params.selectionSeed,
    remainingStageSeconds: params.remainingStageSeconds,
    remainingGlobalSeconds: params.remainingGlobalSeconds,
    strictMode: params.mode === 'standard',
  });
  const blockDto =
    res.action === 'present' && res.block
      ? params.blocks.find((b) => b.blockId === res.block?.blockId) ?? null
      : null;
  return { selection: res, blockDto };
}

export function recordAdaptiveBlockAttempt(params: {
  readonly block: DiagnosticBlockDto;
  readonly selectedChoices: readonly [number | null, number | null];
  readonly noEvidenceReason?: NoEvidenceReason;
}): BlockAttemptRecord {
  const outcome = classifyBlockOutcome({
    questions: [
      toDomainQuestion(params.block.questions[0]),
      toDomainQuestion(params.block.questions[1]),
    ],
    selectedOptionIndices: [...params.selectedChoices],
    noEvidenceReason: params.noEvidenceReason,
  });
  return {
    blockId: params.block.blockId,
    tier: params.block.tier,
    category: outcome.category,
    selectedOptionIndices: [...params.selectedChoices],
    correctCount: outcome.correctCount,
    noEvidenceReason: outcome.noEvidenceReason ?? params.noEvidenceReason,
  };
}

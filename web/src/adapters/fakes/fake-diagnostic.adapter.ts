import {
  AUTHORING_TIERS,
  type AuthoringTier,
  type BlockAttemptRecord,
  classifyBlockOutcome,
  deriveObjectivePlacement,
  DIAGNOSTIC_BUDGET_SECONDS,
  type DiagnosticBlockDef,
  DIAGNOSTIC_POLICY_VERSION,
} from '@mockza/domain';
import type { RecordedClip } from '@/gateways/audio.gateway';
import type {
  CreateDiagnosticSessionInput,
  DiagnosticBankDto,
  DiagnosticBlockDto,
  DiagnosticGatewayError,
  DiagnosticSessionDto,
  DiagnosticSkillOutcomeDto,
  IDiagnosticGateway,
  RetakeDiagnosticSkillInput,
  SubmitDiagnosticSessionInput,
} from '@/gateways/diagnostic.gateway';
import { err, ok, type Result } from '@/gateways/result';
import type { IClock } from '@/gateways/telemetry.gateway';
import { FakeClock } from './fake-clock';

function buildSeedBlocks(skill: 'reading' | 'listening'): DiagnosticBlockDto[] {
  const scenarios: readonly { tier: AuthoringTier; topic: string; q1: string; q2: string }[] = [
    { tier: 'A1', topic: 'Local Bookshop Hours', q1: 'When does the shop open on Fridays?', q2: 'Which item is discounted?' },
    { tier: 'A2', topic: 'Community Recycling Notice', q1: 'Where should glass bottles be placed?', q2: 'What day are bins collected?' },
    { tier: 'B1', topic: 'Urban Rooftop Gardens', q1: 'Why do city apartments plant roofs?', q2: 'What challenge did planners report?' },
    { tier: 'B2', topic: 'Tidal Turbine Engineering', q1: 'How do bidirectional blades improve output?', q2: 'Which environmental metric remained stable?' },
    { tier: 'C1', topic: 'Monetary Transmission Delays', q1: 'What dampens short-term rate changes?', q2: 'Why did central banks adjust forward guidance?' },
    { tier: 'C2', topic: 'Epistemological Models in Science', q1: 'How does the author contrast falsification with paradigms?', q2: 'What nuanced caveat qualifies the conclusion?' },
  ];

  const blocks: DiagnosticBlockDto[] = [];
  for (const spec of scenarios) {
    for (let variant = 1; variant <= 2; variant += 1) {
      const id = `diag-${skill}-${spec.tier.toLowerCase()}-${variant}`;
      blocks.push({
        blockId: id,
        skill,
        tier: spec.tier,
        scenarioId: `${spec.tier}-${variant}`,
        title: `${spec.tier} · ${spec.topic} (#${variant})`,
        ...(skill === 'reading'
          ? {
              passageText: `${spec.topic}: Evidence across ${spec.tier} studies shows structured operational planning lowers waste while improving long-term resilience across regions.`,
            }
          : {
              scriptText: `Audio briefing (${spec.tier}): Welcome to today's update on ${spec.topic}. Remember option B summarizes the core shift.`,
              mediaUrl: `/v1/media/diagnostic/${id}.m4a`,
              durationSeconds: 30,
            }),
        minRequiredSeconds: 12,
        questions: [
          {
            questionId: `${id}-q1`,
            prompt: spec.q1,
            options: ['Detail A only', 'Key mechanism in focus', 'Unrelated exception'],
            correctIndex: 1,
            focusTag: `${spec.tier.toLowerCase()}_detail`,
          },
          {
            questionId: `${id}-q2`,
            prompt: spec.q2,
            options: ['Primary outcome stated', 'Opposite trend', 'Historical footnote'],
            correctIndex: 0,
            focusTag: `${spec.tier.toLowerCase()}_inference`,
          },
        ],
      });
    }
  }
  return blocks;
}

const DEFAULT_FAKE_BANK: DiagnosticBankDto = {
  policyVersion: DIAGNOSTIC_POLICY_VERSION,
  contentVersion: 'diag-2026-11-17.v1',
  preflightAudioUrl: '/v1/media/diagnostic/preflight-chime.m4a',
  budgetSeconds: {
    intro: DIAGNOSTIC_BUDGET_SECONDS.introMaxSeconds,
    reading: DIAGNOSTIC_BUDGET_SECONDS.readingMaxSeconds,
    listening: DIAGNOSTIC_BUDGET_SECONDS.listeningMaxSeconds,
    writing: DIAGNOSTIC_BUDGET_SECONDS.writingMaxSeconds,
    speaking: DIAGNOSTIC_BUDGET_SECONDS.speakingMaxSeconds,
    transitions: DIAGNOSTIC_BUDGET_SECONDS.transitionMaxSeconds,
    collectionTotal: DIAGNOSTIC_BUDGET_SECONDS.collectionTotalSeconds,
    resultsWindow: DIAGNOSTIC_BUDGET_SECONDS.resultsWindowSeconds,
    total: DIAGNOSTIC_BUDGET_SECONDS.totalSessionSeconds,
  },
  workedExamples: {
    reading: {
      skill: 'reading',
      passageOrTranscript: 'Short research summary on urban cooling.',
      questionPrompt: 'Choose the statement matching the excerpt.',
      options: ['Costs tripled', 'Green roofs lower cooling loads', 'No effect observed'],
      correctIndex: 1,
      explanation: 'Match synonyms carefully rather than repeating single words.',
    },
    listening: {
      skill: 'listening',
      passageOrTranscript: 'Speaker first suggests Friday, however moves the lab to Monday.',
      questionPrompt: 'Identify the speaker’s final recommendation.',
      options: ['Monday morning', 'Friday afternoon', 'Cancel session'],
      correctIndex: 0,
      explanation: 'Watch for distractors introduced with "however".',
    },
  },
  readingBlocks: buildSeedBlocks('reading'),
  listeningBlocks: buildSeedBlocks('listening'),
  writingPrompt: {
    promptId: 'diag-w-01',
    title: 'Workplace Flexible Hours',
    basePrompt:
      'Many employers now offer hybrid schedules. Discuss the practical benefits and one drawback for team coordination.',
    suggestedWordsLabel: 'Write ~80–140 words in 4 minutes.',
    supportiveFollowUp: 'Add one short concrete workplace example.',
    extensionFollowUp: 'Evaluate whether junior staff learn slower remotely.',
  },
  speakingPrompt: {
    promptId: 'diag-s-01',
    title: 'Public Green Spaces',
    basePrompt: 'Describe a park or quiet outdoor space in your city that helps people recharge.',
    cueLabels: ['Where it is located', 'How people use it', 'Why cities need green zones'],
    supportiveFollowUp: 'How often do you visit similar places?',
    extensionFollowUp: 'Should municipalities prioritize transit or parks first?',
  },
  examScaleInfo: [
    { examId: 'ielts_academic', label: 'IELTS (0–9)', summary: 'Reported in 0.5 band steps.' },
    { examId: 'toefl_ibt', label: 'TOEFL iBT (2026)', summary: '1.0–6.0 scale + /120 bridge.' },
    { examId: 'pte_academic', label: 'PTE Academic', summary: '10–90 integer communicative score.' },
    { examId: 'det', label: 'DET', summary: '10–160 in 5-pt steps + 4 subscores.' },
  ],
};

function clampCorrectIndex(idx: number): 0 | 1 | 2 {
  return idx === 1 ? 1 : idx === 2 ? 2 : 0;
}

function toDomainQuestion(q: DiagnosticBlockDto['questions'][number]): DiagnosticBlockDef['questions'][number] {
  return {
    questionId: q.questionId,
    prompt: q.prompt,
    options: [q.options[0], q.options[1], q.options[2]],
    correctIndex: clampCorrectIndex(q.correctIndex),
    focusTag: q.focusTag,
  };
}

function toDomainBlocks(blocks: readonly DiagnosticBlockDto[]): DiagnosticBlockDef[] {
  return blocks.map((b) => ({
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

function scoreObjectiveOutcome(
  skill: 'reading' | 'listening',
  bankDtos: readonly DiagnosticBlockDto[],
  historyInput: SubmitDiagnosticSessionInput['readingHistory'],
  stopReason: SubmitDiagnosticSessionInput['readingStopReason'],
  skipped: boolean,
): DiagnosticSkillOutcomeDto {
  if (skipped) {
    return {
      skill,
      status: 'skipped',
      suggestedPracticeLevel: null,
      suggestedTier: null,
      observations: ['Skipped during diagnostic.'],
      weaknessFocus: null,
      quotaRefunded: false,
      reducedSampling: true,
      hasContradictoryEvidence: false,
      stopReason: null,
    };
  }
  const domainBank = toDomainBlocks(bankDtos);
  const blockMap = new Map(domainBank.map((b) => [b.blockId, b] as const));
  const records: BlockAttemptRecord[] = historyInput.map((item) => {
    const def = blockMap.get(item.blockId);
    const classified = def
      ? classifyBlockOutcome({
          questions: def.questions,
          selectedOptionIndices: item.selectedOptionIndices,
          noEvidenceReason: item.noEvidenceReason,
        })
      : { category: 'no_evidence' as const, correctCount: 0, noEvidenceReason: 'skipped' as const };
    return {
      blockId: item.blockId,
      tier: item.tier,
      category: classified.category,
      selectedOptionIndices: [...item.selectedOptionIndices],
      correctCount: classified.correctCount,
      noEvidenceReason: classified.noEvidenceReason ?? item.noEvidenceReason,
      elapsedSeconds: item.elapsedSeconds,
    };
  });

  const placement = deriveObjectivePlacement({
    skill,
    bank: domainBank,
    history: records,
    stopReason: stopReason ?? 'sampling_complete',
  });

  return {
    skill,
    status: placement.status,
    suggestedPracticeLevel: placement.suggestedPracticeLevel,
    suggestedTier: placement.suggestedTierRange?.maxTier ?? null,
    observations: placement.observations,
    weaknessFocus: placement.weaknessFocus,
    recommendedDrillType: placement.weaknessFocus,
    quotaRefunded: false,
    reducedSampling: placement.reducedSampling,
    hasContradictoryEvidence: placement.hasContradictoryEvidence,
    stopReason: placement.stopReason,
  };
}

export class FakeDiagnosticAdapter implements IDiagnosticGateway {
  private readonly clock: IClock;
  private readonly bank: DiagnosticBankDto;
  private readonly sessions = new Map<string, DiagnosticSessionDto>();

  constructor(options: { readonly clock?: IClock; readonly bank?: DiagnosticBankDto } = {}) {
    this.clock = options.clock ?? new FakeClock();
    this.bank = options.bank ?? DEFAULT_FAKE_BANK;
  }

  async fetchDiagnosticBank(): Promise<Result<DiagnosticBankDto, DiagnosticGatewayError>> {
    return ok(this.bank);
  }

  async createSession(
    input: CreateDiagnosticSessionInput,
  ): Promise<Result<DiagnosticSessionDto, DiagnosticGatewayError>> {
    const nowMs = this.clock.nowMs();
    const blankSkill = (skill: 'reading' | 'listening' | 'writing' | 'speaking'): DiagnosticSkillOutcomeDto => ({
      skill,
      status: 'insufficient_evidence',
      suggestedPracticeLevel: null,
      observations: [],
      weaknessFocus: null,
      quotaRefunded: false,
      reducedSampling: true,
      hasContradictoryEvidence: false,
    });

    const session: DiagnosticSessionDto = {
      diagId: input.diagId,
      examId: input.examId,
      mode: input.mode,
      policyVersion: this.bank.policyVersion,
      contentVersion: this.bank.contentVersion,
      status: 'in_progress',
      startedAt: new Date(nowMs).toISOString(),
      collectionDeadlineAt: new Date(
        nowMs + this.bank.budgetSeconds.collectionTotal * 1000,
      ).toISOString(),
      resultsDeadlineAt: new Date(nowMs + this.bank.budgetSeconds.total * 1000).toISOString(),
      resultRevision: 1,
      skills: {
        reading: blankSkill('reading'),
        listening: blankSkill('listening'),
        writing: blankSkill('writing'),
        speaking: blankSkill('speaking'),
      },
      recommendedFirstAction: {
        title: 'Start Diagnostic Drills',
        description: 'Begin with a focused 3-minute diagnostic follow-up.',
        drillType: 'speed_tfng',
        targetSkill: 'reading',
      },
    };
    this.sessions.set(input.diagId, session);
    return ok(session);
  }

  async submitSession(
    diagId: string,
    input: SubmitDiagnosticSessionInput,
  ): Promise<Result<DiagnosticSessionDto, DiagnosticGatewayError>> {
    const existing = this.sessions.get(diagId);
    if (!existing) {
      return err({ kind: 'validation', message: `Unknown diagnostic session: ${diagId}` });
    }

    const reading = scoreObjectiveOutcome(
      'reading',
      this.bank.readingBlocks,
      input.readingHistory,
      input.readingStopReason,
      input.readingSkipped,
    );
    const listening = scoreObjectiveOutcome(
      'listening',
      this.bank.listeningBlocks,
      input.listeningHistory,
      input.listeningStopReason,
      input.listeningSkipped,
    );
    const writing: DiagnosticSkillOutcomeDto =
      !input.writing || input.writing.skipped
        ? {
            skill: 'writing',
            status: 'skipped',
            suggestedPracticeLevel: null,
            observations: ['Writing sample skipped.'],
            weaknessFocus: null,
            quotaRefunded: false,
            reducedSampling: true,
            hasContradictoryEvidence: false,
          }
        : {
            skill: 'writing',
            status: 'provisional',
            suggestedPracticeLevel: 'Suggested practice: Band 6.5 (B2–C1 focus) — provisional',
            suggestedTier: 'B2',
            observations: ['Clear thesis and logical paragraphing in response.'],
            weaknessFocus: 'lexical_precision',
            recommendedDrillType: 'lexical_precision',
            attemptId: input.writing.attemptId,
            quotaRefunded: false,
            reducedSampling: false,
            hasContradictoryEvidence: false,
          };

    const speaking: DiagnosticSkillOutcomeDto =
      !input.speaking || input.speaking.skipped || input.speaking.turns.length === 0
        ? {
            skill: 'speaking',
            status: input.speaking?.noEvidenceReason === 'mic_denied' ? 'insufficient_evidence' : 'skipped',
            suggestedPracticeLevel: null,
            observations: ['Speaking sample skipped or microphone unavailable.'],
            weaknessFocus: null,
            quotaRefunded: false,
            reducedSampling: true,
            hasContradictoryEvidence: false,
          }
        : {
            skill: 'speaking',
            status: 'provisional',
            suggestedPracticeLevel: 'Suggested practice: Band 6.5 (B2–C1 focus) — provisional',
            suggestedTier: 'B2',
            observations: ['Fluent multi-clause spoken response with clear pacing.'],
            weaknessFocus: 'pronunciation_rhythm',
            recommendedDrillType: 'pronunciation_rhythm',
            attemptId: input.speaking.attemptId,
            quotaRefunded: false,
            reducedSampling: false,
            hasContradictoryEvidence: false,
          };

    const updated: DiagnosticSessionDto = {
      ...existing,
      status: 'completed',
      resultRevision: existing.resultRevision + 1,
      skills: { reading, listening, writing, speaking },
      recommendedFirstAction: {
        title: 'Sharpen Your Weakest Focus',
        description: `Practice ${reading.weaknessFocus ?? 'comprehension'} with a 3-minute drill.`,
        drillType: reading.weaknessFocus ?? 'speed_tfng',
        targetSkill: 'reading',
      },
    };
    this.sessions.set(diagId, updated);
    return ok(updated);
  }

  async getSession(diagId: string): Promise<Result<DiagnosticSessionDto, DiagnosticGatewayError>> {
    const existing = this.sessions.get(diagId);
    if (!existing) {
      return err({ kind: 'validation', message: `Unknown diagnostic session: ${diagId}` });
    }
    return ok(existing);
  }

  async retakeSkill(
    diagId: string,
    input: RetakeDiagnosticSkillInput,
  ): Promise<Result<DiagnosticSessionDto, DiagnosticGatewayError>> {
    const existing = this.sessions.get(diagId);
    if (!existing) {
      return err({ kind: 'validation', message: `Unknown diagnostic session: ${diagId}` });
    }

    const nextSkills = { ...existing.skills };
    if (input.skill === 'reading') {
      nextSkills.reading = scoreObjectiveOutcome(
        'reading',
        this.bank.readingBlocks,
        input.readingHistory ?? [],
        input.readingStopReason ?? 'sampling_complete',
        false,
      );
    } else if (input.skill === 'listening') {
      nextSkills.listening = scoreObjectiveOutcome(
        'listening',
        this.bank.listeningBlocks,
        input.listeningHistory ?? [],
        input.listeningStopReason ?? 'sampling_complete',
        false,
      );
    } else if (input.skill === 'writing') {
      nextSkills.writing = {
        skill: 'writing',
        status: 'provisional',
        suggestedPracticeLevel: 'Suggested practice: Band 7.0 (C1 focus) — provisional',
        suggestedTier: 'C1',
        observations: ['Updated writing retake shows stronger lexical variety.'],
        weaknessFocus: 'coherence_linking',
        attemptId: input.writing?.attemptId ?? null,
        quotaRefunded: false,
        reducedSampling: false,
        hasContradictoryEvidence: false,
      };
    } else {
      nextSkills.speaking = {
        skill: 'speaking',
        status: 'provisional',
        suggestedPracticeLevel: 'Suggested practice: Band 7.0 (C1 focus) — provisional',
        suggestedTier: 'C1',
        observations: ['Updated speaking retake shows steady rhythm.'],
        weaknessFocus: 'pronunciation_rhythm',
        attemptId: input.speaking?.attemptId ?? null,
        quotaRefunded: false,
        reducedSampling: false,
        hasContradictoryEvidence: false,
      };
    }

    const updated: DiagnosticSessionDto = {
      ...existing,
      resultRevision: existing.resultRevision + 1,
      skills: nextSkills,
    };
    this.sessions.set(diagId, updated);
    return ok(updated);
  }

  async uploadSpeakingTurnAudio(params: {
    readonly attemptId: string;
    readonly partIndex: number;
    readonly clip: RecordedClip;
  }): Promise<Result<{ readonly objectKey: string }, DiagnosticGatewayError>> {
    const ext = params.clip.strippedContentType.includes('webm') ? 'webm' : 'm4a';
    return ok({
      objectKey: `audio/diagnostic/${params.attemptId}/part-${params.partIndex}.${ext}`,
    });
  }
}

export { AUTHORING_TIERS };

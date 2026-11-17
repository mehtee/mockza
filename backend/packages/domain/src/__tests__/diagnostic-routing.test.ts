import { describe, expect, it } from 'vitest';
import fixtures from '../diagnostic/routing-fixtures.json' with { type: 'json' };
import {
  AUTHORING_TIERS,
  classifyBlockOutcome,
  type DiagnosticBlockDef,
  type DiagnosticQuestionDef,
  deriveObjectivePlacement,
  selectNextObjectiveBlock,
} from '../index.js';

function makeSampleBank(skill: 'reading' | 'listening'): DiagnosticBlockDef[] {
  const bank: DiagnosticBlockDef[] = [];
  const prefix = skill === 'reading' ? 'R' : 'L';
  const countPerTier = (tier: string) => (tier === 'B1' ? 3 : 2);
  for (const tier of AUTHORING_TIERS) {
    for (let i = 1; i <= countPerTier(tier); i += 1) {
      const q0: DiagnosticQuestionDef = {
        questionId: `${prefix}-${tier}-${i}-q1`,
        prompt: 'Explicit detail?',
        options: ['A', 'B', 'C'],
        correctIndex: 0,
        focusTag: 'explicit_detail',
      };
      const q1: DiagnosticQuestionDef = {
        questionId: `${prefix}-${tier}-${i}-q2`,
        prompt: 'Meaning / purpose?',
        options: ['X', 'Y', 'Z'],
        correctIndex: 1,
        focusTag: 'meaning_relationship',
      };
      bank.push({
        blockId: `${prefix}-${tier}-${i}`,
        skill,
        tier,
        scenarioId: 'scenario-fixture',
        title: `${skill} ${tier} #${i}`,
        passageText: skill === 'reading' ? 'Sample passage.' : undefined,
        mediaObjectKey: skill === 'listening' ? `media/listening/diag/${tier}-${i}.m4a` : undefined,
        durationSeconds: skill === 'listening' ? 15 : undefined,
        minRequiredSeconds: 20,
        questions: [q0, q1],
      });
    }
  }
  return bank;
}

describe('@mockza/domain diagnostic routing & placement', () => {
  const readingBank = makeSampleBank('reading');
  const listeningBank = makeSampleBank('listening');

  for (const c of fixtures.cases) {
    it(`fixture: ${c.name}`, () => {
      const skill = c.skill as 'reading' | 'listening';
      const bank = skill === 'reading' ? readingBank : listeningBank;
      const result = selectNextObjectiveBlock({
        skill,
        bank,
        history: c.history as never,
        remainingStageSeconds: c.remainingStageSeconds,
        remainingGlobalSeconds: c.remainingGlobalSeconds,
        selectionSeed: 'seed-001',
      });

      expect(result.action).toBe(c.expectedAction);
      if ('expectedTargetTier' in c && c.expectedTargetTier) {
        expect(result.targetTier).toBe(c.expectedTargetTier);
      }
      if ('expectedStopReason' in c && c.expectedStopReason) {
        expect(result.stopReason).toBe(c.expectedStopReason);
      }
      if ('expectedReducedSampling' in c && c.expectedReducedSampling !== undefined) {
        expect(result.reducedSampling).toBe(c.expectedReducedSampling);
      }
      if ('expectedEvidenceCheckTriggered' in c && c.expectedEvidenceCheckTriggered !== undefined) {
        expect(result.evidenceCheckTriggered).toBe(c.expectedEvidenceCheckTriggered);
      }
      if ('expectedHasContradiction' in c && c.expectedHasContradiction !== undefined) {
        expect(result.hasContradictoryEvidence).toBe(c.expectedHasContradiction);
      }
      if ('expectedCoincidentReasons' in c && c.expectedCoincidentReasons) {
        expect(result.coincidentReasons).toEqual(c.expectedCoincidentReasons);
      }
    });
  }

  it('classifies strong/mixed/low/no_evidence cleanly', () => {
    const qs = readingBank[0]?.questions ?? [];
    expect(classifyBlockOutcome({ questions: qs, selectedOptionIndices: [0, 1] })).toMatchObject({
      category: 'strong',
      correctCount: 2,
    });
    expect(classifyBlockOutcome({ questions: qs, selectedOptionIndices: [0, 2] })).toMatchObject({
      category: 'mixed',
      correctCount: 1,
    });
    expect(classifyBlockOutcome({ questions: qs, selectedOptionIndices: [2, 2] })).toMatchObject({
      category: 'low',
      correctCount: 0,
    });
    expect(
      classifyBlockOutcome({
        questions: qs,
        selectedOptionIndices: [null, null],
        noEvidenceReason: 'playback_failed',
      }),
    ).toMatchObject({
      category: 'no_evidence',
      correctCount: 0,
      noEvidenceReason: 'playback_failed',
    });
  });

  it('produces insufficient_evidence and null score rather than 0 on playback/empty failure', () => {
    const placement = deriveObjectivePlacement({
      skill: 'listening',
      history: [
        {
          blockId: 'L-B1-1',
          tier: 'B1',
          category: 'no_evidence',
          selectedOptionIndices: [null, null],
          correctCount: 0,
          noEvidenceReason: 'playback_failed',
        },
      ],
      bank: listeningBank,
      stopReason: 'content_limit',
    });
    expect(placement.status).toBe('insufficient_evidence');
    expect(placement.suggestedPracticeLevel).toBeNull();
    expect(placement.observations[0]).toContain('Audio playback');
  });

  it('produces broad provisional placement preserving ceiling/floor pattern', () => {
    const placement = deriveObjectivePlacement({
      skill: 'reading',
      history: [
        {
          blockId: 'R-B1-1',
          tier: 'B1',
          category: 'strong',
          selectedOptionIndices: [0, 1],
          correctCount: 2,
        },
        {
          blockId: 'R-B2-1',
          tier: 'B2',
          category: 'strong',
          selectedOptionIndices: [0, 1],
          correctCount: 2,
        },
        {
          blockId: 'R-C1-1',
          tier: 'C1',
          category: 'low',
          selectedOptionIndices: [2, 0],
          correctCount: 0,
        },
      ],
      bank: readingBank,
      stopReason: 'sampling_complete',
    });
    expect(placement.status).toBe('provisional');
    expect(placement.suggestedPracticeLevel).toContain('B2–B2 focus');
    expect(placement.reducedSampling).toBe(false);
    expect(placement.weaknessFocus).toBeTruthy();
  });
});

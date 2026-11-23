import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AUTHORING_TIERS,
  type AuthoringTier,
  assignVocabWaves,
  addSerialDays,
  type BandEvidenceEvent,
  type BlockAttemptRecord,
  buildScoreInsights,
  type CanonicalTopicKey,
  CountdownClockTracker,
  calculateCurrentStreak,
  calculateEstimatedOverallBand,
  calculateSkillMetrics,
  calculateStudyWeek,
  checkClozeAnswer,
  classifyBlockOutcome,
  computeBoundedStageDeadlineUtcMs,
  computeDetSubscores,
  computeDiagnosticRemainingSeconds,
  computeLiveBandProfile,
  computeNextMasteryMilli,
  computeOverallWritingBand,
  DIAGNOSTIC_BUDGET_SECONDS,
  DIAGNOSTIC_POLICY_VERSION,
  type DiagnosticBlockDef,
  type DiagnosticMode,
  type DiagnosticQuestionDef,
  defaultPackIdForSkill,
  differenceSerialDays,
  evaluateAdvancedFeatureQuota,
  type ExamModuleType,
  estimateToeflLegacy120,
  extractObjectiveWeaknesses,
  formatExamScore,
  formatExamScoreWithUnit,
  formatSm2IntervalDays,
  generateOrRecalibrateRoadmap,
  getExamDescriptor,
  getWritingTaskSpec,
  type LinguisticNodeSummary,
  listeningBandFor,
  type NoEvidenceReason,
  nextTargetWhenSwitchingFrom,
  normalizeCanonicalTopicKey,
  normalizeObjectiveAnswer,
  normalizeObjectiveSequence,
  normalizeScoreToQualityRatio,
  normalizeSupportedExamId,
  normalizeUtf16Span,
  type ObjectiveQuestionAnswer,
  previewSm2Intervals,
  quantizeExamScore,
  type ReviewQuality,
  type RoutingCategory,
  rankTopMissionTargets,
  readingBandFor,
  resolveExamTrackForPackOrProfile,
  roundIeltsBand,
  type SkillKind,
  type SrsCardState,
  type SupportedExamId,
  scheduleSm2Review,
  scoreFromNormalizedQuality,
  scoreObjectiveAnswers,
  scoreObjectiveForTrack,
  selectDailyReviewQueue,
  selectNextCoachTopic,
  selectNextObjectiveBlock,
  serialDayFromUtcDate,
  type TopicWeaknessCoverageEntry,
  validateBoundedAudioInput,
  validateDropTextSnippet,
  validateDropUrlPreFlight,
} from '../index.js';

const FIXTURES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../shared-fixtures',
);

function loadFixture<T>(filename: string): T {
  const raw = readFileSync(resolve(FIXTURES_DIR, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

interface ExamSpecsFixture {
  schemaVersion: string;
  roundIeltsBand: Array<{ id: string; rawMean: number; expected: number }>;
  calculateWritingOverallBand: Array<{
    id: string;
    task1Band: number;
    task2Band: number;
    expected: number;
  }>;
  estimateToeflLegacy120: Array<{ id: string; band: number; expected: number }>;
  examTrackScale: Array<{
    id: string;
    trackId: SupportedExamId;
    aliasInput: string;
    packIdForResolve: string;
    profileExamIdForResolve: string;
    rawScore: number;
    ratio: number;
    previousTrackId: SupportedExamId;
    previousTarget: number;
    expectedQuantized: number;
    expectedFormatted: string;
    expectedFormattedWithUnit: string;
    expectedNormalizedRatio: number;
    expectedScoreFromRatio: number;
    expectedNextTarget: number;
    expectedResolvedTrackId: SupportedExamId;
  }>;
  examDescriptorsAndTasks: {
    descriptors: Array<{
      id: string;
      trackId: SupportedExamId;
      expectedMinCalibratedObjectiveCount: number;
      expectedWritingTasks: string[];
      expectedFullMockTotalSeconds: number;
      expectedPackIds: Record<SkillKind, string>;
      detInputs: {
        reading: number | null;
        listening: number | null;
        writing: number | null;
        speaking: number | null;
      };
      expectedDetSubscores: {
        literacy: number | null;
        comprehension: number | null;
        conversation: number | null;
        production: number | null;
      };
      overallScoreForInsights: number;
      expectedScoreInsights: Array<{ label: string; detail: string }>;
    }>;
    writingTasks: Array<{
      id: string;
      wireInput: string;
      expectedTaskType: string;
      expectedDefaultMinWords: number;
      expectedDefaultMaxWords: number | null;
      expectedDefaultDurationSeconds: number;
      expectedRequiresSingleSentence: boolean;
      expectedShortTabLabel: string;
    }>;
  };
}

interface BandConversionFixture {
  schemaVersion: string;
  ieltsListening: Array<{ id: string; rawCorrect: number; expectedBand: number }>;
  ieltsReadingAcademic: Array<{ id: string; rawCorrect: number; expectedBand: number }>;
  ieltsReadingGeneralTraining: Array<{ id: string; rawCorrect: number; expectedBand: number }>;
  descriptorScoreObjective: Array<{
    id: string;
    trackId: SupportedExamId;
    skill: SkillKind;
    correctCount: number;
    totalCount: number;
    isFullLength: boolean;
    expectedScore: number;
  }>;
}

interface ObjectiveScorerFixture {
  schemaVersion: string;
  normalize: Array<{ id: string; raw: string; expected: string }>;
  normalizeSequence: Array<{ id: string; raw: string; expected: string }>;
  score: Array<{
    id: string;
    skill: SkillKind;
    moduleType: ExamModuleType;
    trackId: SupportedExamId;
    answers: Array<{
      questionId: string;
      questionType: string;
      acceptedAnswers: string[];
      userAnswer: string | null;
      maxWords: number;
    }>;
    expected: {
      correctCount: number;
      totalCount: number;
      bandScore: number;
      accuracyPercent: number;
      isCalibratedFullPack: boolean;
      questionCorrectness: Record<string, boolean>;
    };
  }>;
}

interface DiagnosticRouterFixture {
  schemaVersion: string;
  policyVersion: string;
  selectNextObjectiveBlock: Array<{
    id: string;
    skill: 'reading' | 'listening';
    initialTier?: AuthoringTier;
    strictMode?: boolean;
    selectionSeed?: string;
    bankOverride?: Array<{ blockId: string; tier: AuthoringTier; minRequiredSeconds?: number }>;
    history: Array<{
      blockId: string;
      tier: AuthoringTier;
      category: RoutingCategory;
      selectedOptionIndices: Array<number | null>;
      correctCount: number;
      noEvidenceReason?: NoEvidenceReason;
    }>;
    remainingStageSeconds: number;
    remainingGlobalSeconds: number;
    expectedAction: 'present' | 'stop';
    expectedTargetTier?: AuthoringTier;
    expectedChosenBlockId?: string;
    expectedStopReason?: string;
    expectedReducedSampling?: boolean;
    expectedEvidenceCheckTriggered?: boolean;
    expectedHasContradictoryEvidence?: boolean;
    expectedCoincidentReasons?: string[];
  }>;
  classifyBlockOutcome: Array<{
    id: string;
    questions: DiagnosticQuestionDef[];
    selectedOptionIndices: Array<number | null>;
    noEvidenceReason: NoEvidenceReason | null;
    expectedCategory: RoutingCategory;
    expectedCorrectCount: number;
    expectedNoEvidenceReason: NoEvidenceReason | null;
  }>;
  diagnosticBudget: {
    constants: {
      id: string;
      introMaxSeconds: number;
      readingMaxSeconds: number;
      listeningMaxSeconds: number;
      writingMaxSeconds: number;
      writingFollowUpMaxSeconds: number;
      speakingPrepMaxSeconds: number;
      speakingMainMaxSeconds: number;
      speakingFollowUpMaxSeconds: number;
      speakingMaxSeconds: number;
      transitionMaxSeconds: number;
      collectionTotalSeconds: number;
      resultsWindowSeconds: number;
      totalSessionSeconds: number;
    };
    deadlineCases: Array<{
      id: string;
      nowUtcMs: number;
      stageCapSeconds: number;
      globalCollectionDeadlineUtcMs: number;
      mode: DiagnosticMode;
      expectedStageDeadlineUtcMs: number;
      expectedRemainingSeconds: number;
      expiredDeadlineUtcMs?: number;
      expectedExpiredRemainingSeconds?: number;
    }>;
  };
}

interface Sm2SchedulerFixture {
  schemaVersion: string;
  serialDay: Array<{
    id: string;
    utcIso: string;
    addDays: number;
    expectedSerialDay: number;
    expectedAfterAddDays: number;
    expectedDifferenceDays: number;
  }>;
  schedule: Array<{
    id: string;
    current: SrsCardState;
    quality: ReviewQuality;
    today: number;
    expected: SrsCardState;
  }>;
  previewIntervalsAndFormatDays: {
    previewCases: Array<{
      id: string;
      current: SrsCardState;
      expected: Record<ReviewQuality, string>;
    }>;
    formatDaysCases: Array<{ id: string; days: number; expected: string }>;
  };
}

interface StudyMetricsFixture {
  schemaVersion: string;
  calculateEstimatedOverallBand: Array<{
    id: string;
    trackId: SupportedExamId;
    targetBand: number | null;
    currentUtcMs: number;
    scoredAttempts: Array<{ score: number; skill: SkillKind; completedAtUtcMs: number }>;
    expected: {
      overallBand: number | null;
      isEstimated: boolean;
      scaleMin: number;
      scaleMax: number;
      sampleSize: number;
      attemptedSkillsCount: number;
      isFullFourSkillEstimate: boolean;
      diagnosticRecommended: boolean;
      changeThisMonth: number | null;
      scaleLabel: string;
      progressToTarget: number;
    };
  }>;
  calculateSkillMetrics: Array<{
    id: string;
    trackId: SupportedExamId;
    attempts: Array<{ score: number; skill: SkillKind }>;
    expected: Array<{
      skill: SkillKind;
      score: number | null;
      scaleMin: number;
      scaleMax: number;
      scoreLabel: string;
      sampleCount: number;
      normalizedPosition: number;
    }>;
  }>;
  calculateCurrentStreak: Array<{
    id: string;
    today: number;
    studyDays: number[];
    expectedStreak: number;
  }>;
  calculateStudyWeek: Array<{
    id: string;
    today: number;
    weekdayOfToday: number;
    studyDays: number[];
    expected: {
      completedCount: number;
      summaryLabel: string;
      days: Array<{
        daySerial: number;
        dayLabel: string;
        isCompleted: boolean;
        isToday: boolean;
        isFuture: boolean;
      }>;
    };
  }>;
}

function buildDiagnosticBank(skill: 'reading' | 'listening'): DiagnosticBlockDef[] {
  const prefix = skill === 'reading' ? 'R' : 'L';
  const bank: DiagnosticBlockDef[] = [];
  for (const tier of AUTHORING_TIERS) {
    const count = tier === 'B1' ? 3 : 2;
    for (let i = 1; i <= count; i += 1) {
      bank.push({
        blockId: `${prefix}-${tier}-${i}`,
        skill,
        tier,
        scenarioId: 'community_spaces',
        title: `${skill} ${tier} #${i}`,
        minRequiredSeconds: 20,
        questions: [
          {
            questionId: `${prefix}-${tier}-${i}-Q1`,
            prompt: 'Question 1',
            options: ['A', 'B', 'C'],
            correctIndex: 0,
            focusTag: 'explicit_detail',
          },
          {
            questionId: `${prefix}-${tier}-${i}-Q2`,
            prompt: 'Question 2',
            options: ['A', 'B', 'C'],
            correctIndex: 1,
            focusTag: 'meaning_relationship',
          },
        ],
      });
    }
  }
  return bank;
}

const examSpecs = loadFixture<ExamSpecsFixture>('exam_specs_vectors.json');
const bandConversion = loadFixture<BandConversionFixture>('band_conversion_vectors.json');
const objectiveScorer = loadFixture<ObjectiveScorerFixture>('objective_scorer_vectors.json');
const diagnosticRouter = loadFixture<DiagnosticRouterFixture>('diagnostic_router_vectors.json');
const sm2Scheduler = loadFixture<Sm2SchedulerFixture>('sm2_scheduler_vectors.json');
const studyMetrics = loadFixture<StudyMetricsFixture>('study_metrics_vectors.json');

const TOTAL_VECTOR_COUNT =
  examSpecs.roundIeltsBand.length +
  examSpecs.calculateWritingOverallBand.length +
  examSpecs.estimateToeflLegacy120.length +
  examSpecs.examTrackScale.length +
  examSpecs.examDescriptorsAndTasks.descriptors.length +
  examSpecs.examDescriptorsAndTasks.writingTasks.length +
  bandConversion.ieltsListening.length +
  bandConversion.ieltsReadingAcademic.length +
  bandConversion.ieltsReadingGeneralTraining.length +
  bandConversion.descriptorScoreObjective.length +
  objectiveScorer.normalize.length +
  objectiveScorer.normalizeSequence.length +
  objectiveScorer.score.length +
  diagnosticRouter.selectNextObjectiveBlock.length +
  diagnosticRouter.classifyBlockOutcome.length +
  1 +
  diagnosticRouter.diagnosticBudget.deadlineCases.length +
  sm2Scheduler.serialDay.length +
  sm2Scheduler.schedule.length +
  sm2Scheduler.previewIntervalsAndFormatDays.previewCases.length +
  sm2Scheduler.previewIntervalsAndFormatDays.formatDaysCases.length +
  studyMetrics.calculateEstimatedOverallBand.length +
  studyMetrics.calculateSkillMetrics.length +
  studyMetrics.calculateCurrentStreak.length +
  studyMetrics.calculateStudyWeek.length;

describe('Cross-Codebase Golden Parity Suite (@mockza/domain <-> shared-fixtures)', () => {
  it('loads at least 250 golden parity vectors across all 6 fixture files', () => {
    expect(TOTAL_VECTOR_COUNT).toBeGreaterThanOrEqual(250);
    expect(examSpecs.schemaVersion).toBe('2026-11-18.v1');
    expect(bandConversion.schemaVersion).toBe('2026-11-18.v1');
    expect(objectiveScorer.schemaVersion).toBe('2026-11-18.v1');
    expect(diagnosticRouter.schemaVersion).toBe('2026-11-18.v1');
    expect(sm2Scheduler.schemaVersion).toBe('2026-11-18.v1');
    expect(studyMetrics.schemaVersion).toBe('2026-11-18.v1');
  });

  describe('1. ExamSpecs & Descriptors', () => {
    for (const v of examSpecs.roundIeltsBand) {
      it(`roundIeltsBand [${v.id}]`, () => {
        expect(roundIeltsBand(v.rawMean)).toBe(v.expected);
      });
    }

    for (const v of examSpecs.calculateWritingOverallBand) {
      it(`calculateWritingOverallBand [${v.id}]`, () => {
        expect(computeOverallWritingBand(v.task1Band, v.task2Band)).toBe(v.expected);
      });
    }

    for (const v of examSpecs.estimateToeflLegacy120) {
      it(`estimateToeflLegacy120 [${v.id}]`, () => {
        expect(estimateToeflLegacy120(v.band)).toBe(v.expected);
      });
    }

    for (const v of examSpecs.examTrackScale) {
      it(`examTrackScale [${v.id}]`, () => {
        expect(normalizeSupportedExamId(v.aliasInput)).toBe(v.trackId);
        expect(
          resolveExamTrackForPackOrProfile({
            packId: v.packIdForResolve,
            profileExamId: v.profileExamIdForResolve,
          }),
        ).toBe(v.expectedResolvedTrackId);
        expect(quantizeExamScore(v.rawScore, v.trackId)).toBe(v.expectedQuantized);
        expect(formatExamScore(v.rawScore, v.trackId)).toBe(v.expectedFormatted);
        expect(formatExamScoreWithUnit(v.rawScore, v.trackId)).toBe(v.expectedFormattedWithUnit);
        expect(normalizeScoreToQualityRatio(v.rawScore, v.trackId)).toBeCloseTo(
          v.expectedNormalizedRatio,
          6,
        );
        expect(scoreFromNormalizedQuality(v.ratio, v.trackId)).toBe(v.expectedScoreFromRatio);
        expect(
          nextTargetWhenSwitchingFrom({
            target: v.trackId,
            previous: v.previousTrackId,
            previousTarget: v.previousTarget,
          }),
        ).toBe(v.expectedNextTarget);
      });
    }

    for (const v of examSpecs.examDescriptorsAndTasks.descriptors) {
      it(`descriptor [${v.id}]`, () => {
        const desc = getExamDescriptor(v.trackId);
        expect(desc.minCalibratedObjectiveCount).toBe(v.expectedMinCalibratedObjectiveCount);
        expect([...desc.writingTasks]).toEqual(v.expectedWritingTasks);
        expect(desc.fullMockTotalSeconds).toBe(v.expectedFullMockTotalSeconds);
        for (const skill of Object.keys(v.expectedPackIds) as SkillKind[]) {
          expect(defaultPackIdForSkill(desc, skill)).toBe(v.expectedPackIds[skill]);
        }
        expect(computeDetSubscores(v.detInputs)).toEqual(v.expectedDetSubscores);
        expect(
          buildScoreInsights({
            track: v.trackId,
            overallScore: v.overallScoreForInsights,
            ...v.detInputs,
          }),
        ).toEqual(v.expectedScoreInsights);
      });
    }

    for (const v of examSpecs.examDescriptorsAndTasks.writingTasks) {
      it(`writingTask [${v.id}]`, () => {
        const spec = getWritingTaskSpec(v.wireInput);
        expect(spec.taskType).toBe(v.expectedTaskType);
        expect(spec.defaultMinWords).toBe(v.expectedDefaultMinWords);
        expect(spec.defaultMaxWords).toBe(v.expectedDefaultMaxWords);
        expect(spec.defaultDurationSeconds).toBe(v.expectedDefaultDurationSeconds);
        expect(spec.requiresSingleSentence).toBe(v.expectedRequiresSingleSentence);
        expect(spec.shortTabLabel).toBe(v.expectedShortTabLabel);
      });
    }
  });

  describe('2. BandConversionTable & Objective Scaling', () => {
    for (const v of bandConversion.ieltsListening) {
      it(`ieltsListening [${v.id}]`, () => {
        expect(listeningBandFor(v.rawCorrect)).toBe(v.expectedBand);
      });
    }

    for (const v of bandConversion.ieltsReadingAcademic) {
      it(`ieltsReadingAcademic [${v.id}]`, () => {
        expect(readingBandFor(v.rawCorrect, 'academic')).toBe(v.expectedBand);
      });
    }

    for (const v of bandConversion.ieltsReadingGeneralTraining) {
      it(`ieltsReadingGeneralTraining [${v.id}]`, () => {
        expect(readingBandFor(v.rawCorrect, 'general_training')).toBe(v.expectedBand);
      });
    }

    for (const v of bandConversion.descriptorScoreObjective) {
      it(`descriptorScoreObjective [${v.id}]`, () => {
        expect(
          scoreObjectiveForTrack({
            track: v.trackId,
            skill: v.skill,
            correctCount: v.correctCount,
            totalCount: v.totalCount,
            isFullLength: v.isFullLength,
          }),
        ).toBe(v.expectedScore);
      });
    }
  });

  describe('3. LocalObjectiveScorer', () => {
    for (const v of objectiveScorer.normalize) {
      it(`normalize [${v.id}]`, () => {
        expect(normalizeObjectiveAnswer(v.raw)).toBe(v.expected);
      });
    }

    for (const v of objectiveScorer.normalizeSequence) {
      it(`normalizeSequence [${v.id}]`, () => {
        expect(normalizeObjectiveSequence(v.raw)).toBe(v.expected);
      });
    }

    for (const v of objectiveScorer.score) {
      it(`score [${v.id}]`, () => {
        const answers: ObjectiveQuestionAnswer[] = v.answers.map((a) => ({
          questionId: a.questionId,
          questionType: a.questionType,
          acceptedAnswers: a.acceptedAnswers,
          userAnswer: a.userAnswer,
          maxWords: a.maxWords,
        }));
        const report = scoreObjectiveAnswers({
          answers,
          skill: v.skill,
          moduleType: v.moduleType,
          track: v.trackId,
        });
        expect(report.correctCount).toBe(v.expected.correctCount);
        expect(report.totalCount).toBe(v.expected.totalCount);
        expect(report.bandScore).toBe(v.expected.bandScore);
        expect(report.accuracyPercent).toBe(v.expected.accuracyPercent);
        expect(report.isCalibratedFullPack).toBe(v.expected.isCalibratedFullPack);
        for (const [qid, expectedOk] of Object.entries(v.expected.questionCorrectness)) {
          expect(report.questionCorrectness[qid]).toBe(expectedOk);
        }
      });
    }
  });

  describe('4. DiagnosticRouter & DiagnosticBudget', () => {
    it('matches diagnostic policyVersion', () => {
      expect(DIAGNOSTIC_POLICY_VERSION).toBe(diagnosticRouter.policyVersion);
    });

    for (const v of diagnosticRouter.selectNextObjectiveBlock) {
      it(`selectNextObjectiveBlock [${v.id}]`, () => {
        const bank: DiagnosticBlockDef[] = v.bankOverride
          ? v.bankOverride.map((b) => ({
              blockId: b.blockId,
              skill: v.skill,
              tier: b.tier,
              scenarioId: 'community_spaces',
              title: b.blockId,
              minRequiredSeconds: b.minRequiredSeconds ?? 20,
              questions: [
                {
                  questionId: `${b.blockId}-Q1`,
                  prompt: 'Q1',
                  options: ['A', 'B', 'C'],
                  correctIndex: 0,
                  focusTag: 'explicit_detail',
                },
                {
                  questionId: `${b.blockId}-Q2`,
                  prompt: 'Q2',
                  options: ['A', 'B', 'C'],
                  correctIndex: 1,
                  focusTag: 'meaning_relationship',
                },
              ],
            }))
          : buildDiagnosticBank(v.skill);

        const history: BlockAttemptRecord[] = v.history.map((h) => ({ ...h }));
        const result = selectNextObjectiveBlock({
          skill: v.skill,
          bank,
          history,
          remainingStageSeconds: v.remainingStageSeconds,
          remainingGlobalSeconds: v.remainingGlobalSeconds,
          selectionSeed: v.selectionSeed ?? 'parity-seed',
          initialTier: v.initialTier ?? 'B1',
          strictMode: v.strictMode ?? true,
        });

        expect(result.action).toBe(v.expectedAction);
        if (v.expectedTargetTier !== undefined) {
          expect(result.targetTier).toBe(v.expectedTargetTier);
        }
        if (v.expectedChosenBlockId !== undefined) {
          expect(result.block?.blockId).toBe(v.expectedChosenBlockId);
        }
        if (v.expectedStopReason !== undefined) {
          expect(result.stopReason).toBe(v.expectedStopReason);
        }
        if (v.expectedReducedSampling !== undefined) {
          expect(result.reducedSampling).toBe(v.expectedReducedSampling);
        }
        if (v.expectedEvidenceCheckTriggered !== undefined) {
          expect(result.evidenceCheckTriggered).toBe(v.expectedEvidenceCheckTriggered);
        }
        if (v.expectedHasContradictoryEvidence !== undefined) {
          expect(result.hasContradictoryEvidence).toBe(v.expectedHasContradictoryEvidence);
        }
        if (v.expectedCoincidentReasons !== undefined) {
          for (const reason of v.expectedCoincidentReasons) {
            expect(result.coincidentReasons).toContain(reason);
          }
        }
      });
    }

    for (const v of diagnosticRouter.classifyBlockOutcome) {
      it(`classifyBlockOutcome [${v.id}]`, () => {
        const result = classifyBlockOutcome({
          questions: v.questions,
          selectedOptionIndices: v.selectedOptionIndices,
          noEvidenceReason: v.noEvidenceReason ?? undefined,
        });
        expect(result.category).toBe(v.expectedCategory);
        expect(result.correctCount).toBe(v.expectedCorrectCount);
        expect(result.noEvidenceReason ?? null).toBe(v.expectedNoEvidenceReason);
      });
    }

    it(`diagnosticBudget [${diagnosticRouter.diagnosticBudget.constants.id}]`, () => {
      const { id: _id, ...expectedConstants } = diagnosticRouter.diagnosticBudget.constants;
      expect(DIAGNOSTIC_BUDGET_SECONDS).toEqual(expectedConstants);
    });

    for (const v of diagnosticRouter.diagnosticBudget.deadlineCases) {
      it(`diagnosticBudget [${v.id}]`, () => {
        const deadline = computeBoundedStageDeadlineUtcMs({
          stageCapSeconds: v.stageCapSeconds,
          globalCollectionDeadlineUtcMs: v.globalCollectionDeadlineUtcMs,
          mode: v.mode,
          nowUtcMs: v.nowUtcMs,
        });
        expect(deadline).toBe(v.expectedStageDeadlineUtcMs);
        expect(
          computeDiagnosticRemainingSeconds({
            deadlineUtcMs: deadline,
            nowUtcMs: v.nowUtcMs,
          }),
        ).toBe(v.expectedRemainingSeconds);
        if (
          v.expiredDeadlineUtcMs !== undefined &&
          v.expectedExpiredRemainingSeconds !== undefined
        ) {
          expect(
            computeDiagnosticRemainingSeconds({
              deadlineUtcMs: v.expiredDeadlineUtcMs,
              nowUtcMs: v.nowUtcMs,
            }),
          ).toBe(v.expectedExpiredRemainingSeconds);
        }
      });
    }
  });

  describe('5. Sm2Scheduler & SerialDay', () => {
    for (const v of sm2Scheduler.serialDay) {
      it(`serialDay [${v.id}]`, () => {
        const day = serialDayFromUtcDate(new Date(v.utcIso));
        expect(Object.is(day, -0)).toBe(false);
        expect(day).toBe(v.expectedSerialDay);
        const shifted = addSerialDays(day, v.addDays);
        expect(Object.is(shifted, -0)).toBe(false);
        expect(shifted).toBe(v.expectedAfterAddDays);
        const diff = differenceSerialDays(shifted, day);
        expect(Object.is(diff, -0)).toBe(false);
        expect(diff).toBe(v.expectedDifferenceDays);
      });
    }

    for (const v of sm2Scheduler.schedule) {
      it(`schedule [${v.id}]`, () => {
        expect(
          scheduleSm2Review({
            current: v.current,
            quality: v.quality,
            today: v.today,
          }),
        ).toEqual(v.expected);
      });
    }

    for (const v of sm2Scheduler.previewIntervalsAndFormatDays.previewCases) {
      it(`previewIntervals [${v.id}]`, () => {
        expect(previewSm2Intervals(v.current)).toEqual(v.expected);
      });
    }

    for (const v of sm2Scheduler.previewIntervalsAndFormatDays.formatDaysCases) {
      it(`formatDays [${v.id}]`, () => {
        expect(formatSm2IntervalDays(v.days)).toBe(v.expected);
      });
    }
  });

  describe('6. StudyMetricsCalculator & CountdownClockTracker', () => {
    for (const v of studyMetrics.calculateEstimatedOverallBand) {
      it(`calculateEstimatedOverallBand [${v.id}]`, () => {
        const actual = calculateEstimatedOverallBand({
          scoredAttempts: v.scoredAttempts,
          track: v.trackId,
          targetBand: v.targetBand,
          currentUtcMs: v.currentUtcMs,
        });
        expect(actual.overallBand).toBe(v.expected.overallBand);
        expect(actual.isEstimated).toBe(v.expected.isEstimated);
        expect(actual.scaleMin).toBe(v.expected.scaleMin);
        expect(actual.scaleMax).toBe(v.expected.scaleMax);
        expect(actual.sampleSize).toBe(v.expected.sampleSize);
        expect(actual.attemptedSkillsCount).toBe(v.expected.attemptedSkillsCount);
        expect(actual.isFullFourSkillEstimate).toBe(v.expected.isFullFourSkillEstimate);
        expect(actual.diagnosticRecommended).toBe(v.expected.diagnosticRecommended);
        if (actual.changeThisMonth !== null) {
          expect(Object.is(actual.changeThisMonth, -0)).toBe(false);
        }
        expect(actual.changeThisMonth).toBe(v.expected.changeThisMonth);
        expect(actual.scaleLabel).toBe(v.expected.scaleLabel);
        expect(actual.progressToTarget).toBeCloseTo(v.expected.progressToTarget, 6);
      });
    }

    for (const v of studyMetrics.calculateSkillMetrics) {
      it(`calculateSkillMetrics [${v.id}]`, () => {
        const actual = calculateSkillMetrics({
          attempts: v.attempts,
          track: v.trackId,
        });
        expect(actual).toHaveLength(v.expected.length);
        for (let i = 0; i < v.expected.length; i += 1) {
          const item = actual[i];
          const exp = v.expected[i];
          expect(item).toBeDefined();
          expect(exp).toBeDefined();
          if (!item || !exp) continue;
          expect(item.skill).toBe(exp.skill);
          expect(item.score).toBe(exp.score);
          expect(item.scaleMin).toBe(exp.scaleMin);
          expect(item.scaleMax).toBe(exp.scaleMax);
          expect(item.scoreLabel).toBe(exp.scoreLabel);
          expect(item.sampleCount).toBe(exp.sampleCount);
          expect(item.normalizedPosition).toBeCloseTo(exp.normalizedPosition, 6);
        }
      });
    }

    for (const v of studyMetrics.calculateCurrentStreak) {
      it(`calculateCurrentStreak [${v.id}]`, () => {
        expect(
          calculateCurrentStreak({
            studyDays: v.studyDays,
            today: v.today,
          }),
        ).toBe(v.expectedStreak);
      });
    }

    for (const v of studyMetrics.calculateStudyWeek) {
      it(`calculateStudyWeek [${v.id}]`, () => {
        expect(
          calculateStudyWeek({
            studyDays: v.studyDays,
            today: v.today,
            weekdayOfToday: v.weekdayOfToday,
          }),
        ).toEqual(v.expected);
      });
    }

    it('CountdownClockTracker matches wall-clock start/pause/resume/expiry parity', () => {
      let nowMs = 1_000_000;
      const tracker = new CountdownClockTracker({ nowMs: () => nowMs });
      tracker.start({ remainingSeconds: 60, totalSeconds: 100 });
      expect(tracker.totalSeconds).toBe(100);
      expect(tracker.currentRemaining()).toBe(60);
      nowMs += 999;
      expect(tracker.currentRemaining()).toBe(60);
      nowMs += 9001;
      expect(tracker.currentRemaining()).toBe(50);
      expect(tracker.pause()).toBe(50);
      expect(tracker.isPaused).toBe(true);
      nowMs += 30_000;
      expect(tracker.currentRemaining()).toBe(50);
      tracker.resume();
      expect(tracker.isPaused).toBe(false);
      nowMs += 50_000;
      expect(tracker.currentRemaining()).toBe(0);
      expect(tracker.isExpired).toBe(true);
    });
  });

  describe('7. Closed-Loop Linguistic Graph & Drop Bounds Parity', () => {
    const graphFixtures = loadFixture<{
      masteryUpdates: Array<{
        id: string;
        currentMilli: number;
        polarity: 'gap_observed' | 'target_used' | 'interest_matched';
        evidenceCount: number;
        expectedMilli: number;
      }>;
      rankMissionTargets: {
        currentDaySerial: number;
        dueCardIds: string[];
        nodes: LinguisticNodeSummary[];
        expected: {
          bottleneckKeys: string[];
          targetKeys: string[];
          interestKeys: string[];
          suggestedCardIds: string[];
        };
      };
      utf16Spans: Array<{
        id: string;
        sourceText: string;
        rawStart: number;
        rawEnd: number;
        expectedStart: number;
        expectedEnd: number;
        expectedExcerpt: string;
      }>;
    }>('linguistic_graph_vectors.json');

    const dropFixtures = loadFixture<{
      urlCases: Array<{
        id: string;
        url: string;
        allowHttpInDev: boolean;
        expectedOk: boolean;
        expectedCode: string | null;
      }>;
      textCases: Array<{
        id: string;
        text: string;
        expectedOk: boolean;
        expectedCode: string | null;
      }>;
      audioCases: Array<{
        id: string;
        mode: 'shifter' | 'drop';
        contentType: string;
        byteLength: number;
        durationSeconds: number;
        expectedOk: boolean;
        expectedCode: string | null;
      }>;
    }>('drop_bounds_vectors.json');

    for (const v of graphFixtures.masteryUpdates) {
      it(`computeNextMasteryMilli [${v.id}]`, () => {
        expect(
          computeNextMasteryMilli({
            currentMilli: v.currentMilli,
            polarity: v.polarity,
            evidenceCount: v.evidenceCount,
          }),
        ).toBe(v.expectedMilli);
      });
    }

    it('rankTopMissionTargets matches priority & recency decay parity', () => {
      const ranked = rankTopMissionTargets({
        nodes: graphFixtures.rankMissionTargets.nodes,
        dueCardIds: graphFixtures.rankMissionTargets.dueCardIds,
        currentDaySerial: graphFixtures.rankMissionTargets.currentDaySerial,
      });
      expect(ranked.bottlenecks.map((b) => b.canonicalKey)).toEqual(
        graphFixtures.rankMissionTargets.expected.bottleneckKeys,
      );
      expect(ranked.targetStructures.map((t) => t.canonicalKey)).toEqual(
        graphFixtures.rankMissionTargets.expected.targetKeys,
      );
      expect(ranked.interestTopics.map((i) => i.canonicalKey)).toEqual(
        graphFixtures.rankMissionTargets.expected.interestKeys,
      );
      expect(ranked.suggestedCardIds).toEqual(
        graphFixtures.rankMissionTargets.expected.suggestedCardIds,
      );
    });

    for (const v of graphFixtures.utf16Spans) {
      it(`normalizeUtf16Span [${v.id}]`, () => {
        const res = normalizeUtf16Span(v.sourceText, v.rawStart, v.rawEnd);
        expect(res.startUtf16).toBe(v.expectedStart);
        expect(res.endUtf16).toBe(v.expectedEnd);
        expect(res.excerpt).toBe(v.expectedExcerpt);
      });
    }

    for (const v of dropFixtures.urlCases) {
      it(`validateDropUrlPreFlight [${v.id}]`, () => {
        const res = validateDropUrlPreFlight(v.url, { allowHttpInDev: v.allowHttpInDev });
        expect(res.ok).toBe(v.expectedOk);
        expect(res.code ?? null).toBe(v.expectedCode);
      });
    }

    for (const v of dropFixtures.textCases) {
      it(`validateDropTextSnippet [${v.id}]`, () => {
        const res = validateDropTextSnippet(v.text);
        expect(res.ok).toBe(v.expectedOk);
        expect(res.code ?? null).toBe(v.expectedCode);
      });
    }

    for (const v of dropFixtures.audioCases) {
      it(`validateBoundedAudioInput [${v.id}]`, () => {
        const res = validateBoundedAudioInput({
          mode: v.mode,
          contentType: v.contentType,
          byteLength: v.byteLength,
          durationSeconds: v.durationSeconds,
        });
        expect(res.ok).toBe(v.expectedOk);
        expect(res.code ?? null).toBe(v.expectedCode);
      });
    }

    it('evaluateAdvancedFeatureQuota enforces IRN 120/mo vs GLB 150/mo & Pro drop audio lock', () => {
      const freeAudio = evaluateAdvancedFeatureQuota({
        feature: 'drop_audio',
        isPro: false,
        freeSampleUsed: false,
        speakingUsedToday: 0,
        shifterUsedToday: 0,
        dropsUsedToday: 0,
        audioDropsUsedToday: 0,
        monthlyUsed: 0,
        edition: 'irn',
      });
      expect(freeAudio.allowed).toBe(false);
      expect(freeAudio.reason).toBe('pro_required_for_audio_drop');

      const irnCap = evaluateAdvancedFeatureQuota({
        feature: 'drop_text_image',
        isPro: true,
        freeSampleUsed: true,
        speakingUsedToday: 0,
        shifterUsedToday: 0,
        dropsUsedToday: 0,
        audioDropsUsedToday: 0,
        monthlyUsed: 120,
        edition: 'irn',
      });
      expect(irnCap.allowed).toBe(false);
      expect(irnCap.reason).toBe('monthly_quota_exceeded');
    });

    for (const v of dropFixtures.clozeCases) {
      it(`checkClozeAnswer [${v.id}]`, () => {
        expect(checkClozeAnswer(v.input, v.expected)).toBe(v.matches);
      });
    }
  });

  describe('8. Adaptive Personalization, Live Band, Rotation & Vocab Wave Parity', () => {
    interface PersonalizationVectors {
      topicNormalizationCases: Array<{ id: string; input: string; expected: string }>;
      liveBandCases: Array<{
        id: string;
        examId: SupportedExamId;
        targetBand: number;
        nowUtcMs: number;
        previousOverallScore: number | null;
        events: BandEvidenceEvent[];
        expectedOverall: number;
        expectedConfidence: string;
        expectedBandShiftDelta: number | null;
      }>;
      phaseRotationCases: Array<{
        id: string;
        favoriteTopics: CanonicalTopicKey[];
        currentDaySerial: number;
        weaknessNodes: LinguisticNodeSummary[];
        coverage: TopicWeaknessCoverageEntry[];
        expectedTopic: string;
        expectedPhase: string;
      }>;
      vocabWaveCase: {
        id: string;
        favoriteTopics: string[];
        examId: SupportedExamId;
        currentBand: number;
        targetBand: number;
        activeWeaknessKeys: string[];
        unlockedWave: number;
        waveSize: number;
        dailyNewCap: number;
        todaySerialDay: number;
        cards: Array<{
          cardId: string;
          headword: string;
          legacyTopicTag: string;
          cefrLevel: AuthoringTier;
          repetitions: number;
          dueSerialDay: number;
        }>;
        expectedQueueLength: number;
        expectedReadyToUnlockNext: boolean;
      };
    }

    const pFixtures = loadFixture<PersonalizationVectors>('personalization_vectors.json');

    for (const v of pFixtures.topicNormalizationCases) {
      it(`normalizeCanonicalTopicKey [${v.id}]`, () => {
        expect(normalizeCanonicalTopicKey(v.input)).toBe(v.expected);
      });
    }

    for (const v of pFixtures.liveBandCases) {
      it(`computeLiveBandProfile [${v.id}]`, () => {
        const res = computeLiveBandProfile({
          events: v.events,
          examId: v.examId,
          targetBand: v.targetBand,
          nowUtcMs: v.nowUtcMs,
          previousOverallScore: v.previousOverallScore,
        });
        expect(res.overallScore).toBe(v.expectedOverall);
        expect(res.overallConfidence).toBe(v.expectedConfidence);
        expect(res.bandShift?.delta ?? null).toBe(v.expectedBandShiftDelta);
      });
    }

    for (const v of pFixtures.phaseRotationCases) {
      it(`selectNextCoachTopic [${v.id}]`, () => {
        const sel = selectNextCoachTopic({
          weaknessNodes: v.weaknessNodes,
          favoriteTopics: v.favoriteTopics,
          coverage: v.coverage,
          currentDaySerial: v.currentDaySerial,
        });
        expect(sel.topicKey).toBe(v.expectedTopic);
        expect(sel.phase).toBe(v.expectedPhase);
      });
    }

    it(`assignVocabWaves & selectDailyReviewQueue [${pFixtures.vocabWaveCase.id}]`, () => {
      const vc = pFixtures.vocabWaveCase;
      const waves = assignVocabWaves({
        cards: vc.cards,
        favoriteTopics: vc.favoriteTopics,
        examId: vc.examId,
        currentBand: vc.currentBand,
        targetBand: vc.targetBand,
        activeWeaknessKeys: vc.activeWeaknessKeys,
        unlockedWave: vc.unlockedWave,
        waveSize: vc.waveSize,
      });
      const daily = selectDailyReviewQueue({
        assigned: waves.assigned,
        todaySerialDay: vc.todaySerialDay,
        newCardsIntroducedToday: 0,
        dailyNewCap: vc.dailyNewCap,
        unlockedWave: vc.unlockedWave,
      });
      expect(daily.queue.length).toBe(vc.expectedQueueLength);
      expect(daily.summary.readyToUnlockNext).toBe(vc.expectedReadyToUnlockNext);
    });

    it('extractObjectiveWeaknesses & generateOrRecalibrateRoadmap preserve completed steps', () => {
      const weaknesses = extractObjectiveWeaknesses({
        skill: 'reading',
        questionTypeStats: [{ questionType: 'tfng', correct: 1, total: 5 }],
      });
      expect(weaknesses[0]?.canonicalKey).toBe('reading:tfng_trap');
      expect(weaknesses[0]?.observedPolarity).toBe('gap_observed');

      const roadmap = generateOrRecalibrateRoadmap({
        examId: 'ielts_academic',
        currentBand: 6.0,
        targetBand: 7.5,
        targetDateSerial: 20810,
        todaySerial: 20780,
        studyFocus: 'both',
        dailyMinutesGoal: 30,
        favoriteTopics: ['technology_ai', 'health_sports'],
        weaknessNodes: [],
        coverage: [],
        packs: [],
        drills: [],
        diagnosticDone: false,
        currentVocabWave: 1,
        existingCompletedStepKeys: new Set(['m1:vocab:wave1']),
      });
      expect(roadmap.milestones).toHaveLength(4);
      expect(roadmap.activeStep?.stepKey).toBe('m1:diagnostic');
      expect(roadmap.steps.find((s) => s.stepKey === 'm1:vocab:wave1')?.status).toBe('completed');
    });

    it('unlocks Milestone 1 starter basics at entry B1 tier when currentBand is null and diagnostic skipped', () => {
      const roadmap = generateOrRecalibrateRoadmap({
        examId: 'ielts_academic',
        currentBand: null,
        targetBand: 8.5,
        targetDateSerial: 20810,
        todaySerial: 20780,
        studyFocus: 'both',
        dailyMinutesGoal: 30,
        favoriteTopics: ['technology_ai'],
        weaknessNodes: [],
        coverage: [],
        packs: [
          {
            id: 'pack-c1',
            examId: 'ielts_academic',
            skill: 'reading',
            title: 'C1 Advanced Reading',
            durationSeconds: 1200,
            topicKeys: ['technology_ai'],
            weaknessTags: [],
            cefrMin: 'C1',
            cefrMax: 'C2',
          },
          {
            id: 'pack-b1',
            examId: 'ielts_academic',
            skill: 'reading',
            title: 'B1 Starter Reading',
            durationSeconds: 900,
            topicKeys: ['technology_ai'],
            weaknessTags: [],
            cefrMin: 'B1',
            cefrMax: 'B2',
          },
        ],
        drills: [],
        diagnosticDone: false,
        currentVocabWave: 1,
      });

      expect(roadmap.steps.find((s) => s.stepKey === 'm1:diagnostic')?.status).toBe('active');
      expect(roadmap.steps.find((s) => s.stepKey === 'm1:vocab:wave1')?.status).toBe('active');
      expect(roadmap.steps.find((s) => s.stepKey === 'm1:coach:warmup')?.status).toBe('active');
      expect(roadmap.steps.find((s) => s.stepKey === 'm1:vocab:wave1')?.difficultyCefr).toBe('B1');
      // Starter practice pack prefers basic B1 even when targetBand is 8.5
      expect(roadmap.steps.find((s) => s.stepKind === 'practice_pack')?.targetRefId).toBe('pack-b1');
    });
  });
});

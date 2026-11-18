import { describe, expect, it } from 'vitest';
import {
  buildScoreInsights,
  CountdownClockTracker,
  calculateCurrentStreak,
  calculateEstimatedOverallBand,
  calculateSkillMetrics,
  calculateStudyWeek,
  computeDetSubscores,
  defaultPackIdForSkill,
  EXAM_DESCRIPTORS,
  EXAM_SPEC_CONSTANTS,
  EXAM_TRACK_SPECS,
  formatExamScore,
  formatExamScoreWithUnit,
  formatMicroDrillCategoryLabel,
  getExamDescriptor,
  getMicroDrillItemHeaderTitle,
  getPopulatedDetSubscoreEntries,
  getWritingTaskSpec,
  isIeltsTrack,
  listeningBandFor,
  nextTargetWhenSwitchingFrom,
  normalizeObjectiveAnswer,
  normalizeObjectiveQuestionType,
  normalizeObjectiveSequence,
  normalizeWritingTaskType,
  OBJECTIVE_QUESTION_TYPES,
  type ObjectiveQuestionAnswer,
  parseObjectiveChoiceOption,
  readingBandFor,
  resolveExamTrackForPackOrProfile,
  roundIeltsBand,
  scoreObjectiveAnswers,
  scoreObjectiveForTrack,
  UK_TO_US_SPELLINGS,
  WORD_TO_DIGITS,
  WRITING_TASK_SPECS,
} from '../index.js';

describe('@mockza/domain exams, band conversion, scorer, clock & metrics', () => {
  describe('ExamSpec & WritingTaskSpecs', () => {
    it('rounds IELTS band with boundary quarters and non-finite guards', () => {
      expect(roundIeltsBand(6)).toBe(6.0);
      expect(roundIeltsBand(6.12)).toBe(6.0);
      expect(roundIeltsBand(6.25)).toBe(6.5);
      expect(roundIeltsBand(6.5)).toBe(6.5);
      expect(roundIeltsBand(6.74)).toBe(6.5);
      expect(roundIeltsBand(6.75)).toBe(7.0);
      expect(roundIeltsBand(6.88)).toBe(7.0);
      expect(roundIeltsBand(8.9)).toBe(9.0);
      expect(roundIeltsBand(9.5)).toBe(9.0);
      expect(roundIeltsBand(-1)).toBe(0.0);
      expect(roundIeltsBand(Number.NaN)).toBe(0);
      expect(roundIeltsBand(Number.POSITIVE_INFINITY)).toBe(0);
      expect(roundIeltsBand(Number.NEGATIVE_INFINITY)).toBe(0);
    });

    it('exposes all 5 ExamTrackSpecs, formatting, switching, and pack resolution', () => {
      expect(EXAM_SPEC_CONSTANTS.readingDurationSeconds).toBe(3600);
      expect(EXAM_SPEC_CONSTANTS.listeningQuestionCount).toBe(40);
      expect(EXAM_TRACK_SPECS.det.shortName).toBe('Duolingo (DET)');
      expect(isIeltsTrack('ielts_academic')).toBe(true);
      expect(isIeltsTrack('ielts_general')).toBe(true);
      expect(isIeltsTrack('toefl_ibt')).toBe(false);

      expect(formatExamScore(5, 'toefl_ibt')).toBe('5.0');
      expect(formatExamScoreWithUnit(5.5, 'toefl_ibt')).toBe('Band 5.5');
      expect(formatExamScore(72.4, 'pte_academic')).toBe('72');
      expect(formatExamScoreWithUnit(72, 'pte_academic')).toBe('Score 72');
      expect(formatExamScoreWithUnit(130, 'det')).toBe('Score 130');

      expect(
        nextTargetWhenSwitchingFrom({
          target: 'ielts_general',
          previous: 'ielts_academic',
          previousTarget: 8,
        }),
      ).toBe(8.0);
      expect(
        nextTargetWhenSwitchingFrom({
          target: 'det',
          previous: 'pte_academic',
          previousTarget: 65,
        }),
      ).toBe(125);
      expect(
        nextTargetWhenSwitchingFrom({
          target: 'pte_academic',
          previous: 'det',
          previousTarget: 140,
        }),
      ).toBe(65);
      expect(
        nextTargetWhenSwitchingFrom({
          target: 'toefl_ibt',
          previous: 'ielts_academic',
          previousTarget: 7.5,
        }),
      ).toBe(5);

      expect(
        resolveExamTrackForPackOrProfile({
          packId: 'toefl-reading-pack-01',
          profileExamId: 'ielts_academic',
        }),
      ).toBe('toefl_ibt');
      expect(
        resolveExamTrackForPackOrProfile({
          packId: 'pte-speaking-pack-01',
          profileExamId: 'ielts_academic',
        }),
      ).toBe('pte_academic');
      expect(
        resolveExamTrackForPackOrProfile({
          packId: 'det-writing-pack-01',
          profileExamId: 'ielts_academic',
        }),
      ).toBe('det');
      expect(
        resolveExamTrackForPackOrProfile({
          packId: 'custom-gt-pack-01',
          profileExamId: 'ielts_academic',
        }),
      ).toBe('ielts_general');
      expect(
        resolveExamTrackForPackOrProfile({
          packId: 'custom-acad-pack-01',
          profileExamId: 'det',
        }),
      ).toBe('ielts_academic');
      expect(
        resolveExamTrackForPackOrProfile({
          packId: 'ielts-listening-seed-01',
          profileExamId: 'ielts_general',
        }),
      ).toBe('ielts_general');
    });

    it('parses all 11 ObjectiveQuestionTypes, choice options, writing specs, and drill labels', () => {
      expect(OBJECTIVE_QUESTION_TYPES).toHaveLength(11);
      expect(normalizeObjectiveQuestionType('true_false_not_given')).toBe('tfng');
      expect(normalizeObjectiveQuestionType('writing_prompt')).toBe('short_answer');

      expect(
        parseObjectiveChoiceOption({
          questionType: 'matching_headings',
          rawOption: 'iv. Economic impact of urban farming',
          index: 0,
          acceptedVariants: ['iv'],
        }),
      ).toEqual({
        label: 'iv',
        displayText: 'Economic impact of urban farming',
        value: 'iv',
      });

      expect(
        parseObjectiveChoiceOption({
          questionType: 'matching_headings',
          rawOption: 'Plain heading',
          index: 2,
          acceptedVariants: ['iii'],
        }),
      ).toEqual({
        label: 'iii',
        displayText: 'Plain heading',
        value: 'iii',
      });

      expect(
        parseObjectiveChoiceOption({
          questionType: 'mcq_single',
          rawOption: 'b) Solar energy storage',
          index: 1,
          acceptedVariants: ['B'],
        }),
      ).toEqual({
        label: 'B',
        displayText: 'Solar energy storage',
        value: 'B',
      });

      expect(
        parseObjectiveChoiceOption({
          questionType: 'mcq_single',
          rawOption: 'TRUE',
          index: 0,
          acceptedVariants: ['TRUE'],
        }),
      ).toEqual({
        label: 'A',
        displayText: 'TRUE',
        value: 'TRUE',
      });

      expect(
        parseObjectiveChoiceOption({
          questionType: 'mcq_single',
          rawOption: 'Option text',
          index: 1,
          acceptedVariants: ['B'],
        }),
      ).toEqual({
        label: 'B',
        displayText: 'Option text',
        value: 'B',
      });

      expect(WRITING_TASK_SPECS.toeflSentenceBuild.defaultMinWords).toBe(15);
      expect(WRITING_TASK_SPECS.pteSummarizeWrittenText.requiresSingleSentence).toBe(true);
      expect(WRITING_TASK_SPECS.pteSummarizeWrittenText.defaultMinWords).toBe(5);
      expect(WRITING_TASK_SPECS.pteSummarizeWrittenText.defaultMaxWords).toBe(75);
      expect(normalizeWritingTaskType('pte_summarize_written_text')).toBe(
        'pteSummarizeWrittenText',
      );
      expect(getWritingTaskSpec('unknown_type').taskType).toBe('task2Essay');

      expect(formatMicroDrillCategoryLabel('speed_tfng')).toBe('True / False / Not Given');
      expect(formatMicroDrillCategoryLabel('lr_collocations')).toBe('LR Collocations');
      expect(getMicroDrillItemHeaderTitle('summary_gap')).toBe('Complete the Summary');
    });
  });

  describe('BandConversionTable', () => {
    it('is monotonic across 0..40 for Listening, Academic Reading, and GT Reading', () => {
      let prevL = 0;
      let prevAcad = 0;
      let prevGt = 0;
      for (let raw = 0; raw <= 40; raw += 1) {
        const l = listeningBandFor(raw);
        const acad = readingBandFor(raw, 'academic');
        const gt = readingBandFor(raw, 'general_training');
        expect(l).toBeGreaterThanOrEqual(prevL);
        expect(acad).toBeGreaterThanOrEqual(prevAcad);
        expect(gt).toBeGreaterThanOrEqual(prevGt);
        prevL = l;
        prevAcad = acad;
        prevGt = gt;
      }

      expect(listeningBandFor(0)).toBe(0);
      expect(listeningBandFor(1)).toBe(2.5);
      expect(listeningBandFor(30)).toBe(7);
      expect(listeningBandFor(39)).toBe(9);

      expect(readingBandFor(30, 'academic')).toBe(7);
      expect(readingBandFor(30, 'general_training')).toBe(6);
      expect(readingBandFor(39, 'general_training')).toBe(8.5);
      expect(readingBandFor(40, 'general_training')).toBe(9);
    });
  });

  describe('ExamDescriptor & DET Subscores', () => {
    it('provides pack IDs, calibrated thresholds, scoreObjectiveForTrack, and insights', () => {
      const ieltsDesc = getExamDescriptor('ielts_academic');
      expect(ieltsDesc.minCalibratedObjectiveCount).toBe(40);
      expect(defaultPackIdForSkill(ieltsDesc, 'vocabulary')).toBe('ielts-micro-drill-01');

      const toeflDesc = EXAM_DESCRIPTORS.toefl_ibt;
      expect(toeflDesc.minCalibratedObjectiveCount).toBe(4);
      expect(buildScoreInsights({ track: 'toefl_ibt', overallScore: 5 })[0]?.detail).toBe(
        '100 / 120',
      );

      const pteDesc = EXAM_DESCRIPTORS.pte_academic;
      expect(pteDesc.writingTasks).toEqual(['pteSummarizeWrittenText', 'pteEssay']);
      expect(
        scoreObjectiveForTrack({
          track: 'pte_academic',
          skill: 'reading',
          correctCount: 8,
          totalCount: 10,
          isFullLength: true,
        }),
      ).toBe(74);

      const subs = computeDetSubscores({
        reading: 140,
        listening: 130,
        writing: 120,
        speaking: 110,
      });
      expect(subs).toEqual({
        literacy: 130,
        comprehension: 135,
        conversation: 120,
        production: 115,
      });
      expect(getPopulatedDetSubscoreEntries(subs).map((e) => e.label)).toEqual([
        'Literacy',
        'Comprehension',
        'Conversation',
        'Production',
      ]);

      const partialSubs = computeDetSubscores({ reading: 125 });
      expect(partialSubs).toEqual({
        literacy: 125,
        comprehension: 125,
        conversation: null,
        production: null,
      });
    });
  });

  describe('LocalObjectiveScorer', () => {
    it('contains all 31 UK->US spelling pairs and 11 wordToDigits entries', () => {
      expect(Object.keys(UK_TO_US_SPELLINGS)).toHaveLength(31);
      expect(Object.keys(WORD_TO_DIGITS)).toHaveLength(11);

      for (const [uk, us] of Object.entries(UK_TO_US_SPELLINGS)) {
        expect(normalizeObjectiveAnswer(uk)).toBe(us);
      }
      for (const [word, digit] of Object.entries(WORD_TO_DIGITS)) {
        expect(normalizeObjectiveAnswer(word)).toBe(digit);
      }
    });

    it('preserves currency, percent, decimals, time colons, and strips thousands commas', () => {
      expect(normalizeObjectiveAnswer('  $12.50, ')).toBe('$12.50');
      expect(normalizeObjectiveAnswer('£5!')).toBe('£5');
      expect(normalizeObjectiveAnswer('25%')).toBe('25%');
      expect(normalizeObjectiveAnswer('1,250')).toBe('1250');
      expect(normalizeObjectiveAnswer('10:30')).toBe('10:30');
      expect(normalizeObjectiveAnswer('twenty-four')).toBe('twenty 4');
      expect(normalizeObjectiveAnswer('five')).toBe('5');
    });

    it('is immune to Object.prototype property names across dictionary lookups', () => {
      expect(normalizeObjectiveAnswer('constructor')).toBe('constructor');
      expect(normalizeObjectiveAnswer('__proto__')).toBe('__proto__');
      expect(normalizeObjectiveAnswer('toString')).toBe('tostring');
      expect(normalizeObjectiveAnswer('valueOf')).toBe('valueof');
      expect(normalizeObjectiveAnswer('hasOwnProperty')).toBe('hasownproperty');

      expect(formatMicroDrillCategoryLabel('constructor')).toBe('Constructor');
      expect(formatMicroDrillCategoryLabel('__proto__')).toBe('Proto');
      expect(normalizeObjectiveQuestionType('constructor')).toBe('short_answer');
      expect(normalizeObjectiveQuestionType('__proto__')).toBe('short_answer');
      expect(normalizeWritingTaskType('constructor')).toBe('task2Essay');
      expect(isIeltsTrack('constructor' as never)).toBe(true);
      expect(formatExamScore(7, 'constructor' as never)).toBe('7.0');
    });

    it('scores all 11 objective question types with maxWords and sequence rules', () => {
      expect(normalizeObjectiveSequence('cab')).toBe('C|A|B');
      expect(normalizeObjectiveSequence('c, a, b')).toBe('C|A|B');
      expect(normalizeObjectiveSequence(' C | A | B ')).toBe('C|A|B');

      const answers: ObjectiveQuestionAnswer[] = [
        { questionId: '1', questionType: 'tfng', acceptedAnswers: ['TRUE'], userAnswer: 'true' },
        { questionId: '2', questionType: 'ynng', acceptedAnswers: ['NO'], userAnswer: 'no' },
        { questionId: '3', questionType: 'mcq_single', acceptedAnswers: ['B'], userAnswer: 'b' },
        {
          questionId: '4',
          questionType: 'mcq_multi',
          acceptedAnswers: ['A, C'],
          userAnswer: 'a, c',
        },
        {
          questionId: '5',
          questionType: 'matching_headings',
          acceptedAnswers: ['iv'],
          userAnswer: 'IV',
        },
        {
          questionId: '6',
          questionType: 'summary_gap_fill',
          acceptedAnswers: ['color'],
          userAnswer: 'colour',
          maxWords: 1,
        },
        {
          questionId: '7',
          questionType: 'short_answer',
          acceptedAnswers: ['solar energy'],
          userAnswer: 'too many words here exceed limit',
          maxWords: 2,
        },
        {
          questionId: '8',
          questionType: 'binary_choice',
          acceptedAnswers: ['this has four words yes'],
          userAnswer: 'this has four words yes',
        },
        {
          questionId: '9',
          questionType: 'word_completion',
          acceptedAnswers: ['circulate'],
          userAnswer: 'Circulate',
          maxWords: 1,
        },
        {
          questionId: '10',
          questionType: 'reorder_sequence',
          acceptedAnswers: ['C, A, B'],
          userAnswer: 'c|a|b',
        },
        {
          questionId: '11',
          questionType: 'dictation',
          acceptedAnswers: ['Museums inspire curiosity across every generation.'],
          userAnswer: 'museums inspire curiosity across every generation',
        },
      ];

      const report = scoreObjectiveAnswers({
        answers,
        skill: 'reading',
        track: 'det',
      });
      expect(report.totalCount).toBe(11);
      expect(report.correctCount).toBe(10);
      expect(report.questionCorrectness['7']).toBe(false);
      expect(report.questionCorrectness['8']).toBe(true);
      expect(report.questionCorrectness['10']).toBe(true);
      expect(report.questionCorrectness['11']).toBe(true);
      expect(report.isCalibratedFullPack).toBe(true);
      expect(report.accuracyPercent).toBe(91);
    });
  });

  describe('CountdownClockTracker', () => {
    it('tracks elapsed seconds with Math.trunc, pause, resume, and expiry', () => {
      let nowMs = 1_000_000;
      const tracker = new CountdownClockTracker({ nowMs: () => nowMs });

      tracker.start({ remainingSeconds: 60, totalSeconds: 100 });
      expect(tracker.totalSeconds).toBe(100);
      expect(tracker.currentRemaining()).toBe(60);

      // Sub-second advance truncates toward zero
      nowMs += 999;
      expect(tracker.currentRemaining()).toBe(60);

      // 10s total elapsed
      nowMs += 9001;
      expect(tracker.currentRemaining()).toBe(50);

      const pausedAt = tracker.pause();
      expect(pausedAt).toBe(50);
      expect(tracker.isPaused).toBe(true);

      // Wall clock moves while paused -> frozen
      nowMs += 30_000;
      expect(tracker.currentRemaining()).toBe(50);

      tracker.resume();
      expect(tracker.isPaused).toBe(false);
      nowMs += 50_000;
      expect(tracker.currentRemaining()).toBe(0);
      expect(tracker.isExpired).toBe(true);
    });
  });

  describe('StudyMetricsCalculator', () => {
    const dayMs = 86_400_000;
    const nowUtcMs = 20_000 * dayMs;

    it('handles unestimated summary and positive/negative 30-day delta rounding', () => {
      const empty = calculateEstimatedOverallBand({ scoredAttempts: [], targetBand: 7.5 });
      expect(empty.overallBand).toBeNull();
      expect(empty.diagnosticRecommended).toBe(true);
      expect(empty.progressToTarget).toBe(0);

      // Negative half-step delta: (-0.25 / 0.5) = -0.5 -> roundHalfAwayFromZero = -1 -> -0.5
      const negHalf = calculateEstimatedOverallBand({
        track: 'ielts_academic',
        currentUtcMs: nowUtcMs,
        scoredAttempts: [
          { score: 7.0, skill: 'reading', completedAtUtcMs: nowUtcMs - 40 * dayMs },
          { score: 6.5, skill: 'writing', completedAtUtcMs: nowUtcMs - 5 * dayMs },
          { score: 7.0, skill: 'listening', completedAtUtcMs: nowUtcMs - 2 * dayMs },
        ],
      });
      // baselineMean = 7.0, recentMean = 6.75 -> rawDelta = -0.25 -> -0.25 / 0.5 = -0.5 -> -1 * 0.5 = -0.5
      expect(negHalf.changeThisMonth).toBe(-0.5);

      // Tiny negative delta that rounds to 0 must NOT produce -0
      const zeroNeg = calculateEstimatedOverallBand({
        track: 'ielts_academic',
        currentUtcMs: nowUtcMs,
        scoredAttempts: [
          { score: 7.0, skill: 'reading', completedAtUtcMs: nowUtcMs - 40 * dayMs },
          { score: 6.9, skill: 'writing', completedAtUtcMs: nowUtcMs - 5 * dayMs },
          { score: 7.0, skill: 'listening', completedAtUtcMs: nowUtcMs - 2 * dayMs },
        ],
      });
      expect(Object.is(zeroNeg.changeThisMonth, -0)).toBe(false);
      expect(zeroNeg.changeThisMonth).toBe(0);
    });

    it('computes skill metrics, streaks, and 7-day study week', () => {
      const skills = calculateSkillMetrics({
        attempts: [
          { score: 6.5, skill: 'speaking' },
          { score: 7.0, skill: 'reading' },
        ],
      });
      expect(skills).toHaveLength(4);
      expect(skills.find((s) => s.skill === 'writing')?.scoreLabel).toBe('—');
      expect(skills.find((s) => s.skill === 'reading')?.score).toBe(7.0);

      expect(calculateCurrentStreak({ studyDays: [20000, 19999, 19998], today: 20000 })).toBe(3);
      expect(calculateCurrentStreak({ studyDays: [19999, 19998], today: 20000 })).toBe(2);
      expect(calculateCurrentStreak({ studyDays: [19998], today: 20000 })).toBe(0);

      const week = calculateStudyWeek({
        studyDays: [19998, 19999, 20000],
        today: 20000,
        weekdayOfToday: 3,
      });
      expect(week.days).toHaveLength(7);
      expect(week.completedCount).toBe(3);
      expect(week.summaryLabel).toBe('3/7 days studied');
      expect(week.days[2]?.isToday).toBe(true);
      expect(week.days[3]?.isFuture).toBe(true);
    });
  });
});

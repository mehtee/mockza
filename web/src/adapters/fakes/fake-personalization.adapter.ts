import {
  RecordBandEventRequestSchema,
  UpdatePersonalizationProfileRequestSchema,
  VocabBatchSyncRequestSchema,
} from '@mockza/contracts';
import type {
  IPersonalizationGateway,
  PersonalizationGatewayError,
  PersonalizationStateDto,
  RecordBandEventInput,
  SyncPullDto,
  UpdatePersonalizationProfileInput,
  VocabBatchSyncInput,
  VocabWaveSummaryDto,
} from '@/gateways/personalization.gateway';
import { err, ok, type Result } from '@/gateways/result';

export class FakePersonalizationAdapter implements IPersonalizationGateway {
  private state: PersonalizationStateDto;

  constructor(initial?: Partial<PersonalizationStateDto>) {
    const baseline = 6.0;
    const targetBand = 7.5;
    this.state = {
      profile: {
        examTrack: 'ielts_academic',
        targetBand,
        targetDateIso: null,
        dailyMinutesGoal: 30,
        studyFocus: 'both',
        favoriteTopics: ['technology_ai', 'career_workplace'],
        activeWeaknessPhase: 'favorite_topics',
        vocabUnlockedWave: 1,
        dailyNewVocabCap: 10,
        preferredTtsAccent: 'us',
        bandShiftAcknowledged: false,
        onboardingCompleted: true,
      },
      liveBand: {
        examTrack: 'ielts_academic',
        currentBand: 6.0,
        targetBand,
        bandShift: 0,
        confidence: 'provisional',
        skills: {
          reading: { score: 6.0, confidence: 'provisional', evidenceCount: 1, lastUpdatedAt: new Date().toISOString(), trendDelta: null },
          listening: { score: 6.0, confidence: 'provisional', evidenceCount: 1, lastUpdatedAt: new Date().toISOString(), trendDelta: null },
          writing: { score: 5.5, confidence: 'provisional', evidenceCount: 1, lastUpdatedAt: new Date().toISOString(), trendDelta: null },
          speaking: { score: 6.0, confidence: 'provisional', evidenceCount: 1, lastUpdatedAt: new Date().toISOString(), trendDelta: null },
        },
      },
      weaknesses: [
        {
          canonicalKey: 'reading:tfng_trap',
          skill: 'reading',
          displayLabelEn: 'True / False / Not Given Traps',
          displayLabelFa: 'تله‌های True / False / Not Given در ریدینگ',
          masteryScoreMilli: 340,
          evidenceCount: 3,
          status: 'active',
        },
      ],
      roadmap: {
        planId: '10000000-0000-4000-8000-000000000099',
        examTrack: 'ielts_academic',
        planRevision: 1,
        baselineBand: baseline,
        targetBand,
        isSprintMode: false,
        milestones: [
          { index: 1, titleEn: 'Baseline & Topic Ignition', titleFa: 'تثبیت پایه و علایق', phaseLabelEn: 'Phase 1 · Favorite Topics', phaseLabelFa: 'فاز ۱ · موضوعات دلخواه', targetBandDelta: 0, status: 'completed' },
          { index: 2, titleEn: 'Repair Bottlenecks in Favorite Topics', titleFa: 'رفع نقاط ضعف در موضوعات دلخواه', phaseLabelEn: 'Targeted drills + 10-Min Coach', phaseLabelFa: 'تمرین هدفمند + مربی ۱۰ دقیقه‌ای', targetBandDelta: 0.5, status: 'active' },
          { index: 3, titleEn: 'Transfer Skills to New Exam Topics', titleFa: 'انتقال مهارت به موضوعات جدید آزمون', phaseLabelEn: 'Cross-Topic Transfer', phaseLabelFa: 'فاز ۲ · موضوعات جدید', targetBandDelta: 1.0, status: 'locked' },
          { index: 4, titleEn: 'Full Mock Readiness', titleFa: 'آمادگی آزمون کامل', phaseLabelEn: 'Timed Full Simulation', phaseLabelFa: 'فاز ۳ · شبیه‌ساز کامل', targetBandDelta: 1.5, status: 'locked' },
        ],
        currentStep: {
          stepId: 'step-1',
          milestoneIndex: 2,
          stepOrder: 1,
          stepKind: 'vocab_wave',
          skill: 'vocabulary',
          titleEn: 'Wave 1 Vocabulary (Technology & AI · 10 new/day cap)',
          titleFa: 'موج ۱ واژگان (فناوری و هوش مصنوعی · سقف ۱۰ واژه جدید)',
          reasonEn: 'Build active academic collocations inside your chosen interest before practicing Reading.',
          reasonFa: 'تقویت کالوکیشن‌های تخصصی در موضوع مورد علاقه‌تان پیش از تمرین ریدینگ.',
          topicKey: 'technology_ai',
          weaknessKey: 'reading:tfng_trap',
          targetRoute: '/vocab',
          targetEntityId: null,
          status: 'active',
          estimatedMinutes: 10,
        },
        steps: [
          {
            stepId: 'step-1',
            milestoneIndex: 2,
            stepOrder: 1,
            stepKind: 'vocab_wave',
            skill: 'vocabulary',
            titleEn: 'Wave 1 Vocabulary (Technology & AI · 10 new/day cap)',
            titleFa: 'موج ۱ واژگان (فناوری و هوش مصنوعی · سقف ۱۰ واژه جدید)',
            reasonEn: 'Build active academic collocations inside your chosen interest before practicing Reading.',
            reasonFa: 'تقویت کالوکیشن‌های تخصصی در موضوع مورد علاقه‌تان پیش از تمرین ریدینگ.',
            topicKey: 'technology_ai',
            weaknessKey: 'reading:tfng_trap',
            targetRoute: '/vocab',
            targetEntityId: null,
            status: 'active',
            estimatedMinutes: 10,
          },
          {
            stepId: 'step-2',
            milestoneIndex: 2,
            stepOrder: 2,
            stepKind: 'micro_drill',
            skill: 'reading',
            titleEn: '2-Min Drill: True / False / Not Given Traps',
            titleFa: 'تمرین ۲ دقیقه‌ای: تله‌های True / False / Not Given',
            reasonEn: 'Targets your #1 reading bottleneck.',
            reasonFa: 'رفع مهم‌ترین نقطه ضعف ریدینگ شما.',
            topicKey: 'technology_ai',
            weaknessKey: 'reading:tfng_trap',
            targetRoute: '/drills',
            targetEntityId: 'drill-reading-tfng-01',
            status: 'locked',
            estimatedMinutes: 3,
          },
        ],
      },
      nextRecommendedPack: null,
      nextRecommendedDrill: null,
      recommendedPacks: [],
      recommendedDrills: [],
      vocabWaveSummary: {
        unlockedWave: 1,
        totalWaves: 12,
        currentWaveTotal: 15,
        currentWaveLearned: 4,
        readyToUnlockNext: false,
        dailyNewRemaining: 10,
      },
      topicCoverageSummary: {
        phase: 'favorite_topics',
        masteredInFavoriteTopicsCount: 0,
        transferredToOtherTopicsCount: 0,
      },
      ...initial,
    };
  }

  async getState(): Promise<Result<PersonalizationStateDto, PersonalizationGatewayError>> {
    return ok(this.state);
  }

  async updateProfile(
    input: UpdatePersonalizationProfileInput,
  ): Promise<Result<PersonalizationStateDto, PersonalizationGatewayError>> {
    const parsed = UpdatePersonalizationProfileRequestSchema.safeParse(input);
    if (!parsed.success) {
      return err({ kind: 'validation', message: parsed.error.message });
    }
    const valid = parsed.data;
    this.state = {
      ...this.state,
      profile: {
        ...this.state.profile,
        ...(valid.examTrack ? { examTrack: valid.examTrack } : {}),
        ...(valid.targetBand !== undefined ? { targetBand: valid.targetBand } : {}),
        ...(valid.targetDateIso !== undefined ? { targetDateIso: valid.targetDateIso } : {}),
        ...(valid.dailyMinutesGoal !== undefined
          ? { dailyMinutesGoal: valid.dailyMinutesGoal }
          : {}),
        ...(valid.studyFocus ? { studyFocus: valid.studyFocus } : {}),
        ...(valid.favoriteTopics ? { favoriteTopics: valid.favoriteTopics } : {}),
        ...(valid.dailyNewVocabCap !== undefined
          ? { dailyNewVocabCap: valid.dailyNewVocabCap }
          : {}),
        ...(valid.preferredTtsAccent ? { preferredTtsAccent: valid.preferredTtsAccent } : {}),
        ...(valid.onboardingCompleted !== undefined
          ? { onboardingCompleted: valid.onboardingCompleted }
          : {}),
        ...(valid.unlockNextVocabWave
          ? { vocabUnlockedWave: this.state.profile.vocabUnlockedWave + 1 }
          : {}),
      },
    };
    return ok(this.state);
  }

  async recordBandEvent(
    input: RecordBandEventInput,
  ): Promise<Result<PersonalizationStateDto, PersonalizationGatewayError>> {
    const parsed = RecordBandEventRequestSchema.safeParse(input);
    if (!parsed.success) {
      return err({ kind: 'validation', message: parsed.error.message });
    }
    const valid = parsed.data;
    const prev = this.state.liveBand.currentBand ?? valid.rawScore;
    const nextOverall = Number(((prev + valid.rawScore) / 2).toFixed(1));
    this.state = {
      ...this.state,
      liveBand: {
        ...this.state.liveBand,
        currentBand: nextOverall,
        bandShift: Number((nextOverall - prev).toFixed(1)),
      },
    };
    return ok(this.state);
  }

  async advanceRoadmapStep(
    stepId: string,
    status: 'completed' | 'skipped' | 'active',
  ): Promise<Result<PersonalizationStateDto, PersonalizationGatewayError>> {
    let unlockNext = false;
    const nextSteps = this.state.roadmap.steps.map((s) => {
      if (s.stepId === stepId) {
        if (status === 'completed' || status === 'skipped') unlockNext = true;
        return { ...s, status };
      }
      if (unlockNext && s.status === 'locked') {
        unlockNext = false;
        return { ...s, status: 'active' as const };
      }
      return s;
    });
    const nextCurrent = nextSteps.find((s) => s.status === 'active') ?? nextSteps[0] ?? null;
    this.state = {
      ...this.state,
      roadmap: {
        ...this.state.roadmap,
        steps: nextSteps,
        currentStep: nextCurrent,
      },
    };
    return ok(this.state);
  }

  async ackBandShift(): Promise<Result<{ readonly ok: boolean; readonly bandShift: number }, PersonalizationGatewayError>> {
    this.state = {
      ...this.state,
      profile: { ...this.state.profile, bandShiftAcknowledged: true },
    };
    return ok({ ok: true, bandShift: this.state.liveBand.bandShift });
  }

  async pullSync(_sinceIso?: string): Promise<Result<SyncPullDto, PersonalizationGatewayError>> {
    return ok({
      profile: this.state.profile,
      liveBand: this.state.liveBand,
      roadmap: this.state.roadmap,
      attempts: [],
      vocabSrs: [],
      pronunciationPractices: [],
      recentActivities: [],
      syncedAt: new Date().toISOString(),
    });
  }

  async pushVocabBatch(
    input: VocabBatchSyncInput,
  ): Promise<Result<VocabWaveSummaryDto, PersonalizationGatewayError>> {
    const parsed = VocabBatchSyncRequestSchema.safeParse(input);
    if (!parsed.success) {
      return err({ kind: 'validation', message: parsed.error.message });
    }
    return ok(this.state.vocabWaveSummary);
  }
}

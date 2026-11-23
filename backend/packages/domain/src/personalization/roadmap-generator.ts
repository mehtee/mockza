import type { LinguisticNodeSummary } from '../advanced/linguistic-graph-math.js';
import type { AuthoringTier } from '../diagnostic/types.js';
import type { SupportedExamId } from '../rubrics.js';
import { estimateCefrTierFromScore, mapCefrTierToExamScore } from './live-band-engine.js';
import {
  type AdaptationPhase,
  type AdaptiveContentCandidate,
  rankAdaptiveCandidates,
  selectNextCoachTopic,
  type TopicWeaknessCoverageEntry,
} from './topic-weakness-rotator.js';
import {
  type CanonicalTopicKey,
  getTopicLabel,
  normalizeFavoriteTopicList,
} from './topic-taxonomy.js';

export type RoadmapStudyFocus = 'exams' | 'coach' | 'both';
export type RoadmapStepKind =
  | 'diagnostic'
  | 'practice_pack'
  | 'micro_drill'
  | 'vocab_wave'
  | 'daily_mission'
  | 'register_shifter'
  | 'drop_anything'
  | 'full_mock';
export type RoadmapStepStatus = 'locked_preview' | 'active' | 'completed' | 'skipped';

export interface RoadmapMilestoneSummary {
  readonly index: 1 | 2 | 3 | 4;
  readonly key:
    | 'baseline_warmup'
    | 'interest_weakness_repair'
    | 'cross_topic_transfer'
    | 'full_mock_readiness';
  readonly titleEn: string;
  readonly titleFa: string;
  readonly goalEn: string;
  readonly goalFa: string;
  readonly phase: AdaptationPhase;
  readonly startDaySerial: number;
  readonly endDaySerial: number;
  readonly targetBandMarker: number;
  readonly status: 'upcoming' | 'active' | 'completed';
}

export interface RoadmapStepSpec {
  readonly stepKey: string;
  readonly milestoneIndex: 1 | 2 | 3 | 4;
  readonly stepOrder: number;
  readonly stepKind: RoadmapStepKind;
  readonly targetRefId: string;
  readonly skill: 'reading' | 'listening' | 'writing' | 'speaking' | 'vocabulary' | 'all';
  readonly topicKey: CanonicalTopicKey;
  readonly weaknessKey: string | null;
  readonly phaseTag: AdaptationPhase;
  readonly difficultyCefr: AuthoringTier;
  readonly titleEn: string;
  readonly titleFa: string;
  readonly reasonEn: string;
  readonly reasonFa: string;
  readonly estimatedMinutes: number;
  readonly status: RoadmapStepStatus;
  readonly completedRefId?: string | null;
}

export interface RoadmapPackInventoryItem extends AdaptiveContentCandidate {
  readonly examId: SupportedExamId;
  readonly skill: 'reading' | 'listening' | 'writing' | 'speaking' | 'fullMock';
  readonly title: string;
  readonly durationSeconds: number;
}

export interface RoadmapDrillInventoryItem extends AdaptiveContentCandidate {
  readonly examId: SupportedExamId;
  readonly skill: 'reading' | 'listening' | 'writing' | 'speaking';
  readonly title: string;
  readonly durationSeconds: number;
}

export interface GeneratedRoadmap {
  readonly isSprintMode: boolean;
  readonly currentPhase: AdaptationPhase;
  readonly milestones: readonly RoadmapMilestoneSummary[];
  readonly steps: readonly RoadmapStepSpec[];
  readonly activeStep: RoadmapStepSpec | null;
  readonly recalibrationReasonEn: string;
  readonly recalibrationReasonFa: string;
}

export function generateOrRecalibrateRoadmap(params: {
  readonly examId: SupportedExamId;
  readonly currentBand: number | null;
  readonly targetBand: number;
  readonly targetDateSerial: number | null;
  readonly todaySerial: number;
  readonly studyFocus: RoadmapStudyFocus;
  readonly dailyMinutesGoal: number;
  readonly favoriteTopics: readonly string[];
  readonly weaknessNodes: readonly LinguisticNodeSummary[];
  readonly coverage: readonly TopicWeaknessCoverageEntry[];
  readonly packs: readonly RoadmapPackInventoryItem[];
  readonly drills: readonly RoadmapDrillInventoryItem[];
  readonly diagnosticDone: boolean;
  readonly currentVocabWave: number;
  readonly existingCompletedStepKeys?: ReadonlySet<string>;
  readonly existingCompletedTargetRefs?: ReadonlySet<string>;
}): GeneratedRoadmap {
  const favTopics = normalizeFavoriteTopicList(params.favoriteTopics);
  const primaryFav: CanonicalTopicKey = favTopics[0] ?? 'technology_ai';
  const secondaryFav: CanonicalTopicKey = favTopics[1] ?? favTopics[0] ?? 'science_climate';
  const starterFallbackScore = mapCefrTierToExamScore('B1', params.examId);
  const baseline = params.currentBand ?? starterFallbackScore;
  const currentCefr: AuthoringTier =
    params.currentBand != null
      ? (estimateCefrTierFromScore(params.currentBand, params.examId) ?? 'B1')
      : 'B1';

  const daysRemaining =
    params.targetDateSerial != null ? Math.max(1, params.targetDateSerial - params.todaySerial) : 28;
  const isSprintMode = params.targetDateSerial != null && daysRemaining <= 7;

  const examPacks = params.packs.filter((p) => p.examId === params.examId && p.skill !== 'fullMock');
  const fullMockPack = params.packs.find((p) => p.examId === params.examId && p.skill === 'fullMock');
  const examDrills = params.drills.filter((d) => d.examId === params.examId);

  const rankedPacks = rankAdaptiveCandidates({
    candidates: examPacks,
    weaknessNodes: params.weaknessNodes,
    favoriteTopics: favTopics,
    coverage: params.coverage,
    examId: params.examId,
    currentBand: params.currentBand,
    targetBand: params.targetBand,
    currentDaySerial: params.todaySerial,
  });

  const rankedDrills = rankAdaptiveCandidates({
    candidates: examDrills,
    weaknessNodes: params.weaknessNodes,
    favoriteTopics: favTopics,
    coverage: params.coverage,
    examId: params.examId,
    currentBand: params.currentBand,
    targetBand: params.targetBand,
    currentDaySerial: params.todaySerial,
  });

  const coachSelection = selectNextCoachTopic({
    weaknessNodes: params.weaknessNodes,
    favoriteTopics: favTopics,
    coverage: params.coverage,
    currentDaySerial: params.todaySerial,
  });

  const completedKeys = params.existingCompletedStepKeys ?? new Set<string>();
  const completedRefs = params.existingCompletedTargetRefs ?? new Set<string>();

  const draftSteps: Array<Omit<RoadmapStepSpec, 'stepOrder' | 'status'>> = [];

  const favLabelEn = getTopicLabel(primaryFav, 'glb');
  const favLabelFa = getTopicLabel(primaryFav, 'irn');

  // --- MILESTONE 1: Baseline & Interest Warmup ---
  if (!params.diagnosticDone) {
    draftSteps.push({
      stepKey: 'm1:diagnostic',
      milestoneIndex: 1,
      stepKind: 'diagnostic',
      targetRefId: 'diagnostic:intro',
      skill: 'all',
      topicKey: primaryFav,
      weaknessKey: null,
      phaseTag: 'ignition',
      difficultyCefr: currentCefr,
      titleEn: 'Optional 10-Min Level Check (Set Your Band Anytime)',
      titleFa: 'ارزیابی ۱۰ دقیقه‌ای تعیین سطح (اختیاری — هر زمان آماده بودید)',
      reasonEn:
        'Measures all 4 skills to calibrate your exact band — you can skip it for now and start with the basic steps below.',
      reasonFa:
        'هر ۴ مهارت شما را می‌سنجد؛ اما اگر مایل هستید می‌توانید فعلاً از گام‌های پایه زیر شروع کنید.',
      estimatedMinutes: 10,
    });
  }

  draftSteps.push({
    stepKey: `m1:vocab:wave1`,
    milestoneIndex: 1,
    stepKind: 'vocab_wave',
    targetRefId: 'vocab:wave:1',
    skill: 'vocabulary',
    topicKey: primaryFav,
    weaknessKey: null,
    phaseTag: 'ignition',
    difficultyCefr: currentCefr,
    titleEn: `Vocab Wave 1: 15 ${favLabelEn} & Core Words`,
    titleFa: `موج اول واژگان: ۱۵ واژه کلیدی (${favLabelFa})`,
    reasonEn: `Curated around ${favLabelEn} at your ${currentCefr} level instead of 320 words at once.`,
    reasonFa: `به‌جای ۳۲۰ واژه هم‌زمان، با ۱۵ واژه کاربردی در موضوع «${favLabelFa}» و سطح ${currentCefr} شروع می‌کنید.`,
    estimatedMinutes: 8,
  });

  if (params.studyFocus !== 'exams') {
    draftSteps.push({
      stepKey: 'm1:coach:warmup',
      milestoneIndex: 1,
      stepKind: 'daily_mission',
      targetRefId: 'mission:today',
      skill: 'writing',
      topicKey: primaryFav,
      weaknessKey: null,
      phaseTag: 'ignition',
      difficultyCefr: currentCefr,
      titleEn: `10-Min Coach Warmup: ${favLabelEn}`,
      titleFa: `تمرین ۱۰ دقیقه‌ای مربی: ${favLabelFa}`,
      reasonEn: `Starts directly with your favorite topic (${favLabelEn}) to build confidence & gather language signals.`,
      reasonFa: `شروع مستقیم با موضوع مورد علاقه شما (${favLabelFa}) برای گرم‌کردن و شناسایی دقیق خطاها.`,
      estimatedMinutes: 10,
    });
  } else if (rankedPacks[0]) {
    const p0 = rankedPacks[0];
    draftSteps.push({
      stepKey: `m1:pack:${p0.item.id}`,
      milestoneIndex: 1,
      stepKind: 'practice_pack',
      targetRefId: p0.item.id,
      skill: p0.item.skill === 'fullMock' ? 'reading' : p0.item.skill,
      topicKey: p0.matchedTopic,
      weaknessKey: p0.matchedWeaknessKey,
      phaseTag: 'ignition',
      difficultyCefr: p0.item.cefrMin,
      titleEn: p0.item.title,
      titleFa: `تمرین مهارت: ${p0.item.title}`,
      reasonEn: p0.reasonEn,
      reasonFa: p0.reasonFa,
      estimatedMinutes: Math.max(10, Math.round(p0.item.durationSeconds / 60)),
    });
  }

  // --- MILESTONE 2: Fix Top Weaknesses (In Topics You Love) ---
  if (rankedDrills[0]) {
    const d0 = rankedDrills[0];
    draftSteps.push({
      stepKey: `m2:drill:${d0.item.id}`,
      milestoneIndex: 2,
      stepKind: 'micro_drill',
      targetRefId: d0.item.id,
      skill: d0.item.skill,
      topicKey: d0.matchedTopic,
      weaknessKey: d0.matchedWeaknessKey,
      phaseTag: 'interest_weakness',
      difficultyCefr: d0.item.cefrMin,
      titleEn: `3-Min Fix: ${d0.item.title}`,
      titleFa: `تمرین ۳ دقیقه‌ای هدفمند: ${d0.item.title}`,
      reasonEn: d0.reasonEn,
      reasonFa: d0.reasonFa,
      estimatedMinutes: Math.max(3, Math.round(d0.item.durationSeconds / 60)),
    });
  }

  if (params.studyFocus !== 'exams') {
    draftSteps.push({
      stepKey: 'm2:register:upgrade',
      milestoneIndex: 2,
      stepKind: 'register_shifter',
      targetRefId: 'register-shifter',
      skill: 'speaking',
      topicKey: secondaryFav,
      weaknessKey: coachSelection.primaryWeaknessKey,
      phaseTag: 'interest_weakness',
      difficultyCefr: currentCefr,
      titleEn: 'Upgrade My Speaking (Band-Calibrated Ladder + Audio Check)',
      titleFa: 'ارتقای لحن گفتار و تمرین تلفظ با مقایسه صوتی',
      reasonEn: `Speak one thought on ${getTopicLabel(secondaryFav, 'glb')} and compare everyday vs target-band phrasing.`,
      reasonFa: `یک ایده درباره «${getTopicLabel(secondaryFav, 'irn')}» بگویید و نسخه ساده تا نمره هدف را بشنوید و تمرین کنید.`,
      estimatedMinutes: 8,
    });
  }

  const m2PackCandidate = params.studyFocus === 'exams' ? rankedPacks[1] : rankedPacks[0];
  if (!isSprintMode && m2PackCandidate) {
    const p1 = m2PackCandidate;
    draftSteps.push({
      stepKey: `m2:pack:${p1.item.id}`,
      milestoneIndex: 2,
      stepKind: 'practice_pack',
      targetRefId: p1.item.id,
      skill: p1.item.skill === 'fullMock' ? 'reading' : p1.item.skill,
      topicKey: p1.matchedTopic,
      weaknessKey: p1.matchedWeaknessKey,
      phaseTag: 'interest_weakness',
      difficultyCefr: p1.item.cefrMin,
      titleEn: p1.item.title,
      titleFa: `شبیه‌ساز هدفمند: ${p1.item.title}`,
      reasonEn: p1.reasonEn,
      reasonFa: p1.reasonFa,
      estimatedMinutes: Math.max(12, Math.round(p1.item.durationSeconds / 60)),
    });
  }

  draftSteps.push({
    stepKey: `m2:vocab:wave2`,
    milestoneIndex: 2,
    stepKind: 'vocab_wave',
    targetRefId: `vocab:wave:${Math.max(2, params.currentVocabWave)}`,
    skill: 'vocabulary',
    topicKey: secondaryFav,
    weaknessKey: coachSelection.primaryWeaknessKey,
    phaseTag: 'interest_weakness',
    difficultyCefr: currentCefr,
    titleEn: 'Vocab Wave 2: Weakness-Targeting Collocations',
    titleFa: 'موج دوم واژگان: هم‌آواهای رفع نقاط ضعف',
    reasonEn: 'Unlocks 15 high-yield collocations aligned with your active weaknesses + saved mistakes.',
    reasonFa: '۱۵ ترکیب واژگانی دقیق برای رفع خطاهای ثبت‌شده و واژگان ذخیره‌شده شما.',
    estimatedMinutes: 8,
  });

  // --- MILESTONE 3: Cross-Topic Transfer & Band Push ---
  const transferTopic: CanonicalTopicKey =
    coachSelection.phase === 'cross_topic_transfer'
      ? coachSelection.topicKey
      : primaryFav === 'science_climate'
        ? 'urban_society'
        : 'science_climate';
  const transferEn = getTopicLabel(transferTopic, 'glb');
  const transferFa = getTopicLabel(transferTopic, 'irn');

  const transferPack =
    rankedPacks.find((r) => !favTopics.includes(r.matchedTopic)) ?? rankedPacks[2] ?? rankedPacks[0];
  if (transferPack) {
    draftSteps.push({
      stepKey: `m3:pack:${transferPack.item.id}`,
      milestoneIndex: 3,
      stepKind: 'practice_pack',
      targetRefId: transferPack.item.id,
      skill: transferPack.item.skill === 'fullMock' ? 'listening' : transferPack.item.skill,
      topicKey: transferPack.matchedTopic,
      weaknessKey: transferPack.matchedWeaknessKey,
      phaseTag: 'cross_topic_transfer',
      difficultyCefr: transferPack.item.cefrMax,
      titleEn: `Cross-Topic Transfer: ${transferPack.item.title}`,
      titleFa: `انتقال مهارت به موضوع جدید: ${transferPack.item.title}`,
      reasonEn: `Applies your repaired skills to a fresh exam topic (${getTopicLabel(transferPack.matchedTopic, 'glb')}).`,
      reasonFa: `مهارت تثبیت‌شده شما را روی موضوع تازه «${getTopicLabel(transferPack.matchedTopic, 'irn')}» محک می‌زند.`,
      estimatedMinutes: Math.max(15, Math.round(transferPack.item.durationSeconds / 60)),
    });
  }

  if (params.studyFocus !== 'exams') {
    draftSteps.push({
      stepKey: 'm3:coach:transfer',
      milestoneIndex: 3,
      stepKind: 'daily_mission',
      targetRefId: 'mission:today',
      skill: 'writing',
      topicKey: transferTopic,
      weaknessKey: coachSelection.primaryWeaknessKey,
      phaseTag: 'cross_topic_transfer',
      difficultyCefr: currentCefr,
      titleEn: `10-Min Coach Transfer Challenge: ${transferEn}`,
      titleFa: `چالش انتقال ۱۰ دقیقه‌ای: ${transferFa}`,
      reasonEn: coachSelection.phase === 'cross_topic_transfer'
        ? coachSelection.reasonEn
        : `Tests your active target phrases in an unfamiliar exam topic (${transferEn}).`,
      reasonFa: coachSelection.phase === 'cross_topic_transfer'
        ? coachSelection.reasonFa
        : `کاربرد ساختارهای جدید شما در یک موضوع غیرتکراری (${transferFa}).`,
      estimatedMinutes: 10,
    });
  }

  if (!isSprintMode && rankedDrills[1]) {
    const d1 = rankedDrills[1];
    draftSteps.push({
      stepKey: `m3:drill:${d1.item.id}`,
      milestoneIndex: 3,
      stepKind: 'micro_drill',
      targetRefId: d1.item.id,
      skill: d1.item.skill,
      topicKey: d1.matchedTopic,
      weaknessKey: d1.matchedWeaknessKey,
      phaseTag: 'cross_topic_transfer',
      difficultyCefr: d1.item.cefrMax,
      titleEn: `Speed Verification: ${d1.item.title}`,
      titleFa: `تثبیت سرعت و دقت: ${d1.item.title}`,
      reasonEn: d1.reasonEn,
      reasonFa: d1.reasonFa,
      estimatedMinutes: Math.max(3, Math.round(d1.item.durationSeconds / 60)),
    });
  }

  draftSteps.push({
    stepKey: 'm3:vocab:wave3',
    milestoneIndex: 3,
    stepKind: 'vocab_wave',
    targetRefId: `vocab:wave:${Math.max(3, params.currentVocabWave)}`,
    skill: 'vocabulary',
    topicKey: transferTopic,
    weaknessKey: null,
    phaseTag: 'cross_topic_transfer',
    difficultyCefr: estimateCefrTierFromScore(params.targetBand, params.examId) ?? 'C1',
    titleEn: `Vocab Wave 3: Exam Breadth (${transferEn})`,
    titleFa: `موج سوم واژگان: تنوع موضوعی آزمون (${transferFa})`,
    reasonEn: 'Expands lexical range across wider exam domains toward your target band.',
    reasonFa: 'دامنه واژگان شما را فراتر از علایق اولیه برای نمره هدف گسترش می‌دهد.',
    estimatedMinutes: 8,
  });

  // --- MILESTONE 4: Full-Exam Stamina & Target Lock ---
  const finalPack = rankedPacks[3] ?? rankedPacks[rankedPacks.length - 1];
  if (!isSprintMode && finalPack) {
    draftSteps.push({
      stepKey: `m4:pack:${finalPack.item.id}`,
      milestoneIndex: 4,
      stepKind: 'practice_pack',
      targetRefId: finalPack.item.id,
      skill: finalPack.item.skill === 'fullMock' ? 'speaking' : finalPack.item.skill,
      topicKey: finalPack.matchedTopic,
      weaknessKey: finalPack.matchedWeaknessKey,
      phaseTag: 'exam_breadth',
      difficultyCefr: finalPack.item.cefrMax,
      titleEn: `Timed Section Dress Rehearsal: ${finalPack.item.title}`,
      titleFa: `شبیه‌ساز زمان‌دار بخش پایانی: ${finalPack.item.title}`,
      reasonEn: 'Final timed check in Exam Mode to raise confidence from Developing to Calibrated.',
      reasonFa: 'تمرین زمان‌دار در حالت آزمون برای تثبیت نمره و آمادگی کامل.',
      estimatedMinutes: Math.max(15, Math.round(finalPack.item.durationSeconds / 60)),
    });
  }

  if (params.studyFocus !== 'coach' || fullMockPack) {
    draftSteps.push({
      stepKey: `m4:fullmock:${fullMockPack?.id ?? 'default'}`,
      milestoneIndex: 4,
      stepKind: 'full_mock',
      targetRefId: fullMockPack?.id ?? 'practice:full-mock',
      skill: 'all',
      topicKey: 'academic_core',
      weaknessKey: null,
      phaseTag: 'exam_breadth',
      difficultyCefr: estimateCefrTierFromScore(params.targetBand, params.examId) ?? 'C1',
      titleEn: 'Calibrated Full Mock Exam',
      titleFa: 'آزمون کامل آزمایشی استاندارد (Full Mock)',
      reasonEn: 'Measures real 4-skill stamina under strict timing and produces your calibrated score.',
      reasonFa: 'ارزیابی استقامت ۴ مهارت در شرایط واقعی آزمون و ثبت نمره کالیبره‌شده.',
      estimatedMinutes: 45,
    });
  }

  let foundFirstPending = false;
  const steps: RoadmapStepSpec[] = draftSteps.map((s, idx) => {
    const isCompleted =
      completedKeys.has(s.stepKey) ||
      (s.stepKind !== 'daily_mission' && completedRefs.has(s.targetRefId));
    let status: RoadmapStepStatus;
    if (isCompleted) {
      status = 'completed';
    } else if (!params.diagnosticDone && s.milestoneIndex === 1) {
      // Never block Milestone 1 starter basics behind an uncompleted optional diagnostic.
      status = 'active';
      if (s.stepKind !== 'diagnostic') {
        foundFirstPending = true;
      }
    } else if (!foundFirstPending) {
      status = 'active';
      foundFirstPending = true;
    } else {
      status = 'locked_preview';
    }
    return {
      ...s,
      stepOrder: idx + 1,
      status,
    };
  });

  const stepSpan = Math.max(1, Math.floor(daysRemaining / 4));
  const midTarget = Number(((baseline + params.targetBand) / 2).toFixed(1));
  const stretchTarget = Number(((midTarget + params.targetBand) / 2).toFixed(1));

  const milestoneStatus = (mIdx: 1 | 2 | 3 | 4): 'upcoming' | 'active' | 'completed' => {
    const mSteps = steps.filter((s) => s.milestoneIndex === mIdx);
    if (mSteps.length > 0 && mSteps.every((s) => s.status === 'completed')) {
      return 'completed';
    }
    if (mSteps.some((s) => s.status === 'active')) {
      return 'active';
    }
    return mIdx < (steps.find((s) => s.status === 'active')?.milestoneIndex ?? 1)
      ? 'completed'
      : 'upcoming';
  };

  const milestones: RoadmapMilestoneSummary[] = [
    {
      index: 1,
      key: 'baseline_warmup',
      titleEn: 'Baseline & Interest Warmup',
      titleFa: 'شناخت سطح و شروع با علایق',
      goalEn: `Set baseline band & start with ${favLabelEn}`,
      goalFa: `تعیین سطح اولیه و شروع با موضوع «${favLabelFa}»`,
      phase: 'ignition',
      startDaySerial: params.todaySerial,
      endDaySerial: params.todaySerial + stepSpan,
      targetBandMarker: baseline,
      status: milestoneStatus(1),
    },
    {
      index: 2,
      key: 'interest_weakness_repair',
      titleEn: 'Fix Weak Spots in Topics You Love',
      titleFa: 'رفع نقاط ضعف با موضوعات دلخواه',
      goalEn: 'Repair top bottlenecks using familiar topics + Vocab Wave 2',
      goalFa: 'رفع خطاهای کلیدی در موضوعات مورد علاقه شما',
      phase: 'interest_weakness',
      startDaySerial: params.todaySerial + stepSpan,
      endDaySerial: params.todaySerial + stepSpan * 2,
      targetBandMarker: midTarget,
      status: milestoneStatus(2),
    },
    {
      index: 3,
      key: 'cross_topic_transfer',
      titleEn: 'Cross-Topic Transfer & Band Push',
      titleFa: 'انتقال مهارت به موضوعات متنوع آزمون',
      goalEn: `Transfer fixes into broader exam topics like ${transferEn}`,
      goalFa: `آزمودن مهارت‌های رفع‌شده در موضوعات تازه مثل «${transferFa}»`,
      phase: 'cross_topic_transfer',
      startDaySerial: params.todaySerial + stepSpan * 2,
      endDaySerial: params.todaySerial + stepSpan * 3,
      targetBandMarker: stretchTarget,
      status: milestoneStatus(3),
    },
    {
      index: 4,
      key: 'full_mock_readiness',
      titleEn: 'Full-Exam Stamina & Target Lock',
      titleFa: 'شبیه‌سازی کامل و تثبیت نمره هدف',
      goalEn: `Lock target ${params.targetBand} with full timed endurance`,
      goalFa: `آمادگی کامل برای کسب نمره هدف ${params.targetBand}`,
      phase: 'exam_breadth',
      startDaySerial: params.todaySerial + stepSpan * 3,
      endDaySerial: params.targetDateSerial ?? params.todaySerial + Math.max(daysRemaining, 4),
      targetBandMarker: params.targetBand,
      status: milestoneStatus(4),
    },
  ];

  const activeStep = steps.find((s) => s.status === 'active') ?? null;

  return {
    isSprintMode,
    currentPhase: activeStep?.phaseTag ?? coachSelection.phase,
    milestones,
    steps,
    activeStep,
    recalibrationReasonEn: isSprintMode
      ? `Sprint Plan (${daysRemaining} days left): focusing strictly on highest-impact steps.`
      : `Plan calibrated around ${favLabelEn} toward Band ${params.targetBand}.`,
    recalibrationReasonFa: isSprintMode
      ? `برنامه فشرده (${daysRemaining} روز تا آزمون): تمرکز روی بیشترین رشد نمره.`
      : `نقشه راه بر اساس علاقه «${favLabelFa}» و هدف ${params.targetBand} تنظیم شد.`,
  };
}

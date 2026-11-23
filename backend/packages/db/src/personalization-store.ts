import { randomUUID } from 'node:crypto';
import {
  assignVocabWaves,
  computeLiveBandProfile,
  estimateCefrTierFromScore,
  extractObjectiveWeaknesses,
  generateOrRecalibrateRoadmap,
  mapCefrTierToExamScore,
  type AdaptationPhase,
  type AuthoringTier,
  type BandConfidence,
  type BandEvidenceEvent,
  type BandEventSourceKind,
  type CanonicalTopicKey,
  type CoreExamSkill,
  type LinguisticNodeSummary,
  type RoadmapDrillInventoryItem,
  type RoadmapPackInventoryItem,
  type SupportedExamId,
  type TopicWeaknessCoverageEntry,
  type VocabWaveCardInput,
  normalizeCanonicalTopicKey,
  normalizeFavoriteTopicList,
  normalizeScoreToQualityRatio,
  normalizeSupportedExamId,
  rankAdaptiveCandidates,
  resolveWeaknessPhase,
  selectDailyReviewQueue,
} from '@mockza/domain';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { MockzaDb } from './client.js';
import { getUtcDaySerial, upsertLinguisticGraphSignals } from './linguistic-graph-store.js';
import {
  aiUsageLedger,
  audioAssets,
  catalogPacks,
  diagnosticSessions,
  learnerBandEvents,
  learnerProfiles,
  learnerRoadmapPlans,
  learnerRoadmapSteps,
  learnerTopicWeaknessCoverage,
  linguisticEvidenceEvents,
  linguisticNodes,
  microDrills,
  pronunciationPractices,
  userActivityLedger,
  userAttemptsSync,
  userVocabSrsSync,
  vocabDeckCards,
} from './schema.js';
import { PACK_METADATA_BY_ID, DRILL_METADATA_BY_ID } from './seed-data/content-metadata.js';

function mapPhaseToContract(
  phase: AdaptationPhase,
): 'favorite_topics' | 'weakness_transfer' | 'exam_breadth' {
  if (phase === 'cross_topic_transfer') return 'weakness_transfer';
  if (phase === 'exam_breadth') return 'exam_breadth';
  return 'favorite_topics';
}

function mapSourceKindToDomain(kind: string): BandEventSourceKind {
  if (kind === 'full_mock') return 'full_mock';
  if (kind === 'practice_section' || kind === 'timed_exam' || kind === 'writing_eval' || kind === 'speaking_eval') {
    return 'timed_exam';
  }
  if (kind === 'micro_drill' || kind === 'mission' || kind === 'pronunciation') {
    return 'micro_drill';
  }
  if (kind === 'study_mode') return 'study_mode';
  return 'diagnostic';
}

function mapStepKindToRoute(stepKind: string, targetRefId: string): string {
  switch (stepKind) {
    case 'diagnostic':
      return '/diagnostic';
    case 'practice_pack':
    case 'practice_section':
    case 'full_mock':
      return targetRefId ? `/practice/${targetRefId}` : '/practice';
    case 'micro_drill':
      return targetRefId ? `/drills?focus=${encodeURIComponent(targetRefId)}` : '/drills';
    case 'vocab_wave':
      return '/vocab';
    case 'daily_mission':
      return '/coach/mission';
    case 'register_shifter':
      return '/coach/shifter';
    case 'drop_anything':
      return '/coach/drop';
    default:
      return '/roadmap';
  }
}

function normalizeCefr(raw: string | null | undefined): AuthoringTier {
  const up = (raw ?? 'B2').toUpperCase();
  if (up === 'A1' || up === 'A2' || up === 'B1' || up === 'B2' || up === 'C1' || up === 'C2') {
    return up;
  }
  return 'B2';
}

function parseDateSerial(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 86_400_000);
}

export async function getOrInitLearnerProfile(params: {
  db: MockzaDb;
  accountKey: string;
  edition: 'glb' | 'irn';
}) {
  const [existing] = await params.db
    .select()
    .from(learnerProfiles)
    .where(
      and(
        eq(learnerProfiles.accountKey, params.accountKey),
        eq(learnerProfiles.edition, params.edition),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const now = new Date();
  await params.db
    .insert(learnerProfiles)
    .values({
      accountKey: params.accountKey,
      edition: params.edition,
      examTrack: 'ielts_academic',
      targetBand: 7.5,
      dailyMinutesGoal: 30,
      studyFocus: 'both',
      favoriteTopicsJson: ['technology_ai', 'career_workplace'],
      bandConfidence: 'provisional',
      bandShift: 0,
      activeWeaknessPhase: 'favorite_topics',
      vocabUnlockedWave: 1,
      dailyNewVocabCap: 10,
      preferredTtsAccent: 'us',
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const [created] = await params.db
    .select()
    .from(learnerProfiles)
    .where(
      and(
        eq(learnerProfiles.accountKey, params.accountKey),
        eq(learnerProfiles.edition, params.edition),
      ),
    )
    .limit(1);
  return created!;
}

export async function updateLearnerProfile(params: {
  db: MockzaDb;
  accountKey: string;
  edition: 'glb' | 'irn';
  patch: {
    examTrack?: string;
    targetBand?: number;
    targetDateIso?: string | null;
    dailyMinutesGoal?: number;
    studyFocus?: 'exams' | 'coach' | 'both' | 'speaking_only';
    favoriteTopics?: string[];
    dailyNewVocabCap?: number;
    preferredTtsAccent?: 'us' | 'uk';
    onboardingCompleted?: boolean;
    unlockNextVocabWave?: boolean;
  };
}) {
  const existing = await getOrInitLearnerProfile({
    db: params.db,
    accountKey: params.accountKey,
    edition: params.edition,
  });

  const normalizedTopics = params.patch.favoriteTopics
    ? normalizeFavoriteTopicList(params.patch.favoriteTopics)
    : undefined;

  const nextExamTrack = params.patch.examTrack
    ? normalizeSupportedExamId(params.patch.examTrack)
    : undefined;

  await params.db
    .update(learnerProfiles)
    .set({
      ...(nextExamTrack ? { examTrack: nextExamTrack } : {}),
      ...(typeof params.patch.targetBand === 'number'
        ? { targetBand: params.patch.targetBand }
        : {}),
      ...(params.patch.targetDateIso !== undefined
        ? { targetDateIso: params.patch.targetDateIso }
        : {}),
      ...(typeof params.patch.dailyMinutesGoal === 'number'
        ? { dailyMinutesGoal: params.patch.dailyMinutesGoal }
        : {}),
      ...(params.patch.studyFocus ? { studyFocus: params.patch.studyFocus } : {}),
      ...(normalizedTopics ? { favoriteTopicsJson: normalizedTopics } : {}),
      ...(typeof params.patch.dailyNewVocabCap === 'number'
        ? { dailyNewVocabCap: params.patch.dailyNewVocabCap }
        : {}),
      ...(params.patch.preferredTtsAccent
        ? { preferredTtsAccent: params.patch.preferredTtsAccent }
        : {}),
      ...(typeof params.patch.onboardingCompleted === 'boolean'
        ? { onboardingCompleted: params.patch.onboardingCompleted }
        : {}),
      ...(params.patch.unlockNextVocabWave
        ? { vocabUnlockedWave: existing.vocabUnlockedWave + 1 }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(learnerProfiles.accountKey, params.accountKey),
        eq(learnerProfiles.edition, params.edition),
      ),
    );

  // Sync pinned favorite topics into linguistic_nodes as interest_topic
  if (normalizedTopics && normalizedTopics.length > 0) {
    await upsertLinguisticGraphSignals({
      db: params.db,
      accountKey: params.accountKey,
      edition: params.edition,
      sourceKind: 'diagnostic',
      sourceRefId: `profile-interests-${Date.now()}`,
      signals: normalizedTopics.map((topicKey) => ({
        nodeKind: 'interest_topic' as const,
        canonicalKey: `topic:${topicKey}`,
        displayLabelEn: topicKey,
        displayLabelFa: topicKey,
        coachNoteEn: 'Selected onboarding favorite topic.',
        coachNoteFa: 'موضوع علاقه‌مندی انتخاب‌شده توسط شما.',
        observedPolarity: 'interest_matched' as const,
        excerptText: null,
        skill: 'mixed',
        detectedFrom: 'onboarding',
      })),
    });
  }

  return computeFullPersonalizationState({
    db: params.db,
    accountKey: params.accountKey,
    edition: params.edition,
    recalibrateRoadmap: true,
    persistLiveBand: true,
  });
}

export async function recordBandEventAndRecalculate(params: {
  db: MockzaDb;
  accountKey: string;
  edition: 'glb' | 'irn';
  examTrack: string;
  skill: CoreExamSkill;
  sourceKind: string;
  sourceId: string;
  rawScore: number;
  cefrEstimate?: string | null;
  durationSeconds?: number;
  accuracyRatio?: number;
  topicKeys?: string[];
  questionTypeStats?: Array<{ questionType: string; correct: number; total: number }>;
}) {
  await getOrInitLearnerProfile({
    db: params.db,
    accountKey: params.accountKey,
    edition: params.edition,
  });

  const normalizedTopics = params.topicKeys
    ? params.topicKeys
        .map((t) => normalizeCanonicalTopicKey(t))
        .filter((t): t is CanonicalTopicKey => Boolean(t))
    : [];

  const extractedSignals =
    params.questionTypeStats && params.questionTypeStats.length > 0
      ? extractObjectiveWeaknesses({
          skill: params.skill,
          questionTypeStats: params.questionTypeStats,
        })
      : [];

  const weaknessKeys = extractedSignals
    .filter((s) => s.observedPolarity === 'gap_observed')
    .map((s) => s.canonicalKey);

  const now = new Date();
  await params.db
    .insert(learnerBandEvents)
    .values({
      eventId: randomUUID(),
      accountKey: params.accountKey,
      edition: params.edition,
      examTrack: normalizeSupportedExamId(params.examTrack),
      skill: params.skill,
      sourceKind: params.sourceKind,
      sourceId: params.sourceId,
      rawScore: params.rawScore,
      cefrEstimate: params.cefrEstimate ?? null,
      weightMilli: 1000,
      durationSeconds: params.durationSeconds ?? null,
      accuracyRatio: params.accuracyRatio ?? null,
      topicKeysJson: normalizedTopics,
      weaknessKeysJson: weaknessKeys,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [
        learnerBandEvents.accountKey,
        learnerBandEvents.edition,
        learnerBandEvents.sourceKind,
        learnerBandEvents.sourceId,
        learnerBandEvents.skill,
      ],
      set: {
        rawScore: params.rawScore,
        cefrEstimate: params.cefrEstimate ?? null,
        durationSeconds: params.durationSeconds ?? null,
        accuracyRatio: params.accuracyRatio ?? null,
        topicKeysJson: normalizedTopics,
        weaknessKeysJson: weaknessKeys,
      },
    });

  if (extractedSignals.length > 0) {
    await upsertLinguisticGraphSignals({
      db: params.db,
      accountKey: params.accountKey,
      edition: params.edition,
      sourceKind: 'objective_practice',
      sourceRefId: params.sourceId,
      signals: extractedSignals.map((s) => ({
        nodeKind: s.observedPolarity === 'gap_observed' ? 'bottleneck' : 'target_structure',
        canonicalKey: s.canonicalKey,
        displayLabelEn: s.displayLabelEn,
        displayLabelFa: s.displayLabelFa,
        coachNoteEn: s.coachNoteEn,
        coachNoteFa: s.coachNoteFa,
        observedPolarity: s.observedPolarity,
        excerptText: null,
        skill: s.skillScope === 'vocabulary' ? 'mixed' : s.skillScope,
        detectedFrom: 'objective',
      })),
    });
  }

  // Record Topic x Weakness coverage for phase rotation (when practiced inside a topic)
  const targetWeaknessesForCoverage =
    weaknessKeys.length > 0
      ? weaknessKeys
      : extractedSignals.map((s) => s.canonicalKey);

  const effectiveExamId = normalizeSupportedExamId(params.examTrack);
  const normalizedQuality = normalizeScoreToQualityRatio(params.rawScore, effectiveExamId);
  const succeeded = (params.accuracyRatio ?? normalizedQuality) >= 0.72;

  for (const wKey of targetWeaknessesForCoverage) {
    for (const tKey of normalizedTopics) {
      await params.db
        .insert(learnerTopicWeaknessCoverage)
        .values({
          coverageId: randomUUID(),
          accountKey: params.accountKey,
          edition: params.edition,
          weaknessKey: wKey,
          topicKey: tKey,
          attemptsCount: 1,
          successesCount: succeeded ? 1 : 0,
          masteredInTopic: false,
          lastPracticedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            learnerTopicWeaknessCoverage.accountKey,
            learnerTopicWeaknessCoverage.edition,
            learnerTopicWeaknessCoverage.weaknessKey,
            learnerTopicWeaknessCoverage.topicKey,
          ],
          set: {
            attemptsCount: sql`${learnerTopicWeaknessCoverage.attemptsCount} + 1`,
            successesCount: sql`${learnerTopicWeaknessCoverage.successesCount} + ${succeeded ? 1 : 0}`,
            masteredInTopic: sql`CASE WHEN ${learnerTopicWeaknessCoverage.successesCount} + ${succeeded ? 1 : 0} >= 2 THEN true ELSE ${learnerTopicWeaknessCoverage.masteredInTopic} END`,
            lastPracticedAt: now,
          },
        });
    }
  }

  return computeFullPersonalizationState({
    db: params.db,
    accountKey: params.accountKey,
    edition: params.edition,
    recalibrateRoadmap: true,
    persistLiveBand: true,
  });
}

export async function acknowledgeBandShift(params: {
  db: MockzaDb;
  accountKey: string;
  edition: 'glb' | 'irn';
}): Promise<number> {
  const now = new Date();
  await params.db
    .update(learnerProfiles)
    .set({
      bandShift: 0,
      bandShiftAckAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(learnerProfiles.accountKey, params.accountKey),
        eq(learnerProfiles.edition, params.edition),
      ),
    );
  return 0;
}

export async function advanceRoadmapStep(params: {
  db: MockzaDb;
  accountKey: string;
  edition: 'glb' | 'irn';
  stepId: string;
  status: 'completed' | 'skipped' | 'active';
}) {
  const now = new Date();
  const [step] = await params.db
    .select()
    .from(learnerRoadmapSteps)
    .where(
      and(
        eq(learnerRoadmapSteps.stepId, params.stepId),
        eq(learnerRoadmapSteps.accountKey, params.accountKey),
      ),
    )
    .limit(1);

  if (step && step.status !== params.status) {
    await params.db
      .update(learnerRoadmapSteps)
      .set({
        status: params.status,
        ...(params.status === 'completed' ? { completedAt: now } : {}),
      })
      .where(
        and(
          eq(learnerRoadmapSteps.stepId, params.stepId),
          eq(learnerRoadmapSteps.accountKey, params.accountKey),
        ),
      );

    // Unlock next pending step only when transitioning into completed or skipped
    if (params.status === 'completed' || params.status === 'skipped') {
      const siblingSteps = await params.db
        .select()
        .from(learnerRoadmapSteps)
        .where(eq(learnerRoadmapSteps.planId, step.planId))
        .orderBy(learnerRoadmapSteps.stepOrder);
      const nextLocked = siblingSteps.find(
        (s) => s.stepOrder > step.stepOrder && (s.status === 'locked' || s.status === 'locked_preview'),
      );
      if (nextLocked) {
        await params.db
          .update(learnerRoadmapSteps)
          .set({ status: 'active' })
          .where(eq(learnerRoadmapSteps.stepId, nextLocked.stepId));
        await params.db
          .update(learnerRoadmapPlans)
          .set({ activeStepId: nextLocked.stepId, updatedAt: now })
          .where(eq(learnerRoadmapPlans.planId, step.planId));
      }
    }
  }

  return computeFullPersonalizationState({
    db: params.db,
    accountKey: params.accountKey,
    edition: params.edition,
    recalibrateRoadmap: false,
    persistLiveBand: false,
  });
}

export async function computeFullPersonalizationState(params: {
  db: MockzaDb;
  accountKey: string;
  edition: 'glb' | 'irn';
  recalibrateRoadmap?: boolean;
  persistLiveBand?: boolean;
}) {
  const profileRow = await getOrInitLearnerProfile({
    db: params.db,
    accountKey: params.accountKey,
    edition: params.edition,
  });
  const examId: SupportedExamId = normalizeSupportedExamId(profileRow.examTrack);
  const now = new Date();
  const todaySerial = getUtcDaySerial(now);

  const [eventRows, nodeRows, coverageRows, packRows, drillRows, vocabCards, srsRows, diagRows] =
    await Promise.all([
      params.db
        .select()
        .from(learnerBandEvents)
        .where(
          and(
            eq(learnerBandEvents.accountKey, params.accountKey),
            eq(learnerBandEvents.edition, params.edition),
          ),
        )
        .orderBy(learnerBandEvents.createdAt),
      params.db
        .select()
        .from(linguisticNodes)
        .where(
          and(
            eq(linguisticNodes.accountKey, params.accountKey),
            eq(linguisticNodes.edition, params.edition),
          ),
        ),
      params.db
        .select()
        .from(learnerTopicWeaknessCoverage)
        .where(
          and(
            eq(learnerTopicWeaknessCoverage.accountKey, params.accountKey),
            eq(learnerTopicWeaknessCoverage.edition, params.edition),
          ),
        ),
      params.db
        .select()
        .from(catalogPacks)
        .where(and(eq(catalogPacks.edition, params.edition), eq(catalogPacks.isPublished, true))),
      params.db.select().from(microDrills).where(eq(microDrills.isPublished, true)),
      params.db.select().from(vocabDeckCards).where(eq(vocabDeckCards.isPublished, true)),
      params.db
        .select()
        .from(userVocabSrsSync)
        .where(
          and(
            eq(userVocabSrsSync.accountKey, params.accountKey),
            eq(userVocabSrsSync.edition, params.edition),
          ),
        ),
      params.db
        .select()
        .from(diagnosticSessions)
        .where(
          and(
            eq(diagnosticSessions.accountKey, params.accountKey),
            eq(diagnosticSessions.status, 'completed'),
          ),
        )
        .orderBy(desc(diagnosticSessions.createdAt))
        .limit(1),
    ]);

  const domainBandEvents: BandEvidenceEvent[] = eventRows.map((e) => ({
    skill: (e.skill as CoreExamSkill) ?? 'reading',
    sourceKind: mapSourceKindToDomain(e.sourceKind),
    rawScore: e.rawScore,
    cefrEstimate: e.cefrEstimate ? normalizeCefr(e.cefrEstimate) : null,
    recordedAtMs: e.createdAt.getTime(),
  }));

  const liveBand = computeLiveBandProfile({
    events: domainBandEvents,
    examId,
    targetBand: profileRow.targetBand,
    previousOverallScore: profileRow.currentBand ?? null,
    nowUtcMs: now.getTime(),
  });

  const weaknessSummaries: LinguisticNodeSummary[] = nodeRows
    .filter((n) => n.nodeKind === 'bottleneck' && !n.isMuted)
    .map((n) => ({
      nodeId: n.nodeId,
      nodeKind: 'bottleneck',
      canonicalKey: n.canonicalKey,
      displayLabelEn: n.displayLabelEn,
      displayLabelFa: n.displayLabelFa ?? n.displayLabelEn,
      masteryScoreMilli: n.masteryScoreMilli,
      signalWeightMilli: n.signalWeightMilli,
      evidenceCount: n.evidenceCount,
      lastSeenDaySerial: n.lastSeenDaySerial,
      isPinned: n.isPinned,
      isMuted: n.isMuted,
    }));

  const favTopics = normalizeFavoriteTopicList(profileRow.favoriteTopicsJson);
  const coverageEntries: TopicWeaknessCoverageEntry[] = coverageRows.map((c) => ({
    weaknessKey: c.weaknessKey,
    topicKey: normalizeCanonicalTopicKey(c.topicKey) ?? 'academic_core',
    practiceCount: c.attemptsCount,
    passCount: c.successesCount,
    lastMasteryMilli: c.masteredInTopic ? 820 : c.successesCount > 0 ? 600 : 350,
    lastPracticedDaySerial: c.lastPracticedAt
      ? getUtcDaySerial(c.lastPracticedAt)
      : todaySerial - 7,
  }));

  const phaseDecision = resolveWeaknessPhase({
    weaknessNodes: weaknessSummaries,
    favoriteTopics: favTopics,
    coverage: coverageEntries,
    currentDaySerial: todaySerial,
  });

  const mappedPhase = mapPhaseToContract(phaseDecision.overallPhase);
  const contractConf: BandConfidence =
    liveBand.overallConfidence === 'none' ? 'provisional' : liveBand.overallConfidence;
  const computedDelta = liveBand.bandShift?.delta ?? 0;
  // Preserve unacknowledged bandShift across read-only GETs; update when persisting mutating recalc
  const bandShiftVal = params.persistLiveBand
    ? computedDelta !== 0
      ? computedDelta
      : profileRow.bandShift
    : profileRow.bandShift;

  if (params.persistLiveBand || profileRow.lastBandRecalcAt == null) {
    await params.db
      .update(learnerProfiles)
      .set({
        currentBand: liveBand.overallScore,
        currentReadingBand: liveBand.skills.reading.score,
        currentListeningBand: liveBand.skills.listening.score,
        currentWritingBand: liveBand.skills.writing.score,
        currentSpeakingBand: liveBand.skills.speaking.score,
        bandConfidence: contractConf,
        bandShift: bandShiftVal,
        ...(computedDelta !== 0 ? { bandShiftAckAt: null } : {}),
        activeWeaknessPhase: mappedPhase,
        lastBandRecalcAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(learnerProfiles.accountKey, params.accountKey),
          eq(learnerProfiles.edition, params.edition),
        ),
      );
  }

  // Build candidate inventories for rotator & roadmap
  const packInventory: RoadmapPackInventoryItem[] = packRows.map((p) => {
    const meta = PACK_METADATA_BY_ID[p.packId];
    const topicKeys = (
      p.topicKeysJson.length > 0 ? p.topicKeysJson : (meta?.topicKeys ?? ['academic_core'])
    )
      .map((t) => normalizeCanonicalTopicKey(t))
      .filter((t): t is CanonicalTopicKey => Boolean(t));
    return {
      id: p.packId,
      examId: normalizeSupportedExamId(p.examId),
      skill: p.skill === 'full_mock' ? 'fullMock' : (p.skill as 'reading' | 'listening' | 'writing' | 'speaking'),
      title: p.title || p.packId,
      durationSeconds: p.durationSeconds,
      topicKeys: topicKeys.length > 0 ? topicKeys : ['academic_core'],
      weaknessTags:
        p.weaknessTargetsJson.length > 0
          ? p.weaknessTargetsJson
          : (meta?.weaknessTags ?? []),
      cefrMin: normalizeCefr(p.cefrMin || meta?.cefrMin),
      cefrMax: normalizeCefr(p.cefrMax || meta?.cefrMax),
    };
  });

  const drillInventory: RoadmapDrillInventoryItem[] = drillRows.map((d) => {
    const meta = DRILL_METADATA_BY_ID[d.drillId];
    const topicKeys = (
      d.topicKeysJson.length > 0 ? d.topicKeysJson : (meta?.topicKeys ?? ['academic_core'])
    )
      .map((t) => normalizeCanonicalTopicKey(t))
      .filter((t): t is CanonicalTopicKey => Boolean(t));
    return {
      id: d.drillId,
      examId,
      skill: (d.skill as 'reading' | 'listening' | 'writing' | 'speaking') ?? 'reading',
      title: d.title,
      durationSeconds: d.durationSeconds,
      topicKeys: topicKeys.length > 0 ? topicKeys : ['academic_core'],
      weaknessTags:
        d.weaknessTargetsJson.length > 0
          ? d.weaknessTargetsJson
          : (meta?.weaknessTags ?? []),
      cefrMin: normalizeCefr(d.cefrMin || meta?.cefrMin),
      cefrMax: normalizeCefr(d.cefrMax || meta?.cefrMax),
    };
  });

  const rankedPacks = rankAdaptiveCandidates({
    candidates: packInventory.filter((p) => p.examId === examId),
    favoriteTopics: favTopics,
    weaknessNodes: weaknessSummaries,
    coverage: coverageEntries,
    currentBand: liveBand.overallScore,
    targetBand: profileRow.targetBand,
    examId,
    currentDaySerial: todaySerial,
  });

  const rankedDrills = rankAdaptiveCandidates({
    candidates: drillInventory,
    favoriteTopics: favTopics,
    weaknessNodes: weaknessSummaries,
    coverage: coverageEntries,
    currentBand: liveBand.overallScore,
    targetBand: profileRow.targetBand,
    examId,
    currentDaySerial: todaySerial,
  });

  // Vocab wave computation
  const srsByCard = new Map(srsRows.map((s) => [s.cardId, s]));
  const vocabInputs: VocabWaveCardInput[] = vocabCards.map((c, idx) => {
    const srs = srsByCard.get(c.cardId);
    return {
      cardId: c.cardId,
      headword: c.headword,
      canonicalTopicKey: normalizeCanonicalTopicKey(c.canonicalTopic) ?? undefined,
      legacyTopicTag: c.topicTag,
      cefrLevel: normalizeCefr(c.cefrLevel),
      baseWaveOrder: c.baseWaveOrder ?? idx + 1,
      sourceKind: (srs?.sourceKind as 'seeded' | 'mistake_to_deck') ?? 'seeded',
      repetitions: srs?.repetitions ?? 0,
      dueSerialDay: srs?.dueSerialDay ?? todaySerial,
      isMastered: (srs?.repetitions ?? 0) >= 3 && (srs?.lapses ?? 0) === 0,
    };
  });

  const activeWeakKeys = weaknessSummaries.slice(0, 4).map((w) => w.canonicalKey);
  const waveResult = assignVocabWaves({
    cards: vocabInputs,
    favoriteTopics: favTopics,
    examId,
    currentBand: liveBand.overallScore,
    targetBand: profileRow.targetBand,
    activeWeaknessKeys: activeWeakKeys,
    unlockedWave: profileRow.vocabUnlockedWave,
  });

  const newToday = srsRows.filter(
    (s) =>
      s.repetitions === 1 &&
      s.lastReviewedAt &&
      getUtcDaySerial(s.lastReviewedAt) === todaySerial,
  ).length;

  const waveDaily = selectDailyReviewQueue({
    assigned: waveResult.assigned,
    todaySerialDay: todaySerial,
    newCardsIntroducedToday: newToday,
    unlockedWave: profileRow.vocabUnlockedWave,
    dailyNewCap: profileRow.dailyNewVocabCap,
  });

  // Roadmap plan: fetch existing active plan or generate / recalibrate
  const [existingPlan] = await params.db
    .select()
    .from(learnerRoadmapPlans)
    .where(
      and(
        eq(learnerRoadmapPlans.accountKey, params.accountKey),
        eq(learnerRoadmapPlans.edition, params.edition),
        eq(learnerRoadmapPlans.status, 'active'),
      ),
    )
    .orderBy(desc(learnerRoadmapPlans.planRevision))
    .limit(1);

  let existingSteps = existingPlan
    ? await params.db
        .select()
        .from(learnerRoadmapSteps)
        .where(eq(learnerRoadmapSteps.planId, existingPlan.planId))
        .orderBy(learnerRoadmapSteps.stepOrder)
    : [];

  let finalPlan = existingPlan;
  if (!finalPlan || params.recalibrateRoadmap || existingSteps.length === 0) {
    const completedRefs = new Set(
      existingSteps
        .filter((s) => s.status === 'completed')
        .map((s) => s.targetEntityId ?? '')
        .filter((v) => v.length > 0),
    );
    const completedTitles = new Set(
      existingSteps.filter((s) => s.status === 'completed').map((s) => s.titleEn),
    );

    const studyFocusMap =
      profileRow.studyFocus === 'speaking_only' || profileRow.studyFocus === 'coach'
        ? ('coach' as const)
        : profileRow.studyFocus === 'exams'
          ? ('exams' as const)
          : ('both' as const);

    const generated = generateOrRecalibrateRoadmap({
      examId,
      currentBand: liveBand.overallScore,
      targetBand: profileRow.targetBand,
      targetDateSerial: parseDateSerial(profileRow.targetDateIso),
      todaySerial,
      studyFocus: studyFocusMap,
      dailyMinutesGoal: profileRow.dailyMinutesGoal,
      favoriteTopics: favTopics,
      weaknessNodes: weaknessSummaries,
      coverage: coverageEntries,
      packs: packInventory,
      drills: drillInventory,
      diagnosticDone: diagRows.length > 0 || eventRows.length > 0,
      currentVocabWave: profileRow.vocabUnlockedWave,
      existingCompletedStepKeys: completedTitles,
      existingCompletedTargetRefs: completedRefs,
    });

    const planId = finalPlan?.planId ?? randomUUID();
    const nextRevision = (finalPlan?.planRevision ?? 0) + 1;
    const baseline =
      liveBand.overallScore ?? mapCefrTierToExamScore('B1', examId);

    const stepRowsToInsert = generated.steps.map((s) => ({
      stepId: randomUUID(),
      planId,
      accountKey: params.accountKey,
      milestoneIndex: s.milestoneIndex,
      stepOrder: s.stepOrder,
      stepKind: s.stepKind,
      skill: s.skill,
      titleEn: s.titleEn,
      titleFa: s.titleFa,
      reasonEn: s.reasonEn,
      reasonFa: s.reasonFa,
      topicKey: s.topicKey,
      weaknessKey: s.weaknessKey,
      targetRoute: mapStepKindToRoute(s.stepKind, s.targetRefId),
      targetEntityId: s.targetRefId || null,
      status: s.status === 'locked_preview' ? 'locked' : s.status,
      estimatedMinutes: s.estimatedMinutes,
      completedAt: s.status === 'completed' ? now : null,
      createdAt: now,
    }));

    const activeInserted =
      (liveBand.overallScore == null && profileRow.onboardingCompleted
        ? stepRowsToInsert.find((s) => s.status === 'active' && s.stepKind !== 'diagnostic')
        : undefined) ??
      stepRowsToInsert.find((s) => s.status === 'active') ??
      stepRowsToInsert[0] ??
      null;
    if (activeInserted && activeInserted.status === 'locked') {
      activeInserted.status = 'active';
    }

    const milestonesJson = generated.milestones.map((m) => ({
      index: m.index,
      titleEn: m.titleEn,
      titleFa: m.titleFa,
      phaseLabelEn: m.goalEn,
      phaseLabelFa: m.goalFa,
      targetBandDelta: Number((m.targetBandMarker - baseline).toFixed(1)),
      status: m.status === 'upcoming' ? 'locked' : m.status,
    }));

    await params.db.transaction(async (tx) => {
      await tx
        .insert(learnerRoadmapPlans)
        .values({
          planId,
          accountKey: params.accountKey,
          edition: params.edition,
          examTrack: examId,
          planRevision: nextRevision,
          baselineBand: baseline,
          targetBand: profileRow.targetBand,
          isSprintMode: generated.isSprintMode,
          milestonesJson,
          activeStepId: activeInserted?.stepId ?? null,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: learnerRoadmapPlans.planId,
          set: {
            examTrack: examId,
            planRevision: nextRevision,
            baselineBand: baseline,
            targetBand: profileRow.targetBand,
            isSprintMode: generated.isSprintMode,
            milestonesJson,
            activeStepId: activeInserted?.stepId ?? null,
            updatedAt: now,
          },
        });

      await tx.delete(learnerRoadmapSteps).where(eq(learnerRoadmapSteps.planId, planId));
      if (stepRowsToInsert.length > 0) {
        await tx.insert(learnerRoadmapSteps).values(stepRowsToInsert);
      }
    });

    finalPlan = {
      planId,
      accountKey: params.accountKey,
      edition: params.edition,
      examTrack: examId,
      planRevision: nextRevision,
      baselineBand: baseline,
      targetBand: profileRow.targetBand,
      isSprintMode: generated.isSprintMode,
      milestonesJson,
      activeStepId: activeInserted?.stepId ?? null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    existingSteps = stepRowsToInsert;
  }

  const mappedSteps = existingSteps.map((s) => ({
    stepId: s.stepId,
    milestoneIndex: Math.min(4, Math.max(1, s.milestoneIndex)),
    stepOrder: s.stepOrder,
    stepKind: s.stepKind as
      | 'vocab_wave'
      | 'micro_drill'
      | 'daily_mission'
      | 'practice_section'
      | 'practice_pack'
      | 'full_mock'
      | 'pronunciation'
      | 'register_shifter'
      | 'drop_anything'
      | 'diagnostic',
    skill: ((s as { skill?: string }).skill ?? 'all') as
      | 'reading'
      | 'listening'
      | 'writing'
      | 'speaking'
      | 'vocabulary'
      | 'all',
    titleEn: s.titleEn,
    titleFa: s.titleFa,
    reasonEn: s.reasonEn,
    reasonFa: s.reasonFa,
    topicKey: s.topicKey,
    weaknessKey: s.weaknessKey ?? null,
    targetRoute: s.targetRoute,
    targetEntityId: s.targetEntityId ?? null,
    status: (s.status === 'locked_preview' ? 'locked' : s.status) as
      | 'locked'
      | 'active'
      | 'completed'
      | 'skipped',
    estimatedMinutes: s.estimatedMinutes,
  }));

  const currentStep =
    mappedSteps.find((s) => s.stepId === finalPlan?.activeStepId) ??
    mappedSteps.find((s) => s.status === 'active') ??
    mappedSteps[0] ??
    null;

  const skillConfFor = (c: BandConfidence): 'provisional' | 'developing' | 'calibrated' =>
    c === 'none' ? 'provisional' : c;

  const normalizedFocus: 'exams' | 'coach' | 'both' | 'speaking_only' =
    profileRow.studyFocus === 'exams' ||
    profileRow.studyFocus === 'coach' ||
    profileRow.studyFocus === 'speaking_only'
      ? profileRow.studyFocus
      : 'both';

  return {
    profile: {
      examTrack: examId,
      targetBand: profileRow.targetBand,
      targetDateIso: profileRow.targetDateIso ?? null,
      dailyMinutesGoal: profileRow.dailyMinutesGoal,
      studyFocus: normalizedFocus,
      favoriteTopics: favTopics,
      activeWeaknessPhase: mappedPhase,
      vocabUnlockedWave: profileRow.vocabUnlockedWave,
      dailyNewVocabCap: profileRow.dailyNewVocabCap,
      preferredTtsAccent: (profileRow.preferredTtsAccent === 'uk' ? 'uk' : 'us') as 'us' | 'uk',
      bandShiftAcknowledged: Boolean(profileRow.bandShiftAckAt),
      onboardingCompleted: profileRow.onboardingCompleted,
    },
    liveBand: {
      examTrack: examId,
      currentBand: liveBand.overallScore,
      targetBand: profileRow.targetBand,
      bandShift: bandShiftVal,
      confidence: skillConfFor(liveBand.overallConfidence),
      skills: {
        reading: {
          score: liveBand.skills.reading.score,
          confidence: skillConfFor(liveBand.skills.reading.confidence),
          evidenceCount: liveBand.skills.reading.sampleCount,
          lastUpdatedAt: liveBand.skills.reading.lastUpdatedAtMs
            ? new Date(liveBand.skills.reading.lastUpdatedAtMs).toISOString()
            : null,
          trendDelta: liveBand.skills.reading.trendDelta,
        },
        listening: {
          score: liveBand.skills.listening.score,
          confidence: skillConfFor(liveBand.skills.listening.confidence),
          evidenceCount: liveBand.skills.listening.sampleCount,
          lastUpdatedAt: liveBand.skills.listening.lastUpdatedAtMs
            ? new Date(liveBand.skills.listening.lastUpdatedAtMs).toISOString()
            : null,
          trendDelta: liveBand.skills.listening.trendDelta,
        },
        writing: {
          score: liveBand.skills.writing.score,
          confidence: skillConfFor(liveBand.skills.writing.confidence),
          evidenceCount: liveBand.skills.writing.sampleCount,
          lastUpdatedAt: liveBand.skills.writing.lastUpdatedAtMs
            ? new Date(liveBand.skills.writing.lastUpdatedAtMs).toISOString()
            : null,
          trendDelta: liveBand.skills.writing.trendDelta,
        },
        speaking: {
          score: liveBand.skills.speaking.score,
          confidence: skillConfFor(liveBand.skills.speaking.confidence),
          evidenceCount: liveBand.skills.speaking.sampleCount,
          lastUpdatedAt: liveBand.skills.speaking.lastUpdatedAtMs
            ? new Date(liveBand.skills.speaking.lastUpdatedAtMs).toISOString()
            : null,
          trendDelta: liveBand.skills.speaking.trendDelta,
        },
      },
    },
    weaknesses: nodeRows
      .filter((n) => n.nodeKind === 'bottleneck' && !n.isMuted)
      .slice(0, 12)
      .map((n) => ({
        canonicalKey: n.canonicalKey,
        skill: (n.skill as 'reading' | 'listening' | 'writing' | 'speaking' | 'mixed') ?? 'mixed',
        displayLabelEn: n.displayLabelEn,
        displayLabelFa: n.displayLabelFa ?? n.displayLabelEn,
        masteryScoreMilli: n.masteryScoreMilli,
        evidenceCount: n.evidenceCount,
        status: (n.masteryScoreMilli >= 780
          ? 'mastered'
          : n.masteryScoreMilli >= 550
            ? 'resolving'
            : 'active') as 'active' | 'resolving' | 'mastered',
      })),
    roadmap: {
      planId: finalPlan.planId,
      examTrack: examId,
      planRevision: finalPlan.planRevision,
      baselineBand: finalPlan.baselineBand,
      targetBand: finalPlan.targetBand,
      isSprintMode: finalPlan.isSprintMode,
      milestones: finalPlan.milestonesJson.map((m) => ({
        index: Number(m['index'] ?? 1),
        titleEn: String(m['titleEn'] ?? ''),
        titleFa: String(m['titleFa'] ?? ''),
        phaseLabelEn: String(m['phaseLabelEn'] ?? ''),
        phaseLabelFa: String(m['phaseLabelFa'] ?? ''),
        targetBandDelta: Number(m['targetBandDelta'] ?? 0),
        status: (m['status'] as 'locked' | 'active' | 'completed') ?? 'locked',
      })),
      currentStep,
      steps: mappedSteps,
    },
    nextRecommendedPack: rankedPacks[0]
      ? {
          packId: rankedPacks[0].item.id,
          score: rankedPacks[0].score,
          phase: mapPhaseToContract(rankedPacks[0].phase),
          topicKey: rankedPacks[0].matchedTopic,
          weaknessKey: rankedPacks[0].matchedWeaknessKey,
          reasonEn: rankedPacks[0].reasonEn,
          reasonFa: rankedPacks[0].reasonFa,
        }
      : null,
    nextRecommendedDrill: rankedDrills[0]
      ? {
          drillId: rankedDrills[0].item.id,
          score: rankedDrills[0].score,
          phase: mapPhaseToContract(rankedDrills[0].phase),
          topicKey: rankedDrills[0].matchedTopic,
          weaknessKey: rankedDrills[0].matchedWeaknessKey,
          reasonEn: rankedDrills[0].reasonEn,
          reasonFa: rankedDrills[0].reasonFa,
        }
      : null,
    recommendedPacks: rankedPacks.slice(0, 12).map((r) => ({
      packId: r.item.id,
      score: r.score,
      phase: mapPhaseToContract(r.phase),
      topicKey: r.matchedTopic,
      weaknessKey: r.matchedWeaknessKey,
      reasonEn: r.reasonEn,
      reasonFa: r.reasonFa,
    })),
    recommendedDrills: rankedDrills.slice(0, 7).map((r) => ({
      drillId: r.item.id,
      score: r.score,
      phase: mapPhaseToContract(r.phase),
      topicKey: r.matchedTopic,
      weaknessKey: r.matchedWeaknessKey,
      reasonEn: r.reasonEn,
      reasonFa: r.reasonFa,
    })),
    vocabWaveSummary: waveDaily.summary,
    topicCoverageSummary: {
      phase: mappedPhase,
      masteredInFavoriteTopicsCount: coverageEntries.filter(
        (c) => favTopics.includes(c.topicKey) && c.lastMasteryMilli >= 780,
      ).length,
      transferredToOtherTopicsCount: coverageEntries.filter(
        (c) => !favTopics.includes(c.topicKey) && c.practiceCount > 0,
      ).length,
    },
  };
}

/**
 * Merges guest device personalization records into the signed-in user account key
 * during link-account / OTP / OAuth login so mobile-web sync never loses diagnostic data.
 */
export async function mergeAccountPersonalizationData(params: {
  db: MockzaDb;
  fromAccountKey: string;
  toAccountKey: string;
}): Promise<void> {
  if (!params.fromAccountKey || params.fromAccountKey === params.toAccountKey) return;
  const from = params.fromAccountKey;
  const to = params.toAccountKey;

  await params.db.transaction(async (tx) => {
    // 1. Band events (conflict-safe by edition + sourceKind + sourceId + skill)
    const existingToEvents = await tx
      .select({
        edition: learnerBandEvents.edition,
        sourceKind: learnerBandEvents.sourceKind,
        sourceId: learnerBandEvents.sourceId,
        skill: learnerBandEvents.skill,
      })
      .from(learnerBandEvents)
      .where(eq(learnerBandEvents.accountKey, to));
    const toKeys = new Set(
      existingToEvents.map((e) => `${e.edition}:${e.sourceKind}:${e.sourceId}:${e.skill}`),
    );

    const fromEvents = await tx
      .select()
      .from(learnerBandEvents)
      .where(eq(learnerBandEvents.accountKey, from));
    const moveIds: string[] = [];
    for (const ev of fromEvents) {
      if (!toKeys.has(`${ev.edition}:${ev.sourceKind}:${ev.sourceId}:${ev.skill}`)) {
        moveIds.push(ev.eventId);
      }
    }
    if (moveIds.length > 0) {
      await tx
        .update(learnerBandEvents)
        .set({ accountKey: to })
        .where(inArray(learnerBandEvents.eventId, moveIds));
    }
    await tx.delete(learnerBandEvents).where(eq(learnerBandEvents.accountKey, from));

    // 2. Learner profiles (per edition, preserve unlocked waves / higher progress / favoriteTopics)
    const fromProfiles = await tx
      .select()
      .from(learnerProfiles)
      .where(eq(learnerProfiles.accountKey, from));
    for (const fp of fromProfiles) {
      const [tp] = await tx
        .select()
        .from(learnerProfiles)
        .where(
          and(eq(learnerProfiles.accountKey, to), eq(learnerProfiles.edition, fp.edition)),
        )
        .limit(1);
      if (!tp) {
        await tx
          .update(learnerProfiles)
          .set({ accountKey: to })
          .where(
            and(eq(learnerProfiles.accountKey, from), eq(learnerProfiles.edition, fp.edition)),
          );
      } else {
        const mergedTopics = Array.from(
          new Set([...tp.favoriteTopicsJson, ...fp.favoriteTopicsJson]),
        ).slice(0, 6);
        await tx
          .update(learnerProfiles)
          .set({
            favoriteTopicsJson: mergedTopics,
            vocabUnlockedWave: Math.max(tp.vocabUnlockedWave, fp.vocabUnlockedWave),
            onboardingCompleted: tp.onboardingCompleted || fp.onboardingCompleted,
          })
          .where(
            and(eq(learnerProfiles.accountKey, to), eq(learnerProfiles.edition, tp.edition)),
          );
        await tx
          .delete(learnerProfiles)
          .where(
            and(eq(learnerProfiles.accountKey, from), eq(learnerProfiles.edition, fp.edition)),
          );
      }
    }

    // 3. Roadmap plans & steps (preserve active plan if target has none, otherwise merge completed refs via recalibration)
    const toPlans = await tx
      .select({ planId: learnerRoadmapPlans.planId, edition: learnerRoadmapPlans.edition })
      .from(learnerRoadmapPlans)
      .where(eq(learnerRoadmapPlans.accountKey, to));
    const toPlanEditions = new Set(toPlans.map((p) => p.edition));
    const fromPlans = await tx
      .select()
      .from(learnerRoadmapPlans)
      .where(eq(learnerRoadmapPlans.accountKey, from));
    for (const fPlan of fromPlans) {
      if (!toPlanEditions.has(fPlan.edition)) {
        await tx
          .update(learnerRoadmapPlans)
          .set({ accountKey: to })
          .where(eq(learnerRoadmapPlans.planId, fPlan.planId));
        await tx
          .update(learnerRoadmapSteps)
          .set({ accountKey: to })
          .where(eq(learnerRoadmapSteps.planId, fPlan.planId));
      } else {
        await tx.delete(learnerRoadmapSteps).where(eq(learnerRoadmapSteps.planId, fPlan.planId));
        await tx.delete(learnerRoadmapPlans).where(eq(learnerRoadmapPlans.planId, fPlan.planId));
      }
    }

    // 4. Topic x Weakness coverage (merge counts)
    const fromCovs = await tx
      .select()
      .from(learnerTopicWeaknessCoverage)
      .where(eq(learnerTopicWeaknessCoverage.accountKey, from));
    for (const cov of fromCovs) {
      await tx
        .insert(learnerTopicWeaknessCoverage)
        .values({ ...cov, coverageId: randomUUID(), accountKey: to })
        .onConflictDoUpdate({
          target: [
            learnerTopicWeaknessCoverage.accountKey,
            learnerTopicWeaknessCoverage.edition,
            learnerTopicWeaknessCoverage.weaknessKey,
            learnerTopicWeaknessCoverage.topicKey,
          ],
          set: {
            attemptsCount: sql`${learnerTopicWeaknessCoverage.attemptsCount} + ${cov.attemptsCount}`,
            successesCount: sql`${learnerTopicWeaknessCoverage.successesCount} + ${cov.successesCount}`,
            masteredInTopic: sql`${learnerTopicWeaknessCoverage.masteredInTopic} OR ${cov.masteredInTopic}`,
          },
        });
    }
    await tx
      .delete(learnerTopicWeaknessCoverage)
      .where(eq(learnerTopicWeaknessCoverage.accountKey, from));

    // 5. Linguistic nodes (conflict-safe by edition + nodeKind + canonicalKey)
    const toNodes = await tx
      .select({
        edition: linguisticNodes.edition,
        nodeKind: linguisticNodes.nodeKind,
        canonicalKey: linguisticNodes.canonicalKey,
      })
      .from(linguisticNodes)
      .where(eq(linguisticNodes.accountKey, to));
    const toNodeKeys = new Set(
      toNodes.map((n) => `${n.edition}:${n.nodeKind}:${n.canonicalKey}`),
    );
    const fromNodes = await tx
      .select()
      .from(linguisticNodes)
      .where(eq(linguisticNodes.accountKey, from));
    const moveNodeIds: string[] = [];
    for (const n of fromNodes) {
      if (!toNodeKeys.has(`${n.edition}:${n.nodeKind}:${n.canonicalKey}`)) {
        moveNodeIds.push(n.nodeId);
      }
    }
    if (moveNodeIds.length > 0) {
      await tx
        .update(linguisticNodes)
        .set({ accountKey: to })
        .where(inArray(linguisticNodes.nodeId, moveNodeIds));
    }
    await tx.delete(linguisticNodes).where(eq(linguisticNodes.accountKey, from));
    await tx
      .update(linguisticEvidenceEvents)
      .set({ accountKey: to })
      .where(eq(linguisticEvidenceEvents.accountKey, from));

    // 6. Vocab SRS sync (conflict-safe by accountKey + edition + cardId, keeping higher repetitions)
    const fromVocab = await tx
      .select()
      .from(userVocabSrsSync)
      .where(eq(userVocabSrsSync.accountKey, from));
    for (const v of fromVocab) {
      await tx
        .insert(userVocabSrsSync)
        .values({ ...v, accountKey: to })
        .onConflictDoUpdate({
          target: [
            userVocabSrsSync.accountKey,
            userVocabSrsSync.edition,
            userVocabSrsSync.cardId,
          ],
          set: {
            repetitions: sql`GREATEST(${userVocabSrsSync.repetitions}, ${v.repetitions})`,
            lapses: sql`GREATEST(${userVocabSrsSync.lapses}, ${v.lapses})`,
            dueSerialDay: sql`GREATEST(${userVocabSrsSync.dueSerialDay}, ${v.dueSerialDay})`,
            cardSnapshotJson: v.cardSnapshotJson
              ? sql`COALESCE(${userVocabSrsSync.cardSnapshotJson}, ${JSON.stringify(v.cardSnapshotJson)}::jsonb)`
              : userVocabSrsSync.cardSnapshotJson,
          },
        });
    }
    await tx.delete(userVocabSrsSync).where(eq(userVocabSrsSync.accountKey, from));

    // 7. Pronunciation practices, Attempts sync, Activity ledger, AI Usage ledger & Audio assets
    await tx
      .update(pronunciationPractices)
      .set({ accountKey: to })
      .where(eq(pronunciationPractices.accountKey, from));
    await tx
      .update(userAttemptsSync)
      .set({ accountKey: to })
      .where(eq(userAttemptsSync.accountKey, from));
    await tx
      .update(userActivityLedger)
      .set({ accountKey: to })
      .where(eq(userActivityLedger.accountKey, from));
    await tx
      .update(aiUsageLedger)
      .set({ accountKey: to })
      .where(eq(aiUsageLedger.accountKey, from));
    await tx
      .update(audioAssets)
      .set({ accountKey: to })
      .where(eq(audioAssets.accountKey, from));
  });
}

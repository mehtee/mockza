import 'dart:math' as math;

import 'package:mockza/core/advanced/linguistic_graph_math.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/personalization/live_band_engine.dart';
import 'package:mockza/core/personalization/topic_taxonomy.dart';
import 'package:mockza/core/personalization/topic_weakness_rotator.dart';

/// Step category within a learner roadmap.
enum RoadmapStepKind {
  /// 10-min starting check.
  diagnostic('diagnostic'),

  /// Reading, Listening, Writing, or Speaking practice pack.
  practicePack('practice_pack'),

  /// 3-minute targeted micro-drill.
  microDrill('micro_drill'),

  /// Progressive vocabulary wave batch.
  vocabWave('vocab_wave'),

  /// 10-min Daily Smart Coach session.
  dailyMission('daily_mission'),

  /// 3-gear Register Shifter speaking upgrade.
  registerShifter('register_shifter'),

  /// Drop Anything 2-min quiz.
  dropAnything('drop_anything'),

  /// Full 4-skill calibrated mock exam.
  fullMock('full_mock');

  new(this.wireValue);

  /// Wire string value.
  final String wireValue;

  /// Parses wire value defaulting to [practicePack].
  static RoadmapStepKind fromWire(String? raw) => switch (raw) {
    'diagnostic' => RoadmapStepKind.diagnostic,
    'micro_drill' => RoadmapStepKind.microDrill,
    'vocab_wave' => RoadmapStepKind.vocabWave,
    'daily_mission' => RoadmapStepKind.dailyMission,
    'register_shifter' => RoadmapStepKind.registerShifter,
    'drop_anything' => RoadmapStepKind.dropAnything,
    'full_mock' => RoadmapStepKind.fullMock,
    _ => RoadmapStepKind.practicePack,
  };
}

/// Step execution status.
enum RoadmapStepStatus {
  /// Future preview step.
  lockedPreview('locked_preview'),

  /// Current active step.
  active('active'),

  /// Completed step.
  completed('completed'),

  /// Explicitly skipped step.
  skipped('skipped');

  new(this.wireValue);

  /// Wire string value.
  final String wireValue;

  /// Parses wire value defaulting to [lockedPreview].
  static RoadmapStepStatus fromWire(String? raw) => switch (raw) {
    'active' => RoadmapStepStatus.active,
    'completed' => RoadmapStepStatus.completed,
    'skipped' => RoadmapStepStatus.skipped,
    _ => RoadmapStepStatus.lockedPreview,
  };
}

/// Milestone overview inside the Panorama (Durnama).
class RoadmapMilestoneSummary {
  /// Creates a [RoadmapMilestoneSummary].
  const new({
    required this.index,
    required this.key,
    required this.titleEn,
    required this.titleFa,
    required this.goalEn,
    required this.goalFa,
    required this.phase,
    required this.startDaySerial,
    required this.endDaySerial,
    required this.targetBandMarker,
    required this.status,
  });

  /// 1-based milestone index (`1..4`).
  final int index;

  /// Machine key.
  final String key;

  /// English milestone title.
  final String titleEn;

  /// Persian milestone title.
  final String titleFa;

  /// English milestone goal summary.
  final String goalEn;

  /// Persian milestone goal summary.
  final String goalFa;

  /// Dominant adaptation phase.
  final AdaptationPhase phase;

  /// Planned start UTC serial day.
  final int startDaySerial;

  /// Planned end UTC serial day.
  final int endDaySerial;

  /// Target band marker by end of milestone.
  final double targetBandMarker;

  /// Status (`upcoming`, `active`, `completed`).
  final String status;
}

/// Individual step inside a generated roadmap.
class RoadmapStepSpec {
  /// Creates a [RoadmapStepSpec].
  const new({
    required this.stepKey,
    required this.milestoneIndex,
    required this.stepOrder,
    required this.stepKind,
    required this.targetRefId,
    required this.skill,
    required this.topicKey,
    required this.weaknessKey,
    required this.phaseTag,
    required this.difficultyCefr,
    required this.titleEn,
    required this.titleFa,
    required this.reasonEn,
    required this.reasonFa,
    required this.estimatedMinutes,
    required this.status,
    this.completedRefId,
  });

  /// Deterministic step key.
  final String stepKey;

  /// Owning milestone index (`1..4`).
  final int milestoneIndex;

  /// Global 1-based step order.
  final int stepOrder;

  /// Kind of learning activity.
  final RoadmapStepKind stepKind;

  /// Route target reference ID.
  final String targetRefId;

  /// Target skill or `vocabulary` / `all`.
  final String skill;

  /// Primary canonical topic key.
  final CanonicalTopicKey topicKey;

  /// Targeted weakness key, if any.
  final String? weaknessKey;

  /// Phase tag.
  final AdaptationPhase phaseTag;

  /// Difficulty tier.
  final AuthoringTier difficultyCefr;

  /// English title.
  final String titleEn;

  /// Persian title.
  final String titleFa;

  /// English "Why this step?" explanation.
  final String reasonEn;

  /// Persian "Why this step?" explanation.
  final String reasonFa;

  /// Estimated duration in minutes.
  final int estimatedMinutes;

  /// Status.
  final RoadmapStepStatus status;

  /// Linked completion reference ID if completed.
  final String? completedRefId;
}

/// Lightweight pack inventory descriptor for roadmap generation.
class RoadmapPackInventoryItem extends AdaptiveContentCandidate {
  /// Creates a [RoadmapPackInventoryItem].
  const new({
    required super.id,
    required super.topicKeys,
    required super.weaknessTags,
    required super.cefrMin,
    required super.cefrMax,
    required this.examId,
    required this.skill,
    required this.title,
    required this.durationSeconds,
    super.lastAttemptedDaySerial,
    super.attemptCount,
  });

  /// Exam track ID.
  final String examId;

  /// Skill (`reading`, `listening`, `writing`, `speaking`, `fullMock`).
  final String skill;

  /// Display title.
  final String title;

  /// Estimated duration in seconds.
  final int durationSeconds;
}

/// Lightweight micro-drill inventory descriptor.
class RoadmapDrillInventoryItem extends AdaptiveContentCandidate {
  /// Creates a [RoadmapDrillInventoryItem].
  const new({
    required super.id,
    required super.topicKeys,
    required super.weaknessTags,
    required super.cefrMin,
    required super.cefrMax,
    required this.examId,
    required this.skill,
    required this.title,
    required this.durationSeconds,
    super.lastAttemptedDaySerial,
    super.attemptCount,
  });

  /// Exam track ID.
  final String examId;

  /// Skill.
  final String skill;

  /// Display title.
  final String title;

  /// Duration in seconds.
  final int durationSeconds;
}

/// Complete generated roadmap output.
class GeneratedRoadmap {
  /// Creates a [GeneratedRoadmap].
  const new({
    required this.isSprintMode,
    required this.currentPhase,
    required this.milestones,
    required this.steps,
    required this.activeStep,
    required this.recalibrationReasonEn,
    required this.recalibrationReasonFa,
  });

  /// True when `< 7` days remain until exam date.
  final bool isSprintMode;

  /// Current active adaptation phase.
  final AdaptationPhase currentPhase;

  /// Four Panorama milestones (`M1..M4`).
  final List<RoadmapMilestoneSummary> milestones;

  /// Ordered step-by-step action queue.
  final List<RoadmapStepSpec> steps;

  /// Currently active next step, or null if all completed.
  final RoadmapStepSpec? activeStep;

  /// English recalibration note.
  final String recalibrationReasonEn;

  /// Persian recalibration note.
  final String recalibrationReasonFa;
}

/// Deterministic "Durnama + Step-by-Step" Roadmap Generator matching `roadmap-generator.ts`.
abstract final class RoadmapGenerator {
  /// Generates or recalibrates a personalized 4-Milestone roadmap preserving completed steps.
  static GeneratedRoadmap generateOrRecalibrate({
    required ExamTrack track,
    required double? currentBand,
    required double targetBand,
    required int? targetDateSerial,
    required int todaySerial,
    required String studyFocus,
    required int dailyMinutesGoal,
    required List<String> favoriteTopics,
    required List<LinguisticNodeSummary> weaknessNodes,
    required List<TopicWeaknessCoverageEntry> coverage,
    required List<RoadmapPackInventoryItem> packs,
    required List<RoadmapDrillInventoryItem> drills,
    required bool diagnosticDone,
    required int currentVocabWave,
    Set<String> existingCompletedStepKeys = const <String>{},
    Set<String> existingCompletedTargetRefs = const <String>{},
  }) {
    final favTopics = CanonicalTopicKey.normalizeList(favoriteTopics);
    final primaryFav = favTopics.isNotEmpty
        ? favTopics.first
        : CanonicalTopicKey.technologyAi;
    final secondaryFav = favTopics.length > 1
        ? favTopics[1]
        : (favTopics.isNotEmpty
              ? favTopics.first
              : CanonicalTopicKey.scienceClimate);
    final baseline =
        currentBand ??
        LiveBandEngine.mapCefrTierToExamScore(AuthoringTier.b1, track);
    final currentCefr = currentBand != null
        ? (LiveBandEngine.estimateCefrTierFromScore(currentBand, track) ??
              AuthoringTier.b1)
        : AuthoringTier.b1;

    final daysRemaining = targetDateSerial != null
        ? math.max(1, targetDateSerial - todaySerial)
        : 28;
    final isSprintMode = targetDateSerial != null && daysRemaining <= 7;

    final examPacks = packs
        .where((p) => p.examId == track.id && p.skill != 'fullMock')
        .toList(growable: false);
    final fullMockPack = packs
        .where((p) => p.examId == track.id && p.skill == 'fullMock')
        .firstOrNull;
    final examDrills = drills
        .where((d) => d.examId == track.id)
        .toList(growable: false);

    final rankedPacks = TopicWeaknessRotator.rankCandidates(
      candidates: examPacks,
      weaknessNodes: weaknessNodes,
      favoriteTopics: favTopics,
      coverage: coverage,
      track: track,
      currentBand: currentBand,
      targetBand: targetBand,
      currentDaySerial: todaySerial,
    );

    final rankedDrills = TopicWeaknessRotator.rankCandidates(
      candidates: examDrills,
      weaknessNodes: weaknessNodes,
      favoriteTopics: favTopics,
      coverage: coverage,
      track: track,
      currentBand: currentBand,
      targetBand: targetBand,
      currentDaySerial: todaySerial,
    );

    final coachSelection = TopicWeaknessRotator.selectNextCoachTopic(
      weaknessNodes: weaknessNodes,
      favoriteTopics: favTopics,
      coverage: coverage,
      currentDaySerial: todaySerial,
    );

    final draftSteps = <_DraftStep>[];

    // M1
    if (!diagnosticDone) {
      draftSteps.add(
        _DraftStep(
          stepKey: 'm1:diagnostic',
          milestoneIndex: 1,
          stepKind: RoadmapStepKind.diagnostic,
          targetRefId: 'diagnostic:intro',
          skill: 'all',
          topicKey: primaryFav,
          weaknessKey: null,
          phaseTag: AdaptationPhase.ignition,
          difficultyCefr: currentCefr,
          titleEn: 'Optional 10-Min Level Check (Set Your Band Anytime)',
          titleFa:
              'ارزیابی ۱۰ دقیقه‌ای تعیین سطح (اختیاری — هر زمان آماده بودید)',
          reasonEn: 'Measures all 4 skills to calibrate your exact band — you can skip it for now and start with the basic steps below.',
          reasonFa: 'هر ۴ مهارت شما را می‌سنجد؛ اما اگر مایل هستید می‌توانید فعلاً از گام‌های پایه زیر شروع کنید.',
          estimatedMinutes: 10,
        ),
      );
    }

    draftSteps.add(
      _DraftStep(
        stepKey: 'm1:vocab:wave1',
        milestoneIndex: 1,
        stepKind: RoadmapStepKind.vocabWave,
        targetRefId: 'vocab:wave:1',
        skill: 'vocabulary',
        topicKey: primaryFav,
        weaknessKey: null,
        phaseTag: AdaptationPhase.ignition,
        difficultyCefr: currentCefr,
        titleEn: 'Vocab Wave 1: 15 ${primaryFav.labelEn} & Core Words',
        titleFa: 'موج اول واژگان: ۱۵ واژه کلیدی (${primaryFav.labelFa})',
        reasonEn:
            'Curated around ${primaryFav.labelEn} at your ${currentCefr.name.toUpperCase()} level instead of 320 words at once.',
        reasonFa:
            'به‌جای ۳۲۰ واژه هم‌زمان، با ۱۵ واژه کاربردی در موضوع «${primaryFav.labelFa}» و سطح ${currentCefr.name.toUpperCase()} شروع می‌کنید.',
        estimatedMinutes: 8,
      ),
    );

    if (studyFocus != 'exams') {
      draftSteps.add(
        _DraftStep(
          stepKey: 'm1:coach:warmup',
          milestoneIndex: 1,
          stepKind: RoadmapStepKind.dailyMission,
          targetRefId: 'mission:today',
          skill: 'writing',
          topicKey: primaryFav,
          weaknessKey: null,
          phaseTag: AdaptationPhase.ignition,
          difficultyCefr: currentCefr,
          titleEn: '10-Min Coach Warmup: ${primaryFav.labelEn}',
          titleFa: 'تمرین ۱۰ دقیقه‌ای مربی: ${primaryFav.labelFa}',
          reasonEn:
              'Starts directly with your favorite topic (${primaryFav.labelEn}) to build confidence & gather language signals.',
          reasonFa:
              'شروع مستقیم با موضوع مورد علاقه شما (${primaryFav.labelFa}) برای گرم‌کردن و شناسایی دقیق خطاها.',
          estimatedMinutes: 10,
        ),
      );
    } else if (rankedPacks.isNotEmpty) {
      final p0 = rankedPacks.first;
      draftSteps.add(
        _DraftStep(
          stepKey: 'm1:pack:${p0.item.id}',
          milestoneIndex: 1,
          stepKind: RoadmapStepKind.practicePack,
          targetRefId: p0.item.id,
          skill: p0.item.skill == 'fullMock' ? 'reading' : p0.item.skill,
          topicKey: p0.matchedTopic,
          weaknessKey: p0.matchedWeaknessKey,
          phaseTag: AdaptationPhase.ignition,
          difficultyCefr: p0.item.cefrMin,
          titleEn: p0.item.title,
          titleFa: 'تمرین مهارت: ${p0.item.title}',
          reasonEn: p0.reasonEn,
          reasonFa: p0.reasonFa,
          estimatedMinutes: math.max(
            10,
            (p0.item.durationSeconds / 60).round(),
          ),
        ),
      );
    }

    // M2
    if (rankedDrills.isNotEmpty) {
      final d0 = rankedDrills.first;
      draftSteps.add(
        _DraftStep(
          stepKey: 'm2:drill:${d0.item.id}',
          milestoneIndex: 2,
          stepKind: RoadmapStepKind.microDrill,
          targetRefId: d0.item.id,
          skill: d0.item.skill,
          topicKey: d0.matchedTopic,
          weaknessKey: d0.matchedWeaknessKey,
          phaseTag: AdaptationPhase.interestWeakness,
          difficultyCefr: d0.item.cefrMin,
          titleEn: '3-Min Fix: ${d0.item.title}',
          titleFa: 'تمرین ۳ دقیقه‌ای هدفمند: ${d0.item.title}',
          reasonEn: d0.reasonEn,
          reasonFa: d0.reasonFa,
          estimatedMinutes: math.max(
            3,
            (d0.item.durationSeconds / 60).round(),
          ),
        ),
      );
    }

    if (studyFocus != 'exams') {
      draftSteps.add(
        _DraftStep(
          stepKey: 'm2:register:upgrade',
          milestoneIndex: 2,
          stepKind: RoadmapStepKind.registerShifter,
          targetRefId: 'register-shifter',
          skill: 'speaking',
          topicKey: secondaryFav,
          weaknessKey: coachSelection.primaryWeaknessKey,
          phaseTag: AdaptationPhase.interestWeakness,
          difficultyCefr: currentCefr,
          titleEn: 'Upgrade My Speaking (Band-Calibrated Ladder + Audio Check)',
          titleFa: 'ارتقای لحن گفتار و تمرین تلفظ با مقایسه صوتی',
          reasonEn:
              'Speak one thought on ${secondaryFav.labelEn} and compare everyday vs target-band phrasing.',
          reasonFa:
              'یک ایده درباره «${secondaryFav.labelFa}» بگویید و نسخه ساده تا نمره هدف را بشنوید و تمرین کنید.',
          estimatedMinutes: 8,
        ),
      );
    }

    final m2PackCandidate = studyFocus == 'exams'
        ? (rankedPacks.length > 1 ? rankedPacks[1] : null)
        : (rankedPacks.isNotEmpty ? rankedPacks[0] : null);
    if (!isSprintMode && m2PackCandidate != null) {
      final p1 = m2PackCandidate;
      draftSteps.add(
        _DraftStep(
          stepKey: 'm2:pack:${p1.item.id}',
          milestoneIndex: 2,
          stepKind: RoadmapStepKind.practicePack,
          targetRefId: p1.item.id,
          skill: p1.item.skill == 'fullMock' ? 'reading' : p1.item.skill,
          topicKey: p1.matchedTopic,
          weaknessKey: p1.matchedWeaknessKey,
          phaseTag: AdaptationPhase.interestWeakness,
          difficultyCefr: p1.item.cefrMin,
          titleEn: p1.item.title,
          titleFa: 'شبیه‌ساز هدفمند: ${p1.item.title}',
          reasonEn: p1.reasonEn,
          reasonFa: p1.reasonFa,
          estimatedMinutes: math.max(
            12,
            (p1.item.durationSeconds / 60).round(),
          ),
        ),
      );
    }

    draftSteps.add(
      _DraftStep(
        stepKey: 'm2:vocab:wave2',
        milestoneIndex: 2,
        stepKind: RoadmapStepKind.vocabWave,
        targetRefId: 'vocab:wave:${math.max(2, currentVocabWave)}',
        skill: 'vocabulary',
        topicKey: secondaryFav,
        weaknessKey: coachSelection.primaryWeaknessKey,
        phaseTag: AdaptationPhase.interestWeakness,
        difficultyCefr: currentCefr,
        titleEn: 'Vocab Wave 2: Weakness-Targeting Collocations',
        titleFa: 'موج دوم واژگان: هم‌آواهای رفع نقاط ضعف',
        reasonEn: 'Unlocks 15 high-yield collocations aligned with your active weaknesses + saved mistakes.',
        reasonFa: '۱۵ ترکیب واژگانی دقیق برای رفع خطاهای ثبت‌شده و واژگان ذخیره‌شده شما.',
        estimatedMinutes: 8,
      ),
    );

    // M3
    final transferTopic =
        coachSelection.phase == AdaptationPhase.crossTopicTransfer
        ? coachSelection.topicKey
        : (primaryFav == CanonicalTopicKey.scienceClimate
              ? CanonicalTopicKey.urbanSociety
              : CanonicalTopicKey.scienceClimate);

    final transferPack =
        rankedPacks
            .where((r) => !favTopics.contains(r.matchedTopic))
            .firstOrNull ??
        (rankedPacks.length > 2 ? rankedPacks[2] : rankedPacks.firstOrNull);
    if (transferPack != null) {
      draftSteps.add(
        _DraftStep(
          stepKey: 'm3:pack:${transferPack.item.id}',
          milestoneIndex: 3,
          stepKind: RoadmapStepKind.practicePack,
          targetRefId: transferPack.item.id,
          skill: transferPack.item.skill == 'fullMock'
              ? 'listening'
              : transferPack.item.skill,
          topicKey: transferPack.matchedTopic,
          weaknessKey: transferPack.matchedWeaknessKey,
          phaseTag: AdaptationPhase.crossTopicTransfer,
          difficultyCefr: transferPack.item.cefrMax,
          titleEn: 'Cross-Topic Transfer: ${transferPack.item.title}',
          titleFa: 'انتقال مهارت به موضوع جدید: ${transferPack.item.title}',
          reasonEn:
              'Applies your repaired skills to a fresh exam topic (${transferPack.matchedTopic.labelEn}).',
          reasonFa:
              'مهارت تثبیت‌شده شما را روی موضوع تازه «${transferPack.matchedTopic.labelFa}» محک می‌زند.',
          estimatedMinutes: math.max(
            15,
            (transferPack.item.durationSeconds / 60).round(),
          ),
        ),
      );
    }

    if (studyFocus != 'exams') {
      draftSteps.add(
        _DraftStep(
          stepKey: 'm3:coach:transfer',
          milestoneIndex: 3,
          stepKind: RoadmapStepKind.dailyMission,
          targetRefId: 'mission:today',
          skill: 'writing',
          topicKey: transferTopic,
          weaknessKey: coachSelection.primaryWeaknessKey,
          phaseTag: AdaptationPhase.crossTopicTransfer,
          difficultyCefr: currentCefr,
          titleEn: '10-Min Coach Transfer Challenge: ${transferTopic.labelEn}',
          titleFa: 'چالش انتقال ۱۰ دقیقه‌ای: ${transferTopic.labelFa}',
          reasonEn: coachSelection.phase == AdaptationPhase.crossTopicTransfer
              ? coachSelection.reasonEn
              : 'Tests your active target phrases in an unfamiliar exam topic (${transferTopic.labelEn}).',
          reasonFa: coachSelection.phase == AdaptationPhase.crossTopicTransfer
              ? coachSelection.reasonFa
              : 'کاربرد ساختارهای جدید شما در یک موضوع غیرتکراری (${transferTopic.labelFa}).',
          estimatedMinutes: 10,
        ),
      );
    }

    if (!isSprintMode && rankedDrills.length > 1) {
      final d1 = rankedDrills[1];
      draftSteps.add(
        _DraftStep(
          stepKey: 'm3:drill:${d1.item.id}',
          milestoneIndex: 3,
          stepKind: RoadmapStepKind.microDrill,
          targetRefId: d1.item.id,
          skill: d1.item.skill,
          topicKey: d1.matchedTopic,
          weaknessKey: d1.matchedWeaknessKey,
          phaseTag: AdaptationPhase.crossTopicTransfer,
          difficultyCefr: d1.item.cefrMax,
          titleEn: 'Speed Verification: ${d1.item.title}',
          titleFa: 'تثبیت سرعت و دقت: ${d1.item.title}',
          reasonEn: d1.reasonEn,
          reasonFa: d1.reasonFa,
          estimatedMinutes: math.max(
            3,
            (d1.item.durationSeconds / 60).round(),
          ),
        ),
      );
    }

    draftSteps.add(
      _DraftStep(
        stepKey: 'm3:vocab:wave3',
        milestoneIndex: 3,
        stepKind: RoadmapStepKind.vocabWave,
        targetRefId: 'vocab:wave:${math.max(3, currentVocabWave)}',
        skill: 'vocabulary',
        topicKey: transferTopic,
        weaknessKey: null,
        phaseTag: AdaptationPhase.crossTopicTransfer,
        difficultyCefr:
            LiveBandEngine.estimateCefrTierFromScore(targetBand, track) ??
            AuthoringTier.c1,
        titleEn: 'Vocab Wave 3: Exam Breadth (${transferTopic.labelEn})',
        titleFa: 'موج سوم واژگان: تنوع موضوعی آزمون (${transferTopic.labelFa})',
        reasonEn: 'Expands lexical range across wider exam domains toward your target band.',
        reasonFa: 'دامنه واژگان شما را فراتر از علایق اولیه برای نمره هدف گسترش می‌دهد.',
        estimatedMinutes: 8,
      ),
    );

    // M4
    final finalPack = rankedPacks.length > 3
        ? rankedPacks[3]
        : rankedPacks.lastOrNull;
    if (!isSprintMode && finalPack != null) {
      draftSteps.add(
        _DraftStep(
          stepKey: 'm4:pack:${finalPack.item.id}',
          milestoneIndex: 4,
          stepKind: RoadmapStepKind.practicePack,
          targetRefId: finalPack.item.id,
          skill: finalPack.item.skill == 'fullMock'
              ? 'speaking'
              : finalPack.item.skill,
          topicKey: finalPack.matchedTopic,
          weaknessKey: finalPack.matchedWeaknessKey,
          phaseTag: AdaptationPhase.examBreadth,
          difficultyCefr: finalPack.item.cefrMax,
          titleEn: 'Timed Section Dress Rehearsal: ${finalPack.item.title}',
          titleFa: 'شبیه‌ساز زمان‌دار بخش پایانی: ${finalPack.item.title}',
          reasonEn: 'Final timed check in Exam Mode to raise confidence from Developing to Calibrated.',
          reasonFa:
              'تمرین زمان‌دار در حالت آزمون برای تثبیت نمره و آمادگی کامل.',
          estimatedMinutes: math.max(
            15,
            (finalPack.item.durationSeconds / 60).round(),
          ),
        ),
      );
    }

    if (studyFocus != 'coach' || fullMockPack != null) {
      draftSteps.add(
        _DraftStep(
          stepKey: 'm4:fullmock:${fullMockPack?.id ?? 'default'}',
          milestoneIndex: 4,
          stepKind: RoadmapStepKind.fullMock,
          targetRefId: fullMockPack?.id ?? 'practice:full-mock',
          skill: 'all',
          topicKey: CanonicalTopicKey.academicCore,
          weaknessKey: null,
          phaseTag: AdaptationPhase.examBreadth,
          difficultyCefr:
              LiveBandEngine.estimateCefrTierFromScore(targetBand, track) ??
              AuthoringTier.c1,
          titleEn: 'Calibrated Full Mock Exam',
          titleFa: 'آزمون کامل آزمایشی استاندارد (Full Mock)',
          reasonEn: 'Measures real 4-skill stamina under strict timing and produces your calibrated score.',
          reasonFa: 'ارزیابی استقامت ۴ مهارت در شرایط واقعی آزمون و ثبت نمره کالیبره‌شده.',
          estimatedMinutes: 45,
        ),
      );
    }

    var foundFirstPending = false;
    final steps = <RoadmapStepSpec>[];
    for (var i = 0; i < draftSteps.length; i += 1) {
      final d = draftSteps[i];
      final isDone =
          existingCompletedStepKeys.contains(d.stepKey) ||
          (d.stepKind != RoadmapStepKind.dailyMission &&
              existingCompletedTargetRefs.contains(d.targetRefId));
      final RoadmapStepStatus status;
      if (isDone) {
        status = RoadmapStepStatus.completed;
      } else if (!diagnosticDone && d.milestoneIndex == 1) {
        status = RoadmapStepStatus.active;
        if (d.stepKind != RoadmapStepKind.diagnostic) {
          foundFirstPending = true;
        }
      } else if (!foundFirstPending) {
        status = RoadmapStepStatus.active;
        foundFirstPending = true;
      } else {
        status = RoadmapStepStatus.lockedPreview;
      }
      steps.add(
        RoadmapStepSpec(
          stepKey: d.stepKey,
          milestoneIndex: d.milestoneIndex,
          stepOrder: i + 1,
          stepKind: d.stepKind,
          targetRefId: d.targetRefId,
          skill: d.skill,
          topicKey: d.topicKey,
          weaknessKey: d.weaknessKey,
          phaseTag: d.phaseTag,
          difficultyCefr: d.difficultyCefr,
          titleEn: d.titleEn,
          titleFa: d.titleFa,
          reasonEn: d.reasonEn,
          reasonFa: d.reasonFa,
          estimatedMinutes: d.estimatedMinutes,
          status: status,
        ),
      );
    }

    final stepSpan = math.max(1, daysRemaining ~/ 4);
    final midTarget = double.parse(
      ((baseline + targetBand) / 2).toStringAsFixed(1),
    );
    final stretchTarget = double.parse(
      ((midTarget + targetBand) / 2).toStringAsFixed(1),
    );
    final activeStep = steps
        .where((s) => s.status == RoadmapStepStatus.active)
        .firstOrNull;
    final activeMilestone = activeStep?.milestoneIndex ?? 1;

    String milestoneStatus(int mIdx) {
      final mSteps = steps
          .where((s) => s.milestoneIndex == mIdx)
          .toList(growable: false);
      if (mSteps.isNotEmpty &&
          mSteps.every((s) => s.status == RoadmapStepStatus.completed)) {
        return 'completed';
      }
      if (mSteps.any((s) => s.status == RoadmapStepStatus.active)) {
        return 'active';
      }
      return mIdx < activeMilestone ? 'completed' : 'upcoming';
    }

    final milestones = <RoadmapMilestoneSummary>[
      RoadmapMilestoneSummary(
        index: 1,
        key: 'baseline_warmup',
        titleEn: 'Baseline & Interest Warmup',
        titleFa: 'شناخت سطح و شروع با علایق',
        goalEn: 'Set baseline band & start with ${primaryFav.labelEn}',
        goalFa: 'تعیین سطح اولیه و شروع با موضوع «${primaryFav.labelFa}»',
        phase: AdaptationPhase.ignition,
        startDaySerial: todaySerial,
        endDaySerial: todaySerial + stepSpan,
        targetBandMarker: baseline,
        status: milestoneStatus(1),
      ),
      RoadmapMilestoneSummary(
        index: 2,
        key: 'interest_weakness_repair',
        titleEn: 'Fix Weak Spots in Topics You Love',
        titleFa: 'رفع نقاط ضعف با موضوعات دلخواه',
        goalEn: 'Repair top bottlenecks using familiar topics + Vocab Wave 2',
        goalFa: 'رفع خطاهای کلیدی در موضوعات مورد علاقه شما',
        phase: AdaptationPhase.interestWeakness,
        startDaySerial: todaySerial + stepSpan,
        endDaySerial: todaySerial + stepSpan * 2,
        targetBandMarker: midTarget,
        status: milestoneStatus(2),
      ),
      RoadmapMilestoneSummary(
        index: 3,
        key: 'cross_topic_transfer',
        titleEn: 'Cross-Topic Transfer & Band Push',
        titleFa: 'انتقال مهارت به موضوعات متنوع آزمون',
        goalEn:
            'Transfer fixes into broader exam topics like ${transferTopic.labelEn}',
        goalFa:
            'آزمودن مهارت‌های رفع‌شده در موضوعات تازه مثل «${transferTopic.labelFa}»',
        phase: AdaptationPhase.crossTopicTransfer,
        startDaySerial: todaySerial + stepSpan * 2,
        endDaySerial: todaySerial + stepSpan * 3,
        targetBandMarker: stretchTarget,
        status: milestoneStatus(3),
      ),
      RoadmapMilestoneSummary(
        index: 4,
        key: 'full_mock_readiness',
        titleEn: 'Full-Exam Stamina & Target Lock',
        titleFa: 'شبیه‌سازی کامل و تثبیت نمره هدف',
        goalEn: 'Lock target $targetBand with full timed endurance',
        goalFa: 'آمادگی کامل برای کسب نمره هدف $targetBand',
        phase: AdaptationPhase.examBreadth,
        startDaySerial: todaySerial + stepSpan * 3,
        endDaySerial:
            targetDateSerial ?? (todaySerial + math.max(daysRemaining, 4)),
        targetBandMarker: targetBand,
        status: milestoneStatus(4),
      ),
    ];

    return GeneratedRoadmap(
      isSprintMode: isSprintMode,
      currentPhase: activeStep?.phaseTag ?? coachSelection.phase,
      milestones: milestones,
      steps: steps,
      activeStep: activeStep,
      recalibrationReasonEn: isSprintMode
          ? 'Sprint Plan ($daysRemaining days left): focusing strictly on highest-impact steps.'
          : 'Plan calibrated around ${primaryFav.labelEn} toward Band $targetBand.',
      recalibrationReasonFa: isSprintMode
          ? 'برنامه فشرده ($daysRemaining روز تا آزمون): تمرکز روی بیشترین رشد نمره.'
          : 'نقشه راه بر اساس علاقه «${primaryFav.labelFa}» و هدف $targetBand تنظیم شد.',
    );
  }
}

class _DraftStep {
  const new({
    required this.stepKey,
    required this.milestoneIndex,
    required this.stepKind,
    required this.targetRefId,
    required this.skill,
    required this.topicKey,
    required this.weaknessKey,
    required this.phaseTag,
    required this.difficultyCefr,
    required this.titleEn,
    required this.titleFa,
    required this.reasonEn,
    required this.reasonFa,
    required this.estimatedMinutes,
  });

  final String stepKey;
  final int milestoneIndex;
  final RoadmapStepKind stepKind;
  final String targetRefId;
  final String skill;
  final CanonicalTopicKey topicKey;
  final String? weaknessKey;
  final AdaptationPhase phaseTag;
  final AuthoringTier difficultyCefr;
  final String titleEn;
  final String titleFa;
  final String reasonEn;
  final String reasonFa;
  final int estimatedMinutes;
}

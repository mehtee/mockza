import 'package:dio/dio.dart';
import 'package:meta/meta.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';

/// Confidence tier of a live estimated band score.
enum BandConfidenceTier {
  /// Seeded from initial 10-min check or 1 practice test.
  provisional('provisional'),

  /// 2–3 recent inputs across modes.
  developing('developing'),

  /// 4+ recent calibrated inputs.
  calibrated('calibrated');

  new(this.wireValue);

  /// Wire string matching backend enum.
  final String wireValue;

  /// Parses wire value with fallback to [BandConfidenceTier.provisional].
  static BandConfidenceTier parse(String? raw) => values.firstWhere(
    (e) => e.wireValue == raw,
    orElse: () => BandConfidenceTier.provisional,
  );
}

/// Live skill band estimate summary.
@immutable
class LiveSkillBandStateDto {
  /// Creates a [LiveSkillBandStateDto].
  const new({
    required this.score,
    required this.confidence,
    required this.evidenceCount,
    this.lastUpdatedAt,
    this.trendDelta,
  });

  /// Parses from JSON map.
  factory fromJson(Map<String, Object?> json) => LiveSkillBandStateDto(
    score: (json['score'] as num?)?.toDouble(),
    confidence: BandConfidenceTier.parse(json['confidence'] as String?),
    evidenceCount: (json['evidenceCount'] as num?)?.toInt() ?? 0,
    lastUpdatedAt: json['lastUpdatedAt'] as String?,
    trendDelta: (json['trendDelta'] as num?)?.toDouble(),
  );

  /// Estimated skill band or null.
  final double? score;

  /// Confidence level.
  final BandConfidenceTier confidence;

  /// Number of recorded events.
  final int evidenceCount;

  /// ISO timestamp of last update.
  final String? lastUpdatedAt;

  /// Recent score delta.
  final double? trendDelta;
}

/// Live 4-skill + overall estimated band profile.
@immutable
class LiveBandProfileDto {
  /// Creates a [LiveBandProfileDto].
  const new({
    required this.examTrack,
    required this.currentBand,
    required this.targetBand,
    required this.bandShift,
    required this.confidence,
    required this.skills,
  });

  /// Parses from JSON map.
  factory fromJson(Map<String, Object?> json) {
    final skillsRaw =
        (json['skills'] as Map<String, Object?>?) ?? const <String, Object?>{};
    final skills = <String, LiveSkillBandStateDto>{};
    for (final entry in skillsRaw.entries) {
      if (entry.value is Map<String, Object?>) {
        skills[entry.key] = LiveSkillBandStateDto.fromJson(
          entry.value! as Map<String, Object?>,
        );
      }
    }
    return LiveBandProfileDto(
      examTrack: '${json['examTrack'] ?? 'ielts_academic'}',
      currentBand: (json['currentBand'] as num?)?.toDouble(),
      targetBand: (json['targetBand'] as num?)?.toDouble() ?? 7.0,
      bandShift: (json['bandShift'] as num?)?.toDouble() ?? 0.0,
      confidence: BandConfidenceTier.parse(json['confidence'] as String?),
      skills: skills,
    );
  }

  /// Exam track identifier.
  final String examTrack;

  /// Estimated overall band.
  final double? currentBand;

  /// Learner target band.
  final double targetBand;

  /// Delta shift vs initial/baseline band.
  final double bandShift;

  /// Confidence tier.
  final BandConfidenceTier confidence;

  /// Per-skill live band state map.
  final Map<String, LiveSkillBandStateDto> skills;
}

/// Unified weakness summary item.
@immutable
class WeaknessSummaryDto {
  /// Creates a [WeaknessSummaryDto].
  const new({
    required this.canonicalKey,
    required this.skill,
    required this.displayLabelEn,
    required this.displayLabelFa,
    required this.masteryScoreMilli,
    required this.evidenceCount,
    required this.status,
  });

  /// Parses from JSON map.
  factory fromJson(Map<String, Object?> json) => WeaknessSummaryDto(
    canonicalKey: '${json['canonicalKey'] ?? ''}',
    skill: '${json['skill'] ?? 'mixed'}',
    displayLabelEn: '${json['displayLabelEn'] ?? ''}',
    displayLabelFa: '${json['displayLabelFa'] ?? ''}',
    masteryScoreMilli: (json['masteryScoreMilli'] as num?)?.toInt() ?? 400,
    evidenceCount: (json['evidenceCount'] as num?)?.toInt() ?? 1,
    status: '${json['status'] ?? 'active'}',
  );

  /// Canonical weakness key.
  final String canonicalKey;

  /// Owning skill (`reading`, `listening`, `writing`, `speaking`, `mixed`).
  final String skill;

  /// English label.
  final String displayLabelEn;

  /// Persian label.
  final String displayLabelFa;

  /// Mastery score `0..1000`.
  final int masteryScoreMilli;

  /// Observed occurrences.
  final int evidenceCount;

  /// `active`, `resolving`, or `mastered`.
  final String status;
}

/// Milestone summary inside the 4-milestone Panorama (دورنما).
@immutable
class RoadmapMilestoneDto {
  /// Creates a [RoadmapMilestoneDto].
  const new({
    required this.index,
    required this.titleEn,
    required this.titleFa,
    required this.phaseLabelEn,
    required this.phaseLabelFa,
    required this.targetBandDelta,
    required this.status,
  });

  /// Parses from JSON map.
  factory fromJson(Map<String, Object?> json) => RoadmapMilestoneDto(
    index: (json['index'] as num?)?.toInt() ?? 1,
    titleEn: '${json['titleEn'] ?? ''}',
    titleFa: '${json['titleFa'] ?? ''}',
    phaseLabelEn: '${json['phaseLabelEn'] ?? ''}',
    phaseLabelFa: '${json['phaseLabelFa'] ?? ''}',
    targetBandDelta: (json['targetBandDelta'] as num?)?.toDouble() ?? 0.5,
    status: '${json['status'] ?? 'locked'}',
  );

  /// Milestone number `1..4`.
  final int index;

  /// English title.
  final String titleEn;

  /// Persian title.
  final String titleFa;

  /// Phase subtitle in English.
  final String phaseLabelEn;

  /// Phase subtitle in Persian.
  final String phaseLabelFa;

  /// Planned band delta.
  final double targetBandDelta;

  /// `locked`, `active`, or `completed`.
  final String status;
}

/// Canonical study focus values synced with backend `@mockza/contracts`.
enum StudyFocusMode {
  /// Exam simulation tracks.
  exams('exams'),

  /// Smart coach daily missions.
  coach('coach'),

  /// Balanced exams + smart coach.
  both('both'),

  /// Intensive speaking & pronunciation path.
  speakingOnly('speaking_only');

  new(this.wire);

  /// Backend wire literal.
  final String wire;
}

/// Canonical band-event skills synced with backend `@mockza/contracts`.
enum BandEventSkill {
  /// Reading comprehension.
  reading('reading'),

  /// Listening comprehension.
  listening('listening'),

  /// Writing evaluation.
  writing('writing'),

  /// Speaking & pronunciation evaluation.
  speaking('speaking');

  new(this.wire);

  /// Backend wire literal.
  final String wire;
}

/// Canonical band-event source kinds synced with backend `@mockza/contracts`.
enum BandEventSourceKind {
  /// Initial or retake diagnostic session.
  diagnostic('diagnostic'),

  /// Single section objective or subjective practice.
  practiceSection('practice_section'),

  /// Full simulated exam.
  fullMock('full_mock'),

  /// AI writing grading result.
  writingEval('writing_eval'),

  /// AI speaking grading result.
  speakingEval('speaking_eval'),

  /// 2-3 minute targeted micro-drill.
  microDrill('micro_drill'),

  /// 10-minute daily coach mission.
  mission('mission'),

  /// Shadow pronunciation practice.
  pronunciation('pronunciation');

  new(this.wire);

  /// Backend wire literal.
  final String wire;
}

/// Individual step inside the learner's progressive roadmap.
@immutable
class RoadmapStepDto {
  /// Creates a [RoadmapStepDto].
  const new({
    required this.stepId,
    required this.milestoneIndex,
    required this.stepOrder,
    required this.stepKind,
    required this.titleEn,
    required this.titleFa,
    required this.reasonEn,
    required this.reasonFa,
    required this.topicKey,
    required this.targetRoute,
    required this.status,
    required this.estimatedMinutes,
    this.skill = 'all',
    this.weaknessKey,
    this.targetEntityId,
  });

  /// Parses from JSON map.
  factory fromJson(Map<String, Object?> json) => RoadmapStepDto(
    stepId: '${json['stepId'] ?? ''}',
    milestoneIndex: (json['milestoneIndex'] as num?)?.toInt() ?? 1,
    stepOrder: (json['stepOrder'] as num?)?.toInt() ?? 1,
    stepKind: '${json['stepKind'] ?? 'vocab_wave'}',
    skill: '${json['skill'] ?? 'all'}',
    titleEn: '${json['titleEn'] ?? ''}',
    titleFa: '${json['titleFa'] ?? ''}',
    reasonEn: '${json['reasonEn'] ?? ''}',
    reasonFa: '${json['reasonFa'] ?? ''}',
    topicKey: '${json['topicKey'] ?? 'academic_core'}',
    weaknessKey: json['weaknessKey'] as String?,
    targetRoute: '${json['targetRoute'] ?? '/practice'}',
    targetEntityId: json['targetEntityId'] as String?,
    status: '${json['status'] ?? 'locked'}',
    estimatedMinutes: (json['estimatedMinutes'] as num?)?.toInt() ?? 10,
  );

  /// Unique step ID.
  final String stepId;

  /// Owning milestone `1..4`.
  final int milestoneIndex;

  /// Sequential order index.
  final int stepOrder;

  /// Step type (`vocab_wave`, `micro_drill`, `daily_mission`, `pronunciation`, etc.).
  final String stepKind;

  /// Associated skill (`reading`, `listening`, `writing`, `speaking`, `vocabulary`, `all`).
  final String skill;

  /// English step title.
  final String titleEn;

  /// Persian step title.
  final String titleFa;

  /// English personalization explanation.
  final String reasonEn;

  /// Persian personalization explanation.
  final String reasonFa;

  /// Canonical topic key.
  final String topicKey;

  /// Optional linked weakness key.
  final String? weaknessKey;

  /// Route target.
  final String targetRoute;

  /// Optional target pack/drill ID.
  final String? targetEntityId;

  /// `locked`, `active`, `completed`, or `skipped`.
  final String status;

  /// Estimated completion duration in minutes.
  final int estimatedMinutes;
}

/// Progressive 15-word vocabulary wave + daily 10/day cap summary.
@immutable
class VocabWaveSummaryDto {
  /// Creates a [VocabWaveSummaryDto].
  const new({
    required this.unlockedWave,
    required this.totalWaves,
    required this.currentWaveTotal,
    required this.currentWaveLearned,
    required this.readyToUnlockNext,
    required this.dailyNewRemaining,
  });

  /// Parses from JSON map.
  factory fromJson(Map<String, Object?> json) => VocabWaveSummaryDto(
    unlockedWave: (json['unlockedWave'] as num?)?.toInt() ?? 1,
    totalWaves: (json['totalWaves'] as num?)?.toInt() ?? 1,
    currentWaveTotal: (json['currentWaveTotal'] as num?)?.toInt() ?? 0,
    currentWaveLearned: (json['currentWaveLearned'] as num?)?.toInt() ?? 0,
    readyToUnlockNext: json['readyToUnlockNext'] == true,
    dailyNewRemaining: (json['dailyNewRemaining'] as num?)?.toInt() ?? 10,
  );

  /// Active unlocked wave number.
  final int unlockedWave;

  /// Total waves in deck.
  final int totalWaves;

  /// Word count in active wave.
  final int currentWaveTotal;

  /// Words reviewed/learned in active wave.
  final int currentWaveLearned;

  /// Whether next wave can be unlocked cleanly.
  final bool readyToUnlockNext;

  /// Remaining new words allowed today under 10/day cap.
  final int dailyNewRemaining;
}

/// Recommended practice pack or micro-drill entry.
@immutable
class RecommendedItemDto {
  /// Creates a [RecommendedItemDto].
  const new({
    required this.id,
    required this.phase,
    required this.topicKey,
    required this.reasonEn,
    required this.reasonFa,
    this.weaknessKey,
  });

  /// Parses pack recommendation JSON.
  factory fromPackJson(Map<String, Object?> json) => RecommendedItemDto(
    id: '${json['packId'] ?? ''}',
    phase: '${json['phase'] ?? 'favorite_topics'}',
    topicKey: '${json['topicKey'] ?? 'academic_core'}',
    weaknessKey: json['weaknessKey'] as String?,
    reasonEn: '${json['reasonEn'] ?? ''}',
    reasonFa: '${json['reasonFa'] ?? ''}',
  );

  /// Parses drill recommendation JSON.
  factory fromDrillJson(Map<String, Object?> json) => RecommendedItemDto(
    id: '${json['drillId'] ?? ''}',
    phase: '${json['phase'] ?? 'favorite_topics'}',
    topicKey: '${json['topicKey'] ?? 'academic_core'}',
    weaknessKey: json['weaknessKey'] as String?,
    reasonEn: '${json['reasonEn'] ?? ''}',
    reasonFa: '${json['reasonFa'] ?? ''}',
  );

  /// `packId` or `drillId`.
  final String id;

  /// `favorite_topics`, `weakness_transfer`, or `exam_breadth`.
  final String phase;

  /// Topic key.
  final String topicKey;

  /// Optional weakness key.
  final String? weaknessKey;

  /// English reason label.
  final String reasonEn;

  /// Persian reason label.
  final String reasonFa;
}

/// Full adaptive learner personalization snapshot returned by `/v1/personalization/*`.
@immutable
class PersonalizationStateDto {
  /// Creates a [PersonalizationStateDto].
  const new({
    required this.rawJson,
    required this.examTrack,
    required this.targetBand,
    required this.favoriteTopics,
    required this.activeWeaknessPhase,
    required this.vocabUnlockedWave,
    required this.dailyNewVocabCap,
    required this.liveBand,
    required this.weaknesses,
    required this.milestones,
    required this.steps,
    required this.vocabWaveSummary,
    this.studyFocus = 'both',
    this.preferredTtsAccent = 'us',
    this.bandShiftAcknowledged = false,
    this.masteredInFavoriteTopicsCount = 0,
    this.transferredToOtherTopicsCount = 0,
    this.currentStep,
    this.nextRecommendedPack,
    this.nextRecommendedDrill,
    this.recommendedPacks = const <RecommendedItemDto>[],
    this.recommendedDrills = const <RecommendedItemDto>[],
  });

  /// Parses full snapshot JSON from `/v1/personalization/state`.
  factory fromJson(Map<String, Object?> json) {
    final profile =
        (json['profile'] as Map<String, Object?>?) ?? const <String, Object?>{};
    final coverage =
        (json['topicCoverageSummary'] as Map<String, Object?>?) ??
        const <String, Object?>{};
    final roadmap =
        (json['roadmap'] as Map<String, Object?>?) ?? const <String, Object?>{};
    final milestones = ((roadmap['milestones'] as List<dynamic>?) ?? const <dynamic>[])
        .whereType<Map<String, Object?>>()
        .map(RoadmapMilestoneDto.fromJson)
        .toList(growable: false);
    final steps = ((roadmap['steps'] as List<dynamic>?) ?? const <dynamic>[])
        .whereType<Map<String, Object?>>()
        .map(RoadmapStepDto.fromJson)
        .toList(growable: false);
    final currentStepRaw = roadmap['currentStep'];
    final currentStep = currentStepRaw is Map<String, Object?>
        ? RoadmapStepDto.fromJson(currentStepRaw)
        : null;
    final weaknesses = ((json['weaknesses'] as List<dynamic>?) ?? const <dynamic>[])
        .whereType<Map<String, Object?>>()
        .map(WeaknessSummaryDto.fromJson)
        .toList(growable: false);
    final nextPackRaw = json['nextRecommendedPack'];
    final nextDrillRaw = json['nextRecommendedDrill'];
    final recPacks =
        ((json['recommendedPacks'] as List<dynamic>?) ?? const <dynamic>[])
            .whereType<Map<String, Object?>>()
            .map(RecommendedItemDto.fromPackJson)
            .toList(growable: false);
    final recDrills =
        ((json['recommendedDrills'] as List<dynamic>?) ?? const <dynamic>[])
            .whereType<Map<String, Object?>>()
            .map(RecommendedItemDto.fromDrillJson)
            .toList(growable: false);

    return PersonalizationStateDto(
      rawJson: json,
      examTrack: '${profile['examTrack'] ?? 'ielts_academic'}',
      targetBand: (profile['targetBand'] as num?)?.toDouble() ?? 7.0,
      studyFocus: '${profile['studyFocus'] ?? 'both'}',
      preferredTtsAccent: '${profile['preferredTtsAccent'] ?? 'us'}',
      bandShiftAcknowledged: profile['bandShiftAcknowledged'] == true,
      favoriteTopics: ((profile['favoriteTopics'] as List<dynamic>?) ?? const <dynamic>[])
          .whereType<String>()
          .toList(growable: false),
      activeWeaknessPhase: '${profile['activeWeaknessPhase'] ?? 'favorite_topics'}',
      vocabUnlockedWave: (profile['vocabUnlockedWave'] as num?)?.toInt() ?? 1,
      dailyNewVocabCap: (profile['dailyNewVocabCap'] as num?)?.toInt() ?? 10,
      masteredInFavoriteTopicsCount:
          (coverage['masteredInFavoriteTopicsCount'] as num?)?.toInt() ?? 0,
      transferredToOtherTopicsCount:
          (coverage['transferredToOtherTopicsCount'] as num?)?.toInt() ?? 0,
      liveBand: LiveBandProfileDto.fromJson(
        (json['liveBand'] as Map<String, Object?>?) ?? const <String, Object?>{},
      ),
      weaknesses: weaknesses,
      milestones: milestones,
      currentStep: currentStep,
      steps: steps,
      vocabWaveSummary: VocabWaveSummaryDto.fromJson(
        (json['vocabWaveSummary'] as Map<String, Object?>?) ??
            const <String, Object?>{},
      ),
      nextRecommendedPack: nextPackRaw is Map<String, Object?>
          ? RecommendedItemDto.fromPackJson(nextPackRaw)
          : null,
      nextRecommendedDrill: nextDrillRaw is Map<String, Object?>
          ? RecommendedItemDto.fromDrillJson(nextDrillRaw)
          : null,
      recommendedPacks: recPacks,
      recommendedDrills: recDrills,
    );
  }

  /// Raw response map for local SQLite caching.
  final Map<String, Object?> rawJson;

  /// Exam track.
  final String examTrack;

  /// Target band.
  final double targetBand;

  /// Favorite topic wire keys.
  final List<String> favoriteTopics;

  /// `favorite_topics`, `weakness_transfer`, or `exam_breadth`.
  final String activeWeaknessPhase;

  /// Unlocked 15-word vocab wave index.
  final int vocabUnlockedWave;

  /// Daily new word cap (`10`).
  final int dailyNewVocabCap;

  /// Live dynamic band state.
  final LiveBandProfileDto liveBand;

  /// Ranked recurring weaknesses.
  final List<WeaknessSummaryDto> weaknesses;

  /// 4-milestone panorama overview.
  final List<RoadmapMilestoneDto> milestones;

  /// Current primary step in progress.
  final RoadmapStepDto? currentStep;

  /// Full ordered roadmap step list.
  final List<RoadmapStepDto> steps;

  /// Vocab progressive wave + daily cap counters.
  final VocabWaveSummaryDto vocabWaveSummary;

  /// Top recommended practice pack.
  final RecommendedItemDto? nextRecommendedPack;

  /// Top recommended micro-drill.
  final RecommendedItemDto? nextRecommendedDrill;

  /// Learner preferred focus (`exams`, `coach`, `both`, or `speaking_only`).
  final String studyFocus;

  /// Preferred reference TTS accent (`us` or `uk`).
  final String preferredTtsAccent;

  /// Whether the learner dismissed the current band-shift banner.
  final bool bandShiftAcknowledged;

  /// Count of weaknesses resolved in favorite topics.
  final int masteredInFavoriteTopicsCount;

  /// Count of weaknesses transferred into cross-topic exam sets.
  final int transferredToOtherTopicsCount;

  /// Ranked practice pack recommendations.
  final List<RecommendedItemDto> recommendedPacks;

  /// Ranked micro-drill recommendations.
  final List<RecommendedItemDto> recommendedDrills;
}

/// Abstract gateway for `/v1/personalization/*` and `/v1/sync/*`.
abstract interface class PersonalizationGateway {
  /// Fetches full personalization snapshot.
  Future<Result<PersonalizationStateDto, Failure>> getState();

  /// Updates personalization profile preferences & triggers roadmap recalibration.
  Future<Result<PersonalizationStateDto, Failure>> updateProfile({
    String? examTrack,
    double? targetBand,
    String? targetDateIso,
    String? studyFocus,
    List<String>? favoriteTopics,
    int? dailyNewVocabCap,
    String? preferredTtsAccent,
    bool? onboardingCompleted,
    bool? unlockNextVocabWave,
  });

  /// Records a new band event after objective, writing, speaking, drill, or pronunciation completion.
  Future<Result<PersonalizationStateDto, Failure>> recordBandEvent({
    required String examTrack,
    required String skill,
    required String sourceKind,
    required String sourceId,
    required double rawScore,
    int? durationSeconds,
    double? accuracyRatio,
    List<String> topicKeys = const <String>[],
    List<Map<String, Object?>>? questionTypeStats,
    String? packId,
    String? attemptId,
    double? scoreBand,
    Map<String, Object?>? answersJson,
    Map<String, Object?>? feedbackJson,
  });

  /// Marks or skips a roadmap step and advances the next unlocked step.
  Future<Result<PersonalizationStateDto, Failure>> advanceRoadmapStep({
    required String stepId,
    required String status,
  });

  /// Acknowledges band-shift celebration banner (`POST /v1/personalization/band-shift/ack`).
  Future<Result<bool, Failure>> ackBandShift();

  /// Pulls cross-device snapshot from `/v1/sync/pull` with optional incremental `since` cursor.
  Future<Result<Map<String, Object?>, Failure>> pullSyncRaw({String? sinceIso});

  /// Pushes vocab SRS batch to `/v1/sync/vocab-batch`.
  Future<Result<VocabWaveSummaryDto, Failure>> pushVocabBatch(
    List<Map<String, Object?>> cards,
  );
}

/// HTTP Dio client implementing [PersonalizationGateway].
final class HttpPersonalizationGateway implements PersonalizationGateway {
  /// Creates an [HttpPersonalizationGateway].
  const new(this._dio);

  final Dio _dio;

  @override
  Future<Result<PersonalizationStateDto, Failure>> getState() async {
    try {
      final res = await _dio.get<Map<String, Object?>>(
        '/v1/personalization/state',
      );
      return Ok(
        PersonalizationStateDto.fromJson(res.data ?? const <String, Object?>{}),
      );
    } on DioException catch (e) {
      return Err(NetworkFailure(e.message ?? 'Failed to load personalization'));
    } on Object catch (e) {
      return Err(NetworkFailure('$e'));
    }
  }

  @override
  Future<Result<PersonalizationStateDto, Failure>> updateProfile({
    String? examTrack,
    double? targetBand,
    String? targetDateIso,
    String? studyFocus,
    List<String>? favoriteTopics,
    int? dailyNewVocabCap,
    String? preferredTtsAccent,
    bool? onboardingCompleted,
    bool? unlockNextVocabWave,
  }) async {
    try {
      final body = <String, Object?>{
        'examTrack': ?examTrack,
        'targetBand': ?targetBand,
        'targetDateIso': ?targetDateIso,
        'studyFocus': ?studyFocus,
        'favoriteTopics': ?favoriteTopics,
        'dailyNewVocabCap': ?dailyNewVocabCap,
        'preferredTtsAccent': ?preferredTtsAccent,
        'onboardingCompleted': ?onboardingCompleted,
        'unlockNextVocabWave': ?unlockNextVocabWave,
      };
      final res = await _dio.put<Map<String, Object?>>(
        '/v1/personalization/profile',
        data: body,
      );
      return Ok(
        PersonalizationStateDto.fromJson(res.data ?? const <String, Object?>{}),
      );
    } on DioException catch (e) {
      return Err(NetworkFailure(e.message ?? 'Profile sync failed'));
    } on Object catch (e) {
      return Err(NetworkFailure('$e'));
    }
  }

  @override
  Future<Result<PersonalizationStateDto, Failure>> recordBandEvent({
    required String examTrack,
    required String skill,
    required String sourceKind,
    required String sourceId,
    required double rawScore,
    int? durationSeconds,
    double? accuracyRatio,
    List<String> topicKeys = const <String>[],
    List<Map<String, Object?>>? questionTypeStats,
    String? packId,
    String? attemptId,
    double? scoreBand,
    Map<String, Object?>? answersJson,
    Map<String, Object?>? feedbackJson,
  }) async {
    try {
      final res = await _dio.post<Map<String, Object?>>(
        '/v1/personalization/band-event',
        data: <String, Object?>{
          'examTrack': examTrack,
          'skill': skill,
          'sourceKind': sourceKind,
          'sourceId': sourceId,
          'rawScore': rawScore,
          'durationSeconds': ?durationSeconds,
          'accuracyRatio': ?accuracyRatio,
          'topicKeys': topicKeys,
          'questionTypeStats': ?questionTypeStats,
          'packId': ?packId,
          'attemptId': ?attemptId,
          'scoreBand': ?scoreBand,
          'answersJson': ?answersJson,
          'feedbackJson': ?feedbackJson,
        },
      );
      return Ok(
        PersonalizationStateDto.fromJson(res.data ?? const <String, Object?>{}),
      );
    } on DioException catch (e) {
      return Err(NetworkFailure(e.message ?? 'Band event sync failed'));
    } on Object catch (e) {
      return Err(NetworkFailure('$e'));
    }
  }

  @override
  Future<Result<PersonalizationStateDto, Failure>> advanceRoadmapStep({
    required String stepId,
    required String status,
  }) async {
    try {
      final res = await _dio.post<Map<String, Object?>>(
        '/v1/personalization/roadmap/steps/${Uri.encodeComponent(stepId)}/action',
        data: <String, Object?>{'status': status},
      );
      return Ok(
        PersonalizationStateDto.fromJson(res.data ?? const <String, Object?>{}),
      );
    } on DioException catch (e) {
      return Err(NetworkFailure(e.message ?? 'Step update failed'));
    } on Object catch (e) {
      return Err(NetworkFailure('$e'));
    }
  }

  @override
  Future<Result<bool, Failure>> ackBandShift() async {
    try {
      await _dio.post<Map<String, Object?>>(
        '/v1/personalization/band-shift/ack',
      );
      return const Ok(true);
    } on DioException catch (e) {
      return Err(NetworkFailure(e.message ?? 'Failed to acknowledge band shift'));
    } on Object catch (e) {
      return Err(NetworkFailure('$e'));
    }
  }

  @override
  Future<Result<Map<String, Object?>, Failure>> pullSyncRaw({
    String? sinceIso,
  }) async {
    try {
      final res = await _dio.get<Map<String, Object?>>(
        '/v1/sync/pull',
        queryParameters: <String, Object?>{
          if (sinceIso != null && sinceIso.isNotEmpty) 'since': sinceIso,
        },
      );
      return Ok(res.data ?? const <String, Object?>{});
    } on DioException catch (e) {
      return Err(NetworkFailure(e.message ?? 'Sync pull failed'));
    } on Object catch (e) {
      return Err(NetworkFailure('$e'));
    }
  }

  @override
  Future<Result<VocabWaveSummaryDto, Failure>> pushVocabBatch(
    List<Map<String, Object?>> cards,
  ) async {
    try {
      final res = await _dio.post<Map<String, Object?>>(
        '/v1/sync/vocab-batch',
        data: <String, Object?>{'cards': cards},
      );
      return Ok(
        VocabWaveSummaryDto.fromJson(res.data ?? const <String, Object?>{}),
      );
    } on DioException catch (e) {
      return Err(NetworkFailure(e.message ?? 'Vocab batch sync failed'));
    } on Object catch (e) {
      return Err(NetworkFailure('$e'));
    }
  }
}

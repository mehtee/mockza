import 'dart:math' as math;

import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/core/exams/exam_spec.dart';

/// Confidence stage for an estimated score or skill.
enum BandConfidence {
  /// No evidence recorded yet.
  none('none'),

  /// Seeded from 10-min check or single untimed sample.
  provisional('provisional'),

  /// 1-2 timed real attempts recorded.
  developing('developing'),

  /// Full 3+ timed attempts across skills or full mock completed.
  calibrated('calibrated');

  new(this.wireValue);

  /// Wire string value.
  final String wireValue;

  /// Parses wire value defaulting to [none].
  static BandConfidence fromWire(String? raw) => switch (raw) {
    'provisional' => BandConfidence.provisional,
    'developing' => BandConfidence.developing,
    'calibrated' => BandConfidence.calibrated,
    _ => BandConfidence.none,
  };
}

/// Provenance source for a recorded score evidence event.
enum BandEventSourceKind {
  /// Full calibrated 4-skill mock exam (`1.00`).
  fullMock('full_mock'),

  /// Timed single-skill simulation in Exam Mode (`0.85`).
  timedExam('timed_exam'),

  /// Untimed Study Mode practice (`0.45`).
  studyMode('study_mode'),

  /// 10-min rapid starting check (`0.40 * 0.5^nReal`).
  diagnostic('diagnostic'),

  /// Focused 3-minute micro-drill (`0.20`).
  microDrill('micro_drill');

  new(this.wireValue);

  /// Wire string value.
  final String wireValue;

  /// Parses wire string defaulting to [studyMode].
  static BandEventSourceKind fromWire(String? raw) => switch (raw) {
    'full_mock' => BandEventSourceKind.fullMock,
    'timed_exam' => BandEventSourceKind.timedExam,
    'diagnostic' => BandEventSourceKind.diagnostic,
    'micro_drill' => BandEventSourceKind.microDrill,
    _ => BandEventSourceKind.studyMode,
  };
}

/// Single score evidence input for [LiveBandEngine].
class BandEvidenceEvent {
  /// Creates a [BandEvidenceEvent].
  const new({
    required this.skill,
    required this.sourceKind,
    required this.rawScore,
    required this.recordedAtMs,
    this.cefrEstimate,
  });

  /// Target skill (`reading`, `listening`, `writing`, `speaking`).
  final String skill;

  /// Event source provenance.
  final BandEventSourceKind sourceKind;

  /// Numeric score on exam track scale.
  final double rawScore;

  /// Recording UTC milliseconds.
  final int recordedAtMs;

  /// Optional CEFR estimate.
  final AuthoringTier? cefrEstimate;
}

/// Live skill band estimate summary.
class LiveSkillBandState {
  /// Creates a [LiveSkillBandState].
  const new({
    required this.skill,
    required this.score,
    required this.cefrEstimate,
    required this.confidence,
    required this.sampleCount,
    required this.trendDelta,
    required this.lastUpdatedAtMs,
  });

  /// Skill identifier.
  final String skill;

  /// Quantized score or null if unestimated.
  final double? score;

  /// Estimated CEFR tier or null.
  final AuthoringTier? cefrEstimate;

  /// Confidence level.
  final BandConfidence confidence;

  /// Total contributing events.
  final int sampleCount;

  /// Trend delta (recent vs prior).
  final double? trendDelta;

  /// Last update timestamp UTC ms.
  final int? lastUpdatedAtMs;
}

/// Emitted when overall score changes by at least 1 exam step.
class BandShiftEvent {
  /// Creates a [BandShiftEvent].
  const new({
    required this.previousOverall,
    required this.nextOverall,
    required this.delta,
  });

  /// Previous overall score.
  final double? previousOverall;

  /// Updated overall score.
  final double? nextOverall;

  /// Difference.
  final double delta;
}

/// Full cross-skill live band profile for an active [ExamTrack].
class LiveBandProfile {
  /// Creates a [LiveBandProfile].
  const new({
    required this.examId,
    required this.overallScore,
    required this.previousOverallScore,
    required this.overallConfidence,
    required this.targetBand,
    required this.skills,
    required this.bandShift,
  });

  /// Active exam track ID.
  final String examId;

  /// Overall quantized score or null.
  final double? overallScore;

  /// Prior overall score before latest recalculation.
  final double? previousOverallScore;

  /// Aggregate confidence.
  final BandConfidence overallConfidence;

  /// User target score.
  final double targetBand;

  /// Per-skill live states keyed by skill name.
  final Map<String, LiveSkillBandState> skills;

  /// Band shift event if moved >= 1 exam step.
  final BandShiftEvent? bandShift;
}

/// Pure deterministic live band & confidence calculator matching `live-band-engine.ts`.
abstract final class LiveBandEngine {
  static const List<String> _coreSkills = <String>[
    'reading',
    'listening',
    'writing',
    'speaking',
  ];
  static const double _halfLifeDays = 21;
  static const int _msPerDay = 86400000;

  /// Maps diagnostic CEFR tier (`A1..C2`) to conservative provisional numeric score on [track].
  static double mapCefrTierToExamScore(AuthoringTier tier, ExamTrack track) {
    switch (track) {
      case ExamTrack.ieltsAcademic:
      case ExamTrack.ieltsGeneral:
        return switch (tier) {
          AuthoringTier.a1 => 3.5,
          AuthoringTier.a2 => 4.5,
          AuthoringTier.b1 => 5.5,
          AuthoringTier.b2 => 6.5,
          AuthoringTier.c1 => 7.5,
          AuthoringTier.c2 => 8.5,
        };
      case ExamTrack.toeflIbt:
        return switch (tier) {
          AuthoringTier.a1 => 1.5,
          AuthoringTier.a2 => 2.5,
          AuthoringTier.b1 => 3.5,
          AuthoringTier.b2 => 4.5,
          AuthoringTier.c1 => 5.5,
          AuthoringTier.c2 => 6.0,
        };
      case ExamTrack.pteAcademic:
        return switch (tier) {
          AuthoringTier.a1 => 24,
          AuthoringTier.a2 => 36,
          AuthoringTier.b1 => 50,
          AuthoringTier.b2 => 65,
          AuthoringTier.c1 => 79,
          AuthoringTier.c2 => 86,
        };
      case ExamTrack.det:
        return switch (tier) {
          AuthoringTier.a1 => 45,
          AuthoringTier.a2 => 65,
          AuthoringTier.b1 => 85,
          AuthoringTier.b2 => 110,
          AuthoringTier.c1 => 135,
          AuthoringTier.c2 => 150,
        };
    }
  }

  /// Estimates broad CEFR tier from numeric exam score.
  static AuthoringTier? estimateCefrTierFromScore(
    double? score,
    ExamTrack track,
  ) {
    if (score == null || !score.isFinite) return null;
    if (track.isIelts) {
      if (score >= 8.25) return AuthoringTier.c2;
      if (score >= 7.0) return AuthoringTier.c1;
      if (score >= 6.0) return AuthoringTier.b2;
      if (score >= 5.0) return AuthoringTier.b1;
      if (score >= 4.0) return AuthoringTier.a2;
      return AuthoringTier.a1;
    }
    final ratio = track.normalizeScoreRatio(score);
    if (ratio >= 0.88) return AuthoringTier.c2;
    if (ratio >= 0.72) return AuthoringTier.c1;
    if (ratio >= 0.54) return AuthoringTier.b2;
    if (ratio >= 0.36) return AuthoringTier.b1;
    if (ratio >= 0.20) return AuthoringTier.a2;
    return AuthoringTier.a1;
  }

  /// Returns base source weight matching `sourceWeightForKind`.
  static double sourceWeightForKind(BandEventSourceKind kind) => switch (kind) {
    BandEventSourceKind.fullMock => 1.0,
    BandEventSourceKind.timedExam => 0.85,
    BandEventSourceKind.studyMode => 0.45,
    BandEventSourceKind.diagnostic => 0.4,
    BandEventSourceKind.microDrill => 0.2,
  };

  /// Computes complete [LiveBandProfile] from chronological evidence events.
  static LiveBandProfile computeLiveBandProfile({
    required List<BandEvidenceEvent> events,
    required ExamTrack track,
    required double targetBand,
    required int nowUtcMs,
    double? previousOverallScore,
  }) {
    final skillStates = <String, LiveSkillBandState>{};

    for (final skill in _coreSkills) {
      final skillEvents = events
          .where((e) => e.skill == skill && e.rawScore.isFinite)
          .toList()
        ..sort((a, b) => a.recordedAtMs.compareTo(b.recordedAtMs));

      if (skillEvents.isEmpty) {
        skillStates[skill] = LiveSkillBandState(
          skill: skill,
          score: null,
          cefrEstimate: null,
          confidence: BandConfidence.none,
          sampleCount: 0,
          trendDelta: null,
          lastUpdatedAtMs: null,
        );
        continue;
      }

      final realCount = skillEvents
          .where(
            (e) =>
                e.sourceKind == BandEventSourceKind.fullMock ||
                e.sourceKind == BandEventSourceKind.timedExam ||
                e.sourceKind == BandEventSourceKind.studyMode,
          )
          .length;
      final timedCount = skillEvents
          .where(
            (e) =>
                e.sourceKind == BandEventSourceKind.fullMock ||
                e.sourceKind == BandEventSourceKind.timedExam,
          )
          .length;
      final hasFullMock = skillEvents.any(
        (e) => e.sourceKind == BandEventSourceKind.fullMock,
      );

      var weightedSum = 0.0;
      var totalWeight = 0.0;
      for (final ev in skillEvents) {
        final ageDays = math.max<double>(
          0,
          (nowUtcMs - ev.recordedAtMs) / _msPerDay,
        );
        final decay = math.pow(0.5, ageDays / _halfLifeDays).toDouble();
        var baseW = sourceWeightForKind(ev.sourceKind);
        if (ev.sourceKind == BandEventSourceKind.diagnostic) {
          baseW = 0.4 * math.pow(0.5, realCount).toDouble();
        }
        final effectiveW = baseW * decay;
        weightedSum += ev.rawScore * effectiveW;
        totalWeight += effectiveW;
      }

      final rawMean = totalWeight > 0
          ? weightedSum / totalWeight
          : skillEvents.first.rawScore;
      final score = track.quantizeScore(rawMean);
      final cefr = estimateCefrTierFromScore(score, track);

      var confidence = BandConfidence.provisional;
      if (timedCount >= 3 || (hasFullMock && timedCount >= 1)) {
        confidence = BandConfidence.calibrated;
      } else if (timedCount >= 1 || realCount >= 2) {
        confidence = BandConfidence.developing;
      }

      double? trendDelta;
      if (skillEvents.length >= 2) {
        final splitIdx = math.max<int>(
          1,
          skillEvents.length - math.min<int>(3, skillEvents.length ~/ 2),
        );
        final prior = skillEvents.sublist(0, splitIdx);
        final recent = skillEvents.sublist(splitIdx);
        final priorMean =
            prior.fold<double>(0, (s, e) => s + e.rawScore) / prior.length;
        final recentMean =
            recent.fold<double>(0, (s, e) => s + e.rawScore) / recent.length;
        final qDelta =
            track.quantizeScore(recentMean) - track.quantizeScore(priorMean);
        trendDelta = double.parse(qDelta.toStringAsFixed(2));
      }

      skillStates[skill] = LiveSkillBandState(
        skill: skill,
        score: score,
        cefrEstimate: cefr,
        confidence: confidence,
        sampleCount: skillEvents.length,
        trendDelta: trendDelta,
        lastUpdatedAtMs: skillEvents.last.recordedAtMs,
      );
    }

    final populated = _coreSkills
        .map((s) => skillStates[s]!)
        .where((s) => s.score != null)
        .toList(growable: false);

    double? overallScore;
    var overallConfidence = BandConfidence.none;

    if (populated.isNotEmpty) {
      final mean =
          populated.fold<double>(0, (acc, s) => acc + s.score!) /
          populated.length;
      overallScore = track.quantizeScore(mean);

      final allCalibrated =
          populated.length == 4 &&
          populated.every(
            (s) => s.confidence.index >= BandConfidence.calibrated.index,
          );
      final anyDeveloping = populated.any(
        (s) => s.confidence.index >= BandConfidence.developing.index,
      );
      if (allCalibrated) {
        overallConfidence = BandConfidence.calibrated;
      } else if (populated.length >= 2 && anyDeveloping) {
        overallConfidence = BandConfidence.developing;
      } else {
        overallConfidence = BandConfidence.provisional;
      }
    }

    BandShiftEvent? bandShift;
    if (previousOverallScore != null &&
        overallScore != null &&
        (overallScore - previousOverallScore).abs() >= track.scoreStep - 1e-6) {
      bandShift = BandShiftEvent(
        previousOverall: previousOverallScore,
        nextOverall: overallScore,
        delta: double.parse(
          (overallScore - previousOverallScore).toStringAsFixed(2),
        ),
      );
    }

    return LiveBandProfile(
      examId: track.id,
      overallScore: overallScore,
      previousOverallScore: previousOverallScore,
      overallConfidence: overallConfidence,
      targetBand: track.quantizeScore(targetBand),
      skills: skillStates,
      bandShift: bandShift,
    );
  }
}

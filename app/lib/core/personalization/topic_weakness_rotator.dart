import 'dart:math' as math;

import 'package:mockza/core/advanced/linguistic_graph_math.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/personalization/live_band_engine.dart';
import 'package:mockza/core/personalization/topic_taxonomy.dart';

/// Current adaptation phase in the 3-Phase Topic x Weakness Rotation loop.
enum AdaptationPhase {
  /// New learner starting with chosen favorite topics.
  ignition('ignition'),

  /// Drilling active weaknesses inside the learner's favorite topics.
  interestWeakness('interest_weakness'),

  /// Transferring unmastered weaknesses into other high-yield exam topics.
  crossTopicTransfer('cross_topic_transfer'),

  /// Broadening across unseen exam domains & full mocks.
  examBreadth('exam_breadth');

  new(this.wireValue);

  /// Wire string matching backend API & TS domain.
  final String wireValue;

  /// Parses wire value defaulting to [ignition].
  static AdaptationPhase fromWire(String? raw) => switch (raw) {
    'interest_weakness' => AdaptationPhase.interestWeakness,
    'cross_topic_transfer' => AdaptationPhase.crossTopicTransfer,
    'exam_breadth' => AdaptationPhase.examBreadth,
    _ => AdaptationPhase.ignition,
  };
}

/// Topic x Weakness coverage counter row.
class TopicWeaknessCoverageEntry {
  /// Creates a [TopicWeaknessCoverageEntry].
  const new({
    required this.weaknessKey,
    required this.topicKey,
    required this.practiceCount,
    required this.passCount,
    required this.lastMasteryMilli,
    required this.lastPracticedDaySerial,
  });

  /// Canonical weakness key.
  final String weaknessKey;

  /// Canonical topic key.
  final CanonicalTopicKey topicKey;

  /// Completed practice count.
  final int practiceCount;

  /// Successful pass count.
  final int passCount;

  /// Latest mastery milli `[0..1000]`.
  final int lastMasteryMilli;

  /// UTC serial day when last practiced.
  final int lastPracticedDaySerial;
}

/// Candidate item metadata for ranking.
class AdaptiveContentCandidate {
  /// Creates an [AdaptiveContentCandidate].
  const new({
    required this.id,
    required this.topicKeys,
    required this.weaknessTags,
    required this.cefrMin,
    required this.cefrMax,
    this.lastAttemptedDaySerial,
    this.attemptCount = 0,
  });

  /// Pack or drill identifier.
  final String id;

  /// Canonical topic keys.
  final List<CanonicalTopicKey> topicKeys;

  /// Canonical weakness tags.
  final List<String> weaknessTags;

  /// Minimum CEFR tier.
  final AuthoringTier cefrMin;

  /// Maximum CEFR tier.
  final AuthoringTier cefrMax;

  /// Last attempted UTC serial day.
  final int? lastAttemptedDaySerial;

  /// Total prior attempts.
  final int attemptCount;
}

/// Per-weakness phase decision.
class WeaknessPhaseDecision {
  /// Creates a [WeaknessPhaseDecision].
  const new({
    required this.weaknessKey,
    required this.phase,
    required this.favCoverageCount,
    this.favoredTopic,
    this.transferTopic,
  });

  /// Canonical weakness key.
  final String weaknessKey;

  /// Resolved phase for this weakness.
  final AdaptationPhase phase;

  /// Practices done inside favorite topics.
  final int favCoverageCount;

  /// Next favorite topic to drill.
  final CanonicalTopicKey? favoredTopic;

  /// Next transfer topic when Phase 3 activates.
  final CanonicalTopicKey? transferTopic;
}

/// Ranked candidate item with transparent explanation.
class RankedContentItem<T extends AdaptiveContentCandidate> {
  /// Creates a [RankedContentItem].
  const new({
    required this.item,
    required this.score,
    required this.phase,
    required this.matchedTopic,
    required this.matchedWeaknessKey,
    required this.reasonEn,
    required this.reasonFa,
  });

  /// Candidate payload.
  final T item;

  /// Composite priority score (`0..1`).
  final double score;

  /// Phase under which it was ranked.
  final AdaptationPhase phase;

  /// Primary matched topic.
  final CanonicalTopicKey matchedTopic;

  /// Matched active weakness key, if any.
  final String? matchedWeaknessKey;

  /// Transparent English reason.
  final String reasonEn;

  /// Transparent Persian reason.
  final String reasonFa;
}

/// Selected Daily Coach topic decision.
class NextCoachTopicSelection {
  /// Creates a [NextCoachTopicSelection].
  const new({
    required this.topicKey,
    required this.topicLabelEn,
    required this.topicLabelFa,
    required this.phase,
    required this.primaryWeaknessKey,
    required this.reasonEn,
    required this.reasonFa,
  });

  /// Selected topic key.
  final CanonicalTopicKey topicKey;

  /// English label.
  final String topicLabelEn;

  /// Persian label.
  final String topicLabelFa;

  /// Active adaptation phase.
  final AdaptationPhase phase;

  /// Top targeted weakness key, if any.
  final String? primaryWeaknessKey;

  /// English rationale.
  final String reasonEn;

  /// Persian rationale.
  final String reasonFa;
}

/// Deterministic 3-Phase Topic x Weakness Rotation Engine matching `topic-weakness-rotator.ts`.
abstract final class TopicWeaknessRotator {
  static const int _masteredThresholdMilli = 780;

  static int _cefrOrder(AuthoringTier tier) => switch (tier) {
    AuthoringTier.a1 => 1,
    AuthoringTier.a2 => 2,
    AuthoringTier.b1 => 3,
    AuthoringTier.b2 => 4,
    AuthoringTier.c1 => 5,
    AuthoringTier.c2 => 6,
  };

  static double _bandFitScore(
    AuthoringTier minTier,
    AuthoringTier maxTier,
    AuthoringTier curTier,
  ) {
    final cur = _cefrOrder(curTier);
    final zpd = math.min<double>(6, cur + (cur < 6 ? 0.5 : 0));
    final lo = _cefrOrder(minTier);
    final hi = _cefrOrder(maxTier);
    if (zpd >= lo - 0.5 && zpd <= hi + 0.5) return 1;
    final dist = zpd < lo ? lo - zpd : zpd - hi;
    return math.max<double>(
      0.15,
      double.parse((1 - dist * 0.25).toStringAsFixed(3)),
    );
  }

  /// Resolves overall and per-weakness phase decisions.
  static ({
    AdaptationPhase overallPhase,
    List<LinguisticNodeSummary> activeWeaknesses,
    Map<String, WeaknessPhaseDecision> perWeakness,
  })
  resolveWeaknessPhase({
    required List<LinguisticNodeSummary> weaknessNodes,
    required List<CanonicalTopicKey> favoriteTopics,
    required List<TopicWeaknessCoverageEntry> coverage,
    required int currentDaySerial,
    Set<CanonicalTopicKey>? availableTopicsWithWeakness,
  }) {
    final favs = CanonicalTopicKey.normalizeList(
      favoriteTopics.map((e) => e.wireKey).toList(),
    );
    final favSet = favs.toSet();

    final activeWeaknesses =
        weaknessNodes
            .where(
              (n) =>
                  n.nodeKind == LinguisticNodeKind.bottleneck &&
                  n.masteryScoreMilli < _masteredThresholdMilli,
            )
            .toList()
          ..sort((a, b) {
            final pa = LinguisticGraphMath.computeNodePriorityScore(
              node: a,
              currentDaySerial: currentDaySerial,
            );
            final pb = LinguisticGraphMath.computeNodePriorityScore(
              node: b,
              currentDaySerial: currentDaySerial,
            );
            if (pb != pa) return pb.compareTo(pa);
            return a.canonicalKey.compareTo(b.canonicalKey);
          });

    if (activeWeaknesses.isEmpty) {
      final hasHistory =
          weaknessNodes.any(
            (n) => n.nodeKind == LinguisticNodeKind.bottleneck,
          ) ||
          coverage.any((c) => c.practiceCount > 0);
      return (
        overallPhase: hasHistory
            ? AdaptationPhase.examBreadth
            : AdaptationPhase.ignition,
        activeWeaknesses: const <LinguisticNodeSummary>[],
        perWeakness: const <String, WeaknessPhaseDecision>{},
      );
    }

    final perWeakness = <String, WeaknessPhaseDecision>{};
    final transferPriority = CanonicalTopicKey.values
        .where(
          (t) => t != CanonicalTopicKey.academicCore && !favSet.contains(t),
        )
        .toList(growable: false);

    for (final w in activeWeaknesses) {
      final covForW = coverage
          .where((c) => c.weaknessKey == w.canonicalKey)
          .toList(growable: false);
      final favCovCount = covForW
          .where((c) => favSet.contains(c.topicKey))
          .fold<int>(0, (sum, c) => sum + c.practiceCount);

      final practicedFavs = covForW
          .where((c) => favSet.contains(c.topicKey) && c.practiceCount >= 1)
          .map((c) => c.topicKey)
          .toSet();
      final unpracticedFav =
          favs.where((t) => !practicedFavs.contains(t)).firstOrNull ??
          (favs.isNotEmpty ? favs.first : null);

      final noFavRemaining =
          availableTopicsWithWeakness != null &&
          favs.isNotEmpty &&
          !favs.any(availableTopicsWithWeakness.contains);

      final readyForTransfer =
          favs.isEmpty || favCovCount >= 2 || noFavRemaining;

      if (!readyForTransfer) {
        perWeakness[w.canonicalKey] = WeaknessPhaseDecision(
          weaknessKey: w.canonicalKey,
          phase: AdaptationPhase.interestWeakness,
          favCoverageCount: favCovCount,
          favoredTopic: unpracticedFav,
        );
      } else {
        final countsByTopic = <CanonicalTopicKey, int>{
          for (final c in covForW) c.topicKey: c.practiceCount,
        };
        final sortedTransfer = [...transferPriority]
          ..sort((a, b) {
            final ca = countsByTopic[a] ?? 0;
            final cb = countsByTopic[b] ?? 0;
            if (ca != cb) return ca.compareTo(cb);
            return a.wireKey.compareTo(b.wireKey);
          });

        perWeakness[w.canonicalKey] = WeaknessPhaseDecision(
          weaknessKey: w.canonicalKey,
          phase: AdaptationPhase.crossTopicTransfer,
          favCoverageCount: favCovCount,
          transferTopic: sortedTransfer.isNotEmpty
              ? sortedTransfer.first
              : CanonicalTopicKey.scienceClimate,
        );
      }
    }

    final topDecision = perWeakness[activeWeaknesses.first.canonicalKey];
    return (
      overallPhase: topDecision?.phase ?? AdaptationPhase.interestWeakness,
      activeWeaknesses: activeWeaknesses,
      perWeakness: perWeakness,
    );
  }

  /// Ranks candidate packs or drills using the exact deterministic formula.
  static List<RankedContentItem<T>>
  rankCandidates<T extends AdaptiveContentCandidate>({
    required List<T> candidates,
    required List<LinguisticNodeSummary> weaknessNodes,
    required List<CanonicalTopicKey> favoriteTopics,
    required List<TopicWeaknessCoverageEntry> coverage,
    required ExamTrack track,
    required double? currentBand,
    required double targetBand,
    required int currentDaySerial,
  }) {
    final favs = CanonicalTopicKey.normalizeList(
      favoriteTopics.map((e) => e.wireKey).toList(),
    );
    final favSet = favs.toSet();
    final currentTier = currentBand != null
        ? (LiveBandEngine.estimateCefrTierFromScore(currentBand, track) ??
              AuthoringTier.b1)
        : AuthoringTier.a2;

    final phaseInfo = resolveWeaknessPhase(
      weaknessNodes: weaknessNodes,
      favoriteTopics: favs,
      coverage: coverage,
      currentDaySerial: currentDaySerial,
    );

    final activeWeaknessPriority = <String, double>{
      for (final w in phaseInfo.activeWeaknesses)
        w.canonicalKey:
            LinguisticGraphMath.computeNodePriorityScore(
              node: w,
              currentDaySerial: currentDaySerial,
            ) /
            1000.0,
    };

    final ranked =
        candidates.map((item) {
          String? bestWeakness;
          var weaknessMatch = 0.0;
          for (final tag in item.weaknessTags) {
            final p = activeWeaknessPriority[tag] ?? 0.0;
            if (p > weaknessMatch) {
              weaknessMatch = p;
              bestWeakness = tag;
            }
          }
          if (phaseInfo.activeWeaknesses.isEmpty) {
            weaknessMatch = 0.4;
          }

          final decision = bestWeakness != null
              ? phaseInfo.perWeakness[bestWeakness]
              : null;
          final effectivePhase = decision?.phase ?? phaseInfo.overallPhase;
          final topics = item.topicKeys.isNotEmpty
              ? item.topicKeys
              : const <CanonicalTopicKey>[CanonicalTopicKey.academicCore];
          final hasFav = topics.any(favSet.contains);
          final hasCore = topics.contains(CanonicalTopicKey.academicCore);
          final matchedTopic =
              (effectivePhase == AdaptationPhase.crossTopicTransfer
                  ? topics.where((t) => !favSet.contains(t)).firstOrNull
                  : topics.where(favSet.contains).firstOrNull) ??
              topics.first;

          var topicPhaseFit = 0.25;
          switch (effectivePhase) {
            case AdaptationPhase.ignition:
              topicPhaseFit = hasFav ? 1.0 : (hasCore ? 0.55 : 0.15);
            case AdaptationPhase.interestWeakness:
              topicPhaseFit = hasFav
                  ? (bestWeakness != null ? 1.0 : 0.7)
                  : (hasCore ? 0.45 : 0.25);
            case AdaptationPhase.crossTopicTransfer:
              topicPhaseFit = !hasFav
                  ? (bestWeakness != null ? 1.0 : 0.7)
                  : 0.35;
            case AdaptationPhase.examBreadth:
              topicPhaseFit = item.attemptCount == 0 ? 0.95 : 0.45;
          }

          final bFit = _bandFitScore(item.cefrMin, item.cefrMax, currentTier);

          var novelty = 1.0;
          if (item.lastAttemptedDaySerial != null) {
            final age = math.max(
              0,
              currentDaySerial - item.lastAttemptedDaySerial!,
            );
            novelty = age < 7 ? 0.08 : (age < 14 ? 0.45 : 0.75);
          }

          final total = double.parse(
            (0.38 * weaknessMatch +
                    0.27 * topicPhaseFit +
                    0.2 * bFit +
                    0.15 * novelty)
                .toStringAsFixed(4),
          );

          final String reasonEn;
          final String reasonFa;
          if (effectivePhase == AdaptationPhase.crossTopicTransfer &&
              bestWeakness != null) {
            final cleanW = bestWeakness.split(':').last.replaceAll('_', ' ');
            reasonEn =
                'Transfer Challenge: practicing $cleanW in ${matchedTopic.labelEn}';
            reasonFa =
                'چالش انتقال مهارت: تمرین نقطه ضعف شما در موضوع جدید «${matchedTopic.labelFa}»';
          } else if (hasFav && bestWeakness != null) {
            final cleanW = bestWeakness.split(':').last.replaceAll('_', ' ');
            reasonEn = 'Your topic (${matchedTopic.labelEn}) + fixes $cleanW';
            reasonFa =
                'موضوع دلخواه (${matchedTopic.labelFa}) + رفع خطای پرتکرار شما';
          } else if (hasFav) {
            reasonEn =
                'Matches your favorite topic: ${matchedTopic.labelEn} (${currentTier.name.toUpperCase()} fit)';
            reasonFa =
                'متناسب با علاقه شما (${matchedTopic.labelFa}) و سطح ${currentTier.name.toUpperCase()}';
          } else {
            reasonEn =
                'Exam breadth · ${matchedTopic.labelEn} (${item.cefrMin.name.toUpperCase()}–${item.cefrMax.name.toUpperCase()})';
            reasonFa =
                'پوشش تنوع موضوعات آزمون · ${matchedTopic.labelFa} (${item.cefrMin.name.toUpperCase()}–${item.cefrMax.name.toUpperCase()})';
          }

          return RankedContentItem<T>(
            item: item,
            score: total,
            phase: effectivePhase,
            matchedTopic: matchedTopic,
            matchedWeaknessKey: bestWeakness,
            reasonEn: reasonEn,
            reasonFa: reasonFa,
          );
        }).toList()..sort((a, b) {
          final cmp = b.score.compareTo(a.score);
          if (cmp != 0) return cmp;
          return a.item.id.compareTo(b.item.id);
        });

    return ranked;
  }

  /// Selects the next Coach topic & rotation phase.
  static NextCoachTopicSelection selectNextCoachTopic({
    required List<LinguisticNodeSummary> weaknessNodes,
    required List<CanonicalTopicKey> favoriteTopics,
    required List<TopicWeaknessCoverageEntry> coverage,
    required int currentDaySerial,
    List<CanonicalTopicKey> recentMissionTopics = const <CanonicalTopicKey>[],
  }) {
    final favs = CanonicalTopicKey.normalizeList(
      favoriteTopics.map((e) => e.wireKey).toList(),
    );
    final effectiveFavs = favs.isNotEmpty
        ? favs
        : const <CanonicalTopicKey>[
            CanonicalTopicKey.technologyAi,
            CanonicalTopicKey.educationCampus,
            CanonicalTopicKey.scienceClimate,
          ];
    final recentSet = recentMissionTopics.toSet();

    final phaseInfo = resolveWeaknessPhase(
      weaknessNodes: weaknessNodes,
      favoriteTopics: effectiveFavs,
      coverage: coverage,
      currentDaySerial: currentDaySerial,
    );

    final topWeakness = phaseInfo.activeWeaknesses.firstOrNull;
    if (topWeakness == null) {
      final pool = phaseInfo.overallPhase == AdaptationPhase.examBreadth
          ? CanonicalTopicKey.values
                .where((t) => t != CanonicalTopicKey.academicCore)
                .toList(growable: false)
          : effectiveFavs;
      final pick =
          pool.where((t) => !recentSet.contains(t)).firstOrNull ??
          pool[currentDaySerial % pool.length];
      final isBreadth = phaseInfo.overallPhase == AdaptationPhase.examBreadth;
      return NextCoachTopicSelection(
        topicKey: pick,
        topicLabelEn: pick.labelEn,
        topicLabelFa: pick.labelFa,
        phase: phaseInfo.overallPhase,
        primaryWeaknessKey: null,
        reasonEn: isBreadth
            ? 'Broadening exam fluency with fresh topic: ${pick.labelEn}'
            : 'Starting with your favorite topic: ${pick.labelEn}',
        reasonFa: isBreadth
            ? 'گسترش تسلط در موضوعات متنوع آزمون: ${pick.labelFa}'
            : 'شروع با موضوع مورد علاقه شما: ${pick.labelFa}',
      );
    }

    final decision = phaseInfo.perWeakness[topWeakness.canonicalKey]!;
    if (decision.phase == AdaptationPhase.crossTopicTransfer) {
      final transferPool = CanonicalTopicKey.values
          .where(
            (t) =>
                t != CanonicalTopicKey.academicCore &&
                !effectiveFavs.contains(t),
          )
          .toList(growable: false);
      final chosen =
          transferPool.where((t) => !recentSet.contains(t)).firstOrNull ??
          decision.transferTopic ??
          CanonicalTopicKey.scienceClimate;
      return NextCoachTopicSelection(
        topicKey: chosen,
        topicLabelEn: chosen.labelEn,
        topicLabelFa: chosen.labelFa,
        phase: AdaptationPhase.crossTopicTransfer,
        primaryWeaknessKey: topWeakness.canonicalKey,
        reasonEn:
            'You practiced this weak spot in your favorite topics — now transferring it to ${chosen.labelEn}.',
        reasonFa:
            'این نقطه ضعف را در موضوعات دلخواه تمرین کردید؛ اکنون آن را در موضوع جدید «${chosen.labelFa}» تثبیت می‌کنیم.',
      );
    }

    final favChosen =
        effectiveFavs.where((t) => !recentSet.contains(t)).firstOrNull ??
        decision.favoredTopic ??
        effectiveFavs.first;
    return NextCoachTopicSelection(
      topicKey: favChosen,
      topicLabelEn: favChosen.labelEn,
      topicLabelFa: favChosen.labelFa,
      phase: AdaptationPhase.interestWeakness,
      primaryWeaknessKey: topWeakness.canonicalKey,
      reasonEn:
          'Targeting your top weak spot inside your favorite topic: ${favChosen.labelEn}.',
      reasonFa:
          'تمرین روی مهم‌ترین نقطه ضعف شما در موضوع دلخواهتان (${favChosen.labelFa}).',
    );
  }
}

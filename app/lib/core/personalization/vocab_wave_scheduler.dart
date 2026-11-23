import 'dart:math' as math;

import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/personalization/live_band_engine.dart';
import 'package:mockza/core/personalization/topic_taxonomy.dart';

/// Card input for progressive vocabulary wave scheduling.
class VocabWaveCardInput {
  /// Creates a [VocabWaveCardInput].
  const new({
    required this.cardId,
    required this.headword,
    required this.legacyTopicTag,
    required this.repetitions,
    required this.dueSerialDay,
    this.canonicalTopicKey,
    this.cefrLevel = AuthoringTier.b2,
    this.weaknessTags = const <String>[],
    this.baseWaveOrder = 500,
    this.sourceKind = 'seeded',
  });

  /// Card identifier.
  final String cardId;

  /// Headword or collocation.
  final String headword;

  /// Optional explicit canonical topic.
  final CanonicalTopicKey? canonicalTopicKey;

  /// Legacy snake_case topic tag.
  final String legacyTopicTag;

  /// CEFR level.
  final AuthoringTier cefrLevel;

  /// Associated weakness tags.
  final List<String> weaknessTags;

  /// Base authored ordering weight.
  final int baseWaveOrder;

  /// Source (`seeded`, `mistake_to_deck`, `evaluation_upgrade`, `drop_extract`).
  final String sourceKind;

  /// Current SM-2 repetition count.
  final int repetitions;

  /// Next due UTC serial day.
  final int dueSerialDay;
}

/// Vocabulary card paired with its computed progressive wave number.
class AssignedVocabWaveCard<T extends VocabWaveCardInput> {
  /// Creates an [AssignedVocabWaveCard].
  const new({
    required this.card,
    required this.canonicalTopicKey,
    required this.waveNumber,
    required this.orderInWave,
    required this.isUnlocked,
  });

  /// Underlying card input.
  final T card;

  /// Normalized canonical topic key.
  final CanonicalTopicKey canonicalTopicKey;

  /// 1-based wave index.
  final int waveNumber;

  /// 1-based index inside the wave.
  final int orderInWave;

  /// Whether unlocked for the learner right now.
  final bool isUnlocked;
}

/// Summary counters for progressive Vocabulary UI.
class VocabWaveSummary {
  /// Creates a [VocabWaveSummary].
  const new({
    required this.unlockedWave,
    required this.totalWaves,
    required this.currentWaveTotal,
    required this.currentWaveLearned,
    required this.readyToUnlockNext,
    required this.dailyNewRemaining,
  });

  /// Highest unlocked wave (`1..N`).
  final int unlockedWave;

  /// Total waves in deck.
  final int totalWaves;

  /// Cards in current wave.
  final int currentWaveTotal;

  /// Learned cards (`repetitions >= 1`) in current wave.
  final int currentWaveLearned;

  /// Whether 60%+ threshold to unlock next wave is met.
  final bool readyToUnlockNext;

  /// Remaining new cards allowed today.
  final int dailyNewRemaining;
}

/// Progressive Vocabulary Wave Scheduler matching `vocab-wave-scheduler.ts`.
abstract final class VocabWaveScheduler {
  /// Default cards per progressive wave.
  static const int defaultWaveSize = 15;

  /// Default daily cap on newly introduced words.
  static const int defaultDailyNewCap = 10;

  static int _cefrNum(AuthoringTier t) => switch (t) {
    AuthoringTier.a1 => 1,
    AuthoringTier.a2 => 2,
    AuthoringTier.b1 => 3,
    AuthoringTier.b2 => 4,
    AuthoringTier.c1 => 5,
    AuthoringTier.c2 => 6,
  };

  /// Assigns deterministic progressive waves prioritizing favorite topics, weaknesses, and band fit.
  static ({
    List<AssignedVocabWaveCard<T>> assigned,
    int totalWaves,
    bool shouldAutoUnlockNext,
  })
  assignWaves<T extends VocabWaveCardInput>({
    required List<T> cards,
    required List<String> favoriteTopics,
    required ExamTrack track,
    required double? currentBand,
    required double targetBand,
    required List<String> activeWeaknessKeys,
    required int unlockedWave,
    int waveSize = defaultWaveSize,
  }) {
    final clampedWaveSize = waveSize.clamp(5, 30);
    final favSet = CanonicalTopicKey.normalizeList(favoriteTopics).toSet();
    final weakSet = activeWeaknessKeys.toSet();
    final userCefr = currentBand != null
        ? (LiveBandEngine.estimateCefrTierFromScore(currentBand, track) ??
              AuthoringTier.b1)
        : AuthoringTier.b1;
    final userLevel = _cefrNum(userCefr);

    final scored =
        cards.map((card) {
          final topic =
              card.canonicalTopicKey ??
              CanonicalTopicKey.fromLegacyVocabTag(card.legacyTopicTag);
          final bandDiff = (_cefrNum(card.cefrLevel) - userLevel).abs();
          final isFav = favSet.contains(topic);
          final isCore = topic == CanonicalTopicKey.academicCore;
          final matchesWeak = card.weaknessTags.any(weakSet.contains);
          final isMistake = card.sourceKind != 'seeded';

          var bucket = 3;
          if (isMistake) {
            bucket = 0;
          } else if ((isFav || isCore) && bandDiff <= 1) {
            bucket = 1;
          } else if (matchesWeak || isFav) {
            bucket = 2;
          } else if (bandDiff <= 1) {
            bucket = 3;
          } else {
            bucket = 4;
          }

          final relevanceScore =
              (matchesWeak ? 200 : 0) +
              (isFav ? 120 : (isCore ? 70 : 0)) +
              math.max(0, 50 - bandDiff * 20);

          return (
            card: card,
            topic: topic,
            bucket: bucket,
            relevanceScore: relevanceScore,
            baseOrder: card.baseWaveOrder,
          );
        }).toList()..sort((a, b) {
          if (a.bucket != b.bucket) return a.bucket.compareTo(b.bucket);
          if (b.relevanceScore != a.relevanceScore) {
            return b.relevanceScore.compareTo(a.relevanceScore);
          }
          if (a.baseOrder != b.baseOrder) {
            return a.baseOrder.compareTo(b.baseOrder);
          }
          return a.card.cardId.compareTo(b.card.cardId);
        });

    final safeUnlockedWave = math.max<int>(1, unlockedWave);
    final assigned = <AssignedVocabWaveCard<T>>[];
    for (var i = 0; i < scored.length; i += 1) {
      final entry = scored[i];
      final waveNum = (i ~/ clampedWaveSize) + 1;
      assigned.add(
        AssignedVocabWaveCard<T>(
          card: entry.card,
          canonicalTopicKey: entry.topic,
          waveNumber: waveNum,
          orderInWave: (i % clampedWaveSize) + 1,
          isUnlocked: entry.bucket == 0 || waveNum <= safeUnlockedWave,
        ),
      );
    }

    final totalWaves = math.max(
      1,
      (assigned.length + clampedWaveSize - 1) ~/ clampedWaveSize,
    );
    final currentWaveCards = assigned
        .where((a) => a.waveNumber == safeUnlockedWave)
        .toList(growable: false);
    final learnedInWave = currentWaveCards
        .where((a) => a.card.repetitions >= 1)
        .length;
    final shouldUnlock =
        safeUnlockedWave < totalWaves &&
        currentWaveCards.isNotEmpty &&
        learnedInWave / currentWaveCards.length >= 0.6;

    return (
      assigned: assigned,
      totalWaves: totalWaves,
      shouldAutoUnlockNext: shouldUnlock,
    );
  }

  /// Selects today's bounded review queue: Saved Mistakes -> Due Wave Cards -> Capped New Cards.
  static ({List<AssignedVocabWaveCard<T>> queue, VocabWaveSummary summary})
  selectDailyReviewQueue<T extends VocabWaveCardInput>({
    required List<AssignedVocabWaveCard<T>> assigned,
    required int todaySerialDay,
    required int newCardsIntroducedToday,
    required int unlockedWave,
    int dailyNewCap = defaultDailyNewCap,
  }) {
    final cap = math.max<int>(1, dailyNewCap);
    final remaining = math.max<int>(
      0,
      cap - math.max<int>(0, newCardsIntroducedToday),
    );

    final mistakesDue = <AssignedVocabWaveCard<T>>[];
    final waveDue = <AssignedVocabWaveCard<T>>[];
    final waveNewPool = <AssignedVocabWaveCard<T>>[];

    for (final item in assigned) {
      if (!item.isUnlocked) continue;
      final isDue = item.card.dueSerialDay <= todaySerialDay;
      final isMistake = item.card.sourceKind != 'seeded';
      if (item.card.repetitions == 0) {
        waveNewPool.add(item);
      } else if (isDue) {
        if (isMistake) {
          mistakesDue.add(item);
        } else {
          waveDue.add(item);
        }
      }
    }

    final queue = <AssignedVocabWaveCard<T>>[
      ...mistakesDue,
      ...waveDue,
      ...waveNewPool.take(remaining),
    ];

    final currentWaveCards = assigned
        .where((a) => a.waveNumber == unlockedWave)
        .toList(growable: false);
    final learned = currentWaveCards
        .where((a) => a.card.repetitions >= 1)
        .length;
    final totalWaves = assigned.fold<int>(
      1,
      (maxW, a) => math.max<int>(maxW, a.waveNumber),
    );

    return (
      queue: queue,
      summary: VocabWaveSummary(
        unlockedWave: unlockedWave,
        totalWaves: totalWaves,
        currentWaveTotal: currentWaveCards.length,
        currentWaveLearned: learned,
        readyToUnlockNext:
            unlockedWave < totalWaves &&
            currentWaveCards.isNotEmpty &&
            learned / currentWaveCards.length >= 0.6,
        dailyNewRemaining: remaining,
      ),
    );
  }
}

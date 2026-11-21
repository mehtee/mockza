import 'dart:math' as math;

/// Semantic node kinds persisted in the learner's Linguistic Graph.
enum LinguisticNodeKind {
  /// Habit/error bottleneck to remediate.
  bottleneck('bottleneck'),

  /// Target grammatical/lexical structure.
  targetStructure('target_structure'),

  /// User topic affinity.
  interestTopic('interest_topic');

  new(this.wireValue);

  /// Wire format matching PostgreSQL & API contracts.
  final String wireValue;

  /// Parses wire value defaulting to [bottleneck].
  static LinguisticNodeKind fromWire(String value) => switch (value) {
    'target_structure' => LinguisticNodeKind.targetStructure,
    'interest_topic' => LinguisticNodeKind.interestTopic,
    _ => LinguisticNodeKind.bottleneck,
  };
}

/// Polarity of a linguistic observation event.
enum EvidencePolarity {
  /// Observed bottleneck gap in output.
  gapObserved('gap_observed'),

  /// Verified active use of target structure.
  targetUsed('target_used'),

  /// Topic interest matched.
  interestMatched('interest_matched');

  new(this.wireValue);

  /// Wire format matching PostgreSQL & API contracts.
  final String wireValue;

  /// Parses wire value defaulting to [gapObserved].
  static EvidencePolarity fromWire(String value) => switch (value) {
    'target_used' => EvidencePolarity.targetUsed,
    'interest_matched' => EvidencePolarity.interestMatched,
    _ => EvidencePolarity.gapObserved,
  };
}

/// Pure summary tuple mirroring TS `LinguisticNodeSummary`.
class LinguisticNodeSummary {
  /// Creates a [LinguisticNodeSummary].
  const new({
    required this.nodeId,
    required this.nodeKind,
    required this.canonicalKey,
    required this.masteryScoreMilli,
    required this.signalWeightMilli,
    required this.evidenceCount,
    required this.lastSeenDaySerial,
  });

  /// Node UUID.
  final String nodeId;

  /// Node semantic kind.
  final LinguisticNodeKind nodeKind;

  /// Canonical classifier key.
  final String canonicalKey;

  /// Mastery score `[0..1000]`.
  final int masteryScoreMilli;

  /// Decayed signal weight `[0..1000]`.
  final int signalWeightMilli;

  /// Evidence count.
  final int evidenceCount;

  /// Last observed UTC SerialDay.
  final int lastSeenDaySerial;
}

/// Ranked Daily Mission priority preview matching TS `RankedMissionTargets`.
class RankedMissionTargets {
  /// Creates a [RankedMissionTargets].
  const new({
    required this.bottlenecks,
    required this.targetStructures,
    required this.interestTopics,
    required this.suggestedCardIds,
  });

  /// Top ranked bottleneck nodes.
  final List<LinguisticNodeSummary> bottlenecks;

  /// Top target structure nodes.
  final List<LinguisticNodeSummary> targetStructures;

  /// Top interest topic nodes.
  final List<LinguisticNodeSummary> interestTopics;

  /// Selected SM-2 due card IDs.
  final List<String> suggestedCardIds;
}

/// Validated UTF-16 slice interval.
class Utf16SpanResult {
  /// Creates a [Utf16SpanResult].
  const new({
    required this.startUtf16,
    required this.endUtf16,
    required this.excerpt,
  });

  /// Inclusive UTF-16 start offset.
  final int startUtf16;

  /// Exclusive UTF-16 end offset.
  final int endUtf16;

  /// Safe substring excerpt.
  final String excerpt;
}

/// Pure mathematical functions matching `backend/packages/domain/src/advanced/linguistic-graph-math.ts`.
abstract final class LinguisticGraphMath {
  /// Clamps an integer milliscore strictly to `[0, 1000]`.
  static int clampMilli(num value) {
    if (!value.isFinite) return 0;
    return value.round().clamp(0, 1000);
  }

  /// Deterministic EMA mastery update bounded strictly to `[0, 1000]`.
  static int computeNextMasteryMilli({
    required int currentMilli,
    required EvidencePolarity polarity,
    required int evidenceCount,
  }) {
    final current = clampMilli(currentMilli);
    final count = math.max(0, evidenceCount);

    return switch (polarity) {
      EvidencePolarity.gapObserved => clampMilli(
        current - math.max(40, 140 - math.min(count, 10) * 8),
      ),
      EvidencePolarity.targetUsed => clampMilli(
        current + math.max(60, ((1000 - current) * 0.25).round()),
      ),
      EvidencePolarity.interestMatched => clampMilli(current + 120),
    };
  }

  /// Computes urgency-decayed priority score (`0..1000`).
  static int computeNodePriorityScore({
    required LinguisticNodeSummary node,
    required int currentDaySerial,
  }) {
    final ageDays = math.max(0, currentDaySerial - node.lastSeenDaySerial);
    final decayFactor = math.pow(0.95, math.min(ageDays, 60)).toDouble();
    final rawNeed = node.nodeKind == LinguisticNodeKind.bottleneck
        ? math.max(100, 1000 - clampMilli(node.masteryScoreMilli))
        : clampMilli(node.signalWeightMilli);
    return clampMilli(rawNeed * decayFactor);
  }

  /// Ranks active bottlenecks, structures, and topics for Daily Mission planning.
  static RankedMissionTargets rankTopMissionTargets({
    required List<LinguisticNodeSummary> nodes,
    required List<String> dueCardIds,
    required int currentDaySerial,
    int maxBottlenecks = 2,
    int maxTargets = 2,
    int maxInterests = 2,
    int maxCards = 5,
  }) {
    int cmp(LinguisticNodeSummary a, LinguisticNodeSummary b) {
      final diff =
          computeNodePriorityScore(
            node: b,
            currentDaySerial: currentDaySerial,
          ) -
          computeNodePriorityScore(node: a, currentDaySerial: currentDaySerial);
      if (diff != 0) return diff;
      return a.canonicalKey.compareTo(b.canonicalKey);
    }

    final bottlenecks =
        nodes.where((n) => n.nodeKind == LinguisticNodeKind.bottleneck).toList()
          ..sort(cmp);
    final targetStructures =
        nodes
            .where((n) => n.nodeKind == LinguisticNodeKind.targetStructure)
            .toList()
          ..sort(cmp);
    final interestTopics =
        nodes
            .where((n) => n.nodeKind == LinguisticNodeKind.interestTopic)
            .toList()
          ..sort(cmp);

    return RankedMissionTargets(
      bottlenecks: bottlenecks.take(maxBottlenecks).toList(growable: false),
      targetStructures: targetStructures
          .take(maxTargets)
          .toList(growable: false),
      interestTopics: interestTopics.take(maxInterests).toList(growable: false),
      suggestedCardIds: dueCardIds.take(maxCards).toList(growable: false),
    );
  }

  static bool _isLowSurrogate(int codeUnit) =>
      codeUnit >= 0xDC00 && codeUnit <= 0xDFFF;

  /// Normalizes character offsets safely onto UTF-16 code-unit boundaries.
  static Utf16SpanResult normalizeUtf16Span(
    String sourceText,
    int rawStart,
    int rawEnd,
  ) {
    final len = sourceText.length;
    var start = rawStart.clamp(0, len);
    var end = rawEnd.clamp(start, len);

    if (start > 0 &&
        start < len &&
        _isLowSurrogate(sourceText.codeUnitAt(start))) {
      start -= 1;
    }
    if (end > start &&
        end < len &&
        _isLowSurrogate(sourceText.codeUnitAt(end))) {
      end = math.min(len, end + 1);
    }

    return Utf16SpanResult(
      startUtf16: start,
      endUtf16: end,
      excerpt: sourceText.substring(start, end),
    );
  }
}

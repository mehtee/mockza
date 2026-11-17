import 'package:mockza/core/diagnostic/diagnostic_models.dart';

/// Deterministic objective-task routing engine matching `backend/packages/domain/src/diagnostic/routing.ts`.
abstract final class DiagnosticRouter {
  /// Active policy version identifier.
  static const String policyVersion = '2026-11-17.v1';

  /// Target valid blocks & maximum presented blocks per objective skill.
  static ({int targetValidBlocks, int maxPresentedBlocks}) limitsFor(
    String skill,
  ) => skill == 'reading'
      ? (targetValidBlocks: 3, maxPresentedBlocks: 4)
      : (targetValidBlocks: 3, maxPresentedBlocks: 3);

  /// FNV-1a hash used for deterministic tie-breaking across unused blocks.
  static int deterministicSeedHash(String seed, String candidateId) {
    final input = '$seed:$candidateId';
    var hash = 0x811c9dc5;
    for (var i = 0; i < input.length; i += 1) {
      hash ^= input.codeUnitAt(i);
      hash = (hash * 0x01000193) & 0xffffffff;
    }
    return hash;
  }

  /// Classifies one completed or interrupted block into `strong`, `mixed`, `low`, or `no_evidence`.
  static ({
    RoutingCategory category,
    int correctCount,
    NoEvidenceReason? noEvidenceReason,
  })
  classifyBlockOutcome({
    required List<DiagnosticQuestionDef> questions,
    required List<int?> selectedOptionIndices,
    NoEvidenceReason? noEvidenceReason,
  }) {
    if (noEvidenceReason != null) {
      return (
        category: RoutingCategory.noEvidence,
        correctCount: 0,
        noEvidenceReason: noEvidenceReason,
      );
    }

    final s0 = selectedOptionIndices.isNotEmpty
        ? selectedOptionIndices[0]
        : null;
    final s1 = selectedOptionIndices.length > 1
        ? selectedOptionIndices[1]
        : null;
    if (s0 == null || s1 == null) {
      return (
        category: RoutingCategory.noEvidence,
        correctCount: 0,
        noEvidenceReason: NoEvidenceReason.emptyTimeout,
      );
    }

    var correctCount = 0;
    if (questions.isNotEmpty && s0 == questions[0].correctIndex) {
      correctCount += 1;
    }
    if (questions.length > 1 && s1 == questions[1].correctIndex) {
      correctCount += 1;
    }

    final category = correctCount >= 2
        ? RoutingCategory.strong
        : (correctCount == 1 ? RoutingCategory.mixed : RoutingCategory.low);
    return (
      category: category,
      correctCount: correctCount,
      noEvidenceReason: null,
    );
  }

  /// Evaluates deadlines, sampling limits, and tier routing rules to select the next block or stop.
  static NextBlockSelectionResult selectNextObjectiveBlock({
    required String skill,
    required List<DiagnosticBlockDef> bank,
    required List<BlockAttemptRecord> history,
    required int remainingStageSeconds,
    required int remainingGlobalSeconds,
    required String selectionSeed,
    AuthoringTier initialTier = AuthoringTier.b1,
    bool strictMode = true,
  }) {
    final limits = limitsFor(skill);
    final summary = _summarizeHistory(history);
    final presentedCount = history.length;
    final reducedSampling = summary.validCount < limits.targetValidBlocks;

    final coincidentReasons = <DiagnosticStopReason>[];
    if (strictMode && remainingGlobalSeconds <= 0) {
      coincidentReasons.add(DiagnosticStopReason.globalTimeout);
    }
    if (strictMode && remainingStageSeconds <= 0) {
      coincidentReasons.add(DiagnosticStopReason.stageTimeout);
    }
    if (summary.validCount >= limits.targetValidBlocks) {
      coincidentReasons.add(DiagnosticStopReason.samplingComplete);
    }
    if (presentedCount >= limits.maxPresentedBlocks) {
      coincidentReasons.add(DiagnosticStopReason.presentationLimit);
    }

    // 1 & 2. Global and stage deadlines take precedence.
    if (strictMode && remainingGlobalSeconds <= 0) {
      return NextBlockSelectionResult(
        shouldPresent: false,
        stopReason: DiagnosticStopReason.globalTimeout,
        coincidentReasons: coincidentReasons,
        reducedSampling: reducedSampling,
        hasContradictoryEvidence: summary.hasContradiction,
        consecutiveSameDirectionCount: summary.consecutiveDirectionCount,
        evidenceCheckTriggered: summary.evidenceCheckTriggered,
      );
    }
    if (strictMode && remainingStageSeconds <= 0) {
      return NextBlockSelectionResult(
        shouldPresent: false,
        stopReason: DiagnosticStopReason.stageTimeout,
        coincidentReasons: coincidentReasons,
        reducedSampling: reducedSampling,
        hasContradictoryEvidence: summary.hasContradiction,
        consecutiveSameDirectionCount: summary.consecutiveDirectionCount,
        evidenceCheckTriggered: summary.evidenceCheckTriggered,
      );
    }

    // 3. Sampling completion target (3 valid blocks; Reading may take a 4th only on unresolved cases).
    final allowExtraReading =
        skill == 'reading' &&
        presentedCount < limits.maxPresentedBlocks &&
        _needsFourthReadingInvestigation(history, summary);

    if (summary.validCount >= limits.targetValidBlocks && !allowExtraReading) {
      return NextBlockSelectionResult(
        shouldPresent: false,
        stopReason: DiagnosticStopReason.samplingComplete,
        coincidentReasons: coincidentReasons,
        reducedSampling: false,
        hasContradictoryEvidence: summary.hasContradiction,
        consecutiveSameDirectionCount: summary.consecutiveDirectionCount,
        evidenceCheckTriggered: summary.evidenceCheckTriggered,
      );
    }

    // 4. Presentation cap.
    if (presentedCount >= limits.maxPresentedBlocks) {
      return NextBlockSelectionResult(
        shouldPresent: false,
        stopReason: summary.validCount >= limits.targetValidBlocks
            ? DiagnosticStopReason.samplingComplete
            : DiagnosticStopReason.presentationLimit,
        coincidentReasons: coincidentReasons,
        reducedSampling: reducedSampling,
        hasContradictoryEvidence: summary.hasContradiction,
        consecutiveSameDirectionCount: summary.consecutiveDirectionCount,
        evidenceCheckTriggered: summary.evidenceCheckTriggered,
      );
    }

    // 5. Tier selection per Section 5.1 rules.
    final usedIds = history.map((h) => h.blockId).toSet();
    final lastRecord = history.isNotEmpty ? history.last : null;
    final validRecords = history
        .where((h) => h.category != RoutingCategory.noEvidence)
        .toList(growable: false);
    final lastValid = validRecords.isNotEmpty ? validRecords.last : null;

    var targetIdx = initialTier.index;
    DiagnosticBlockDef? chosenBlock;

    if (lastRecord == null) {
      targetIdx = initialTier.index;
    } else if (lastRecord.category == RoutingCategory.noEvidence) {
      targetIdx = lastRecord.noEvidenceReason == NoEvidenceReason.dontKnow
          ? (lastRecord.tier.index - 1).clamp(
              0,
              AuthoringTier.values.length - 1,
            )
          : lastRecord.tier.index;
    } else if (lastValid != null) {
      final currentIdx = lastValid.tier.index;
      if (lastValid.category == RoutingCategory.low) {
        final minLow = summary.lowIndices.isNotEmpty
            ? summary.lowIndices.reduce((a, b) => a < b ? a : b)
            : currentIdx;
        targetIdx = minLow > 0 ? minLow - 1 : 0;
      } else if (lastValid.category == RoutingCategory.mixed) {
        targetIdx = currentIdx;
      } else if (lastValid.category == RoutingCategory.strong) {
        if (summary.hasContradiction &&
            summary.lowestConflictingLowIdx != null) {
          final conflictTier =
              AuthoringTier.values[summary.lowestConflictingLowIdx!];
          final conflictBlock = _pickUnusedBlock(
            bank: bank,
            usedIds: usedIds,
            targetTier: conflictTier,
            selectionSeed: selectionSeed,
          );
          if (conflictBlock != null) {
            targetIdx = summary.lowestConflictingLowIdx!;
            chosenBlock = conflictBlock;
          }
        }

        if (chosenBlock == null) {
          final lowsAbove = summary.lowIndices
              .where((i) => i > currentIdx)
              .toList(growable: false);
          if (lowsAbove.isNotEmpty) {
            final minLowAbove = lowsAbove.reduce((a, b) => a < b ? a : b);
            final untestedBetween = <int>[];
            for (var i = currentIdx + 1; i < minLowAbove; i += 1) {
              final tier = AuthoringTier.values[i];
              final hasUnused =
                  _pickUnusedBlock(
                    bank: bank,
                    usedIds: usedIds,
                    targetTier: tier,
                    selectionSeed: selectionSeed,
                  ) !=
                  null;
              final alreadyTested = validRecords.any(
                (r) => r.tier.index == i,
              );
              if (!alreadyTested && hasUnused) {
                untestedBetween.add(i);
              }
            }
            if (untestedBetween.isNotEmpty) {
              targetIdx = untestedBetween[untestedBetween.length ~/ 2];
            } else {
              targetIdx = currentIdx;
            }
          } else {
            targetIdx = (currentIdx + 1).clamp(
              0,
              AuthoringTier.values.length - 1,
            );
          }
        }
      }
    }

    final targetTier = AuthoringTier.values[targetIdx];
    chosenBlock ??= _pickUnusedBlock(
      bank: bank,
      usedIds: usedIds,
      targetTier: targetTier,
      selectionSeed: selectionSeed,
    );

    if (chosenBlock == null) {
      return NextBlockSelectionResult(
        shouldPresent: false,
        targetTier: targetTier,
        stopReason: summary.validCount >= limits.targetValidBlocks
            ? DiagnosticStopReason.samplingComplete
            : DiagnosticStopReason.contentLimit,
        coincidentReasons: <DiagnosticStopReason>[
          ...coincidentReasons,
          DiagnosticStopReason.contentLimit,
        ],
        reducedSampling: reducedSampling,
        hasContradictoryEvidence: summary.hasContradiction,
        consecutiveSameDirectionCount: summary.consecutiveDirectionCount,
        evidenceCheckTriggered: summary.evidenceCheckTriggered,
      );
    }

    if (strictMode) {
      final bindingBudget = remainingStageSeconds < remainingGlobalSeconds
          ? remainingStageSeconds
          : remainingGlobalSeconds;
      if (chosenBlock.minRequiredSeconds > bindingBudget) {
        final stopReason = remainingGlobalSeconds <= remainingStageSeconds
            ? DiagnosticStopReason.globalTimeout
            : DiagnosticStopReason.stageTimeout;
        return NextBlockSelectionResult(
          shouldPresent: false,
          targetTier: targetTier,
          stopReason: summary.validCount >= limits.targetValidBlocks
              ? DiagnosticStopReason.samplingComplete
              : stopReason,
          coincidentReasons: <DiagnosticStopReason>[
            ...coincidentReasons,
            stopReason,
          ],
          reducedSampling: reducedSampling,
          hasContradictoryEvidence: summary.hasContradiction,
          consecutiveSameDirectionCount: summary.consecutiveDirectionCount,
          evidenceCheckTriggered: summary.evidenceCheckTriggered,
        );
      }
    }

    return NextBlockSelectionResult(
      shouldPresent: true,
      block: chosenBlock,
      targetTier: targetTier,
      coincidentReasons: const <DiagnosticStopReason>[],
      reducedSampling: reducedSampling,
      hasContradictoryEvidence: summary.hasContradiction,
      consecutiveSameDirectionCount: summary.consecutiveDirectionCount,
      evidenceCheckTriggered: summary.evidenceCheckTriggered,
    );
  }

  static DiagnosticBlockDef? _pickUnusedBlock({
    required List<DiagnosticBlockDef> bank,
    required Set<String> usedIds,
    required AuthoringTier targetTier,
    required String selectionSeed,
  }) {
    final candidates = bank
        .where((b) => b.tier == targetTier && !usedIds.contains(b.blockId))
        .toList(growable: true);
    if (candidates.isEmpty) return null;
    candidates.sort((a, b) {
      final ha = deterministicSeedHash(selectionSeed, a.blockId);
      final hb = deterministicSeedHash(selectionSeed, b.blockId);
      return ha != hb ? ha.compareTo(hb) : a.blockId.compareTo(b.blockId);
    });
    return candidates.first;
  }

  static _HistorySummary _summarizeHistory(List<BlockAttemptRecord> history) {
    var validCount = 0;
    final strongIndices = <int>[];
    final lowIndices = <int>[];
    RoutingCategory? streakType;
    var streakLen = 0;

    for (final item in history) {
      if (item.category == RoutingCategory.noEvidence) {
        streakType = null;
        streakLen = 0;
        continue;
      }
      validCount += 1;
      final idx = item.tier.index;
      if (item.category == RoutingCategory.strong) {
        strongIndices.add(idx);
        streakLen = streakType == RoutingCategory.strong ? streakLen + 1 : 1;
        streakType = RoutingCategory.strong;
      } else if (item.category == RoutingCategory.low) {
        lowIndices.add(idx);
        streakLen = streakType == RoutingCategory.low ? streakLen + 1 : 1;
        streakType = RoutingCategory.low;
      } else {
        streakType = null;
        streakLen = 0;
      }
    }

    final maxStrong = strongIndices.isNotEmpty
        ? strongIndices.reduce((a, b) => a > b ? a : b)
        : null;
    final minLow = lowIndices.isNotEmpty
        ? lowIndices.reduce((a, b) => a < b ? a : b)
        : null;
    final hasContradiction =
        maxStrong != null && minLow != null && maxStrong > minLow;
    return _HistorySummary(
      validCount: validCount,
      strongIndices: strongIndices,
      lowIndices: lowIndices,
      hasContradiction: hasContradiction,
      lowestConflictingLowIdx: hasContradiction ? minLow : null,
      consecutiveDirectionCount: streakLen,
      evidenceCheckTriggered: streakLen >= 2,
    );
  }

  static bool _needsFourthReadingInvestigation(
    List<BlockAttemptRecord> history,
    _HistorySummary summary,
  ) {
    if (summary.hasContradiction) return true;
    final valid = history
        .where((h) => h.category != RoutingCategory.noEvidence)
        .toList(growable: false);
    if (valid.isNotEmpty && valid.last.category == RoutingCategory.mixed) {
      return true;
    }
    final allLow =
        valid.isNotEmpty &&
        valid.every((r) => r.category == RoutingCategory.low);
    if (allLow &&
        summary.lowIndices.isNotEmpty &&
        summary.lowIndices.reduce((a, b) => a < b ? a : b) > 0) {
      return true;
    }
    return false;
  }
}

class _HistorySummary {
  const new({
    required this.validCount,
    required this.strongIndices,
    required this.lowIndices,
    required this.hasContradiction,
    required this.lowestConflictingLowIdx,
    required this.consecutiveDirectionCount,
    required this.evidenceCheckTriggered,
  });

  final int validCount;
  final List<int> strongIndices;
  final List<int> lowIndices;
  final bool hasContradiction;
  final int? lowestConflictingLowIdx;
  final int consecutiveDirectionCount;
  final bool evidenceCheckTriggered;
}

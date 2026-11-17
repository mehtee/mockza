import 'dart:convert';
import 'dart:io';

import 'package:clock/clock.dart';
import 'package:mockza/core/diagnostic/diagnostic_budget.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/core/diagnostic/diagnostic_router.dart';
import 'package:test/test.dart';

List<DiagnosticBlockDef> _buildTestBank(String skill) {
  final prefix = skill == 'reading' ? 'R' : 'L';
  final blocks = <DiagnosticBlockDef>[];
  for (final tier in AuthoringTier.values) {
    final count = tier == AuthoringTier.b1 ? 3 : 2;
    for (var i = 1; i <= count; i += 1) {
      blocks.add(
        DiagnosticBlockDef(
          blockId: '$prefix-${tier.code}-$i',
          skill: skill,
          tier: tier,
          scenarioId: 'community_spaces',
          title: '$skill ${tier.code} #$i',
          minRequiredSeconds: 20,
          questions: <DiagnosticQuestionDef>[
            DiagnosticQuestionDef(
              questionId: '$prefix-${tier.code}-$i-Q1',
              prompt: 'Question 1',
              options: const <String>['A', 'B', 'C'],
              correctIndex: 0,
              focusTag: 'explicit_detail',
            ),
            DiagnosticQuestionDef(
              questionId: '$prefix-${tier.code}-$i-Q2',
              prompt: 'Question 2',
              options: const <String>['A', 'B', 'C'],
              correctIndex: 1,
              focusTag: 'meaning_relationship',
            ),
          ],
        ),
      );
    }
  }
  return blocks;
}

void main() {
  group('DiagnosticRouter Parity with Shared Routing Fixtures', () {
    final fixturesFile = File('test/fixtures/diagnostic_routing_fixtures.json');
    final decoded =
        jsonDecode(fixturesFile.readAsStringSync()) as Map<String, dynamic>;
    final cases = (decoded['cases'] as List<dynamic>)
        .cast<Map<String, dynamic>>();

    test('matches policyVersion of shared fixtures', () {
      expect(decoded['policyVersion'], DiagnosticRouter.policyVersion);
    });

    for (final testCase in cases) {
      final name = testCase['name'] as String;
      test('fixture: $name', () {
        final skill = testCase['skill'] as String;
        final rawBank = testCase['bankOverride'] as List<dynamic>?;
        final bank = rawBank != null
            ? rawBank
                  .cast<Map<String, dynamic>>()
                  .map(
                    (b) => DiagnosticBlockDef(
                      blockId: b['blockId'] as String,
                      skill: skill,
                      tier: AuthoringTier.fromCode(b['tier'] as String),
                      scenarioId: 'community_spaces',
                      title: b['blockId'] as String,
                      minRequiredSeconds:
                          (b['minRequiredSeconds'] as num?)?.toInt() ?? 20,
                      questions: const <DiagnosticQuestionDef>[],
                    ),
                  )
                  .toList(growable: false)
            : _buildTestBank(skill);

        final historyRaw = testCase['history'] as List<dynamic>;
        final history = historyRaw
            .cast<Map<String, dynamic>>()
            .map(
              (h) => BlockAttemptRecord(
                blockId: h['blockId'] as String,
                tier: AuthoringTier.fromCode(h['tier'] as String),
                category: RoutingCategory.fromWire(h['category'] as String),
                selectedOptionIndices:
                    (h['selectedOptionIndices'] as List<dynamic>)
                        .map((e) => (e as num?)?.toInt())
                        .toList(growable: false),
                correctCount: (h['correctCount'] as num).toInt(),
                noEvidenceReason: NoEvidenceReason.tryFromWire(
                  h['noEvidenceReason'] as String?,
                ),
              ),
            )
            .toList(growable: false);

        final result = DiagnosticRouter.selectNextObjectiveBlock(
          skill: skill,
          bank: bank,
          history: history,
          remainingStageSeconds: (testCase['remainingStageSeconds'] as num)
              .toInt(),
          remainingGlobalSeconds: (testCase['remainingGlobalSeconds'] as num)
              .toInt(),
          selectionSeed: 'parity-seed',
        );

        final expectedAction = testCase['expectedAction'] as String;
        expect(result.shouldPresent, expectedAction == 'present');

        final expectedTier = testCase['expectedTargetTier'] as String?;
        if (expectedTier != null) {
          expect(result.targetTier?.code, expectedTier);
        }

        final expectedStop = testCase['expectedStopReason'] as String?;
        if (expectedStop != null) {
          expect(result.stopReason?.wire, expectedStop);
        }

        final expectedReduced = testCase['expectedReducedSampling'] as bool?;
        if (expectedReduced != null) {
          expect(result.reducedSampling, expectedReduced);
        }

        final expectedCheck =
            testCase['expectedEvidenceCheckTriggered'] as bool?;
        if (expectedCheck != null) {
          expect(result.evidenceCheckTriggered, expectedCheck);
        }

        final expectedContradiction =
            testCase['expectedHasContradictoryEvidence'] as bool?;
        if (expectedContradiction != null) {
          expect(result.hasContradictoryEvidence, expectedContradiction);
        }

        final expectedCoincident =
            (testCase['expectedCoincidentReasons'] as List<dynamic>?)
                ?.cast<String>();
        if (expectedCoincident != null) {
          expect(
            result.coincidentReasons.map((r) => r.wire).toSet(),
            containsAll(expectedCoincident),
          );
        }
      });
    }
  });

  group('DiagnosticRouter.classifyBlockOutcome', () {
    const questions = <DiagnosticQuestionDef>[
      DiagnosticQuestionDef(
        questionId: 'q1',
        prompt: 'Q1',
        options: <String>['A', 'B', 'C'],
        correctIndex: 0,
        focusTag: 'explicit_detail',
      ),
      DiagnosticQuestionDef(
        questionId: 'q2',
        prompt: 'Q2',
        options: <String>['A', 'B', 'C'],
        correctIndex: 2,
        focusTag: 'meaning_relationship',
      ),
    ];

    test('classifies 2/2 strong, 1/2 mixed, 0/2 low, and missing/dontKnow', () {
      expect(
        DiagnosticRouter.classifyBlockOutcome(
          questions: questions,
          selectedOptionIndices: const <int?>[0, 2],
        ).category,
        RoutingCategory.strong,
      );
      expect(
        DiagnosticRouter.classifyBlockOutcome(
          questions: questions,
          selectedOptionIndices: const <int?>[0, 1],
        ).category,
        RoutingCategory.mixed,
      );
      expect(
        DiagnosticRouter.classifyBlockOutcome(
          questions: questions,
          selectedOptionIndices: const <int?>[1, 1],
        ).category,
        RoutingCategory.low,
      );

      final missing = DiagnosticRouter.classifyBlockOutcome(
        questions: questions,
        selectedOptionIndices: const <int?>[0, null],
      );
      expect(missing.category, RoutingCategory.noEvidence);
      expect(missing.noEvidenceReason, NoEvidenceReason.emptyTimeout);

      final dontKnow = DiagnosticRouter.classifyBlockOutcome(
        questions: questions,
        selectedOptionIndices: const <int?>[null, null],
        noEvidenceReason: NoEvidenceReason.dontKnow,
      );
      expect(dontKnow.category, RoutingCategory.noEvidence);
      expect(dontKnow.noEvidenceReason, NoEvidenceReason.dontKnow);
    });
  });

  group('DiagnosticBudget wall-clock calculations', () {
    test('enforces 540s collection + 60s results = 600s budget', () {
      expect(DiagnosticBudget.collectionTotalSeconds, 540);
      expect(DiagnosticBudget.resultsWindowSeconds, 60);
      expect(DiagnosticBudget.totalSessionSeconds, 600);

      final fixedNow = DateTime.utc(2026, 11, 17, 14);
      final clock = Clock.fixed(fixedNow);
      final globalDeadline =
          fixedNow.millisecondsSinceEpoch + (45 * 1000); // 45s left
      final stageDeadline = DiagnosticBudget.computeBoundedStageDeadlineUtcMs(
        stageCapSeconds: DiagnosticBudget.readingMaxSeconds,
        globalCollectionDeadlineUtcMs: globalDeadline,
        mode: DiagnosticMode.standard,
        clock: clock,
      );
      expect(stageDeadline, globalDeadline);
      expect(
        DiagnosticBudget.remainingSeconds(
          deadlineUtcMs: stageDeadline,
          clock: clock,
        ),
        45,
      );
    });
  });
}

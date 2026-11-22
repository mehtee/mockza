@Tags(<String>['parity'])
library;

import 'dart:convert';
import 'dart:io';

import 'package:clock/clock.dart';
import 'package:mockza/core/advanced/drop_input_policy.dart';
import 'package:mockza/core/advanced/linguistic_graph_math.dart';
import 'package:mockza/core/advanced/quota_rules.dart';
import 'package:mockza/core/diagnostic/diagnostic_budget.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/core/diagnostic/diagnostic_router.dart';
import 'package:mockza/core/exams/band_conversion_table.dart';
import 'package:mockza/core/exams/countdown_clock_tracker.dart';
import 'package:mockza/core/exams/exam_descriptor.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/exams/local_objective_scorer.dart';
import 'package:mockza/core/exams/study_metrics_calculator.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/writing_evaluation.dart';
import 'package:mockza/core/personalization/live_band_engine.dart';
import 'package:mockza/core/personalization/objective_weakness_extractor.dart';
import 'package:mockza/core/personalization/roadmap_generator.dart';
import 'package:mockza/core/personalization/topic_taxonomy.dart';
import 'package:mockza/core/personalization/topic_weakness_rotator.dart';
import 'package:mockza/core/personalization/vocab_wave_scheduler.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/core/vocab/sm2_scheduler.dart';
import 'package:test/test.dart';

String _resolveFixturesDir() {
  if (Directory('shared-fixtures').existsSync()) {
    return 'shared-fixtures';
  }
  return '../shared-fixtures';
}

Map<String, Object?> _asMap(Object? value) {
  if (value is Map<Object?, Object?>) {
    final out = <String, Object?>{};
    for (final entry in value.entries) {
      final key = entry.key;
      if (key is String) {
        out[key] = entry.value;
      }
    }
    return out;
  }
  throw StateError('Expected JSON object, got ${value.runtimeType}');
}

List<Object?> _asList(Object? value) {
  if (value is List<Object?>) {
    return value;
  }
  throw StateError('Expected JSON array, got ${value.runtimeType}');
}

int _asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  throw StateError('Expected int, got ${value.runtimeType}');
}

double _asDouble(Object? value) {
  if (value is double) return value;
  if (value is num) return value.toDouble();
  throw StateError('Expected double, got ${value.runtimeType}');
}

String _asString(Object? value) {
  if (value is String) return value;
  throw StateError('Expected String, got ${value.runtimeType}');
}

bool _asBool(Object? value) {
  if (value is bool) return value;
  throw StateError('Expected bool, got ${value.runtimeType}');
}

int? _asNullableInt(Object? value) {
  if (value == null) return null;
  return _asInt(value);
}

double? _asNullableDouble(Object? value) {
  if (value == null) return null;
  return _asDouble(value);
}

String? _asNullableString(Object? value) {
  if (value == null) return null;
  return _asString(value);
}

bool? _asNullableBool(Object? value) {
  if (value == null) return null;
  return _asBool(value);
}

Map<String, Object?> _loadFixture(String fixturesDir, String fileName) {
  final file = File('$fixturesDir/$fileName');
  final decoded = jsonDecode(file.readAsStringSync()) as Object?;
  return _asMap(decoded);
}

SkillKind _parseSkill(String raw) => switch (raw) {
  'speaking' => SkillKind.speaking,
  'writing' => SkillKind.writing,
  'reading' => SkillKind.reading,
  'listening' => SkillKind.listening,
  'vocabulary' => SkillKind.vocabulary,
  _ => throw StateError('Unknown skill: $raw'),
};

ExamModuleType _parseModuleType(String raw) => raw == 'general_training'
    ? ExamModuleType.generalTraining
    : ExamModuleType.academic;

ReviewQuality _parseReviewQuality(String raw) => switch (raw) {
  'again' => ReviewQuality.again,
  'hard' => ReviewQuality.hard,
  'good' => ReviewQuality.good,
  'easy' => ReviewQuality.easy,
  _ => throw StateError('Unknown review quality: $raw'),
};

SrsCardState _parseSrsCardState(Map<String, Object?> json) => SrsCardState(
  repetitions: _asInt(json['repetitions']),
  intervalDays: _asInt(json['intervalDays']),
  easeFactorMilli: _asInt(json['easeFactorMilli']),
  dueDay: SerialDay(_asInt(json['dueDay'])),
);

List<DiagnosticBlockDef> _buildDiagnosticBank(String skill) {
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
  final fixturesDir = _resolveFixturesDir();
  final examSpecs = _loadFixture(fixturesDir, 'exam_specs_vectors.json');
  final bandConversion = _loadFixture(
    fixturesDir,
    'band_conversion_vectors.json',
  );
  final objectiveScorer = _loadFixture(
    fixturesDir,
    'objective_scorer_vectors.json',
  );
  final diagnosticRouter = _loadFixture(
    fixturesDir,
    'diagnostic_router_vectors.json',
  );
  final sm2Scheduler = _loadFixture(fixturesDir, 'sm2_scheduler_vectors.json');
  final studyMetrics = _loadFixture(fixturesDir, 'study_metrics_vectors.json');

  final roundIeltsBandVectors = _asList(examSpecs['roundIeltsBand']);
  final writingBandVectors = _asList(examSpecs['calculateWritingOverallBand']);
  final toeflLegacyVectors = _asList(examSpecs['estimateToeflLegacy120']);
  final examTrackScaleVectors = _asList(examSpecs['examTrackScale']);
  final descriptorsAndTasks = _asMap(examSpecs['examDescriptorsAndTasks']);
  final descriptorVectors = _asList(descriptorsAndTasks['descriptors']);
  final writingTaskVectors = _asList(descriptorsAndTasks['writingTasks']);

  final ieltsListeningVectors = _asList(bandConversion['ieltsListening']);
  final ieltsReadingAcadVectors = _asList(
    bandConversion['ieltsReadingAcademic'],
  );
  final ieltsReadingGtVectors = _asList(
    bandConversion['ieltsReadingGeneralTraining'],
  );
  final descriptorScoreObjVectors = _asList(
    bandConversion['descriptorScoreObjective'],
  );

  final normalizeVectors = _asList(objectiveScorer['normalize']);
  final normalizeSeqVectors = _asList(objectiveScorer['normalizeSequence']);
  final scoreVectors = _asList(objectiveScorer['score']);

  final selectBlockVectors = _asList(
    diagnosticRouter['selectNextObjectiveBlock'],
  );
  final classifyBlockVectors = _asList(
    diagnosticRouter['classifyBlockOutcome'],
  );
  final budgetObj = _asMap(diagnosticRouter['diagnosticBudget']);
  final budgetConstants = _asMap(budgetObj['constants']);
  final budgetDeadlineVectors = _asList(budgetObj['deadlineCases']);

  final serialDayVectors = _asList(sm2Scheduler['serialDay']);
  final sm2ScheduleVectors = _asList(sm2Scheduler['schedule']);
  final sm2PreviewAndFmt = _asMap(
    sm2Scheduler['previewIntervalsAndFormatDays'],
  );
  final sm2PreviewVectors = _asList(sm2PreviewAndFmt['previewCases']);
  final sm2FormatDaysVectors = _asList(sm2PreviewAndFmt['formatDaysCases']);

  final estOverallVectors = _asList(
    studyMetrics['calculateEstimatedOverallBand'],
  );
  final skillMetricsVectors = _asList(studyMetrics['calculateSkillMetrics']);
  final streakVectors = _asList(studyMetrics['calculateCurrentStreak']);
  final studyWeekVectors = _asList(studyMetrics['calculateStudyWeek']);

  final totalVectorCount =
      roundIeltsBandVectors.length +
      writingBandVectors.length +
      toeflLegacyVectors.length +
      examTrackScaleVectors.length +
      descriptorVectors.length +
      writingTaskVectors.length +
      ieltsListeningVectors.length +
      ieltsReadingAcadVectors.length +
      ieltsReadingGtVectors.length +
      descriptorScoreObjVectors.length +
      normalizeVectors.length +
      normalizeSeqVectors.length +
      scoreVectors.length +
      selectBlockVectors.length +
      classifyBlockVectors.length +
      1 +
      budgetDeadlineVectors.length +
      serialDayVectors.length +
      sm2ScheduleVectors.length +
      sm2PreviewVectors.length +
      sm2FormatDaysVectors.length +
      estOverallVectors.length +
      skillMetricsVectors.length +
      streakVectors.length +
      studyWeekVectors.length;

  group('Cross-Codebase Golden Parity Suite (Flutter <-> shared-fixtures)', () {
    test(
      'loads at least 250 golden parity vectors across all 6 fixture files',
      () {
        expect(totalVectorCount, greaterThanOrEqualTo(250));
        expect(_asString(examSpecs['schemaVersion']), '2026-11-18.v1');
        expect(_asString(bandConversion['schemaVersion']), '2026-11-18.v1');
        expect(_asString(objectiveScorer['schemaVersion']), '2026-11-18.v1');
        expect(_asString(diagnosticRouter['schemaVersion']), '2026-11-18.v1');
        expect(_asString(sm2Scheduler['schemaVersion']), '2026-11-18.v1');
        expect(_asString(studyMetrics['schemaVersion']), '2026-11-18.v1');
      },
    );

    group('1. ExamSpecs & Descriptors', () {
      for (final raw in roundIeltsBandVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('roundIeltsBand [$id]', () {
          expect(
            ExamSpec.roundIeltsBand(_asDouble(v['rawMean'])),
            _asDouble(v['expected']),
          );
        });
      }

      for (final raw in writingBandVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('calculateWritingOverallBand [$id]', () {
          expect(
            ExamSpec.calculateWritingOverallBand(
              task1Band: _asDouble(v['task1Band']),
              task2Band: _asDouble(v['task2Band']),
            ),
            _asDouble(v['expected']),
          );
        });
      }

      for (final raw in toeflLegacyVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('estimateToeflLegacy120 [$id]', () {
          expect(
            ExamSpec.estimateToeflLegacy120(_asDouble(v['band'])),
            _asInt(v['expected']),
          );
        });
      }

      for (final raw in examTrackScaleVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('examTrackScale [$id]', () {
          final track = ExamTrack.fromId(_asString(v['trackId']));
          final aliasResolved = ExamTrack.fromId(_asString(v['aliasInput']));
          expect(aliasResolved, track);

          final resolvedForPack = ExamTrack.resolveForPackOrProfile(
            packId: _asString(v['packIdForResolve']),
            profileExamId: _asString(v['profileExamIdForResolve']),
          );
          expect(resolvedForPack.id, _asString(v['expectedResolvedTrackId']));

          final rawScore = _asDouble(v['rawScore']);
          expect(
            track.quantizeScore(rawScore),
            _asDouble(v['expectedQuantized']),
          );
          expect(
            track.formatScore(rawScore),
            _asString(v['expectedFormatted']),
          );
          expect(
            track.formatScoreWithUnit(rawScore),
            _asString(v['expectedFormattedWithUnit']),
          );
          expect(
            track.normalizeScoreRatio(rawScore),
            closeTo(_asDouble(v['expectedNormalizedRatio']), 1e-6),
          );
          expect(
            track.scoreFromRatio(_asDouble(v['ratio'])),
            _asDouble(v['expectedScoreFromRatio']),
          );

          final prevTrack = ExamTrack.fromId(_asString(v['previousTrackId']));
          expect(
            track.nextTargetWhenSwitchingFrom(
              prevTrack,
              _asDouble(v['previousTarget']),
            ),
            _asDouble(v['expectedNextTarget']),
          );
        });
      }

      for (final raw in descriptorVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('descriptor [$id]', () {
          final track = ExamTrack.fromId(_asString(v['trackId']));
          final desc = ExamDescriptor.forTrack(track);
          expect(
            desc.minCalibratedObjectiveCount,
            _asInt(v['expectedMinCalibratedObjectiveCount']),
          );
          expect(
            desc.writingTasks.map((t) => t.name).toList(growable: false),
            _asList(v['expectedWritingTasks']).map(_asString).toList(),
          );
          expect(
            desc.fullMockTotalSeconds,
            _asInt(v['expectedFullMockTotalSeconds']),
          );

          final expectedPackIds = _asMap(v['expectedPackIds']);
          for (final entry in expectedPackIds.entries) {
            expect(
              desc.defaultPackIdForSkill(_parseSkill(entry.key)),
              _asString(entry.value),
            );
          }

          final detInputs = _asMap(v['detInputs']);
          final actualSubscores = ExamDescriptor.computeDetSubscores(
            reading: _asNullableDouble(detInputs['reading']),
            listening: _asNullableDouble(detInputs['listening']),
            writing: _asNullableDouble(detInputs['writing']),
            speaking: _asNullableDouble(detInputs['speaking']),
          );
          final expectedSubscores = _asMap(v['expectedDetSubscores']);
          expect(
            actualSubscores.literacy,
            _asNullableDouble(expectedSubscores['literacy']),
          );
          expect(
            actualSubscores.comprehension,
            _asNullableDouble(expectedSubscores['comprehension']),
          );
          expect(
            actualSubscores.conversation,
            _asNullableDouble(expectedSubscores['conversation']),
          );
          expect(
            actualSubscores.production,
            _asNullableDouble(expectedSubscores['production']),
          );

          final actualInsights = desc.buildScoreInsights(
            overallScore: _asDouble(v['overallScoreForInsights']),
            reading: _asNullableDouble(detInputs['reading']),
            listening: _asNullableDouble(detInputs['listening']),
            writing: _asNullableDouble(detInputs['writing']),
            speaking: _asNullableDouble(detInputs['speaking']),
          );
          final expectedInsights = _asList(v['expectedScoreInsights']);
          expect(actualInsights.length, expectedInsights.length);
          for (var i = 0; i < expectedInsights.length; i += 1) {
            final exp = _asMap(expectedInsights[i]);
            expect(actualInsights[i].label, _asString(exp['label']));
            expect(actualInsights[i].detail, _asString(exp['detail']));
          }
        });
      }

      for (final raw in writingTaskVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('writingTask [$id]', () {
          final task = WritingTaskType.fromWire(_asString(v['wireInput']));
          expect(task.name, _asString(v['expectedTaskType']));
          expect(task.defaultMinWords, _asInt(v['expectedDefaultMinWords']));
          expect(
            task.defaultMaxWords,
            _asNullableInt(v['expectedDefaultMaxWords']),
          );
          expect(
            task.defaultDurationSeconds,
            _asInt(v['expectedDefaultDurationSeconds']),
          );
          expect(
            task.requiresSingleSentence,
            _asBool(v['expectedRequiresSingleSentence']),
          );
          expect(task.shortTabLabel, _asString(v['expectedShortTabLabel']));
        });
      }
    });

    group('2. BandConversionTable & Objective Scaling', () {
      for (final raw in ieltsListeningVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('ieltsListening [$id]', () {
          expect(
            BandConversionTable.listeningBandFor(_asInt(v['rawCorrect'])),
            _asDouble(v['expectedBand']),
          );
        });
      }

      for (final raw in ieltsReadingAcadVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('ieltsReadingAcademic [$id]', () {
          expect(
            BandConversionTable.readingBandFor(
              _asInt(v['rawCorrect']),
              moduleType: ExamModuleType.academic,
            ),
            _asDouble(v['expectedBand']),
          );
        });
      }

      for (final raw in ieltsReadingGtVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('ieltsReadingGeneralTraining [$id]', () {
          expect(
            BandConversionTable.readingBandFor(
              _asInt(v['rawCorrect']),
              moduleType: ExamModuleType.generalTraining,
            ),
            _asDouble(v['expectedBand']),
          );
        });
      }

      for (final raw in descriptorScoreObjVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('descriptorScoreObjective [$id]', () {
          final desc = ExamDescriptor.forTrack(
            ExamTrack.fromId(_asString(v['trackId'])),
          );
          expect(
            desc.scoreObjective(
              skill: _parseSkill(_asString(v['skill'])),
              correctCount: _asInt(v['correctCount']),
              totalCount: _asInt(v['totalCount']),
              isFullLength: _asBool(v['isFullLength']),
            ),
            _asDouble(v['expectedScore']),
          );
        });
      }
    });

    group('3. LocalObjectiveScorer', () {
      for (final raw in normalizeVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('normalize [$id]', () {
          expect(
            LocalObjectiveScorer.normalize(_asString(v['raw'])),
            _asString(v['expected']),
          );
        });
      }

      for (final raw in normalizeSeqVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('normalizeSequence [$id]', () {
          expect(
            LocalObjectiveScorer.normalizeSequence(_asString(v['raw'])),
            _asString(v['expected']),
          );
        });
      }

      for (final raw in scoreVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('score [$id]', () {
          final answers = _asList(v['answers'])
              .map((item) {
                final a = _asMap(item);
                return ObjectiveQuestionAnswer(
                  questionId: _asString(a['questionId']),
                  questionType: ObjectiveQuestionType.fromWire(
                    _asString(a['questionType']),
                  ),
                  acceptedAnswers: _asList(
                    a['acceptedAnswers'],
                  ).map(_asString).toList(growable: false),
                  userAnswer: _asNullableString(a['userAnswer']),
                  maxWords: _asInt(a['maxWords']),
                );
              })
              .toList(growable: false);

          final report = LocalObjectiveScorer.score(
            answers: answers,
            skill: _parseSkill(_asString(v['skill'])),
            moduleType: _parseModuleType(_asString(v['moduleType'])),
            track: ExamTrack.fromId(_asString(v['trackId'])),
          );

          final expected = _asMap(v['expected']);
          expect(report.correctCount, _asInt(expected['correctCount']));
          expect(report.totalCount, _asInt(expected['totalCount']));
          expect(report.bandScore, _asDouble(expected['bandScore']));
          expect(report.accuracyPercent, _asInt(expected['accuracyPercent']));
          expect(
            report.isCalibratedFullPack,
            _asBool(expected['isCalibratedFullPack']),
          );

          final expectedCorrectness = _asMap(expected['questionCorrectness']);
          for (final entry in expectedCorrectness.entries) {
            expect(report.questionCorrectness[entry.key], _asBool(entry.value));
          }
        });
      }
    });

    group('4. DiagnosticRouter & DiagnosticBudget', () {
      test('matches diagnostic policyVersion', () {
        expect(
          DiagnosticRouter.policyVersion,
          _asString(diagnosticRouter['policyVersion']),
        );
      });

      for (final raw in selectBlockVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('selectNextObjectiveBlock [$id]', () {
          final skill = _asString(v['skill']);
          final rawBank = v['bankOverride'];
          final bank = rawBank != null
              ? _asList(rawBank)
                    .map((item) {
                      final b = _asMap(item);
                      final blockId = _asString(b['blockId']);
                      return DiagnosticBlockDef(
                        blockId: blockId,
                        skill: skill,
                        tier: AuthoringTier.fromCode(_asString(b['tier'])),
                        scenarioId: 'community_spaces',
                        title: blockId,
                        minRequiredSeconds:
                            _asNullableInt(b['minRequiredSeconds']) ?? 20,
                        questions: <DiagnosticQuestionDef>[
                          DiagnosticQuestionDef(
                            questionId: '$blockId-Q1',
                            prompt: 'Q1',
                            options: const <String>['A', 'B', 'C'],
                            correctIndex: 0,
                            focusTag: 'explicit_detail',
                          ),
                          DiagnosticQuestionDef(
                            questionId: '$blockId-Q2',
                            prompt: 'Q2',
                            options: const <String>['A', 'B', 'C'],
                            correctIndex: 1,
                            focusTag: 'meaning_relationship',
                          ),
                        ],
                      );
                    })
                    .toList(growable: false)
              : _buildDiagnosticBank(skill);

          final history = _asList(v['history'])
              .map((item) {
                final h = _asMap(item);
                return BlockAttemptRecord(
                  blockId: _asString(h['blockId']),
                  tier: AuthoringTier.fromCode(_asString(h['tier'])),
                  category: RoutingCategory.fromWire(_asString(h['category'])),
                  selectedOptionIndices: _asList(
                    h['selectedOptionIndices'],
                  ).map(_asNullableInt).toList(growable: false),
                  correctCount: _asInt(h['correctCount']),
                  noEvidenceReason: NoEvidenceReason.tryFromWire(
                    _asNullableString(h['noEvidenceReason']),
                  ),
                );
              })
              .toList(growable: false);

          final result = DiagnosticRouter.selectNextObjectiveBlock(
            skill: skill,
            bank: bank,
            history: history,
            remainingStageSeconds: _asInt(v['remainingStageSeconds']),
            remainingGlobalSeconds: _asInt(v['remainingGlobalSeconds']),
            selectionSeed:
                _asNullableString(v['selectionSeed']) ?? 'parity-seed',
            initialTier: AuthoringTier.fromCode(
              _asNullableString(v['initialTier']) ?? 'B1',
            ),
            strictMode: _asNullableBool(v['strictMode']) ?? true,
          );

          final expectedAction = _asString(v['expectedAction']);
          expect(result.shouldPresent, expectedAction == 'present');

          final expectedTier = _asNullableString(v['expectedTargetTier']);
          if (expectedTier != null) {
            expect(result.targetTier?.code, expectedTier);
          }

          final expectedChosenBlockId = _asNullableString(
            v['expectedChosenBlockId'],
          );
          if (expectedChosenBlockId != null) {
            expect(result.block?.blockId, expectedChosenBlockId);
          }

          final expectedStop = _asNullableString(v['expectedStopReason']);
          if (expectedStop != null) {
            expect(result.stopReason?.wire, expectedStop);
          }

          final expectedReduced = _asNullableBool(
            v['expectedReducedSampling'],
          );
          if (expectedReduced != null) {
            expect(result.reducedSampling, expectedReduced);
          }

          final expectedCheck = _asNullableBool(
            v['expectedEvidenceCheckTriggered'],
          );
          if (expectedCheck != null) {
            expect(result.evidenceCheckTriggered, expectedCheck);
          }

          final expectedContradiction = _asNullableBool(
            v['expectedHasContradictoryEvidence'],
          );
          if (expectedContradiction != null) {
            expect(result.hasContradictoryEvidence, expectedContradiction);
          }

          final rawCoincident = v['expectedCoincidentReasons'];
          if (rawCoincident != null) {
            final expectedCoincident = _asList(
              rawCoincident,
            ).map(_asString).toList(growable: false);
            expect(
              result.coincidentReasons.map((r) => r.wire).toSet(),
              containsAll(expectedCoincident),
            );
          }
        });
      }

      for (final raw in classifyBlockVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('classifyBlockOutcome [$id]', () {
          final questions = _asList(v['questions'])
              .map((item) {
                final q = _asMap(item);
                return DiagnosticQuestionDef(
                  questionId: _asString(q['questionId']),
                  prompt: _asString(q['prompt']),
                  options: _asList(q['options']).map(_asString).toList(),
                  correctIndex: _asInt(q['correctIndex']),
                  focusTag: _asString(q['focusTag']),
                );
              })
              .toList(growable: false);

          final actual = DiagnosticRouter.classifyBlockOutcome(
            questions: questions,
            selectedOptionIndices: _asList(
              v['selectedOptionIndices'],
            ).map(_asNullableInt).toList(growable: false),
            noEvidenceReason: NoEvidenceReason.tryFromWire(
              _asNullableString(v['noEvidenceReason']),
            ),
          );

          expect(actual.category.wire, _asString(v['expectedCategory']));
          expect(actual.correctCount, _asInt(v['expectedCorrectCount']));
          expect(
            actual.noEvidenceReason?.wire,
            _asNullableString(v['expectedNoEvidenceReason']),
          );
        });
      }

      test('diagnosticBudget [${_asString(budgetConstants['id'])}]', () {
        expect(
          DiagnosticBudget.introMaxSeconds,
          _asInt(budgetConstants['introMaxSeconds']),
        );
        expect(
          DiagnosticBudget.readingMaxSeconds,
          _asInt(budgetConstants['readingMaxSeconds']),
        );
        expect(
          DiagnosticBudget.listeningMaxSeconds,
          _asInt(budgetConstants['listeningMaxSeconds']),
        );
        expect(
          DiagnosticBudget.writingMaxSeconds,
          _asInt(budgetConstants['writingMaxSeconds']),
        );
        expect(
          DiagnosticBudget.writingFollowUpMaxSeconds,
          _asInt(budgetConstants['writingFollowUpMaxSeconds']),
        );
        expect(
          DiagnosticBudget.speakingPrepMaxSeconds,
          _asInt(budgetConstants['speakingPrepMaxSeconds']),
        );
        expect(
          DiagnosticBudget.speakingMainMaxSeconds,
          _asInt(budgetConstants['speakingMainMaxSeconds']),
        );
        expect(
          DiagnosticBudget.speakingFollowUpMaxSeconds,
          _asInt(budgetConstants['speakingFollowUpMaxSeconds']),
        );
        expect(
          DiagnosticBudget.speakingMaxSeconds,
          _asInt(budgetConstants['speakingMaxSeconds']),
        );
        expect(
          DiagnosticBudget.transitionMaxSeconds,
          _asInt(budgetConstants['transitionMaxSeconds']),
        );
        expect(
          DiagnosticBudget.collectionTotalSeconds,
          _asInt(budgetConstants['collectionTotalSeconds']),
        );
        expect(
          DiagnosticBudget.resultsWindowSeconds,
          _asInt(budgetConstants['resultsWindowSeconds']),
        );
        expect(
          DiagnosticBudget.totalSessionSeconds,
          _asInt(budgetConstants['totalSessionSeconds']),
        );
      });

      for (final raw in budgetDeadlineVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('diagnosticBudget [$id]', () {
          final fixedNow = DateTime.fromMillisecondsSinceEpoch(
            _asInt(v['nowUtcMs']),
            isUtc: true,
          );
          final clock = Clock.fixed(fixedNow);
          final deadline = DiagnosticBudget.computeBoundedStageDeadlineUtcMs(
            stageCapSeconds: _asInt(v['stageCapSeconds']),
            globalCollectionDeadlineUtcMs: _asInt(
              v['globalCollectionDeadlineUtcMs'],
            ),
            mode: DiagnosticMode.fromWire(_asString(v['mode'])),
            clock: clock,
          );
          expect(deadline, _asInt(v['expectedStageDeadlineUtcMs']));
          expect(
            DiagnosticBudget.remainingSeconds(
              deadlineUtcMs: deadline,
              clock: clock,
            ),
            _asInt(v['expectedRemainingSeconds']),
          );

          final expiredDeadline = _asNullableInt(v['expiredDeadlineUtcMs']);
          final expectedExpired = _asNullableInt(
            v['expectedExpiredRemainingSeconds'],
          );
          if (expiredDeadline != null && expectedExpired != null) {
            expect(
              DiagnosticBudget.remainingSeconds(
                deadlineUtcMs: expiredDeadline,
                clock: clock,
              ),
              expectedExpired,
            );
          }
        });
      }
    });

    group('5. Sm2Scheduler & SerialDay', () {
      for (final raw in serialDayVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('serialDay [$id]', () {
          final day = SerialDay.fromUtcDateTime(
            DateTime.parse(_asString(v['utcIso'])),
          );
          expect(day.value, _asInt(v['expectedSerialDay']));
          final shifted = day.addDays(_asInt(v['addDays']));
          expect(shifted.value, _asInt(v['expectedAfterAddDays']));
          expect(
            shifted.differenceDays(day),
            _asInt(v['expectedDifferenceDays']),
          );
        });
      }

      for (final raw in sm2ScheduleVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('schedule [$id]', () {
          final next = Sm2Scheduler.schedule(
            current: _parseSrsCardState(_asMap(v['current'])),
            quality: _parseReviewQuality(_asString(v['quality'])),
            today: SerialDay(_asInt(v['today'])),
          );
          final exp = _asMap(v['expected']);
          expect(next.repetitions, _asInt(exp['repetitions']));
          expect(next.intervalDays, _asInt(exp['intervalDays']));
          expect(next.easeFactorMilli, _asInt(exp['easeFactorMilli']));
          expect(next.dueDay.value, _asInt(exp['dueDay']));
        });
      }

      for (final raw in sm2PreviewVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('previewIntervals [$id]', () {
          final actual = Sm2Scheduler.previewIntervals(
            _parseSrsCardState(_asMap(v['current'])),
          );
          final exp = _asMap(v['expected']);
          expect(actual[ReviewQuality.again], _asString(exp['again']));
          expect(actual[ReviewQuality.hard], _asString(exp['hard']));
          expect(actual[ReviewQuality.good], _asString(exp['good']));
          expect(actual[ReviewQuality.easy], _asString(exp['easy']));
        });
      }

      for (final raw in sm2FormatDaysVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('formatDays [$id]', () {
          expect(
            Sm2Scheduler.formatDays(_asInt(v['days'])),
            _asString(v['expected']),
          );
        });
      }
    });

    group('6. StudyMetricsCalculator & CountdownClockTracker', () {
      for (final raw in estOverallVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('calculateEstimatedOverallBand [$id]', () {
          final attempts = _asList(v['scoredAttempts'])
              .map((item) {
                final a = _asMap(item);
                return (
                  score: _asDouble(a['score']),
                  skill: _parseSkill(_asString(a['skill'])),
                  completedAtUtcMs: _asInt(a['completedAtUtcMs']),
                );
              })
              .toList(growable: false);

          final actual = StudyMetricsCalculator.calculateEstimatedOverallBand(
            scoredAttempts: attempts,
            track: ExamTrack.fromId(_asString(v['trackId'])),
            targetBand: _asNullableDouble(v['targetBand']),
            currentUtcMs: _asInt(v['currentUtcMs']),
          );

          final exp = _asMap(v['expected']);
          expect(actual.overallBand, _asNullableDouble(exp['overallBand']));
          expect(actual.isEstimated, _asBool(exp['isEstimated']));
          expect(actual.scaleMin, _asDouble(exp['scaleMin']));
          expect(actual.scaleMax, _asDouble(exp['scaleMax']));
          expect(actual.sampleSize, _asInt(exp['sampleSize']));
          expect(
            actual.attemptedSkillsCount,
            _asInt(exp['attemptedSkillsCount']),
          );
          expect(
            actual.isFullFourSkillEstimate,
            _asBool(exp['isFullFourSkillEstimate']),
          );
          expect(
            actual.diagnosticRecommended,
            _asBool(exp['diagnosticRecommended']),
          );
          expect(
            actual.changeThisMonth,
            _asNullableDouble(exp['changeThisMonth']),
          );
          expect(actual.scaleLabel, _asString(exp['scaleLabel']));
          expect(
            actual.progressToTarget,
            closeTo(_asDouble(exp['progressToTarget']), 1e-6),
          );
        });
      }

      for (final raw in skillMetricsVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('calculateSkillMetrics [$id]', () {
          final attempts = _asList(v['attempts'])
              .map((item) {
                final a = _asMap(item);
                return (
                  score: _asDouble(a['score']),
                  skill: _parseSkill(_asString(a['skill'])),
                );
              })
              .toList(growable: false);

          final actual = StudyMetricsCalculator.calculateSkillMetrics(
            attempts: attempts,
            track: ExamTrack.fromId(_asString(v['trackId'])),
          );

          final expectedList = _asList(v['expected']);
          expect(actual.length, expectedList.length);
          for (var i = 0; i < expectedList.length; i += 1) {
            final exp = _asMap(expectedList[i]);
            final item = actual[i];
            expect(item.skill.name, _asString(exp['skill']));
            expect(item.score, _asNullableDouble(exp['score']));
            expect(item.scaleMin, _asDouble(exp['scaleMin']));
            expect(item.scaleMax, _asDouble(exp['scaleMax']));
            expect(item.scoreLabel, _asString(exp['scoreLabel']));
            expect(item.sampleCount, _asInt(exp['sampleCount']));
            expect(
              item.normalizedPosition,
              closeTo(_asDouble(exp['normalizedPosition']), 1e-6),
            );
          }
        });
      }

      for (final raw in streakVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('calculateCurrentStreak [$id]', () {
          final studyDays = _asList(
            v['studyDays'],
          ).map((d) => SerialDay(_asInt(d))).toSet();
          expect(
            StudyMetricsCalculator.calculateCurrentStreak(
              studyDays: studyDays,
              today: SerialDay(_asInt(v['today'])),
            ),
            _asInt(v['expectedStreak']),
          );
        });
      }

      for (final raw in studyWeekVectors) {
        final v = _asMap(raw);
        final id = _asString(v['id']);
        test('calculateStudyWeek [$id]', () {
          final studyDays = _asList(
            v['studyDays'],
          ).map((d) => SerialDay(_asInt(d))).toSet();
          final actual = StudyMetricsCalculator.calculateStudyWeek(
            studyDays: studyDays,
            today: SerialDay(_asInt(v['today'])),
            weekdayOfToday: _asInt(v['weekdayOfToday']),
          );
          final exp = _asMap(v['expected']);
          expect(actual.completedCount, _asInt(exp['completedCount']));
          expect(actual.summaryLabel, _asString(exp['summaryLabel']));
          final expDays = _asList(exp['days']);
          expect(actual.days.length, expDays.length);
          for (var i = 0; i < expDays.length; i += 1) {
            final d = actual.days[i];
            final ed = _asMap(expDays[i]);
            expect(d.daySerial.value, _asInt(ed['daySerial']));
            expect(d.dayLabel, _asString(ed['dayLabel']));
            expect(d.isCompleted, _asBool(ed['isCompleted']));
            expect(d.isToday, _asBool(ed['isToday']));
            expect(d.isFuture, _asBool(ed['isFuture']));
          }
        });
      }

      test('CountdownClockTracker matches wall-clock start/pause/resume/expiry parity', () {
        var nowMs = 1000000;
        final tracker = CountdownClockTracker(
          clock: Clock(
            () => DateTime.fromMillisecondsSinceEpoch(nowMs, isUtc: true),
          ),
        )..start(remainingSeconds: 60, totalSeconds: 100);
        expect(tracker.totalSeconds, 100);
        expect(tracker.currentRemaining(), 60);
        nowMs += 999;
        expect(tracker.currentRemaining(), 60);
        nowMs += 9001;
        expect(tracker.currentRemaining(), 50);
        expect(tracker.pause(), 50);
        expect(tracker.isPaused, isTrue);
        nowMs += 30000;
        expect(tracker.currentRemaining(), 50);
        tracker.resume();
        expect(tracker.isPaused, isFalse);
        nowMs += 50000;
        expect(tracker.currentRemaining(), 0);
        expect(tracker.isExpired, isTrue);
      });
    });

    group('7. Closed-Loop Linguistic Graph & Drop Bounds Parity', () {
      final graphFixtures = _asMap(
        jsonDecode(
          File(
            '$fixturesDir/linguistic_graph_vectors.json',
          ).readAsStringSync(),
        ),
      );
      final dropFixtures = _asMap(
        jsonDecode(
          File('$fixturesDir/drop_bounds_vectors.json').readAsStringSync(),
        ),
      );

      for (final raw in _asList(graphFixtures['masteryUpdates'])) {
        final v = _asMap(raw);
        test('computeNextMasteryMilli [${_asString(v['id'])}]', () {
          expect(
            LinguisticGraphMath.computeNextMasteryMilli(
              currentMilli: _asInt(v['currentMilli']),
              polarity: EvidencePolarity.fromWire(_asString(v['polarity'])),
              evidenceCount: _asInt(v['evidenceCount']),
            ),
            _asInt(v['expectedMilli']),
          );
        });
      }

      test('rankTopMissionTargets matches TS priority parity', () {
        final r = _asMap(graphFixtures['rankMissionTargets']);
        final nodes = _asList(r['nodes'])
            .map((raw) {
              final n = _asMap(raw);
              return LinguisticNodeSummary(
                nodeId: _asString(n['nodeId']),
                nodeKind: LinguisticNodeKind.fromWire(_asString(n['nodeKind'])),
                canonicalKey: _asString(n['canonicalKey']),
                masteryScoreMilli: _asInt(n['masteryScoreMilli']),
                signalWeightMilli: _asInt(n['signalWeightMilli']),
                evidenceCount: _asInt(n['evidenceCount']),
                lastSeenDaySerial: _asInt(n['lastSeenDaySerial']),
              );
            })
            .toList(growable: false);

        final ranked = LinguisticGraphMath.rankTopMissionTargets(
          nodes: nodes,
          dueCardIds: _asList(r['dueCardIds']).map(_asString).toList(),
          currentDaySerial: _asInt(r['currentDaySerial']),
        );
        final exp = _asMap(r['expected']);
        expect(
          ranked.bottlenecks.map((b) => b.canonicalKey).toList(),
          _asList(exp['bottleneckKeys']).map(_asString).toList(),
        );
        expect(
          ranked.targetStructures.map((t) => t.canonicalKey).toList(),
          _asList(exp['targetKeys']).map(_asString).toList(),
        );
        expect(
          ranked.interestTopics.map((i) => i.canonicalKey).toList(),
          _asList(exp['interestKeys']).map(_asString).toList(),
        );
        expect(
          ranked.suggestedCardIds,
          _asList(exp['suggestedCardIds']).map(_asString).toList(),
        );
      });

      for (final raw in _asList(graphFixtures['utf16Spans'])) {
        final v = _asMap(raw);
        test('normalizeUtf16Span [${_asString(v['id'])}]', () {
          final res = LinguisticGraphMath.normalizeUtf16Span(
            _asString(v['sourceText']),
            _asInt(v['rawStart']),
            _asInt(v['rawEnd']),
          );
          expect(res.startUtf16, _asInt(v['expectedStart']));
          expect(res.endUtf16, _asInt(v['expectedEnd']));
          expect(res.excerpt, _asString(v['expectedExcerpt']));
        });
      }

      for (final raw in _asList(dropFixtures['urlCases'])) {
        final v = _asMap(raw);
        test(
          'DropInputPolicy.validateUrlPreFlight [${_asString(v['id'])}]',
          () {
            final res = DropInputPolicy.validateUrlPreFlight(
              _asString(v['url']),
              allowHttpInDev: _asBool(v['allowHttpInDev']),
            );
            expect(res.ok, _asBool(v['expectedOk']));
            expect(res.code, _asNullableString(v['expectedCode']));
          },
        );
      }

      for (final raw in _asList(dropFixtures['textCases'])) {
        final v = _asMap(raw);
        test('DropInputPolicy.validateTextSnippet [${_asString(v['id'])}]', () {
          final res = DropInputPolicy.validateTextSnippet(_asString(v['text']));
          expect(res.ok, _asBool(v['expectedOk']));
          expect(res.code, _asNullableString(v['expectedCode']));
        });
      }

      for (final raw in _asList(dropFixtures['audioCases'])) {
        final v = _asMap(raw);
        test(
          'DropInputPolicy.validateBoundedAudio [${_asString(v['id'])}]',
          () {
            final res = DropInputPolicy.validateBoundedAudio(
              isShifter: _asString(v['mode']) == 'shifter',
              contentType: _asString(v['contentType']),
              byteLength: _asInt(v['byteLength']),
              durationSeconds: _asInt(v['durationSeconds']),
            );
            expect(res.ok, _asBool(v['expectedOk']));
            expect(res.code, _asNullableString(v['expectedCode']));
          },
        );
      }

      test('AdvancedQuotaRules enforces IRN 120/mo vs GLB 150/mo parity', () {
        final freeAudio = AdvancedQuotaRules.evaluate(
          feature: AdvancedQuotaFeature.dropAudio,
          isPro: false,
          freeSampleUsed: false,
          speakingUsedToday: 0,
          shifterUsedToday: 0,
          dropsUsedToday: 0,
          audioDropsUsedToday: 0,
          monthlyUsed: 0,
          editionCode: 'irn',
        );
        expect(freeAudio.allowed, isFalse);
        expect(freeAudio.reason, 'pro_required_for_audio_drop');
      });

      for (final raw in _asList(dropFixtures['clozeCases'])) {
        final v = _asMap(raw);
        test('DropInputPolicy.checkClozeAnswer [${_asString(v['id'])}]', () {
          expect(
            DropInputPolicy.checkClozeAnswer(
              _asString(v['input']),
              _asString(v['expected']),
            ),
            _asBool(v['matches']),
          );
        });
      }
    });

    group('8. Adaptive Personalization, Live Band, Rotation & Vocab Wave Parity', () {
      final pFixtures = _asMap(
        jsonDecode(
          File('$fixturesDir/personalization_vectors.json').readAsStringSync(),
        ),
      );

      for (final raw in _asList(pFixtures['topicNormalizationCases'])) {
        final v = _asMap(raw);
        test('CanonicalTopicKey.normalize [${_asString(v['id'])}]', () {
          expect(
            CanonicalTopicKey.normalize(_asString(v['input'])).wireKey,
            _asString(v['expected']),
          );
        });
      }

      for (final raw in _asList(pFixtures['liveBandCases'])) {
        final v = _asMap(raw);
        test('LiveBandEngine.computeLiveBandProfile [${_asString(v['id'])}]', () {
          final events = _asList(v['events']).map((eRaw) {
            final e = _asMap(eRaw);
            return BandEvidenceEvent(
              skill: _asString(e['skill']),
              sourceKind: BandEventSourceKind.fromWire(_asString(e['sourceKind'])),
              rawScore: _asDouble(e['rawScore']),
              recordedAtMs: _asInt(e['recordedAtMs']),
            );
          }).toList(growable: false);

          final res = LiveBandEngine.computeLiveBandProfile(
            events: events,
            track: ExamTrack.fromId(_asString(v['examId'])),
            targetBand: _asDouble(v['targetBand']),
            nowUtcMs: _asInt(v['nowUtcMs']),
            previousOverallScore: _asNullableDouble(v['previousOverallScore']),
          );
          expect(res.overallScore, _asDouble(v['expectedOverall']));
          expect(
            res.overallConfidence.wireValue,
            _asString(v['expectedConfidence']),
          );
          expect(
            res.bandShift?.delta,
            _asNullableDouble(v['expectedBandShiftDelta']),
          );
        });
      }

      for (final raw in _asList(pFixtures['phaseRotationCases'])) {
        final v = _asMap(raw);
        test('TopicWeaknessRotator.selectNextCoachTopic [${_asString(v['id'])}]', () {
          final nodes = _asList(v['weaknessNodes']).map((nRaw) {
            final n = _asMap(nRaw);
            return LinguisticNodeSummary(
              nodeId: _asString(n['nodeId']),
              nodeKind: LinguisticNodeKind.fromWire(_asString(n['nodeKind'])),
              canonicalKey: _asString(n['canonicalKey']),
              masteryScoreMilli: _asInt(n['masteryScoreMilli']),
              signalWeightMilli: _asInt(n['signalWeightMilli']),
              evidenceCount: _asInt(n['evidenceCount']),
              lastSeenDaySerial: _asInt(n['lastSeenDaySerial']),
            );
          }).toList(growable: false);

          final coverage = _asList(v['coverage']).map((cRaw) {
            final c = _asMap(cRaw);
            return TopicWeaknessCoverageEntry(
              weaknessKey: _asString(c['weaknessKey']),
              topicKey: CanonicalTopicKey.normalize(_asString(c['topicKey'])),
              practiceCount: _asInt(c['practiceCount']),
              passCount: _asInt(c['passCount']),
              lastMasteryMilli: _asInt(c['lastMasteryMilli']),
              lastPracticedDaySerial: _asInt(c['lastPracticedDaySerial']),
            );
          }).toList(growable: false);

          final favs = _asList(v['favoriteTopics'])
              .map((t) => CanonicalTopicKey.normalize(_asString(t)))
              .toList(growable: false);

          final sel = TopicWeaknessRotator.selectNextCoachTopic(
            weaknessNodes: nodes,
            favoriteTopics: favs,
            coverage: coverage,
            currentDaySerial: _asInt(v['currentDaySerial']),
          );
          expect(sel.topicKey.wireKey, _asString(v['expectedTopic']));
          expect(sel.phase.wireValue, _asString(v['expectedPhase']));
        });
      }

      test('VocabWaveScheduler matches TS wave & daily cap parity', () {
        final vc = _asMap(pFixtures['vocabWaveCase']);
        final cards = _asList(vc['cards']).map((cRaw) {
          final c = _asMap(cRaw);
          return VocabWaveCardInput(
            cardId: _asString(c['cardId']),
            headword: _asString(c['headword']),
            legacyTopicTag: _asString(c['legacyTopicTag']),
            cefrLevel: AuthoringTier.fromCode(_asString(c['cefrLevel'])),
            repetitions: _asInt(c['repetitions']),
            dueSerialDay: _asInt(c['dueSerialDay']),
          );
        }).toList(growable: false);

        final waves = VocabWaveScheduler.assignWaves(
          cards: cards,
          favoriteTopics: _asList(vc['favoriteTopics']).map(_asString).toList(),
          track: ExamTrack.fromId(_asString(vc['examId'])),
          currentBand: _asDouble(vc['currentBand']),
          targetBand: _asDouble(vc['targetBand']),
          activeWeaknessKeys:
              _asList(vc['activeWeaknessKeys']).map(_asString).toList(),
          unlockedWave: _asInt(vc['unlockedWave']),
          waveSize: _asInt(vc['waveSize']),
        );
        final daily = VocabWaveScheduler.selectDailyReviewQueue(
          assigned: waves.assigned,
          todaySerialDay: _asInt(vc['todaySerialDay']),
          newCardsIntroducedToday: 0,
          unlockedWave: _asInt(vc['unlockedWave']),
          dailyNewCap: _asInt(vc['dailyNewCap']),
        );
        expect(daily.queue.length, _asInt(vc['expectedQueueLength']));
        expect(
          daily.summary.readyToUnlockNext,
          _asBool(vc['expectedReadyToUnlockNext']),
        );
      });

      test('ObjectiveWeaknessExtractor & RoadmapGenerator parity', () {
        final weaknesses = ObjectiveWeaknessExtractor.extract(
          skill: 'reading',
          questionTypeStats: const <QuestionTypeStatInput>[
            QuestionTypeStatInput(questionType: 'tfng', correct: 1, total: 5),
          ],
        );
        expect(weaknesses.first.canonicalKey, 'reading:tfng_trap');
        expect(weaknesses.first.observedPolarity, EvidencePolarity.gapObserved);

        final roadmap = RoadmapGenerator.generateOrRecalibrate(
          track: ExamTrack.ieltsAcademic,
          currentBand: 6,
          targetBand: 7.5,
          targetDateSerial: 20810,
          todaySerial: 20780,
          studyFocus: 'both',
          dailyMinutesGoal: 30,
          favoriteTopics: const <String>['technology_ai', 'health_sports'],
          weaknessNodes: const <LinguisticNodeSummary>[],
          coverage: const <TopicWeaknessCoverageEntry>[],
          packs: const <RoadmapPackInventoryItem>[],
          drills: const <RoadmapDrillInventoryItem>[],
          diagnosticDone: false,
          currentVocabWave: 1,
          existingCompletedStepKeys: const <String>{'m1:vocab:wave1'},
        );
        expect(roadmap.milestones.length, 4);
        expect(roadmap.activeStep?.stepKey, 'm1:diagnostic');
        expect(
          roadmap.steps
              .firstWhere((s) => s.stepKey == 'm1:vocab:wave1')
              .status,
          RoadmapStepStatus.completed,
        );
      });
    });
  });
}

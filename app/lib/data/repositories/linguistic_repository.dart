import 'dart:convert';

import 'package:clock/clock.dart';
import 'package:drift/drift.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/services/linguistic_gateway.dart';

/// Persists and reads offline Linguistic Graph, Daily Missions, and Dropped Contents in Drift v8.
final class LinguisticRepository {
  /// Creates a [LinguisticRepository].
  const new({
    required this._db,
    required this._clock,
  });

  final AppDatabase _db;
  final Clock _clock;

  /// Caches a fetched [LinguisticGraphSnapshot] locally in Drift.
  Future<void> cacheGraphSnapshot(
    LinguisticGraphSnapshot snapshot, {
    required String edition,
  }) async {
    final nowMs = _clock.now().toUtc().millisecondsSinceEpoch;
    final all = <LinguisticNodeDto>[
      ...snapshot.bottlenecks,
      ...snapshot.targetStructures,
      ...snapshot.interestTopics,
    ];
    await _db.transaction(() async {
      await (_db.delete(
        _db.linguisticNodes,
      )..where((t) => t.edition.equals(edition))).go();
      for (final node in all) {
        await _db
            .into(_db.linguisticNodes)
            .insertOnConflictUpdate(
              LinguisticNodesCompanion.insert(
                nodeId: node.nodeId,
                edition: Value<String>(node.edition),
                nodeKind: node.nodeKind,
                canonicalKey: node.canonicalKey,
                displayLabelEn: node.displayLabelEn,
                displayLabelFa: Value<String?>(node.displayLabelFa),
                masteryScoreMilli: Value<int>(node.masteryScoreMilli),
                signalWeightMilli: Value<int>(node.signalWeightMilli),
                evidenceCount: Value<int>(node.evidenceCount),
                lastSeenDaySerial: node.lastSeenDaySerial,
                lastExampleEn: Value<String?>(node.lastExampleEn),
                coachNoteEn: Value<String?>(node.coachNoteEn),
                coachNoteFa: Value<String?>(node.coachNoteFa),
                isPinned: Value<bool>(node.isPinned),
                isMuted: Value<bool>(node.isMuted),
                updatedAtUtcMs: nowMs,
              ),
            );
      }
    });
  }

  /// Reads cached Linguistic Graph snapshot from Drift when offline.
  Future<LinguisticGraphSnapshot> readCachedGraphSnapshot({
    required String edition,
  }) async {
    final rows = await (_db.select(
      _db.linguisticNodes,
    )..where((t) => t.edition.equals(edition))).get();
    LinguisticNodeDto toDto(LinguisticNodeRow row) => LinguisticNodeDto(
      nodeId: row.nodeId,
      edition: row.edition,
      nodeKind: row.nodeKind,
      canonicalKey: row.canonicalKey,
      displayLabelEn: row.displayLabelEn,
      displayLabelFa: row.displayLabelFa,
      masteryScoreMilli: row.masteryScoreMilli,
      signalWeightMilli: row.signalWeightMilli,
      evidenceCount: row.evidenceCount,
      lastSeenDaySerial: row.lastSeenDaySerial,
      lastExampleEn: row.lastExampleEn,
      coachNoteEn: row.coachNoteEn,
      coachNoteFa: row.coachNoteFa,
      isPinned: row.isPinned,
      isMuted: row.isMuted,
    );
    final totalEvidence = rows.fold<int>(0, (s, r) => s + r.evidenceCount);
    return LinguisticGraphSnapshot(
      bottlenecks: rows
          .where((r) => r.nodeKind == 'bottleneck')
          .map<LinguisticNodeDto>(toDto)
          .toList(growable: false),
      targetStructures: rows
          .where((r) => r.nodeKind == 'target_structure')
          .map<LinguisticNodeDto>(toDto)
          .toList(growable: false),
      interestTopics: rows
          .where((r) => r.nodeKind == 'interest_topic')
          .map<LinguisticNodeDto>(toDto)
          .toList(growable: false),
      totalEvidenceCount: totalEvidence,
    );
  }

  /// Caches today's Daily Mission locally.
  Future<void> cacheDailyMission(DailyMissionSnapshot mission) async {
    final nowMs = _clock.now().toUtc().millisecondsSinceEpoch;
    final payloadJson = jsonEncode(<String, Object?>{
      'missionId': mission.missionId,
      'edition': mission.edition,
      'examTrack': mission.examTrack,
      'missionDaySerial': mission.missionDaySerial,
      'status': mission.status,
      'focusTopic': mission.focusTopic,
      'payload': <String, Object?>{
        'promptTitle': mission.promptTitle,
        'promptTextEn': mission.promptTextEn,
        'promptTextFa': mission.promptTextFa,
        'forcedTargets': mission.forcedTargets
            .map(
              (f) => <String, Object?>{
                'canonicalKey': f.canonicalKey,
                'phraseEn': f.phraseEn,
                'hintEn': f.hintEn,
                'hintFa': f.hintFa,
              },
            )
            .toList(growable: false),
      },
      if (mission.feedbackEn != null || mission.feedbackFa != null)
        'evaluationResult': <String, Object?>{
          'feedbackEn': mission.feedbackEn,
          'feedbackFa': mission.feedbackFa,
          'matchedTargets': mission.matchedTargets,
        },
    });
    final evalResultJson =
        (mission.feedbackEn != null || mission.feedbackFa != null)
        ? jsonEncode(<String, Object?>{
            'feedbackEn': mission.feedbackEn,
            'feedbackFa': mission.feedbackFa,
            'matchedTargets': mission.matchedTargets,
          })
        : null;
    await _db
        .into(_db.dailyMissions)
        .insertOnConflictUpdate(
          DailyMissionsCompanion.insert(
            missionId: mission.missionId,
            missionDaySerial: mission.missionDaySerial,
            examTrack: Value<String>(mission.examTrack),
            status: Value<String>(mission.status),
            focusTopic: mission.focusTopic,
            missionPayloadJson: payloadJson,
            resultJson: Value<String?>(evalResultJson),
            updatedAtUtcMs: nowMs,
          ),
        );
  }

  /// Reads cached Daily Mission for today's UTC serial day.
  Future<DailyMissionSnapshot?> readTodayCachedMission() async {
    final today = SerialDay.fromUtcDateTime(_clock.now().toUtc()).value;
    final rows =
        await (_db.select(_db.dailyMissions)
              ..where((t) => t.missionDaySerial.equals(today))
              ..limit(1))
            .get();
    final row = rows.firstOrNull;
    if (row == null) return null;
    final decoded = decodeJsonObjectSafe(row.missionPayloadJson);
    if (decoded.isEmpty) return null;
    if (decoded['evaluationResult'] == null && row.resultJson != null) {
      final evalDecoded = decodeJsonObjectSafe(row.resultJson!);
      if (evalDecoded.isNotEmpty) {
        decoded['evaluationResult'] = evalDecoded;
      }
    }
    return DailyMissionSnapshot.fromJson(decoded);
  }

  /// Marks a cached dropped drill item as completed locally.
  Future<void> markDropCompleted(String dropId) async {
    final nowMs = _clock.now().toUtc().millisecondsSinceEpoch;
    await (_db.update(_db.droppedContents)
          ..where((t) => t.dropId.equals(dropId)))
        .write(DroppedContentsCompanion(completedAtUtcMs: Value<int?>(nowMs)));
  }

  /// Caches a dropped micro-drill item locally.
  Future<void> cacheDroppedContent(DroppedContentDto drop) async {
    final nowMs = _clock.now().toUtc().millisecondsSinceEpoch;
    final phrasesJson = jsonEncode(
      drop.extractedPhrases
          .map(
            (p) => <String, Object?>{
              'headword': p.headword,
              'ipa': p.ipa,
              'definitionEn': p.definitionEn,
              'glossFa': p.glossFa,
              'exampleSentence': p.exampleSentence,
            },
          )
          .toList(growable: false),
    );
    final drillJson = jsonEncode(<String, Object?>{
      'comprehensionPrompt': drop.comprehensionPrompt,
      'comprehensionOptions': drop.comprehensionOptions,
      'correctOptionIndex': drop.correctOptionIndex,
      'clozeSentence': drop.clozeSentence,
      'clozeAnswer': drop.clozeAnswer,
      'shadowingPrompt': drop.shadowingPrompt,
    });
    await _db
        .into(_db.droppedContents)
        .insertOnConflictUpdate(
          DroppedContentsCompanion.insert(
            dropId: drop.dropId,
            inputKind: drop.inputKind,
            title: drop.title,
            sourceLabel: drop.sourceDomainOrLabel,
            cefrEstimate: Value<String>(drop.cefrEstimate),
            extractedPhrasesJson: phrasesJson,
            drillPayloadJson: drillJson,
            createdAtUtcMs: nowMs,
          ),
        );
  }

  /// Reads cached dropped items for offline review.
  Future<List<DroppedContentDto>> listCachedDrops() async {
    final rows =
        await (_db.select(_db.droppedContents)
              ..orderBy(<OrderingTerm Function($DroppedContentsTable)>[
                (t) => OrderingTerm.desc(t.createdAtUtcMs),
              ])
              ..limit(20))
            .get();
    return rows
        .map((row) {
          final phrasesRaw =
              (jsonDecode(row.extractedPhrasesJson) as List<Object?>?) ??
              const <Object?>[];
          final drillRaw = decodeJsonObjectSafe(row.drillPayloadJson);
          return DroppedContentDto.fromJson(<String, Object?>{
            'dropId': row.dropId,
            'inputKind': row.inputKind,
            'sourceDomainOrLabel': row.sourceLabel,
            'title': row.title,
            'cefrEstimate': row.cefrEstimate,
            'extractedPhrases': phrasesRaw,
            'drillPayload': drillRaw,
            'createdAt': DateTime.fromMillisecondsSinceEpoch(
              row.createdAtUtcMs,
              isUtc: true,
            ).toIso8601String(),
          });
        })
        .toList(growable: false);
  }
}

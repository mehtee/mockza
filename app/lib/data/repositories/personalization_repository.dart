import 'dart:convert';

import 'package:clock/clock.dart';
import 'package:drift/drift.dart';
import 'package:meta/meta.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/data/repositories/profile_repository.dart';
import 'package:mockza/services/personalization_gateway.dart';
import 'package:mockza/services/speech_practice_gateway.dart';

/// Summary reported after pulling `/v1/sync/pull` into Drift.
@immutable
class FlutterCrossDeviceSyncSummary {
  /// Creates a [FlutterCrossDeviceSyncSummary].
  const new({
    required this.pulled,
    required this.attemptsMerged,
    required this.vocabStatesMerged,
    required this.pronunciationMerged,
    this.syncedAtIso,
  });

  /// Whether remote pull succeeded.
  final bool pulled;

  /// Number of remote attempts merged into local SQLite.
  final int attemptsMerged;

  /// Number of vocab SRS schedules merged into local SQLite.
  final int vocabStatesMerged;

  /// Number of pronunciation history items cached locally.
  final int pronunciationMerged;

  /// Server sync timestamp ISO string.
  final String? syncedAtIso;
}

/// Offline Drift repository for cached PersonalizationState, Pronunciation history & Cross-Device Sync.
final class PersonalizationRepository {
  /// Creates a [PersonalizationRepository].
  const new({
    required this._db,
    required this._clock,
    required this._profileRepository,
  });

  final AppDatabase _db;
  final Clock _clock;
  final ProfileRepository _profileRepository;

  /// Saves the latest full [PersonalizationStateDto] snapshot locally.
  Future<void> cacheState(PersonalizationStateDto dto) async {
    final nowMs = _clock.now().toUtc().millisecondsSinceEpoch;
    await _db
        .into(_db.personalizationStates)
        .insertOnConflictUpdate(
          PersonalizationStatesCompanion.insert(
            stateKey: 'primary',
            payloadJson: jsonEncode(dto.rawJson),
            updatedAtUtcMs: nowMs,
          ),
        );
  }

  /// Reads the incremental `/v1/sync/pull?since=` cursor ISO timestamp.
  Future<String?> getSyncCursor() async {
    final row = await (_db.select(
      _db.personalizationStates,
    )..where((t) => t.stateKey.equals('sync_cursor'))).getSingleOrNull();
    final iso = row?.payloadJson.trim() ?? '';
    return iso.isNotEmpty ? iso : null;
  }

  /// Persists the incremental `/v1/sync/pull?since=` cursor ISO timestamp.
  Future<void> saveSyncCursor(String iso) async {
    final nowMs = _clock.now().toUtc().millisecondsSinceEpoch;
    await _db
        .into(_db.personalizationStates)
        .insertOnConflictUpdate(
          PersonalizationStatesCompanion.insert(
            stateKey: 'sync_cursor',
            payloadJson: iso,
            updatedAtUtcMs: nowMs,
          ),
        );
  }

  /// Reads preferred Kokoro TTS accent (`us` or `uk`) from local personalization store.
  Future<String> getPreferredTtsAccent() async {
    final row = await (_db.select(
      _db.personalizationStates,
    )..where((t) => t.stateKey.equals('tts_accent'))).getSingleOrNull();
    return row?.payloadJson.trim() == 'uk' ? 'uk' : 'us';
  }

  /// Persists preferred Kokoro TTS accent (`us` or `uk`).
  Future<void> savePreferredTtsAccent(String accent) async {
    final nowMs = _clock.now().toUtc().millisecondsSinceEpoch;
    await _db
        .into(_db.personalizationStates)
        .insertOnConflictUpdate(
          PersonalizationStatesCompanion.insert(
            stateKey: 'tts_accent',
            payloadJson: accent == 'uk' ? 'uk' : 'us',
            updatedAtUtcMs: nowMs,
          ),
        );
  }

  /// Reads the cached [PersonalizationStateDto] if present.
  Future<PersonalizationStateDto?> getCachedState() async {
    final row = await (_db.select(
      _db.personalizationStates,
    )..where((t) => t.stateKey.equals('primary'))).getSingleOrNull();
    if (row == null) return null;
    try {
      final decoded = jsonDecode(row.payloadJson);
      if (decoded is Map<String, Object?>) {
        return PersonalizationStateDto.fromJson(decoded);
      }
      if (decoded is Map) {
        return PersonalizationStateDto.fromJson(
          decoded.cast<String, Object?>(),
        );
      }
    } on Object {
      // Ignore malformed cache JSON.
    }
    return null;
  }

  /// Caches a [PronunciationPracticeItemDto] locally for offline history & replay.
  Future<void> savePronunciationPractice(
    PronunciationPracticeItemDto item,
  ) async {
    final parsedMs = DateTime.tryParse(item.createdAt)?.millisecondsSinceEpoch;
    final createdMs = parsedMs ?? _clock.now().toUtc().millisecondsSinceEpoch;
    await _db
        .into(_db.localPronunciationPractices)
        .insertOnConflictUpdate(
          LocalPronunciationPracticesCompanion.insert(
            practiceId: item.practiceId,
            targetText: item.targetText,
            sourceRefId: Value(item.sourceRefId),
            overallScore: Value(item.overallScore),
            payloadJson: jsonEncode(<String, Object?>{
              'practiceId': item.practiceId,
              'targetText': item.targetText,
              'practiceKind': item.practiceKind,
              'sourceRefType': item.sourceRefType,
              'sourceRefId': item.sourceRefId,
              'objectKey': item.objectKey,
              'audioPlayUrl': item.audioPlayUrl,
              'transcript': item.transcript,
              'accuracyScore': item.accuracyScore,
              'fluencyScore': item.fluencyScore,
              'intonationScore': item.intonationScore,
              'stressScore': item.stressScore,
              'overallScore': item.overallScore,
              'bandImpactLabel': item.bandImpactLabel,
              'summaryEn': item.summaryEn,
              'summaryFa': item.summaryFa,
              'mouthTipEn': item.mouthTipEn,
              'mouthTipFa': item.mouthTipFa,
              'actionableRetryEn': item.actionableRetryEn,
              'actionableRetryFa': item.actionableRetryFa,
              'wordsFeedback': item.wordsFeedback
                  .map(
                    (w) => <String, Object?>{
                      'word': w.word,
                      'status': w.status,
                      'issueType': w.issueType,
                      'ipaTarget': w.ipaTarget,
                      'ipaObserved': w.ipaObserved,
                      'tipEn': w.tipEn,
                      'tipFa': w.tipFa,
                    },
                  )
                  .toList(growable: false),
              'status': item.status,
              'createdAt': item.createdAt,
            }),
            createdAtUtcMs: createdMs,
          ),
        );
  }

  /// Lists locally cached pronunciation practices ordered newest first.
  Future<List<PronunciationPracticeItemDto>> listLocalPronunciationHistory({
    int limit = 20,
  }) async {
    final rows =
        await (_db.select(_db.localPronunciationPractices)
              ..orderBy([
                (t) => OrderingTerm.desc(t.createdAtUtcMs),
              ])
              ..limit(limit))
            .get();
    final out = <PronunciationPracticeItemDto>[];
    for (final row in rows) {
      try {
        final decoded = jsonDecode(row.payloadJson);
        if (decoded is Map) {
          out.add(
            PronunciationPracticeItemDto.fromJson(
              decoded.cast<String, Object?>(),
            ),
          );
        }
      } on Object {
        // Skip invalid cached row.
      }
    }
    return out;
  }

  /// Records a local band event audit row for offline resilience.
  Future<void> recordLocalBandEvent({
    required String eventId,
    required String skill,
    required String sourceKind,
    required double rawScore,
  }) async {
    final nowMs = _clock.now().toUtc().millisecondsSinceEpoch;
    await _db
        .into(_db.localBandEvents)
        .insertOnConflictUpdate(
          LocalBandEventsCompanion.insert(
            eventId: eventId,
            skill: skill,
            sourceKind: sourceKind,
            rawScore: rawScore,
            createdAtUtcMs: nowMs,
          ),
        );
  }

  /// Applies `/v1/sync/pull` remote state into local SQLite cleanly.
  Future<FlutterCrossDeviceSyncSummary> applyCrossDevicePull(
    Map<String, Object?> data,
  ) async {
    var attemptsMerged = 0;
    var vocabMerged = 0;
    var pronMerged = 0;

    final now = _clock.now().toUtc();

    // 1. Merge profile & personalization preferences
    final profileRaw = data['profile'];
    if (profileRaw is Map) {
      final profileMap = profileRaw.cast<String, Object?>();
      final primary = await _profileRepository.loadOrInitializePrimary();
      final favTopics =
          ((profileMap['favoriteTopics'] as List<dynamic>?) ??
                  const <dynamic>[])
              .whereType<String>()
              .toList(growable: false);
      final targetBand =
          (profileMap['targetBand'] as num?)?.toDouble() ?? primary.targetBand;
      final unlockedWave =
          (profileMap['vocabUnlockedWave'] as num?)?.toInt() ??
          primary.vocabUnlockedWave;
      final examTrack =
          (profileMap['examTrack'] as String?) ?? primary.examId;
      final focusRaw = profileMap['studyFocus'] as String?;
      final mappedFocus = focusRaw ?? primary.studyFocus;
      await _profileRepository.saveTargetPreferences(
        deviceId: primary.deviceId,
        targetBand: targetBand,
        examModule: primary.examModule,
        examId: examTrack,
        studyFocus: mappedFocus,
        favoriteTopics: favTopics,
        vocabUnlockedWave: unlockedWave,
      );
      if (profileMap['preferredTtsAccent'] is String) {
        await savePreferredTtsAccent('${profileMap['preferredTtsAccent']}');
      }
      if (profileMap['onboardingCompleted'] == true) {
        await _profileRepository.completeOnboarding(primary.deviceId);
      }
    }

    // 2. Cache personalization state if present
    if (data['liveBand'] is Map && data['roadmap'] is Map) {
      await cacheState(PersonalizationStateDto.fromJson(data));
    }

    // 3. Merge Vocab SRS schedules
    final vocabRaw =
        (data['vocabSrs'] as List<dynamic>?) ?? const <dynamic>[];
    for (final raw in vocabRaw.whereType<Map<dynamic, dynamic>>()) {
      final item = raw.cast<String, Object?>();
      final cardId = '${item['cardId'] ?? ''}';
      if (cardId.isEmpty) continue;
      final existing = await _db.vocabDao.getCardById(cardId);
      if (existing != null) {
        final remoteReps = (item['repetitions'] as num?)?.toInt() ?? 0;
        if (remoteReps >= existing.repetitions) {
          final easeMilli =
              (item['easeFactorMilli'] as num?)?.toInt() ?? 2500;
          await _db.vocabDao.updateSchedule(
            cardId: cardId,
            repetitions: remoteReps,
            intervalDays: (item['intervalDays'] as num?)?.toInt() ?? 0,
            easeFactor: easeMilli / 1000.0,
            easeFactorMilli: easeMilli,
            dueDay:
                (item['dueSerialDay'] as num?)?.toInt() ??
                SerialDay.fromUtcDateTime(now).value,
            updatedAt: now,
          );
          vocabMerged++;
        }
      } else {
        final easeMilli = (item['easeFactorMilli'] as num?)?.toInt() ?? 2500;
        final due =
            (item['dueSerialDay'] as num?)?.toInt() ??
            SerialDay.fromUtcDateTime(now).value;
        final snapRaw = item['cardSnapshotJson'];
        final snap = snapRaw is Map ? snapRaw.cast<String, Object?>() : null;
        final headword = '${snap?['headword'] ?? ''}'.trim();
        final definition = '${snap?['definition'] ?? ''}'.trim();
        await _db.vocabDao.upsertCard(
          VocabCardsCompanion.insert(
            cardId: cardId,
            headword: headword.isNotEmpty ? headword : cardId,
            ipa: Value(snap?['ipa'] as String?),
            definition:
                definition.isNotEmpty ? definition : 'Synced vocabulary card',
            glossFa: Value(snap?['glossFa'] as String?),
            topicTag: '${snap?['topicTag'] ?? 'academic_core'}',
            contextSentence: Value(snap?['contextSentence'] as String?),
            repetitions: Value(
              (item['repetitions'] as num?)?.toInt() ?? 0,
            ),
            intervalDays: Value(
              (item['intervalDays'] as num?)?.toInt() ?? 0,
            ),
            easeFactorMilli: Value(easeMilli),
            dueDay: due,
            dueDaySerial: Value(due),
            createdAt: now,
            updatedAt: now,
          ),
        );
        vocabMerged++;
      }
    }

    // 4. Merge Pronunciation history
    final pronRaw =
        (data['pronunciationPractices'] as List<dynamic>?) ??
        const <dynamic>[];
    for (final raw in pronRaw.whereType<Map<dynamic, dynamic>>()) {
      final dto = PronunciationPracticeItemDto.fromJson(
        raw.cast<String, Object?>(),
      );
      if (dto.practiceId.isNotEmpty) {
        await savePronunciationPractice(dto);
        pronMerged++;
      }
    }

    // 5. Merge Completed Attempts
    final attemptsRaw =
        (data['attempts'] as List<dynamic>?) ?? const <dynamic>[];
    for (final raw in attemptsRaw.whereType<Map<dynamic, dynamic>>()) {
      final item = raw.cast<String, Object?>();
      final attemptId = '${item['attemptId'] ?? ''}';
      if (attemptId.isEmpty) continue;
      final existing = await _db.attemptDao.getAttemptById(attemptId);
      final remoteUpdatedStr = item['updatedAt'] as String?;
      final remoteUpdated =
          (remoteUpdatedStr != null
              ? DateTime.tryParse(remoteUpdatedStr)
              : null) ??
          now;
      if (existing == null || remoteUpdated.isAfter(existing.updatedAt)) {
        await _db
            .into(_db.examAttempts)
            .insertOnConflictUpdate(
              ExamAttemptsCompanion.insert(
                attemptId: attemptId,
                examId: Value('${item['examId'] ?? 'ielts_academic'}'),
                packId: '${item['packId'] ?? ''}',
                skill: '${item['skill'] ?? 'reading'}',
                status: '${item['status'] ?? 'scored'}',
                submissionJson: item['answersJson'] != null
                    ? jsonEncode(item['answersJson'])
                    : (existing?.submissionJson ?? '{}'),
                evaluationJson: Value(
                  item['feedbackJson'] != null
                      ? jsonEncode(item['feedbackJson'])
                      : existing?.evaluationJson,
                ),
                overallBand: Value((item['scoreBand'] as num?)?.toDouble()),
                durationSeconds: Value(
                  (item['durationSeconds'] as num?)?.toInt() ?? 0,
                ),
                usedStudyMode: Value(item['mode'] == 'study'),
                completedAtUtcMs: Value(remoteUpdated.millisecondsSinceEpoch),
                createdAt: existing?.createdAt ?? remoteUpdated,
                updatedAt: remoteUpdated,
              ),
            );
        attemptsMerged++;
      }
    }

    final syncedAt = data['syncedAt'] as String?;
    if (syncedAt != null && syncedAt.isNotEmpty) {
      await saveSyncCursor(syncedAt);
    }

    return FlutterCrossDeviceSyncSummary(
      pulled: true,
      attemptsMerged: attemptsMerged,
      vocabStatesMerged: vocabMerged,
      pronunciationMerged: pronMerged,
      syncedAtIso: syncedAt,
    );
  }
}

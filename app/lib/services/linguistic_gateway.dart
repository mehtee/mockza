import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:meta/meta.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';

/// Persistent habit/skill node inside the user's Linguistic Graph.
@immutable
class LinguisticNodeDto {
  /// Creates a [LinguisticNodeDto].
  const new({
    required this.nodeId,
    required this.edition,
    required this.nodeKind,
    required this.canonicalKey,
    required this.displayLabelEn,
    required this.masteryScoreMilli,
    required this.signalWeightMilli,
    required this.evidenceCount,
    required this.lastSeenDaySerial,
    this.displayLabelFa,
    this.lastExampleEn,
    this.coachNoteEn,
    this.coachNoteFa,
    this.isPinned = false,
    this.isMuted = false,
  });

  /// Parses from API JSON map.
  factory fromJson(Map<String, Object?> json) => LinguisticNodeDto(
    nodeId: '${json['nodeId'] ?? ''}',
    edition: '${json['edition'] ?? 'glb'}',
    nodeKind: '${json['nodeKind'] ?? 'bottleneck'}',
    canonicalKey: '${json['canonicalKey'] ?? ''}',
    displayLabelEn: '${json['displayLabelEn'] ?? ''}',
    displayLabelFa: json['displayLabelFa'] as String?,
    masteryScoreMilli: (json['masteryScoreMilli'] as num?)?.toInt() ?? 400,
    signalWeightMilli: (json['signalWeightMilli'] as num?)?.toInt() ?? 500,
    evidenceCount: (json['evidenceCount'] as num?)?.toInt() ?? 1,
    lastSeenDaySerial: (json['lastSeenDaySerial'] as num?)?.toInt() ?? 0,
    lastExampleEn: json['lastExampleEn'] as String?,
    coachNoteEn: json['coachNoteEn'] as String?,
    coachNoteFa: json['coachNoteFa'] as String?,
    isPinned: json['isPinned'] == true,
    isMuted: json['isMuted'] == true,
  );

  /// Node UUID.
  final String nodeId;

  /// Edition (`glb` or `irn`).
  final String edition;

  /// Kind (`bottleneck`, `target_structure`, or `interest_topic`).
  final String nodeKind;

  /// Canonical classifier key.
  final String canonicalKey;

  /// English label.
  final String displayLabelEn;

  /// Optional Persian label (`irn`).
  final String? displayLabelFa;

  /// Mastery progress `[0..1000]`.
  final int masteryScoreMilli;

  /// Priority weight `[0..1000]`.
  final int signalWeightMilli;

  /// Number of observations.
  final int evidenceCount;

  /// UTC SerialDay of last signal.
  final int lastSeenDaySerial;

  /// Example excerpt.
  final String? lastExampleEn;

  /// English coaching note.
  final String? coachNoteEn;

  /// Persian coaching note.
  final String? coachNoteFa;

  /// Pinned interest toggle.
  final bool isPinned;

  /// Muted interest toggle.
  final bool isMuted;
}

/// Snapshot of user's Linguistic Graph.
@immutable
class LinguisticGraphSnapshot {
  /// Creates a [LinguisticGraphSnapshot].
  const new({
    required this.bottlenecks,
    required this.targetStructures,
    required this.interestTopics,
    required this.totalEvidenceCount,
  });

  /// Parses API JSON payload.
  factory fromJson(Map<String, Object?> json) => LinguisticGraphSnapshot(
    bottlenecks: ((json['bottlenecks'] as List<Object?>?) ?? const <Object?>[])
        .whereType<Map<String, Object?>>()
        .map(LinguisticNodeDto.fromJson)
        .toList(growable: false),
    targetStructures:
        ((json['targetStructures'] as List<Object?>?) ?? const <Object?>[])
            .whereType<Map<String, Object?>>()
            .map(LinguisticNodeDto.fromJson)
            .toList(growable: false),
    interestTopics:
        ((json['interestTopics'] as List<Object?>?) ?? const <Object?>[])
            .whereType<Map<String, Object?>>()
            .map(LinguisticNodeDto.fromJson)
            .toList(growable: false),
    totalEvidenceCount: (json['totalEvidenceCount'] as num?)?.toInt() ?? 0,
  );

  /// Bottleneck nodes.
  final List<LinguisticNodeDto> bottlenecks;

  /// Mastered/active target structures.
  final List<LinguisticNodeDto> targetStructures;

  /// User interest topics.
  final List<LinguisticNodeDto> interestTopics;

  /// Aggregate evidence count.
  final int totalEvidenceCount;
}

/// Forced structure target inside a Daily 10-Min Mission.
@immutable
class ForcedTargetDto {
  /// Creates a [ForcedTargetDto].
  const new({
    required this.canonicalKey,
    required this.phraseEn,
    required this.hintEn,
    this.hintFa,
  });

  /// Parses JSON map.
  factory fromJson(Map<String, Object?> json) => ForcedTargetDto(
    canonicalKey: '${json['canonicalKey'] ?? ''}',
    phraseEn: '${json['phraseEn'] ?? ''}',
    hintEn: '${json['hintEn'] ?? ''}',
    hintFa: json['hintFa'] as String?,
  );

  /// Canonical node key.
  final String canonicalKey;

  /// English phrase to use.
  final String phraseEn;

  /// English coaching hint.
  final String hintEn;

  /// Persian coaching hint (`irn`).
  final String? hintFa;
}

/// Daily 10-Min Transfer Mission snapshot.
@immutable
class DailyMissionSnapshot {
  /// Creates a [DailyMissionSnapshot].
  const new({
    required this.missionId,
    required this.edition,
    required this.examTrack,
    required this.missionDaySerial,
    required this.status,
    required this.focusTopic,
    required this.promptTitle,
    required this.promptTextEn,
    required this.forcedTargets,
    this.promptTextFa,
    this.feedbackEn,
    this.feedbackFa,
    this.matchedTargets = const <String>[],
  });

  /// Parses API JSON payload.
  factory fromJson(Map<String, Object?> json) {
    final payload =
        (json['payload'] as Map<String, Object?>?) ?? const <String, Object?>{};
    final eval = json['evaluationResult'] as Map<String, Object?>?;
    return DailyMissionSnapshot(
      missionId: '${json['missionId'] ?? ''}',
      edition: '${json['edition'] ?? 'glb'}',
      examTrack: '${json['examTrack'] ?? 'ielts_academic'}',
      missionDaySerial: (json['missionDaySerial'] as num?)?.toInt() ?? 0,
      status: '${json['status'] ?? 'ready'}',
      focusTopic: '${json['focusTopic'] ?? 'General'}',
      promptTitle: '${payload['promptTitle'] ?? 'Daily Mission'}',
      promptTextEn: '${payload['promptTextEn'] ?? ''}',
      promptTextFa: payload['promptTextFa'] as String?,
      forcedTargets:
          ((payload['forcedTargets'] as List<Object?>?) ?? const <Object?>[])
              .whereType<Map<String, Object?>>()
              .map(ForcedTargetDto.fromJson)
              .toList(growable: false),
      feedbackEn: eval?['feedbackEn'] as String?,
      feedbackFa: eval?['feedbackFa'] as String?,
      matchedTargets:
          ((eval?['matchedTargets'] as List<Object?>?) ?? const <Object?>[])
              .map((e) => '$e')
              .toList(growable: false),
    );
  }

  /// Mission UUID.
  final String missionId;

  /// Edition (`glb`/`irn`).
  final String edition;

  /// Exam track.
  final String examTrack;

  /// UTC SerialDay.
  final int missionDaySerial;

  /// Status (`ready`, `in_progress`, `completed`, `skipped`).
  final String status;

  /// Focus topic.
  final String focusTopic;

  /// Prompt title.
  final String promptTitle;

  /// English prompt.
  final String promptTextEn;

  /// Persian instruction (`irn`).
  final String? promptTextFa;

  /// Two forced target structures.
  final List<ForcedTargetDto> forcedTargets;

  /// Feedback message in English.
  final String? feedbackEn;

  /// Feedback message in Persian (`irn`).
  final String? feedbackFa;

  /// Matched target strings after completion.
  final List<String> matchedTargets;
}

/// Shift highlight entry for Register Shifter.
@immutable
class RegisterShiftHighlightDto {
  /// Creates a [RegisterShiftHighlightDto].
  const new({
    required this.casualPhrase,
    required this.upgradedPhrase,
    required this.targetGear,
    required this.whyEn,
    this.whyFa,
  });

  /// Parses JSON map.
  factory fromJson(Map<String, Object?> json) => RegisterShiftHighlightDto(
    casualPhrase: '${json['casualPhrase'] ?? ''}',
    upgradedPhrase: '${json['upgradedPhrase'] ?? ''}',
    targetGear: '${json['targetGear'] ?? 'academic'}',
    whyEn: '${json['whyEn'] ?? ''}',
    whyFa: json['whyFa'] as String?,
  );

  /// Original casual phrasing.
  final String casualPhrase;

  /// Upgraded phrase.
  final String upgradedPhrase;

  /// Target register (`workplace` or `academic`).
  final String targetGear;

  /// English rationale.
  final String whyEn;

  /// Persian examiner rationale (`irn`).
  final String? whyFa;
}

/// Register Shifter 3-Gear result.
@immutable
class RegisterShifterResultDto {
  /// Creates a [RegisterShifterResultDto].
  const new({
    required this.runId,
    required this.examTrack,
    required this.sourceTranscript,
    required this.casual,
    required this.workplace,
    required this.academic,
    required this.highlights,
    required this.repeatSentence,
    required this.targetPhrases,
  });

  /// Parses API job result JSON.
  factory fromJson(Map<String, Object?> json) {
    final gears =
        (json['gears'] as Map<String, Object?>?) ?? const <String, Object?>{};
    final rep =
        (json['repeatAloudTarget'] as Map<String, Object?>?) ??
        const <String, Object?>{};
    return RegisterShifterResultDto(
      runId: '${json['runId'] ?? ''}',
      examTrack: '${json['examTrack'] ?? 'ielts_academic'}',
      sourceTranscript: '${json['sourceTranscript'] ?? ''}',
      casual: '${gears['casual'] ?? ''}',
      workplace: '${gears['workplace'] ?? ''}',
      academic: '${gears['academic'] ?? ''}',
      highlights:
          ((json['shiftHighlights'] as List<Object?>?) ?? const <Object?>[])
              .whereType<Map<String, Object?>>()
              .map(RegisterShiftHighlightDto.fromJson)
              .toList(growable: false),
      repeatSentence: '${rep['targetSentence'] ?? gears['academic'] ?? ''}',
      targetPhrases:
          ((rep['targetPhrases'] as List<Object?>?) ?? const <Object?>[])
              .map((e) => '$e')
              .toList(growable: false),
    );
  }

  /// Run UUID.
  final String runId;

  /// Exam track.
  final String examTrack;

  /// Verbatim source transcript.
  final String sourceTranscript;

  /// Gear 0 Casual text.
  final String casual;

  /// Gear 1 Workplace text.
  final String workplace;

  /// Gear 2 Academic text.
  final String academic;

  /// Phrase diff highlights.
  final List<RegisterShiftHighlightDto> highlights;

  /// Target sentence for repeat aloud check.
  final String repeatSentence;

  /// Target phrases for repeat verification.
  final List<String> targetPhrases;
}

/// Extracted phrase inside a dropped item.
@immutable
class DroppedPhraseDto {
  /// Creates a [DroppedPhraseDto].
  const new({
    required this.headword,
    required this.definitionEn,
    required this.exampleSentence,
    this.ipa,
    this.glossFa,
  });

  /// Parses JSON map.
  factory fromJson(Map<String, Object?> json) => DroppedPhraseDto(
    headword: '${json['headword'] ?? ''}',
    ipa: json['ipa'] as String?,
    definitionEn: '${json['definitionEn'] ?? ''}',
    glossFa: json['glossFa'] as String?,
    exampleSentence: '${json['exampleSentence'] ?? ''}',
  );

  /// Expression or headword.
  final String headword;

  /// Optional IPA.
  final String? ipa;

  /// English definition.
  final String definitionEn;

  /// Persian gloss (`irn`).
  final String? glossFa;

  /// Example usage.
  final String exampleSentence;
}

/// Dropped content item & 2-min micro-drill payload.
@immutable
class DroppedContentDto {
  /// Creates a [DroppedContentDto].
  const new({
    required this.dropId,
    required this.inputKind,
    required this.sourceDomainOrLabel,
    required this.title,
    required this.cefrEstimate,
    required this.extractedPhrases,
    required this.comprehensionPrompt,
    required this.comprehensionOptions,
    required this.correctOptionIndex,
    required this.clozeSentence,
    required this.clozeAnswer,
    required this.shadowingPrompt,
    required this.createdAtIso,
  });

  /// Parses API JSON payload.
  factory fromJson(Map<String, Object?> json) {
    final drill =
        (json['drillPayload'] as Map<String, Object?>?) ??
        const <String, Object?>{};
    return DroppedContentDto(
      dropId: '${json['dropId'] ?? ''}',
      inputKind: '${json['inputKind'] ?? 'text'}',
      sourceDomainOrLabel: '${json['sourceDomainOrLabel'] ?? ''}',
      title: '${json['title'] ?? 'Drop Drill'}',
      cefrEstimate: '${json['cefrEstimate'] ?? 'B2'}',
      extractedPhrases:
          ((json['extractedPhrases'] as List<Object?>?) ?? const <Object?>[])
              .whereType<Map<String, Object?>>()
              .map(DroppedPhraseDto.fromJson)
              .toList(growable: false),
      comprehensionPrompt: '${drill['comprehensionPrompt'] ?? ''}',
      comprehensionOptions:
          ((drill['comprehensionOptions'] as List<Object?>?) ??
                  const <Object?>[])
              .map((e) => '$e')
              .toList(growable: false),
      correctOptionIndex: (drill['correctOptionIndex'] as num?)?.toInt() ?? 0,
      clozeSentence: '${drill['clozeSentence'] ?? ''}',
      clozeAnswer: '${drill['clozeAnswer'] ?? ''}',
      shadowingPrompt: '${drill['shadowingPrompt'] ?? ''}',
      createdAtIso: '${json['createdAt'] ?? ''}',
    );
  }

  /// Drop UUID.
  final String dropId;

  /// Input kind.
  final String inputKind;

  /// Source domain or label.
  final String sourceDomainOrLabel;

  /// Title.
  final String title;

  /// CEFR level estimate.
  final String cefrEstimate;

  /// Extracted 3-5 expressions.
  final List<DroppedPhraseDto> extractedPhrases;

  /// Comprehension question.
  final String comprehensionPrompt;

  /// Multiple choice options.
  final List<String> comprehensionOptions;

  /// Index of correct answer.
  final int correctOptionIndex;

  /// Cloze sentence.
  final String clozeSentence;

  /// Cloze target answer.
  final String clozeAnswer;

  /// Shadowing prompt.
  final String shadowingPrompt;

  /// Creation timestamp ISO string.
  final String createdAtIso;
}

/// Abstract gateway for Closed-Loop Linguistic Graph, Daily Missions, Register Shifter, and Drop Anything.
abstract interface class LinguisticGateway {
  /// Fetches `/v1/graph/me`.
  Future<Result<LinguisticGraphSnapshot, Failure>> getMyGraph();

  /// Updates topic pins/mutes via `PATCH /v1/graph/interests`.
  Future<Result<LinguisticGraphSnapshot, Failure>> updateInterests({
    List<String> pinTopics = const <String>[],
    List<String> muteTopics = const <String>[],
  });

  /// Fetches or synthesizes `/v1/missions/today`.
  Future<Result<DailyMissionSnapshot, Failure>> getTodayMission({
    String examTrack = 'ielts_academic',
    List<String> dueWords = const <String>[],
  });

  /// Completes a Daily Mission via `POST /v1/missions/:missionId/complete`.
  Future<Result<DailyMissionSnapshot, Failure>> completeMission({
    required String missionId,
    required String responseText,
  });

  /// Starts a Register Shifter job and returns jobId.
  Future<Result<String, Failure>> enqueueRegisterShift({
    required String objectKey,
    required String examTrack,
    required double durationSeconds,
    String? topicHint,
  });

  /// Verifies repeat-aloud transfer via `POST /v1/register-shifter/:runId/verify-repeat`.
  Future<Result<({int fluencyScore, List<String> matchedTargets}), Failure>>
  verifyRepeatAloud({
    required String runId,
    required int gearLevel,
    required String expectedSentence,
    required List<String> targetPhrases,
    required String objectKey,
  });

  /// Requests presign and uploads bounded Drop media (image/audio).
  Future<Result<String, Failure>> uploadDropMedia({
    required String dropId,
    required String mediaKind,
    required String contentType,
    required Uint8List bytes,
  });

  /// Enqueues `POST /v1/drop/ingest` returning jobId.
  Future<Result<String, Failure>> enqueueDropIngest({
    required String inputKind,
    required String examTrack,
    String? sourceUrl,
    String? rawText,
    List<String>? imageObjectKeys,
    String? audioObjectKey,
    double? durationSeconds,
  });

  /// Lists personal dropped history.
  Future<Result<List<DroppedContentDto>, Failure>> getDropHistory();

  /// Fetches single drop by ID.
  Future<Result<DroppedContentDto, Failure>> getDropById(String dropId);

  /// Polls `GET /v1/jobs/:jobId` for advanced job completion.
  Future<
    Result<({String status, Map<String, Object?>? advancedResult}), Failure>
  >
  pollAdvancedJob(String jobId);
}

/// Live HTTP Dio adapter talking to Mockza/Sanjia `/v1/*` closed-loop endpoints.
final class HttpLinguisticGateway implements LinguisticGateway {
  /// Creates an [HttpLinguisticGateway].
  const new(this._dio);

  final Dio _dio;

  Failure _mapDioFailure(DioException e, String fallback) {
    final code = e.response?.statusCode ?? 0;
    final data = e.response?.data;
    final msg = data is Map<String, Object?> && data['message'] is String
        ? data['message']! as String
        : (e.message ?? fallback);
    if (code == 422 || code == 400) return ValidationFailure(msg);
    if (code == 402 || code == 429) return QuotaExceededFailure(msg);
    if (code == 401 || code == 403) return UnauthorizedFailure(msg);
    return NetworkFailure(msg);
  }

  @override
  Future<Result<LinguisticGraphSnapshot, Failure>> getMyGraph() async {
    try {
      final res = await _dio.get<Map<String, Object?>>('/v1/graph/me');
      return Ok<LinguisticGraphSnapshot, Failure>(
        LinguisticGraphSnapshot.fromJson(res.data ?? const <String, Object?>{}),
      );
    } on DioException catch (e) {
      return Err<LinguisticGraphSnapshot, Failure>(
        _mapDioFailure(e, 'Failed to fetch Linguistic Graph'),
      );
    }
  }

  @override
  Future<Result<LinguisticGraphSnapshot, Failure>> updateInterests({
    List<String> pinTopics = const <String>[],
    List<String> muteTopics = const <String>[],
  }) async {
    try {
      final res = await _dio.patch<Map<String, Object?>>(
        '/v1/graph/interests',
        data: <String, Object?>{
          'pinTopics': pinTopics,
          'muteTopics': muteTopics,
        },
      );
      return Ok<LinguisticGraphSnapshot, Failure>(
        LinguisticGraphSnapshot.fromJson(res.data ?? const <String, Object?>{}),
      );
    } on DioException catch (e) {
      return Err<LinguisticGraphSnapshot, Failure>(
        _mapDioFailure(e, 'Failed to update interests'),
      );
    }
  }

  @override
  Future<Result<DailyMissionSnapshot, Failure>> getTodayMission({
    String examTrack = 'ielts_academic',
    List<String> dueWords = const <String>[],
  }) async {
    try {
      final res = await _dio.get<Map<String, Object?>>(
        '/v1/missions/today',
        queryParameters: <String, Object?>{
          'examTrack': examTrack,
          'dueWords': ?(dueWords.isNotEmpty
              ? dueWords.take(5).join(',')
              : null),
        },
      );
      return Ok<DailyMissionSnapshot, Failure>(
        DailyMissionSnapshot.fromJson(res.data ?? const <String, Object?>{}),
      );
    } on DioException catch (e) {
      return Err<DailyMissionSnapshot, Failure>(
        _mapDioFailure(e, 'Failed to fetch daily mission'),
      );
    }
  }

  @override
  Future<Result<DailyMissionSnapshot, Failure>> completeMission({
    required String missionId,
    required String responseText,
  }) async {
    try {
      final res = await _dio.post<Map<String, Object?>>(
        '/v1/missions/$missionId/complete',
        data: <String, Object?>{'responseText': responseText},
      );
      return Ok<DailyMissionSnapshot, Failure>(
        DailyMissionSnapshot.fromJson(res.data ?? const <String, Object?>{}),
      );
    } on DioException catch (e) {
      return Err<DailyMissionSnapshot, Failure>(
        _mapDioFailure(e, 'Failed to complete daily mission'),
      );
    }
  }

  @override
  Future<Result<String, Failure>> enqueueRegisterShift({
    required String objectKey,
    required String examTrack,
    required double durationSeconds,
    String? topicHint,
  }) async {
    try {
      final trimmedHint = topicHint?.trim();
      final res = await _dio.post<Map<String, Object?>>(
        '/v1/register-shifter/shift',
        data: <String, Object?>{
          'objectKey': objectKey,
          'examTrack': examTrack,
          'durationSeconds': durationSeconds,
          'topicHint': ?(trimmedHint != null && trimmedHint.isNotEmpty
              ? trimmedHint
              : null),
        },
      );
      return Ok<String, Failure>('${res.data?['jobId'] ?? ''}');
    } on DioException catch (e) {
      return Err<String, Failure>(
        _mapDioFailure(e, 'Failed to start Register Shifter'),
      );
    }
  }

  @override
  Future<Result<({int fluencyScore, List<String> matchedTargets}), Failure>>
  verifyRepeatAloud({
    required String runId,
    required int gearLevel,
    required String expectedSentence,
    required List<String> targetPhrases,
    required String objectKey,
  }) async {
    try {
      final res = await _dio.post<Map<String, Object?>>(
        '/v1/register-shifter/$runId/verify-repeat',
        data: <String, Object?>{
          'objectKey': objectKey,
          'gearLevel': gearLevel,
          'expectedSentence': expectedSentence,
          'targetPhrases': targetPhrases,
        },
      );
      final data = res.data ?? const <String, Object?>{};
      return Ok<({int fluencyScore, List<String> matchedTargets}), Failure>((
        fluencyScore: (data['fluencyScore1To5'] as num?)?.toInt() ?? 4,
        matchedTargets:
            ((data['matchedTargets'] as List<Object?>?) ?? const <Object?>[])
                .map((e) => '$e')
                .toList(growable: false),
      ));
    } on DioException catch (e) {
      return Err<({int fluencyScore, List<String> matchedTargets}), Failure>(
        _mapDioFailure(e, 'Failed to verify repeat aloud'),
      );
    }
  }

  @override
  Future<Result<String, Failure>> uploadDropMedia({
    required String dropId,
    required String mediaKind,
    required String contentType,
    required Uint8List bytes,
  }) async {
    try {
      final presignRes = await _dio.post<Map<String, Object?>>(
        '/v1/drop/presign-media',
        data: <String, Object?>{
          'dropId': dropId,
          'mediaKind': mediaKind,
          'files': <Map<String, Object?>>[
            <String, Object?>{
              'contentType': contentType,
              'byteLength': bytes.length,
            },
          ],
        },
      );
      final items =
          (presignRes.data?['items'] as List<Object?>?) ?? const <Object?>[];
      final first = items.isNotEmpty && items.first is Map<String, Object?>
          ? items.first! as Map<String, Object?>
          : null;
      if (first == null) {
        return const Err<String, Failure>(
          NetworkFailure('Presign missing upload slot.'),
        );
      }
      final uploadUrl = '${first['uploadUrl'] ?? ''}';
      final objectKey = '${first['objectKey'] ?? ''}';
      await _dio.put<void>(
        uploadUrl,
        data: Stream<List<int>>.fromIterable(<List<int>>[bytes]),
        options: Options(
          headers: <String, Object?>{
            'Content-Type': contentType,
            'Content-Length': bytes.length,
          },
        ),
      );
      return Ok<String, Failure>(objectKey);
    } on DioException catch (e) {
      return Err<String, Failure>(_mapDioFailure(e, 'Media upload failed'));
    }
  }

  @override
  Future<Result<String, Failure>> enqueueDropIngest({
    required String inputKind,
    required String examTrack,
    String? sourceUrl,
    String? rawText,
    List<String>? imageObjectKeys,
    String? audioObjectKey,
    double? durationSeconds,
  }) async {
    try {
      final res = await _dio.post<Map<String, Object?>>(
        '/v1/drop/ingest',
        data: <String, Object?>{
          'inputKind': inputKind,
          'examTrack': examTrack,
          'sourceUrl': ?sourceUrl,
          'rawText': ?rawText,
          'imageObjectKeys': ?imageObjectKeys,
          'audioObjectKey': ?audioObjectKey,
          'durationSeconds': ?durationSeconds,
        },
      );
      return Ok<String, Failure>('${res.data?['jobId'] ?? ''}');
    } on DioException catch (e) {
      return Err<String, Failure>(_mapDioFailure(e, 'Drop ingest failed'));
    }
  }

  @override
  Future<Result<List<DroppedContentDto>, Failure>> getDropHistory() async {
    try {
      final res = await _dio.get<Map<String, Object?>>('/v1/drop/history');
      final items = (res.data?['items'] as List<Object?>?) ?? const <Object?>[];
      return Ok<List<DroppedContentDto>, Failure>(
        items
            .whereType<Map<String, Object?>>()
            .map(DroppedContentDto.fromJson)
            .toList(growable: false),
      );
    } on DioException catch (e) {
      return Err<List<DroppedContentDto>, Failure>(
        _mapDioFailure(e, 'Failed to fetch drop history'),
      );
    }
  }

  @override
  Future<Result<DroppedContentDto, Failure>> getDropById(String dropId) async {
    try {
      final res = await _dio.get<Map<String, Object?>>('/v1/drop/$dropId');
      return Ok<DroppedContentDto, Failure>(
        DroppedContentDto.fromJson(res.data ?? const <String, Object?>{}),
      );
    } on DioException catch (e) {
      return Err<DroppedContentDto, Failure>(
        _mapDioFailure(e, 'Failed to load drop drill'),
      );
    }
  }

  @override
  Future<
    Result<({String status, Map<String, Object?>? advancedResult}), Failure>
  >
  pollAdvancedJob(String jobId) async {
    try {
      final res = await _dio.get<Map<String, Object?>>('/v1/jobs/$jobId');
      final data = res.data ?? const <String, Object?>{};
      final adv =
          data['advancedResult'] as Map<String, Object?>? ??
          data['result'] as Map<String, Object?>?;
      return Ok<
        ({String status, Map<String, Object?>? advancedResult}),
        Failure
      >((
        status: '${data['status'] ?? 'queued'}',
        advancedResult: adv,
      ));
    } on DioException catch (e) {
      return Err<
        ({String status, Map<String, Object?>? advancedResult}),
        Failure
      >(_mapDioFailure(e, 'Failed to poll job status'));
    }
  }
}

/// Decodes raw JSON strings stored in Drift cleanly.
Map<String, Object?> decodeJsonObjectSafe(String raw) {
  try {
    final decoded = jsonDecode(raw);
    if (decoded is Map<String, Object?>) return decoded;
  } on Object {
    // ignore malformed json
  }
  return const <String, Object?>{};
}

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:meta/meta.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/services/media_bytes_platform.dart';

/// Canonical TTS source contexts synced with `@mockza/contracts`.
enum TtsSourceContext {
  /// Vocabulary cards & collocations.
  vocab('vocab'),

  /// Study-mode reading passage excerpts.
  reading('reading'),

  /// Post-listening evidence playback & shadowing.
  listeningFeedback('listening_feedback'),

  /// Post-speaking AI upgrade playback & shadowing.
  speakingFeedback('speaking_feedback'),

  /// Post-writing AI upgrade playback & shadowing.
  writingFeedback('writing_feedback'),

  /// Daily 10-min coach & register shifter.
  coach('coach'),

  /// Shadow pronunciation studio word/sentence drills.
  pronunciation('pronunciation');

  new(this.wire);

  /// Backend wire literal.
  final String wire;
}

/// Canonical pronunciation practice kinds synced with `@mockza/contracts`.
enum PronunciationPracticeKind {
  /// Single word drill.
  word('word'),

  /// Full sentence / collocation drill.
  sentence('sentence'),

  /// Reading excerpt drill.
  readingExcerpt('reading_excerpt'),

  /// Shadowing AI feedback upgrade.
  feedbackShadow('feedback_shadow');

  new(this.wire);

  /// Backend wire literal.
  final String wire;
}

/// Canonical pronunciation source reference types synced with `@mockza/contracts`.
enum PronunciationSourceRefType {
  /// Linked to a vocabulary card.
  vocabCard('vocab_card'),

  /// Linked to a reading passage.
  readingPassage('reading_passage'),

  /// Linked to listening review feedback.
  listeningFeedback('listening_feedback'),

  /// Linked to writing review feedback.
  writingFeedback('writing_feedback'),

  /// Linked to speaking review feedback.
  speakingFeedback('speaking_feedback'),

  /// Linked to daily coach mission.
  coach('coach'),

  /// Ad-hoc / custom text.
  custom('custom');

  new(this.wire);

  /// Backend wire literal.
  final String wire;
}

/// Paginated pronunciation history payload with remaining daily quota metadata.
@immutable
class PronunciationHistoryPageDto {
  /// Creates a [PronunciationHistoryPageDto].
  const new({
    required this.items,
    this.nextCursor,
    this.remainingDailyQuota,
    this.dailyQuotaLimit,
  });

  /// Fetched pronunciation practice records.
  final List<PronunciationPracticeItemDto> items;

  /// Cursor timestamp for loading the next page.
  final String? nextCursor;

  /// Remaining analyses for today.
  final int? remainingDailyQuota;

  /// Daily pronunciation analysis quota limit.
  final int? dailyQuotaLimit;
}

/// Word-by-word pronunciation assessment entry from Gemini 3.1 Flash Lite.
@immutable
class PronunciationWordFeedbackDto {
  /// Creates a [PronunciationWordFeedbackDto].
  const new({
    required this.word,
    required this.status,
    required this.issueType,
    required this.tipEn,
    this.ipaTarget,
    this.ipaObserved,
    this.tipFa,
  });

  /// Parses from API JSON map.
  factory fromJson(Map<String, Object?> json) => PronunciationWordFeedbackDto(
    word: '${json['word'] ?? ''}',
    status: '${json['status'] ?? 'accurate'}',
    issueType: '${json['issueType'] ?? 'clear'}',
    ipaTarget: json['ipaTarget'] as String?,
    ipaObserved: json['ipaObserved'] as String?,
    tipEn: '${json['tipEn'] ?? ''}',
    tipFa: json['tipFa'] as String?,
  );

  /// Target word.
  final String word;

  /// `accurate`, `needs_work`, or `missing_or_extra`.
  final String status;

  /// Issue classification.
  final String issueType;

  /// Target IPA.
  final String? ipaTarget;

  /// Observed IPA.
  final String? ipaObserved;

  /// English articulatory tip.
  final String tipEn;

  /// Persian articulatory tip (`irn`).
  final String? tipFa;
}

/// Persisted pronunciation analysis record returned by `/v1/pronunciation/*`.
@immutable
class PronunciationPracticeItemDto {
  /// Creates a [PronunciationPracticeItemDto].
  const new({
    required this.practiceId,
    required this.targetText,
    required this.practiceKind,
    required this.status,
    required this.createdAt,
    this.sourceRefType,
    this.sourceRefId,
    this.objectKey,
    this.audioPlayUrl,
    this.transcript,
    this.accuracyScore,
    this.fluencyScore,
    this.intonationScore,
    this.stressScore,
    this.overallScore,
    this.bandImpactLabel,
    this.summaryEn,
    this.summaryFa,
    this.mouthTipEn,
    this.mouthTipFa,
    this.actionableRetryEn,
    this.actionableRetryFa,
    this.wordsFeedback = const <PronunciationWordFeedbackDto>[],
  });

  /// Parses from API JSON map.
  factory fromJson(Map<String, Object?> json) => PronunciationPracticeItemDto(
    practiceId: '${json['practiceId'] ?? ''}',
    targetText: '${json['targetText'] ?? ''}',
    practiceKind: '${json['practiceKind'] ?? 'sentence'}',
    sourceRefType: json['sourceRefType'] as String?,
    sourceRefId: json['sourceRefId'] as String?,
    objectKey: json['objectKey'] as String?,
    audioPlayUrl: json['audioPlayUrl'] as String?,
    transcript: json['transcript'] as String?,
    accuracyScore: (json['accuracyScore'] as num?)?.toInt(),
    fluencyScore: (json['fluencyScore'] as num?)?.toInt(),
    intonationScore: (json['intonationScore'] as num?)?.toInt(),
    stressScore: (json['stressScore'] as num?)?.toInt(),
    overallScore: (json['overallScore'] as num?)?.toInt(),
    bandImpactLabel: json['bandImpactLabel'] as String?,
    summaryEn: json['summaryEn'] as String?,
    summaryFa: json['summaryFa'] as String?,
    mouthTipEn: json['mouthTipEn'] as String?,
    mouthTipFa: json['mouthTipFa'] as String?,
    actionableRetryEn: json['actionableRetryEn'] as String?,
    actionableRetryFa: json['actionableRetryFa'] as String?,
    wordsFeedback:
        ((json['wordsFeedback'] as List<dynamic>?) ?? const <dynamic>[])
            .whereType<Map<String, Object?>>()
            .map(PronunciationWordFeedbackDto.fromJson)
            .toList(growable: false),
    status: '${json['status'] ?? 'completed'}',
    createdAt: '${json['createdAt'] ?? ''}',
  );

  /// Unique practice ID.
  final String practiceId;

  /// Target English phrase/sentence.
  final String targetText;

  /// Practice kind.
  final String practiceKind;

  /// Origin context (`vocab_card`, `reading_passage`, etc.).
  final String? sourceRefType;

  /// Optional linked reference ID.
  final String? sourceRefId;

  /// SeaweedFS/S3 object key.
  final String? objectKey;

  /// Relative authenticated playback URL (`/v1/pronunciation/audio/:id`).
  final String? audioPlayUrl;

  /// Heard transcript.
  final String? transcript;

  /// Phoneme accuracy `0..100`.
  final int? accuracyScore;

  /// Speech smoothness `0..100`.
  final int? fluencyScore;

  /// Pitch/intonation `0..100`.
  final int? intonationScore;

  /// Lexical stress `0..100`.
  final int? stressScore;

  /// Weighted overall score `0..100`.
  final int? overallScore;

  /// Band impact label.
  final String? bandImpactLabel;

  /// English summary.
  final String? summaryEn;

  /// Persian summary.
  final String? summaryFa;

  /// English mouth/tongue position tip.
  final String? mouthTipEn;

  /// Persian mouth/tongue position tip.
  final String? mouthTipFa;

  /// English retry instruction.
  final String? actionableRetryEn;

  /// Persian retry instruction.
  final String? actionableRetryFa;

  /// Word-by-word score breakdown.
  final List<PronunciationWordFeedbackDto> wordsFeedback;

  /// Job status.
  final String status;

  /// ISO creation timestamp.
  final String createdAt;
}

/// Abstract gateway for OpenRouter Kokoro TTS (`/v1/tts/*`) and Pronunciation Practice (`/v1/pronunciation/*`).
abstract interface class SpeechPracticeGateway {
  /// Synthesizes text via backend Kokoro-82m API and caches a playable local audio reference.
  Future<Result<String, Failure>> synthesizeTtsPlayableRef({
    required String text,
    double speed = 1.0,
    String voice = 'af_bella',
    String sourceContext = 'vocab',
  });

  /// Uploads user recording bytes & analyzes pronunciation with Gemini 3.1 Flash Lite.
  Future<Result<PronunciationPracticeItemDto, Failure>> submitPractice({
    required String practiceId,
    required String targetText,
    required String practiceKind,
    required String examTrack,
    required Uint8List audioBytes,
    required String contentType,
    String? sourceRefType,
    String? sourceRefId,
    int? durationMs,
  });

  /// Fetches saved pronunciation recordings & feedbacks from server.
  Future<Result<List<PronunciationPracticeItemDto>, Failure>> listHistory({
    String? sourceRefId,
    int limit = 12,
  });

  /// Fetches paginated pronunciation history + quota counters.
  Future<Result<PronunciationHistoryPageDto, Failure>> listHistoryPage({
    String? sourceRefId,
    int limit = 12,
    String? cursor,
  });

  /// Downloads and caches an authenticated user pronunciation recording locally for replay.
  Future<Result<String, Failure>> fetchPlayableRecordingRef({
    required String practiceId,
    required String relativeAudioPath,
  });
}

/// Concrete Dio implementation hitting `/v1/tts/*` and `/v1/pronunciation/*` (zero local OS TTS).
final class HttpSpeechPracticeGateway implements SpeechPracticeGateway {
  /// Creates an [HttpSpeechPracticeGateway].
  new(this._dio);

  final Dio _dio;
  final Map<String, String> _ttsRefCache = <String, String>{};

  static String _normalizeTtsContext(String raw) => switch (raw.trim()) {
    'vocab' ||
    'reading' ||
    'listening_feedback' ||
    'speaking_feedback' ||
    'writing_feedback' ||
    'coach' ||
    'pronunciation' => raw.trim(),
    'listening' => 'listening_feedback',
    'speaking' => 'speaking_feedback',
    'writing' => 'writing_feedback',
    _ => 'coach',
  };

  static String _normalizePracticeKind(String raw) => switch (raw.trim()) {
    'word' || 'sentence' || 'reading_excerpt' || 'feedback_shadow' => raw.trim(),
    'collocation' => 'sentence',
    _ => 'sentence',
  };

  static String? _normalizeSourceRefType(String? raw) {
    final trimmed = raw?.trim();
    if (trimmed == null || trimmed.isEmpty) return null;
    return switch (trimmed) {
      'vocab_card' ||
      'reading_passage' ||
      'listening_feedback' ||
      'writing_feedback' ||
      'speaking_feedback' ||
      'coach' ||
      'custom' => trimmed,
      'roadmap_step' || 'coach_upgrade' => 'coach',
      _ => 'custom',
    };
  }

  @override
  Future<Result<String, Failure>> synthesizeTtsPlayableRef({
    required String text,
    double speed = 1.0,
    String voice = 'af_bella',
    String sourceContext = 'vocab',
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) {
      return const Err(ValidationFailure('Text cannot be empty'));
    }
    final cacheKey = '$voice|$speed|$trimmed';
    final cached = _ttsRefCache[cacheKey];
    if (cached != null) {
      return Ok(cached);
    }

    try {
      final res = await _dio.post<Map<String, Object?>>(
        '/v1/tts/synthesize',
        data: <String, Object?>{
          'text': trimmed,
          'voice': voice,
          'speed': speed,
          'sourceContext': _normalizeTtsContext(sourceContext),
        },
      );
      final data = res.data ?? const <String, Object?>{};
      final audioUrl = '${data['audioUrl'] ?? ''}';
      final cacheId = '${data['cacheKey'] ?? data['cacheId'] ?? cacheKey.hashCode}';
      final contentType = '${data['contentType'] ?? 'audio/mpeg'}';
      if (audioUrl.isEmpty) {
        return const Err(NetworkFailure('TTS endpoint returned no audioUrl'));
      }

      final binRes = await _dio.get<List<int>>(
        audioUrl,
        options: Options(responseType: ResponseType.bytes),
      );
      final bytes = Uint8List.fromList(binRes.data ?? const <int>[]);
      if (bytes.isEmpty) {
        return const Err(NetworkFailure('TTS audio stream was empty'));
      }

      final persisted = await persistCachedMediaBytes(
        bytes,
        'tts_${cacheId}_$speed',
        mimeType: contentType,
      );
      final playable = await resolveCachedAudioPlayableUrl(
        persisted,
        mimeType: contentType,
      );
      if (playable == null || playable.isEmpty) {
        return const Err(StorageFailure('Unable to cache Kokoro TTS audio'));
      }
      _ttsRefCache[cacheKey] = playable;
      return Ok(playable);
    } on DioException catch (e) {
      return Err(NetworkFailure(e.message ?? 'Kokoro TTS synthesis failed'));
    } on Object catch (e) {
      return Err(NetworkFailure('$e'));
    }
  }

  @override
  Future<Result<PronunciationPracticeItemDto, Failure>> submitPractice({
    required String practiceId,
    required String targetText,
    required String practiceKind,
    required String examTrack,
    required Uint8List audioBytes,
    required String contentType,
    String? sourceRefType,
    String? sourceRefId,
    int? durationMs,
  }) async {
    try {
      final strippedMime = contentType.split(';').first.trim().toLowerCase();
      final effectiveMime = strippedMime.isEmpty ? 'audio/mp4' : strippedMime;
      final presignRes = await _dio.post<Map<String, Object?>>(
        '/v1/pronunciation/presign',
        data: <String, Object?>{
          'practiceId': practiceId,
          'byteLength': audioBytes.lengthInBytes,
          'contentType': effectiveMime,
        },
      );
      final uploadUrl = '${presignRes.data?['uploadUrl'] ?? ''}';
      final objectKey = '${presignRes.data?['objectKey'] ?? ''}';
      if (uploadUrl.isEmpty || objectKey.isEmpty) {
        return const Err(NetworkFailure('Invalid pronunciation presign reply'));
      }

      // Clean Dio PUT without auth headers directly to presigned URL
      final putDio = Dio();
      try {
        await putDio.put<void>(
          uploadUrl,
          data: Stream<Uint8List>.fromIterable(<Uint8List>[audioBytes]),
          options: Options(
            headers: <String, Object?>{
              'content-type': effectiveMime,
              'content-length': audioBytes.lengthInBytes,
            },
          ),
        );
      } finally {
        putDio.close();
      }

      final normalizedRefType = _normalizeSourceRefType(sourceRefType);
      final analyzeRes = await _dio.post<Map<String, Object?>>(
        '/v1/pronunciation/analyze',
        data: <String, Object?>{
          'practiceId': practiceId,
          'targetText': targetText,
          'practiceKind': _normalizePracticeKind(practiceKind),
          'sourceRefType': ?normalizedRefType,
          'sourceRefId': ?sourceRefId,
          'examTrack': examTrack,
          'objectKey': objectKey,
          'durationMs': ?durationMs,
        },
      );
      var payload = analyzeRes.data ?? const <String, Object?>{};
      final status = '${payload['status'] ?? ''}';
      final returnedPracticeId = '${payload['practiceId'] ?? practiceId}';
      if (analyzeRes.statusCode == 202 ||
          status == 'queued' ||
          status == 'processing') {
        for (var attempt = 0; attempt < 15; attempt++) {
          await Future<void>.delayed(const Duration(milliseconds: 1200));
          final pollRes = await _dio.get<Map<String, Object?>>(
            '/v1/pronunciation/${Uri.encodeComponent(returnedPracticeId)}',
          );
          final next = pollRes.data ?? const <String, Object?>{};
          final nextStatus = '${next['status'] ?? ''}';
          if (nextStatus == 'completed') {
            payload = next;
            break;
          }
          if (nextStatus == 'failed') {
            return Err(
              NetworkFailure(
                '${next['errorMessage'] ?? 'Pronunciation analysis failed'}',
              ),
            );
          }
        }
      }
      return Ok(PronunciationPracticeItemDto.fromJson(payload));
    } on DioException catch (e) {
      return Err(NetworkFailure(e.message ?? 'Pronunciation analysis failed'));
    } on Object catch (e) {
      return Err(NetworkFailure('$e'));
    }
  }

  @override
  Future<Result<PronunciationHistoryPageDto, Failure>> listHistoryPage({
    String? sourceRefId,
    int limit = 12,
    String? cursor,
  }) async {
    try {
      final res = await _dio.get<Map<String, Object?>>(
        '/v1/pronunciation/history',
        queryParameters: <String, Object?>{
          'sourceRefId': ?sourceRefId,
          'limit': limit,
          'cursor': ?cursor,
        },
      );
      final data = res.data ?? const <String, Object?>{};
      final raw = (data['items'] as List<dynamic>?) ?? const <dynamic>[];
      return Ok(
        PronunciationHistoryPageDto(
          items: raw
              .whereType<Map<String, Object?>>()
              .map(PronunciationPracticeItemDto.fromJson)
              .toList(growable: false),
          nextCursor: data['nextCursor'] as String?,
          remainingDailyQuota: (data['remainingDailyQuota'] as num?)?.toInt(),
          dailyQuotaLimit: (data['dailyQuotaLimit'] as num?)?.toInt(),
        ),
      );
    } on DioException catch (e) {
      return Err(NetworkFailure(e.message ?? 'Failed to load history'));
    } on Object catch (e) {
      return Err(NetworkFailure('$e'));
    }
  }

  @override
  Future<Result<List<PronunciationPracticeItemDto>, Failure>> listHistory({
    String? sourceRefId,
    int limit = 12,
  }) async {
    final res = await listHistoryPage(sourceRefId: sourceRefId, limit: limit);
    return switch (res) {
      Ok<PronunciationHistoryPageDto, Failure>(:final value) => Ok(value.items),
      Err<PronunciationHistoryPageDto, Failure>(:final failure) => Err(failure),
    };
  }

  @override
  Future<Result<String, Failure>> fetchPlayableRecordingRef({
    required String practiceId,
    required String relativeAudioPath,
  }) async {
    try {
      final binRes = await _dio.get<List<int>>(
        relativeAudioPath,
        options: Options(responseType: ResponseType.bytes),
      );
      final bytes = Uint8List.fromList(binRes.data ?? const <int>[]);
      if (bytes.isEmpty) {
        return const Err(NetworkFailure('Recording audio empty'));
      }
      final persisted = await persistCachedMediaBytes(
        bytes,
        'pron_take_$practiceId',
        mimeType: 'audio/mp4',
      );
      final playable = await resolveCachedAudioPlayableUrl(
        persisted,
        mimeType: 'audio/mp4',
      );
      if (playable == null || playable.isEmpty) {
        return const Err(StorageFailure('Unable to prepare playback'));
      }
      return Ok(playable);
    } on DioException catch (e) {
      return Err(NetworkFailure(e.message ?? 'Failed to fetch recording'));
    } on Object catch (e) {
      return Err(NetworkFailure('$e'));
    }
  }
}

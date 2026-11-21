import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/models/evaluation_models.dart';
import 'package:mockza/core/models/speaking_evaluation.dart';
import 'package:mockza/core/models/user_profile.dart';
import 'package:mockza/core/models/writing_evaluation.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';

/// Unified polling response snapshot returned by `GET /v1/jobs/:jobId`.
@immutable
class JobPollSnapshot {
  /// Creates a [JobPollSnapshot].
  const new({
    required this.jobId,
    required this.attemptId,
    required this.status,
    this.stage,
    this.rawResultJson,
    this.errorCode,
    this.quotaRefunded = false,
  });

  /// Server evaluation job UUID.
  final String jobId;

  /// Attempt UUID associated with this job.
  final String attemptId;

  /// Lifecycle stage (`queued`, `processing_audio`, `transcoding`, `evaluating`,
  /// `repairing`, `completed`, `failed`).
  final String status;

  /// Optional human-readable progress detail from the AI worker.
  final String? stage;

  /// Raw structured evaluation map when `status == 'completed'`.
  final Map<String, Object?>? rawResultJson;

  /// Machine-readable error code when `status == 'failed'`.
  final String? errorCode;

  /// Whether reserved quota credit was refunded on failure.
  final bool quotaRefunded;

  /// Whether job execution is still active.
  bool get isPending => status != 'completed' && status != 'failed';

  /// Parses [rawResultJson] as a [WritingEvaluationResult] when present.
  WritingEvaluationResult? asWritingResult() => rawResultJson != null
      ? HttpGradingGateway.parseWritingEvaluation(rawResultJson!)
      : null;

  /// Parses [rawResultJson] as a [SpeakingEvaluationResult] when present.
  SpeakingEvaluationResult? asSpeakingResult() => rawResultJson != null
      ? HttpGradingGateway.parseSpeakingEvaluation(rawResultJson!)
      : null;
}

/// Gateway contract for presigned audio upload, AI evaluation queuing, and polling.
abstract interface class GradingGateway {
  /// Queues a Writing submission on the remote LangGraph worker and returns a job ID.
  Future<Result<String, Failure>> enqueueWritingEvaluation({
    required String attemptId,
    required String packId,
    required WritingTaskType taskType,
    required String essayText,
    String examId = 'ielts_academic',
    String promptTitle = '',
    String promptBody = '',
    int? durationSeconds,
    int? wordCount,
  });

  /// Checks detailed job stage & result payload for any evaluation job.
  Future<Result<JobPollSnapshot, Failure>> pollJobStatus({
    required String jobId,
  });

  /// Checks whether a remote Writing evaluation job has finished.
  Future<Result<WritingEvaluationResult?, Failure>> pollWritingResult({
    required String jobId,
  });

  /// Requests a presigned S3 / proxy upload URL + object key for a captured speaking audio turn.
  Future<Result<({String uploadUrl, String objectKey}), Failure>>
  presignAudioUpload({
    required String attemptId,
    required int partIndex,
    required int byteLength,
    String? turnId,
    String contentType = 'audio/mp4',
  });

  /// Uploads raw audio clip bytes to a presigned [uploadUrl].
  Future<Result<void, Failure>> uploadAudioBytes({
    required String uploadUrl,
    required List<int> bytes,
    required String contentType,
  });

  /// Queues a Speaking audio turn submission for AI evaluation and returns a job ID.
  Future<Result<String, Failure>> enqueueSpeakingEvaluation({
    required String attemptId,
    required String packId,
    required String audioObjectKey,
    required int partIndex,
    String examId = 'ielts_academic',
    String partSequence = 'full',
    List<
      ({int partIndex, String promptText, String objectKey, int? durationMs})
    >?
    turns,
  });

  /// Checks whether a remote Speaking evaluation job has completed.
  Future<Result<SpeakingEvaluationResult?, Failure>> pollSpeakingResult({
    required String jobId,
  });

  /// Re-queues a terminally failed remote evaluation job (`TD-16`).
  Future<Result<String, Failure>> retryEvaluation({
    required String attemptId,
  });

  /// Explains why an answer was incorrect or addresses learner confusion in Reading/Listening.
  Future<Result<String, Failure>> explainQuestion({
    required String questionId,
    required String learnerAnswer,
    required String correctAnswer,
    required String passageContext,
    String packId = '',
    String packVersion = '1.0.0',
    String skill = 'reading',
    String questionType = 'short_answer',
  });

  /// Fetches the user's remaining AI evaluation quota snapshot.
  Future<Result<QuotaSnapshot, Failure>> fetchQuotaStatus();

  /// Flags a question for editorial/content review.
  Future<Result<void, Failure>> flagQuestion({
    required String packId,
    required String questionId,
    required String reason,
    String? note,
  });
}

/// HTTP [GradingGateway] communicating with `/v1/*` routes via [Dio].
final class HttpGradingGateway implements GradingGateway {
  /// Creates an [HttpGradingGateway].
  const new(this._dio);

  final Dio _dio;

  @override
  Future<Result<String, Failure>> enqueueWritingEvaluation({
    required String attemptId,
    required String packId,
    required WritingTaskType taskType,
    required String essayText,
    String examId = 'ielts_academic',
    String promptTitle = '',
    String promptBody = '',
    int? durationSeconds,
    int? wordCount,
  }) async {
    try {
      final response = await _dio.post<Map<String, Object?>>(
        '/v1/evaluate/writing',
        data: <String, Object?>{
          'attemptId': attemptId,
          'packId': packId,
          'examId': _normalizeBackendExamId(examId),
          'taskType': taskType.name,
          'promptTitle': promptTitle,
          'promptBody': promptBody,
          'essayText': essayText,
          'durationSeconds': ?durationSeconds,
          'wordCount': ?wordCount,
        },
      );
      final jobId = response.data?['jobId'] as String?;
      if (jobId == null || jobId.isEmpty) {
        return const Err(
          ValidationFailure('Missing jobId in evaluation response'),
        );
      }
      return Ok(jobId);
    } on DioException catch (e) {
      return Err(_mapDioException(e));
    }
  }

  @override
  Future<Result<JobPollSnapshot, Failure>> pollJobStatus({
    required String jobId,
  }) async {
    try {
      final response = await _dio.get<Map<String, Object?>>('/v1/jobs/$jobId');
      final data = response.data;
      if (data == null) {
        return const Err(ValidationFailure('Empty job status payload'));
      }

      final status = data['status'] as String? ?? 'queued';
      final resultData = data['result'] as Map<String, Object?>?;
      return Ok(
        JobPollSnapshot(
          jobId: data['jobId'] as String? ?? jobId,
          attemptId: data['attemptId'] as String? ?? '',
          status: status,
          stage: data['stage'] as String?,
          rawResultJson: resultData,
          errorCode: data['errorCode'] as String? ?? data['error'] as String?,
          quotaRefunded: data['quotaRefunded'] as bool? ?? false,
        ),
      );
    } on DioException catch (e) {
      return Err(_mapDioException(e));
    }
  }

  @override
  Future<Result<WritingEvaluationResult?, Failure>> pollWritingResult({
    required String jobId,
  }) async {
    final res = await pollJobStatus(jobId: jobId);
    switch (res) {
      case Err<JobPollSnapshot, Failure>(:final failure):
        return Err(failure);
      case Ok<JobPollSnapshot, Failure>(:final value):
        if (value.isPending) return const Ok(null);
        if (value.status == 'failed') {
          return Err(
            UnexpectedFailure(value.errorCode ?? 'Evaluation worker failed'),
          );
        }
        return Ok(value.asWritingResult());
    }
  }

  @override
  Future<Result<({String uploadUrl, String objectKey}), Failure>>
  presignAudioUpload({
    required String attemptId,
    required int partIndex,
    required int byteLength,
    String? turnId,
    String contentType = 'audio/mp4',
  }) async {
    try {
      final response = await _dio.post<Map<String, Object?>>(
        '/v1/uploads/presign',
        data: <String, Object?>{
          'attemptId': attemptId,
          'partIndex': partIndex,
          if (turnId != null && turnId.isNotEmpty) 'turnId': turnId,
          'byteLength': byteLength,
          'contentType': contentType,
        },
      );
      final data = response.data;
      final uploadUrl = data?['uploadUrl'] as String?;
      final objectKey = data?['objectKey'] as String?;
      if (uploadUrl == null || objectKey == null) {
        return const Err(ValidationFailure('Malformed presign response'));
      }
      return Ok((uploadUrl: uploadUrl, objectKey: objectKey));
    } on DioException catch (e) {
      return Err(_mapDioException(e));
    }
  }

  @override
  Future<Result<void, Failure>> uploadAudioBytes({
    required String uploadUrl,
    required List<int> bytes,
    required String contentType,
  }) async {
    try {
      final headers = <String, Object?>{
        'content-type': contentType,
        if (!kIsWeb) 'content-length': bytes.length,
      };
      await _dio.put<Object?>(
        uploadUrl,
        data: Uint8List.fromList(bytes),
        options: Options(headers: headers),
      );
      return const Ok(null);
    } on DioException catch (e) {
      return Err(_mapDioException(e));
    }
  }

  @override
  Future<Result<String, Failure>> enqueueSpeakingEvaluation({
    required String attemptId,
    required String packId,
    required String audioObjectKey,
    required int partIndex,
    String examId = 'ielts_academic',
    String partSequence = 'full',
    List<
      ({int partIndex, String promptText, String objectKey, int? durationMs})
    >?
    turns,
  }) async {
    try {
      final resolvedTurns =
          turns ??
          <
            ({
              int partIndex,
              String promptText,
              String objectKey,
              int? durationMs,
            })
          >[
            (
              partIndex: partIndex,
              promptText: '',
              objectKey: audioObjectKey,
              durationMs: null,
            ),
          ];
      final response = await _dio.post<Map<String, Object?>>(
        '/v1/evaluate/speaking',
        data: <String, Object?>{
          'attemptId': attemptId,
          'packId': packId,
          'examId': _normalizeBackendExamId(examId),
          'partSequence': _normalizePartSequence(partSequence),
          'turns': resolvedTurns
              .map(
                (t) => <String, Object?>{
                  'partIndex': t.partIndex,
                  'promptText': t.promptText,
                  'objectKey': t.objectKey,
                  if (t.durationMs != null) 'durationMs': t.durationMs,
                },
              )
              .toList(growable: false),
        },
      );
      final jobId = response.data?['jobId'] as String?;
      if (jobId == null || jobId.isEmpty) {
        return const Err(
          ValidationFailure('Missing jobId in evaluation response'),
        );
      }
      return Ok(jobId);
    } on DioException catch (e) {
      return Err(_mapDioException(e));
    }
  }

  @override
  Future<Result<SpeakingEvaluationResult?, Failure>> pollSpeakingResult({
    required String jobId,
  }) async {
    final res = await pollJobStatus(jobId: jobId);
    switch (res) {
      case Err<JobPollSnapshot, Failure>(:final failure):
        return Err(failure);
      case Ok<JobPollSnapshot, Failure>(:final value):
        if (value.isPending) return const Ok(null);
        if (value.status == 'failed') {
          return Err(
            UnexpectedFailure(value.errorCode ?? 'Speaking evaluation failed'),
          );
        }
        return Ok(value.asSpeakingResult());
    }
  }

  @override
  Future<Result<String, Failure>> retryEvaluation({
    required String attemptId,
  }) async {
    try {
      final response = await _dio.post<Map<String, Object?>>(
        '/v1/evaluate/retry',
        data: <String, Object?>{'attemptId': attemptId},
      );
      final jobId = response.data?['jobId'] as String?;
      if (jobId == null || jobId.isEmpty) {
        return const Err(
          ValidationFailure('Missing jobId in retry evaluation response'),
        );
      }
      return Ok(jobId);
    } on DioException catch (e) {
      return Err(_mapDioException(e));
    }
  }

  @override
  Future<Result<String, Failure>> explainQuestion({
    required String questionId,
    required String learnerAnswer,
    required String correctAnswer,
    required String passageContext,
    String packId = '',
    String packVersion = '1.0.0',
    String skill = 'reading',
    String questionType = 'short_answer',
  }) async {
    try {
      final response = await _dio.post<Map<String, Object?>>(
        '/v1/evaluate/explain-question',
        data: <String, Object?>{
          'packId': packId,
          'packVersion': packVersion,
          'questionId': questionId,
          'skill': skill,
          'questionType': questionType,
          'userAnswer': learnerAnswer,
        },
      );
      final data = response.data ?? const <String, Object?>{};
      final explanation = data['explanation'] as String? ?? '';
      final quote = data['evidenceQuote'] as String?;
      final wrong = (data['whyWrongOptions'] as List<dynamic>?) ?? const [];
      final buf = StringBuffer(explanation);
      if (quote != null && quote.isNotEmpty) {
        buf.write('\n\nEvidence quote: "$quote"');
      }
      for (final item in wrong.whereType<Map<String, Object?>>()) {
        final opt = item['option'] as String? ?? '';
        final reason = item['reason'] as String? ?? '';
        if (opt.isNotEmpty && reason.isNotEmpty) {
          buf.write('\n• $opt: $reason');
        }
      }
      return Ok(buf.toString().trim());
    } on DioException catch (e) {
      return Err(_mapDioException(e));
    }
  }

  @override
  Future<Result<QuotaSnapshot, Failure>> fetchQuotaStatus() async {
    try {
      final response = await _dio.get<Map<String, Object?>>('/v1/quota/me');
      final data = response.data ?? const <String, Object?>{};
      final speakingLimit = (data['dailySpeakingLimit'] as num?)?.toInt() ?? 1;
      final speakingUsed = (data['dailySpeakingUsed'] as num?)?.toInt() ?? 0;
      final writingLimit = (data['dailyWritingLimit'] as num?)?.toInt() ?? 1;
      final writingUsed = (data['dailyWritingUsed'] as num?)?.toInt() ?? 0;
      return Ok(
        QuotaSnapshot(
          speakingRemaining: (speakingLimit - speakingUsed).clamp(0, 999),
          writingRemaining: (writingLimit - writingUsed).clamp(0, 999),
          isPro: data['isPro'] as bool? ?? false,
          freeDiagnosticUsed: data['freeDiagnosticUsed'] as bool? ?? false,
          monthlyUsed: (data['monthlyUsed'] as num?)?.toInt() ?? 0,
          monthlyLimit: (data['monthlyLimit'] as num?)?.toInt() ?? 1,
        ),
      );
    } on DioException catch (e) {
      return Err(_mapDioException(e));
    }
  }

  @override
  Future<Result<void, Failure>> flagQuestion({
    required String packId,
    required String questionId,
    required String reason,
    String? note,
  }) async {
    try {
      await _dio.post<void>(
        '/v1/feedback/question-flag',
        data: <String, Object?>{
          'packId': packId,
          'questionId': questionId,
          'reason': reason,
          if (note != null && note.isNotEmpty) 'note': note,
        },
      );
      return const Ok(null);
    } on DioException catch (e) {
      return Err(_mapDioException(e));
    }
  }

  static String _normalizeBackendExamId(String raw) => ExamTrack.fromId(raw).id;

  static String _normalizePartSequence(String raw) => switch (raw.trim()) {
    'part_1' || 'part1' => 'part1',
    'part_2' || 'part2' => 'part2',
    'part_3' || 'part3' => 'part3',
    'part_4' || 'part4' => 'part4',
    'diagnostic' => 'diagnostic',
    _ => 'full',
  };

  static List<CriterionScore> _parseCriteria(
    Object? raw, {
    required String fallbackCode,
    required String fallbackLabel,
  }) {
    if (raw is List<dynamic>) {
      return raw
          .whereType<Map<String, Object?>>()
          .map((m) {
            return CriterionScore(
              criterionCode:
                  (m['code'] as String?) ??
                  (m['criterionCode'] as String?) ??
                  fallbackCode,
              criterionLabel:
                  (m['label'] as String?) ??
                  (m['criterionLabel'] as String?) ??
                  fallbackLabel,
              band: (m['band'] as num?)?.toDouble() ?? 6.0,
              evidenceExcerpt: m['evidenceExcerpt'] as String? ?? '',
              feedbackNote: m['feedbackNote'] as String? ?? '',
            );
          })
          .toList(growable: false);
    }
    if (raw is Map<String, Object?>) {
      return raw.entries
          .map(
            (e) => CriterionScore(
              criterionCode: e.key,
              criterionLabel: e.key,
              band: (e.value as num?)?.toDouble() ?? 6.0,
              evidenceExcerpt: '',
              feedbackNote: '',
            ),
          )
          .toList(growable: false);
    }
    return const <CriterionScore>[];
  }

  static List<VocabUpgrade> _parseVocabUpgrades(List<dynamic> raw) => raw
      .whereType<Map<String, Object?>>()
      .map((m) {
        final paraphrases =
            (m['paraphrases'] as List<dynamic>?)?.map((e) => '$e').toList() ??
            const <String>[];
        return VocabUpgrade(
          original:
              (m['original'] as String?) ??
              (paraphrases.isNotEmpty ? paraphrases.first : 'generic phrase'),
          upgraded: (m['upgraded'] as String?) ?? (m['term'] as String?) ?? '',
          definition: m['definition'] as String? ?? '',
          glossFa: m['glossFa'] as String?,
          collocation:
              (m['collocation'] as String?) ??
              (m['contextSentence'] as String?) ??
              '',
        );
      })
      .toList(growable: false);

  static RecommendedDrill? _parseRecommendedDrill(Object? raw) {
    if (raw is! Map<String, Object?>) return null;
    final drillId =
        (raw['drillId'] as String?) ?? (raw['drillType'] as String?) ?? '';
    final weakness =
        (raw['weaknessCode'] as String?) ??
        (raw['weakestCriterionCode'] as String?) ??
        '';
    final title = raw['title'] as String? ?? '';
    if (drillId.isEmpty && title.isEmpty) return null;
    return RecommendedDrill(
      drillId: drillId,
      weaknessCode: weakness,
      title: title,
      durationMinutes: (raw['durationMinutes'] as num?)?.toInt() ?? 3,
    );
  }

  /// Parses an AI worker evaluation map into a domain [WritingEvaluationResult].
  static WritingEvaluationResult parseWritingEvaluation(
    Map<String, Object?> json,
  ) {
    final criteria = _parseCriteria(
      json['criteria'],
      fallbackCode: 'TR',
      fallbackLabel: 'Task Response',
    );
    final inlineEdits = ((json['inlineEdits'] as List<dynamic>?) ?? const [])
        .whereType<Map<String, Object?>>()
        .map((m) {
          return EssayInlineEdit(
            editId: m['editId'] as String? ?? '',
            startOffset: (m['startOffset'] as num?)?.toInt() ?? 0,
            endOffset: (m['endOffset'] as num?)?.toInt() ?? 0,
            originalText: m['originalText'] as String? ?? '',
            suggestedText: m['suggestedText'] as String? ?? '',
            criterionCode: m['criterionCode'] as String? ?? 'LR',
            rationale: m['rationale'] as String? ?? '',
          );
        })
        .toList(growable: false);

    final rawRewrite = json['modelRewrite'];
    final modelRewrite = switch (rawRewrite) {
      final String s => s,
      final Map<String, Object?> m => m['rewrittenText'] as String?,
      _ => null,
    };

    final taskTypeName = json['taskType'] as String? ?? 'task2Essay';
    final taskType = WritingTaskType.values.firstWhere(
      (t) => t.name == taskTypeName,
      orElse: () => WritingTaskType.task2Essay,
    );

    return WritingEvaluationResult(
      attemptId: json['attemptId'] as String? ?? '',
      taskType: taskType,
      overallBand: (json['overallBand'] as num?)?.toDouble() ?? 6.0,
      criteria: criteria,
      wordCount: (json['wordCount'] as num?)?.toInt() ?? 0,
      upgradedExcerpt:
          (json['upgradedExcerpt'] as String?) ?? modelRewrite ?? '',
      actionableNextStep: json['actionableNextStep'] as String? ?? '',
      modelId: json['modelId'] as String? ?? 'mockza-eval-v1',
      rubricVersion: json['rubricVersion'] as String? ?? '2026.1',
      inlineEdits: inlineEdits,
      modelRewrite: modelRewrite,
      vocabUpgrades: _parseVocabUpgrades(
        (json['vocabUpgrades'] as List<dynamic>?) ?? const [],
      ),
      recommendedDrill: _parseRecommendedDrill(json['recommendedDrill']),
      isEstimated: json['isEstimated'] as bool? ?? true,
    );
  }

  /// Parses an AI worker evaluation map into a domain [SpeakingEvaluationResult].
  static SpeakingEvaluationResult parseSpeakingEvaluation(
    Map<String, Object?> json,
  ) {
    final criteria = _parseCriteria(
      json['criteria'],
      fallbackCode: 'FC',
      fallbackLabel: 'Fluency & Coherence',
    );
    final segments =
        ((json['transcriptSegments'] as List<dynamic>?) ?? const [])
            .whereType<Map<String, Object?>>()
            .map((m) {
              final rawAnnotations =
                  (m['annotations'] as List<dynamic>?) ?? const [];
              final annotations = rawAnnotations
                  .whereType<Map<String, Object?>>()
                  .map((am) {
                    final kindName =
                        (am['kind'] as String?) ??
                        (am['type'] as String?) ??
                        'phrasing';
                    final kind = SpeechAnnotationKind.values.firstWhere(
                      (k) => k.name == kindName,
                      orElse: () => SpeechAnnotationKind.phrasing,
                    );
                    return SpokenAnnotation(
                      kind: kind,
                      startOffset: (am['startOffset'] as num?)?.toInt() ?? 0,
                      endOffset: (am['endOffset'] as num?)?.toInt() ?? 0,
                      originalText: am['originalText'] as String? ?? '',
                      suggestion: am['suggestion'] as String? ?? '',
                      rationale: am['rationale'] as String? ?? '',
                    );
                  })
                  .toList(growable: false);

              final startSec =
                  (m['startSec'] as num?)?.toDouble() ??
                  (((m['startMs'] as num?)?.toDouble() ?? 0.0) / 1000.0);
              final endSec =
                  (m['endSec'] as num?)?.toDouble() ??
                  (((m['endMs'] as num?)?.toDouble() ?? 0.0) / 1000.0);

              return SpokenTranscriptSegment(
                segmentId: m['segmentId'] as String? ?? '',
                speaker:
                    m['speaker'] as String? ?? 'Part ${m['partIndex'] ?? '2'}',
                text: m['text'] as String? ?? '',
                startSec: startSec,
                endSec: endSec,
                annotations: annotations,
              );
            })
            .toList(growable: false);

    final transcriptCombined = segments.map((s) => s.text).join(' ').trim();

    return SpeakingEvaluationResult(
      attemptId: json['attemptId'] as String? ?? '',
      overallBand: (json['overallBand'] as num?)?.toDouble() ?? 6.0,
      criteria: criteria,
      transcript: (json['transcript'] as String?) ?? transcriptCombined,
      actionableNextStep: json['actionableNextStep'] as String? ?? '',
      modelId: json['modelId'] as String? ?? 'mockza-eval-v1',
      rubricVersion: json['rubricVersion'] as String? ?? '2026.1',
      transcriptSegments: segments,
      vocabUpgrades: _parseVocabUpgrades(
        (json['vocabUpgrades'] as List<dynamic>?) ?? const [],
      ),
      recommendedDrill: _parseRecommendedDrill(json['recommendedDrill']),
      isEstimated: json['isEstimated'] as bool? ?? true,
    );
  }

  Failure _mapDioException(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return const TimeoutFailure('Evaluation request timed out');
    }
    final status = e.response?.statusCode;
    final data = e.response?.data;
    final serverMessage = data is Map<String, Object?>
        ? data['message'] as String?
        : null;
    if (status == 401 || status == 403) {
      return UnauthorizedFailure(
        serverMessage ?? 'Device credential rejected',
      );
    }
    if (status == 402) {
      return EntitlementRequiredFailure(
        serverMessage ?? 'Pro subscription required for this feature',
      );
    }
    if (status == 429) {
      return QuotaExceededFailure(
        serverMessage ?? 'Daily evaluation quota reached',
      );
    }
    if (status == 400 || status == 404) {
      return ValidationFailure(
        serverMessage ?? 'Invalid request ($status)',
      );
    }
    return NetworkFailure(
      serverMessage ?? 'Evaluation transport error',
      statusCode: status,
    );
  }
}

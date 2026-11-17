import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';

/// Worked example payload delivered inside a diagnostic bank.
@immutable
class DiagnosticWorkedExampleSnapshot {
  /// Creates a [DiagnosticWorkedExampleSnapshot].
  const new({
    required this.skill,
    required this.passageOrTranscript,
    required this.questionPrompt,
    required this.options,
    required this.correctIndex,
    required this.explanation,
    this.mediaUrl,
  });

  /// Skill (`reading` or `listening`).
  final String skill;

  /// Sample passage or audio transcript.
  final String passageOrTranscript;

  /// Sample audio path for listening example.
  final String? mediaUrl;

  /// Sample question text.
  final String questionPrompt;

  /// Three concise sample choices.
  final List<String> options;

  /// Correct zero-based option index.
  final int correctIndex;

  /// Short learner explanation.
  final String explanation;
}

/// Official-scale descriptive entry shown under "About your exam's scores".
@immutable
class DiagnosticExamScaleInfo {
  /// Creates a [DiagnosticExamScaleInfo].
  const new({
    required this.examId,
    required this.label,
    required this.summary,
  });

  /// Exam identifier.
  final String examId;

  /// Human-readable exam title.
  final String label;

  /// Verified scale summary (never claims Mockza prediction equivalence).
  final String summary;
}

/// Diagnostic Writing prompt + supportive/extension follow-ups.
@immutable
class DiagnosticWritingPromptSpec {
  /// Creates a [DiagnosticWritingPromptSpec].
  const new({
    required this.promptId,
    required this.title,
    required this.basePrompt,
    required this.suggestedWordsLabel,
    required this.supportiveFollowUp,
    required this.extensionFollowUp,
  });

  /// Prompt identifier.
  final String promptId;

  /// Prompt card title.
  final String title;

  /// Base short prompt text.
  final String basePrompt;

  /// Plain-English length guidance.
  final String suggestedWordsLabel;

  /// Supportive follow-up for brief or help-requested responses.
  final String supportiveFollowUp;

  /// Extension follow-up for additional sampling.
  final String extensionFollowUp;
}

/// Diagnostic Speaking prompt + cue bullets + follow-ups.
@immutable
class DiagnosticSpeakingPromptSpec {
  /// Creates a [DiagnosticSpeakingPromptSpec].
  const new({
    required this.promptId,
    required this.title,
    required this.basePrompt,
    required this.cueLabels,
    required this.supportiveFollowUp,
    required this.extensionFollowUp,
  });

  /// Prompt identifier.
  final String promptId;

  /// Prompt card title.
  final String title;

  /// Spoken base prompt.
  final String basePrompt;

  /// Short beginner cue tags (`Place · What you do · Why`).
  final List<String> cueLabels;

  /// Supportive follow-up prompt.
  final String supportiveFollowUp;

  /// Extension follow-up prompt.
  final String extensionFollowUp;
}

/// Full rapid diagnostic content bank fetched from `/v1/diagnostic/packs`.
@immutable
class DiagnosticBankSnapshot {
  /// Creates a [DiagnosticBankSnapshot].
  const new({
    required this.policyVersion,
    required this.contentVersion,
    required this.preflightAudioUrl,
    required this.workedReading,
    required this.workedListening,
    required this.readingBlocks,
    required this.listeningBlocks,
    required this.writingPrompt,
    required this.speakingPrompt,
    required this.examScaleInfo,
  });

  /// Routing policy version.
  final String policyVersion;

  /// Content bundle version.
  final String contentVersion;

  /// Relative media path for preflight audio playback test.
  final String preflightAudioUrl;

  /// Worked example for Reading.
  final DiagnosticWorkedExampleSnapshot workedReading;

  /// Worked example for Listening.
  final DiagnosticWorkedExampleSnapshot workedListening;

  /// Adaptive Reading micro-block pool (`A1`..`C2`).
  final List<DiagnosticBlockDef> readingBlocks;

  /// Adaptive Listening micro-block pool (`A1`..`C2`).
  final List<DiagnosticBlockDef> listeningBlocks;

  /// Diagnostic Writing task spec.
  final DiagnosticWritingPromptSpec writingPrompt;

  /// Diagnostic Speaking task spec.
  final DiagnosticSpeakingPromptSpec speakingPrompt;

  /// Reference scale notes for supported exams.
  final List<DiagnosticExamScaleInfo> examScaleInfo;
}

/// Per-skill placement status & observation snapshot returned by backend.
@immutable
class DiagnosticSkillOutcomeSnapshot {
  /// Creates a [DiagnosticSkillOutcomeSnapshot].
  const new({
    required this.skill,
    required this.status,
    required this.observations,
    this.suggestedPracticeLevel,
    this.suggestedTier,
    this.weaknessFocus,
    this.recommendedDrillType,
    this.jobId,
    this.attemptId,
    this.errorCode,
    this.quotaRefunded = false,
    this.reducedSampling = false,
    this.hasContradictoryEvidence = false,
    this.stopReason,
  });

  /// Parses wire JSON object into [DiagnosticSkillOutcomeSnapshot].
  factory fromJson(Map<String, Object?> json) {
    final obsRaw =
        (json['observations'] as List<dynamic>?) ?? const <dynamic>[];
    final tierStr = json['suggestedTier'] as String?;
    return DiagnosticSkillOutcomeSnapshot(
      skill: json['skill'] as String? ?? 'reading',
      status: DiagnosticSkillStatus.fromWire(
        json['status'] as String? ?? 'insufficient_evidence',
      ),
      suggestedPracticeLevel: json['suggestedPracticeLevel'] as String?,
      suggestedTier: tierStr != null ? AuthoringTier.fromCode(tierStr) : null,
      observations: obsRaw.whereType<String>().toList(growable: false),
      weaknessFocus: json['weaknessFocus'] as String?,
      recommendedDrillType: json['recommendedDrillType'] as String?,
      jobId: json['jobId'] as String?,
      attemptId: json['attemptId'] as String?,
      errorCode: json['errorCode'] as String?,
      quotaRefunded: json['quotaRefunded'] as bool? ?? false,
      reducedSampling: json['reducedSampling'] as bool? ?? false,
      hasContradictoryEvidence:
          json['hasContradictoryEvidence'] as bool? ?? false,
      stopReason: DiagnosticStopReason.tryFromWire(
        json['stopReason'] as String?,
      ),
    );
  }

  /// Skill (`reading`, `listening`, `writing`, `speaking`).
  final String skill;

  /// Reporting status (`provisional`, `pending`, `insufficient_evidence`, `unscorable`, `failed`, `skipped`).
  final DiagnosticSkillStatus status;

  /// Broad provisional practice suggestion label (or `null`).
  final String? suggestedPracticeLevel;

  /// Broad tier hint (`A1`..`C2`, or `null`).
  final AuthoringTier? suggestedTier;

  /// 1–2 concise evidence observations.
  final List<String> observations;

  /// Optional weakness focus label.
  final String? weaknessFocus;

  /// Recommended follow-up drill type identifier.
  final String? recommendedDrillType;

  /// Remote worker job ID when Writing/Speaking async grading ran.
  final String? jobId;

  /// Attempt UUID linked to Writing/Speaking job.
  final String? attemptId;

  /// Machine-readable error code when [status] is `failed` or `unscorable`.
  final String? errorCode;

  /// Whether quota credit was refunded on failure.
  final bool quotaRefunded;

  /// Whether fewer than standard target blocks were collected.
  final bool reducedSampling;

  /// Whether conflicting tier outcomes were observed.
  final bool hasContradictoryEvidence;

  /// Explicit stop reason for Reading/Listening.
  final DiagnosticStopReason? stopReason;
}

/// Unified 4-skill diagnostic session status & result payload.
@immutable
class DiagnosticSessionSnapshot {
  /// Creates a [DiagnosticSessionSnapshot].
  const new({
    required this.diagId,
    required this.examId,
    required this.mode,
    required this.policyVersion,
    required this.contentVersion,
    required this.status,
    required this.startedAtIso,
    required this.collectionDeadlineAtIso,
    required this.resultsDeadlineAtIso,
    required this.resultRevision,
    required this.reading,
    required this.listening,
    required this.writing,
    required this.speaking,
    required this.recommendedActionTitle,
    required this.recommendedActionDescription,
    this.recommendedDrillType,
    this.recommendedTargetSkill,
  });

  /// Parses wire JSON response into [DiagnosticSessionSnapshot].
  factory fromJson(Map<String, Object?> json) {
    final skills =
        (json['skills'] as Map<String, Object?>?) ?? const <String, Object?>{};
    final rec =
        (json['recommendedFirstAction'] as Map<String, Object?>?) ??
        const <String, Object?>{};
    return DiagnosticSessionSnapshot(
      diagId: json['diagId'] as String? ?? '',
      examId: json['examId'] as String? ?? 'ielts_academic',
      mode: DiagnosticMode.fromWire(json['mode'] as String? ?? 'standard'),
      policyVersion: json['policyVersion'] as String? ?? '',
      contentVersion: json['contentVersion'] as String? ?? '',
      status: json['status'] as String? ?? 'in_progress',
      startedAtIso: json['startedAt'] as String? ?? '',
      collectionDeadlineAtIso: json['collectionDeadlineAt'] as String? ?? '',
      resultsDeadlineAtIso: json['resultsDeadlineAt'] as String? ?? '',
      resultRevision: (json['resultRevision'] as num?)?.toInt() ?? 1,
      reading: DiagnosticSkillOutcomeSnapshot.fromJson(
        (skills['reading'] as Map<String, Object?>?) ??
            const <String, Object?>{'skill': 'reading'},
      ),
      listening: DiagnosticSkillOutcomeSnapshot.fromJson(
        (skills['listening'] as Map<String, Object?>?) ??
            const <String, Object?>{'skill': 'listening'},
      ),
      writing: DiagnosticSkillOutcomeSnapshot.fromJson(
        (skills['writing'] as Map<String, Object?>?) ??
            const <String, Object?>{'skill': 'writing'},
      ),
      speaking: DiagnosticSkillOutcomeSnapshot.fromJson(
        (skills['speaking'] as Map<String, Object?>?) ??
            const <String, Object?>{'skill': 'speaking'},
      ),
      recommendedActionTitle:
          rec['title'] as String? ?? 'Explore starter practice',
      recommendedActionDescription: rec['description'] as String? ?? '',
      recommendedDrillType: rec['drillType'] as String?,
      recommendedTargetSkill: rec['targetSkill'] as String?,
    );
  }

  /// Diagnostic session UUID.
  final String diagId;

  /// Exam goal identifier.
  final String examId;

  /// Diagnostic timing/accessibility mode.
  final DiagnosticMode mode;

  /// Policy version frozen for this attempt.
  final String policyVersion;

  /// Content version frozen for this attempt.
  final String contentVersion;

  /// Session status (`in_progress`, `submitted`, `completed`, `abandoned`).
  final String status;

  /// ISO start timestamp.
  final String startedAtIso;

  /// ISO 540s collection deadline.
  final String collectionDeadlineAtIso;

  /// ISO 600s results window deadline.
  final String resultsDeadlineAtIso;

  /// Monotonic server result revision counter.
  final int resultRevision;

  /// Reading placement outcome.
  final DiagnosticSkillOutcomeSnapshot reading;

  /// Listening placement outcome.
  final DiagnosticSkillOutcomeSnapshot listening;

  /// Writing placement outcome.
  final DiagnosticSkillOutcomeSnapshot writing;

  /// Speaking placement outcome.
  final DiagnosticSkillOutcomeSnapshot speaking;

  /// Recommended first drill/action headline.
  final String recommendedActionTitle;

  /// Supporting recommendation explanation.
  final String recommendedActionDescription;

  /// Drill type key if one was established.
  final String? recommendedDrillType;

  /// Target skill name if a weakness was identified.
  final String? recommendedTargetSkill;

  /// Whether Writing or Speaking evaluation is still running remotely.
  bool get hasPendingWork =>
      writing.status == DiagnosticSkillStatus.pending ||
      speaking.status == DiagnosticSkillStatus.pending;
}

/// Network gateway for the 4-skill rapid diagnostic endpoints.
abstract interface class DiagnosticGateway {
  /// Fetches the rapid diagnostic scenario bank & worked examples.
  Future<Result<DiagnosticBankSnapshot, Failure>> fetchDiagnosticBank({
    bool alternateForm = false,
  });

  /// Creates or resumes a server-persisted diagnostic session.
  Future<Result<DiagnosticSessionSnapshot, Failure>> createOrResumeSession({
    required String diagId,
    required String examId,
    required DiagnosticMode mode,
    String? selectionSeed,
  });

  /// Submits completed/partial objective blocks and productive Writing/Speaking responses.
  Future<Result<DiagnosticSessionSnapshot, Failure>> submitSession({
    required String diagId,
    required String examId,
    required DiagnosticMode mode,
    required List<BlockAttemptRecord> readingHistory,
    required DiagnosticStopReason? readingStopReason,
    required bool readingSkipped,
    required List<BlockAttemptRecord> listeningHistory,
    required DiagnosticStopReason? listeningStopReason,
    required bool listeningSkipped,
    String? writingAttemptId,
    String? writingPromptTitle,
    String? writingBasePrompt,
    String? writingFollowUpPrompt,
    String? writingBaseResponse,
    String? writingFollowUpResponse,
    bool writingSkipped = false,
    String? speakingAttemptId,
    String? speakingBasePrompt,
    String? speakingFollowUpPrompt,
    List<
          ({
            int partIndex,
            String promptText,
            String objectKey,
            int? durationMs,
          })
        >
        speakingTurns =
        const [],
    bool speakingSkipped = false,
    NoEvidenceReason? speakingNoEvidenceReason,
  });

  /// Polls live 4-skill aggregated diagnostic state.
  Future<Result<DiagnosticSessionSnapshot, Failure>> fetchSession({
    required String diagId,
  });

  /// Retakes one single skill on an existing session while preserving the other three.
  Future<Result<DiagnosticSessionSnapshot, Failure>> retakeSingleSkill({
    required String diagId,
    required String skill,
    List<BlockAttemptRecord>? readingHistory,
    DiagnosticStopReason? readingStopReason,
    List<BlockAttemptRecord>? listeningHistory,
    DiagnosticStopReason? listeningStopReason,
    String? writingAttemptId,
    String? writingPromptTitle,
    String? writingBasePrompt,
    String? writingFollowUpPrompt,
    String? writingBaseResponse,
    String? writingFollowUpResponse,
    String? speakingAttemptId,
    String? speakingBasePrompt,
    String? speakingFollowUpPrompt,
    List<
      ({int partIndex, String promptText, String objectKey, int? durationMs})
    >?
    speakingTurns,
  });
}

/// Live Dio implementation backed by `/v1/diagnostic/*`.
final class HttpDiagnosticGateway implements DiagnosticGateway {
  /// Creates an [HttpDiagnosticGateway].
  const new(this._dio);

  final Dio _dio;

  @override
  Future<Result<DiagnosticBankSnapshot, Failure>> fetchDiagnosticBank({
    bool alternateForm = false,
  }) async {
    try {
      final response = await _dio.get<Map<String, Object?>>(
        '/v1/diagnostic/packs',
        queryParameters: alternateForm
            ? const <String, Object?>{'form': 'alternate'}
            : null,
      );
      final data = response.data;
      if (data == null) {
        return const Err(NetworkFailure('Empty diagnostic bank response'));
      }
      final worked =
          (data['workedExamples'] as Map<String, Object?>?) ??
          const <String, Object?>{};
      final wp =
          (data['writingPrompt'] as Map<String, Object?>?) ??
          const <String, Object?>{};
      final sp =
          (data['speakingPrompt'] as Map<String, Object?>?) ??
          const <String, Object?>{};

      return Ok(
        DiagnosticBankSnapshot(
          policyVersion: data['policyVersion'] as String? ?? '',
          contentVersion: data['contentVersion'] as String? ?? '',
          preflightAudioUrl:
              data['preflightAudioUrl'] as String? ??
              '/v1/media/media/listening/diagnostic/preflight_check.m4a',
          workedReading: _parseWorkedExample(
            (worked['reading'] as Map<String, Object?>?) ??
                const <String, Object?>{},
            'reading',
          ),
          workedListening: _parseWorkedExample(
            (worked['listening'] as Map<String, Object?>?) ??
                const <String, Object?>{},
            'listening',
          ),
          readingBlocks: _parseBlocks(
            (data['readingBlocks'] as List<dynamic>?) ?? const <dynamic>[],
          ),
          listeningBlocks: _parseBlocks(
            (data['listeningBlocks'] as List<dynamic>?) ?? const <dynamic>[],
          ),
          writingPrompt: DiagnosticWritingPromptSpec(
            promptId: wp['promptId'] as String? ?? 'DW-COMMUNITY-LIB-01',
            title: wp['title'] as String? ?? 'New Neighborhood Library',
            basePrompt: wp['basePrompt'] as String? ?? '',
            suggestedWordsLabel: wp['suggestedWordsLabel'] as String? ?? '',
            supportiveFollowUp: wp['supportiveFollowUp'] as String? ?? '',
            extensionFollowUp: wp['extensionFollowUp'] as String? ?? '',
          ),
          speakingPrompt: DiagnosticSpeakingPromptSpec(
            promptId: sp['promptId'] as String? ?? 'DS-FAVORITE-PLACE-01',
            title: sp['title'] as String? ?? 'A Place You Like to Spend Time',
            basePrompt: sp['basePrompt'] as String? ?? '',
            cueLabels: ((sp['cueLabels'] as List<dynamic>?) ?? const [])
                .whereType<String>()
                .toList(growable: false),
            supportiveFollowUp: sp['supportiveFollowUp'] as String? ?? '',
            extensionFollowUp: sp['extensionFollowUp'] as String? ?? '',
          ),
          examScaleInfo: ((data['examScaleInfo'] as List<dynamic>?) ?? const [])
              .whereType<Map<String, Object?>>()
              .map(
                (e) => DiagnosticExamScaleInfo(
                  examId: e['examId'] as String? ?? '',
                  label: e['label'] as String? ?? '',
                  summary: e['summary'] as String? ?? '',
                ),
              )
              .toList(growable: false),
        ),
      );
    } on DioException catch (e) {
      return Err(_mapDioException(e));
    }
  }

  @override
  Future<Result<DiagnosticSessionSnapshot, Failure>> createOrResumeSession({
    required String diagId,
    required String examId,
    required DiagnosticMode mode,
    String? selectionSeed,
  }) async {
    try {
      final res = await _dio.post<Map<String, Object?>>(
        '/v1/diagnostic/sessions',
        data: <String, Object?>{
          'diagId': diagId,
          'examId': examId,
          'mode': mode.wire,
          'selectionSeed': ?selectionSeed,
        },
      );
      final data = res.data;
      if (data == null) {
        return const Err(NetworkFailure('Empty create session response'));
      }
      return Ok(DiagnosticSessionSnapshot.fromJson(data));
    } on DioException catch (e) {
      return Err(_mapDioException(e));
    }
  }

  @override
  Future<Result<DiagnosticSessionSnapshot, Failure>> submitSession({
    required String diagId,
    required String examId,
    required DiagnosticMode mode,
    required List<BlockAttemptRecord> readingHistory,
    required DiagnosticStopReason? readingStopReason,
    required bool readingSkipped,
    required List<BlockAttemptRecord> listeningHistory,
    required DiagnosticStopReason? listeningStopReason,
    required bool listeningSkipped,
    String? writingAttemptId,
    String? writingPromptTitle,
    String? writingBasePrompt,
    String? writingFollowUpPrompt,
    String? writingBaseResponse,
    String? writingFollowUpResponse,
    bool writingSkipped = false,
    String? speakingAttemptId,
    String? speakingBasePrompt,
    String? speakingFollowUpPrompt,
    List<
          ({
            int partIndex,
            String promptText,
            String objectKey,
            int? durationMs,
          })
        >
        speakingTurns =
        const [],
    bool speakingSkipped = false,
    NoEvidenceReason? speakingNoEvidenceReason,
  }) async {
    try {
      final res = await _dio.post<Map<String, Object?>>(
        '/v1/diagnostic/sessions/$diagId/submit',
        data: <String, Object?>{
          'examId': examId,
          'mode': mode.wire,
          'readingHistory': readingHistory
              .map((h) => h.toJson())
              .toList(growable: false),
          if (readingStopReason != null)
            'readingStopReason': readingStopReason.wire,
          'readingSkipped': readingSkipped,
          'listeningHistory': listeningHistory
              .map((h) => h.toJson())
              .toList(growable: false),
          if (listeningStopReason != null)
            'listeningStopReason': listeningStopReason.wire,
          'listeningSkipped': listeningSkipped,
          if (writingAttemptId != null)
            'writing': <String, Object?>{
              'attemptId': writingAttemptId,
              'promptTitle': writingPromptTitle ?? 'Writing Check',
              'basePrompt': writingBasePrompt ?? '',
              'followUpPrompt': ?writingFollowUpPrompt,
              'baseResponse': writingBaseResponse ?? '',
              'followUpResponse': ?writingFollowUpResponse,
              'skipped': writingSkipped,
            },
          if (speakingAttemptId != null)
            'speaking': <String, Object?>{
              'attemptId': speakingAttemptId,
              'basePrompt': speakingBasePrompt ?? '',
              'followUpPrompt': ?speakingFollowUpPrompt,
              'turns': speakingTurns
                  .map(
                    (t) => <String, Object?>{
                      'partIndex': t.partIndex,
                      'promptText': t.promptText,
                      'objectKey': t.objectKey,
                      if (t.durationMs != null) 'durationMs': t.durationMs,
                    },
                  )
                  .toList(growable: false),
              'skipped': speakingSkipped,
              if (speakingNoEvidenceReason != null)
                'noEvidenceReason': speakingNoEvidenceReason.wire,
            },
        },
      );
      final data = res.data;
      if (data == null) {
        return const Err(NetworkFailure('Empty diagnostic submit response'));
      }
      return Ok(DiagnosticSessionSnapshot.fromJson(data));
    } on DioException catch (e) {
      return Err(_mapDioException(e));
    }
  }

  @override
  Future<Result<DiagnosticSessionSnapshot, Failure>> fetchSession({
    required String diagId,
  }) async {
    try {
      final res = await _dio.get<Map<String, Object?>>(
        '/v1/diagnostic/sessions/$diagId',
      );
      final data = res.data;
      if (data == null) {
        return const Err(NetworkFailure('Empty diagnostic status response'));
      }
      return Ok(DiagnosticSessionSnapshot.fromJson(data));
    } on DioException catch (e) {
      return Err(_mapDioException(e));
    }
  }

  @override
  Future<Result<DiagnosticSessionSnapshot, Failure>> retakeSingleSkill({
    required String diagId,
    required String skill,
    List<BlockAttemptRecord>? readingHistory,
    DiagnosticStopReason? readingStopReason,
    List<BlockAttemptRecord>? listeningHistory,
    DiagnosticStopReason? listeningStopReason,
    String? writingAttemptId,
    String? writingPromptTitle,
    String? writingBasePrompt,
    String? writingFollowUpPrompt,
    String? writingBaseResponse,
    String? writingFollowUpResponse,
    String? speakingAttemptId,
    String? speakingBasePrompt,
    String? speakingFollowUpPrompt,
    List<
      ({int partIndex, String promptText, String objectKey, int? durationMs})
    >?
    speakingTurns,
  }) async {
    try {
      final res = await _dio.post<Map<String, Object?>>(
        '/v1/diagnostic/sessions/$diagId/retake-skill',
        data: <String, Object?>{
          'skill': skill,
          if (readingHistory != null)
            'readingHistory': readingHistory
                .map((h) => h.toJson())
                .toList(growable: false),
          if (readingStopReason != null)
            'readingStopReason': readingStopReason.wire,
          if (listeningHistory != null)
            'listeningHistory': listeningHistory
                .map((h) => h.toJson())
                .toList(growable: false),
          if (listeningStopReason != null)
            'listeningStopReason': listeningStopReason.wire,
          if (writingAttemptId != null)
            'writing': <String, Object?>{
              'attemptId': writingAttemptId,
              'promptTitle': writingPromptTitle ?? 'Writing Retake',
              'basePrompt': writingBasePrompt ?? '',
              'followUpPrompt': ?writingFollowUpPrompt,
              'baseResponse': writingBaseResponse ?? '',
              'followUpResponse': ?writingFollowUpResponse,
              'skipped': false,
            },
          if (speakingAttemptId != null)
            'speaking': <String, Object?>{
              'attemptId': speakingAttemptId,
              'basePrompt': speakingBasePrompt ?? '',
              'followUpPrompt': ?speakingFollowUpPrompt,
              'turns': (speakingTurns ?? const [])
                  .map(
                    (t) => <String, Object?>{
                      'partIndex': t.partIndex,
                      'promptText': t.promptText,
                      'objectKey': t.objectKey,
                      if (t.durationMs != null) 'durationMs': t.durationMs,
                    },
                  )
                  .toList(growable: false),
              'skipped': false,
            },
        },
      );
      final data = res.data;
      if (data == null) {
        return const Err(NetworkFailure('Empty retake response'));
      }
      return Ok(DiagnosticSessionSnapshot.fromJson(data));
    } on DioException catch (e) {
      return Err(_mapDioException(e));
    }
  }

  DiagnosticWorkedExampleSnapshot _parseWorkedExample(
    Map<String, Object?> json,
    String fallbackSkill,
  ) => DiagnosticWorkedExampleSnapshot(
    skill: json['skill'] as String? ?? fallbackSkill,
    passageOrTranscript: json['passageOrTranscript'] as String? ?? '',
    mediaUrl: json['mediaUrl'] as String?,
    questionPrompt: json['questionPrompt'] as String? ?? '',
    options: ((json['options'] as List<dynamic>?) ?? const [])
        .whereType<String>()
        .toList(growable: false),
    correctIndex: (json['correctIndex'] as num?)?.toInt() ?? 0,
    explanation: json['explanation'] as String? ?? '',
  );

  List<DiagnosticBlockDef> _parseBlocks(List<dynamic> rawList) => rawList
      .whereType<Map<String, Object?>>()
      .map((m) {
        final rawQuestions = (m['questions'] as List<dynamic>?) ?? const [];
        final questions = rawQuestions
            .whereType<Map<String, Object?>>()
            .map(
              (qm) => DiagnosticQuestionDef(
                questionId: qm['questionId'] as String? ?? '',
                prompt: qm['prompt'] as String? ?? '',
                options: ((qm['options'] as List<dynamic>?) ?? const [])
                    .whereType<String>()
                    .toList(growable: false),
                correctIndex: (qm['correctIndex'] as num?)?.toInt() ?? 0,
                focusTag: qm['focusTag'] as String? ?? 'explicit_detail',
              ),
            )
            .toList(growable: false);
        return DiagnosticBlockDef(
          blockId: m['blockId'] as String? ?? '',
          skill: m['skill'] as String? ?? 'reading',
          tier: AuthoringTier.fromCode(m['tier'] as String? ?? 'B1'),
          scenarioId: m['scenarioId'] as String? ?? 'community_spaces',
          title: m['title'] as String? ?? '',
          passageText: m['passageText'] as String?,
          scriptText: m['scriptText'] as String?,
          mediaUrl: m['mediaUrl'] as String?,
          durationSeconds: (m['durationSeconds'] as num?)?.toInt(),
          minRequiredSeconds: (m['minRequiredSeconds'] as num?)?.toInt() ?? 20,
          questions: questions,
        );
      })
      .toList(growable: false);

  Failure _mapDioException(DioException e) {
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return const TimeoutFailure('Diagnostic request timed out');
    }
    final status = e.response?.statusCode;
    final data = e.response?.data;
    final msg = data is Map<String, Object?>
        ? data['message'] as String?
        : null;
    if (status == 401 || status == 403) {
      return UnauthorizedFailure(msg ?? 'Authentication required');
    }
    if (status == 402) {
      return EntitlementRequiredFailure(msg ?? 'Subscription required');
    }
    if (status == 429) {
      return QuotaExceededFailure(msg ?? 'Quota limit reached');
    }
    return NetworkFailure(
      msg ?? 'Diagnostic transport error',
      statusCode: status,
    );
  }
}

/// Deterministic in-memory test double for widget & provider tests.
class FakeDiagnosticGateway implements DiagnosticGateway {
  /// Optional custom bank override.
  DiagnosticBankSnapshot? bankOverride;

  final Map<String, DiagnosticSessionSnapshot> _sessions =
      <String, DiagnosticSessionSnapshot>{};

  /// Builds a sample 6-tier reading & listening bank matching policy requirements.
  static DiagnosticBankSnapshot defaultTestBank() {
    List<DiagnosticBlockDef> buildPool(String skill) {
      final blocks = <DiagnosticBlockDef>[];
      final prefix = skill == 'reading' ? 'DR' : 'DL';
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
              passageText: skill == 'reading'
                  ? 'Sample ${tier.code} passage #$i describing community workshop schedules.'
                  : null,
              mediaUrl: skill == 'listening'
                  ? '/v1/media/media/listening/diagnostic/dl_${tier.code.toLowerCase()}_$i.m4a'
                  : null,
              durationSeconds: skill == 'listening' ? 14 : null,
              minRequiredSeconds: 20,
              questions: <DiagnosticQuestionDef>[
                DiagnosticQuestionDef(
                  questionId: '$prefix-${tier.code}-$i-Q1',
                  prompt: 'When does the session start?',
                  options: const ['Nine', 'Ten', 'Eleven'],
                  correctIndex: 1,
                  focusTag: 'explicit_detail',
                ),
                DiagnosticQuestionDef(
                  questionId: '$prefix-${tier.code}-$i-Q2',
                  prompt: 'What is required beforehand?',
                  options: const ['Booking online', 'Bringing paint', 'A fee'],
                  correctIndex: 0,
                  focusTag: 'meaning_relationship',
                ),
              ],
            ),
          );
        }
      }
      return blocks;
    }

    return DiagnosticBankSnapshot(
      policyVersion: '2026-11-17.v1',
      contentVersion: 'diag-2026-11-17.v1',
      preflightAudioUrl:
          '/v1/media/media/listening/diagnostic/preflight_check.m4a',
      workedReading: const DiagnosticWorkedExampleSnapshot(
        skill: 'reading',
        passageOrTranscript: 'The community kitchen opens at nine. Visitors must bring a container for soup.',
        questionPrompt: 'What should visitors bring?',
        options: ['A ticket', 'A container', 'A spoon'],
        correctIndex: 1,
        explanation: 'The text directly asks visitors to bring a container.',
      ),
      workedListening: const DiagnosticWorkedExampleSnapshot(
        skill: 'listening',
        passageOrTranscript: 'Class moved from Room 4 to Room 7.',
        mediaUrl:
            '/v1/media/media/listening/diagnostic/example_reading_room.m4a',
        questionPrompt: 'Which room is used now?',
        options: ['Room 4', 'Room 7', 'Room 9'],
        correctIndex: 1,
        explanation: 'Room 7 replaced Room 4.',
      ),
      readingBlocks: buildPool('reading'),
      listeningBlocks: buildPool('listening'),
      writingPrompt: const DiagnosticWritingPromptSpec(
        promptId: 'DW-COMMUNITY-LIB-01',
        title: 'New Neighborhood Library',
        basePrompt: 'A new library opens near you. Would you visit? Say when, explain why, and give one example.',
        suggestedWordsLabel: 'Target roughly 35–55 words',
        supportiveFollowUp: 'What is one thing you would like to do there?',
        extensionFollowUp:
            'What might make a visit difficult? Suggest a solution.',
      ),
      speakingPrompt: const DiagnosticSpeakingPromptSpec(
        promptId: 'DS-FAVORITE-PLACE-01',
        title: 'A Place You Like to Spend Time',
        basePrompt: 'Tell us about a place where you like to spend time. What do you do there, and why?',
        cueLabels: ['Place', 'What you do', 'Why'],
        supportiveFollowUp: 'What is one thing you do there?',
        extensionFollowUp: 'What would you change about that place, and why?',
      ),
      examScaleInfo: const <DiagnosticExamScaleInfo>[
        DiagnosticExamScaleInfo(
          examId: 'ielts_academic',
          label: 'IELTS (Academic & General Training)',
          summary: 'Band 0–9 in 0.5 steps; CEFR mapping is approximate.',
        ),
      ],
    );
  }

  @override
  Future<Result<DiagnosticBankSnapshot, Failure>> fetchDiagnosticBank({
    bool alternateForm = false,
  }) async => Ok(bankOverride ?? defaultTestBank());

  @override
  Future<Result<DiagnosticSessionSnapshot, Failure>> createOrResumeSession({
    required String diagId,
    required String examId,
    required DiagnosticMode mode,
    String? selectionSeed,
  }) async => Ok(
    DiagnosticSessionSnapshot(
      diagId: diagId,
      examId: examId,
      mode: mode,
      policyVersion: '2026-11-17.v1',
      contentVersion: 'diag-2026-11-17.v1',
      status: 'in_progress',
      startedAtIso: '2026-11-17T14:00:00.000Z',
      collectionDeadlineAtIso: '2026-11-17T14:09:00.000Z',
      resultsDeadlineAtIso: '2026-11-17T14:10:00.000Z',
      resultRevision: 1,
      reading: const DiagnosticSkillOutcomeSnapshot(
        skill: 'reading',
        status: DiagnosticSkillStatus.pending,
        observations: [],
      ),
      listening: const DiagnosticSkillOutcomeSnapshot(
        skill: 'listening',
        status: DiagnosticSkillStatus.pending,
        observations: [],
      ),
      writing: const DiagnosticSkillOutcomeSnapshot(
        skill: 'writing',
        status: DiagnosticSkillStatus.pending,
        observations: [],
      ),
      speaking: const DiagnosticSkillOutcomeSnapshot(
        skill: 'speaking',
        status: DiagnosticSkillStatus.pending,
        observations: [],
      ),
      recommendedActionTitle: 'Explore starter practice',
      recommendedActionDescription: '',
    ),
  );

  @override
  Future<Result<DiagnosticSessionSnapshot, Failure>> submitSession({
    required String diagId,
    required String examId,
    required DiagnosticMode mode,
    required List<BlockAttemptRecord> readingHistory,
    required DiagnosticStopReason? readingStopReason,
    required bool readingSkipped,
    required List<BlockAttemptRecord> listeningHistory,
    required DiagnosticStopReason? listeningStopReason,
    required bool listeningSkipped,
    String? writingAttemptId,
    String? writingPromptTitle,
    String? writingBasePrompt,
    String? writingFollowUpPrompt,
    String? writingBaseResponse,
    String? writingFollowUpResponse,
    bool writingSkipped = false,
    String? speakingAttemptId,
    String? speakingBasePrompt,
    String? speakingFollowUpPrompt,
    List<
          ({
            int partIndex,
            String promptText,
            String objectKey,
            int? durationMs,
          })
        >
        speakingTurns =
        const [],
    bool speakingSkipped = false,
    NoEvidenceReason? speakingNoEvidenceReason,
  }) async {
    final snapshot = DiagnosticSessionSnapshot(
      diagId: diagId,
      examId: examId,
      mode: mode,
      policyVersion: '2026-11-17.v1',
      contentVersion: 'diag-2026-11-17.v1',
      status: 'completed',
      startedAtIso: '2026-11-17T14:00:00.000Z',
      collectionDeadlineAtIso: '2026-11-17T14:09:00.000Z',
      resultsDeadlineAtIso: '2026-11-17T14:10:00.000Z',
      resultRevision: 2,
      reading: DiagnosticSkillOutcomeSnapshot(
        skill: 'reading',
        status: readingSkipped
            ? DiagnosticSkillStatus.skipped
            : DiagnosticSkillStatus.provisional,
        suggestedPracticeLevel: readingSkipped
            ? null
            : 'Suggested practice: Intermediate (B1–B2 focus) — provisional',
        suggestedTier: readingSkipped ? null : AuthoringTier.b2,
        observations: readingSkipped
            ? const ['Skipped by learner.']
            : const ['Answered Reading prompts accurately.'],
      ),
      listening: DiagnosticSkillOutcomeSnapshot(
        skill: 'listening',
        status: listeningSkipped
            ? DiagnosticSkillStatus.skipped
            : DiagnosticSkillStatus.provisional,
        suggestedPracticeLevel: listeningSkipped
            ? null
            : 'Suggested practice: Intermediate (B1–B2 focus) — provisional',
        suggestedTier: listeningSkipped ? null : AuthoringTier.b1,
        observations: listeningSkipped
            ? const ['Skipped by learner.']
            : const ['Captured main schedule details.'],
      ),
      writing: DiagnosticSkillOutcomeSnapshot(
        skill: 'writing',
        status: writingSkipped
            ? DiagnosticSkillStatus.skipped
            : DiagnosticSkillStatus.provisional,
        suggestedPracticeLevel: writingSkipped
            ? null
            : 'Suggested practice: Intermediate (B1–B2 focus) — provisional',
        observations: writingSkipped
            ? const ['Skipped by learner.']
            : const ['Clear sentences answering the prompt.'],
      ),
      speaking: DiagnosticSkillOutcomeSnapshot(
        skill: 'speaking',
        status: speakingSkipped
            ? DiagnosticSkillStatus.skipped
            : (speakingNoEvidenceReason != null
                  ? DiagnosticSkillStatus.insufficientEvidence
                  : DiagnosticSkillStatus.provisional),
        suggestedPracticeLevel:
            speakingSkipped || speakingNoEvidenceReason != null
            ? null
            : 'Suggested practice: Intermediate (B1–B2 focus) — provisional',
        observations: speakingSkipped
            ? const ['Skipped by learner.']
            : (speakingNoEvidenceReason != null
                  ? const ['Microphone unavailable — not included yet.']
                  : const ['Clear, natural everyday phrasing.']),
      ),
      recommendedActionTitle: 'Practice everyday Reading & Listening',
      recommendedActionDescription:
          'A short starting check. Your profile improves as you practise.',
    );
    _sessions[diagId] = snapshot;
    return Ok(snapshot);
  }

  @override
  Future<Result<DiagnosticSessionSnapshot, Failure>> fetchSession({
    required String diagId,
  }) {
    final existing = _sessions[diagId];
    if (existing != null) return Future.value(Ok(existing));
    return submitSession(
      diagId: diagId,
      examId: 'ielts_academic',
      mode: DiagnosticMode.standard,
      readingHistory: const [],
      readingStopReason: DiagnosticStopReason.samplingComplete,
      readingSkipped: false,
      listeningHistory: const [],
      listeningStopReason: DiagnosticStopReason.samplingComplete,
      listeningSkipped: false,
    );
  }

  @override
  Future<Result<DiagnosticSessionSnapshot, Failure>> retakeSingleSkill({
    required String diagId,
    required String skill,
    List<BlockAttemptRecord>? readingHistory,
    DiagnosticStopReason? readingStopReason,
    List<BlockAttemptRecord>? listeningHistory,
    DiagnosticStopReason? listeningStopReason,
    String? writingAttemptId,
    String? writingPromptTitle,
    String? writingBasePrompt,
    String? writingFollowUpPrompt,
    String? writingBaseResponse,
    String? writingFollowUpResponse,
    String? speakingAttemptId,
    String? speakingBasePrompt,
    String? speakingFollowUpPrompt,
    List<
      ({int partIndex, String promptText, String objectKey, int? durationMs})
    >?
    speakingTurns,
  }) async {
    final prev =
        _sessions[diagId] ?? (await fetchSession(diagId: diagId)).valueOrNull!;
    final updated = DiagnosticSessionSnapshot(
      diagId: prev.diagId,
      examId: prev.examId,
      mode: prev.mode,
      policyVersion: prev.policyVersion,
      contentVersion: prev.contentVersion,
      status: 'completed',
      startedAtIso: prev.startedAtIso,
      collectionDeadlineAtIso: prev.collectionDeadlineAtIso,
      resultsDeadlineAtIso: prev.resultsDeadlineAtIso,
      resultRevision: prev.resultRevision + 1,
      reading: skill == 'reading'
          ? const DiagnosticSkillOutcomeSnapshot(
              skill: 'reading',
              status: DiagnosticSkillStatus.provisional,
              suggestedPracticeLevel:
                  'Suggested practice: Upper-Intermediate (B2) — provisional',
              suggestedTier: AuthoringTier.b2,
              observations: ['Alternate Reading form completed.'],
            )
          : prev.reading,
      listening: skill == 'listening'
          ? const DiagnosticSkillOutcomeSnapshot(
              skill: 'listening',
              status: DiagnosticSkillStatus.provisional,
              suggestedPracticeLevel:
                  'Suggested practice: Upper-Intermediate (B2) — provisional',
              suggestedTier: AuthoringTier.b2,
              observations: ['Alternate Listening form completed.'],
            )
          : prev.listening,
      writing: skill == 'writing'
          ? const DiagnosticSkillOutcomeSnapshot(
              skill: 'writing',
              status: DiagnosticSkillStatus.provisional,
              suggestedPracticeLevel: 'Suggested practice: Intermediate (B1–B2 focus) — provisional',
              observations: ['Alternate Writing form completed.'],
            )
          : prev.writing,
      speaking: skill == 'speaking'
          ? const DiagnosticSkillOutcomeSnapshot(
              skill: 'speaking',
              status: DiagnosticSkillStatus.provisional,
              suggestedPracticeLevel: 'Suggested practice: Intermediate (B1–B2 focus) — provisional',
              observations: ['Alternate Speaking form completed.'],
            )
          : prev.speaking,
      recommendedActionTitle: prev.recommendedActionTitle,
      recommendedActionDescription: prev.recommendedActionDescription,
      recommendedDrillType: prev.recommendedDrillType,
      recommendedTargetSkill: prev.recommendedTargetSkill,
    );
    _sessions[diagId] = updated;
    return Ok(updated);
  }
}

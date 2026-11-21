import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:clock/clock.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/app.dart';
import 'package:mockza/core/auth/auth_models.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/diagnostic/diagnostic_budget.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/core/models/speaking_evaluation.dart';
import 'package:mockza/core/models/user_profile.dart';
import 'package:mockza/core/models/writing_evaluation.dart';
import 'package:mockza/core/preferences/appearance_settings.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/data/repositories/exam_catalog_repository.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/audio_recorder_gateway.dart';
import 'package:mockza/services/auth_session_service.dart';
import 'package:mockza/services/crash_log.dart';
import 'package:mockza/services/diagnostic_gateway.dart';
import 'package:mockza/services/grading_gateway.dart';
import 'package:mockza/services/secure_identity_service.dart';

import '../../support/fakes.dart';

/// Mutable clock wrapper allowing E2E tests to advance time cleanly.
final class E2eMutableClock {
  /// Creates an [E2eMutableClock] anchored to [initial] (or `2026-11-17T14:00:00Z`).
  new([DateTime? initial])
    : current = initial ?? DateTime.utc(2026, 11, 17, 14);

  /// Current simulated UTC timestamp.
  DateTime current;

  /// Returns a [Clock] backed by [current].
  Clock asClock() => Clock(() => current);

  /// Advances [current] by [delta].
  void advance(Duration delta) {
    current = current.add(delta);
  }
}

/// Composition-based [AudioRecorderGateway] that persists valid dummy `.m4a`
/// bytes into a temporary directory so Speaking uploads work end-to-end.
final class E2eAudioRecorderGateway implements AudioRecorderGateway {
  /// Creates an [E2eAudioRecorderGateway] writing clips under [_tempDir].
  new(this._tempDir) : _inner = FakeAudioRecorderGateway();

  final Directory _tempDir;
  final FakeAudioRecorderGateway _inner;
  int _clipCounter = 0;

  @override
  String get activeContentType => _inner.activeContentType;

  /// Exposes whether recording is currently active.
  bool get isRecording => _inner.isRecording;

  @override
  Future<Result<bool, Failure>> hasPermission({bool request = true}) =>
      _inner.hasPermission(request: request);

  @override
  Future<Result<void, Failure>> startRecording({
    required String outputPath,
  }) {
    final targetPath = outputPath.isNotEmpty
        ? outputPath
        : '${_tempDir.path}/clip_${++_clipCounter}.m4a';
    final file = File(targetPath);
    if (!file.parent.existsSync()) {
      file.parent.createSync(recursive: true);
    }
    file.writeAsBytesSync(
      const <int>[0, 0, 0, 24, 102, 116, 121, 112, 77, 52, 65, 32, 1, 2, 3, 4],
      flush: true,
    );
    _inner.emitAmplitude(-18);
    return _inner.startRecording(outputPath: targetPath);
  }

  @override
  Future<Result<String?, Failure>> stopRecording() => _inner.stopRecording();

  @override
  Stream<double> watchAmplitude() => _inner.watchAmplitude();

  @override
  Future<void> dispose() => _inner.dispose();
}

/// Composition-based [GradingGateway] delegating to [FakeGradingGateway] while
/// returning realistic completed AI rubric results for Writing and Speaking jobs.
final class E2eGradingGateway implements GradingGateway {
  /// Creates an [E2eGradingGateway].
  new() : inner = FakeGradingGateway();

  /// Underlying fake gateway recording calls and failures.
  final FakeGradingGateway inner;

  final Map<String, ({String attemptId, bool isSpeaking, String examId})>
  _jobs = <String, ({String attemptId, bool isSpeaking, String examId})>{};

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
    final res = await inner.enqueueWritingEvaluation(
      attemptId: attemptId,
      packId: packId,
      taskType: taskType,
      essayText: essayText,
      examId: examId,
      promptTitle: promptTitle,
      promptBody: promptBody,
      durationSeconds: durationSeconds,
      wordCount: wordCount,
    );
    final jobId = res.valueOrNull;
    if (jobId != null) {
      _jobs[jobId] = (
        attemptId: attemptId,
        isSpeaking: false,
        examId: examId,
      );
    }
    return res;
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
      ({
        int partIndex,
        String promptText,
        String objectKey,
        int? durationMs,
      })
    >?
    turns,
  }) async {
    final res = await inner.enqueueSpeakingEvaluation(
      attemptId: attemptId,
      packId: packId,
      audioObjectKey: audioObjectKey,
      partIndex: partIndex,
      examId: examId,
      partSequence: partSequence,
      turns: turns,
    );
    final jobId = res.valueOrNull;
    if (jobId != null) {
      _jobs[jobId] = (
        attemptId: attemptId,
        isSpeaking: true,
        examId: examId,
      );
    }
    return res;
  }

  @override
  Future<Result<JobPollSnapshot, Failure>> pollJobStatus({
    required String jobId,
  }) async {
    if (inner.jobPollResult != null) {
      return inner.jobPollResult!;
    }
    final meta = _jobs[jobId];
    final isSpeaking = meta?.isSpeaking ?? jobId.contains('speaking');
    final attemptId = meta?.attemptId ?? '';
    final examId = meta?.examId ?? 'ielts_academic';
    return Ok(
      JobPollSnapshot(
        jobId: jobId,
        attemptId: attemptId,
        status: 'completed',
        stage: 'Completed',
        rawResultJson: isSpeaking
            ? _sampleSpeakingJson(attemptId, examId: examId)
            : _sampleWritingJson(attemptId, examId: examId),
      ),
    );
  }

  static ({
    double overallScore,
    List<({String code, String label})> writingCriteria,
    List<({String code, String label})> speakingCriteria,
  })
  _rubricProfileForExam(String examId) => switch (examId) {
    'toefl_ibt' => (
      overallScore: 5.0,
      writingCriteria: const <({String code, String label})>[
        (code: 'DEV', label: 'Task Development'),
        (code: 'ORG', label: 'Organization & Coherence'),
        (code: 'LANG', label: 'Language Use'),
      ],
      speakingCriteria: const <({String code, String label})>[
        (code: 'DEL', label: 'Delivery & Pacing'),
        (code: 'LANG', label: 'Language Use'),
        (code: 'TOP', label: 'Topic Development'),
      ],
    ),
    'pte_academic' => (
      overallScore: 72.0,
      writingCriteria: const <({String code, String label})>[
        (code: 'CONT', label: 'Content & Relevance'),
        (code: 'FORM', label: 'Formal Requirements'),
        (code: 'GRAM', label: 'Grammar Accuracy'),
        (code: 'VOC', label: 'Vocabulary Range'),
      ],
      speakingCriteria: const <({String code, String label})>[
        (code: 'CONT', label: 'Content Coverage'),
        (code: 'FLU', label: 'Oral Fluency'),
        (code: 'PRON', label: 'Pronunciation'),
      ],
    ),
    'det' => (
      overallScore: 130.0,
      writingCriteria: const <({String code, String label})>[
        (code: 'LIT', label: 'Literacy'),
        (code: 'COMP', label: 'Comprehension'),
        (code: 'CONV', label: 'Conversation'),
        (code: 'PROD', label: 'Production'),
      ],
      speakingCriteria: const <({String code, String label})>[
        (code: 'LIT', label: 'Literacy'),
        (code: 'COMP', label: 'Comprehension'),
        (code: 'CONV', label: 'Conversation'),
        (code: 'PROD', label: 'Production'),
      ],
    ),
    _ => (
      overallScore: 7.0,
      writingCriteria: const <({String code, String label})>[
        (code: 'TR', label: 'Task Response'),
        (code: 'CC', label: 'Coherence & Cohesion'),
        (code: 'LR', label: 'Lexical Resource'),
        (code: 'GRA', label: 'Grammatical Range'),
      ],
      speakingCriteria: const <({String code, String label})>[
        (code: 'FC', label: 'Fluency & Coherence'),
        (code: 'LR', label: 'Lexical Resource'),
        (code: 'GRA', label: 'Grammatical Range'),
        (code: 'PR', label: 'Pronunciation'),
      ],
    ),
  };

  Map<String, Object?> _sampleWritingJson(
    String attemptId, {
    String examId = 'ielts_academic',
  }) {
    final profile = _rubricProfileForExam(examId);
    return <String, Object?>{
      'attemptId': attemptId,
      'taskType': 'task2Essay',
      'overallBand': profile.overallScore,
      'wordCount': 32,
      'upgradedExcerpt':
          'Public transit investment measurably curtails congestion.',
      'actionableNextStep': 'Expand body paragraph concrete examples.',
      'modelId': 'e2e-rubric-writer',
      'rubricVersion': '2026-11.v1',
      'criteria': profile.writingCriteria
          .map(
            (c) => <String, Object?>{
              'code': c.code,
              'label': c.label,
              'band': profile.overallScore,
              'evidenceExcerpt': 'Cities benefit from cleaner transit.',
              'feedbackNote': 'Strong task control across criteria.',
            },
          )
          .toList(growable: false),
      'inlineEdits': const <Map<String, Object?>>[],
      'vocabUpgrades': const <Map<String, Object?>>[
        <String, Object?>{
          'original': 'cleaner transit',
          'upgraded': 'sustainable mobility',
          'definition':
              'Transport networks designed for low long-term emissions.',
          'collocation': 'sustainable mobility infrastructure',
        },
      ],
    };
  }

  Map<String, Object?> _sampleSpeakingJson(
    String attemptId, {
    String examId = 'ielts_academic',
  }) {
    final profile = _rubricProfileForExam(examId);
    return <String, Object?>{
      'attemptId': attemptId,
      'overallBand': profile.overallScore,
      'transcript': 'I usually study at the quiet second-floor campus library.',
      'actionableNextStep':
          'Link personal examples with clearer discourse markers.',
      'modelId': 'e2e-rubric-speaker',
      'rubricVersion': '2026-11.v1',
      'criteria': profile.speakingCriteria
          .map(
            (c) => <String, Object?>{
              'code': c.code,
              'label': c.label,
              'band': profile.overallScore,
              'evidenceExcerpt':
                  'I usually study at the quiet second-floor campus library.',
              'feedbackNote': 'Steady pace with clear intelligibility.',
            },
          )
          .toList(growable: false),
      'transcriptSegments': const <Map<String, Object?>>[],
      'vocabUpgrades': const <Map<String, Object?>>[],
    };
  }

  @override
  Future<Result<WritingEvaluationResult?, Failure>> pollWritingResult({
    required String jobId,
  }) => inner.pollWritingResult(jobId: jobId);

  @override
  Future<Result<SpeakingEvaluationResult?, Failure>> pollSpeakingResult({
    required String jobId,
  }) => inner.pollSpeakingResult(jobId: jobId);

  @override
  Future<Result<({String uploadUrl, String objectKey}), Failure>>
  presignAudioUpload({
    required String attemptId,
    required int partIndex,
    required int byteLength,
    String? turnId,
    String contentType = 'audio/mp4',
  }) => inner.presignAudioUpload(
    attemptId: attemptId,
    partIndex: partIndex,
    byteLength: byteLength,
    turnId: turnId,
    contentType: contentType,
  );

  @override
  Future<Result<void, Failure>> uploadAudioBytes({
    required String uploadUrl,
    required List<int> bytes,
    required String contentType,
  }) => inner.uploadAudioBytes(
    uploadUrl: uploadUrl,
    bytes: bytes,
    contentType: contentType,
  );

  @override
  Future<Result<String, Failure>> retryEvaluation({
    required String attemptId,
  }) => inner.retryEvaluation(attemptId: attemptId);

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
  }) => inner.explainQuestion(
    questionId: questionId,
    learnerAnswer: learnerAnswer,
    correctAnswer: correctAnswer,
    passageContext: passageContext,
    packId: packId,
    packVersion: packVersion,
    skill: skill,
    questionType: questionType,
  );

  @override
  Future<Result<QuotaSnapshot, Failure>> fetchQuotaStatus() =>
      inner.fetchQuotaStatus();

  @override
  Future<Result<void, Failure>> flagQuestion({
    required String packId,
    required String questionId,
    required String reason,
    String? note,
  }) => inner.flagQuestion(
    packId: packId,
    questionId: questionId,
    reason: reason,
    note: note,
  );
}

/// Composition-based [DiagnosticGateway] delegating to [FakeDiagnosticGateway]
/// while aligning session deadlines to the E2E clock and `DiagnosticBudget`.
final class E2eDiagnosticGateway implements DiagnosticGateway {
  /// Creates an [E2eDiagnosticGateway] anchored to [_clock].
  new(this._clock) : inner = FakeDiagnosticGateway();

  final E2eMutableClock _clock;

  /// Underlying fake gateway.
  final FakeDiagnosticGateway inner;

  @override
  Future<Result<DiagnosticBankSnapshot, Failure>> fetchDiagnosticBank({
    bool alternateForm = false,
  }) => inner.fetchDiagnosticBank(alternateForm: alternateForm);

  @override
  Future<Result<DiagnosticSessionSnapshot, Failure>> createOrResumeSession({
    required String diagId,
    required String examId,
    required DiagnosticMode mode,
    String? selectionSeed,
  }) async {
    final res = await inner.createOrResumeSession(
      diagId: diagId,
      examId: examId,
      mode: mode,
      selectionSeed: selectionSeed,
    );
    final base = res.valueOrNull;
    if (base == null) return res;
    final start = _clock.current.toUtc();
    final collectionEnd = start.add(
      const Duration(seconds: DiagnosticBudget.collectionTotalSeconds),
    );
    final resultsEnd = start.add(
      const Duration(seconds: DiagnosticBudget.totalSessionSeconds),
    );
    return Ok(
      DiagnosticSessionSnapshot(
        diagId: base.diagId,
        examId: base.examId,
        mode: base.mode,
        policyVersion: base.policyVersion,
        contentVersion: base.contentVersion,
        status: base.status,
        startedAtIso: start.toIso8601String(),
        collectionDeadlineAtIso: collectionEnd.toIso8601String(),
        resultsDeadlineAtIso: resultsEnd.toIso8601String(),
        resultRevision: base.resultRevision,
        reading: base.reading,
        listening: base.listening,
        writing: base.writing,
        speaking: base.speaking,
        recommendedActionTitle: base.recommendedActionTitle,
        recommendedActionDescription: base.recommendedActionDescription,
        recommendedDrillType: base.recommendedDrillType,
        recommendedTargetSkill: base.recommendedTargetSkill,
      ),
    );
  }

  @override
  Future<Result<DiagnosticSessionSnapshot, Failure>> fetchSession({
    required String diagId,
  }) => inner.fetchSession(diagId: diagId);

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
  }) => inner.submitSession(
    diagId: diagId,
    examId: examId,
    mode: mode,
    readingHistory: readingHistory,
    readingStopReason: readingStopReason,
    readingSkipped: readingSkipped,
    listeningHistory: listeningHistory,
    listeningStopReason: listeningStopReason,
    listeningSkipped: listeningSkipped,
    writingAttemptId: writingAttemptId,
    writingPromptTitle: writingPromptTitle,
    writingBasePrompt: writingBasePrompt,
    writingFollowUpPrompt: writingFollowUpPrompt,
    writingBaseResponse: writingBaseResponse,
    writingFollowUpResponse: writingFollowUpResponse,
    writingSkipped: writingSkipped,
    speakingAttemptId: speakingAttemptId,
    speakingBasePrompt: speakingBasePrompt,
    speakingFollowUpPrompt: speakingFollowUpPrompt,
    speakingTurns: speakingTurns,
    speakingSkipped: speakingSkipped,
    speakingNoEvidenceReason: speakingNoEvidenceReason,
  );

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
  }) => inner.retakeSingleSkill(
    diagId: diagId,
    skill: skill,
    readingHistory: readingHistory,
    readingStopReason: readingStopReason,
    listeningHistory: listeningHistory,
    listeningStopReason: listeningStopReason,
    writingAttemptId: writingAttemptId,
    writingPromptTitle: writingPromptTitle,
    writingBasePrompt: writingBasePrompt,
    writingFollowUpPrompt: writingFollowUpPrompt,
    writingBaseResponse: writingBaseResponse,
    writingFollowUpResponse: writingFollowUpResponse,
    speakingAttemptId: speakingAttemptId,
    speakingBasePrompt: speakingBasePrompt,
    speakingFollowUpPrompt: speakingFollowUpPrompt,
    speakingTurns: speakingTurns,
  );
}

/// Stateful offline HTTP adapter simulating `/v1/auth/*` and `/v1/account/*`
/// including 1-Phone + 1-Desktop-Web device slots and remote revocation for E2E tests.
final class OfflineE2eHttpAdapter implements HttpClientAdapter {
  /// Optional injected remote session list shown alongside the active device.
  final List<Map<String, Object?>> remoteSessions = <Map<String, Object?>>[];

  /// Optional forced `409 device_slot_limit_reached` conflict on next sign-in/register.
  Map<String, Object?>? forcedSlotConflict;

  String? _userId;
  String? _email;
  String? _displayName;
  final Set<String> _providers = <String>{};
  String? _acceptedDevicePolicyAt;
  String _currentDeviceId = '00000000-0000-4000-8000-000000000001';
  Map<String, Object?>? _currentSession;

  @override
  void close({bool force = false}) {}

  Map<String, Object?> _buildUserJson() => <String, Object?>{
    'userId': _userId ?? '00000000-0000-4000-8000-000000000099',
    'email': _email,
    'displayName': _displayName,
    'linkedProviders': _providers.toList(growable: false),
    'isPro': false,
    'acceptedDevicePolicyAt': _acceptedDevicePolicyAt,
  };

  List<Map<String, Object?>> _allSessions() => <Map<String, Object?>>[
    ...?_currentSession == null
        ? null
        : <Map<String, Object?>>[_currentSession!],
    ...remoteSessions,
  ];

  Map<String, Object?> _decodeBody(Object? data) {
    if (data is Map<Object?, Object?>) {
      return data.map((k, v) => MapEntry(k?.toString() ?? '', v));
    }
    if (data is String && data.isNotEmpty) {
      final decoded = jsonDecode(data);
      if (decoded is Map<Object?, Object?>) {
        return decoded.map((k, v) => MapEntry(k?.toString() ?? '', v));
      }
    }
    return <String, Object?>{};
  }

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final path = options.path;
    final body = _decodeBody(options.data);

    if (path.contains('/v1/auth/providers')) {
      return _jsonResponse(<String, Object?>{
        'emailPasswordEnabled': true,
        'google': const <String, Object?>{
          'enabled': true,
          'mode': 'dev_sandbox',
        },
        'apple': const <String, Object?>{
          'enabled': true,
          'mode': 'dev_sandbox',
        },
        'devicePolicy': const <String, Object?>{
          'maxMobilePhones': 1,
          'maxDesktopWebInstances': 1,
        },
      });
    }

    if (path.contains('/v1/auth/anonymous')) {
      final devId = body['deviceId'] as String?;
      if (devId != null && devId.isNotEmpty) {
        _currentDeviceId = devId;
      }
      return _jsonResponse(<String, Object?>{
        'accessToken': 'e2e.eyJleHAiOjk5OTk5OTk5OTl9.sig',
        'deviceId': _currentDeviceId,
        'expiresAt': '2099-01-01T00:00:00Z',
        'deviceSecret': 'e2e-device-secret',
        'linkedUserId': _userId,
        'linkedEmail': _email,
      }, statusCode: 201);
    }

    if (path.contains('/v1/auth/register') ||
        path.contains('/v1/auth/login') ||
        path.contains('/v1/auth/oauth')) {
      if (forcedSlotConflict != null) {
        final conflict = forcedSlotConflict!;
        final slotLabel = conflict['slotKind'] == 'desktop_web'
            ? 'Desktop Web'
            : 'Mobile Phone';
        final occupying =
            conflict['occupyingDevice'] as Map<String, Object?>? ?? const {};
        return _jsonResponse(<String, Object?>{
          'code': 'device_slot_limit_reached',
          'message':
              'Your $slotLabel slot is already signed in on ${occupying['deviceName'] ?? 'another device'} (${occupying['locationLabel'] ?? 'Unknown'}). Sign out of that device in Settings before signing in here.',
          'requestId': 'e2e-req-slot-conflict',
          'details': conflict,
        }, statusCode: 409);
      }

      final devId = (body['deviceId'] as String?) ?? _currentDeviceId;
      _currentDeviceId = devId;
      _userId ??= '00000000-0000-4000-8000-000000000099';

      var method = 'email';
      if (path.contains('/v1/auth/oauth')) {
        method = (body['provider'] as String?) ?? 'google';
        final idToken = (body['idToken'] as String?) ?? '';
        if (idToken.startsWith('mockza_dev_oauth_v1.')) {
          final rawSeg = idToken.substring('mockza_dev_oauth_v1.'.length);
          final rem = rawSeg.length % 4;
          final padded = rem == 0
              ? rawSeg
              : rawSeg.padRight(rawSeg.length + (4 - rem), '=');
          final decoded = jsonDecode(utf8.decode(base64Url.decode(padded)));
          if (decoded is Map<String, Object?>) {
            _email = (decoded['email'] as String?) ?? _email;
            _displayName = (decoded['name'] as String?) ?? _displayName;
          }
        }
      } else {
        _email = (body['email'] as String?) ?? _email;
        _displayName =
            (body['displayName'] as String?) ?? _displayName ?? 'Mahdi';
      }
      _providers.add(method);

      final meta = body['deviceMeta'] as Map<String, Object?>? ?? const {};
      final session = <String, Object?>{
        'sessionId': '00000000-0000-4000-8000-000000000101',
        'deviceId': devId,
        'deviceIdShort':
            '${devId.substring(0, devId.length >= 8 ? 8 : devId.length)}...',
        'slotKind': meta['slotKind'] ?? 'mobile',
        'platform': meta['platform'] ?? 'android',
        'appSurface': meta['appSurface'] ?? 'flutter_app',
        'deviceName': meta['deviceName'] ?? 'Android Phone',
        'locationLabel': 'Tehran, IR',
        'ipMasked': '127.0.0.***',
        'authMethod': method,
        'isCurrentDevice': true,
        'createdAt': '2026-11-17T14:00:00Z',
        'lastSeenAt': '2026-11-17T14:05:00Z',
      };
      _currentSession = session;

      return _jsonResponse(<String, Object?>{
        'accessToken': 'e2e.eyJleHAiOjk5OTk5OTk5OTl9.sig',
        'expiresAt': '2099-01-01T00:00:00Z',
        'deviceId': devId,
        'deviceSecret': 'e2e-device-secret',
        'user': _buildUserJson(),
        'currentSession': session,
        'sessions': _allSessions(),
      }, statusCode: path.contains('/register') ? 201 : 200);
    }

    if (path.contains('/v1/auth/logout')) {
      _currentSession = null;
      _userId = null;
      _email = null;
      _displayName = null;
      return _jsonResponse(<String, Object?>{
        'success': true,
        'signedOut': true,
        'accessToken': 'e2e.eyJleHAiOjk5OTk5OTk5OTl9.sig',
        'deviceId': _currentDeviceId,
        'expiresAt': '2099-01-01T00:00:00Z',
      });
    }

    if (path.contains('/v1/account/devices/revoke-others')) {
      final revoked = remoteSessions
          .map((s) => s['deviceId'])
          .whereType<String>()
          .toList(growable: false);
      remoteSessions.clear();
      return _jsonResponse(<String, Object?>{
        'success': true,
        'revokedDeviceIds': revoked,
        'signedOutCurrentDevice': false,
        'sessions': _allSessions(),
      });
    }

    if (path.contains('/v1/account/devices/') && options.method == 'DELETE') {
      final targetId = path.split('/').last;
      final revokedSelf = targetId == _currentDeviceId;
      if (revokedSelf) {
        _currentSession = null;
        _userId = null;
      } else {
        remoteSessions.removeWhere((s) => s['deviceId'] == targetId);
      }
      return _jsonResponse(<String, Object?>{
        'success': true,
        'revokedDeviceIds': <String>[targetId],
        'signedOutCurrentDevice': revokedSelf,
        'sessions': _allSessions(),
      });
    }

    if (path.contains('/v1/account/devices') ||
        path.contains('/v1/account/me')) {
      final sessions = _allSessions();
      return _jsonResponse(<String, Object?>{
        'isAuthenticated': _userId != null,
        'user': _userId != null ? _buildUserJson() : null,
        'currentDeviceId': _currentDeviceId,
        'devicePolicy': <String, Object?>{
          'maxMobilePhones': 1,
          'maxDesktopWebInstances': 1,
          'mobileOccupied': sessions.any((s) => s['slotKind'] == 'mobile'),
          'desktopWebOccupied': sessions.any(
            (s) => s['slotKind'] == 'desktop_web',
          ),
        },
        'sessions': sessions,
      });
    }

    if (path.contains('/v1/account/device-policy-consent')) {
      _acceptedDevicePolicyAt = '2026-11-17T14:10:00Z';
      return _jsonResponse(_buildUserJson());
    }

    if (path.contains('/v1/auth/renew')) {
      return _jsonResponse(<String, Object?>{
        'accessToken': 'e2e.eyJleHAiOjk5OTk5OTk5OTl9.sig',
      });
    }
    if (path.contains('/v1/account') && options.method == 'DELETE') {
      _currentSession = null;
      remoteSessions.clear();
      _userId = null;
      _email = null;
      return _jsonResponse(<String, Object?>{
        'erasureId': 'e2e-erasure-01',
        'receiptToken': 'e2e-receipt-01',
      });
    }
    if (path.contains('/v1/catalog/manifest')) {
      return _jsonResponse(<String, Object?>{'packs': const <Object?>[]});
    }
    if (path.contains('/v1/drills')) {
      return _jsonResponse(<String, Object?>{'drills': const <Object?>[]});
    }
    if (path.contains('/v1/vocab/deck')) {
      return _jsonResponse(<String, Object?>{'cards': const <Object?>[]});
    }
    return _jsonResponse(<String, Object?>{});
  }

  ResponseBody _jsonResponse(
    Map<String, Object?> body, {
    int statusCode = 200,
  }) => ResponseBody.fromString(
    jsonEncode(body),
    statusCode,
    headers: const <String, List<String>>{
      Headers.contentTypeHeader: <String>[Headers.jsonContentType],
    },
  );
}

/// Hermetic full-router E2E test harness mounting [MockzaApp] with seeded Drift
/// packs, fake media/grading/diagnostic gateways, and viewport control.
final class E2eAppHarness {
  new _({
    required this.db,
    required this.clock,
    required this.storage,
    required this.entropy,
    required this.billingGateway,
    required this.gradingGateway,
    required this.diagnosticGateway,
    required this.audioRecorder,
    required this.audioPlayer,
    required this.tempDir,
    required this.dio,
    required this.httpAdapter,
    required this.authSessionService,
    required this.container,
  });

  /// Creates a fresh hermetic [E2eAppHarness] ready for mounting [MockzaApp].
  factory create({
    AppearanceSettings initialAppearance = const AppearanceSettings(),
    EditionConfig editionConfig = EditionConfig.globalDefault,
  }) {
    final db = createTestDatabase();
    final clock = E2eMutableClock();
    final storage = InMemorySecureStorageGateway();
    final entropy = FixedEntropySource();
    const billing = FakeBillingGateway();
    final grading = E2eGradingGateway();
    final diagnostic = E2eDiagnosticGateway(clock);
    final tempDir = Directory.systemTemp.createTempSync('mockza_e2e_');
    const pathProviderChannel = MethodChannel(
      'plugins.flutter.io/path_provider',
    );
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(pathProviderChannel, (call) async {
          return tempDir.path;
        });
    final recorder = E2eAudioRecorderGateway(tempDir);
    final player = FakeAudioPlayerGateway();
    final crashLog = DeveloperCrashLog(editionConfig.edition);
    final adapter = OfflineE2eHttpAdapter();
    final dio = Dio(BaseOptions(baseUrl: 'https://e2e.mockza.local'))
      ..httpClientAdapter = adapter;
    final authDio = Dio(BaseOptions(baseUrl: 'https://e2e.mockza.local'))
      ..httpClientAdapter = adapter;
    final identityService = SecureIdentityService(
      storage: storage,
      entropy: entropy,
    );
    late final ProviderContainer container;
    final authSessionService = AuthSessionService(
      config: editionConfig,
      identity: identityService,
      clock: clock.asClock(),
      crashLog: crashLog,
      authDio: authDio,
      readDeviceMeta: () => const DeviceClientMeta(
        slotKind: DeviceSlotKind.mobile,
        platform: 'android',
        appSurface: 'flutter_app',
        deviceName: 'E2E Android Phone',
        timezone: 'Asia/Tehran',
      ),
      onRemoteSessionUnlinked: (deviceId) async {
        await container
            .read(profileRepositoryProvider)
            .clearAuthenticatedAccount(deviceId);
      },
    );

    container = ProviderContainer(
      retry: (count, error) => null,
      overrides: [
        editionConfigProvider.overrideWithValue(editionConfig),
        clockProvider.overrideWithValue(clock.asClock()),
        appDatabaseProvider.overrideWithValue(db),
        entropySourceProvider.overrideWithValue(entropy),
        secureStorageGatewayProvider.overrideWithValue(storage),
        billingGatewayProvider.overrideWithValue(billing),
        gradingGatewayProvider.overrideWithValue(grading),
        diagnosticGatewayProvider.overrideWithValue(diagnostic),
        audioRecorderGatewayProvider.overrideWithValue(recorder),
        audioPlayerGatewayProvider.overrideWithValue(player),
        dioProvider.overrideWithValue(dio),
        authSessionServiceProvider.overrideWithValue(authSessionService),
        initialAppearanceSettingsProvider.overrideWithValue(initialAppearance),
      ],
    );

    return E2eAppHarness._(
      db: db,
      clock: clock,
      storage: storage,
      entropy: entropy,
      billingGateway: billing,
      gradingGateway: grading,
      diagnosticGateway: diagnostic,
      audioRecorder: recorder,
      audioPlayer: player,
      tempDir: tempDir,
      dio: dio,
      httpAdapter: adapter,
      authSessionService: authSessionService,
      container: container,
    );
  }

  /// In-memory Drift SQLite database backing the test session.
  final AppDatabase db;

  /// Controllable test wall clock.
  final E2eMutableClock clock;

  /// In-memory secure storage backend.
  final InMemorySecureStorageGateway storage;

  /// Deterministic UUID source.
  final FixedEntropySource entropy;

  /// Controllable billing gateway.
  final FakeBillingGateway billingGateway;

  /// Controllable AI grading gateway returning realistic rubric results.
  final E2eGradingGateway gradingGateway;

  /// Controllable rapid diagnostic gateway.
  final E2eDiagnosticGateway diagnosticGateway;

  /// File-backed fake audio recorder for speaking flows.
  final E2eAudioRecorderGateway audioRecorder;

  /// Controllable fake audio player for listening & diagnostic flows.
  final FakeAudioPlayerGateway audioPlayer;

  /// Temporary workspace cleaned up during [dispose].
  final Directory tempDir;

  /// Offline-adapter [Dio] instance.
  final Dio dio;

  /// Stateful offline HTTP adapter controlling auth/session/slot simulation.
  final OfflineE2eHttpAdapter httpAdapter;

  /// Offline-adapter [AuthSessionService] instance.
  final AuthSessionService authSessionService;

  /// Root Riverpod container passed into [UncontrolledProviderScope].
  final ProviderContainer container;

  /// Seeds offline Reading, Listening, Writing, Speaking, Drill & Vocab data.
  Future<void> seedStarterCatalog(WidgetTester tester) async {
    await tester.runAsync(() async {
      final catalog = container.read(examCatalogRepositoryProvider);
      final vocab = container.read(vocabRepositoryProvider);

      const readingBundle = <String, dynamic>{
        'pack': <String, dynamic>{
          'packId': 'ielts-acad-reading-seed-01',
          'title': 'Urban Canopy Cooling',
          'track': 'academic',
          'durationSeconds': 3600,
        },
        'sections': <dynamic>[
          <String, dynamic>{
            'sectionId': 'r-s1',
            'sectionIndex': 1,
            'title': 'Urban Canopy Cooling',
            'contentText': 'Shade trees lower street temperatures markedly during summer afternoons.\n\nCities pairing tree corridors with reflective roofs reduce cooling energy demand.',
          },
        ],
        'questions': <dynamic>[
          <String, dynamic>{
            'questionId': 'rq-1',
            'sectionId': 'r-s1',
            'questionNumber': 1,
            'questionType': 'true_false_not_given',
            'prompt': 'Street trees lower afternoon air temperatures.',
            'acceptedAnswers': <String>['TRUE'],
            'evidence': <String, dynamic>{
              'paragraphIndex': 0,
              'startOffset': 0,
              'endOffset': 40,
              'exactQuote': 'Shade trees lower street temperatures markedly.',
              'distractorExplanation': 'Paragraph A directly confirms tree canopies reduce street heat.',
            },
          },
          <String, dynamic>{
            'questionId': 'rq-2',
            'sectionId': 'r-s1',
            'questionNumber': 2,
            'questionType': 'multiple_choice',
            'prompt': 'What complements tree corridors for building cooling?',
            'options': <String>[
              'A. Underground tunnels',
              'B. Reflective roofs',
            ],
            'acceptedAnswers': <String>['B'],
            'evidence': <String, dynamic>{
              'paragraphIndex': 1,
              'startOffset': 0,
              'endOffset': 50,
              'exactQuote': 'Cities pairing tree corridors with reflective roofs reduce cooling energy demand.',
              'distractorExplanation':
                  'Reflective roofs are explicitly named in Paragraph B.',
            },
          },
          <String, dynamic>{
            'questionId': 'rq-3',
            'sectionId': 'r-s1',
            'questionNumber': 3,
            'questionType': 'gap_fill',
            'prompt': 'Cooling energy ___ falls when shade increases.',
            'acceptedAnswers': <String>['demand'],
            'maxWords': 1,
          },
        ],
      };

      const listeningBundle = <String, dynamic>{
        'pack': <String, dynamic>{
          'packId': 'ielts-listening-seed-01',
          'title': 'Campus Library Orientation',
          'track': 'shared',
          'accent': 'UK',
          'mediaUrl': '/v1/media/seed/listening_seed.m4a',
          'durationSeconds': 1800,
        },
        'sections': <dynamic>[
          <String, dynamic>{
            'sectionId': 'l-s1',
            'sectionIndex': 1,
            'title': 'Library Orientation Desk',
            'transcript': <Map<String, dynamic>>[
              <String, dynamic>{
                'speaker': 'Librarian',
                'text': 'Quiet individual booths are on the second floor and open at 8:30.',
                'startMs': 0,
                'endMs': 20000,
              },
            ],
          },
        ],
        'questions': <dynamic>[
          <String, dynamic>{
            'questionId': 'lq-1',
            'sectionId': 'l-s1',
            'questionNumber': 1,
            'questionType': 'multiple_choice',
            'prompt': 'Where are the quiet individual study booths located?',
            'options': <String>[
              'A. Ground floor entrance',
              'B. Second floor',
            ],
            'acceptedAnswers': <String>['B'],
          },
          <String, dynamic>{
            'questionId': 'lq-2',
            'sectionId': 'l-s1',
            'questionNumber': 2,
            'questionType': 'gap_fill',
            'prompt': 'The quiet booths open daily at ___.',
            'acceptedAnswers': <String>['8:30'],
            'maxWords': 1,
          },
        ],
      };

      const writingBundle = <String, dynamic>{
        'pack': <String, dynamic>{
          'packId': 'ielts-writing-seed-01',
          'title': 'Cities & Public Transit',
          'track': 'academic',
          'durationSeconds': 3600,
        },
        'sections': <dynamic>[
          <String, dynamic>{
            'sectionId': 'w-t1',
            'sectionIndex': 1,
            'sectionType': 'task1_academic',
            'title': 'Commuter Mode Share Chart',
            'contentText': 'Summarize the main changes in commuter mode share between 2010 and 2025.',
            'durationSeconds': 1200,
            'metadata': <String, dynamic>{'minWords': 20},
          },
          <String, dynamic>{
            'sectionId': 'w-t2',
            'sectionIndex': 2,
            'sectionType': 'task2Essay',
            'title': 'Public Transit Investment',
            'contentText': 'Should city governments prioritize public rail over widening urban highways? Explain your view.',
            'durationSeconds': 2400,
            'metadata': <String, dynamic>{'minWords': 20},
          },
        ],
        'questions': <dynamic>[],
      };

      const speakingBundle = <String, dynamic>{
        'pack': <String, dynamic>{
          'packId': 'ielts-speaking-seed-01',
          'title': 'Study Habits & Books',
          'track': 'shared',
          'durationSeconds': 600,
        },
        'sections': <dynamic>[
          <String, dynamic>{
            'sectionId': 'sp-p1',
            'sectionIndex': 1,
            'title': 'Part 1 Study Routines',
            'durationSeconds': 60,
          },
          <String, dynamic>{
            'sectionId': 'sp-p2',
            'sectionIndex': 2,
            'title': 'Cue Card',
            'contentText': 'Describe a book that helped you learn a skill.\n- what the book was about\n- why it helped you',
            'durationSeconds': 120,
            'metadata': <String, dynamic>{'prepDurationSeconds': 15},
          },
        ],
        'questions': <dynamic>[
          <String, dynamic>{
            'questionId': 'SP1-01',
            'sectionId': 'sp-p1',
            'questionNumber': 1,
            'questionType': 'speaking_part1',
            'prompt': 'Where do you usually read or study?',
          },
          <String, dynamic>{
            'questionId': 'SP2-01',
            'sectionId': 'sp-p2',
            'questionNumber': 2,
            'questionType': 'speaking_part2',
            'prompt': 'Describe a book that helped you learn a new skill.',
          },
        ],
      };

      await catalog.saveCatalogManifestPacks(<Map<String, dynamic>>[
        <String, dynamic>{
          'packId': 'ielts-acad-reading-seed-01',
          'track': 'academic',
          'skill': 'reading',
          'title': 'Urban Canopy Cooling',
          'description': 'Passage & 3 evidence questions',
          'durationSeconds': 3600,
          'questionCount': 3,
          'version': '1.0.0',
        },
        <String, dynamic>{
          'packId': 'ielts-listening-seed-01',
          'track': 'shared',
          'skill': 'listening',
          'title': 'Campus Library Orientation',
          'description': 'Library section with synced transcript',
          'durationSeconds': 1800,
          'questionCount': 2,
          'accent': 'UK',
          'version': '1.0.0',
        },
        <String, dynamic>{
          'packId': 'ielts-writing-seed-01',
          'track': 'academic',
          'skill': 'writing',
          'title': 'Cities & Public Transit',
          'description': 'Task 1 + Task 2 AI writing practice',
          'durationSeconds': 3600,
          'questionCount': 2,
          'version': '1.0.0',
        },
        <String, dynamic>{
          'packId': 'ielts-speaking-seed-01',
          'track': 'shared',
          'skill': 'speaking',
          'title': 'Study Habits & Books',
          'description': 'Part 1 + Cue Card speaking practice',
          'durationSeconds': 600,
          'questionCount': 2,
          'version': '1.0.0',
        },
      ]);

      await catalog.saveExamPayload(
        packId: 'ielts-acad-reading-seed-01',
        bundle: readingBundle,
      );
      await catalog.saveExamPayload(
        packId: 'ielts-listening-seed-01',
        bundle: listeningBundle,
      );
      await catalog.saveExamPayload(
        packId: 'ielts-writing-seed-01',
        bundle: writingBundle,
      );
      await catalog.saveExamPayload(
        packId: 'ielts-speaking-seed-01',
        bundle: speakingBundle,
      );

      await catalog.saveSyncedDrills(<Map<String, dynamic>>[
        <String, dynamic>{
          'drillId': 'ielts-micro-drill-01',
          'title': 'TFNG Precision Sprint',
          'drillType': 'speed_tfng',
          'skill': 'reading',
          'durationSeconds': 180,
          'items': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 'md-1',
              'prompt': 'Direct sunlight warms exposed asphalt faster than shaded soil.',
              'options': <String>['TRUE', 'FALSE', 'NOT GIVEN'],
              'answer': 'TRUE',
              'explanation': 'Exposed surfaces absorb more solar radiation.',
            },
            <String, dynamic>{
              'id': 'md-2',
              'prompt': 'Trees completely eliminate all winter heating costs.',
              'options': <String>['TRUE', 'FALSE', 'NOT GIVEN'],
              'answer': 'FALSE',
              'explanation':
                  'Extreme claims like "completely" are contradicted.',
            },
          ],
        },
      ]);

      await _seedMultiExamStarterCatalog(catalog);

      await vocab.upsertSeedCard(
        cardId: 'seed-mitigate',
        headword: 'mitigate',
        ipa: '/ˈmɪt.ɪ.ɡeɪt/',
        definition: 'Make a harmful condition less severe or painful.',
        topicTag: 'environment',
        contextSentence: 'Urban tree belts mitigate extreme afternoon heat.',
      );
      await vocab.upsertSeedCard(
        cardId: 'seed-ubiquitous',
        headword: 'ubiquitous',
        ipa: '/juːˈbɪk.wɪ.təs/',
        definition: 'Found everywhere across a place or period.',
        topicTag: 'technology',
        contextSentence: 'Smartphones have become ubiquitous in classrooms.',
      );
    });
  }

  /// Marks onboarding complete in SQLite so tests can boot directly into Home.
  Future<void> completeOnboardingSeed(WidgetTester tester) async {
    await tester.runAsync(() async {
      final profileRepo = container.read(profileRepositoryProvider);
      final identity = container.read(secureIdentityServiceProvider);
      final devId =
          (await identity.getOrCreateDeviceId()).valueOrNull ?? 'e2e-dev-01';
      await profileRepo.loadOrInitializePrimary(fallbackDeviceId: devId);
      await profileRepo.completeOnboarding(devId);
    });
  }

  /// Mounts [MockzaApp] at [surfaceSize] and settles initial frames.
  Future<void> mountApp(
    WidgetTester tester, {
    Size surfaceSize = const Size(390, 844),
  }) async {
    tester.view.physicalSize = surfaceSize;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MockzaApp(),
      ),
    );
    await pumpFrames(tester);
  }

  /// Changes the test viewport size and re-pumps cleanly.
  Future<void> setViewportSize(WidgetTester tester, Size size) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1.0;
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
  }

  /// Pumps deterministic animation frames while flushing Drift and dart:io async futures.
  Future<void> pumpFrames(
    WidgetTester tester, {
    Duration step = const Duration(milliseconds: 120),
    int count = 5,
  }) async {
    await tester.pump();
    for (var i = 0; i < count; i += 1) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 15)),
      );
      await tester.pump(step);
    }
    await tester.pump();
  }

  /// Verifies zero Flutter layout overflows or uncaught widget exceptions occurred.
  void expectNoOverflow(WidgetTester tester) {
    final err = tester.takeException();
    expect(err, isNull);
  }

  /// Ensures [finder] is visible in the viewport, taps it, and pumps frames.
  Future<void> tapVisible(WidgetTester tester, Finder finder) async {
    final target = finder.first;
    await tester.ensureVisible(target);
    await tester.pump(const Duration(milliseconds: 50));
    await tester.tap(target);
    await pumpFrames(tester);
  }

  /// Scrolls the primary vertical [Scrollable] until [finder] is built/visible.
  Future<void> scrollToVisible(
    WidgetTester tester,
    Finder finder, {
    double delta = 250,
  }) async {
    if (finder.evaluate().isNotEmpty) return;
    final verticalScrollables = find.byWidgetPredicate(
      (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
    );
    final count = verticalScrollables.evaluate().length;
    if (count == 0) return;
    final primary = verticalScrollables.last;
    for (var i = 0; i < 15 && finder.evaluate().isEmpty; i++) {
      await tester.drag(primary, Offset(0, -delta));
      await tester.pump();
    }
    if (finder.evaluate().isEmpty && count > 1) {
      final fallback = verticalScrollables.first;
      for (var i = 0; i < 15 && finder.evaluate().isEmpty; i++) {
        await tester.drag(fallback, Offset(0, -delta));
        await tester.pump();
      }
    }
  }

  /// Scrolls the primary vertical [Scrollable] until [finder] is built/visible, then taps it.
  Future<void> scrollToAndTap(
    WidgetTester tester,
    Finder finder, {
    double delta = 250,
  }) async {
    await scrollToVisible(tester, finder, delta: delta);
    await tapVisible(tester, finder);
  }

  /// Cleanly tears down [MockzaApp], cancels Drift timers, and deletes temp files.
  Future<void> dispose(WidgetTester tester) async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/path_provider'),
          null,
        );
    await tester.pumpWidget(const SizedBox.shrink());
    container.dispose();
    await tester.pump(const Duration(milliseconds: 25));
    await tester.runAsync(() async {
      await db.close();
      if (tempDir.existsSync()) {
        tempDir.deleteSync(recursive: true);
      }
    });
  }
}

const String _e2eChartSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120"><rect width="240" height="120" fill="#141827"/><rect x="30" y="60" width="32" height="40" fill="#38BDF8"/><rect x="90" y="35" width="32" height="65" fill="#818CF8"/><rect x="150" y="20" width="32" height="80" fill="#34D399"/></svg>';

Future<void> _seedMultiExamStarterCatalog(
  ExamCatalogRepository catalog,
) async {
  const bundles = <Map<String, dynamic>>[
    <String, dynamic>{
      'pack': <String, dynamic>{
        'packId': 'toefl-reading-pack-01',
        'title': 'TOEFL Reading: Complete Words & Daily Life',
        'track': 'toefl',
        'durationSeconds': 1080,
      },
      'sections': <dynamic>[
        <String, dynamic>{
          'sectionId': 'toefl-r-s1',
          'sectionIndex': 1,
          'title': 'Task 1: Complete the Words',
          'contentText': 'Hydroponic greenhouses circulate nutrient water past plant roots so crops grow with minimal soil loss.',
        },
      ],
      'questions': <dynamic>[
        <String, dynamic>{
          'questionId': 'toefl-rq-1',
          'sectionId': 'toefl-r-s1',
          'questionNumber': 1,
          'questionType': 'word_completion',
          'prompt': 'Complete the word: Hydroponic systems cir_____ water continuously.',
          'acceptedAnswers': <String>['circulate'],
          'maxWords': 1,
        },
        <String, dynamic>{
          'questionId': 'toefl-rq-2',
          'sectionId': 'toefl-r-s1',
          'questionNumber': 2,
          'questionType': 'multiple_choice',
          'prompt': 'Why do hydroponic farms use less soil?',
          'options': <String>[
            'A. Roots grow directly in nutrient solution',
            'B. Greenhouses operate only at night',
          ],
          'acceptedAnswers': <String>['A'],
        },
      ],
    },
    <String, dynamic>{
      'pack': <String, dynamic>{
        'packId': 'toefl-listening-pack-01',
        'title': 'TOEFL Listening: Campus & Academic Talk',
        'track': 'toefl',
        'mediaUrl': '/v1/media/seed/listening_seed.m4a',
        'durationSeconds': 960,
      },
      'sections': <dynamic>[
        <String, dynamic>{
          'sectionId': 'toefl-l-s1',
          'sectionIndex': 1,
          'title': 'Part 1: Listen & Choose Response',
          'transcript': <Map<String, dynamic>>[
            <String, dynamic>{
              'speaker': 'Advisor',
              'text': 'Submit your research abstract before Friday afternoon.',
              'startMs': 0,
              'endMs': 12000,
            },
          ],
        },
      ],
      'questions': <dynamic>[
        <String, dynamic>{
          'questionId': 'toefl-lq-1',
          'sectionId': 'toefl-l-s1',
          'questionNumber': 1,
          'questionType': 'multiple_choice',
          'prompt': 'When must the research abstract be submitted?',
          'options': <String>[
            'A. Before Friday afternoon',
            'B. Next Monday morning',
          ],
          'acceptedAnswers': <String>['A'],
        },
      ],
    },
    <String, dynamic>{
      'pack': <String, dynamic>{
        'packId': 'toefl-writing-pack-01',
        'title': 'TOEFL Writing: Sentence Build, Email & Discussion',
        'track': 'toefl',
        'durationSeconds': 1740,
      },
      'sections': <dynamic>[
        <String, dynamic>{
          'sectionId': 'toefl-w-t1',
          'sectionIndex': 1,
          'sectionType': 'toefl_sentence_build',
          'title': 'Build a Sentence',
          'contentText': 'Arrange the academic clause: researchers / clean energy / prioritized / have.',
          'durationSeconds': 300,
          'metadata': <String, dynamic>{'minWords': 6},
        },
        <String, dynamic>{
          'sectionId': 'toefl-w-t2',
          'sectionIndex': 2,
          'sectionType': 'toefl_email',
          'title': 'Write an Email',
          'contentText':
              'Write a concise email requesting extended campus lab hours.',
          'durationSeconds': 420,
          'metadata': <String, dynamic>{'minWords': 12},
        },
        <String, dynamic>{
          'sectionId': 'toefl-w-t3',
          'sectionIndex': 3,
          'sectionType': 'toefl_academic_discussion',
          'title': 'Academic Discussion',
          'contentText': 'Contribute your perspective on hybrid seminars versus in-person workshops.',
          'durationSeconds': 600,
          'metadata': <String, dynamic>{'minWords': 15},
        },
      ],
      'questions': <dynamic>[],
    },
    <String, dynamic>{
      'pack': <String, dynamic>{
        'packId': 'toefl-speaking-pack-01',
        'title': 'TOEFL Speaking: Listen & Repeat + Interview',
        'track': 'toefl',
        'durationSeconds': 480,
      },
      'sections': <dynamic>[
        <String, dynamic>{
          'sectionId': 'toefl-sp-p1',
          'sectionIndex': 1,
          'title': 'Listen & Repeat',
          'durationSeconds': 45,
          'metadata': <String, dynamic>{'prepDurationSeconds': 0},
        },
      ],
      'questions': <dynamic>[
        <String, dynamic>{
          'questionId': 'TOEFL-SP-1',
          'sectionId': 'toefl-sp-p1',
          'questionNumber': 1,
          'questionType': 'speaking_part1',
          'prompt': 'Repeat clearly: The library workshop begins promptly at ten o clock.',
        },
      ],
    },
    <String, dynamic>{
      'pack': <String, dynamic>{
        'packId': 'pte-reading-pack-01',
        'title': 'PTE Reading: Re-order Paragraphs & Blanks',
        'track': 'pte',
        'durationSeconds': 1800,
      },
      'sections': <dynamic>[
        <String, dynamic>{
          'sectionId': 'pte-r-s1',
          'sectionIndex': 1,
          'title': 'Tidal Turbine Sequence',
          'contentText':
              'Tidal energy engineers coat underwater blades carefully.',
        },
      ],
      'questions': <dynamic>[
        <String, dynamic>{
          'questionId': 'pte-rq-1',
          'sectionId': 'pte-r-s1',
          'questionNumber': 1,
          'questionType': 'reorder_sequence',
          'prompt': 'Order these three sentences chronologically.',
          'options': <String>[
            'A. Engineers test turbine coatings in seawater.',
            'B. Clean blades sustain steady power output.',
            'C. Biofouling slows unprotected rotors.',
          ],
          'acceptedAnswers': <String>['C, A, B'],
        },
      ],
    },
    <String, dynamic>{
      'pack': <String, dynamic>{
        'packId': 'pte-listening-pack-01',
        'title': 'PTE Listening: Summary & Dictation',
        'track': 'pte',
        'mediaUrl': '/v1/media/seed/listening_seed.m4a',
        'durationSeconds': 1500,
      },
      'sections': <dynamic>[
        <String, dynamic>{
          'sectionId': 'pte-l-s1',
          'sectionIndex': 1,
          'title': 'Write from Dictation',
          'transcript': <Map<String, dynamic>>[
            <String, dynamic>{
              'speaker': 'Lecturer',
              'text': 'Solar arrays lower peak afternoon grid demand.',
              'startMs': 0,
              'endMs': 15000,
            },
          ],
        },
      ],
      'questions': <dynamic>[
        <String, dynamic>{
          'questionId': 'pte-lq-1',
          'sectionId': 'pte-l-s1',
          'questionNumber': 1,
          'questionType': 'dictation',
          'prompt': 'Type the exact sentence you heard.',
          'acceptedAnswers': <String>[
            'Solar arrays lower peak afternoon grid demand.',
          ],
          'maxWords': 15,
        },
      ],
    },
    <String, dynamic>{
      'pack': <String, dynamic>{
        'packId': 'pte-writing-pack-01',
        'title': 'PTE Writing: Summarize Written Text & Essay',
        'track': 'pte',
        'durationSeconds': 1800,
      },
      'sections': <dynamic>[
        <String, dynamic>{
          'sectionId': 'pte-w-t1',
          'sectionIndex': 1,
          'sectionType': 'pte_summarize_written_text',
          'title': 'Summarize Written Text',
          'contentText': 'Summarize the short passage in one clear sentence.',
          'durationSeconds': 600,
          'metadata': <String, dynamic>{'minWords': 5, 'maxWords': 75},
        },
        <String, dynamic>{
          'sectionId': 'pte-w-t2',
          'sectionIndex': 2,
          'sectionType': 'pte_essay',
          'title': 'PTE Persuasive Essay',
          'contentText': 'Discuss whether cities should expand free bicycle sharing networks.',
          'durationSeconds': 1200,
          'metadata': <String, dynamic>{'minWords': 12, 'maxWords': 300},
        },
      ],
      'questions': <dynamic>[],
    },
    <String, dynamic>{
      'pack': <String, dynamic>{
        'packId': 'pte-speaking-pack-01',
        'title': 'PTE Speaking: Describe Image & Read Aloud',
        'track': 'pte',
        'durationSeconds': 600,
      },
      'sections': <dynamic>[
        <String, dynamic>{
          'sectionId': 'pte-sp-p1',
          'sectionIndex': 1,
          'title': 'Describe Image: Ridership Growth',
          'durationSeconds': 40,
          'metadata': <String, dynamic>{
            'prepDurationSeconds': 25,
            'chartSvg': _e2eChartSvg,
          },
        },
      ],
      'questions': <dynamic>[
        <String, dynamic>{
          'questionId': 'PTE-SP-1',
          'sectionId': 'pte-sp-p1',
          'questionNumber': 1,
          'questionType': 'speaking_part2',
          'prompt': 'Describe the ridership trend displayed in the chart.',
        },
      ],
    },
    <String, dynamic>{
      'pack': <String, dynamic>{
        'packId': 'det-reading-pack-01',
        'title': 'DET Reading: Read and Select + Complete',
        'track': 'det',
        'durationSeconds': 900,
      },
      'sections': <dynamic>[
        <String, dynamic>{
          'sectionId': 'det-r-s1',
          'sectionIndex': 1,
          'title': 'Lexical Screening',
          'contentText': 'Evaluate real English academic words versus invented distractors.',
        },
      ],
      'questions': <dynamic>[
        <String, dynamic>{
          'questionId': 'det-rq-1',
          'sectionId': 'det-r-s1',
          'questionNumber': 1,
          'questionType': 'binary_choice',
          'prompt': 'Is "resilient" a real English word?',
          'options': <String>['YES', 'NO'],
          'acceptedAnswers': <String>['YES'],
        },
        <String, dynamic>{
          'questionId': 'det-rq-2',
          'sectionId': 'det-r-s1',
          'questionNumber': 2,
          'questionType': 'binary_choice',
          'prompt': 'Is "coherent" a real English word?',
          'options': <String>['YES', 'NO'],
          'acceptedAnswers': <String>['YES'],
        },
        <String, dynamic>{
          'questionId': 'det-rq-3',
          'sectionId': 'det-r-s1',
          'questionNumber': 3,
          'questionType': 'binary_choice',
          'prompt': 'Is "plinthorize" a real English word?',
          'options': <String>['YES', 'NO'],
          'acceptedAnswers': <String>['NO'],
        },
        <String, dynamic>{
          'questionId': 'det-rq-4',
          'sectionId': 'det-r-s1',
          'questionNumber': 4,
          'questionType': 'binary_choice',
          'prompt': 'Is "empirical" a real English word?',
          'options': <String>['YES', 'NO'],
          'acceptedAnswers': <String>['YES'],
        },
        <String, dynamic>{
          'questionId': 'det-rq-5',
          'sectionId': 'det-r-s1',
          'questionNumber': 5,
          'questionType': 'binary_choice',
          'prompt': 'Is "mitigate" a real English word?',
          'options': <String>['YES', 'NO'],
          'acceptedAnswers': <String>['YES'],
        },
      ],
    },
    <String, dynamic>{
      'pack': <String, dynamic>{
        'packId': 'det-listening-pack-01',
        'title': 'DET Listening: Listen and Type',
        'track': 'det',
        'mediaUrl': '/v1/media/seed/listening_seed.m4a',
        'durationSeconds': 600,
      },
      'sections': <dynamic>[
        <String, dynamic>{
          'sectionId': 'det-l-s1',
          'sectionIndex': 1,
          'title': 'Listen and Type',
          'transcript': <Map<String, dynamic>>[
            <String, dynamic>{
              'speaker': 'Speaker',
              'text': 'Museums inspire curiosity across every generation.',
              'startMs': 0,
              'endMs': 10000,
            },
          ],
        },
      ],
      'questions': <dynamic>[
        <String, dynamic>{
          'questionId': 'det-lq-1',
          'sectionId': 'det-l-s1',
          'questionNumber': 1,
          'questionType': 'dictation',
          'prompt': 'Type the exact statement you hear.',
          'acceptedAnswers': <String>[
            'Museums inspire curiosity across every generation.',
          ],
          'maxWords': 12,
        },
      ],
    },
    <String, dynamic>{
      'pack': <String, dynamic>{
        'packId': 'det-writing-pack-01',
        'title': 'DET Writing: Write About the Photo & Sample',
        'track': 'det',
        'durationSeconds': 900,
      },
      'sections': <dynamic>[
        <String, dynamic>{
          'sectionId': 'det-w-t1',
          'sectionIndex': 1,
          'sectionType': 'det_write_about_photo',
          'title': 'Write About the Photo',
          'contentText':
              'Write a detailed description of the scene shown below.',
          'durationSeconds': 60,
          'metadata': <String, dynamic>{
            'minWords': 10,
            'chartSvg': _e2eChartSvg,
          },
        },
        <String, dynamic>{
          'sectionId': 'det-w-t2',
          'sectionIndex': 2,
          'sectionType': 'det_writing_sample',
          'title': 'Writing Sample',
          'contentText':
              'Explain how public libraries strengthen neighborhoods.',
          'durationSeconds': 300,
          'metadata': <String, dynamic>{'minWords': 15},
        },
      ],
      'questions': <dynamic>[],
    },
    <String, dynamic>{
      'pack': <String, dynamic>{
        'packId': 'det-speaking-pack-01',
        'title': 'DET Speaking: Interactive Speaking & Sample',
        'track': 'det',
        'durationSeconds': 480,
      },
      'sections': <dynamic>[
        <String, dynamic>{
          'sectionId': 'det-sp-p1',
          'sectionIndex': 1,
          'title': 'Interactive Speaking Prompt',
          'durationSeconds': 90,
          'metadata': <String, dynamic>{'prepDurationSeconds': 0},
        },
      ],
      'questions': <dynamic>[
        <String, dynamic>{
          'questionId': 'DET-SP-1',
          'sectionId': 'det-sp-p1',
          'questionNumber': 1,
          'questionType': 'speaking_part1',
          'prompt':
              'Describe a skill you recently practiced and why it mattered.',
        },
      ],
    },
  ];

  final manifestSummaries = <Map<String, dynamic>>[];
  for (final bundle in bundles) {
    final pack = bundle['pack']! as Map<String, dynamic>;
    final packId = pack['packId']! as String;
    final questions = bundle['questions']! as List<dynamic>;
    final skill = packId.contains('-listening-')
        ? 'listening'
        : (packId.contains('-writing-')
              ? 'writing'
              : (packId.contains('-speaking-') ? 'speaking' : 'reading'));
    await catalog.saveExamPayload(packId: packId, bundle: bundle);
    manifestSummaries.add(<String, dynamic>{
      'packId': packId,
      'track': pack['track'],
      'skill': skill,
      'title': pack['title'],
      'description': 'Official-style $skill simulation pack ($packId)',
      'durationSeconds': pack['durationSeconds'],
      'questionCount': questions.length,
      if (pack.containsKey('mediaUrl')) 'mediaUrl': pack['mediaUrl'],
      'version': '1.0.0',
      'sha256': 'e2e-$packId',
    });
  }
  await catalog.saveCatalogManifestPacks(manifestSummaries);

  await catalog.saveSyncedDrills(<Map<String, dynamic>>[
    <String, dynamic>{
      'drillId': 'toefl-micro-drill-01',
      'drillType': 'ORG',
      'skill': 'reading',
      'title': 'TOEFL Coherence & Words Drill',
      'durationSeconds': 120,
      'items': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'td-1',
          'prompt': 'Which transition shows contrast between studies?',
          'options': <String>['Conversely', 'Furthermore', 'Similarly'],
          'answer': 'Conversely',
          'explanation': 'Conversely signals an opposing relationship.',
        },
      ],
    },
    <String, dynamic>{
      'drillId': 'pte-micro-drill-01',
      'drillType': 'FORM',
      'skill': 'writing',
      'title': 'PTE Summary & Collocation Drill',
      'durationSeconds': 120,
      'items': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'pd-1',
          'prompt': 'Choose the strongest collocation with "evidence":',
          'options': <String>['compelling evidence', 'tall evidence'],
          'answer': 'compelling evidence',
          'explanation': 'Compelling evidence is the natural academic pairing.',
        },
      ],
    },
    <String, dynamic>{
      'drillId': 'det-micro-drill-01',
      'drillType': 'LIT',
      'skill': 'reading',
      'title': 'DET Real-Word Precision Drill',
      'durationSeconds': 90,
      'items': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'dd-1',
          'prompt': 'Identify the real English verb:',
          'options': <String>['substantiate', 'blorptinate'],
          'answer': 'substantiate',
          'explanation': 'Substantiate means to support with proof.',
        },
      ],
    },
  ]);
}

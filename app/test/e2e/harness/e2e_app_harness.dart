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

  final Map<String, ({String attemptId, bool isSpeaking})> _jobs =
      <String, ({String attemptId, bool isSpeaking})>{};

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
      _jobs[jobId] = (attemptId: attemptId, isSpeaking: false);
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
      _jobs[jobId] = (attemptId: attemptId, isSpeaking: true);
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
    return Ok(
      JobPollSnapshot(
        jobId: jobId,
        attemptId: attemptId,
        status: 'completed',
        stage: 'Completed',
        rawResultJson: isSpeaking
            ? _sampleSpeakingJson(attemptId)
            : _sampleWritingJson(attemptId),
      ),
    );
  }

  Map<String, Object?> _sampleWritingJson(String attemptId) =>
      <String, Object?>{
        'attemptId': attemptId,
        'taskType': 'task2Essay',
        'overallBand': 7.0,
        'wordCount': 32,
        'upgradedExcerpt':
            'Public transit investment measurably curtails congestion.',
        'actionableNextStep': 'Expand body paragraph concrete examples.',
        'modelId': 'e2e-rubric-writer',
        'rubricVersion': '2026-11.v1',
        'criteria': <Map<String, Object?>>[
          <String, Object?>{
            'code': 'TR',
            'label': 'Task Response',
            'band': 7.0,
            'evidenceExcerpt': 'Cities benefit from cleaner transit.',
            'feedbackNote': 'Clear position sustained across paragraphs.',
          },
          <String, Object?>{
            'code': 'CC',
            'label': 'Coherence & Cohesion',
            'band': 7.0,
            'evidenceExcerpt': 'Cities benefit from cleaner transit.',
            'feedbackNote': 'Logical progression with clear transitions.',
          },
          <String, Object?>{
            'code': 'LR',
            'label': 'Lexical Resource',
            'band': 7.0,
            'evidenceExcerpt': 'cleaner transit',
            'feedbackNote': 'Natural academic collocations used accurately.',
          },
          <String, Object?>{
            'code': 'GRA',
            'label': 'Grammatical Range',
            'band': 7.0,
            'evidenceExcerpt': 'Cities benefit from cleaner transit.',
            'feedbackNote': 'Accurate complex clause control.',
          },
        ],
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

  Map<String, Object?> _sampleSpeakingJson(
    String attemptId,
  ) => <String, Object?>{
    'attemptId': attemptId,
    'overallBand': 7.0,
    'transcript': 'I usually study at the quiet second-floor campus library.',
    'actionableNextStep':
        'Link personal examples with clearer discourse markers.',
    'modelId': 'e2e-rubric-speaker',
    'rubricVersion': '2026-11.v1',
    'criteria': <Map<String, Object?>>[
      <String, Object?>{
        'code': 'FC',
        'label': 'Fluency & Coherence',
        'band': 7.0,
        'evidenceExcerpt':
            'I usually study at the quiet second-floor campus library.',
        'feedbackNote': 'Steady pace without unnatural pauses.',
      },
      <String, Object?>{
        'code': 'LR',
        'label': 'Lexical Resource',
        'band': 7.0,
        'evidenceExcerpt': 'campus library',
        'feedbackNote': 'Appropriate everyday and study vocabulary.',
      },
      <String, Object?>{
        'code': 'GRA',
        'label': 'Grammatical Range',
        'band': 7.0,
        'evidenceExcerpt': 'I usually study',
        'feedbackNote': 'Clear habitual tense control.',
      },
      <String, Object?>{
        'code': 'PR',
        'label': 'Pronunciation',
        'band': 7.0,
        'evidenceExcerpt': 'second-floor campus library',
        'feedbackNote': 'Clear intelligibility across phrases.',
      },
    ],
    'transcriptSegments': const <Map<String, Object?>>[],
    'vocabUpgrades': const <Map<String, Object?>>[],
  };

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
    const crashLog = DeveloperCrashLog(AppEdition.global);
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
      config: EditionConfig.globalDefault,
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
        editionConfigProvider.overrideWithValue(EditionConfig.globalDefault),
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

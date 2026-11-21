import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/linguistic_gateway.dart';
import 'package:mockza/services/media_bytes_platform.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/register_gear_ladder_card.dart';
import 'package:mockza/theme/primitives.dart';

/// Mockza Signature 3-Gear Register Shifter screen (`/register-shifter` & `/register-shifter/:runId`).
class RegisterShifterScreen extends ConsumerStatefulWidget {
  /// Creates a [RegisterShifterScreen].
  const new({
    this.runId,
    super.key,
  });

  /// Optional run UUID.
  final String? runId;

  @override
  ConsumerState<RegisterShifterScreen> createState() =>
      _RegisterShifterScreenState();
}

class _RegisterShifterScreenState extends ConsumerState<RegisterShifterScreen> {
  final TextEditingController _topicCtrl = TextEditingController();
  bool _recording = false;
  bool _processing = false;
  int _selectedGear = 2;
  DateTime? _recordingStartedAt;
  String? _activeRecordingPath;
  RegisterShifterResultDto? _result;
  final Set<String> _savedPhrases = <String>{};
  String? _repeatSummary;
  String? _error;

  @override
  void dispose() {
    _topicCtrl.dispose();
    super.dispose();
  }

  Future<void> _toggleRecordAndShift() async {
    final recorder = ref.read(audioRecorderGatewayProvider);
    final gateway = ref.read(linguisticGatewayProvider);
    final grading = ref.read(gradingGatewayProvider);
    final clock = ref.read(clockProvider);
    final entropy = ref.read(entropySourceProvider);
    final isRtl = ref.read(editionConfigProvider).edition == AppEdition.iran;

    setState(() => _error = null);
    if (!_recording) {
      final path = await createTempRecordingPath(
        'shifter_${clock.now().millisecondsSinceEpoch}.m4a',
      );
      _activeRecordingPath = path;
      _recordingStartedAt = clock.now();
      final startRes = await recorder.startRecording(outputPath: path);
      if (!mounted) return;
      startRes.when(
        success: (_) => setState(() => _recording = true),
        failure: (f) => setState(() => _error = f.message),
      );
      return;
    }

    setState(() {
      _recording = false;
      _processing = true;
    });
    final stopRes = await recorder.stopRecording();
    final recordedPath = stopRes.valueOrNull ?? _activeRecordingPath;
    _activeRecordingPath = null;
    if (recordedPath == null || recordedPath.isEmpty) {
      if (mounted) {
        setState(() {
          _processing = false;
          _error = stopRes.failureOrNull?.message ?? 'Recording failed.';
        });
      }
      return;
    }
    final bytes = await readRecordedAudioBytes(recordedPath);
    if (!mounted) return;
    if (bytes == null || bytes.isEmpty) {
      setState(() {
        _processing = false;
        _error = isRtl
            ? 'صدایی ضبط نشد؛ لطفاً دوباره تلاش کنید.'
            : 'Recorded audio bytes could not be read.';
      });
      return;
    }

    final startedAt = _recordingStartedAt ?? clock.now();
    final elapsedSec =
        clock.now().difference(startedAt).inMilliseconds / 1000.0;
    final attemptId = entropy.nextUuidV4();
    final presignRes = await grading.presignAudioUpload(
      attemptId: attemptId,
      partIndex: 1,
      byteLength: bytes.length,
      contentType: recorder.activeContentType,
    );
    final presigned = presignRes.valueOrNull;
    if (presigned == null) {
      if (mounted) {
        setState(() {
          _processing = false;
          _error =
              presignRes.failureOrNull?.message ?? 'Upload presign failed.';
        });
      }
      return;
    }
    await grading.uploadAudioBytes(
      uploadUrl: presigned.uploadUrl,
      bytes: bytes,
      contentType: recorder.activeContentType,
    );

    final jobRes = await gateway.enqueueRegisterShift(
      objectKey: presigned.objectKey,
      examTrack: 'ielts_academic',
      durationSeconds: elapsedSec.clamp(5, 45).toDouble(),
      topicHint: _topicCtrl.text.trim().isNotEmpty
          ? _topicCtrl.text.trim()
          : null,
    );
    final jobId = jobRes.valueOrNull;
    if (jobId == null) {
      if (mounted) {
        setState(() {
          _processing = false;
          _error = jobRes.failureOrNull?.message ?? 'Register shift failed.';
        });
      }
      return;
    }

    for (var i = 0; i < 16 && mounted; i++) {
      final poll = await gateway.pollAdvancedJob(jobId);
      final snap = poll.valueOrNull;
      if (snap != null &&
          snap.status == 'completed' &&
          snap.advancedResult != null) {
        setState(() {
          _result = RegisterShifterResultDto.fromJson(snap.advancedResult!);
          _processing = false;
          _selectedGear = 2;
        });
        return;
      }
      if (snap != null && snap.status == 'failed') {
        setState(() {
          _processing = false;
          _error = isRtl
              ? 'تبدیل لحن ناموفق بود.'
              : 'Register Shift job failed.';
        });
        return;
      }
      await Future<void>.delayed(const Duration(microseconds: 400000));
    }
    if (mounted) setState(() => _processing = false);
  }

  Future<void> _saveToSm2(String phrase, String rationale) async {
    final vocab = ref.read(vocabRepositoryProvider);
    final isRtl = ref.read(editionConfigProvider).edition == AppEdition.iran;
    await vocab.captureMistakeToDeck(
      cardId:
          'shifter-${phrase.toLowerCase().replaceAll(RegExp('[^a-z0-9]+'), '-')}',
      headword: phrase,
      definition: rationale,
      glossFa: isRtl ? rationale : null,
      topicTag: 'register_shifter',
      contextSentence: _result?.academic,
      sourceSkill: 'speaking',
      sourceAttemptId: _result?.runId,
      sourceRefLabel: 'Register Shifter',
    );
    if (mounted) {
      setState(() => _savedPhrases.add(phrase));
    }
  }

  Future<void> _verifyRepeatQuick() async {
    final r = _result;
    if (r == null) return;
    final res = await ref
        .read(linguisticGatewayProvider)
        .verifyRepeatAloud(
          runId: r.runId,
          gearLevel: _selectedGear == 1 ? 1 : 2,
          expectedSentence: r.repeatSentence,
          targetPhrases: r.targetPhrases.isNotEmpty
              ? r.targetPhrases
              : <String>[
                  r.highlights.firstOrNull?.upgradedPhrase ?? 'academic',
                ],
          objectKey: 'users/device/repeat-check.m4a',
        );
    if (!mounted) return;
    res.when(
      success: (v) => setState(
        () => _repeatSummary =
            'Fluency ${v.fluencyScore}/5 · ${v.matchedTargets.length} targets verified',
      ),
      failure: (f) => setState(() => _error = f.message),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isRtl = ref.watch(editionConfigProvider).edition == AppEdition.iran;

    return MzScaffold(
      appBar: AppBar(
        title: Text(isRtl ? 'تغییردهنده لحن ۳ دنده' : 'Register Shifter'),
      ),
      body: ListView(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
        children: <Widget>[
          MzCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  isRtl
                      ? 'یک ویس ۳۰ ثانیه‌ای خودمانی ضبط کنید و معادل محیط کار و آکادمیک ۸.۵ را ببینید:'
                      : 'Record 5–45s casually and compare Casual, Workplace, and Academic Band 8.5 registers:',
                  style: typography.body.copyWith(color: colors.textSecondary),
                ),
                const SizedBox(height: SpacingTokens.sm),
                TextField(
                  controller: _topicCtrl,
                  decoration: InputDecoration(
                    hintText: isRtl
                        ? 'موضوع اختیاری (فیلم، کار، روزمره)'
                        : 'Optional topic hint...',
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: SpacingTokens.md),
                PrimaryButton(
                  key: const ValueKey<String>('shifter_record_btn'),
                  label: _recording
                      ? (isRtl ? 'توقف و تبدیل لحن' : 'Stop & Shift Register')
                      : (isRtl ? 'ضبط ویس خودمانی' : 'Record 30s Casual Clip'),
                  glyph: LucideGlyph.mic,
                  isLoading: _processing,
                  onPressed: _processing ? null : _toggleRecordAndShift,
                ),
                if (_error != null) ...<Widget>[
                  const SizedBox(height: SpacingTokens.sm),
                  Text(
                    _error!,
                    style: typography.caption.copyWith(color: colors.error),
                  ),
                ],
              ],
            ),
          ),
          if (_result != null) ...<Widget>[
            const SizedBox(height: SpacingTokens.md),
            RegisterGearLadderCard(
              result: _result!,
              selectedGear: _selectedGear,
              isRtl: isRtl,
              savedPhrases: _savedPhrases,
              onSelectGear: (g) => setState(() => _selectedGear = g),
              onSavePhrase: _saveToSm2,
            ),
            const SizedBox(height: SpacingTokens.md),
            MzCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Text(
                    isRtl
                        ? 'حافظه عضلانی: با صدای بلند تکرار کنید'
                        : 'Muscle Memory: Repeat Target Sentence Aloud',
                    style: typography.cardTitle.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  LtrExamBoundary(
                    child: Text(
                      _result!.repeatSentence,
                      style: typography.body.copyWith(
                        color: colors.textPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  SecondaryButton(
                    key: const ValueKey<String>('shifter_verify_repeat_btn'),
                    label: isRtl
                        ? 'بررسی تلفظ و انتقال'
                        : 'Verify Repeat-Aloud',
                    glyph: LucideGlyph.volume2,
                    onPressed: _verifyRepeatQuick,
                  ),
                  if (_repeatSummary != null) ...<Widget>[
                    const SizedBox(height: SpacingTokens.xs),
                    LtrExamBoundary(
                      child: Text(
                        _repeatSummary!,
                        key: const ValueKey<String>('shifter_repeat_result'),
                        style: typography.caption.copyWith(
                          color: colors.success,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

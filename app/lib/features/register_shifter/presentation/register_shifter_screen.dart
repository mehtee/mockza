import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/localization/edition_copy.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/linguistic_gateway.dart';
import 'package:mockza/services/media_bytes_platform.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/register_gear_ladder_card.dart';
import 'package:mockza/theme/primitives.dart';

const List<({String label, String labelFa, String topic, String text})>
_kShifterSamples =
    <({String label, String labelFa, String topic, String text})>[
      (
        label: 'Work Standup',
        labelFa: 'جلسه کاری',
        topic: 'Workplace',
        text: 'Today our team had a long meeting and the new feature is kind of late, so we need to fix two bugs first.',
      ),
      (
        label: 'Opinion on AI',
        labelFa: 'نظر درباره هوش مصنوعی',
        topic: 'Technology & AI',
        text: 'I think AI tools are really helpful for students, but sometimes people rely on them too much without thinking.',
      ),
      (
        label: 'Daily Life',
        labelFa: 'زندگی روزمره',
        topic: 'Travel & Culture',
        text: 'Last weekend I went to a quiet coffee shop near the park and finished reading a really interesting book.',
      ),
    ];

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
  final TextEditingController _textInputCtrl = TextEditingController();
  bool _textMode = false;
  bool _recording = false;
  bool _processing = false;
  String _processingStage = '';
  bool _repeatRecording = false;
  bool _repeatVerifying = false;
  int _selectedGear = 2;
  DateTime? _recordingStartedAt;
  String? _activeRecordingPath;
  String? _repeatRecordingPath;
  AdvancedQuotaDto? _quota;
  RegisterShifterResultDto? _result;
  final Set<String> _savedPhrases = <String>{};
  String? _repeatSummary;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_loadQuota());
  }

  Future<void> _loadQuota() async {
    final res = await ref.read(linguisticGatewayProvider).fetchAdvancedQuota();
    if (!mounted) return;
    if (res.valueOrNull != null) {
      setState(() => _quota = res.valueOrNull);
    }
  }

  Future<String> _resolveExamTrack() async {
    try {
      final profile = await ref
          .read(profileRepositoryProvider)
          .loadOrInitializePrimary();
      if (profile.examId.isNotEmpty) return profile.examId;
    } on Object {
      // Fallback safely in isolated tests.
    }
    return 'ielts_academic';
  }

  @override
  void dispose() {
    _topicCtrl.dispose();
    _textInputCtrl.dispose();
    super.dispose();
  }

  Future<void> _pollJob(String jobId) async {
    final gateway = ref.read(linguisticGatewayProvider);
    final outcome = await watchAdvancedJobUntilDone<RegisterShifterResultDto>(
      gateway,
      jobId: jobId,
      parseResult: RegisterShifterResultDto.fromJson,
      isCancelled: () => !mounted,
      onStage: (stage) {
        if (mounted) setState(() => _processingStage = stage);
      },
    );
    if (!mounted) return;
    outcome.when(
      success: (res) async {
        unawaited(_logShifterProgress());
        var defaultGear = 2;
        try {
          final cached = await ref
              .read(personalizationRepositoryProvider)
              .getCachedState();
          final band = cached?.liveBand.currentBand;
          if (band != null) {
            defaultGear = band >= 7.0 ? 3 : (band < 5.5 ? 1 : 2);
          }
        } on Object {
          // Keep neutral default Gear 2.
        }
        if (!mounted) return;
        setState(() {
          _result = res;
          _processing = false;
          _processingStage = '';
          _selectedGear = defaultGear;
        });
      },
      failure: (f) => setState(() {
        _processing = false;
        _processingStage = '';
        _error = f.message;
      }),
    );
  }

  Future<void> _logShifterProgress() async {
    try {
      await ref
          .read(progressRepositoryProvider)
          .logTodayActivity(studySeconds: 120, completedItems: 1);
    } on Object {
      // Ignore in isolated widget tests.
    }
  }

  Future<void> _shiftText() async {
    final isRtl = ref.read(editionConfigProvider).edition == AppEdition.iran;
    final raw = _textInputCtrl.text.trim();
    if (raw.length < 15) {
      setState(
        () => _error = isRtl
            ? 'لطفاً حداقل ۱۵ کاراکتر (یک جمله کامل) بنویسید.'
            : 'Write at least one full casual sentence (15+ characters).',
      );
      return;
    }
    setState(() {
      _error = null;
      _processing = true;
      _processingStage = isRtl
          ? 'در حال تحلیل و ارتقای جمله...'
          : 'Rewriting across 3 levels...';
    });
    final examTrack = await _resolveExamTrack();
    final jobRes = await ref
        .read(linguisticGatewayProvider)
        .enqueueRegisterShiftFromText(
          rawText: raw,
          examTrack: examTrack,
          topicHint: _topicCtrl.text.trim().isNotEmpty
              ? _topicCtrl.text.trim()
              : null,
        );
    final jobId = jobRes.valueOrNull;
    if (jobId == null) {
      if (mounted) {
        setState(() {
          _processing = false;
          _processingStage = '';
          _error =
              jobRes.failureOrNull?.message ??
              (isRtl ? 'تبدیل لحن ناموفق بود.' : 'Register shift failed.');
        });
      }
      return;
    }
    await _pollJob(jobId);
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
          _error =
              stopRes.failureOrNull?.message ??
              (isRtl ? 'ضبط صدا ناموفق بود.' : 'Recording failed.');
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
              presignRes.failureOrNull?.message ??
              (isRtl
                  ? 'آماده‌سازی آپلود فایل صوتی ناموفق بود.'
                  : 'Upload presign failed.');
        });
      }
      return;
    }
    await grading.uploadAudioBytes(
      uploadUrl: presigned.uploadUrl,
      bytes: bytes,
      contentType: recorder.activeContentType,
    );

    final examTrack = await _resolveExamTrack();
    final jobRes = await gateway.enqueueRegisterShift(
      objectKey: presigned.objectKey,
      examTrack: examTrack,
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
          _error =
              jobRes.failureOrNull?.message ??
              (isRtl ? 'تبدیل لحن ناموفق بود.' : 'Register shift failed.');
        });
      }
      return;
    }

    await _pollJob(jobId);
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
    final recorder = ref.read(audioRecorderGatewayProvider);
    final grading = ref.read(gradingGatewayProvider);
    final clock = ref.read(clockProvider);
    final entropy = ref.read(entropySourceProvider);
    final isRtl = ref.read(editionConfigProvider).edition == AppEdition.iran;

    setState(() => _error = null);
    if (!_repeatRecording) {
      final path = await createTempRecordingPath(
        'repeat_${clock.now().millisecondsSinceEpoch}.m4a',
      );
      _repeatRecordingPath = path;
      final startRes = await recorder.startRecording(outputPath: path);
      if (!mounted) return;
      startRes.when(
        success: (_) => setState(() => _repeatRecording = true),
        failure: (f) => setState(() => _error = f.message),
      );
      return;
    }

    setState(() {
      _repeatRecording = false;
      _repeatVerifying = true;
    });
    final stopRes = await recorder.stopRecording();
    final recordedPath = stopRes.valueOrNull ?? _repeatRecordingPath;
    _repeatRecordingPath = null;
    if (recordedPath == null || recordedPath.isEmpty) {
      if (mounted) {
        setState(() {
          _repeatVerifying = false;
          _error =
              stopRes.failureOrNull?.message ??
              (isRtl
                  ? 'ضبط صدای تکرار ناموفق بود.'
                  : 'Repeat-aloud recording failed.');
        });
      }
      return;
    }
    final bytes = await readRecordedAudioBytes(recordedPath);
    if (!mounted) return;
    if (bytes == null || bytes.isEmpty) {
      setState(() {
        _repeatVerifying = false;
        _error = isRtl
            ? 'صدایی برای بررسی تلفظ دریافت نشد.'
            : 'Repeat audio bytes could not be read.';
      });
      return;
    }

    final attemptId = entropy.nextUuidV4();
    final presignRes = await grading.presignAudioUpload(
      attemptId: attemptId,
      partIndex: 2,
      byteLength: bytes.length,
      contentType: recorder.activeContentType,
    );
    final presigned = presignRes.valueOrNull;
    if (presigned == null) {
      if (mounted) {
        setState(() {
          _repeatVerifying = false;
          _error =
              presignRes.failureOrNull?.message ?? 'Upload presign failed.';
        });
      }
      return;
    }
    final uploadRes = await grading.uploadAudioBytes(
      uploadUrl: presigned.uploadUrl,
      bytes: bytes,
      contentType: recorder.activeContentType,
    );
    if (uploadRes.isFailure) {
      if (mounted) {
        setState(() {
          _repeatVerifying = false;
          _error = uploadRes.failureOrNull?.message ?? 'Audio upload failed.';
        });
      }
      return;
    }

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
          objectKey: presigned.objectKey,
        );
    if (!mounted) return;
    res.when(
      success: (v) => setState(() {
        _repeatVerifying = false;
        _repeatSummary = isRtl
            ? 'روانی گفتار: ${EdgeNumerals.toPersianDigits(v.fluencyScore)} از ۵ · ${EdgeNumerals.toPersianDigits(v.matchedTargets.length)} عبارت هدف تأیید شد'
            : 'Fluency ${v.fluencyScore}/5 · ${v.matchedTargets.length} targets verified';
      }),
      failure: (f) => setState(() {
        _repeatVerifying = false;
        _error = f.message;
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isRtl = ref.watch(editionConfigProvider).edition == AppEdition.iran;

    return MzScaffold(
      appBar: AppBar(
        title: Text(AppLocalizations.of(context).registerShifterTitle),
      ),
      body: ListView(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
        children: <Widget>[
          MzCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                if (_quota != null) ...<Widget>[
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: MzChip(
                      label: _quota!.isPro
                          ? (isRtl
                                ? '${EdgeNumerals.toPersianDigits(_quota!.shifterRemainingToday)} ارتقا باقی‌مانده امروز'
                                : '${_quota!.shifterRemainingToday} upgrades left today')
                          : _quota!.freeSampleUsed
                          ? (isRtl
                                ? 'نمونه رایگان مصرف شد'
                                : 'Free sample used')
                          : (isRtl
                                ? '۱ نمونه رایگان موجود'
                                : '1 free sample available'),
                      variant: _quota!.isPro
                          ? MzChipVariant.target
                          : MzChipVariant.neutral,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                ],
                Text(
                  isRtl
                      ? 'صحبت کنید یا جمله خودمانی خود را بنویسید تا معادل روزمره، محیط کار و نمره ۸+ را ببینید:'
                      : 'Speak or type a casual thought to compare Everyday, Workplace, and Exam Band 8+ registers:',
                  style: typography.body.copyWith(color: colors.textSecondary),
                ),
                const SizedBox(height: SpacingTokens.sm),
                Wrap(
                  spacing: SpacingTokens.xs,
                  children: <Widget>[
                    ChoiceChip(
                      key: const ValueKey<String>('shifter_mode_voice'),
                      label: Text(isRtl ? 'ضبط صدا' : 'Speak (Mic)'),
                      selected: !_textMode,
                      onSelected: (_) => setState(() {
                        _textMode = false;
                        _error = null;
                      }),
                    ),
                    ChoiceChip(
                      key: const ValueKey<String>('shifter_mode_text'),
                      label: Text(
                        isRtl ? 'نوشتن جمله (بدون میکروفون)' : 'Type Sentence',
                      ),
                      selected: _textMode,
                      onSelected: (_) => setState(() {
                        _textMode = true;
                        _error = null;
                      }),
                    ),
                  ],
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
                if (!_textMode)
                  PrimaryButton(
                    key: const ValueKey<String>('shifter_record_btn'),
                    label: _recording
                        ? (isRtl ? 'توقف و تبدیل لحن' : 'Stop & Shift Register')
                        : (isRtl
                              ? 'ضبط ویس خودمانی'
                              : 'Record 30s Casual Clip'),
                    glyph: LucideGlyph.mic,
                    isLoading: _processing,
                    onPressed: _processing ? null : _toggleRecordAndShift,
                  )
                else ...<Widget>[
                  Wrap(
                    spacing: SpacingTokens.xs,
                    runSpacing: SpacingTokens.xs,
                    children: _kShifterSamples
                        .map(
                          (s) => ActionChip(
                            label: Text(isRtl ? s.labelFa : s.label),
                            onPressed: () {
                              setState(() {
                                _textInputCtrl.text = s.text;
                                _topicCtrl.text = s.topic;
                                _error = null;
                              });
                            },
                          ),
                        )
                        .toList(growable: false),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  TextField(
                    key: const ValueKey<String>('shifter_text_input'),
                    controller: _textInputCtrl,
                    textDirection: TextDirection.ltr,
                    maxLines: 3,
                    onChanged: (_) => setState(() => _error = null),
                    decoration: InputDecoration(
                      hintText: isRtl
                          ? 'یک جمله انگلیسی بنویسید تا در ۳ سطح ارتقا یابد...'
                          : 'Write a casual English sentence to upgrade across 3 levels...',
                      hintTextDirection: isRtl
                          ? TextDirection.rtl
                          : TextDirection.ltr,
                      helperText: isRtl
                          ? 'حداقل ۱۵ کاراکتر (${EdgeNumerals.toPersianDigits(_textInputCtrl.text.trim().length)} / ۱۵)'
                          : 'Minimum 15 characters (${_textInputCtrl.text.trim().length} / 15)',
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  PrimaryButton(
                    key: const ValueKey<String>('shifter_submit_text_btn'),
                    label: isRtl
                        ? 'نمایش ۳ سطح گفتار'
                        : 'Upgrade Into 3 Levels',
                    glyph: LucideGlyph.sparkles,
                    isLoading: _processing,
                    onPressed: _processing ? null : _shiftText,
                  ),
                ],
                if (_processingStage.isNotEmpty) ...<Widget>[
                  const SizedBox(height: SpacingTokens.xs),
                  Text(
                    EditionCopy.localizeWorkerStage(
                      _processingStage,
                      isIran: isRtl,
                    ),
                    style: typography.caption.copyWith(color: colors.primary),
                  ),
                ],
                if (_error != null) ...<Widget>[
                  const SizedBox(height: SpacingTokens.sm),
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Text(
                          _error!,
                          style: typography.caption.copyWith(
                            color: colors.error,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: () => context.push(AppRoutes.paywall),
                        child: Text(isRtl ? 'مشاهده اشتراک' : 'Plans'),
                      ),
                    ],
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
                    label: _repeatRecording
                        ? (isRtl ? 'توقف و بررسی تلفظ' : 'Stop & Verify Repeat')
                        : (isRtl
                              ? 'ضبط و بررسی تلفظ با صدای بلند'
                              : 'Record & Verify Repeat-Aloud'),
                    glyph: _repeatRecording
                        ? LucideGlyph.mic
                        : LucideGlyph.volume2,
                    onPressed: _repeatVerifying ? null : _verifyRepeatQuick,
                  ),
                  if (_repeatSummary != null && isRtl) ...<Widget>[
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      _repeatSummary!,
                      key: const ValueKey<String>(
                        'shifter_repeat_result',
                      ),
                      style: typography.caption.copyWith(
                        color: colors.success,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  if (_repeatSummary != null && !isRtl) ...<Widget>[
                    const SizedBox(height: SpacingTokens.xs),
                    LtrExamBoundary(
                      child: Text(
                        _repeatSummary!,
                        key: const ValueKey<String>(
                          'shifter_repeat_result',
                        ),
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

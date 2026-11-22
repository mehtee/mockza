import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/media_bytes_platform.dart';
import 'package:mockza/services/personalization_gateway.dart';
import 'package:mockza/services/speech_practice_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/inline_listen_button.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_toast.dart';
import 'package:mockza/theme/primitives.dart';

/// Shared Shadow Pronunciation Practice Studio modal sheet:
/// 1) Kokoro-82m reference audio (1.0x & 0.8x)
/// 2) Mic record + amplitude bar + local replay
/// 3) SeaweedFS/R2 upload + Gemini 3.1 Flash Lite word-by-word IPA & EN/FA coaching
/// 4) Cross-device synced history replay
class SpeechPracticeSheet extends ConsumerStatefulWidget {
  /// Creates a [SpeechPracticeSheet].
  const new({
    required this.targetText,
    required this.practiceKind,
    this.sourceRefType,
    this.sourceRefId,
    this.sourceContext = 'vocab',
    super.key,
  });

  /// Target English word, phrase, or sentence.
  final String targetText;

  /// Classification (`word`, `collocation`, or `sentence`).
  final String practiceKind;

  /// Optional linked entity type (`vocab_card`, `reading_passage`, `coach_upgrade`, etc.).
  final String? sourceRefType;

  /// Optional linked entity identifier.
  final String? sourceRefId;

  /// TTS billing/tracing context.
  final String sourceContext;

  /// Opens the Shadow Pronunciation Practice Studio as a modal bottom sheet.
  static Future<void> show(
    BuildContext context, {
    required String targetText,
    String practiceKind = 'sentence',
    String? sourceRefType,
    String? sourceRefId,
    String sourceContext = 'vocab',
  }) => showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => FractionallySizedBox(
      heightFactor: 0.9,
      child: SpeechPracticeSheet(
        targetText: targetText,
        practiceKind: practiceKind,
        sourceRefType: sourceRefType,
        sourceRefId: sourceRefId,
        sourceContext: sourceContext,
      ),
    ),
  );

  @override
  ConsumerState<SpeechPracticeSheet> createState() =>
      _SpeechPracticeSheetState();
}

class _SpeechPracticeSheetState extends ConsumerState<SpeechPracticeSheet> {
  bool _isRecording = false;
  bool _isAnalyzing = false;
  double _amplitude = 0;
  int _elapsedSeconds = 0;
  String? _recordedPath;
  Uint8List? _recordedBytes;
  PronunciationPracticeItemDto? _latestResult;
  List<PronunciationPracticeItemDto> _history =
      const <PronunciationPracticeItemDto>[];
  String _accent = 'us';
  PronunciationWordFeedbackDto? _selectedWord;
  int? _remainingQuota;
  int? _dailyQuotaLimit;
  String? _errorText;
  String? _playingPracticeId;

  StreamSubscription<double>? _ampSub;
  Timer? _tickTimer;

  static const int _maxRecordSeconds = 30;

  @override
  void initState() {
    super.initState();
    unawaited(_loadInitialState());
  }

  String get _voiceId => _accent == 'uk' ? 'bf_emma' : 'af_bella';

  @override
  void dispose() {
    _tickTimer?.cancel();
    unawaited(_ampSub?.cancel() ?? Future<void>.value());
    super.dispose();
  }

  Future<void> _loadInitialState() async {
    try {
      final repo = ref.read(personalizationRepositoryProvider);
      final savedAccent = await repo.getPreferredTtsAccent();
      ref.read(preferredTtsAccentProvider.notifier).setAccent(savedAccent);
      if (mounted) {
        setState(() => _accent = savedAccent);
      }
      final local = await repo.listLocalPronunciationHistory(limit: 8);
      if (mounted && local.isNotEmpty) {
        setState(() {
          _history = local;
          _latestResult ??= local.first;
        });
      }

      final remote = await ref
          .read(speechPracticeGatewayProvider)
          .listHistoryPage(sourceRefId: widget.sourceRefId, limit: 8);
      if (!mounted) return;
      if (remote case Ok<PronunciationHistoryPageDto, Failure>(:final value)) {
        for (final item in value.items) {
          await repo.savePronunciationPractice(item);
        }
        if (mounted) {
          setState(() {
            if (value.items.isNotEmpty) {
              _history = value.items;
              _latestResult ??= value.items.first;
            }
            _remainingQuota = value.remainingDailyQuota ?? _remainingQuota;
            _dailyQuotaLimit = value.dailyQuotaLimit ?? _dailyQuotaLimit;
          });
        }
      }
    } on Object {
      // Preserve offline/local state silently.
    }
  }

  Future<void> _selectAccent(String accent) async {
    final normalized = accent == 'uk' ? 'uk' : 'us';
    setState(() => _accent = normalized);
    ref.read(preferredTtsAccentProvider.notifier).setAccent(normalized);
    try {
      await ref
          .read(personalizationRepositoryProvider)
          .savePreferredTtsAccent(normalized);
      unawaited(
        ref
            .read(personalizationGatewayProvider)
            .updateProfile(preferredTtsAccent: normalized)
            .then<void>((_) {}, onError: (_) {}),
      );
    } on Object {
      // Offline safe.
    }
  }

  Future<void> _startRecording() async {
    final recorder = ref.read(audioRecorderGatewayProvider);
    final permRes = await recorder.hasPermission();
    if (!mounted) return;
    if (permRes.isErr || !(permRes.valueOrNull ?? false)) {
      setState(() {
        _errorText =
            permRes.failureOrNull?.message ??
            'Microphone permission is required to record your pronunciation.';
      });
      return;
    }

    final nowMs = ref.read(clockProvider).now().millisecondsSinceEpoch;
    final path = await createTempRecordingPath('speech_practice_$nowMs.m4a');
    final startRes = await recorder.startRecording(outputPath: path);
    if (!mounted) return;
    if (startRes.isErr) {
      setState(() {
        _errorText =
            startRes.failureOrNull?.message ?? 'Could not start recording.';
      });
      return;
    }

    unawaited(_ampSub?.cancel() ?? Future<void>.value());
    _ampSub = recorder.watchAmplitude().listen((amp) {
      if (mounted) setState(() => _amplitude = amp.clamp(0.0, 1.0));
    });
    _tickTimer?.cancel();
    _elapsedSeconds = 0;
    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final next = _elapsedSeconds + 1;
      setState(() => _elapsedSeconds = next);
      if (next >= _maxRecordSeconds) {
        unawaited(_stopRecording());
      }
    });

    setState(() {
      _isRecording = true;
      _recordedPath = null;
      _recordedBytes = null;
      _errorText = null;
    });
  }

  Future<void> _stopRecording() async {
    _tickTimer?.cancel();
    _tickTimer = null;
    await _ampSub?.cancel();
    _ampSub = null;

    final recorder = ref.read(audioRecorderGatewayProvider);
    final stopRes = await recorder.stopRecording();
    if (!mounted) return;

    final outPath = stopRes.valueOrNull;
    Uint8List? bytes;
    if (outPath != null && outPath.isNotEmpty) {
      bytes = await readRecordedAudioBytes(outPath);
    }
    if (!mounted) return;

    setState(() {
      _isRecording = false;
      _amplitude = 0.0;
      _recordedPath = outPath;
      _recordedBytes = bytes;
      if (bytes == null || bytes.isEmpty) {
        _errorText = 'Captured recording was empty. Please speak clearly.';
      }
    });
  }

  Future<void> _playLocalTake() async {
    final path = _recordedPath;
    if (path == null || path.isEmpty) return;
    final player = ref.read(audioPlayerGatewayProvider);
    final loadRes = await player.loadFile(path);
    if (!mounted) return;
    if (loadRes.isErr) {
      showMzToast(
        context,
        message: loadRes.failureOrNull?.message ?? 'Unable to play recording',
        glyph: LucideGlyph.alertCircle,
      );
      return;
    }
    await player.play();
  }

  Future<void> _playHistoryTake(PronunciationPracticeItemDto item) async {
    final audioUrl = item.audioPlayUrl;
    if (audioUrl == null || audioUrl.isEmpty) {
      showMzToast(
        context,
        message: 'Audio file not synced yet for this take.',
        glyph: LucideGlyph.alertCircle,
      );
      return;
    }
    setState(() => _playingPracticeId = item.practiceId);
    final refRes = await ref
        .read(speechPracticeGatewayProvider)
        .fetchPlayableRecordingRef(
          practiceId: item.practiceId,
          relativeAudioPath: audioUrl,
        );
    if (!mounted) return;
    switch (refRes) {
      case Ok<String, Failure>(:final value):
        final player = ref.read(audioPlayerGatewayProvider);
        final loadRes = await player.loadFile(value);
        if (!mounted) return;
        if (loadRes.isOk) {
          await player.play();
        }
      case Err<String, Failure>(:final failure):
        showMzToast(
          context,
          message: failure.message,
          glyph: LucideGlyph.alertCircle,
        );
    }
    if (mounted) setState(() => _playingPracticeId = null);
  }

  Future<void> _submitForAnalysis() async {
    final bytes = _recordedBytes;
    if (bytes == null || bytes.isEmpty || _isAnalyzing) return;

    setState(() {
      _isAnalyzing = true;
      _errorText = null;
    });

    final profile = await ref
        .read(profileRepositoryProvider)
        .loadOrInitializePrimary();
    final examTrack = profile.examId;
    final practiceId = ref.read(entropySourceProvider).nextUuidV4();
    final lowerPath = (_recordedPath ?? '').toLowerCase();
    final detectedMime = lowerPath.endsWith('.webm')
        ? 'audio/webm'
        : lowerPath.endsWith('.ogg')
        ? 'audio/ogg'
        : lowerPath.endsWith('.wav')
        ? 'audio/wav'
        : 'audio/mp4';

    final res = await ref
        .read(speechPracticeGatewayProvider)
        .submitPractice(
          practiceId: practiceId,
          targetText: widget.targetText.trim(),
          practiceKind: widget.practiceKind,
          sourceRefType: widget.sourceRefType,
          sourceRefId: widget.sourceRefId,
          examTrack: examTrack,
          audioBytes: bytes,
          contentType: detectedMime,
          durationMs: _elapsedSeconds > 0 ? _elapsedSeconds * 1000 : null,
        );

    if (!mounted) return;
    switch (res) {
      case Ok<PronunciationPracticeItemDto, Failure>(:final value):
        final repo = ref.read(personalizationRepositoryProvider);
        await repo.savePronunciationPractice(value);
        if (value.overallScore != null) {
          final bandApprox = (4.5 + (value.overallScore! / 100.0) * 4.5).clamp(
            4.0,
            9.0,
          );
          unawaited(
            ref
                .read(personalizationGatewayProvider)
                .recordBandEvent(
                  examTrack: examTrack,
                  skill: BandEventSkill.speaking.wire,
                  sourceKind: BandEventSourceKind.pronunciation.wire,
                  sourceId: value.practiceId,
                  rawScore: bandApprox,
                  accuracyRatio: (value.overallScore! / 100.0).clamp(0.0, 1.0),
                )
                .then<void>((_) {}, onError: (_) {}),
          );
        }
        if (!mounted) return;
        setState(() {
          _isAnalyzing = false;
          _latestResult = value;
          _selectedWord = null;
          if (_remainingQuota != null && _remainingQuota! > 0) {
            _remainingQuota = _remainingQuota! - 1;
          }
          _history = <PronunciationPracticeItemDto>[
            value,
            ..._history.where((e) => e.practiceId != value.practiceId),
          ];
        });
      case Err<PronunciationPracticeItemDto, Failure>(:final failure):
        setState(() {
          _isAnalyzing = false;
          _errorText = failure.message;
        });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);
    final isIrn =
        ref.watch(editionConfigProvider).edition == AppEdition.iran;

    final result = _latestResult;
    final summaryText = isIrn && result?.summaryFa != null
        ? result!.summaryFa!
        : result?.summaryEn;
    final mouthTipText = isIrn && result?.mouthTipFa != null
        ? result!.mouthTipFa!
        : result?.mouthTipEn;
    final retryTipText = isIrn && result?.actionableRetryFa != null
        ? result!.actionableRetryFa!
        : result?.actionableRetryEn;

    return Container(
      color: colors.background,
      padding: const EdgeInsetsDirectional.all(SpacingTokens.pageInset),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  l10n.speechStudioTitle,
                  style: typography.cardTitle.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
              ),
              IconButton(
                tooltip: l10n.cancelAction,
                onPressed: () => Navigator.of(context).pop(),
                icon: const AppIcon(LucideGlyph.x, size: 20),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.sm),
          Expanded(
            child: ListView(
              children: <Widget>[
                // 1. Target phrase + Kokoro-82m Reference Listen
                Container(
                  padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: shapes.cardRadius,
                    border: Border.all(color: colors.borderSubtle),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      LtrExamBoundary(
                        child: Text(
                          widget.targetText,
                          style: typography.cardTitle.copyWith(
                            color: colors.textPrimary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.sm),
                      Wrap(
                        spacing: SpacingTokens.xs,
                        runSpacing: SpacingTokens.xs,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: <Widget>[
                          ChoiceChip(
                            label: Text(l10n.settingsTtsAccentUs),
                            selected: _accent == 'us',
                            onSelected: (_) => unawaited(_selectAccent('us')),
                          ),
                          ChoiceChip(
                            label: Text(l10n.settingsTtsAccentUk),
                            selected: _accent == 'uk',
                            onSelected: (_) => unawaited(_selectAccent('uk')),
                          ),
                          if (_remainingQuota != null && _dailyQuotaLimit != null)
                            MzChip(
                              label: l10n.speechQuotaRemaining(
                                _remainingQuota!,
                                _dailyQuotaLimit!,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: SpacingTokens.sm),
                      InlineListenButton(
                        text: widget.targetText,
                        voice: _voiceId,
                        sourceContext: widget.sourceContext,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: SpacingTokens.md),

                // 2. Recorder card
                Container(
                  padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
                  decoration: BoxDecoration(
                    color: colors.surfaceAlt,
                    borderRadius: shapes.cardRadius,
                    border: Border.all(color: colors.borderSubtle),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      if (_isRecording) ...<Widget>[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: <Widget>[
                            Text(
                              isIrn
                                  ? 'در حال ضبط...'
                                  : 'Recording your voice...',
                              style: typography.secondary.copyWith(
                                color: colors.error,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              '0:${_elapsedSeconds.toString().padLeft(2, '0')} / 0:$_maxRecordSeconds',
                              style: typography.caption.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: SpacingTokens.sm),
                        LinearProgressIndicator(
                          value: _amplitude.clamp(0.08, 1.0),
                          color: colors.error,
                          backgroundColor: colors.track,
                          minHeight: 8,
                        ),
                        const SizedBox(height: SpacingTokens.md),
                        PrimaryButton(
                          label: l10n.speechRecordStop,
                          glyph: LucideGlyph.micOff,
                          onPressed: () => unawaited(_stopRecording()),
                        ),
                      ] else ...<Widget>[
                        Wrap(
                          spacing: SpacingTokens.sm,
                          runSpacing: SpacingTokens.sm,
                          children: <Widget>[
                            PrimaryButton(
                              label: l10n.speechRecordStart,
                              glyph: LucideGlyph.mic,
                              isFullWidth: false,
                              onPressed: _isAnalyzing
                                  ? null
                                  : () => unawaited(_startRecording()),
                            ),
                            if (_recordedPath != null &&
                                _recordedBytes != null) ...<Widget>[
                              SecondaryButton(
                                label: l10n.speechReplayMine,
                                glyph: LucideGlyph.play,
                                isFullWidth: false,
                                onPressed: _isAnalyzing
                                    ? null
                                    : () => unawaited(_playLocalTake()),
                              ),
                              PrimaryButton(
                                label: _isAnalyzing
                                    ? l10n.speechAnalyzing
                                    : l10n.speechAnalyzeCta,
                                glyph: LucideGlyph.sparkles,
                                isLoading: _isAnalyzing,
                                isFullWidth: false,
                                onPressed: _isAnalyzing
                                    ? null
                                    : () => unawaited(_submitForAnalysis()),
                              ),
                            ],
                          ],
                        ),
                        if (_recordedPath != null &&
                            _recordedBytes != null &&
                            result == null) ...<Widget>[
                          const SizedBox(height: SpacingTokens.xs),
                          Text(
                            l10n.speechPreviewHint,
                            style: typography.caption.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ],
                      if (_errorText != null) ...<Widget>[
                        const SizedBox(height: SpacingTokens.sm),
                        Text(
                          _errorText!,
                          style: typography.caption.copyWith(
                            color: colors.error,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                // 3. Feedback Result Card
                if (result != null) ...<Widget>[
                  const SizedBox(height: SpacingTokens.md),
                  Container(
                    padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
                    decoration: BoxDecoration(
                      color: colors.surface,
                      borderRadius: shapes.cardRadius,
                      border: Border.all(color: colors.borderStrong),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: <Widget>[
                            Text(
                              isIrn ? 'امتیاز کلی تلفظ' : 'Pronunciation Score',
                              style: typography.secondary.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: <Widget>[
                                if (result.bandImpactLabel != null) ...<Widget>[
                                  MzChip(label: result.bandImpactLabel!),
                                  const SizedBox(width: SpacingTokens.sm),
                                ],
                                Text(
                                  '${result.overallScore ?? '--'}%',
                                  style: typography.headline.copyWith(
                                    color: colors.primary,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: SpacingTokens.sm),
                        Wrap(
                          spacing: SpacingTokens.xs,
                          runSpacing: SpacingTokens.xs,
                          children: <Widget>[
                            _MetricPill(
                              label: isIrn ? 'دقت' : 'Accuracy',
                              value: result.accuracyScore,
                            ),
                            _MetricPill(
                              label: isIrn ? 'روانی' : 'Fluency',
                              value: result.fluencyScore,
                            ),
                            _MetricPill(
                              label: isIrn ? 'لحن' : 'Intonation',
                              value: result.intonationScore,
                            ),
                            _MetricPill(
                              label: isIrn ? 'استرس' : 'Stress',
                              value: result.stressScore,
                            ),
                          ],
                        ),
                        if (result.wordsFeedback.isNotEmpty) ...<Widget>[
                          const SizedBox(height: SpacingTokens.md),
                          Text(
                            isIrn ? 'تحلیل واژه به واژه' : 'Word-by-Word Breakdown',
                            style: typography.caption.copyWith(
                              color: colors.textSecondary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.xs),
                          Text(
                            l10n.speechWordTapHint,
                            style: typography.caption.copyWith(
                              color: colors.textTertiary,
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.xs),
                          LtrExamBoundary(
                            child: Wrap(
                              spacing: SpacingTokens.xs,
                              runSpacing: SpacingTokens.xs,
                              children: result.wordsFeedback.map((wf) {
                                final chipColor = wf.status == 'accurate'
                                    ? colors.success
                                    : wf.status == 'missing_or_extra'
                                    ? colors.error
                                    : colors.warning;
                                final isSelected = _selectedWord == wf;
                                return InkWell(
                                  borderRadius: shapes.compactRadius,
                                  onTap: () => setState(
                                    () => _selectedWord = isSelected ? null : wf,
                                  ),
                                  child: Container(
                                    padding:
                                        const EdgeInsetsDirectional.symmetric(
                                          horizontal: SpacingTokens.sm,
                                          vertical: SpacingTokens.xs,
                                        ),
                                    decoration: BoxDecoration(
                                      color: isSelected
                                          ? colors.mintBg
                                          : colors.bgRaised,
                                      borderRadius: shapes.compactRadius,
                                      border: Border.all(
                                        color: isSelected
                                            ? colors.primary
                                            : chipColor.withValues(alpha: 0.6),
                                      ),
                                    ),
                                    child: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: <Widget>[
                                        Text(
                                          wf.word,
                                          style: typography.caption.copyWith(
                                            color: chipColor,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        if (wf.ipaTarget != null)
                                          Text(
                                            '/${wf.ipaTarget}/',
                                            style: typography.caption.copyWith(
                                              color: colors.textTertiary,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ),
                          if (_selectedWord != null) ...<Widget>[
                            const SizedBox(height: SpacingTokens.sm),
                            Container(
                              padding: const EdgeInsetsDirectional.all(
                                SpacingTokens.sm,
                              ),
                              decoration: BoxDecoration(
                                color: colors.surfaceAlt,
                                borderRadius: shapes.compactRadius,
                                border: Border.all(color: colors.primary),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: <Widget>[
                                  Text(
                                    '${_selectedWord!.word}  '
                                    'Target: /${_selectedWord!.ipaTarget ?? '—'}/'
                                    '${_selectedWord!.ipaObserved != null ? ' · Heard: /${_selectedWord!.ipaObserved}/' : ''}',
                                    style: typography.caption.copyWith(
                                      color: colors.textPrimary,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: SpacingTokens.xs),
                                  Text(
                                    isIrn && _selectedWord!.tipFa != null
                                        ? _selectedWord!.tipFa!
                                        : _selectedWord!.tipEn,
                                    style: typography.caption.copyWith(
                                      color: colors.textSecondary,
                                    ),
                                  ),
                                  const SizedBox(height: SpacingTokens.xs),
                                  InlineListenButton(
                                    text: _selectedWord!.word,
                                    voice: _voiceId,
                                    sourceContext: 'pronunciation',
                                    compact: true,
                                    label: l10n.speechListenWordSlow(
                                      _selectedWord!.word,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                          const SizedBox(height: SpacingTokens.sm),
                          ...result.wordsFeedback
                              .where((w) => w.status != 'accurate')
                              .map((wf) {
                                final tip = isIrn && wf.tipFa != null
                                    ? wf.tipFa!
                                    : wf.tipEn;
                                return Padding(
                                  padding: const EdgeInsetsDirectional.only(
                                    bottom: SpacingTokens.xs,
                                  ),
                                  child: Text(
                                    '• ${wf.word}: $tip',
                                    style: typography.caption.copyWith(
                                      color: colors.textSecondary,
                                    ),
                                  ),
                                );
                              }),
                        ],
                        if (result.audioPlayUrl != null) ...<Widget>[
                          const SizedBox(height: SpacingTokens.sm),
                          SecondaryButton(
                            label: l10n.speechReplayMine,
                            glyph: _playingPracticeId == result.practiceId
                                ? LucideGlyph.loaderCircle
                                : LucideGlyph.play,
                            isFullWidth: false,
                            onPressed: _playingPracticeId == result.practiceId
                                ? null
                                : () => unawaited(_playHistoryTake(result)),
                          ),
                        ],
                        if (summaryText != null && summaryText.isNotEmpty) ...<Widget>[
                          const SizedBox(height: SpacingTokens.sm),
                          Text(
                            summaryText,
                            style: typography.body.copyWith(
                              color: colors.textPrimary,
                            ),
                          ),
                        ],
                        if (mouthTipText != null && mouthTipText.isNotEmpty) ...<Widget>[
                          const SizedBox(height: SpacingTokens.sm),
                          Container(
                            padding: const EdgeInsetsDirectional.all(
                              SpacingTokens.sm,
                            ),
                            decoration: BoxDecoration(
                              color: colors.mintBg,
                              borderRadius: shapes.compactRadius,
                            ),
                            child: Text(
                              mouthTipText,
                              style: typography.caption.copyWith(
                                color: colors.textPrimary,
                              ),
                            ),
                          ),
                        ],
                        if (retryTipText != null && retryTipText.isNotEmpty) ...<Widget>[
                          const SizedBox(height: SpacingTokens.xs),
                          Text(
                            retryTipText,
                            style: typography.caption.copyWith(
                              color: colors.primary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],

                // 4. Past Synced Takes
                if (_history.isNotEmpty) ...<Widget>[
                  const SizedBox(height: SpacingTokens.lg),
                  Text(
                    l10n.speechHistoryTitle,
                    style: typography.caption.copyWith(
                      color: colors.textSecondary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  ..._history.take(5).map((item) {
                    final isLoadingTake = _playingPracticeId == item.practiceId;
                    return Padding(
                      padding: const EdgeInsetsDirectional.only(
                        bottom: SpacingTokens.xs,
                      ),
                      child: Container(
                        padding: const EdgeInsetsDirectional.symmetric(
                          horizontal: SpacingTokens.md,
                          vertical: SpacingTokens.sm,
                        ),
                        decoration: BoxDecoration(
                          color: colors.surface,
                          borderRadius: shapes.compactRadius,
                          border: Border.all(color: colors.borderSubtle),
                        ),
                        child: Row(
                          children: <Widget>[
                            Expanded(
                              child: Text(
                                '${item.overallScore ?? '--'}% · ${item.targetText}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: typography.caption.copyWith(
                                  color: colors.textPrimary,
                                ),
                              ),
                            ),
                            if (item.audioPlayUrl != null)
                              IconButton(
                                tooltip: l10n.speechReplayMine,
                                onPressed: isLoadingTake
                                    ? null
                                    : () => unawaited(_playHistoryTake(item)),
                                icon: AppIcon(
                                  isLoadingTake
                                      ? LucideGlyph.loaderCircle
                                      : LucideGlyph.play,
                                  size: 16,
                                  color: colors.primary,
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricPill extends StatelessWidget {
  const new({required this.label, required this.value});

  final String label;
  final int? value;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: SpacingTokens.sm,
        vertical: SpacingTokens.xs,
      ),
      decoration: BoxDecoration(
        color: colors.bgRaised,
        borderRadius: shapes.pillRadius,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Text(
        '$label: ${value ?? '--'}%',
        style: typography.caption.copyWith(
          color: colors.textPrimary,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

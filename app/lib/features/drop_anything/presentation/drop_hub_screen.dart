import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/advanced/drop_input_policy.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
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
import 'package:mockza/theme/primitives.dart';

const List<({String label, String text})> _kDropSampleExcerpts =
    <({String label, String text})>[
      (
        label: 'AI & Work',
        text: 'Generative tools accelerate initial drafting, albeit often introducing subtle factual hallucinations that require seasoned human judgment and deliberate editorial verification before publication.',
      ),
      (
        label: 'Urban Design',
        text: 'Forward-thinking municipalities have prioritized walkable green corridors rather than widening highways, recognizing that congestion cannot simply be paved away in dense metropolitan regions.',
      ),
      (
        label: 'Habit Science',
        text: 'Sustainable fluency rarely stems from marathon weekend cramming; rather, it compounds through compact daily feedback loops that surface recurring errors while memory traces remain fresh.',
      ),
    ];

/// Drop Anything composer supporting URL, Text Excerpt, Screenshot/Image & OS Share Intent (`/drop`).
class DropHubScreen extends ConsumerStatefulWidget {
  /// Creates a [DropHubScreen].
  const new({
    this.initialUrl,
    this.initialText,
    this.initialFiles = const <String>[],
    this.initialMimeType,
    this.initialTab,
    super.key,
  });

  /// Pre-populated shared URL from Android/iOS Share Sheet.
  final String? initialUrl;

  /// Pre-populated shared text excerpt from Android/iOS Share Sheet.
  final String? initialText;

  /// Pre-populated staged image/audio file paths from OS Share Sheet.
  final List<String> initialFiles;

  /// Optional OS Share Sheet MIME type hint.
  final String? initialMimeType;

  /// Optional initial tab query (`url`, `text`, `image`, `audio`).
  final String? initialTab;

  @override
  ConsumerState<DropHubScreen> createState() => _DropHubScreenState();
}

typedef _StagedMediaFile = ({
  String name,
  String mimeType,
  Uint8List bytes,
});

class _DropHubScreenState extends ConsumerState<DropHubScreen> {
  static const int _maxMediaBytes = 5 * 1024 * 1024;
  static const double _maxAudioSeconds = 180;

  final TextEditingController _urlCtrl = TextEditingController();
  final TextEditingController _textCtrl = TextEditingController();
  int _modeIndex = 0; // 0 = URL, 1 = Text, 2 = Images, 3 = Audio
  bool _submitting = false;
  String _statusStage = '';
  bool _recordingAudio = false;
  DateTime? _audioStartedAt;
  String? _activeAudioPath;
  double? _recordedAudioDurationSec;
  List<_StagedMediaFile> _pickedImages = const <_StagedMediaFile>[];
  _StagedMediaFile? _pickedAudio;
  String? _error;
  AdvancedQuotaDto? _quota;
  List<DroppedContentDto> _history = const <DroppedContentDto>[];

  @override
  void initState() {
    super.initState();
    switch (widget.initialTab) {
      case 'text':
        _modeIndex = 1;
      case 'image':
        _modeIndex = 2;
      case 'audio':
        _modeIndex = 3;
      case 'url':
      case null:
        _modeIndex = 0;
    }
    if (widget.initialFiles.isNotEmpty) {
      final isAudio =
          widget.initialMimeType != null &&
          widget.initialMimeType!.toLowerCase().startsWith('audio/');
      _modeIndex = isAudio ? 3 : 2;
      unawaited(_hydrateInitialFiles(widget.initialFiles, isAudio: isAudio));
    } else if (widget.initialUrl != null && widget.initialUrl!.isNotEmpty) {
      _urlCtrl.text = widget.initialUrl!;
      _modeIndex = 0;
    } else if (widget.initialText != null && widget.initialText!.isNotEmpty) {
      _textCtrl.text = widget.initialText!;
      _modeIndex = 1;
    }
    unawaited(_loadHistoryAndQuota());
  }

  Future<void> _hydrateInitialFiles(
    List<String> paths, {
    required bool isAudio,
  }) async {
    final loaded = <_StagedMediaFile>[];
    for (final path in paths.take(isAudio ? 1 : 4)) {
      final bytes = await readLocalFileBytes(path);
      if (bytes == null || bytes.isEmpty || bytes.length > _maxMediaBytes) {
        continue;
      }
      final name = path.split('/').last;
      final mime =
          widget.initialMimeType ?? (isAudio ? 'audio/mp4' : 'image/jpeg');
      loaded.add((name: name, mimeType: mime, bytes: bytes));
    }
    if (!mounted || loaded.isEmpty) return;
    setState(() {
      if (isAudio) {
        _pickedAudio = loaded.first;
        _recordedAudioDurationSec = 30;
      } else {
        _pickedImages = loaded;
      }
    });
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    _textCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadHistoryAndQuota() async {
    final repo = ref.read(linguisticRepositoryProvider);
    final cached = await repo.listCachedDrops();
    if (mounted && cached.isNotEmpty) {
      setState(() => _history = cached);
    }
    final gateway = ref.read(linguisticGatewayProvider);
    final res = await gateway.getDropHistory();
    final quotaRes = await gateway.fetchAdvancedQuota();
    if (!mounted) return;
    setState(() {
      if (res.valueOrNull != null) _history = res.valueOrNull!;
      if (quotaRes.valueOrNull != null) _quota = quotaRes.valueOrNull;
    });
  }

  Future<void> _deleteHistoryItem(String dropId) async {
    final res = await ref.read(linguisticGatewayProvider).deleteDrop(dropId);
    if (!mounted) return;
    res.when(
      success: (_) => setState(() {
        _history = _history
            .where((item) => item.dropId != dropId)
            .toList(growable: false);
      }),
      failure: (f) => setState(() => _error = f.message),
    );
  }

  Future<String> _resolveExamTrack() async {
    try {
      final profile = await ref
          .read(profileRepositoryProvider)
          .loadOrInitializePrimary();
      if (profile.examId.isNotEmpty) return profile.examId;
    } on Object {
      // Fallback safely in isolated widget tests.
    }
    return 'ielts_academic';
  }

  Future<void> _pickImages() async {
    final isRtl = ref.read(editionConfigProvider).edition == AppEdition.iran;
    final files = await pickLocalMediaFiles(
      acceptMime: 'image/*',
      allowMultiple: true,
    );
    if (!mounted || files.isEmpty) return;
    final valid = <_StagedMediaFile>[];
    for (final f in files.take(4)) {
      if (f.bytes.length <= _maxMediaBytes) {
        valid.add(f);
      }
    }
    if (valid.isEmpty) {
      setState(
        () => _error = isRtl
            ? 'حجم هر تصویر باید کمتر از ۵ مگابایت باشد.'
            : 'Each selected image must be under 5 MB.',
      );
      return;
    }
    setState(() {
      _error = null;
      _pickedImages = valid;
    });
  }

  Future<void> _pickAudioFile() async {
    final isRtl = ref.read(editionConfigProvider).edition == AppEdition.iran;
    final files = await pickLocalMediaFiles(
      acceptMime: 'audio/*',
      maxFiles: 1,
    );
    if (!mounted || files.isEmpty) return;
    final f = files.first;
    if (f.bytes.length > _maxMediaBytes) {
      setState(
        () => _error = isRtl
            ? 'حجم فایل صوتی باید کمتر از ۵ مگابایت باشد (حداکثر ۳ دقیقه).'
            : 'Audio file must be under 5 MB (max 180s).',
      );
      return;
    }
    setState(() {
      _error = null;
      _pickedAudio = f;
      _recordedAudioDurationSec ??= 60;
    });
  }

  Future<void> _toggleRecordAudio() async {
    final isRtl = ref.read(editionConfigProvider).edition == AppEdition.iran;
    final recorder = ref.read(audioRecorderGatewayProvider);
    final clock = ref.read(clockProvider);

    setState(() => _error = null);
    if (!_recordingAudio) {
      final path = await createTempRecordingPath(
        'drop_audio_${clock.now().millisecondsSinceEpoch}.m4a',
      );
      _activeAudioPath = path;
      _audioStartedAt = clock.now();
      final res = await recorder.startRecording(outputPath: path);
      if (!mounted) return;
      res.when(
        success: (_) => setState(() => _recordingAudio = true),
        failure: (f) => setState(() => _error = f.message),
      );
      return;
    }

    final startedAt = _audioStartedAt ?? clock.now();
    final elapsedSec =
        clock.now().difference(startedAt).inMilliseconds / 1000.0;
    final stopRes = await recorder.stopRecording();
    final path = stopRes.valueOrNull ?? _activeAudioPath;
    _activeAudioPath = null;
    if (!mounted) return;
    setState(() => _recordingAudio = false);
    if (path == null || path.isEmpty) {
      setState(
        () => _error = stopRes.failureOrNull?.message ?? 'Recording failed.',
      );
      return;
    }
    final bytes = await readRecordedAudioBytes(path);
    if (!mounted) return;
    if (bytes == null || bytes.isEmpty) {
      setState(
        () => _error = isRtl
            ? 'صدایی ضبط نشد؛ لطفاً دوباره تلاش کنید.'
            : 'Recorded audio bytes could not be read.',
      );
      return;
    }
    if (bytes.length > _maxMediaBytes || elapsedSec > _maxAudioSeconds) {
      setState(
        () => _error = isRtl
            ? 'طول صدا باید حداکثر ۱۸۰ ثانیه و کمتر از ۵ مگابایت باشد.'
            : 'Audio must be under 180 seconds and 5 MB.',
      );
      return;
    }
    setState(() {
      _pickedAudio = (
        name: 'recorded_voice.m4a',
        mimeType: recorder.activeContentType,
        bytes: bytes,
      );
      _recordedAudioDurationSec = elapsedSec
          .clamp(3, _maxAudioSeconds)
          .toDouble();
    });
  }

  Future<void> _submit() async {
    final isRtl = ref.read(editionConfigProvider).edition == AppEdition.iran;
    final gateway = ref.read(linguisticGatewayProvider);
    final repo = ref.read(linguisticRepositoryProvider);
    final entropy = ref.read(entropySourceProvider);
    setState(() => _error = null);
    final examTrack = await _resolveExamTrack();

    final Result<String, Failure> res;
    if (_modeIndex == 0) {
      final url = _urlCtrl.text.trim();
      final check = DropInputPolicy.validateUrlPreFlight(
        url,
        allowHttpInDev: true,
      );
      if (!check.ok) {
        setState(
          () => _error = isRtl
              ? 'لینک ویدئو یا آدرس مسدود پشتیبانی نمی‌شود؛ لینک مقاله یا متن را وارد کنید.'
              : (check.reason ?? 'Blocked or unsupported URL.'),
        );
        return;
      }
      setState(() => _submitting = true);
      res = await gateway.enqueueDropIngest(
        inputKind: 'text_url',
        examTrack: examTrack,
        sourceUrl: url,
      );
    } else if (_modeIndex == 1) {
      final txt = _textCtrl.text.trim();
      final tCheck = DropInputPolicy.validateTextSnippet(txt);
      if (!tCheck.ok) {
        setState(
          () => _error = tCheck.reason ?? 'Text must be 40..15,000 chars.',
        );
        return;
      }
      setState(() => _submitting = true);
      res = await gateway.enqueueDropIngest(
        inputKind: 'text',
        examTrack: examTrack,
        rawText: txt,
      );
    } else if (_modeIndex == 2) {
      if (_pickedImages.isEmpty) {
        setState(
          () => _error = isRtl
              ? 'ابتدا ۱ تا ۴ تصویر انتخاب کنید.'
              : 'Select 1 to 4 screenshots/book page photos first.',
        );
        return;
      }
      setState(() {
        _submitting = true;
        _statusStage = isRtl
            ? 'در حال آپلود تصاویر (${_pickedImages.length})...'
            : 'Uploading ${_pickedImages.length} image(s)...';
      });
      final dropBatchId = entropy.nextUuidV4();
      final batch = await gateway.uploadDropMediaBatch(
        dropId: dropBatchId,
        mediaKind: 'image',
        files: _pickedImages
            .take(4)
            .map(
              (img) => DropMediaUploadItem(
                bytes: img.bytes,
                contentType: img.mimeType,
              ),
            )
            .toList(growable: false),
      );
      if (!mounted) return;
      final objectKeys = batch.valueOrNull;
      if (objectKeys == null || objectKeys.isEmpty) {
        setState(() {
          _submitting = false;
          _statusStage = '';
          _error = batch.failureOrNull?.message ?? 'Image upload failed.';
        });
        return;
      }
      res = await gateway.enqueueDropIngest(
        inputKind: 'image',
        examTrack: examTrack,
        imageObjectKeys: objectKeys,
      );
    } else {
      final audio = _pickedAudio;
      if (audio == null) {
        setState(
          () => _error = isRtl
              ? 'یک فایل صوتی انتخاب کنید یا حداکثر ۳ دقیقه صدا ضبط کنید.'
              : 'Pick or record a bounded audio clip (max 180s) first.',
        );
        return;
      }
      setState(() {
        _submitting = true;
        _statusStage = isRtl
            ? 'در حال آپلود فایل صوتی...'
            : 'Uploading audio clip...';
      });
      final dropBatchId = entropy.nextUuidV4();
      final up = await gateway.uploadDropMedia(
        dropId: dropBatchId,
        mediaKind: 'audio',
        contentType: audio.mimeType,
        bytes: audio.bytes,
      );
      if (!mounted) return;
      final audioKey = up.valueOrNull;
      if (audioKey == null || audioKey.isEmpty) {
        setState(() {
          _submitting = false;
          _statusStage = '';
          _error = up.failureOrNull?.message ?? 'Audio upload failed.';
        });
        return;
      }
      res = await gateway.enqueueDropIngest(
        inputKind: 'audio',
        examTrack: examTrack,
        audioObjectKey: audioKey,
        durationSeconds: _recordedAudioDurationSec ?? 60,
      );
    }

    if (!mounted) return;
    if (res.isFailure) {
      setState(() {
        _submitting = false;
        _statusStage = '';
        _error = res.failureOrNull?.message ?? 'Drop failed.';
      });
      return;
    }

    final jobId = res.valueOrNull ?? '';
    setState(() {
      _statusStage = isRtl
          ? 'در حال استخراج اصطلاحات و ساخت آزمونک...'
          : 'Extracting idioms and building your 2-min quiz...';
    });
    final outcome = await watchAdvancedJobUntilDone<DroppedContentDto>(
      gateway,
      jobId: jobId,
      parseResult: DroppedContentDto.fromJson,
      isCancelled: () => !mounted,
      onStage: (stage) {
        if (mounted) setState(() => _statusStage = stage);
      },
    );
    if (!mounted) return;
    await outcome.when(
      success: (dto) async {
        await repo.cacheDroppedContent(dto);
        if (!mounted) return;
        setState(() {
          _submitting = false;
          _statusStage = '';
        });
        unawaited(context.push(AppRoutes.buildDropDrill(dto.dropId)));
      },
      failure: (f) async {
        setState(() {
          _submitting = false;
          _statusStage = '';
          _error = f.message;
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final l10n = AppLocalizations.of(context);
    final isRtl = ref.watch(editionConfigProvider).edition == AppEdition.iran;

    return MzScaffold(
      appBar: AppBar(
        title: Text(l10n.dropAnythingTitle),
      ),
      body: ListView(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
        children: <Widget>[
          if (_quota != null) ...<Widget>[
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Padding(
                padding: const EdgeInsetsDirectional.only(
                  bottom: SpacingTokens.sm,
                ),
                child: MzChip(
                  label: _quota!.isPro
                      ? (isRtl
                            ? '${_quota!.dropsRemainingToday} محتوا باقی‌مانده امروز'
                            : '${_quota!.dropsRemainingToday} study sets left today')
                      : _quota!.freeSampleUsed
                      ? (isRtl ? 'نمونه رایگان مصرف شد' : 'Free sample used')
                      : (isRtl
                            ? '۱ نمونه رایگان موجود'
                            : '1 free sample available'),
                  variant: _quota!.isPro
                      ? MzChipVariant.target
                      : MzChipVariant.neutral,
                ),
              ),
            ),
          ],
          MzCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Wrap(
                  spacing: SpacingTokens.xs,
                  runSpacing: SpacingTokens.xs,
                  children: <Widget>[
                    ChoiceChip(
                      key: const ValueKey<String>('drop_mode_url'),
                      label: Text(isRtl ? 'لینک مقاله' : 'Article URL'),
                      selected: _modeIndex == 0,
                      onSelected: (_) => setState(() {
                        _modeIndex = 0;
                        _error = null;
                      }),
                    ),
                    ChoiceChip(
                      key: const ValueKey<String>('drop_mode_text'),
                      label: Text(isRtl ? 'چسباندن متن' : 'Paste Text'),
                      selected: _modeIndex == 1,
                      onSelected: (_) => setState(() {
                        _modeIndex = 1;
                        _error = null;
                      }),
                    ),
                    ChoiceChip(
                      key: const ValueKey<String>('drop_mode_image'),
                      label: Text(
                        isRtl ? 'تصویر / اسکرین‌شات' : 'Image (1–4)',
                      ),
                      selected: _modeIndex == 2,
                      onSelected: (_) => setState(() {
                        _modeIndex = 2;
                        _error = null;
                      }),
                    ),
                    ChoiceChip(
                      key: const ValueKey<String>('drop_mode_audio'),
                      label: Text(
                        isRtl ? 'ویس / پادکست کوتاه' : 'Audio (≤180s)',
                      ),
                      selected: _modeIndex == 3,
                      onSelected: (_) => setState(() {
                        _modeIndex = 3;
                        _error = null;
                      }),
                    ),
                  ],
                ),
                const SizedBox(height: SpacingTokens.md),
                if (_modeIndex == 0)
                  LtrExamBoundary(
                    child: TextField(
                      key: const ValueKey<String>('drop_url_field'),
                      controller: _urlCtrl,
                      decoration: const InputDecoration(
                        hintText: 'https://example.com/article',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  )
                else if (_modeIndex == 1)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Wrap(
                        spacing: SpacingTokens.xs,
                        runSpacing: SpacingTokens.xs,
                        children: _kDropSampleExcerpts
                            .map(
                              (ex) => ActionChip(
                                label: Text(ex.label),
                                onPressed: () => _textCtrl.text = ex.text,
                              ),
                            )
                            .toList(growable: false),
                      ),
                      const SizedBox(height: SpacingTokens.xs),
                      LtrExamBoundary(
                        child: TextField(
                          key: const ValueKey<String>('drop_text_field'),
                          controller: _textCtrl,
                          maxLines: 5,
                          decoration: const InputDecoration(
                            hintText: 'Paste English article, book quote, or podcast transcript (40..15,000 chars)...',
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ),
                    ],
                  )
                else if (_modeIndex == 2)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      SecondaryButton(
                        key: const ValueKey<String>('drop_pick_image_btn'),
                        label: isRtl
                            ? 'انتخاب ۱ تا ۴ تصویر (حداکثر ۵ مگابایت)'
                            : 'Choose 1–4 Images (≤5 MB each)',
                        glyph: LucideGlyph.cloudUpload,
                        onPressed: _submitting ? null : _pickImages,
                      ),
                      if (_pickedImages.isNotEmpty) ...<Widget>[
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          isRtl
                              ? '${EdgeNumerals.toPersianDigits(_pickedImages.length)} تصویر آماده پردازش:'
                              : '${_pickedImages.length} image(s) staged:',
                          key: const ValueKey<String>(
                            'drop_picked_images_label',
                          ),
                          style: typography.caption.copyWith(
                            color: colors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: SpacingTokens.xs),
                        Wrap(
                          spacing: SpacingTokens.xs,
                          runSpacing: SpacingTokens.xs,
                          children: List<Widget>.generate(
                            _pickedImages.length,
                            (idx) => InputChip(
                              label: Text(_pickedImages[idx].name),
                              onDeleted: () => setState(() {
                                final next = List<_StagedMediaFile>.from(
                                  _pickedImages,
                                )..removeAt(idx);
                                _pickedImages = next;
                              }),
                            ),
                          ),
                        ),
                      ],
                    ],
                  )
                else if (_quota != null && !_quota!.audioDropAllowed)
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Text(
                        isRtl
                            ? 'تبدیل فایل صوتی به آزمونک ویژه اشتراک حرفه‌ای است. همین الان می‌توانید از متن یا تصویر استفاده کنید.'
                            : 'Audio-to-Quiz requires a Pro plan. You can still paste text or upload photos with your free sample.',
                        style: typography.caption.copyWith(
                          color: colors.warning,
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.xs),
                      SecondaryButton(
                        label: isRtl ? 'ارتقا به نسخه کامل' : 'Upgrade to Pro',
                        isFullWidth: false,
                        onPressed: () => context.push(AppRoutes.paywall),
                      ),
                    ],
                  )
                else
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Wrap(
                        spacing: SpacingTokens.xs,
                        runSpacing: SpacingTokens.xs,
                        children: <Widget>[
                          SecondaryButton(
                            key: const ValueKey<String>('drop_pick_audio_btn'),
                            label: isRtl
                                ? 'انتخاب فایل صوتی'
                                : 'Choose Audio File',
                            glyph: LucideGlyph.cloudUpload,
                            isFullWidth: false,
                            onPressed: _submitting || _recordingAudio
                                ? null
                                : _pickAudioFile,
                          ),
                          SecondaryButton(
                            key: const ValueKey<String>(
                              'drop_record_audio_btn',
                            ),
                            label: _recordingAudio
                                ? (isRtl ? 'توقف ضبط صدا' : 'Stop Recording')
                                : (isRtl
                                      ? 'ضبط صدا (تا ۳ دقیقه)'
                                      : 'Record Clip (≤180s)'),
                            glyph: LucideGlyph.mic,
                            isFullWidth: false,
                            onPressed: _submitting ? null : _toggleRecordAudio,
                          ),
                        ],
                      ),
                      if (_pickedAudio != null) ...<Widget>[
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          isRtl
                              ? 'فایل آماده: ${_pickedAudio!.name}'
                              : 'Staged audio: ${_pickedAudio!.name}',
                          key: const ValueKey<String>(
                            'drop_picked_audio_label',
                          ),
                          style: typography.caption.copyWith(
                            color: colors.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ],
                  ),
                if (_statusStage.isNotEmpty) ...<Widget>[
                  const SizedBox(height: SpacingTokens.sm),
                  Text(
                    _statusStage,
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
                          key: const ValueKey<String>('drop_error_text'),
                          style: typography.caption.copyWith(
                            color: colors.error,
                          ),
                        ),
                      ),
                      if (_modeIndex != 1)
                        TextButton(
                          onPressed: () => setState(() {
                            _modeIndex = 1;
                            _error = null;
                          }),
                          child: Text(isRtl ? 'ارسال متن' : 'Paste text'),
                        ),
                    ],
                  ),
                ],
                const SizedBox(height: SpacingTokens.md),
                PrimaryButton(
                  key: const ValueKey<String>('drop_submit_btn'),
                  label: isRtl
                      ? 'ساخت تمرین و فلش‌کارت ۲ دقیقه‌ای'
                      : 'Create 2-Min Quiz & Cards',
                  glyph: LucideGlyph.sparkles,
                  isLoading: _submitting,
                  onPressed:
                      _submitting ||
                          (_modeIndex == 3 &&
                              _quota != null &&
                              !_quota!.audioDropAllowed)
                      ? null
                      : _submit,
                ),
              ],
            ),
          ),
          if (_history.isNotEmpty) ...<Widget>[
            const SizedBox(height: SpacingTokens.lg),
            Text(
              l10n.recentDropsLabel,
              style: typography.cardTitle.copyWith(color: colors.textPrimary),
            ),
            const SizedBox(height: SpacingTokens.sm),
            ..._history.map(
              (item) => Padding(
                padding: const EdgeInsetsDirectional.only(
                  bottom: SpacingTokens.sm,
                ),
                child: MzCard(
                  onTap: () =>
                      context.push(AppRoutes.buildDropDrill(item.dropId)),
                  child: Row(
                    children: <Widget>[
                      Expanded(
                        child: LtrExamBoundary(
                          child: Text(
                            item.title,
                            style: typography.body.copyWith(
                              color: colors.textPrimary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      Text(
                        item.cefrEstimate,
                        style: typography.caption.copyWith(
                          color: colors.primary,
                        ),
                      ),
                      IconButton(
                        tooltip: isRtl ? 'حذف' : 'Delete',
                        icon: const AppIcon(LucideGlyph.trash2, size: 16),
                        onPressed: () =>
                            unawaited(_deleteHistoryItem(item.dropId)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

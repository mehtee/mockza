import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/linguistic_gateway.dart';
import 'package:mockza/services/media_bytes_platform.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/linguistic_cards.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/primitives.dart';

/// Closed-loop 10-Min Daily Transfer Mission workspace (`/mission/:missionId`).
class DailyMissionScreen extends ConsumerStatefulWidget {
  /// Creates a [DailyMissionScreen].
  const new({
    this.missionId = 'today',
    super.key,
  });

  /// Target mission identifier (`today` resolves current UTC serial day).
  final String missionId;

  @override
  ConsumerState<DailyMissionScreen> createState() => _DailyMissionScreenState();
}

const List<String> _kTopicQuickPicks = <String>[
  'Technology & AI',
  'Career & Workplace',
  'Travel & Culture',
  'Science & Climate',
  'Sports',
];

bool _matchesTargetDraft(String draftLower, String phrase) {
  final tokens = phrase
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9\s]'), ' ')
      .split(RegExp(r'\s+'))
      .where((w) => w.length > 2 && w != 'the' && w != 'for' && w != 'and')
      .take(2)
      .toList(growable: false);
  if (tokens.isEmpty) return false;
  return tokens.every(draftLower.contains);
}

class _DailyMissionScreenState extends ConsumerState<DailyMissionScreen> {
  final TextEditingController _controller = TextEditingController();
  final TextEditingController _customTopicCtrl = TextEditingController();
  DailyMissionSnapshot? _mission;
  String _examTrack = 'ielts_academic';
  bool _loading = true;
  bool _submitting = false;
  bool _refreshingTopic = false;
  bool _topicPickerOpen = false;
  bool _speakMode = false;
  bool _recording = false;
  String? _activeRecordingPath;
  String? _recordedAudioPath;
  final Set<String> _savedUpgrades = <String>{};
  String _draftSnapshot = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onDraftChanged);
    unawaited(_loadMission());
  }

  void _onDraftChanged() {
    final next = _controller.text;
    if (next != _draftSnapshot && mounted) {
      setState(() => _draftSnapshot = next);
    }
  }

  @override
  void dispose() {
    _controller
      ..removeListener(_onDraftChanged)
      ..dispose();
    _customTopicCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadMission() async {
    final gateway = ref.read(linguisticGatewayProvider);
    final repo = ref.read(linguisticRepositoryProvider);
    final cached = await repo.readTodayCachedMission();
    if (mounted && cached != null) {
      setState(() {
        _mission = cached;
        _examTrack = cached.examTrack;
        _loading = false;
      });
    }

    var examTrack = 'ielts_academic';
    try {
      final profile = await ref
          .read(profileRepositoryProvider)
          .loadOrInitializePrimary();
      if (profile.examId.isNotEmpty) examTrack = profile.examId;
    } on Object {
      // Fallback cleanly in isolated tests.
    }
    if (mounted) _examTrack = examTrack;

    final dueCards = await ref
        .read(vocabRepositoryProvider)
        .watchDueCards(limit: 5)
        .first;
    final dueWords = dueCards.map((c) => c.headword).toList(growable: false);
    final res = await gateway.getTodayMission(
      examTrack: examTrack,
      dueWords: dueWords,
    );
    if (!mounted) return;
    res.when(
      success: (snapshot) {
        unawaited(repo.cacheDailyMission(snapshot));
        setState(() {
          _mission = snapshot;
          _loading = false;
          _error = null;
        });
      },
      failure: (failure) {
        setState(() {
          _loading = false;
          if (_mission == null) _error = failure.message;
        });
      },
    );
  }

  Future<void> _refreshTopic(String topic) async {
    final clean = topic.trim();
    if (clean.length < 2 || _refreshingTopic) return;
    setState(() {
      _refreshingTopic = true;
      _error = null;
    });
    final res = await ref
        .read(linguisticGatewayProvider)
        .refreshTodayMission(focusTopic: clean, examTrack: _examTrack);
    if (!mounted) return;
    res.when(
      success: (updated) {
        unawaited(
          ref.read(linguisticRepositoryProvider).cacheDailyMission(updated),
        );
        setState(() {
          _mission = updated;
          _refreshingTopic = false;
          _topicPickerOpen = false;
          _customTopicCtrl.clear();
        });
      },
      failure: (f) => setState(() {
        _refreshingTopic = false;
        _error = f.message;
      }),
    );
  }

  void _insertStarterFrame() {
    final m = _mission;
    if (m == null) return;
    final first =
        (m.forcedTargets.firstOrNull?.phraseEn ?? 'Were we to prioritize')
            .replaceAll(RegExp(r'\.+$'), '')
            .trim();
    final second = m.forcedTargets.length > 1
        ? m.forcedTargets[1].phraseEn
        : 'albeit';
    final frame =
        '$first, outcomes around ${m.focusTopic} improve noticeably, $second alongside clear tradeoffs.';
    final current = _controller.text.trim();
    _controller.text = current.isEmpty ? frame : '$current $frame';
  }

  Future<void> _toggleSpeakRecording() async {
    final recorder = ref.read(audioRecorderGatewayProvider);
    final clock = ref.read(clockProvider);
    setState(() => _error = null);

    if (!_recording) {
      final path = await createTempRecordingPath(
        'mission_${clock.now().millisecondsSinceEpoch}.m4a',
      );
      _activeRecordingPath = path;
      final res = await recorder.startRecording(outputPath: path);
      if (!mounted) return;
      res.when(
        success: (_) => setState(() {
          _recording = true;
          _recordedAudioPath = null;
        }),
        failure: (f) => setState(() => _error = f.message),
      );
      return;
    }

    setState(() => _recording = false);
    final stopRes = await recorder.stopRecording();
    final path = stopRes.valueOrNull ?? _activeRecordingPath;
    _activeRecordingPath = null;
    if (!mounted) return;
    if (path == null || path.isEmpty) {
      setState(
        () => _error = stopRes.failureOrNull?.message ?? 'Recording failed.',
      );
      return;
    }
    setState(() => _recordedAudioPath = path);
  }

  Future<void> _logCoachProgress() async {
    try {
      await ref
          .read(progressRepositoryProvider)
          .logTodayActivity(studySeconds: 180, completedItems: 1);
    } on Object {
      // Non-fatal in minimal widget tests.
    }
  }

  Future<void> _saveUpgradeToDeck(
    MissionInlineUpgradeDto item,
    DailyMissionSnapshot m,
  ) async {
    final vocab = ref.read(vocabRepositoryProvider);
    final isRtl = ref.read(editionConfigProvider).edition == AppEdition.iran;
    await vocab.captureMistakeToDeck(
      cardId:
          'mission-upg-${item.upgraded.toLowerCase().replaceAll(RegExp('[^a-z0-9]+'), '-')}',
      headword: item.upgraded,
      definition: item.whyEn,
      glossFa: isRtl ? item.whyEn : null,
      topicTag: m.focusTopic,
      contextSentence: m.modelRewriteEn ?? item.upgraded,
      sourceSkill: _speakMode ? 'speaking' : 'writing',
      sourceAttemptId: m.missionId,
      sourceRefLabel: "Today's 10-Min Coach",
    );
    if (mounted) {
      setState(() => _savedUpgrades.add(item.upgraded));
    }
  }

  Future<void> _submit() async {
    final m = _mission;
    if (m == null) return;

    if (_speakMode) {
      final audioPath = _recordedAudioPath;
      if (audioPath == null) return;
      setState(() {
        _submitting = true;
        _error = null;
      });
      final bytes = await readRecordedAudioBytes(audioPath);
      if (!mounted) return;
      if (bytes == null || bytes.isEmpty) {
        setState(() {
          _submitting = false;
          _error = 'Recorded audio could not be read.';
        });
        return;
      }
      final recorder = ref.read(audioRecorderGatewayProvider);
      final res = await ref
          .read(linguisticGatewayProvider)
          .completeMissionWithAudio(
            missionId: m.missionId,
            audioBytes: bytes,
            mimeType: recorder.activeContentType,
          );
      if (!mounted) return;
      await res.when(
        success: (updated) async {
          await ref
              .read(linguisticRepositoryProvider)
              .cacheDailyMission(updated);
          unawaited(_logCoachProgress());
          if (!mounted) return;
          setState(() {
            _mission = updated;
            _submitting = false;
          });
        },
        failure: (f) async {
          setState(() {
            _submitting = false;
            _error = f.message;
          });
        },
      );
      return;
    }

    final text = _controller.text.trim();
    if (text.length < 10) return;
    final draftLower = text.toLowerCase();
    final matchedKeys = m.forcedTargets
        .where((t) => _matchesTargetDraft(draftLower, t.phraseEn))
        .map((t) => t.canonicalKey)
        .toList(growable: false);

    setState(() {
      _submitting = true;
      _error = null;
    });
    final res = await ref
        .read(linguisticGatewayProvider)
        .completeMission(
          missionId: m.missionId,
          responseText: text,
          usedTargetKeys: matchedKeys,
        );
    if (!mounted) return;
    await res.when(
      success: (updated) async {
        await ref.read(linguisticRepositoryProvider).cacheDailyMission(updated);
        unawaited(_logCoachProgress());
        if (!mounted) return;
        setState(() {
          _mission = updated;
          _submitting = false;
        });
      },
      failure: (failure) async {
        if (failure is NetworkFailure) {
          final isRtl =
              ref.read(editionConfigProvider).edition == AppEdition.iran;
          await ref
              .read(attemptRepositoryProvider)
              .enqueueOutboxAction(
                actionType: 'mission.complete',
                payloadJson: jsonEncode(<String, Object?>{
                  'missionId': m.missionId,
                  'responseText': text,
                }),
              );
          ref.read(outboxSyncServiceProvider).notifyWorkEnqueued();
          final optimistic = DailyMissionSnapshot(
            missionId: m.missionId,
            edition: m.edition,
            examTrack: m.examTrack,
            missionDaySerial: m.missionDaySerial,
            status: 'completed',
            focusTopic: m.focusTopic,
            promptTitle: m.promptTitle,
            promptTextEn: m.promptTextEn,
            promptTextFa: m.promptTextFa,
            forcedTargets: m.forcedTargets,
            feedbackEn: 'Saved offline — evaluation will sync automatically when online.',
            feedbackFa: 'پاسخ به صورت آفلاین ذخیره شد و با برقراری اینترنت به طور خودکار همگام‌سازی می‌شود.',
            matchedTargets: m.matchedTargets,
          );
          await ref
              .read(linguisticRepositoryProvider)
              .cacheDailyMission(optimistic);
          if (!mounted) return;
          setState(() {
            _mission = optimistic;
            _submitting = false;
            _error = isRtl
                ? 'اتصال اینترنت برقرار نیست؛ مأموریت در صف همگام‌سازی ذخیره شد.'
                : 'Offline — your mission response is queued for sync.';
          });
          return;
        }
        setState(() {
          _submitting = false;
          _error = failure.message;
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
    final m = _mission;
    final draftLower = _draftSnapshot.toLowerCase();
    final detectedTargets = m == null
        ? const <String>[]
        : m.forcedTargets
              .where((t) => _matchesTargetDraft(draftLower, t.phraseEn))
              .map((t) => t.phraseEn)
              .toList(growable: false);

    return MzScaffold(
      appBar: AppBar(
        title: Text(l10n.dailyMissionTitle),
        actions: <Widget>[
          IconButton(
            tooltip: l10n.linguisticGraphTitle,
            icon: const AppIcon(LucideGlyph.chartIncreasing),
            onPressed: () => context.push(AppRoutes.linguisticGraph),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
              children: <Widget>[
                if (_error != null)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(
                      bottom: SpacingTokens.sm,
                    ),
                    child: Text(
                      _error!,
                      style: typography.caption.copyWith(color: colors.error),
                    ),
                  ),
                if (m != null) ...<Widget>[
                  Text(
                    m.promptTitle,
                    style: typography.headline.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  Wrap(
                    spacing: SpacingTokens.xs,
                    runSpacing: SpacingTokens.xs,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: <Widget>[
                      MzChip(
                        label: m.focusTopic,
                        variant: MzChipVariant.target,
                      ),
                      ActionChip(
                        key: const ValueKey<String>('mission_change_topic_btn'),
                        avatar: const AppIcon(LucideGlyph.rotateCcw, size: 14),
                        label: Text(isRtl ? 'تغییر موضوع' : 'Change Topic'),
                        onPressed: () => setState(
                          () => _topicPickerOpen = !_topicPickerOpen,
                        ),
                      ),
                    ],
                  ),
                  if (_topicPickerOpen) ...<Widget>[
                    const SizedBox(height: SpacingTokens.sm),
                    MzCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          Text(
                            isRtl ? 'یک موضوع جدید انتخاب کنید:' : 'Pick a fresh topic for today (up to 2x/day):',
                            style: typography.caption.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.xs),
                          Wrap(
                            spacing: SpacingTokens.xs,
                            runSpacing: SpacingTokens.xs,
                            children: _kTopicQuickPicks
                                .map(
                                  (t) => ActionChip(
                                    label: Text(t),
                                    onPressed: _refreshingTopic
                                        ? null
                                        : () => unawaited(_refreshTopic(t)),
                                  ),
                                )
                                .toList(growable: false),
                          ),
                          const SizedBox(height: SpacingTokens.sm),
                          Row(
                            children: <Widget>[
                              Expanded(
                                child: TextField(
                                  controller: _customTopicCtrl,
                                  decoration: InputDecoration(
                                    isDense: true,
                                    hintText: isRtl
                                        ? 'موضوع دلخواه...'
                                        : 'Custom topic...',
                                    border: const OutlineInputBorder(),
                                  ),
                                ),
                              ),
                              const SizedBox(width: SpacingTokens.xs),
                              SecondaryButton(
                                label: _refreshingTopic
                                    ? '...'
                                    : (isRtl ? 'اعمال' : 'Apply'),
                                isFullWidth: false,
                                onPressed: _refreshingTopic
                                    ? null
                                    : () => unawaited(
                                        _refreshTopic(_customTopicCtrl.text),
                                      ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: SpacingTokens.md),
                  MzCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: <Widget>[
                            Expanded(
                              child: Text(
                                isRtl
                                    ? 'حتماً از این ۲ ساختار هدف استفاده کنید:'
                                    : 'Required Transfer Targets:',
                                style: typography.caption.copyWith(
                                  color: colors.textSecondary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            if (!_speakMode) ...<Widget>[
                              const SizedBox(width: SpacingTokens.xs),
                              Text(
                                '${detectedTargets.length}/${m.forcedTargets.length}',
                                style: typography.caption.copyWith(
                                  color: colors.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: SpacingTokens.xs),
                        TargetStructureChips(
                          phrases: m.forcedTargets
                              .map((f) => f.phraseEn)
                              .toList(growable: false),
                        ),
                        const SizedBox(height: SpacingTokens.sm),
                        ...m.forcedTargets.map(
                          (f) => Padding(
                            padding: const EdgeInsetsDirectional.only(
                              bottom: SpacingTokens.xs,
                            ),
                            child: Text(
                              '${detectedTargets.contains(f.phraseEn) ? '✓ ' : ''}${f.phraseEn}: ${isRtl && f.hintFa != null ? f.hintFa! : f.hintEn}',
                              style: typography.caption.copyWith(
                                color: detectedTargets.contains(f.phraseEn)
                                    ? colors.success
                                    : colors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.md),
                  MzCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        if (isRtl && m.promptTextFa != null) ...<Widget>[
                          Text(
                            m.promptTextFa!,
                            style: typography.body.copyWith(
                              color: colors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.sm),
                        ],
                        LtrExamBoundary(
                          child: Text(
                            m.promptTextEn,
                            style: typography.body.copyWith(
                              color: colors.textPrimary,
                            ),
                          ),
                        ),
                        const SizedBox(height: SpacingTokens.md),
                        Wrap(
                          spacing: SpacingTokens.xs,
                          runSpacing: SpacingTokens.xs,
                          children: <Widget>[
                            ChoiceChip(
                              key: const ValueKey<String>(
                                'mission_mode_write_chip',
                              ),
                              label: Text(isRtl ? 'نوشتن' : 'Write'),
                              selected: !_speakMode,
                              onSelected: (_) =>
                                  setState(() => _speakMode = false),
                            ),
                            ChoiceChip(
                              key: const ValueKey<String>(
                                'mission_mode_speak_chip',
                              ),
                              label: Text(isRtl ? 'صحبت کردن' : 'Speak'),
                              selected: _speakMode,
                              onSelected: (_) =>
                                  setState(() => _speakMode = true),
                            ),
                            if (!_speakMode)
                              ActionChip(
                                avatar: const AppIcon(
                                  LucideGlyph.sparkles,
                                  size: 14,
                                ),
                                label: Text(
                                  isRtl
                                      ? 'درج الگوی شروع'
                                      : 'Insert Starter Frame',
                                ),
                                onPressed: _insertStarterFrame,
                              ),
                          ],
                        ),
                        const SizedBox(height: SpacingTokens.sm),
                        if (!_speakMode)
                          LtrExamBoundary(
                            child: TextField(
                              key: const ValueKey<String>(
                                'mission_response_field',
                              ),
                              controller: _controller,
                              maxLines: 5,
                              decoration: InputDecoration(
                                hintText: isRtl
                                    ? 'پاسخ انگلیسی خود را با ساختارهای هدف بنویسید...'
                                    : 'Write 4–6 sentences using both forced structures...',
                                border: const OutlineInputBorder(),
                              ),
                            ),
                          )
                        else ...<Widget>[
                          SecondaryButton(
                            key: const ValueKey<String>(
                              'mission_speak_record_btn',
                            ),
                            label: _recording
                                ? (isRtl ? 'توقف ضبط' : 'Stop Recording')
                                : _recordedAudioPath != null
                                ? (isRtl ? 'ضبط مجدد' : 'Re-record Voice')
                                : (isRtl
                                      ? 'ضبط پاسخ صوتی (۱۰–۴۵ ثانیه)'
                                      : 'Record Spoken Response (10–45s)'),
                            glyph: _recording
                                ? LucideGlyph.micOff
                                : LucideGlyph.mic,
                            onPressed: _toggleSpeakRecording,
                          ),
                          if (_recordedAudioPath != null) ...<Widget>[
                            const SizedBox(height: SpacingTokens.xs),
                            Text(
                              isRtl
                                  ? 'فایل صوتی آماده ثبت است.'
                                  : 'Voice response captured and ready.',
                              style: typography.caption.copyWith(
                                color: colors.success,
                              ),
                            ),
                          ],
                        ],
                        const SizedBox(height: SpacingTokens.md),
                        PrimaryButton(
                          key: const ValueKey<String>('mission_complete_btn'),
                          label: isRtl
                              ? 'ثبت و ارزیابی مأموریت'
                              : 'Complete Mission',
                          glyph: LucideGlyph.check,
                          isLoading: _submitting,
                          onPressed: _submitting ? null : _submit,
                        ),
                      ],
                    ),
                  ),
                  if (m.status == 'completed' &&
                      (m.feedbackEn != null ||
                          m.feedbackFa != null)) ...<Widget>[
                    const SizedBox(height: SpacingTokens.md),
                    MzCard(
                      key: const ValueKey<String>('mission_completed_card'),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: <Widget>[
                              Text(
                                isRtl ? 'بازخورد مربی' : 'Coach Critique',
                                style: typography.cardTitle.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              if (m.clarityScore1To5 != null)
                                MzChip(
                                  label: isRtl
                                      ? 'شفافیت ${EdgeNumerals.toPersianDigits(m.clarityScore1To5!)}/۵'
                                      : 'Clarity ${m.clarityScore1To5}/5',
                                  variant: MzChipVariant.target,
                                ),
                            ],
                          ),
                          const SizedBox(height: SpacingTokens.xs),
                          Text(
                            isRtl && m.feedbackFa != null
                                ? m.feedbackFa!
                                : (m.feedbackEn ?? 'Completed!'),
                            style: typography.body.copyWith(
                              color: colors.success,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (m.transcriptEn != null &&
                              m.transcriptEn!.isNotEmpty) ...<Widget>[
                            const SizedBox(height: SpacingTokens.sm),
                            LtrExamBoundary(
                              child: Text(
                                '"${m.transcriptEn!}"',
                                style: typography.caption.copyWith(
                                  color: colors.textSecondary,
                                  fontStyle: FontStyle.italic,
                                ),
                              ),
                            ),
                          ],
                          if (m.matchedTargets.isNotEmpty) ...<Widget>[
                            const SizedBox(height: SpacingTokens.xs),
                            TargetStructureChips(phrases: m.matchedTargets),
                          ],
                          if (m.missedTargets.isNotEmpty) ...<Widget>[
                            const SizedBox(height: SpacingTokens.xs),
                            Text(
                              '${isRtl ? 'برای تلاش بعدی:' : 'Try next time:'} ${m.missedTargets.join(', ')}',
                              style: typography.caption.copyWith(
                                color: colors.warning,
                              ),
                            ),
                          ],
                          if (m.inlineUpgrades.isNotEmpty) ...<Widget>[
                            const SizedBox(height: SpacingTokens.md),
                            for (final u in m.inlineUpgrades)
                              Padding(
                                padding: const EdgeInsetsDirectional.only(
                                  bottom: SpacingTokens.sm,
                                ),
                                child: LtrExamBoundary(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: <Widget>[
                                      Text(
                                        '${u.original} -> ${u.upgraded}',
                                        style: typography.secondary.copyWith(
                                          fontWeight: FontWeight.w600,
                                          color: colors.primary,
                                        ),
                                      ),
                                      Text(
                                        u.whyEn,
                                        style: typography.caption.copyWith(
                                          color: colors.textSecondary,
                                        ),
                                      ),
                                      const SizedBox(height: SpacingTokens.xs),
                                      SecondaryButton(
                                        label:
                                            _savedUpgrades.contains(u.upgraded)
                                            ? l10n.savedToSm2
                                            : l10n.saveToSm2,
                                        isFullWidth: false,
                                        onPressed:
                                            _savedUpgrades.contains(u.upgraded)
                                            ? null
                                            : () => unawaited(
                                                _saveUpgradeToDeck(u, m),
                                              ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                          ],
                          if (m.modelRewriteEn != null &&
                              m.modelRewriteEn!.isNotEmpty) ...<Widget>[
                            const SizedBox(height: SpacingTokens.sm),
                            Text(
                              isRtl
                                  ? 'پاسخ نمونه نمره بالا:'
                                  : 'Band 8+ Model Version:',
                              style: typography.caption.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: SpacingTokens.xs),
                            LtrExamBoundary(
                              child: Text(
                                m.modelRewriteEn!,
                                style: typography.secondary,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ],
              ],
            ),
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/advanced/drop_input_policy.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/linguistic_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/inline_listen_button.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/speech_practice_sheet.dart';
import 'package:mockza/theme/primitives.dart';

/// Displays extracted idioms inside [LtrExamBoundary] + 2-Min Active Quiz & Vocab Deck save (`/drop/drill/:dropId`).
class DropDrillScreen extends ConsumerStatefulWidget {
  /// Creates a [DropDrillScreen].
  const new({
    required this.dropId,
    super.key,
  });

  /// Drop content UUID.
  final String dropId;

  @override
  ConsumerState<DropDrillScreen> createState() => _DropDrillScreenState();
}

class _DropDrillScreenState extends ConsumerState<DropDrillScreen> {
  final TextEditingController _clozeCtrl = TextEditingController();
  DroppedContentDto? _drop;
  int? _selectedIdx;
  bool _loading = true;
  bool _clozeSubmitted = false;
  bool _showClozeHint = false;
  bool _showClozeAnswer = false;
  bool _drillCompleted = false;
  final Set<String> _savedHeadwords = <String>{};

  String _buildHint(String answer) => answer
      .trim()
      .split(RegExp(r'\s+'))
      .map((w) => w.length <= 2 ? w : '${w[0]}${'_' * (w.length - 1)}')
      .join(' ');

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    _clozeCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final repo = ref.read(linguisticRepositoryProvider);
    final cachedList = await repo.listCachedDrops();
    final cached = cachedList
        .where((d) => d.dropId == widget.dropId)
        .firstOrNull;
    if (mounted && cached != null) {
      setState(() {
        _drop = cached;
        _loading = false;
      });
    }

    final res = await ref
        .read(linguisticGatewayProvider)
        .getDropById(widget.dropId);
    if (!mounted) return;
    res.when(
      success: (d) {
        unawaited(repo.cacheDroppedContent(d));
        setState(() {
          _drop = d;
          _loading = false;
        });
      },
      failure: (_) => setState(() => _loading = false),
    );
  }

  Future<void> _savePhrase(DroppedPhraseDto phrase) async {
    final isRtl = ref.read(editionConfigProvider).edition == AppEdition.iran;
    await ref
        .read(vocabRepositoryProvider)
        .captureMistakeToDeck(
          cardId:
              'drop-${phrase.headword.toLowerCase().replaceAll(RegExp('[^a-z0-9]+'), '-')}',
          headword: phrase.headword,
          definition: phrase.definitionEn,
          glossFa: isRtl ? phrase.glossFa : null,
          ipa: phrase.ipa,
          topicTag: 'drop_anything',
          contextSentence: phrase.exampleSentence,
          sourceSkill: _drop?.inputKind == 'audio' ? 'listening' : 'reading',
          sourceAttemptId: widget.dropId,
          sourceRefLabel: _drop?.sourceDomainOrLabel ?? 'Drop Anything',
        );
    if (mounted) {
      setState(() => _savedHeadwords.add(phrase.headword));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final l10n = AppLocalizations.of(context);
    final isRtl = ref.watch(editionConfigProvider).edition == AppEdition.iran;
    final d = _drop;

    return MzScaffold(
      appBar: AppBar(
        title: Text(l10n.dropDrillTitle),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : d == null
          ? Center(
              child: Text(isRtl ? 'محتوا یافت نشد.' : 'Drop item not found.'),
            )
          : ListView(
              padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
              children: <Widget>[
                LtrExamBoundary(
                  child: Text(
                    d.title,
                    style: typography.headline.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                ),
                const SizedBox(height: SpacingTokens.sm),
                Wrap(
                  spacing: SpacingTokens.xs,
                  runSpacing: SpacingTokens.xs,
                  children: <Widget>[
                    MzChip(
                      label: isRtl ? '۱. اصطلاحات' : '1. Phrases',
                      variant: _savedHeadwords.isNotEmpty
                          ? MzChipVariant.positive
                          : MzChipVariant.neutral,
                    ),
                    MzChip(
                      label: isRtl ? '۲. درک مطلب' : '2. Comprehend',
                      variant: _selectedIdx != null
                          ? MzChipVariant.positive
                          : MzChipVariant.neutral,
                    ),
                    MzChip(
                      label: isRtl ? '۳. جای‌گذاری' : '3. Fill Blank',
                      variant:
                          DropInputPolicy.checkClozeAnswer(
                            _clozeCtrl.text,
                            d.clozeAnswer,
                          )
                          ? MzChipVariant.positive
                          : MzChipVariant.neutral,
                    ),
                    MzChip(
                      label: isRtl ? '۴. تکرار شفاهی' : '4. Say Aloud',
                      variant: _drillCompleted
                          ? MzChipVariant.positive
                          : MzChipVariant.neutral,
                    ),
                  ],
                ),
                const SizedBox(height: SpacingTokens.sm),
                ...d.extractedPhrases.map((p) {
                  final isSaved = _savedHeadwords.contains(p.headword);
                  return Padding(
                    padding: const EdgeInsetsDirectional.only(
                      bottom: SpacingTokens.sm,
                    ),
                    child: MzCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          LtrExamBoundary(
                            child: Text(
                              '${p.headword} ${p.ipa ?? ''}'.trim(),
                              style: typography.cardTitle.copyWith(
                                color: colors.primary,
                              ),
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.xs),
                          LtrExamBoundary(
                            child: Text(
                              p.definitionEn,
                              style: typography.body.copyWith(
                                color: colors.textPrimary,
                              ),
                            ),
                          ),
                          if (isRtl && p.glossFa != null) ...<Widget>[
                            const SizedBox(height: SpacingTokens.xs),
                            Text(
                              p.glossFa!,
                              style: typography.caption.copyWith(
                                color: colors.primary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                          const SizedBox(height: SpacingTokens.xs),
                          LtrExamBoundary(
                            child: Text(
                              '“${p.exampleSentence}”',
                              style: typography.caption.copyWith(
                                color: colors.textSecondary,
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.xs),
                          Wrap(
                            spacing: SpacingTokens.xs,
                            runSpacing: SpacingTokens.xs,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: <Widget>[
                              InlineListenButton(
                                text: p.exampleSentence,
                                sourceContext: 'drop_drill',
                              ),
                              ActionChip(
                                avatar: AppIcon(
                                  LucideGlyph.mic,
                                  size: 14,
                                  color: colors.primary,
                                ),
                                label: Text(l10n.practiceSpeechCta),
                                onPressed: () => unawaited(
                                  SpeechPracticeSheet.show(
                                    context,
                                    targetText: p.exampleSentence,
                                    sourceRefType: 'drop_phrase',
                                    sourceRefId: p.headword,
                                    sourceContext: 'drop_drill',
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: SpacingTokens.sm),
                          SecondaryButton(
                            key: ValueKey<String>('save_drop_${p.headword}'),
                            label: isSaved ? l10n.savedToSm2 : l10n.saveToSm2,
                            glyph: isSaved
                                ? LucideGlyph.checkCircle2
                                : LucideGlyph.bookmarkPlus,
                            onPressed: isSaved ? null : () => _savePhrase(p),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
                const SizedBox(height: SpacingTokens.md),
                MzCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      LtrExamBoundary(
                        child: Text(
                          d.comprehensionPrompt,
                          style: typography.cardTitle.copyWith(
                            color: colors.textPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.sm),
                      ...List<Widget>.generate(d.comprehensionOptions.length, (
                        idx,
                      ) {
                        final selected = _selectedIdx == idx;
                        final isCorrectOption = idx == d.correctOptionIndex;
                        final answered = _selectedIdx != null;
                        final glyph = !selected
                            ? LucideGlyph.circle
                            : (isCorrectOption
                                  ? LucideGlyph.checkCircle2
                                  : LucideGlyph.alertCircle);
                        final iconColor = !selected
                            ? (answered && isCorrectOption
                                  ? colors.success
                                  : colors.textSecondary)
                            : (isCorrectOption ? colors.success : colors.error);
                        final textColor = !selected
                            ? (answered && isCorrectOption
                                  ? colors.success
                                  : colors.textPrimary)
                            : (isCorrectOption ? colors.success : colors.error);
                        return Padding(
                          padding: const EdgeInsetsDirectional.only(
                            bottom: SpacingTokens.xs,
                          ),
                          child: MzCard(
                            onTap: () => setState(() => _selectedIdx = idx),
                            child: Row(
                              children: <Widget>[
                                AppIcon(
                                  glyph,
                                  color: iconColor,
                                ),
                                const SizedBox(width: SpacingTokens.sm),
                                Expanded(
                                  child: LtrExamBoundary(
                                    child: Text(
                                      d.comprehensionOptions[idx],
                                      style: typography.body.copyWith(
                                        color: textColor,
                                        fontWeight:
                                            selected ||
                                                (answered && isCorrectOption)
                                            ? FontWeight.w600
                                            : FontWeight.w400,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                      if (_selectedIdx != null) ...<Widget>[
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          _selectedIdx == d.correctOptionIndex
                              ? (isRtl
                                    ? 'پاسخ دقیق و صحیح است.'
                                    : 'Correct comprehension answer.')
                              : (isRtl
                                    ? 'پاسخ نادرست بود؛ گزینه صحیح مشخص شده است.'
                                    : 'Not quite — the correct option is highlighted in green.'),
                          key: const ValueKey<String>('drop_mcq_feedback'),
                          style: typography.caption.copyWith(
                            color: _selectedIdx == d.correctOptionIndex
                                ? colors.success
                                : colors.error,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if ((isRtl && d.comprehensionExplanationFa != null) ||
                            d.comprehensionExplanationEn != null) ...<Widget>[
                          const SizedBox(height: SpacingTokens.xs),
                          Text(
                            isRtl && d.comprehensionExplanationFa != null
                                ? d.comprehensionExplanationFa!
                                : d.comprehensionExplanationEn!,
                            style: typography.caption.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ],
                      const SizedBox(height: SpacingTokens.md),
                      Text(
                        isRtl
                            ? '۲. یادآوری فعال و جای‌گذاری ساختار (Cloze Recall)'
                            : '2. Cloze Paraphrase Recall',
                        style: typography.caption.copyWith(
                          color: colors.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.xs),
                      LtrExamBoundary(
                        child: Text(
                          d.clozeSentence,
                          style: typography.body.copyWith(
                            color: colors.textPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.sm),
                      LtrExamBoundary(
                        child: TextField(
                          key: const ValueKey<String>('drop_cloze_field'),
                          controller: _clozeCtrl,
                          decoration: InputDecoration(
                            hintText: isRtl
                                ? 'عبارت جای‌خالی را به انگلیسی بنویسید...'
                                : 'Type the missing English phrase...',
                            border: const OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.sm),
                      Wrap(
                        spacing: SpacingTokens.xs,
                        runSpacing: SpacingTokens.xs,
                        children: <Widget>[
                          SecondaryButton(
                            key: const ValueKey<String>('drop_cloze_check_btn'),
                            label: isRtl ? 'بررسی پاسخ' : 'Check Recall',
                            glyph: LucideGlyph.check,
                            isFullWidth: false,
                            onPressed: () =>
                                setState(() => _clozeSubmitted = true),
                          ),
                          SecondaryButton(
                            label: isRtl ? 'راهنما' : 'Hint',
                            glyph: LucideGlyph.sparkles,
                            isFullWidth: false,
                            onPressed: () => setState(
                              () => _showClozeHint = !_showClozeHint,
                            ),
                          ),
                          SecondaryButton(
                            key: const ValueKey<String>('drop_cloze_hint_btn'),
                            label: isRtl ? 'نمایش پاسخ نمونه' : 'Show Answer',
                            glyph: LucideGlyph.eye,
                            isFullWidth: false,
                            onPressed: () =>
                                setState(() => _showClozeAnswer = true),
                          ),
                        ],
                      ),
                      if (_showClozeHint) ...<Widget>[
                        const SizedBox(height: SpacingTokens.xs),
                        Wrap(
                          spacing: SpacingTokens.xs,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: <Widget>[
                            Text(
                              isRtl ? 'راهنما:' : 'Hint:',
                              style: typography.caption.copyWith(
                                color: colors.primary,
                              ),
                            ),
                            LtrExamBoundary(
                              child: Text(
                                _buildHint(d.clozeAnswer),
                                style: typography.caption.copyWith(
                                  color: colors.primary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                      if (_clozeSubmitted) ...<Widget>[
                        const SizedBox(height: SpacingTokens.xs),
                        Builder(
                          builder: (context) {
                            final isMatch = DropInputPolicy.checkClozeAnswer(
                              _clozeCtrl.text,
                              d.clozeAnswer,
                            );
                            return Text(
                              isMatch
                                  ? (isRtl
                                        ? 'عالی! پاسخ شما درست است.'
                                        : 'Correct match! Great recall.')
                                  : (isRtl
                                        ? 'نزدیک است؛ می‌توانید «نمایش پاسخ نمونه» را بزنید.'
                                        : 'Keep refining — tap "Show Answer" to compare.'),
                              key: const ValueKey<String>(
                                'drop_cloze_feedback',
                              ),
                              style: typography.caption.copyWith(
                                color: isMatch
                                    ? colors.success
                                    : colors.warning,
                                fontWeight: FontWeight.w600,
                              ),
                            );
                          },
                        ),
                      ],
                      if (_showClozeAnswer) ...<Widget>[
                        const SizedBox(height: SpacingTokens.xs),
                        LtrExamBoundary(
                          child: Text(
                            d.clozeAnswer,
                            key: const ValueKey<String>('drop_cloze_answer'),
                            style: typography.caption.copyWith(
                              color: colors.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: SpacingTokens.md),
                      Wrap(
                        spacing: SpacingTokens.xs,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: <Widget>[
                          Text(
                            isRtl ? 'تکرار با صدای بلند:' : 'Shadow aloud:',
                            style: typography.caption.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                          LtrExamBoundary(
                            child: Text(
                              d.shadowingPrompt,
                              style: typography.caption.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: SpacingTokens.md),
                      if (!_drillCompleted)
                        PrimaryButton(
                          key: const ValueKey<String>('drop_complete_btn'),
                          label: isRtl
                              ? 'تکمیل تمرین و ثبت فعالیت امروز'
                              : 'I Practised Aloud — Finish Quiz',
                          glyph: LucideGlyph.checkCircle2,
                          onPressed: () {
                            setState(() => _drillCompleted = true);
                            unawaited(() async {
                              try {
                                await ref
                                    .read(progressRepositoryProvider)
                                    .logTodayActivity(
                                      studySeconds: 150,
                                      completedItems: 1,
                                    );
                              } on Object {
                                // Ignore in isolated tests.
                              }
                            }());
                          },
                        )
                      else ...<Widget>[
                        Text(
                          isRtl
                              ? 'عالی! فعالیت امروز در کارنامه و روند شما ثبت شد.'
                              : 'Nice work! Logged to your daily streak and activity.',
                          style: typography.caption.copyWith(
                            color: colors.success,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: SpacingTokens.xs),
                        Wrap(
                          spacing: SpacingTokens.sm,
                          children: <Widget>[
                            SecondaryButton(
                              label: isRtl
                                  ? 'مربی هوشمند'
                                  : 'Back to Smart Coach',
                              isFullWidth: false,
                              onPressed: () => context.go(AppRoutes.coach),
                            ),
                            SecondaryButton(
                              label: isRtl ? 'دفترچه واژگان' : 'Vocab Deck',
                              isFullWidth: false,
                              onPressed: () => context.go(AppRoutes.vocabulary),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/localization/edition_copy.dart';
import 'package:mockza/core/vocab/sm2_scheduler.dart';
import 'package:mockza/data/repositories/vocab_repository.dart';
import 'package:mockza/features/vocabulary/presentation/vocabulary_providers.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/routing/safe_pop.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/empty_state.dart';
import 'package:mockza/theme/components/inline_listen_button.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/mz_toast.dart';
import 'package:mockza/theme/components/speech_practice_sheet.dart';
import 'package:mockza/theme/primitives.dart';

/// Detailed lexical view and SM-2 metadata for a saved vocabulary word (Screen 19).
class VocabWordDetailScreen extends ConsumerWidget {
  /// Creates a [VocabWordDetailScreen].
  const new({
    required this.wordId,
    super.key,
  });

  /// The vocabulary card primary identifier.
  final String wordId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final allCardsAsync = ref.watch(allVocabCardsProvider);
    final colors = AppColors.of(context);
    final isIran = ref.watch(editionConfigProvider).edition == AppEdition.iran;
    final backIcon = AppIcon(
      isIran ? LucideGlyph.chevronRight : LucideGlyph.chevronLeft,
      size: 22,
    );
    final titleText = isIran ? 'جزئیات واژه' : 'Word Details';

    if (allCardsAsync.isLoading && !allCardsAsync.hasValue) {
      return MzScaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: backIcon,
            onPressed: () => context.safePopOrGo(AppRoutes.vocabulary),
          ),
          title: Text(titleText),
        ),
        body: Center(
          child: CircularProgressIndicator(color: colors.primary),
        ),
      );
    }

    final allCards = allCardsAsync.asData?.value ?? const <VocabDeckCard>[];
    final card = allCards.where((c) => c.cardId == wordId).firstOrNull;
    if (card == null) {
      return MzScaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: backIcon,
            onPressed: () => context.safePopOrGo(AppRoutes.vocabulary),
          ),
          title: Text(titleText),
        ),
        body: EmptyState(
          glyph: LucideGlyph.info,
          title: isIran ? 'واژه یافت نشد' : 'Word not found',
          description: isIran
              ? 'این کارت واژگان در دفترچه فعلی شما پیدا نشد.'
              : 'This vocabulary card could not be found in your local deck.',
          actionLabel: isIran
              ? 'بازگشت به دفترچه واژگان'
              : 'Back to Vocabulary',
          onTapAction: () => context.safePopOrGo(AppRoutes.vocabulary),
        ),
      );
    }

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: backIcon,
          onPressed: () => context.safePopOrGo(AppRoutes.vocabulary),
        ),
        title: Text(titleText),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.symmetric(
          vertical: SpacingTokens.lg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _buildHeadwordCard(context, card, isIran: isIran),
            const SizedBox(height: SpacingTokens.lg),
            _buildDefinitionCard(context, card, isIran: isIran),
            if (card.contextSentence != null) ...<Widget>[
              const SizedBox(height: SpacingTokens.md),
              _buildContextCard(context, card, isIran: isIran),
            ],
            if (card.usageNote != null) ...<Widget>[
              const SizedBox(height: SpacingTokens.md),
              _buildUsageNoteCard(context, card),
            ],
            const SizedBox(height: SpacingTokens.md),
            _buildSrsStatsCard(context, card, isIran: isIran),
            const SizedBox(height: SpacingTokens.xl),
            PrimaryButton(
              label: isIran
                  ? 'بازنشانی برای مرور امروز'
                  : 'Reset for Review Today',
              glyph: LucideGlyph.rotateCcw,
              onPressed: () {
                unawaited(
                  ref
                      .read(vocabularyNotifierProvider.notifier)
                      .rateCard(
                        card: card,
                        quality: ReviewQuality.again,
                      ),
                );
                showMzToast(
                  context,
                  message: isIran
                      ? 'کارت دوباره در صف مرور امروز قرار گرفت!'
                      : 'Card re-queued for review today!',
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeadwordCard(
    BuildContext context,
    VocabDeckCard card, {
    required bool isIran,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      variant: MzCardVariant.hero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Wrap(
            spacing: SpacingTokens.sm,
            runSpacing: SpacingTokens.xs,
            children: <Widget>[
              if (card.sourceSkill != null)
                MzChip(
                  label: EditionCopy.skillName(
                    card.sourceSkill!,
                    isIran: isIran,
                  ),
                  isSelected: true,
                ),
              MzChip(
                label: EditionCopy.topicLabel(card.topicTag, isIran: isIran),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          LtrExamBoundary(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  card.headword,
                  style: typography.sectionHeading.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                if (card.ipa != null) ...<Widget>[
                  const SizedBox(height: SpacingTokens.xs),
                  Text(
                    card.ipa!,
                    style: typography.body.copyWith(
                      color: colors.textSecondary,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
                const SizedBox(height: SpacingTokens.md),
                Wrap(
                  spacing: SpacingTokens.sm,
                  runSpacing: SpacingTokens.xs,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: <Widget>[
                    InlineListenButton(
                      text: card.headword,
                      sourceContext: 'vocab_detail',
                    ),
                    ActionChip(
                      avatar: AppIcon(
                        LucideGlyph.mic,
                        size: 14,
                        color: colors.primary,
                      ),
                      label: Text(
                        AppLocalizations.of(context).practiceSpeechCta,
                      ),
                      onPressed: () => unawaited(
                        SpeechPracticeSheet.show(
                          context,
                          targetText: card.headword,
                          practiceKind: card.headword.contains(' ')
                              ? 'collocation'
                              : 'word',
                          sourceRefType: 'vocab_card',
                          sourceRefId: card.cardId,
                          sourceContext: 'vocab_detail',
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDefinitionCard(
    BuildContext context,
    VocabDeckCard card, {
    required bool isIran,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            isIran ? 'معنی و تعریف' : 'Definition',
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
          if (card.glossFa != null &&
              card.glossFa!.trim().isNotEmpty) ...<Widget>[
            const SizedBox(height: SpacingTokens.xs),
            Text(
              card.glossFa!.trim(),
              style: typography.cardTitle.copyWith(
                color: colors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          const SizedBox(height: SpacingTokens.xs),
          LtrExamBoundary(
            child: Text(
              card.definition,
              style: typography.body.copyWith(
                color: colors.textPrimary,
                height: 1.45,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContextCard(
    BuildContext context,
    VocabDeckCard card, {
    required bool isIran,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            isIran ? 'نمونه کاربرد در جمله' : 'Example Context',
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.xs),
          LtrExamBoundary(
            child: Text(
              '"${card.contextSentence!}"',
              style: typography.body.copyWith(
                color: colors.textPrimary,
                fontStyle: FontStyle.italic,
                height: 1.45,
              ),
            ),
          ),
          const SizedBox(height: SpacingTokens.sm),
          Wrap(
            spacing: SpacingTokens.sm,
            runSpacing: SpacingTokens.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: <Widget>[
              InlineListenButton(
                text: card.contextSentence!,
                sourceContext: 'vocab_detail_sentence',
              ),
              ActionChip(
                avatar: AppIcon(
                  LucideGlyph.mic,
                  size: 14,
                  color: colors.primary,
                ),
                label: Text(
                  AppLocalizations.of(context).practiceSpeechCta,
                ),
                onPressed: () => unawaited(
                  SpeechPracticeSheet.show(
                    context,
                    targetText: card.contextSentence!,
                    sourceRefType: 'vocab_example',
                    sourceRefId: card.cardId,
                    sourceContext: 'vocab_detail_sentence',
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildUsageNoteCard(BuildContext context, VocabDeckCard card) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      variant: MzCardVariant.surfaceAlt,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const AppIcon(LucideGlyph.info, size: 20),
          const SizedBox(width: SpacingTokens.sm),
          Expanded(
            child: Text(
              card.usageNote!,
              style: typography.caption.copyWith(
                color: colors.textSecondary,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSrsStatsCard(
    BuildContext context,
    VocabDeckCard card, {
    required bool isIran,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final repsStr = isIran
        ? EdgeNumerals.toPersianDigits('${card.schedule.repetitions}')
        : '${card.schedule.repetitions}';
    final intervalStr = isIran
        ? '${EdgeNumerals.toPersianDigits('${card.schedule.intervalDays}')} روز'
        : '${card.schedule.intervalDays}d';
    final rawEase = (card.schedule.easeFactorMilli / 1000).toStringAsFixed(2);
    final easeStr = isIran ? EdgeNumerals.toPersianDigits(rawEase) : rawEase;

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            isIran ? 'برنامه مرور هوشمند (SRS)' : 'Spaced Repetition Schedule',
            style: typography.cardTitle.copyWith(
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: SpacingTokens.md),
          Row(
            children: <Widget>[
              Expanded(
                child: _buildStatItem(
                  isIran ? 'تکرارها' : 'Repetitions',
                  repsStr,
                  typography,
                  colors,
                ),
              ),
              const SizedBox(width: SpacingTokens.xs),
              Expanded(
                child: _buildStatItem(
                  isIran ? 'فاصله مرور' : 'Interval',
                  intervalStr,
                  typography,
                  colors,
                ),
              ),
              const SizedBox(width: SpacingTokens.xs),
              Expanded(
                child: _buildStatItem(
                  isIran ? 'ضریب یادآوری' : 'Ease Factor',
                  easeStr,
                  typography,
                  colors,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(
    String label,
    String value,
    AppTypography typography,
    AppColors colors,
  ) => Column(
    children: <Widget>[
      Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        textAlign: TextAlign.center,
        style: typography.caption.copyWith(color: colors.textSecondary),
      ),
      const SizedBox(height: SpacingTokens.xs),
      Text(
        value,
        style: typography.cardScore.copyWith(
          color: colors.textPrimary,
        ),
      ),
    ],
  );
}

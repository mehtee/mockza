import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/vocab/sm2_scheduler.dart';
import 'package:mockza/data/repositories/vocab_repository.dart';
import 'package:mockza/features/vocabulary/presentation/vocabulary_providers.dart';
import 'package:mockza/l10n/app_localizations.dart';
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

    if (allCardsAsync.isLoading && !allCardsAsync.hasValue) {
      return MzScaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const AppIcon(LucideGlyph.chevronLeft, size: 22),
            onPressed: () => context.safePopOrGo(AppRoutes.vocabulary),
          ),
          title: const Text('Word Details'),
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
            icon: const AppIcon(LucideGlyph.chevronLeft, size: 22),
            onPressed: () => context.safePopOrGo(AppRoutes.vocabulary),
          ),
          title: const Text('Word Details'),
        ),
        body: EmptyState(
          glyph: LucideGlyph.info,
          title: 'Word not found',
          description:
              'This vocabulary card could not be found in your local deck.',
          actionLabel: 'Back to Vocabulary',
          onTapAction: () => context.safePopOrGo(AppRoutes.vocabulary),
        ),
      );
    }

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const AppIcon(LucideGlyph.chevronLeft, size: 22),
          onPressed: () => context.safePopOrGo(AppRoutes.vocabulary),
        ),
        title: const Text('Word Details'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.symmetric(
          vertical: SpacingTokens.lg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _buildHeadwordCard(context, card),
            const SizedBox(height: SpacingTokens.lg),
            _buildDefinitionCard(context, card),
            if (card.contextSentence != null) ...<Widget>[
              const SizedBox(height: SpacingTokens.md),
              _buildContextCard(context, card),
            ],
            if (card.usageNote != null) ...<Widget>[
              const SizedBox(height: SpacingTokens.md),
              _buildUsageNoteCard(context, card),
            ],
            const SizedBox(height: SpacingTokens.md),
            _buildSrsStatsCard(context, card),
            const SizedBox(height: SpacingTokens.xl),
            PrimaryButton(
              label: 'Reset for Review Today',
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
                  message: 'Card re-queued for review today!',
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeadwordCard(BuildContext context, VocabDeckCard card) {
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
                  label: card.sourceSkill!,
                  isSelected: true,
                ),
              MzChip(label: card.topicTag),
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

  Widget _buildDefinitionCard(BuildContext context, VocabDeckCard card) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            'Definition',
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

  Widget _buildContextCard(BuildContext context, VocabDeckCard card) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            'Example Context',
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

  Widget _buildSrsStatsCard(BuildContext context, VocabDeckCard card) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            'Spaced Repetition Schedule',
            style: typography.cardTitle.copyWith(
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: SpacingTokens.md),
          Row(
            children: <Widget>[
              Expanded(
                child: _buildStatItem(
                  'Repetitions',
                  '${card.schedule.repetitions}',
                  typography,
                  colors,
                ),
              ),
              const SizedBox(width: SpacingTokens.xs),
              Expanded(
                child: _buildStatItem(
                  'Interval',
                  '${card.schedule.intervalDays}d',
                  typography,
                  colors,
                ),
              ),
              const SizedBox(width: SpacingTokens.xs),
              Expanded(
                child: _buildStatItem(
                  'Ease Factor',
                  (card.schedule.easeFactorMilli / 1000).toStringAsFixed(2),
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

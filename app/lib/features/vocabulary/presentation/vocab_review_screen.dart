import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/vocab/sm2_scheduler.dart';
import 'package:mockza/data/repositories/vocab_repository.dart';
import 'package:mockza/features/vocabulary/presentation/vocabulary_notifier.dart';
import 'package:mockza/features/vocabulary/presentation/vocabulary_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/routing/safe_pop.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/vocab_flip_card.dart';
import 'package:mockza/theme/primitives.dart';

/// Fullscreen SRS flashcard review workout (Screen 17).
class VocabReviewScreen extends ConsumerStatefulWidget {
  /// Creates a [VocabReviewScreen].
  const new({
    this.reviewAhead = false,
    this.batchLimit = 20,
    super.key,
  });

  /// When true, reviews earliest-due cards even if none are due today.
  final bool reviewAhead;

  /// Optional card count limit for this session (`null` = All available).
  final int? batchLimit;

  @override
  ConsumerState<VocabReviewScreen> createState() => _VocabReviewScreenState();
}

class _VocabReviewScreenState extends ConsumerState<VocabReviewScreen> {
  @override
  void initState() {
    super.initState();
    unawaited(
      Future.microtask(
        () => ref
            .read(vocabularyNotifierProvider.notifier)
            .loadSession(
              reviewAhead: widget.reviewAhead,
              batchLimit: widget.batchLimit,
            ),
      ),
    );
  }

  @override
  void didUpdateWidget(covariant VocabReviewScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reviewAhead != widget.reviewAhead ||
        oldWidget.batchLimit != widget.batchLimit) {
      unawaited(
        Future.microtask(
          () => ref
              .read(vocabularyNotifierProvider.notifier)
              .loadSession(
                reviewAhead: widget.reviewAhead,
                batchLimit: widget.batchLimit,
              ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(vocabularyNotifierProvider);
    final notifier = ref.read(vocabularyNotifierProvider.notifier);
    final colors = AppColors.of(context);

    final cards = state.sessionCards;
    final isDone =
        !state.isLoading &&
        (state.activeCardIndex >= cards.length || cards.isEmpty);

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const AppIcon(LucideGlyph.x, size: 20),
          onPressed: () => context.safePopOrGo(AppRoutes.vocabulary),
        ),
        title: Text(
          state.isLoading
              ? 'Loading Deck...'
              : (isDone
                    ? 'Review Complete'
                    : 'Card ${state.activeCardIndex + 1} of ${cards.length}'),
        ),
      ),
      body: state.isLoading
          ? Center(
              child: CircularProgressIndicator(color: colors.primary),
            )
          : (isDone
                ? _buildCompletionView(context, state, notifier)
                : _buildCardView(
                    context,
                    cards[state.activeCardIndex],
                    state.showAnswer,
                    notifier,
                  )),
    );
  }

  Widget _buildCardView(
    BuildContext context,
    VocabDeckCard card,
    bool isRevealed,
    VocabularyNotifier notifier,
  ) {
    final previewIntervals = Sm2Scheduler.previewIntervals(card.schedule);

    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.symmetric(
        vertical: SpacingTokens.lg,
      ),
      child: Column(
        children: <Widget>[
          VocabFlipCard(
            headword: card.headword,
            definition: card.definition,
            glossFa: card.glossFa,
            isRevealed: isRevealed,
            onTapFlip: notifier.toggleReveal,
            onSelectRating: (quality) {
              unawaited(notifier.rateCard(card: card, quality: quality));
            },
            ipa: card.ipa,
            contextSentence: card.contextSentence,
            sourceLabel: card.sourceSkill != null
                ? 'From ${card.sourceSkill}'
                : null,
            previewIntervals: previewIntervals,
          ),
          const SizedBox(height: SpacingTokens.lg),
          if (!isRevealed)
            PrimaryButton(
              label: 'Tap Card or Press to Reveal Answer',
              onPressed: notifier.toggleReveal,
            ),
        ],
      ),
    );
  }

  Widget _buildCompletionView(
    BuildContext context,
    VocabularyState state,
    VocabularyNotifier notifier,
  ) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Padding(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Center(
            child: AppIcon(
              LucideGlyph.checkCircle2,
              color: colors.success,
              size: 64,
            ),
          ),
          const SizedBox(height: SpacingTokens.lg),
          Text(
            'Flashcard Session Done!',
            textAlign: TextAlign.center,
            style: typography.sectionHeading.copyWith(
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: SpacingTokens.sm),
          Text(
            state.reviewedCount > 0
                ? 'You reviewed ${state.reviewedCount} words. Spaced repetition intervals have been refreshed.'
                : 'All caught up! No cards currently due for review.',
            textAlign: TextAlign.center,
            style: typography.body.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.xl),
          MzCard(
            child: Row(
              children: <Widget>[
                AppIcon(LucideGlyph.flame, color: colors.warning, size: 28),
                const SizedBox(width: SpacingTokens.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'Memory Reinforced',
                        style: typography.cardTitle.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                      Text(
                        'Daily spaced reviews protect high-band collocations from forgetting.',
                        style: typography.caption.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: SpacingTokens.xl),
          if (!state.isReviewAhead && state.sessionCards.isEmpty) ...<Widget>[
            SecondaryButton(
              label: 'Review Ahead Instead',
              onPressed: () =>
                  unawaited(notifier.loadSession(reviewAhead: true)),
            ),
            const SizedBox(height: SpacingTokens.md),
          ],
          PrimaryButton(
            label: 'Back to Vocabulary Deck',
            onPressed: () => context.safePopOrGo(AppRoutes.vocabulary),
          ),
        ],
      ),
    );
  }
}

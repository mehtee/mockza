import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/data/repositories/vocab_repository.dart';
import 'package:mockza/features/vocabulary/presentation/vocabulary_providers.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/brand_header.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/primitives.dart';

/// Spaced repetition vocabulary dashboard and saved words screen (Screens 16 & 18).
class VocabularyScreen extends ConsumerWidget {
  /// Creates a [VocabularyScreen].
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final dueCardsAsync = ref.watch(dueVocabCardsProvider);
    final allCardsAsync = ref.watch(allVocabCardsProvider);
    final filter = ref.watch(vocabFilterProvider);
    final searchQuery = ref.watch(vocabSearchQueryProvider);

    final isInitialLoading =
        (dueCardsAsync.isLoading && !dueCardsAsync.hasValue) ||
        (allCardsAsync.isLoading && !allCardsAsync.hasValue);

    final dueCards = dueCardsAsync.asData?.value ?? const <VocabDeckCard>[];
    final allCards = allCardsAsync.asData?.value ?? const <VocabDeckCard>[];

    final filteredCards = allCards
        .where((card) {
          final matchesFilter =
              filter == 'All' ||
              (card.sourceSkill != null &&
                  card.sourceSkill!.toLowerCase() == filter.toLowerCase()) ||
              card.topicTag.toLowerCase() == filter.toLowerCase();
          final matchesSearch =
              searchQuery.isEmpty ||
              card.headword.toLowerCase().contains(searchQuery.toLowerCase()) ||
              card.definition.toLowerCase().contains(searchQuery.toLowerCase());
          return matchesFilter && matchesSearch;
        })
        .toList(growable: false);

    final masteredCount = allCards
        .where(
          (c) =>
              c.schedule.repetitions >= 4 && c.schedule.easeFactorMilli >= 2500,
        )
        .length;
    final learningCount = allCards.length - masteredCount;

    return MzScaffold(
      body: CustomScrollView(
        slivers: <Widget>[
          SliverToBoxAdapter(
            child: BrandHeader(
              title: 'Vocabulary Deck',
              onTapSettings: () => context.push(AppRoutes.settings),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
            sliver: SliverList(
              delegate: SliverChildListDelegate(
                <Widget>[
                  if (isInitialLoading)
                    Center(
                      child: Padding(
                        padding: const EdgeInsetsDirectional.all(
                          SpacingTokens.xl,
                        ),
                        child: CircularProgressIndicator(color: colors.primary),
                      ),
                    )
                  else ...<Widget>[
                    _buildDueTodayHero(
                      context,
                      ref,
                      dueCount: dueCards.length,
                      totalCount: allCards.length,
                    ),
                  ],
                  const SizedBox(height: SpacingTokens.lg),
                  Text(
                    'Your Retention Progress',
                    style: typography.cardTitle.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  _buildProgressGrid(
                    context,
                    total: allCards.length,
                    mastered: masteredCount,
                    learning: learningCount,
                    due: dueCards.length,
                  ),
                  const SizedBox(height: SpacingTokens.xl),
                  Row(
                    children: <Widget>[
                      Text(
                        'Saved Words & Phrases',
                        style: typography.cardTitle.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        '${filteredCards.length} saved',
                        style: typography.caption.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  _buildSearchBar(context, ref),
                  const SizedBox(height: SpacingTokens.sm),
                  _buildFilterChips(context, ref, filter),
                  const SizedBox(height: SpacingTokens.md),
                  if (filteredCards.isEmpty)
                    _buildEmptyState(context)
                  else
                    ...filteredCards.map(
                      (card) => _buildCardTile(context, card),
                    ),
                  const SizedBox(height: SpacingTokens.xxl),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDueTodayHero(
    BuildContext context,
    WidgetRef ref, {
    required int dueCount,
    required int totalCount,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    final String headingText;
    final String bodyText;
    final String ctaLabel;
    final VoidCallback onTapCta;

    if (dueCount > 0) {
      headingText = '$dueCount words due for review';
      bodyText = 'Review today to lock these academic collocations into long-term memory.';
      ctaLabel = 'Start Review';
      onTapCta = () => context.push(AppRoutes.vocabReview);
    } else if (totalCount > 0) {
      headingText = 'All caught up for today!';
      bodyText = 'Great job! Practice ahead or return tomorrow for your next interval.';
      ctaLabel = 'Review Ahead';
      onTapCta = () => context.push('${AppRoutes.vocabReview}?mode=ahead');
    } else {
      headingText = 'Vocabulary deck empty';
      bodyText = 'Sync starter collocations from the server or save upgrades from your evaluations.';
      ctaLabel = 'Sync Vocabulary';
      onTapCta = () => unawaited(
        ref
            .read(contentSyncServiceProvider)
            .syncAllCatalogData(forceRefresh: true),
      );
    }

    return MzCard(
      variant: MzCardVariant.hero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              const AppIcon(LucideGlyph.layers3),
              const SizedBox(width: SpacingTokens.sm),
              Text(
                'SPACED REPETITION',
                style: typography.caption.copyWith(
                  color: colors.textSecondary,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          Text(
            headingText,
            style: typography.sectionHeading.copyWith(
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            bodyText,
            style: typography.body.copyWith(
              color: colors.textSecondary,
            ),
          ),
          const SizedBox(height: SpacingTokens.lg),
          PrimaryButton(
            label: ctaLabel,
            trailingGlyph: LucideGlyph.arrowRight,
            onPressed: onTapCta,
          ),
        ],
      ),
    );
  }

  Widget _buildProgressGrid(
    BuildContext context, {
    required int total,
    required int mastered,
    required int learning,
    required int due,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Row(
      children: <Widget>[
        Expanded(
          child: Column(
            children: <Widget>[
              _buildMetricCard(
                context,
                'Total Saved',
                '$total',
                colors.primary,
                typography,
              ),
              const SizedBox(height: SpacingTokens.sm),
              _buildMetricCard(
                context,
                'Learning',
                '$learning',
                colors.warning,
                typography,
              ),
            ],
          ),
        ),
        const SizedBox(width: SpacingTokens.sm),
        Expanded(
          child: Column(
            children: <Widget>[
              _buildMetricCard(
                context,
                'Mastered',
                '$mastered',
                colors.success,
                typography,
              ),
              const SizedBox(height: SpacingTokens.sm),
              _buildMetricCard(
                context,
                'Due Today',
                '$due',
                colors.error,
                typography,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMetricCard(
    BuildContext context,
    String label,
    String value,
    Color color,
    AppTypography typography,
  ) {
    final colors = AppColors.of(context);
    return MzCard(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            label,
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            value,
            style: typography.cardScore.copyWith(color: color),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);

    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceAlt,
        borderRadius: shapes.controlRadius,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: TextField(
        onChanged: (value) =>
            ref.read(vocabSearchQueryProvider.notifier).setQuery(value),
        style: typography.body.copyWith(color: colors.textPrimary),
        decoration: InputDecoration(
          hintText: 'Search words or definitions...',
          hintStyle: typography.body.copyWith(color: colors.textTertiary),
          prefixIcon: const Padding(
            padding: EdgeInsetsDirectional.only(
              start: SpacingTokens.sm,
              end: SpacingTokens.xs,
            ),
            child: AppIcon(LucideGlyph.bookmarkPlus, size: 20),
          ),
          prefixIconConstraints: const BoxConstraints(minWidth: 40),
          border: InputBorder.none,
          contentPadding: const EdgeInsetsDirectional.all(SpacingTokens.md),
        ),
      ),
    );
  }

  Widget _buildFilterChips(
    BuildContext context,
    WidgetRef ref,
    String activeFilter,
  ) {
    final filters = <String>[
      'All',
      'Writing',
      'Speaking',
      'Reading',
      'Listening',
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: filters
            .map((f) {
              final isSelected = activeFilter == f;
              return Padding(
                padding: const EdgeInsetsDirectional.only(
                  end: SpacingTokens.sm,
                ),
                child: MzChip(
                  label: f,
                  isSelected: isSelected,
                  onTap: () =>
                      ref.read(vocabFilterProvider.notifier).setFilter(f),
                ),
              );
            })
            .toList(growable: false),
      ),
    );
  }

  Widget _buildCardTile(BuildContext context, VocabDeckCard card) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.sm),
      child: InkWell(
        onTap: () => context.push(AppRoutes.buildVocabWordDetail(card.cardId)),
        borderRadius: shapes.controlRadius,
        child: Container(
          padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: shapes.controlRadius,
            border: Border.all(color: colors.borderSubtle),
          ),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Text(
                          card.headword,
                          style: typography.cardTitle.copyWith(
                            color: colors.textPrimary,
                          ),
                        ),
                        if (card.ipa != null) ...<Widget>[
                          const SizedBox(width: SpacingTokens.sm),
                          Text(
                            card.ipa!,
                            style: typography.caption.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      card.definition,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: typography.body.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: SpacingTokens.md),
              const AppIcon(LucideGlyph.chevronRight, size: 18),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Padding(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.xl),
      child: Column(
        children: <Widget>[
          const AppIcon(LucideGlyph.bookmarkPlus, size: 40),
          const SizedBox(height: SpacingTokens.md),
          Text(
            'No words match your filter',
            style: typography.cardTitle.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            'Use 1-tap "Save Mistake to Deck" during practice feedback to capture personalized upgrades.',
            textAlign: TextAlign.center,
            style: typography.body.copyWith(
              color: colors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/personalization/vocab_wave_scheduler.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/data/repositories/vocab_repository.dart';
import 'package:mockza/features/vocabulary/presentation/vocabulary_providers.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/brand_header.dart';
import 'package:mockza/theme/components/inline_listen_button.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/mz_toast.dart';
import 'package:mockza/theme/components/speech_practice_sheet.dart';
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
    final edition = ref.watch(editionConfigProvider).edition;
    final isIran = edition == AppEdition.iran;

    final isInitialLoading =
        (dueCardsAsync.isLoading && !dueCardsAsync.hasValue) ||
        (allCardsAsync.isLoading && !allCardsAsync.hasValue);

    final dueCards = dueCardsAsync.asData?.value ?? const <VocabDeckCard>[];
    final allCards = allCardsAsync.asData?.value ?? const <VocabDeckCard>[];
    final previewAll = ref.watch(vocabPreviewAllWavesProvider);
    final vocabTab = ref.watch(vocabTabModeProvider);
    final newTodayCount = ref.watch(vocabNewReviewedTodayProvider).asData?.value ?? 0;
    final cachedPersonalization =
        ref.watch(vocabPersonalizationProvider).asData?.value;
    final unlockedWave = cachedPersonalization?.vocabUnlockedWave ?? 1;
    final dailyCap = cachedPersonalization?.dailyNewVocabCap ?? 10;

    final waveInputs = allCards
        .map(
          (c) => VocabWaveCardInput(
            cardId: c.cardId,
            headword: c.headword,
            legacyTopicTag: c.topicTag,
            repetitions: c.schedule.repetitions,
            dueSerialDay: c.schedule.dueDay.value,
            cefrLevel: AuthoringTier.values.firstWhere(
              (t) => t.name.toUpperCase() == (c.cefrLevel ?? '').toUpperCase(),
              orElse: () => AuthoringTier.b2,
            ),
            baseWaveOrder: c.baseWaveOrder ?? 500,
          ),
        )
        .toList(growable: false);
    final waveResult = VocabWaveScheduler.assignWaves<VocabWaveCardInput>(
      cards: waveInputs,
      favoriteTopics:
          cachedPersonalization?.favoriteTopics ?? const <String>[],
      track: ExamTrack.fromId(
        cachedPersonalization?.examTrack ?? 'ielts_academic',
      ),
      currentBand: cachedPersonalization?.liveBand.currentBand,
      targetBand: cachedPersonalization?.targetBand ?? 7.0,
      activeWeaknessKeys:
          cachedPersonalization?.weaknesses
              .map((w) => w.canonicalKey)
              .toList(growable: false) ??
          const <String>[],
      unlockedWave: unlockedWave,
    );
    final todaySerial =
        SerialDay.fromUtcDateTime(ref.read(clockProvider).now()).value;
    final queueSelection =
        VocabWaveScheduler.selectDailyReviewQueue<VocabWaveCardInput>(
          assigned: waveResult.assigned,
          todaySerialDay: todaySerial,
          newCardsIntroducedToday: newTodayCount,
          unlockedWave: unlockedWave,
          dailyNewCap: dailyCap,
        );
    final unlockedCardIds = waveResult.assigned
        .where((a) => a.isUnlocked)
        .map((a) => a.card.cardId)
        .toSet();

    final filteredCards = allCards
        .where((card) {
          if (vocabTab == 'mistakes') {
            final isUserSaved =
                card.sourceAttemptId != null ||
                card.sourceSkill != null ||
                card.topicTag == 'register_shifter' ||
                card.topicTag == 'drop_anything';
            if (!isUserSaved) return false;
          } else if (vocabTab == 'wave' &&
              !previewAll &&
              searchQuery.isEmpty &&
              unlockedCardIds.isNotEmpty &&
              !unlockedCardIds.contains(card.cardId)) {
            return false;
          }
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
              title: isIran ? 'دفترچه واژگان' : 'Vocabulary Deck',
              onTapSettings: () => context.push(AppRoutes.settings),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsetsDirectional.symmetric(
              vertical: SpacingTokens.lg,
            ),
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
                      edition: edition,
                    ),
                    if (allCards.isNotEmpty) ...<Widget>[
                      const SizedBox(height: SpacingTokens.md),
                      _buildWaveProgressBanner(
                        context,
                        ref,
                        summary: queueSelection.summary,
                        previewAll: previewAll,
                        isIran: isIran,
                        dailyCap: dailyCap,
                      ),
                    ],
                  ],
                  const SizedBox(height: SpacingTokens.lg),
                  Text(
                    isIran
                        ? 'پیشرفت تثبیت در حافظه'
                        : 'Your Retention Progress',
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
                      Expanded(
                        child: Text(
                          isIran
                              ? 'واژگان و عبارات ذخیره‌شده'
                              : 'Saved Words & Phrases',
                          style: typography.cardTitle.copyWith(
                            color: colors.textPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(width: SpacingTokens.sm),
                      Text(
                        isIran
                            ? '${EdgeNumerals.formatChromeNumber(filteredCards.length, edition)} واژه'
                            : '${filteredCards.length} saved',
                        style: typography.caption.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  _buildSearchBar(context, ref),
                  const SizedBox(height: SpacingTokens.sm),
                  Wrap(
                    spacing: SpacingTokens.xs,
                    children: <Widget>[
                      ChoiceChip(
                        label: Text(AppLocalizations.of(context).vocabTabTodaysWave),
                        selected: vocabTab == 'wave',
                        onSelected: (_) => ref
                            .read(vocabTabModeProvider.notifier)
                            .setTab('wave'),
                      ),
                      ChoiceChip(
                        label: Text(
                          AppLocalizations.of(context).vocabTabSavedMistakes,
                        ),
                        selected: vocabTab == 'mistakes',
                        onSelected: (_) => ref
                            .read(vocabTabModeProvider.notifier)
                            .setTab('mistakes'),
                      ),
                      ChoiceChip(
                        label: Text(AppLocalizations.of(context).vocabTabFullDeck),
                        selected: vocabTab == 'full',
                        onSelected: (_) => ref
                            .read(vocabTabModeProvider.notifier)
                            .setTab('full'),
                      ),
                    ],
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  _buildFilterChips(context, ref, filter),
                  const SizedBox(height: SpacingTokens.md),
                  if (filteredCards.isEmpty)
                    _buildEmptyState(context)
                  else
                    ...filteredCards.map(
                      (card) => _buildCardTile(context, card, isIran: isIran),
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
    required AppEdition edition,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isIran = edition == AppEdition.iran;

    final String headingText;
    final String bodyText;
    final String ctaLabel;
    final VoidCallback onTapCta;

    final selectedBatchSize = ref.watch(vocabBatchSizeProvider);
    final limitQuery = selectedBatchSize == null ? 'all' : '$selectedBatchSize';

    if (dueCount > 0) {
      final sessionCount = selectedBatchSize == null
          ? dueCount
          : (dueCount < selectedBatchSize ? dueCount : selectedBatchSize);
      headingText = isIran
          ? '${EdgeNumerals.formatChromeNumber(dueCount, edition)} واژه آماده مرور'
          : '$dueCount words due for review';
      bodyText = isIran
          ? 'مرور یک بسته ${EdgeNumerals.formatChromeNumber(sessionCount, edition)} تایی برای تثبیت هم‌آواها در حافظه بلندمدت.'
          : 'Review a focused batch of $sessionCount cards today to lock collocations into long-term memory.';
      ctaLabel = isIran
          ? 'شروع مرور (${EdgeNumerals.formatChromeNumber(sessionCount, edition)})'
          : 'Start Review ($sessionCount)';
      onTapCta = () =>
          context.push('${AppRoutes.vocabReview}?limit=$limitQuery');
    } else if (totalCount > 0) {
      final sessionCount = selectedBatchSize == null
          ? totalCount
          : (totalCount < selectedBatchSize ? totalCount : selectedBatchSize);
      headingText = isIran
          ? 'مرورهای امروز کامل شد!'
          : 'All caught up for today!';
      bodyText = isIran
          ? 'می‌توانید یک بسته ${EdgeNumerals.formatChromeNumber(sessionCount, edition)} تایی پیش‌خوانی را مرور کنید یا فردا برگردید.'
          : 'Practice a $sessionCount-card ahead batch or return tomorrow for your next interval.';
      ctaLabel = isIran
          ? 'مرور زودتر از موعد (${EdgeNumerals.formatChromeNumber(sessionCount, edition)})'
          : 'Review Ahead ($sessionCount)';
      onTapCta = () => context.push(
        '${AppRoutes.vocabReview}?mode=ahead&limit=$limitQuery',
      );
    } else {
      headingText = isIran ? 'دِک واژگان خالی است' : 'Vocabulary deck empty';
      bodyText = isIran
          ? 'واژگان پایه را همگام‌سازی کنید یا اصطلاحات ارتقایافته را از بازخوردها ذخیره نمایید.'
          : 'Sync starter collocations from the server or save upgrades from your evaluations.';
      ctaLabel = isIran ? 'همگام‌سازی واژگان' : 'Sync Vocabulary';
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
          if (totalCount > 0) ...<Widget>[
            const SizedBox(height: SpacingTokens.md),
            Wrap(
              spacing: SpacingTokens.xs,
              runSpacing: SpacingTokens.xs,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: <Widget>[
                Text(
                  'Session cards:',
                  style: typography.caption.copyWith(
                    color: colors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                for (final size in <int?>[15, 20, 30, null])
                  MzChip(
                    label: size == null ? 'All' : '$size',
                    isSelected: selectedBatchSize == size,
                    onTap: () => ref
                        .read(vocabBatchSizeProvider.notifier)
                        .setBatchSize(size),
                  ),
              ],
            ),
          ],
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

  Widget _buildCardTile(
    BuildContext context,
    VocabDeckCard card, {
    required bool isIran,
  }) {
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
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    LtrExamBoundary(
                      child: Wrap(
                        spacing: SpacingTokens.sm,
                        runSpacing: SpacingTokens.xs,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: <Widget>[
                          Text(
                            card.headword,
                            style: typography.cardTitle.copyWith(
                              color: colors.textPrimary,
                            ),
                          ),
                          if (card.ipa != null)
                            Text(
                              card.ipa!,
                              style: typography.caption.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (isIran &&
                        card.glossFa != null &&
                        card.glossFa!.trim().isNotEmpty) ...<Widget>[
                      const SizedBox(height: SpacingTokens.xs),
                      Text(
                        card.glossFa!,
                        style: typography.secondary.copyWith(
                          color: colors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                    if (card.sourceSkill != null ||
                        card.canonicalTopic != null) ...<Widget>[
                      const SizedBox(height: SpacingTokens.xs),
                      Text(
                        '${AppLocalizations.of(context).vocabWhyThisWord}: '
                        '${card.sourceSkill ?? card.canonicalTopic ?? card.topicTag}',
                        style: typography.caption.copyWith(
                          color: colors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                    const SizedBox(height: SpacingTokens.xs),
                    LtrExamBoundary(
                      child: Text(
                        card.definition,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: typography.body.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: SpacingTokens.xs),
              InlineListenButton(
                text: card.headword,
                sourceContext: 'vocab_deck',
                compact: true,
                showSlowToggle: false,
              ),
              IconButton(
                tooltip: AppLocalizations.of(context).practiceSpeechCta,
                onPressed: () => unawaited(
                  SpeechPracticeSheet.show(
                    context,
                    targetText: card.headword,
                    practiceKind: card.headword.contains(' ')
                        ? 'collocation'
                        : 'word',
                    sourceRefType: 'vocab_card',
                    sourceRefId: card.cardId,
                    sourceContext: 'vocab_deck',
                  ),
                ),
                icon: AppIcon(
                  LucideGlyph.mic,
                  size: 18,
                  color: colors.primary,
                ),
              ),
              AppIcon(
                isIran ? LucideGlyph.chevronLeft : LucideGlyph.chevronRight,
                size: 18,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildWaveProgressBanner(
    BuildContext context,
    WidgetRef ref, {
    required VocabWaveSummary summary,
    required bool previewAll,
    required bool isIran,
    required int dailyCap,
  }) {
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: SpacingTokens.sm,
            runSpacing: SpacingTokens.xs,
            children: <Widget>[
              Text(
                l10n.vocabWaveTitle(summary.unlockedWave, summary.totalWaves),
                style: typography.cardTitle.copyWith(color: colors.textPrimary),
              ),
              MzChip(
                label: '${summary.currentWaveLearned}/${summary.currentWaveTotal}',
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            isIran
                ? 'سهمیه واژگان جدید باقی‌مانده امروز: ${summary.dailyNewRemaining} از $dailyCap'
                : 'Daily new words remaining today: ${summary.dailyNewRemaining} / $dailyCap',
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
          if (summary.readyToUnlockNext &&
              summary.unlockedWave < summary.totalWaves) ...<Widget>[
            const SizedBox(height: SpacingTokens.xs),
            Text(
              l10n.vocabWaveAutoUnlocked(
                summary.unlockedWave,
                summary.unlockedWave + 1,
              ),
              style: typography.caption.copyWith(
                color: colors.success,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
          const SizedBox(height: SpacingTokens.sm),
          Wrap(
            spacing: SpacingTokens.sm,
            runSpacing: SpacingTokens.xs,
            children: <Widget>[
              if (summary.unlockedWave < summary.totalWaves)
                SecondaryButton(
                  label: l10n.vocabUnlockNextWave,
                  isFullWidth: false,
                  onPressed: () => unawaited(() async {
                    final res = await ref
                        .read(personalizationGatewayProvider)
                        .updateProfile(unlockNextVocabWave: true);
                    if (!context.mounted) return;
                    if (res case Ok(:final value)) {
                      await ref
                          .read(personalizationRepositoryProvider)
                          .cacheState(value);
                      ref.invalidate(vocabPersonalizationProvider);
                      if (context.mounted) {
                        showMzToast(
                          context,
                          message: isIran
                              ? '۱۵ واژه بعدی باز شد!'
                              : 'Next 15 words unlocked!',
                        );
                      }
                    }
                  }()),
                ),
              FilterChip(
                label: Text(l10n.vocabPreviewAllWaves),
                selected: previewAll,
                onSelected: (_) => ref
                    .read(vocabPreviewAllWavesProvider.notifier)
                    .toggle(),
              ),
            ],
          ),
        ],
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

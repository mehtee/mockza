import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/formatting/jalali_edge_formatter.dart';
import 'package:mockza/core/localization/edition_copy.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/features/progress/presentation/progress_providers.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/routing/safe_pop.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/attempt_list_row.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/mz_toast.dart';
import 'package:mockza/theme/primitives.dart';

/// Keyset-cursor paginated attempt history with real Outbox retry support (Screen 22).
class ProgressAttemptsScreen extends ConsumerStatefulWidget {
  /// Creates a [ProgressAttemptsScreen].
  const new({super.key});

  @override
  ConsumerState<ProgressAttemptsScreen> createState() =>
      _ProgressAttemptsScreenState();
}

class _ProgressAttemptsScreenState
    extends ConsumerState<ProgressAttemptsScreen> {
  static const int _pageSize = 20;

  final List<AttemptSummary> _items = <AttemptSummary>[];
  bool _isInitialLoading = true;
  bool _isLoadingMore = false;
  bool _hasMore = false;
  String? _loadedFilter;

  @override
  void initState() {
    super.initState();
    unawaited(Future.microtask(() => _reloadPage(reset: true)));
  }

  Future<void> _reloadPage({bool reset = false}) async {
    final activeFilter = ref.read(historyFilterProvider);
    final skillFilter = _parseSkillFilter(activeFilter);

    if (reset) {
      if (mounted) {
        setState(() {
          _isInitialLoading = true;
          _loadedFilter = activeFilter;
        });
      }
    } else {
      if (_isLoadingMore || !_hasMore || _items.isEmpty) return;
      if (mounted) setState(() => _isLoadingMore = true);
    }

    final cursor = reset ? null : _items.last.updatedAt;
    final cursorId = reset ? null : _items.last.attemptId;
    final page = await ref
        .read(attemptRepositoryProvider)
        .fetchHistoryPage(
          cursorUpdatedAt: cursor,
          cursorAttemptId: cursorId,
          filterSkill: skillFilter,
        );

    if (!mounted) return;
    setState(() {
      if (reset) {
        _items
          ..clear()
          ..addAll(page);
        _isInitialLoading = false;
      } else {
        final seen = _items.map((e) => e.attemptId).toSet();
        _items.addAll(page.where((e) => !seen.contains(e.attemptId)));
        _isLoadingMore = false;
      }
      _hasMore = page.length >= _pageSize;
    });
  }

  SkillKind? _parseSkillFilter(String filter) => switch (filter.toLowerCase()) {
    'speaking' => SkillKind.speaking,
    'writing' => SkillKind.writing,
    'reading' => SkillKind.reading,
    'listening' => SkillKind.listening,
    'vocabulary' => SkillKind.vocabulary,
    _ => null,
  };

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final activeFilter = ref.watch(historyFilterProvider);
    final edition = ref.watch(editionConfigProvider).edition;
    final isIran = edition == AppEdition.iran;

    if (_loadedFilter != activeFilter && !_isInitialLoading) {
      unawaited(Future.microtask(() => _reloadPage(reset: true)));
    }

    final pendingOrFailed = _items
        .where(
          (a) =>
              a.status == AttemptStatus.failedRetryable ||
              a.status == AttemptStatus.uploadingAudio ||
              a.status == AttemptStatus.queuedRemote,
        )
        .toList(growable: false);

    final completedAttempts = _items
        .where(
          (a) =>
              a.status == AttemptStatus.scored ||
              a.status == AttemptStatus.submittedLocal ||
              a.status == AttemptStatus.inProgress,
        )
        .toList(growable: false);

    final completedCountText = EdgeNumerals.formatChromeNumber(
      completedAttempts.length,
      edition,
    );

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: AppIcon(
            isIran ? LucideGlyph.chevronRight : LucideGlyph.chevronLeft,
            size: 22,
          ),
          onPressed: () => context.safePopOrGo(AppRoutes.progress),
        ),
        title: Text(isIran ? 'تاریخچه آزمون‌ها' : 'Attempt History'),
        actions: <Widget>[
          MzIconButton(
            glyph: LucideGlyph.rotateCcw,
            semanticLabel: isIran ? 'به‌روزرسانی تاریخچه' : 'Refresh history',
            onPressed: () => unawaited(_reloadPage(reset: true)),
          ),
        ],
      ),
      body: CustomScrollView(
        slivers: <Widget>[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsetsDirectional.symmetric(
                vertical: SpacingTokens.md,
              ),
              child: _buildFilterChips(context, activeFilter, isIran: isIran),
            ),
          ),
          if (_isInitialLoading)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: CircularProgressIndicator(color: colors.primary),
              ),
            )
          else ...<Widget>[
            if (pendingOrFailed.isNotEmpty) ...<Widget>[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsetsDirectional.only(
                    top: SpacingTokens.sm,
                  ),
                  child: Text(
                    isIran
                        ? 'در انتظار همگام‌سازی و تلاش مجدد'
                        : 'Pending Sync & Retries',
                    style: typography.cardTitle.copyWith(color: colors.warning),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsetsDirectional.symmetric(
                  vertical: SpacingTokens.md,
                ),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _buildRow(
                      context,
                      pendingOrFailed[index],
                      edition: edition,
                    ),
                    childCount: pendingOrFailed.length,
                  ),
                ),
              ),
            ],
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsetsDirectional.only(
                  top: SpacingTokens.sm,
                ),
                child: Text(
                  isIran
                      ? 'آزمون‌های تکمیل‌شده ($completedCountText)'
                      : 'Completed Sessions (${completedAttempts.length})',
                  style: typography.cardTitle.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
              ),
            ),
            if (completedAttempts.isEmpty && pendingOrFailed.isEmpty)
              SliverToBoxAdapter(
                child: _buildEmptyState(context, isIran: isIran),
              )
            else
              SliverPadding(
                padding: const EdgeInsetsDirectional.symmetric(
                  vertical: SpacingTokens.md,
                ),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _buildRow(
                      context,
                      completedAttempts[index],
                      edition: edition,
                    ),
                    childCount: completedAttempts.length,
                  ),
                ),
              ),
            if (_hasMore)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsetsDirectional.symmetric(
                    vertical: SpacingTokens.md,
                  ),
                  child: SecondaryButton(
                    label: isIran
                        ? (_isLoadingMore
                              ? 'در حال دریافت آزمون‌های قدیمی‌تر...'
                              : 'نمایش آزمون‌های قدیمی‌تر')
                        : (_isLoadingMore
                              ? 'Loading Older Attempts...'
                              : 'Load Older Attempts'),
                    onPressed: _isLoadingMore
                        ? null
                        : () => unawaited(_reloadPage()),
                  ),
                ),
              ),
          ],
          const SliverToBoxAdapter(
            child: SizedBox(height: SpacingTokens.xxl),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChips(
    BuildContext context,
    String activeFilter, {
    required bool isIran,
  }) {
    final filters = <({String key, String label})>[
      (key: 'All', label: isIran ? 'همه' : 'All'),
      (
        key: 'Speaking',
        label: EditionCopy.skillName('speaking', isIran: isIran),
      ),
      (key: 'Writing', label: EditionCopy.skillName('writing', isIran: isIran)),
      (key: 'Reading', label: EditionCopy.skillName('reading', isIran: isIran)),
      (
        key: 'Listening',
        label: EditionCopy.skillName('listening', isIran: isIran),
      ),
      (
        key: 'Vocabulary',
        label: EditionCopy.skillName('vocabulary', isIran: isIran),
      ),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: filters
            .map((f) {
              final isSelected = activeFilter == f.key;
              return Padding(
                padding: const EdgeInsetsDirectional.only(
                  end: SpacingTokens.sm,
                ),
                child: MzChip(
                  label: f.label,
                  isSelected: isSelected,
                  onTap: () =>
                      ref.read(historyFilterProvider.notifier).setFilter(f.key),
                ),
              );
            })
            .toList(growable: false),
      ),
    );
  }

  Widget _buildRow(
    BuildContext context,
    AttemptSummary attempt, {
    required AppEdition edition,
  }) {
    final isIran = edition == AppEdition.iran;
    final (glyph, tint) = _skillVisuals(attempt.skill);
    final mins = attempt.durationSeconds ~/ 60;
    final formattedDate = isIran
        ? '${JalaliEdgeFormatter.formatSerialDay(SerialDay.fromUtcDateTime(attempt.updatedAt), edition)} · ${EdgeNumerals.toPersianDigits('$mins')} دقیقه'
        : '${attempt.updatedAt.month}/${attempt.updatedAt.day} · ${mins}m';
    final skillLabel = EditionCopy.skillName(
      attempt.skill.name,
      isIran: isIran,
    );
    final title = isIran
        ? '$skillLabel · ${attempt.packId}'
        : '${attempt.skill.name.toUpperCase()} · ${attempt.packId}';

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.sm),
      child: AttemptListRow(
        attemptId: attempt.attemptId,
        title: title,
        dateLabel: formattedDate,
        glyph: glyph,
        tint: tint,
        overallBand: attempt.overallBand,
        statusLabel: isIran ? 'در حال ارزیابی...' : 'Evaluating...',
        retryLabel: isIran ? 'تلاش مجدد' : 'Retry',
        usePersianDigits: isIran,
        isPending:
            attempt.status == AttemptStatus.uploadingAudio ||
            attempt.status == AttemptStatus.queuedRemote,
        isFailed: attempt.status == AttemptStatus.failedRetryable,
        onTap: () =>
            context.push(AppRoutes.buildAttemptReview(attempt.attemptId)),
        onTapRetry: () => unawaited(_retryPendingSync(context, isIran: isIran)),
      ),
    );
  }

  Future<void> _retryPendingSync(
    BuildContext context, {
    required bool isIran,
  }) async {
    showMzToast(
      context,
      message: isIran
          ? 'در حال همگام‌سازی ارسال‌های معلق...'
          : 'Syncing pending submission...',
      glyph: LucideGlyph.cloudUpload,
    );
    await ref.read(authSessionServiceProvider).ensureAuthenticated();
    await ref.read(outboxSyncServiceProvider).processPendingQueue();
    await _reloadPage(reset: true);
    if (mounted) {
      showMzToast(
        this.context,
        message: isIran ? 'صف ارسال بررسی شد.' : 'Queue sync checked.',
      );
    }
  }

  (LucideGlyph, IconWellTint) _skillVisuals(SkillKind skill) => switch (skill) {
    SkillKind.speaking => (LucideGlyph.mic, IconWellTint.blue),
    SkillKind.writing => (LucideGlyph.pencil, IconWellTint.violet),
    SkillKind.reading => (LucideGlyph.bookOpen, IconWellTint.mint),
    SkillKind.listening => (LucideGlyph.headphones, IconWellTint.blue),
    SkillKind.vocabulary => (LucideGlyph.layers3, IconWellTint.amber),
  };

  Widget _buildEmptyState(BuildContext context, {required bool isIran}) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Padding(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.xxl),
      child: Column(
        children: <Widget>[
          const AppIcon(LucideGlyph.chartIncreasing, size: 40),
          const SizedBox(height: SpacingTokens.md),
          Text(
            isIran ? 'آزمونی یافت نشد' : 'No attempts found',
            style: typography.cardTitle.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            isIran
                ? 'شبیه‌سازی‌های زمان‌دار و تمرین‌های تکمیل‌شده شما اینجا نمایش داده می‌شوند.'
                : 'Your completed timed simulations and drills will appear here.',
            textAlign: TextAlign.center,
            style: typography.body.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}

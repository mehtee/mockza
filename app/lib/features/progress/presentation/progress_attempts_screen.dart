import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/features/progress/presentation/progress_providers.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
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

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const AppIcon(LucideGlyph.chevronLeft, size: 22),
          onPressed: () => context.pop(),
        ),
        title: const Text('Attempt History'),
        actions: <Widget>[
          MzIconButton(
            glyph: LucideGlyph.rotateCcw,
            semanticLabel: 'Refresh history',
            onPressed: () => unawaited(_reloadPage(reset: true)),
          ),
        ],
      ),
      body: CustomScrollView(
        slivers: <Widget>[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
              child: _buildFilterChips(context, activeFilter),
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
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: SpacingTokens.lg,
                  ),
                  child: Text(
                    'Pending Sync & Retries',
                    style: typography.cardTitle.copyWith(color: colors.warning),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) =>
                        _buildRow(context, pendingOrFailed[index]),
                    childCount: pendingOrFailed.length,
                  ),
                ),
              ),
            ],
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: SpacingTokens.lg,
                ),
                child: Text(
                  'Completed Sessions (${completedAttempts.length})',
                  style: typography.cardTitle.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
              ),
            ),
            if (completedAttempts.isEmpty && pendingOrFailed.isEmpty)
              SliverToBoxAdapter(
                child: _buildEmptyState(context),
              )
            else
              SliverPadding(
                padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) =>
                        _buildRow(context, completedAttempts[index]),
                    childCount: completedAttempts.length,
                  ),
                ),
              ),
            if (_hasMore)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: SpacingTokens.lg,
                    vertical: SpacingTokens.md,
                  ),
                  child: SecondaryButton(
                    label: _isLoadingMore
                        ? 'Loading Older Attempts...'
                        : 'Load Older Attempts',
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

  Widget _buildFilterChips(BuildContext context, String activeFilter) {
    final filters = <String>[
      'All',
      'Speaking',
      'Writing',
      'Reading',
      'Listening',
      'Vocabulary',
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
                      ref.read(historyFilterProvider.notifier).setFilter(f),
                ),
              );
            })
            .toList(growable: false),
      ),
    );
  }

  Widget _buildRow(BuildContext context, AttemptSummary attempt) {
    final (glyph, tint) = _skillVisuals(attempt.skill);
    final formattedDate =
        '${attempt.updatedAt.month}/${attempt.updatedAt.day} · ${attempt.durationSeconds ~/ 60}m';
    final title = '${attempt.skill.name.toUpperCase()} · ${attempt.packId}';

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.sm),
      child: AttemptListRow(
        attemptId: attempt.attemptId,
        title: title,
        dateLabel: formattedDate,
        glyph: glyph,
        tint: tint,
        overallBand: attempt.overallBand,
        isPending:
            attempt.status == AttemptStatus.uploadingAudio ||
            attempt.status == AttemptStatus.queuedRemote,
        isFailed: attempt.status == AttemptStatus.failedRetryable,
        onTap: () =>
            context.push(AppRoutes.buildAttemptReview(attempt.attemptId)),
        onTapRetry: () => unawaited(_retryPendingSync(context)),
      ),
    );
  }

  Future<void> _retryPendingSync(BuildContext context) async {
    showMzToast(
      context,
      message: 'Syncing pending submission...',
      glyph: LucideGlyph.cloudUpload,
    );
    await ref.read(authSessionServiceProvider).ensureAuthenticated();
    await ref.read(outboxSyncServiceProvider).processPendingQueue();
    await _reloadPage(reset: true);
    if (mounted) {
      showMzToast(
        this.context,
        message: 'Queue sync checked.',
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

  Widget _buildEmptyState(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Padding(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.xxl),
      child: Column(
        children: <Widget>[
          const AppIcon(LucideGlyph.chartIncreasing, size: 40),
          const SizedBox(height: SpacingTokens.md),
          Text(
            'No attempts found',
            style: typography.cardTitle.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            'Your completed timed simulations and drills will appear here.',
            textAlign: TextAlign.center,
            style: typography.body.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}

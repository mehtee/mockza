import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/localization/edition_copy.dart';
import 'package:mockza/core/personalization/topic_taxonomy.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/roadmap_route_resolver.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/personalization_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_bottom_sheet.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/mz_toast.dart';
import 'package:mockza/theme/components/speech_practice_sheet.dart';
import 'package:mockza/theme/primitives.dart';

/// Durnama (دورنما) 4-Milestone Panorama + Step-by-Step Progressive Roadmap screen (`/roadmap`).
class RoadmapScreen extends ConsumerStatefulWidget {
  /// Creates a [RoadmapScreen].
  const new({super.key});

  @override
  ConsumerState<RoadmapScreen> createState() => _RoadmapScreenState();
}

class _RoadmapScreenState extends ConsumerState<RoadmapScreen> {
  PersonalizationStateDto? _state;
  bool _loading = true;
  bool _updatingStep = false;
  bool _showUpcoming = false;
  bool _showCompleted = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final repo = ref.read(personalizationRepositoryProvider);
    final cached = await repo.getCachedState();
    if (mounted && cached != null) {
      setState(() {
        _state = cached;
        _loading = false;
      });
    }

    final remote = await ref.read(personalizationGatewayProvider).getState();
    if (!mounted) return;
    switch (remote) {
      case Ok<PersonalizationStateDto, Failure>(:final value):
        await repo.cacheState(value);
        if (!mounted) return;
        setState(() {
          _state = value;
          _loading = false;
        });
      case Err<PersonalizationStateDto, Failure>(:final failure):
        if (!mounted) return;
        setState(() {
          _loading = false;
          if (_state == null) {
            _error = failure.message;
          }
        });
    }
  }

  Future<void> _stepAction(RoadmapStepDto step, String status) async {
    if (_updatingStep) return;
    final isIrn = ref.read(editionConfigProvider).edition == AppEdition.iran;
    setState(() => _updatingStep = true);
    final res = await ref
        .read(personalizationGatewayProvider)
        .advanceRoadmapStep(stepId: step.stepId, status: status);
    if (!mounted) return;
    switch (res) {
      case Ok<PersonalizationStateDto, Failure>(:final value):
        await ref.read(personalizationRepositoryProvider).cacheState(value);
        if (!mounted) return;
        setState(() {
          _state = value;
          _updatingStep = false;
        });
        showMzToast(
          context,
          message: status == 'completed'
              ? (isIrn
                    ? 'گام تکمیل شد! گام بعدی باز شد.'
                    : 'Step completed! Next step unlocked.')
              : (isIrn ? 'گام رد شد.' : 'Step skipped.'),
        );
      case Err<PersonalizationStateDto, Failure>(:final failure):
        setState(() => _updatingStep = false);
        showMzToast(
          context,
          message: failure.message,
          glyph: LucideGlyph.alertCircle,
        );
    }
  }

  String _phaseDescription(String phase, bool isIrn) {
    switch (phase) {
      case 'weakness_transfer':
        return isIrn
            ? 'فاز ۲: انتقال به موضوعات متنوع برای تثبیت رفع نقاط ضعف'
            : 'Phase 2 · Weakness Transfer Across Topics';
      case 'exam_breadth':
        return isIrn
            ? 'فاز ۳: آمادگی کامل آزمون با پوشش همه‌جانبه موضوعات آکادمیک'
            : 'Phase 3 · Full Exam Topic Breadth';
      default:
        return isIrn
            ? 'فاز ۱: شروع با موضوعات مورد علاقه شما برای انگیزه بالا'
            : 'Phase 1 · Favorite Topics Foundation';
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);
    final isIrn = ref.watch(editionConfigProvider).edition == AppEdition.iran;

    final state = _state;
    final activeSteps =
        state?.steps.where((s) => s.status == 'active').toList() ??
        const <RoadmapStepDto>[];
    final upcomingSteps =
        state?.steps.where((s) => s.status == 'locked').toList() ??
        const <RoadmapStepDto>[];
    final completedSteps =
        state?.steps.where((s) => s.status == 'completed').toList() ??
        const <RoadmapStepDto>[];
    final isCompactWidth = MediaQuery.sizeOf(context).width < 480;

    return MzScaffold(
      appBar: AppBar(
        title: Text(l10n.roadmapTitle),
        actions: <Widget>[
          if (state != null)
            if (isCompactWidth)
              IconButton(
                tooltip: l10n.roadmapEditTopicsPace,
                onPressed: () => _openTopicsPaceSheet(context, state, isIrn),
                icon: const AppIcon(LucideGlyph.slidersHorizontal, size: 20),
              )
            else
              TextButton.icon(
                onPressed: () => _openTopicsPaceSheet(context, state, isIrn),
                icon: const AppIcon(LucideGlyph.slidersHorizontal, size: 16),
                label: Text(l10n.roadmapEditTopicsPace),
              ),
          IconButton(
            tooltip: l10n.syncDevicesNow,
            onPressed: _loading ? null : () => unawaited(_load()),
            icon: const AppIcon(LucideGlyph.refreshCw, size: 20),
          ),
        ],
      ),
      body: _loading && state == null
          ? const Center(child: CircularProgressIndicator())
          : _error != null && state == null
          ? Center(
              child: Padding(
                padding: const EdgeInsetsDirectional.all(SpacingTokens.xl),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: SpacingTokens.md),
                    PrimaryButton(
                      label: l10n.retryAction,
                      onPressed: () => unawaited(_load()),
                    ),
                  ],
                ),
              ),
            )
          : ListView(
              padding: const EdgeInsetsDirectional.all(SpacingTokens.pageInset),
              children: <Widget>[
                // Live Band & Rotation Phase Hero
                if (state != null)
                  MzCard(
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
                              l10n.liveBandTitle,
                              style: typography.secondary.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                            MzChip(
                              label: switch (state.liveBand.confidence) {
                                BandConfidenceTier.calibrated =>
                                  l10n.confidenceCalibrated,
                                BandConfidenceTier.developing =>
                                  l10n.confidenceDeveloping,
                                BandConfidenceTier.provisional =>
                                  l10n.confidenceProvisional,
                              },
                            ),
                          ],
                        ),
                        const SizedBox(height: SpacingTokens.sm),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: <Widget>[
                            Text(
                              state.liveBand.currentBand != null
                                  ? (isIrn
                                        ? EdgeNumerals.toPersianDigits(
                                            state.liveBand.currentBand!
                                                .toStringAsFixed(1),
                                          )
                                        : state.liveBand.currentBand!
                                              .toStringAsFixed(1))
                                  : '--',
                              style: typography.headline.copyWith(
                                color: colors.primary,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(width: SpacingTokens.sm),
                            Text(
                              isIrn
                                  ? '← ${EdgeNumerals.toPersianDigits(state.targetBand.toStringAsFixed(1))}'
                                  : '→ ${state.targetBand.toStringAsFixed(1)}',
                              style: typography.cardTitle.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: SpacingTokens.sm),
                        Text(
                          _phaseDescription(state.activeWeaknessPhase, isIrn),
                          style: typography.caption.copyWith(
                            color: colors.vocabAccent,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (state.liveBand.currentBand == null) ...<Widget>[
                          const SizedBox(height: SpacingTokens.xs),
                          Text(
                            isIrn
                                ? 'سطح هنوز تعیین نشده است · گام‌های پایه بدون اجبار به آزمون فعال هستند.'
                                : 'Level not set yet · Starter basics are unlocked while you do the level check later.',
                            style: typography.caption.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                        if (state.favoriteTopics.isNotEmpty) ...<Widget>[
                          const SizedBox(height: SpacingTokens.sm),
                          Wrap(
                            spacing: SpacingTokens.xs,
                            runSpacing: SpacingTokens.xs,
                            children: state.favoriteTopics.map((wire) {
                              final topic = CanonicalTopicKey.normalize(wire);
                              return MzChip(
                                label: topic.labelFor(isIran: isIrn),
                              );
                            }).toList(),
                          ),
                        ],
                      ],
                    ),
                  ),

                const SizedBox(height: SpacingTokens.lg),

                // 4-Milestone Panorama (دورنما)
                if (state != null && state.milestones.isNotEmpty) ...<Widget>[
                  Text(
                    l10n.roadmapPanoramaLabel,
                    style: typography.cardTitle.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  SizedBox(
                    height: 112,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: state.milestones.length,
                      separatorBuilder: (_, _) =>
                          const SizedBox(width: SpacingTokens.sm),
                      itemBuilder: (context, idx) {
                        final m = state.milestones[idx];
                        final isActive = m.status == 'active';
                        final isDone = m.status == 'completed';
                        return Container(
                          width: 190,
                          padding: const EdgeInsetsDirectional.all(
                            SpacingTokens.md,
                          ),
                          decoration: BoxDecoration(
                            color: isActive ? colors.mintBg : colors.surface,
                            borderRadius: shapes.cardRadius,
                            border: Border.all(
                              color: isActive
                                  ? colors.primary
                                  : (isDone
                                        ? colors.success
                                        : colors.borderSubtle),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: <Widget>[
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: <Widget>[
                                  Text(
                                    EditionCopy.milestoneChipLabel(
                                      m.index,
                                      isIran: isIrn,
                                    ),
                                    style: typography.caption.copyWith(
                                      color: isActive
                                          ? colors.primary
                                          : colors.textSecondary,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  Directionality(
                                    textDirection: TextDirection.ltr,
                                    child: Text(
                                      isDone
                                          ? '✓'
                                          : (isIrn
                                                ? '+${EdgeNumerals.toPersianDigits(m.targetBandDelta.toStringAsFixed(1))}'
                                                : '+${m.targetBandDelta.toStringAsFixed(1)}'),
                                      style: typography.caption.copyWith(
                                        color: isDone
                                            ? colors.success
                                            : colors.textTertiary,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              Text(
                                isIrn ? m.titleFa : m.titleEn,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: typography.caption.copyWith(
                                  color: colors.textPrimary,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              Text(
                                isIrn ? m.phaseLabelFa : m.phaseLabelEn,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: typography.caption.copyWith(
                                  color: colors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ],

                const SizedBox(height: SpacingTokens.lg),

                // Step-by-Step Active Actions
                Text(
                  l10n.roadmapActiveStepsLabel,
                  style: typography.cardTitle.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.sm),
                if (activeSteps.isEmpty)
                  MzCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        Text(
                          isIrn
                              ? 'عالی! همه قدم‌های فعلی شما کامل شده است.'
                              : 'All current steps are complete!',
                          style: typography.body.copyWith(
                            color: colors.success,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: SpacingTokens.sm),
                        PrimaryButton(
                          label: l10n.practiceHubTitle,
                          onPressed: () => context.go(AppRoutes.practice),
                        ),
                      ],
                    ),
                  )
                else
                  ...activeSteps.map((step) {
                    final topic = CanonicalTopicKey.normalize(step.topicKey);
                    return Padding(
                      padding: const EdgeInsetsDirectional.only(
                        bottom: SpacingTokens.md,
                      ),
                      child: MzCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: <Widget>[
                            Wrap(
                              alignment: WrapAlignment.spaceBetween,
                              crossAxisAlignment: WrapCrossAlignment.center,
                              spacing: SpacingTokens.sm,
                              runSpacing: SpacingTokens.xs,
                              children: <Widget>[
                                MzChip(
                                  label: topic.labelFor(isIran: isIrn),
                                ),
                                Text(
                                  isIrn
                                      ? 'حدود ${EdgeNumerals.toPersianDigits('${step.estimatedMinutes}')} دقیقه'
                                      : '~${step.estimatedMinutes} min',
                                  style: typography.caption.copyWith(
                                    color: colors.textTertiary,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: SpacingTokens.sm),
                            Text(
                              isIrn ? step.titleFa : step.titleEn,
                              style: typography.cardTitle.copyWith(
                                color: colors.textPrimary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: SpacingTokens.xs),
                            Text(
                              isIrn ? step.reasonFa : step.reasonEn,
                              style: typography.secondary.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                            const SizedBox(height: SpacingTokens.md),
                            Wrap(
                              spacing: SpacingTokens.sm,
                              runSpacing: SpacingTokens.sm,
                              children: <Widget>[
                                PrimaryButton(
                                  label: l10n.studyStart,
                                  glyph: isIrn
                                      ? LucideGlyph.arrowLeft
                                      : LucideGlyph.arrowRight,
                                  isFullWidth: false,
                                  onPressed: () {
                                    if (step.stepKind == 'pronunciation') {
                                      unawaited(
                                        SpeechPracticeSheet.show(
                                          context,
                                          targetText: step.reasonEn.isNotEmpty
                                              ? step.reasonEn
                                              : 'Clear sustained academic articulation raises IELTS fluency.',
                                          sourceRefType: 'coach',
                                          sourceRefId: step.stepId,
                                          sourceContext: 'coach',
                                        ),
                                      );
                                      return;
                                    }
                                    unawaited(
                                      context.push(
                                        resolveFlutterRoadmapStepRoute(step),
                                      ),
                                    );
                                  },
                                ),
                                SecondaryButton(
                                  label: l10n.roadmapCompleteStepCta,
                                  glyph: LucideGlyph.checkCircle2,
                                  isFullWidth: false,
                                  onPressed: _updatingStep
                                      ? null
                                      : () => unawaited(
                                          _stepAction(step, 'completed'),
                                        ),
                                ),
                                ActionChip(
                                  label: Text(l10n.roadmapSkipStepCta),
                                  onPressed: _updatingStep
                                      ? null
                                      : () => unawaited(
                                          _stepAction(step, 'skipped'),
                                        ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  }),

                // Collapsible Upcoming Steps
                if (upcomingSteps.isNotEmpty) ...<Widget>[
                  const SizedBox(height: SpacingTokens.md),
                  InkWell(
                    onTap: () => setState(() => _showUpcoming = !_showUpcoming),
                    child: Padding(
                      padding: const EdgeInsetsDirectional.symmetric(
                        vertical: SpacingTokens.sm,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: <Widget>[
                          Text(
                            '${l10n.roadmapUpcomingLabel} (${isIrn ? EdgeNumerals.toPersianDigits('${upcomingSteps.length}') : upcomingSteps.length})',
                            style: typography.secondary.copyWith(
                              color: colors.textSecondary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          AppIcon(
                            _showUpcoming
                                ? LucideGlyph.chevronUp
                                : LucideGlyph.chevronDown,
                            size: 18,
                            color: colors.textSecondary,
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_showUpcoming)
                    ...upcomingSteps.map(
                      (s) => Padding(
                        padding: const EdgeInsetsDirectional.only(
                          bottom: SpacingTokens.xs,
                        ),
                        child: Container(
                          padding: const EdgeInsetsDirectional.all(
                            SpacingTokens.md,
                          ),
                          decoration: BoxDecoration(
                            color: colors.surfaceAlt,
                            borderRadius: shapes.compactRadius,
                            border: Border.all(color: colors.borderSubtle),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: <Widget>[
                              Text(
                                '${EditionCopy.milestoneChipLabel(s.milestoneIndex, isIran: isIrn)} · ${isIrn ? s.titleFa : s.titleEn}',
                                style: typography.secondary.copyWith(
                                  color: colors.textSecondary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: SpacingTokens.xs),
                              Text(
                                isIrn ? s.reasonFa : s.reasonEn,
                                style: typography.caption.copyWith(
                                  color: colors.textTertiary,
                                ),
                              ),
                              const SizedBox(height: SpacingTokens.xs),
                              Align(
                                alignment: AlignmentDirectional.centerStart,
                                child: TextButton(
                                  onPressed: _updatingStep
                                      ? null
                                      : () => unawaited(
                                          _stepAction(s, 'active'),
                                        ),
                                  child: Text(l10n.roadmapJumpAheadCta),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],

                if (completedSteps.isNotEmpty) ...<Widget>[
                  const SizedBox(height: SpacingTokens.md),
                  InkWell(
                    onTap: () =>
                        setState(() => _showCompleted = !_showCompleted),
                    child: Container(
                      padding: const EdgeInsetsDirectional.symmetric(
                        horizontal: SpacingTokens.md,
                        vertical: SpacingTokens.sm,
                      ),
                      decoration: BoxDecoration(
                        color: colors.mintBg,
                        borderRadius: shapes.pillRadius,
                        border: Border.all(color: colors.success),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: <Widget>[
                          Text(
                            l10n.roadmapCollapseCompleted(
                              completedSteps.length,
                            ),
                            style: typography.caption.copyWith(
                              color: colors.success,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          AppIcon(
                            _showCompleted
                                ? LucideGlyph.chevronUp
                                : LucideGlyph.chevronDown,
                            size: 16,
                            color: colors.success,
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_showCompleted) ...<Widget>[
                    const SizedBox(height: SpacingTokens.xs),
                    ...completedSteps.map(
                      (cs) => Padding(
                        padding: const EdgeInsetsDirectional.only(
                          bottom: SpacingTokens.xs,
                        ),
                        child: Text(
                          '✓ ${EditionCopy.milestoneChipLabel(cs.milestoneIndex, isIran: isIrn)} · ${isIrn ? cs.titleFa : cs.titleEn}',
                          style: typography.caption.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ],
            ),
    );
  }

  void _openTopicsPaceSheet(
    BuildContext context,
    PersonalizationStateDto current,
    bool isIrn,
  ) {
    final selectedTopics = List<String>.from(current.favoriteTopics);
    var selectedCap = current.dailyNewVocabCap;
    var saving = false;

    unawaited(
      showMzBottomSheet<void>(
        context: context,
        title: AppLocalizations.of(context).roadmapEditTopicsPace,
        child: StatefulBuilder(
          builder: (sheetCtx, setSheetState) {
            final l10n = AppLocalizations.of(sheetCtx);
            final typography = AppTypography.of(sheetCtx);
            final colors = AppColors.of(sheetCtx);
            return SingleChildScrollView(
              padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Text(
                    l10n.favoriteTopicsLabel,
                    style: typography.secondary.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  Wrap(
                    spacing: SpacingTokens.xs,
                    runSpacing: SpacingTokens.xs,
                    children: CanonicalTopicKey.values
                        .map((topic) {
                          final wire = topic.wireKey;
                          final isSel = selectedTopics.contains(wire);
                          return FilterChip(
                            label: Text(topic.labelFor(isIran: isIrn)),
                            selected: isSel,
                            onSelected: (next) {
                              setSheetState(() {
                                if (next) {
                                  if (!selectedTopics.contains(wire)) {
                                    selectedTopics.add(wire);
                                  }
                                } else {
                                  selectedTopics.remove(wire);
                                }
                              });
                            },
                          );
                        })
                        .toList(growable: false),
                  ),
                  const SizedBox(height: SpacingTokens.md),
                  Text(
                    l10n.settingsDailyNewCapTitle,
                    style: typography.secondary.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  Wrap(
                    spacing: SpacingTokens.xs,
                    children: <int>[5, 10, 20]
                        .map(
                          (cap) => ChoiceChip(
                            label: Text(
                              isIrn
                                  ? EdgeNumerals.toPersianDigits('$cap')
                                  : '$cap',
                            ),
                            selected: selectedCap == cap,
                            onSelected: (_) =>
                                setSheetState(() => selectedCap = cap),
                          ),
                        )
                        .toList(growable: false),
                  ),
                  const SizedBox(height: SpacingTokens.lg),
                  PrimaryButton(
                    label: l10n.studyStart,
                    isLoading: saving,
                    onPressed: saving
                        ? null
                        : () async {
                            setSheetState(() => saving = true);
                            final res = await ref
                                .read(personalizationGatewayProvider)
                                .updateProfile(
                                  favoriteTopics: selectedTopics,
                                  dailyNewVocabCap: selectedCap,
                                );
                            final updated = res.valueOrNull;
                            if (updated != null) {
                              await ref
                                  .read(personalizationRepositoryProvider)
                                  .cacheState(updated);
                              if (mounted) {
                                setState(() => _state = updated);
                              }
                            }
                            if (sheetCtx.mounted) {
                              Navigator.of(sheetCtx).pop();
                            }
                          },
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

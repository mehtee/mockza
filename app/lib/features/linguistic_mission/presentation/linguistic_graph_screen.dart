import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/personalization/topic_taxonomy.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/linguistic_gateway.dart';
import 'package:mockza/services/personalization_gateway.dart';
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

/// Visualizes persistent bottlenecks, mastered structures, and user topic interests (`/progress/graph`).
class LinguisticGraphScreen extends ConsumerStatefulWidget {
  /// Creates a [LinguisticGraphScreen].
  const new({super.key});

  @override
  ConsumerState<LinguisticGraphScreen> createState() =>
      _LinguisticGraphScreenState();
}

class _LinguisticGraphScreenState extends ConsumerState<LinguisticGraphScreen> {
  final TextEditingController _topicCtrl = TextEditingController();
  LinguisticGraphSnapshot? _graph;
  PersonalizationStateDto? _pState;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    _topicCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final edition = ref.read(editionConfigProvider).edition;
    final repo = ref.read(linguisticRepositoryProvider);
    final cached = await repo.readCachedGraphSnapshot(
      edition: edition.code,
    );
    if (mounted && cached.totalEvidenceCount > 0) {
      setState(() {
        _graph = cached;
        _loading = false;
      });
    }

    final pCached = await ref
        .read(personalizationRepositoryProvider)
        .getCachedState();
    if (mounted && pCached != null) {
      setState(() => _pState = pCached);
    }

    final res = await ref.read(linguisticGatewayProvider).getMyGraph();
    final pRes = await ref.read(personalizationGatewayProvider).getState();
    if (!mounted) return;
    if (pRes.valueOrNull != null) {
      await ref
          .read(personalizationRepositoryProvider)
          .cacheState(pRes.valueOrNull!);
      if (mounted) setState(() => _pState = pRes.valueOrNull);
    }
    res.when(
      success: (snapshot) {
        unawaited(
          repo.cacheGraphSnapshot(snapshot, edition: edition.code),
        );
        setState(() {
          _graph = snapshot;
          _loading = false;
        });
      },
      failure: (_) => setState(() => _loading = false),
    );
  }

  Future<void> _pinTopic() => _pinTopicValue(_topicCtrl.text);

  Future<void> _pinTopicValue(String rawTopic) async {
    final topic = rawTopic.trim();
    if (topic.length < 2) return;
    final edition = ref.read(editionConfigProvider).edition.code;
    final res = await ref
        .read(linguisticGatewayProvider)
        .updateInterests(pinTopics: <String>[topic]);
    if (!mounted) return;
    await res.when(
      success: (snapshot) async {
        if (topic == _topicCtrl.text.trim()) _topicCtrl.clear();
        await ref
            .read(linguisticRepositoryProvider)
            .cacheGraphSnapshot(snapshot, edition: edition);
        if (mounted) setState(() => _graph = snapshot);
      },
      failure: (failure) async {
        if (failure is NetworkFailure) {
          await ref
              .read(attemptRepositoryProvider)
              .enqueueOutboxAction(
                actionType: 'graph.update_interests',
                payloadJson: jsonEncode(<String, Object?>{
                  'pinTopics': <String>[topic],
                  'muteTopics': const <String>[],
                  'edition': edition,
                }),
              );
          ref.read(outboxSyncServiceProvider).notifyWorkEnqueued();
          if (topic == _topicCtrl.text.trim()) _topicCtrl.clear();
        }
      },
    );
  }

  Future<void> _muteTopic(String canonicalKey) async {
    final edition = ref.read(editionConfigProvider).edition.code;
    final res = await ref
        .read(linguisticGatewayProvider)
        .updateInterests(muteTopics: <String>[canonicalKey]);
    if (!mounted) return;
    await res.when(
      success: (snapshot) async {
        await ref
            .read(linguisticRepositoryProvider)
            .cacheGraphSnapshot(snapshot, edition: edition);
        if (mounted) setState(() => _graph = snapshot);
      },
      failure: (_) {},
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final l10n = AppLocalizations.of(context);
    final isRtl = ref.watch(editionConfigProvider).edition == AppEdition.iran;
    final g = _graph;
    final bottleneckCount = g?.bottlenecks.length ?? 0;
    final countLabel = isRtl
        ? EdgeNumerals.toPersianDigits(bottleneckCount)
        : '$bottleneckCount';

    return MzScaffold(
      appBar: AppBar(
        title: Text(l10n.linguisticGraphTitle),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
              children: <Widget>[
                Text(
                  '${l10n.activeBottlenecksLabel} ($countLabel)',
                  style: typography.cardTitle.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.sm),
                if (bottleneckCount == 0)
                  MzCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        Text(
                          isRtl
                              ? 'هنوز خطای پرتکراری ثبت نشده است. با یک تمرین ۱۰ دقیقه‌ای یا ارتقای جمله، نقشه نقاط ضعف شما شکل می‌گیرد.'
                              : 'No recurring weak spots recorded yet. Complete one 10-minute session or upgrade a spoken sentence to map your baseline.',
                          style: typography.secondary.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: SpacingTokens.sm),
                        Wrap(
                          spacing: SpacingTokens.xs,
                          runSpacing: SpacingTokens.xs,
                          children: <Widget>[
                            SecondaryButton(
                              label: isRtl
                                  ? 'شروع مربی امروز'
                                  : "Start Today's 10-Min Coach",
                              glyph: LucideGlyph.flame,
                              isFullWidth: false,
                              onPressed: () =>
                                  context.push(AppRoutes.buildDailyMission()),
                            ),
                            SecondaryButton(
                              label: isRtl
                                  ? 'ارتقای گفتار'
                                  : 'Upgrade a Thought',
                              glyph: LucideGlyph.slidersHorizontal,
                              isFullWidth: false,
                              onPressed: () =>
                                  context.push(AppRoutes.registerShifter),
                            ),
                          ],
                        ),
                      ],
                    ),
                  )
                else ...<Widget>[
                  Wrap(
                    spacing: SpacingTokens.xs,
                    runSpacing: SpacingTokens.xs,
                    children: (g?.bottlenecks ?? const <LinguisticNodeDto>[])
                        .map(
                          (b) => BottleneckBadge(
                            label: isRtl && b.displayLabelFa != null
                                ? b.displayLabelFa!
                                : b.displayLabelEn,
                            masteryPercent: (b.masteryScoreMilli / 10).round(),
                            isBottleneck: true,
                          ),
                        )
                        .toList(growable: false),
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: SecondaryButton(
                      label: isRtl
                          ? 'رفع نقطه‌ضعف در مربی امروز'
                          : 'Fix Weak Spots in 10-Min Coach',
                      glyph: LucideGlyph.arrowRight,
                      isFullWidth: false,
                      onPressed: () =>
                          context.push(AppRoutes.buildDailyMission()),
                    ),
                  ),
                ],
                const SizedBox(height: SpacingTokens.lg),
                Text(
                  l10n.targetStructuresLabel,
                  style: typography.cardTitle.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.sm),
                LtrExamBoundary(
                  child: Wrap(
                    spacing: SpacingTokens.xs,
                    runSpacing: SpacingTokens.xs,
                    children:
                        (g?.targetStructures ?? const <LinguisticNodeDto>[])
                            .map(
                              (n) => BottleneckBadge(
                                label: n.displayLabelEn,
                                masteryPercent: (n.masteryScoreMilli / 10)
                                    .round(),
                                isBottleneck: false,
                              ),
                            )
                            .toList(growable: false),
                  ),
                ),
                const SizedBox(height: SpacingTokens.lg),
                if (_pState != null) ...<Widget>[
                  MzCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: <Widget>[
                            Expanded(
                              child: Text(
                                l10n.graphCoverageTitle,
                                style: typography.cardTitle.copyWith(
                                  color: colors.textPrimary,
                                ),
                              ),
                            ),
                            MzChip(label: _pState!.activeWeaknessPhase),
                          ],
                        ),
                        const SizedBox(height: SpacingTokens.sm),
                        Text(
                          '${l10n.graphCoverageFavoriteMastered}: '
                          '${EdgeNumerals.formatChromeNumber(_pState!.masteredInFavoriteTopicsCount, ref.watch(editionConfigProvider).edition)}',
                          style: typography.caption.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          '${l10n.graphCoverageTransferred}: '
                          '${EdgeNumerals.formatChromeNumber(_pState!.transferredToOtherTopicsCount, ref.watch(editionConfigProvider).edition)}',
                          style: typography.caption.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.lg),
                ],
                MzCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Text(
                        l10n.pinnedInterestsLabel,
                        style: typography.cardTitle.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.sm),
                      Wrap(
                        spacing: SpacingTokens.xs,
                        runSpacing: SpacingTokens.xs,
                        children: CanonicalTopicKey.values
                            .where(
                              (s) =>
                                  !(g?.interestTopics ??
                                          const <LinguisticNodeDto>[])
                                      .any(
                                        (t) =>
                                            !t.isMuted &&
                                            (t.displayLabelEn.toLowerCase() ==
                                                    s.labelEn.toLowerCase() ||
                                                t.displayLabelEn.toLowerCase() ==
                                                    s.wireKey),
                                      ),
                            )
                            .map(
                              (topic) => ActionChip(
                                avatar: const AppIcon(
                                  LucideGlyph.plus,
                                  size: 14,
                                ),
                                label: Text(topic.labelFor(isIran: isRtl)),
                                onPressed: () =>
                                    unawaited(_pinTopicValue(topic.wireKey)),
                              ),
                            )
                            .toList(growable: false),
                      ),
                      const SizedBox(height: SpacingTokens.sm),
                      Wrap(
                        spacing: SpacingTokens.xs,
                        runSpacing: SpacingTokens.xs,
                        children:
                            (g?.interestTopics ?? const <LinguisticNodeDto>[])
                                .where((t) => !t.isMuted)
                                .map(
                                  (t) => InputChip(
                                    label: Text(
                                      isRtl && t.displayLabelFa != null
                                          ? t.displayLabelFa!
                                          : t.displayLabelEn,
                                    ),
                                    selected: t.isPinned,
                                    onDeleted: () => unawaited(
                                      _muteTopic(t.canonicalKey),
                                    ),
                                  ),
                                )
                                .toList(growable: false),
                      ),
                      const SizedBox(height: SpacingTokens.md),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: TextField(
                              controller: _topicCtrl,
                              decoration: InputDecoration(
                                hintText: isRtl
                                    ? 'مثلاً فوتبال یا هوش مصنوعی'
                                    : 'Add topic (e.g. Football, AI)...',
                                border: const OutlineInputBorder(),
                              ),
                            ),
                          ),
                          const SizedBox(width: SpacingTokens.sm),
                          SecondaryButton(
                            label: l10n.pinTopicAction,
                            glyph: LucideGlyph.plus,
                            isFullWidth: false,
                            onPressed: _pinTopic,
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
}

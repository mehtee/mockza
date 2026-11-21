import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/linguistic_gateway.dart';
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

    final res = await ref.read(linguisticGatewayProvider).getMyGraph();
    if (!mounted) return;
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

  Future<void> _pinTopic() async {
    final topic = _topicCtrl.text.trim();
    if (topic.length < 2) return;
    final res = await ref
        .read(linguisticGatewayProvider)
        .updateInterests(pinTopics: <String>[topic]);
    if (!mounted) return;
    res.when(
      success: (snapshot) {
        _topicCtrl.clear();
        setState(() => _graph = snapshot);
      },
      failure: (_) {},
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isRtl = ref.watch(editionConfigProvider).edition == AppEdition.iran;
    final g = _graph;

    return MzScaffold(
      appBar: AppBar(
        title: Text(isRtl ? 'گراف زبانی و عادت‌ها' : 'Linguistic Graph'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
              children: <Widget>[
                Text(
                  isRtl
                      ? 'گلوگاه‌های فعال (${g?.bottlenecks.length ?? 0})'
                      : 'Active Bottlenecks (${g?.bottlenecks.length ?? 0})',
                  style: typography.cardTitle.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.sm),
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
                const SizedBox(height: SpacingTokens.lg),
                Text(
                  isRtl ? 'ساختارهای هدف' : 'Target Structures',
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
                MzCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      Text(
                        isRtl ? 'علایق موضوعی شما' : 'Pinned Interest Topics',
                        style: typography.cardTitle.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.sm),
                      Wrap(
                        spacing: SpacingTokens.xs,
                        runSpacing: SpacingTokens.xs,
                        children:
                            (g?.interestTopics ?? const <LinguisticNodeDto>[])
                                .where((t) => !t.isMuted)
                                .map(
                                  (t) => MzChip(
                                    label: isRtl && t.displayLabelFa != null
                                        ? t.displayLabelFa!
                                        : t.displayLabelEn,
                                    isSelected: t.isPinned,
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
                            label: isRtl ? 'افزودن' : 'Pin',
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

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/linguistic_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/primitives.dart';

/// Displays extracted idioms inside [LtrExamBoundary] + 2-Min Micro-Drill & 1-tap SM-2 capture (`/drop/drill/:dropId`).
class DropDrillScreen extends ConsumerStatefulWidget {
  /// Creates a [DropDrillScreen].
  const new({
    required this.dropId,
    super.key,
  });

  /// Drop content UUID.
  final String dropId;

  @override
  ConsumerState<DropDrillScreen> createState() => _DropDrillScreenState();
}

class _DropDrillScreenState extends ConsumerState<DropDrillScreen> {
  DroppedContentDto? _drop;
  int? _selectedIdx;
  bool _loading = true;
  final Set<String> _savedHeadwords = <String>{};

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    final repo = ref.read(linguisticRepositoryProvider);
    final cachedList = await repo.listCachedDrops();
    final cached = cachedList
        .where((d) => d.dropId == widget.dropId)
        .firstOrNull;
    if (mounted && cached != null) {
      setState(() {
        _drop = cached;
        _loading = false;
      });
    }

    final res = await ref
        .read(linguisticGatewayProvider)
        .getDropById(widget.dropId);
    if (!mounted) return;
    res.when(
      success: (d) {
        unawaited(repo.cacheDroppedContent(d));
        setState(() {
          _drop = d;
          _loading = false;
        });
      },
      failure: (_) => setState(() => _loading = false),
    );
  }

  Future<void> _savePhrase(DroppedPhraseDto phrase) async {
    final isRtl = ref.read(editionConfigProvider).edition == AppEdition.iran;
    await ref
        .read(vocabRepositoryProvider)
        .captureMistakeToDeck(
          cardId:
              'drop-${phrase.headword.toLowerCase().replaceAll(RegExp('[^a-z0-9]+'), '-')}',
          headword: phrase.headword,
          definition: phrase.definitionEn,
          glossFa: isRtl ? phrase.glossFa : null,
          ipa: phrase.ipa,
          topicTag: 'drop_anything',
          contextSentence: phrase.exampleSentence,
          sourceSkill: _drop?.inputKind == 'audio' ? 'listening' : 'reading',
          sourceAttemptId: widget.dropId,
          sourceRefLabel: _drop?.sourceDomainOrLabel ?? 'Drop Anything',
        );
    if (mounted) {
      setState(() => _savedHeadwords.add(phrase.headword));
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isRtl = ref.watch(editionConfigProvider).edition == AppEdition.iran;
    final d = _drop;

    return MzScaffold(
      appBar: AppBar(
        title: Text(isRtl ? 'میکرودریل ۲ دقیقه‌ای' : '2-Min Micro-Drill'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : d == null
          ? Center(
              child: Text(isRtl ? 'محتوا یافت نشد.' : 'Drop item not found.'),
            )
          : ListView(
              padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
              children: <Widget>[
                LtrExamBoundary(
                  child: Text(
                    d.title,
                    style: typography.headline.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                ),
                const SizedBox(height: SpacingTokens.sm),
                ...d.extractedPhrases.map((p) {
                  final isSaved = _savedHeadwords.contains(p.headword);
                  return Padding(
                    padding: const EdgeInsetsDirectional.only(
                      bottom: SpacingTokens.sm,
                    ),
                    child: MzCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          LtrExamBoundary(
                            child: Text(
                              '${p.headword} ${p.ipa ?? ''}'.trim(),
                              style: typography.cardTitle.copyWith(
                                color: colors.primary,
                              ),
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.xs),
                          LtrExamBoundary(
                            child: Text(
                              p.definitionEn,
                              style: typography.body.copyWith(
                                color: colors.textPrimary,
                              ),
                            ),
                          ),
                          if (isRtl && p.glossFa != null) ...<Widget>[
                            const SizedBox(height: SpacingTokens.xs),
                            Text(
                              p.glossFa!,
                              style: typography.caption.copyWith(
                                color: colors.primary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                          const SizedBox(height: SpacingTokens.xs),
                          LtrExamBoundary(
                            child: Text(
                              '“${p.exampleSentence}”',
                              style: typography.caption.copyWith(
                                color: colors.textSecondary,
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.sm),
                          SecondaryButton(
                            key: ValueKey<String>('save_drop_${p.headword}'),
                            label: isSaved
                                ? (isRtl ? 'در دِک ذخیره شد' : 'Saved to SM-2')
                                : (isRtl ? 'افزودن به دِک' : 'Save to SM-2'),
                            glyph: isSaved
                                ? LucideGlyph.checkCircle2
                                : LucideGlyph.bookmarkPlus,
                            onPressed: isSaved ? null : () => _savePhrase(p),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
                const SizedBox(height: SpacingTokens.md),
                MzCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      LtrExamBoundary(
                        child: Text(
                          d.comprehensionPrompt,
                          style: typography.cardTitle.copyWith(
                            color: colors.textPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.sm),
                      ...List<Widget>.generate(d.comprehensionOptions.length, (
                        idx,
                      ) {
                        final selected = _selectedIdx == idx;
                        return Padding(
                          padding: const EdgeInsetsDirectional.only(
                            bottom: SpacingTokens.xs,
                          ),
                          child: MzCard(
                            onTap: () => setState(() => _selectedIdx = idx),
                            child: Row(
                              children: <Widget>[
                                AppIcon(
                                  selected
                                      ? LucideGlyph.checkCircle2
                                      : LucideGlyph.circle,
                                  color: selected
                                      ? colors.primary
                                      : colors.textSecondary,
                                ),
                                const SizedBox(width: SpacingTokens.sm),
                                Expanded(
                                  child: LtrExamBoundary(
                                    child: Text(d.comprehensionOptions[idx]),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                      const SizedBox(height: SpacingTokens.sm),
                      LtrExamBoundary(
                        child: Text(
                          'Shadow aloud: ${d.shadowingPrompt}',
                          style: typography.caption.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

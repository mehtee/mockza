import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/linguistic_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/linguistic_cards.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/primitives.dart';

/// Closed-loop 10-Min Daily Transfer Mission workspace (`/mission/:missionId`).
class DailyMissionScreen extends ConsumerStatefulWidget {
  /// Creates a [DailyMissionScreen].
  const new({
    this.missionId = 'today',
    super.key,
  });

  /// Target mission identifier (`today` resolves current UTC serial day).
  final String missionId;

  @override
  ConsumerState<DailyMissionScreen> createState() => _DailyMissionScreenState();
}

class _DailyMissionScreenState extends ConsumerState<DailyMissionScreen> {
  final TextEditingController _controller = TextEditingController();
  DailyMissionSnapshot? _mission;
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_loadMission());
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _loadMission() async {
    final gateway = ref.read(linguisticGatewayProvider);
    final repo = ref.read(linguisticRepositoryProvider);
    final cached = await repo.readTodayCachedMission();
    if (mounted && cached != null) {
      setState(() {
        _mission = cached;
        _loading = false;
      });
    }

    final dueCards = await ref
        .read(vocabRepositoryProvider)
        .watchDueCards(limit: 5)
        .first;
    final dueWords = dueCards.map((c) => c.headword).toList(growable: false);
    final res = await gateway.getTodayMission(dueWords: dueWords);
    if (!mounted) return;
    res.when(
      success: (snapshot) {
        unawaited(repo.cacheDailyMission(snapshot));
        setState(() {
          _mission = snapshot;
          _loading = false;
          _error = null;
        });
      },
      failure: (failure) {
        setState(() {
          _loading = false;
          if (_mission == null) _error = failure.message;
        });
      },
    );
  }

  Future<void> _submit() async {
    final m = _mission;
    final text = _controller.text.trim();
    if (m == null || text.length < 10) return;

    setState(() {
      _submitting = true;
      _error = null;
    });
    final res = await ref
        .read(linguisticGatewayProvider)
        .completeMission(
          missionId: m.missionId,
          responseText: text,
        );
    if (!mounted) return;
    res.when(
      success: (updated) {
        unawaited(
          ref.read(linguisticRepositoryProvider).cacheDailyMission(updated),
        );
        setState(() {
          _mission = updated;
          _submitting = false;
        });
      },
      failure: (failure) {
        setState(() {
          _submitting = false;
          _error = failure.message;
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isRtl = ref.watch(editionConfigProvider).edition == AppEdition.iran;
    final m = _mission;

    return MzScaffold(
      appBar: AppBar(
        title: Text(
          isRtl ? 'مأموریت روزانه ۱۰ دقیقه‌ای' : '10-Min Daily Mission',
        ),
        actions: <Widget>[
          IconButton(
            tooltip: isRtl ? 'گراف زبانی' : 'Linguistic Graph',
            icon: const AppIcon(LucideGlyph.chartIncreasing),
            onPressed: () => context.push(AppRoutes.linguisticGraph),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
              children: <Widget>[
                if (_error != null)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(
                      bottom: SpacingTokens.sm,
                    ),
                    child: Text(
                      _error!,
                      style: typography.caption.copyWith(color: colors.error),
                    ),
                  ),
                if (m != null) ...<Widget>[
                  Text(
                    m.promptTitle,
                    style: typography.headline.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  MzCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        Text(
                          isRtl
                              ? 'حتماً از این ۲ ساختار هدف در پاسخ استفاده کنید:'
                              : 'Required Transfer Targets:',
                          style: typography.caption.copyWith(
                            color: colors.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: SpacingTokens.xs),
                        TargetStructureChips(
                          phrases: m.forcedTargets
                              .map((f) => f.phraseEn)
                              .toList(growable: false),
                        ),
                        const SizedBox(height: SpacingTokens.sm),
                        ...m.forcedTargets.map(
                          (f) => Padding(
                            padding: const EdgeInsetsDirectional.only(
                              bottom: SpacingTokens.xs,
                            ),
                            child: Text(
                              '${f.phraseEn}: ${isRtl && f.hintFa != null ? f.hintFa! : f.hintEn}',
                              style: typography.caption.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.md),
                  MzCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        if (isRtl && m.promptTextFa != null) ...<Widget>[
                          Text(
                            m.promptTextFa!,
                            style: typography.body.copyWith(
                              color: colors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.sm),
                        ],
                        LtrExamBoundary(
                          child: Text(
                            m.promptTextEn,
                            style: typography.body.copyWith(
                              color: colors.textPrimary,
                            ),
                          ),
                        ),
                        const SizedBox(height: SpacingTokens.md),
                        LtrExamBoundary(
                          child: TextField(
                            key: const ValueKey<String>(
                              'mission_response_field',
                            ),
                            controller: _controller,
                            maxLines: 5,
                            decoration: InputDecoration(
                              hintText: isRtl
                                  ? 'پاسخ انگلیسی خود را با ساختارهای هدف بنویسید...'
                                  : 'Write 4–6 sentences using both forced structures...',
                              border: const OutlineInputBorder(),
                            ),
                          ),
                        ),
                        const SizedBox(height: SpacingTokens.md),
                        PrimaryButton(
                          key: const ValueKey<String>('mission_complete_btn'),
                          label: isRtl
                              ? 'ثبت و ارزیابی مأموریت'
                              : 'Complete Mission',
                          glyph: LucideGlyph.check,
                          isLoading: _submitting,
                          onPressed: _submitting ? null : _submit,
                        ),
                      ],
                    ),
                  ),
                  if (m.status == 'completed' &&
                      (m.feedbackEn != null ||
                          m.feedbackFa != null)) ...<Widget>[
                    const SizedBox(height: SpacingTokens.md),
                    MzCard(
                      key: const ValueKey<String>('mission_completed_card'),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          Text(
                            isRtl && m.feedbackFa != null
                                ? m.feedbackFa!
                                : (m.feedbackEn ?? 'Completed!'),
                            style: typography.body.copyWith(
                              color: colors.success,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (m.matchedTargets.isNotEmpty) ...<Widget>[
                            const SizedBox(height: SpacingTokens.xs),
                            TargetStructureChips(phrases: m.matchedTargets),
                          ],
                        ],
                      ),
                    ),
                  ],
                ],
              ],
            ),
    );
  }
}

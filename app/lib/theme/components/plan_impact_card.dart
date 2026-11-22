import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/roadmap_route_resolver.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/personalization_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/primitives.dart';

/// Shared post-test personalization feedback strip ("How This Updated Your Plan").
/// Mounted on objective review and subjective evaluation review screens.
class PlanImpactCard extends ConsumerStatefulWidget {
  /// Creates a [PlanImpactCard].
  const new({this.skill, this.scoreBand, super.key});

  /// Skill of the just-finished attempt (`reading`, `listening`, `writing`, `speaking`).
  final String? skill;

  /// Score obtained on the attempt, used as refresh key and fallback band display.
  final double? scoreBand;

  @override
  ConsumerState<PlanImpactCard> createState() => _PlanImpactCardState();
}

class _PlanImpactCardState extends ConsumerState<PlanImpactCard> {
  PersonalizationStateDto? _state;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void didUpdateWidget(covariant PlanImpactCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.scoreBand != widget.scoreBand || oldWidget.skill != widget.skill) {
      unawaited(_load());
    }
  }

  Future<void> _load() async {
    final repo = ref.read(personalizationRepositoryProvider);
    final cached = await repo.getCachedState();
    if (mounted && cached != null) {
      setState(() => _state = cached);
    }
    final remote = await ref.read(personalizationGatewayProvider).getState();
    final fresh = remote.valueOrNull;
    if (fresh != null) {
      await repo.cacheState(fresh);
      if (mounted) setState(() => _state = fresh);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = _state;
    if (state == null) return const SizedBox.shrink();

    final l10n = Localizations.of<AppLocalizations>(context, AppLocalizations);
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isIrn = ref.watch(editionConfigProvider).edition == AppEdition.iran;

    final skillScore = widget.skill != null
        ? state.liveBand.skills[widget.skill!]?.score
        : state.liveBand.currentBand;
    final displayBand = skillScore ?? state.liveBand.currentBand ?? widget.scoreBand;
    final currentStep = state.currentStep;

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              AppIcon(LucideGlyph.sparkles, size: 16, color: colors.primary),
              const SizedBox(width: SpacingTokens.xs),
              Expanded(
                child: Text(
                  l10n?.planImpactTitle ?? 'How This Updated Your Plan',
                  style: typography.caption.copyWith(
                    color: colors.primary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.sm),
          Wrap(
            spacing: SpacingTokens.xs,
            runSpacing: SpacingTokens.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: <Widget>[
              MzChip(
                label:
                    '${l10n?.planImpactBandLabel ?? 'Live Band Estimate'}: ${displayBand?.toStringAsFixed(1) ?? '--'}',
                variant: MzChipVariant.target,
              ),
              if (state.liveBand.bandShift > 0)
                MzChip(
                  label: '+${state.liveBand.bandShift.toStringAsFixed(1)}',
                  variant: MzChipVariant.positive,
                ),
              ...state.weaknesses
                  .take(2)
                  .map(
                    (w) => MzChip(
                      label: isIrn ? w.displayLabelFa : w.displayLabelEn,
                    ),
                  ),
            ],
          ),
          if (currentStep != null) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            LtrExamBoundary(
              useLatinFont: !isIrn,
              child: Text(
                isIrn ? currentStep.titleFa : currentStep.titleEn,
                style: typography.caption.copyWith(
                  color: colors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: SpacingTokens.sm),
          ] else
            const SizedBox(height: SpacingTokens.sm),
          Wrap(
            spacing: SpacingTokens.sm,
            runSpacing: SpacingTokens.xs,
            children: <Widget>[
              if (currentStep != null)
                PrimaryButton(
                  label: l10n?.planImpactNextStepCta ?? 'Continue Next Roadmap Step',
                  glyph: LucideGlyph.arrowRight,
                  isFullWidth: false,
                  onPressed: () => context.push(
                    resolveFlutterRoadmapStepRoute(currentStep),
                  ),
                ),
              SecondaryButton(
                label: l10n?.roadmapViewFullCta ?? 'View Full Roadmap',
                glyph: LucideGlyph.target,
                isFullWidth: false,
                onPressed: () => context.push(AppRoutes.roadmap),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/primitives.dart';

/// Home summary card linking into the 10-Min Closed-Loop Daily Mission (`ADR-ADV-007`).
class MissionProgressCard extends StatelessWidget {
  /// Creates a [MissionProgressCard].
  const new({
    required this.isRtl,
    required this.onStartMission,
    required this.onOpenRegisterShifter,
    required this.onOpenDropAnything,
    this.focusTopic,
    super.key,
  });

  /// Whether Persian RTL labels should be shown (`irn`).
  final bool isRtl;

  /// Optional active topic tag.
  final String? focusTopic;

  /// Opens today's Daily Mission screen.
  final VoidCallback onStartMission;

  /// Opens the 3-Gear Register Shifter screen.
  final VoidCallback onOpenRegisterShifter;

  /// Opens Drop Anything screen.
  final VoidCallback onOpenDropAnything;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              AppIcon(
                LucideGlyph.flame,
                size: 18,
                color: colors.primary,
              ),
              const SizedBox(width: SpacingTokens.xs),
              Expanded(
                child: Text(
                  isRtl
                      ? 'مأموریت ۱۰ دقیقه‌ای امروز'
                      : '10-Min Daily Transfer Mission',
                  style: typography.cardTitle.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
              ),
              if (focusTopic != null)
                Container(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: SpacingTokens.sm,
                    vertical: SpacingTokens.xs,
                  ),
                  decoration: BoxDecoration(
                    color: colors.interestTag.withValues(alpha: 0.16),
                    borderRadius: shapes.pillRadius,
                  ),
                  child: Text(
                    focusTopic!,
                    style: typography.caption.copyWith(
                      color: colors.interestTag,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            isRtl
                ? 'تمرین هدفمند با ترکیب گلوگاه‌های گرامری، کارت‌های SM-2 و علایق شما'
                : 'Targets your live bottlenecks and overdue SM-2 cards inside your favorite topics.',
            style: typography.secondary.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.md),
          PrimaryButton(
            label: isRtl ? 'شروع مأموریت روزانه' : 'Start 10-Min Mission',
            glyph: LucideGlyph.sparkles,
            onPressed: onStartMission,
          ),
          const SizedBox(height: SpacingTokens.xs),
          Wrap(
            spacing: SpacingTokens.xs,
            runSpacing: SpacingTokens.xs,
            children: <Widget>[
              SecondaryButton(
                label: isRtl ? 'تغییردهنده لحن (۳۰ث)' : 'Register Shifter',
                glyph: LucideGlyph.slidersHorizontal,
                isFullWidth: false,
                onPressed: onOpenRegisterShifter,
              ),
              SecondaryButton(
                label: isRtl ? 'ورود هر محتوایی' : 'Drop Anything',
                glyph: LucideGlyph.cloudUpload,
                isFullWidth: false,
                onPressed: onOpenDropAnything,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Visual badge showing whether a Linguistic Graph node is an active bottleneck or mastered target.
class BottleneckBadge extends StatelessWidget {
  /// Creates a [BottleneckBadge].
  const new({
    required this.label,
    required this.masteryPercent,
    required this.isBottleneck,
    super.key,
  });

  /// Display title.
  final String label;

  /// Mastery readout `0..100`.
  final int masteryPercent;

  /// True for gap/bottleneck highlight; false for mastered structure.
  final bool isBottleneck;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);
    final tint = isBottleneck ? colors.gapObserved : colors.structureMastered;

    return Container(
      constraints: const BoxConstraints(maxWidth: 320),
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: SpacingTokens.sm,
        vertical: SpacingTokens.xs,
      ),
      decoration: BoxDecoration(
        color: tint.withValues(alpha: 0.14),
        borderRadius: shapes.pillRadius,
        border: Border.all(color: tint.withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          AppIcon(
            isBottleneck ? LucideGlyph.alertTriangle : LucideGlyph.checkCircle2,
            size: 14,
            color: tint,
          ),
          const SizedBox(width: SpacingTokens.xs),
          Flexible(
            child: Text(
              '$label · $masteryPercent%',
              style: typography.caption.copyWith(
                color: tint,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Renders forced target phrases inside a strict LTR boundary with bilingual hints.
class TargetStructureChips extends StatelessWidget {
  /// Creates [TargetStructureChips].
  const new({
    required this.phrases,
    super.key,
  });

  /// Target English expressions.
  final List<String> phrases;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return LtrExamBoundary(
      child: Wrap(
        spacing: SpacingTokens.xs,
        runSpacing: SpacingTokens.xs,
        children: phrases
            .map(
              (p) => Container(
                padding: const EdgeInsetsDirectional.symmetric(
                  horizontal: SpacingTokens.sm,
                  vertical: SpacingTokens.xs,
                ),
                decoration: BoxDecoration(
                  color: colors.structureMastered.withValues(alpha: 0.15),
                  borderRadius: shapes.compactRadius,
                  border: Border.all(
                    color: colors.structureMastered.withValues(alpha: 0.45),
                  ),
                ),
                child: Text(
                  p,
                  style: typography.caption.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            )
            .toList(growable: false),
      ),
    );
  }
}

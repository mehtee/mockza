import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/primitives.dart';

/// Quiet empty state representation (design.md Sec. 5).
class EmptyState extends StatelessWidget {
  /// Creates an [EmptyState].
  const new({
    required this.title,
    required this.description,
    this.glyph = LucideGlyph.sparkles,
    this.actionLabel,
    this.onTapAction,
    super.key,
  });

  /// Empty state heading.
  final String title;

  /// Explanatory guidance.
  final String description;

  /// Quiet icon glyph.
  final LucideGlyph glyph;

  /// Optional action CTA label.
  final String? actionLabel;

  /// Optional action tap callback.
  final VoidCallback? onTapAction;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SpacingTokens.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            IconWell(
              glyph: glyph,
              size: 56,
              iconSize: 28,
            ),
            const SizedBox(height: SpacingTokens.lg),
            Text(
              title,
              style: typography.cardTitle.copyWith(
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: SpacingTokens.xs),
            Text(
              description,
              style: typography.secondary.copyWith(
                color: colors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            if (actionLabel != null && onTapAction != null) ...<Widget>[
              const SizedBox(height: SpacingTokens.xl),
              PrimaryButton(
                label: actionLabel!,
                isFullWidth: false,
                onPressed: onTapAction,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

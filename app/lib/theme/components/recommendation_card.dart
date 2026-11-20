import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/primitives.dart';

/// Single high-priority recommendation card from dashboard (design.md Sec. 4.3 & 5, Screenshot 01).
/// Surfaces pending offline retry attempts first, otherwise weakest skill micro-drill or next sample pack.
class RecommendationCard extends StatelessWidget {
  /// Creates a [RecommendationCard].
  const new({
    required this.title,
    required this.subtitle,
    required this.onTapStart,
    this.glyph = LucideGlyph.audioLines,
    this.tint = IconWellTint.blue,
    this.ctaLabel = 'Start',
    this.onTapCard,
    super.key,
  });

  /// Recommendation title (e.g. "Improve your speaking fluency").
  final String title;

  /// Short supportive description (e.g. "3-minute AI micro-drill").
  final String subtitle;

  /// Vector icon to render in leading well.
  final LucideGlyph glyph;

  /// Semantic icon well tint.
  final IconWellTint tint;

  /// CTA button label.
  final String ctaLabel;

  /// Callback when tapping the CTA button.
  final VoidCallback onTapStart;

  /// Optional card tap callback.
  final VoidCallback? onTapCard;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      variant: MzCardVariant.action,
      onTap: onTapCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              IconWell(glyph: glyph, tint: tint),
              const SizedBox(width: SpacingTokens.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(title, style: typography.cardTitle),
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      subtitle,
                      style: typography.secondary.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: PrimaryButton(
              label: ctaLabel,
              isFullWidth: false,
              onPressed: onTapStart,
            ),
          ),
        ],
      ),
    );
  }
}

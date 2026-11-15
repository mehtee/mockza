import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Semibold section title with optional right metadata or action link (design.md Sec. 5).
class SectionHeader extends StatelessWidget {
  /// Creates a [SectionHeader].
  const new({
    required this.title,
    this.actionLabel,
    this.onTapAction,
    this.trailing,
    super.key,
  });

  /// Section heading text.
  final String title;

  /// Optional right action link label (e.g. "See all").
  final String? actionLabel;

  /// Callback when tapping [actionLabel].
  final VoidCallback? onTapAction;

  /// Custom trailing widget (badge, chip, or button).
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Padding(
      padding: const EdgeInsets.only(
        top: SpacingTokens.sectionSep,
        bottom: SpacingTokens.md,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Expanded(
            child: Text(
              title,
              style: typography.cardTitle.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          if (trailing != null)
            trailing!
          else if (actionLabel != null)
            InkWell(
              onTap: onTapAction,
              child: Text(
                actionLabel!,
                style: typography.secondary.copyWith(
                  color: colors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

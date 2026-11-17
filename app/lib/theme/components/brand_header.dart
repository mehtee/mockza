import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';
import 'package:mockza/theme/responsive_layout.dart';

/// Top identity area from design.md Sec. 4.1 & 4.3.
/// Features the custom gradient "M" wordmark, product title, compact exam selector pill,
/// and top-right settings button with tight-screen (`320dp`) overflow protection.
class BrandHeader extends StatelessWidget {
  /// Creates a [BrandHeader].
  const new({
    this.title,
    this.subtitle,
    this.selectedExam = 'IELTS Academic',
    this.onTapExamSelector,
    this.onTapSettings,
    this.showSettings = true,
    super.key,
  });

  /// Optional custom page title. If null, displays "Mockza".
  final String? title;

  /// Optional secondary subtitle.
  final String? subtitle;

  /// Current active exam track label.
  final String selectedExam;

  /// Callback when tapping the exam switcher pill.
  final VoidCallback? onTapExamSelector;

  /// Callback when tapping the settings gear button.
  final VoidCallback? onTapSettings;

  /// Whether to display the settings button at top right.
  final bool showSettings;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);
    final isTight = MzResponsive.isTightPhoneOf(context);

    if (title != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Expanded(
                child: Text(
                  title!,
                  style: typography.sectionHeading,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (showSettings && onTapSettings != null)
                IconButton(
                  tooltip: 'Settings',
                  onPressed: onTapSettings,
                  icon: AppIcon(
                    LucideGlyph.settings,
                    size: 22,
                    color: colors.textSecondary,
                  ),
                ),
            ],
          ),
          if (subtitle != null) ...<Widget>[
            const SizedBox(height: SpacingTokens.xs),
            Text(
              subtitle!,
              style: typography.secondary.copyWith(
                color: colors.textSecondary,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      );
    }

    return Padding(
      padding: const EdgeInsetsDirectional.symmetric(
        vertical: SpacingTokens.xs,
      ),
      child: Row(
        children: <Widget>[
          MockzaMark(size: isTight ? 24 : 26),
          const SizedBox(width: SpacingTokens.sm),
          if (!isTight) ...<Widget>[
            Text(
              'Mockza',
              style: typography.cardTitle.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: -0.4,
              ),
            ),
            const SizedBox(width: SpacingTokens.sm),
          ],
          Expanded(
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 220),
                child: InkWell(
                  onTap: onTapExamSelector,
                  borderRadius: shapes.pillRadius,
                  child: Container(
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: SpacingTokens.sm,
                      vertical: SpacingTokens.xs + 2,
                    ),
                    decoration: BoxDecoration(
                      color: colors.surfaceAlt,
                      borderRadius: shapes.pillRadius,
                      border: Border.all(
                        color: colors.borderSubtle,
                        width: shapes.strokeWidth,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Flexible(
                          child: Text(
                            selectedExam,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: typography.caption.copyWith(
                              color: colors.textPrimary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        const SizedBox(width: SpacingTokens.xs),
                        AppIcon(
                          LucideGlyph.chevronDown,
                          size: 14,
                          color: colors.textSecondary,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (showSettings && onTapSettings != null)
            IconButton(
              tooltip: 'Settings',
              onPressed: onTapSettings,
              icon: AppIcon(
                LucideGlyph.settings,
                size: 22,
                color: colors.textSecondary,
              ),
            ),
        ],
      ),
    );
  }
}

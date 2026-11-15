import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Top identity area from design.md Sec. 4.1 & 4.3.
/// Features the custom gradient "M" wordmark, product title, compact exam selector pill,
/// and top-right settings button.
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
                  style: typography.headline,
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
            ),
          ],
        ],
      );
    }

    return Row(
      children: <Widget>[
        const MockzaMark(size: 26),
        const SizedBox(width: SpacingTokens.sm),
        Text(
          'Mockza',
          style: typography.cardTitle.copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: -0.4,
          ),
        ),
        const SizedBox(width: SpacingTokens.xs),
        // Exam selector pill
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: InkWell(
              onTap: onTapExamSelector,
              borderRadius: shapes.pillRadius,
              child: Container(
                padding: const EdgeInsets.symmetric(
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
                    Text(
                      selectedExam,
                      style: typography.caption.copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w600,
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
        if (showSettings)
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
    );
  }
}

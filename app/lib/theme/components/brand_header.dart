import 'package:flutter/material.dart';
import 'package:mockza/core/config/brand_identity.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/primitives.dart';
import 'package:mockza/theme/responsive_layout.dart';

/// Top identity area from design.md Sec. 4.1 & 4.3.
/// Features edition-aware brand wordmark ([MockzaMark] / [SanjiaMark]),
/// product title, compact exam selector pill, and top-right settings button
/// with tight-screen (`320dp`) overflow protection.
class BrandHeader extends StatelessWidget {
  /// Creates a [BrandHeader].
  const new({
    this.title,
    this.subtitle,
    this.selectedExam = 'IELTS Academic',
    this.onTapExamSelector,
    this.onTapSettings,
    this.showSettings = true,
    this.edition,
    super.key,
  });

  /// Optional custom page title. If null, displays active edition brand name.
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

  /// Optional edition override (`global` Mockza vs `iran` Sanjia).
  final AppEdition? edition;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);
    final isTight = MzResponsive.isTightPhoneOf(context);
    final isFa = Localizations.maybeLocaleOf(context)?.languageCode == 'fa';
    final resolvedEdition =
        edition ?? (isFa ? AppEdition.iran : AppEdition.global);
    final brandLabel = resolvedEdition == AppEdition.iran
        ? BrandIdentity.iran.localizedName(persian: isFa)
        : (Localizations.of<AppLocalizations>(
                context,
                AppLocalizations,
              )?.appTitle ??
              BrandIdentity.global.brandNameEn);
    final settingsTooltip =
        Localizations.of<AppLocalizations>(
          context,
          AppLocalizations,
        )?.settingsTitle ??
        'Settings';

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
                  tooltip: settingsTooltip,
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
          EditionBrandMark(
            size: isTight ? 24 : 26,
            isIran: resolvedEdition == AppEdition.iran,
          ),
          const SizedBox(width: SpacingTokens.sm),
          if (!isTight) ...<Widget>[
            Text(
              brandLabel,
              style: typography.cardTitle.copyWith(
                fontWeight: FontWeight.w700,
                letterSpacing: isFa ? null : -0.4,
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
                    child: LtrExamBoundary(
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
          ),
          if (showSettings && onTapSettings != null)
            IconButton(
              tooltip: settingsTooltip,
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

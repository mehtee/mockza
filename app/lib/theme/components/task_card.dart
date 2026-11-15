import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/primitives.dart';

/// Practice module or test card (design.md Sec. 5, Screenshots 02 & 03).
class TaskCard extends StatelessWidget {
  /// Creates a [TaskCard].
  const new({
    required this.title,
    required this.subtitle,
    required this.glyph,
    required this.tint,
    this.durationText,
    this.questionsText,
    this.badgeText,
    this.isDownloaded = false,
    this.isDownloading = false,
    this.isProLocked = false,
    this.onTap,
    this.onTapDownload,
    super.key,
  });

  /// Task title (e.g. "IELTS Academic Full Mock", "Task 1 Bar Chart").
  final String title;

  /// Task subtitle / difficulty description.
  final String subtitle;

  /// Leading vector icon.
  final LucideGlyph glyph;

  /// Icon well tint.
  final IconWellTint tint;

  /// Duration readout (e.g. "60 min").
  final String? durationText;

  /// Questions count readout (e.g. "40 Questions").
  final String? questionsText;

  /// Optional highlight badge label (e.g. "Popular", "Pro").
  final String? badgeText;

  /// Whether offline assets are cached locally.
  final bool isDownloaded;

  /// Whether offline pack download is currently running.
  final bool isDownloading;

  /// Whether task requires Pro entitlement.
  final bool isProLocked;

  /// Tap callback opening task setup.
  final VoidCallback? onTap;

  /// Optional callback to download or remove the offline bundle.
  final VoidCallback? onTapDownload;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: SpacingTokens.md),
      child: MzCard(
        onTap: onTap,
        padding: const EdgeInsets.all(SpacingTokens.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Row(
              children: <Widget>[
                IconWell(glyph: glyph, tint: tint),
                const SizedBox(width: SpacingTokens.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: Text(
                              title,
                              style: typography.cardTitle.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (badgeText != null) ...<Widget>[
                            const SizedBox(width: SpacingTokens.sm),
                            MzChip(
                              label: badgeText!,
                              variant: isProLocked
                                  ? MzChipVariant.warning
                                  : MzChipVariant.neutral,
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: SpacingTokens.xs),
                      Text(
                        subtitle,
                        style: typography.secondary.copyWith(
                          color: colors.textSecondary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (durationText != null ||
                questionsText != null ||
                isDownloaded ||
                onTapDownload != null) ...<Widget>[
              const SizedBox(height: SpacingTokens.md),
              Wrap(
                spacing: SpacingTokens.md,
                runSpacing: SpacingTokens.xs,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: <Widget>[
                  if (durationText != null)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        AppIcon(
                          LucideGlyph.timer,
                          size: 14,
                          color: colors.textTertiary,
                        ),
                        const SizedBox(width: SpacingTokens.xs),
                        Text(
                          durationText!,
                          style: typography.caption.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  if (questionsText != null)
                    Text(
                      questionsText!,
                      style: typography.caption.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  if (onTapDownload != null)
                    GestureDetector(
                      onTap: isDownloading ? null : onTapDownload,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          AppIcon(
                            isDownloading
                                ? LucideGlyph.loaderCircle
                                : (isDownloaded
                                      ? LucideGlyph.checkCircle2
                                      : LucideGlyph.download),
                            size: 14,
                            color: isDownloaded
                                ? colors.success
                                : colors.primary,
                          ),
                          const SizedBox(width: SpacingTokens.xs),
                          Text(
                            isDownloading
                                ? 'Downloading...'
                                : (isDownloaded
                                      ? 'Offline Ready'
                                      : 'Save Offline'),
                            style: typography.caption.copyWith(
                              color: isDownloaded
                                  ? colors.success
                                  : colors.primary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    )
                  else if (isDownloaded)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        AppIcon(
                          LucideGlyph.checkCircle2,
                          size: 14,
                          color: colors.success,
                        ),
                        const SizedBox(width: SpacingTokens.xs),
                        Text(
                          'Offline Ready',
                          style: typography.caption.copyWith(
                            color: colors.success,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

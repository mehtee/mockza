import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Semantic status banner variant.
enum StatusBannerVariant {
  /// Confirmed success.
  success,

  /// Warning / attention required.
  warning,

  /// Critical or unrecoverable error.
  error,

  /// Background upload or sync in progress.
  uploading,

  /// Offline mode active.
  offline,
}

/// Inline status notification banner (design.md Sec. 5).
class StatusBanner extends StatelessWidget {
  /// Creates a [StatusBanner].
  const new({
    required this.message,
    this.variant = StatusBannerVariant.warning,
    this.actionLabel,
    this.onTapAction,
    super.key,
  });

  /// Status description text.
  final String message;

  /// Visual severity / mode.
  final StatusBannerVariant variant;

  /// Optional action label (e.g. "Retry", "Connect").
  final String? actionLabel;

  /// Optional action tap callback.
  final VoidCallback? onTapAction;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final (
      LucideGlyph glyph,
      Color inkColor,
      Color bgColor,
    ) = switch (variant) {
      StatusBannerVariant.success => (
        LucideGlyph.checkCircle2,
        colors.success,
        colors.mintBg,
      ),
      StatusBannerVariant.warning => (
        LucideGlyph.alertTriangle,
        colors.warning,
        colors.amberBg,
      ),
      StatusBannerVariant.error => (
        LucideGlyph.alertCircle,
        colors.error,
        colors.dangerBg,
      ),
      StatusBannerVariant.uploading => (
        LucideGlyph.cloudUpload,
        colors.speakingAccent,
        colors.blueBg,
      ),
      StatusBannerVariant.offline => (
        LucideGlyph.download,
        colors.textSecondary,
        colors.surfaceAlt,
      ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: SpacingTokens.md,
        vertical: SpacingTokens.sm,
      ),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: shapes.controlRadius,
        border: Border.all(
          color: inkColor.withValues(alpha: 0.4),
          width: shapes.strokeWidth,
        ),
      ),
      child: Row(
        children: <Widget>[
          AppIcon(glyph, size: 18, color: inkColor),
          const SizedBox(width: SpacingTokens.sm),
          Expanded(
            child: Text(
              message,
              style: typography.caption.copyWith(
                color: colors.textPrimary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          if (actionLabel != null && onTapAction != null) ...<Widget>[
            const SizedBox(width: SpacingTokens.sm),
            InkWell(
              onTap: onTapAction,
              child: Text(
                actionLabel!,
                style: typography.caption.copyWith(
                  color: inkColor,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

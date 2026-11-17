import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_gradients.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Primary CTA button with signature gradient fill (design.md Sec. 2.1 & 5).
/// Enforces minimum 48px tap target and maximum 1 primary CTA per viewport.
class PrimaryButton extends StatelessWidget {
  /// Creates a [PrimaryButton].
  const new({
    required this.label,
    required this.onPressed,
    this.glyph,
    this.trailingGlyph,
    this.isLoading = false,
    this.isFullWidth = true,
    super.key,
  });

  /// Button label text.
  final String label;

  /// Tap callback (null disables button).
  final VoidCallback? onPressed;

  /// Optional leading icon.
  final LucideGlyph? glyph;

  /// Optional trailing icon (e.g. arrowRight).
  final LucideGlyph? trailingGlyph;

  /// Whether button is in loading spinner state.
  final bool isLoading;

  /// Whether button expands to fill parent width.
  final bool isFullWidth;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final gradients = AppGradients.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final isEnabled = onPressed != null && !isLoading;

    final child = Row(
      mainAxisSize: isFullWidth ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: <Widget>[
        if (isLoading) ...<Widget>[
          SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(colors.onPrimary),
            ),
          ),
          const SizedBox(width: SpacingTokens.sm),
        ] else if (glyph != null) ...<Widget>[
          AppIcon(glyph!, size: 18, color: colors.onPrimary),
          const SizedBox(width: SpacingTokens.sm),
        ],
        Flexible(
          child: Text(
            label,
            style: typography.body.copyWith(
              color: isEnabled
                  ? colors.onPrimary
                  : colors.textSecondary.withValues(alpha: 0.6),
              fontWeight: FontWeight.w600,
            ),
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
        ),
        if (trailingGlyph != null && !isLoading) ...<Widget>[
          const SizedBox(width: SpacingTokens.sm),
          AppIcon(trailingGlyph!, size: 18, color: colors.onPrimary),
        ],
      ],
    );

    return Container(
      constraints: const BoxConstraints(
        minHeight: SpacingTokens.minTouchTarget,
      ),
      decoration: BoxDecoration(
        gradient: isEnabled ? gradients.primaryButton : null,
        color: isEnabled ? null : colors.surfaceAlt,
        borderRadius: shapes.controlRadius,
        border: isEnabled
            ? null
            : Border.all(color: colors.borderSubtle, width: shapes.strokeWidth),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isEnabled ? onPressed : null,
          borderRadius: shapes.controlRadius,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: SpacingTokens.lg,
              vertical: SpacingTokens.md,
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}

/// Secondary outlined button with surfaceAlt background (design.md Sec. 5).
class SecondaryButton extends StatelessWidget {
  /// Creates a [SecondaryButton].
  const new({
    required this.label,
    required this.onPressed,
    this.glyph,
    this.isFullWidth = true,
    this.isDestructive = false,
    super.key,
  });

  /// Button label text.
  final String label;

  /// Tap callback (null disables button).
  final VoidCallback? onPressed;

  /// Optional leading icon.
  final LucideGlyph? glyph;

  /// Whether button expands to fill parent width.
  final bool isFullWidth;

  /// Destructive danger styling.
  final bool isDestructive;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final isEnabled = onPressed != null;
    final inkColor = isDestructive
        ? colors.error
        : (isEnabled ? colors.textPrimary : colors.textTertiary);

    return Container(
      constraints: const BoxConstraints(
        minHeight: SpacingTokens.minTouchTarget,
      ),
      decoration: BoxDecoration(
        color: colors.surfaceAlt,
        borderRadius: shapes.controlRadius,
        border: Border.all(
          color: isDestructive
              ? colors.error.withValues(alpha: 0.5)
              : colors.borderSubtle,
          width: shapes.strokeWidth,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: shapes.controlRadius,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: SpacingTokens.lg,
              vertical: SpacingTokens.md,
            ),
            child: Row(
              mainAxisSize: isFullWidth ? MainAxisSize.max : MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                if (glyph != null) ...<Widget>[
                  AppIcon(glyph!, size: 18, color: inkColor),
                  const SizedBox(width: SpacingTokens.sm),
                ],
                Flexible(
                  child: Text(
                    label,
                    style: typography.body.copyWith(
                      color: inkColor,
                      fontWeight: FontWeight.w600,
                    ),
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 48×48 minimum touch target focusable icon button (design.md Sec. 5).
class MzIconButton extends StatelessWidget {
  /// Creates an [MzIconButton].
  const new({
    required this.glyph,
    required this.onPressed,
    required this.semanticLabel,
    this.isDestructive = false,
    this.size = SpacingTokens.minTouchTarget,
    this.iconSize = 22,
    super.key,
  });

  /// Vector icon to render.
  final LucideGlyph glyph;

  /// Tap callback (null disables button).
  final VoidCallback? onPressed;

  /// Required accessibility label for screen readers.
  final String semanticLabel;

  /// Destructive danger styling.
  final bool isDestructive;

  /// Container size (default 48px).
  final double size;

  /// Icon stroke size (default 22px).
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);

    final inkColor = isDestructive
        ? colors.error
        : (onPressed != null ? colors.textSecondary : colors.textTertiary);

    return Semantics(
      label: semanticLabel,
      button: true,
      child: Tooltip(
        message: semanticLabel,
        excludeFromSemantics: true,
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: colors.surfaceAlt,
            borderRadius: shapes.controlRadius,
            border: Border.all(
              color: isDestructive
                  ? colors.error.withValues(alpha: 0.5)
                  : colors.borderSubtle,
              width: shapes.strokeWidth,
            ),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onPressed,
              borderRadius: shapes.controlRadius,
              child: Center(
                child: AppIcon(glyph, size: iconSize, color: inkColor),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

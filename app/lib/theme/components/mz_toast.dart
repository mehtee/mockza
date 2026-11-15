import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Shows an accessible non-blocking toast adhering to design.md Sec. 5.
void showMzToast(
  BuildContext context, {
  required String message,
  LucideGlyph glyph = LucideGlyph.checkCircle2,
  Duration duration = const Duration(seconds: 3),
}) {
  final colors = AppColors.of(context);
  final shapes = AppShapes.of(context);
  final typography = AppTypography.of(context);

  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        duration: duration,
        behavior: SnackBarBehavior.floating,
        backgroundColor: colors.surfaceAlt,
        elevation: 4,
        margin: const EdgeInsets.all(SpacingTokens.lg),
        shape: RoundedRectangleBorder(
          borderRadius: shapes.controlRadius,
          side: BorderSide(
            color: colors.borderSubtle,
            width: shapes.strokeWidth,
          ),
        ),
        content: Row(
          children: <Widget>[
            AppIcon(glyph, size: 18, color: colors.success),
            const SizedBox(width: SpacingTokens.sm),
            Expanded(
              child: Text(
                message,
                style: typography.body.copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
}

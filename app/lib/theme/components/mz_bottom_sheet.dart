import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Shows a standard bottom sheet matching design.md Sec. 4.1 & 5.
Future<T?> showMzBottomSheet<T>({
  required BuildContext context,
  required Widget child,
  String? title,
  bool isScrollControlled = true,
}) {
  final colors = AppColors.of(context);
  final shapes = AppShapes.of(context);
  final typography = AppTypography.of(context);

  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: isScrollControlled,
    backgroundColor: colors.bgRaised,
    barrierColor: const Color(0x99000000),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(
        top: shapes.sheetRadius.topLeft,
      ),
    ),
    builder: (ctx) {
      return SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(ctx).viewInsets.bottom,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              // Grabber handle
              Container(
                margin: const EdgeInsets.only(top: SpacingTokens.sm),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.borderStrong,
                  borderRadius: shapes.pillRadius,
                ),
              ),
              if (title != null) ...<Widget>[
                Padding(
                  padding: const EdgeInsets.all(SpacingTokens.lg),
                  child: Text(
                    title,
                    style: typography.cardTitle.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                Divider(color: colors.borderSubtle, height: 1),
              ],
              Flexible(child: child),
            ],
          ),
        ),
      );
    },
  );
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_buttons.dart';

/// Shared active-session exit confirmation guard (`SRP` / `DIP`).
///
/// Wraps [child] in a [PopScope] that intercepts system/app-bar back navigation
/// when [enabled], presents a themed confirmation dialog, and invokes
/// [onConfirmedExit] only after explicit confirmation.
class ExamExitGuard extends StatelessWidget {
  /// Creates an [ExamExitGuard].
  const new({
    required this.dialogTitle,
    required this.dialogMessage,
    required this.onConfirmedExit,
    required this.child,
    this.cancelLabel = 'Cancel',
    this.confirmLabel = 'Exit',
    this.enabled = true,
    super.key,
  });

  /// Confirmation dialog headline.
  final String dialogTitle;

  /// Confirmation dialog body copy.
  final String dialogMessage;

  /// Callback executed only when the learner confirms leaving.
  final FutureOr<void> Function() onConfirmedExit;

  /// Protected screen content.
  final Widget child;

  /// Label for the dismiss/stay button.
  final String cancelLabel;

  /// Label for the confirm-exit button.
  final String confirmLabel;

  /// Whether back navigation should require confirmation.
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return PopScope(
      canPop: !enabled,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop || !enabled) return;
        final shouldExit = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: colors.surface,
            shape: RoundedRectangleBorder(borderRadius: shapes.cardRadius),
            title: Text(dialogTitle, style: typography.cardTitle),
            content: Text(
              dialogMessage,
              style: typography.body.copyWith(color: colors.textSecondary),
            ),
            actions: <Widget>[
              SecondaryButton(
                label: cancelLabel,
                isFullWidth: false,
                onPressed: () => Navigator.of(ctx).pop(false),
              ),
              PrimaryButton(
                label: confirmLabel,
                isFullWidth: false,
                onPressed: () => Navigator.of(ctx).pop(true),
              ),
            ],
          ),
        );
        if ((shouldExit ?? false) && context.mounted) {
          await onConfirmedExit();
        }
      },
      child: child,
    );
  }
}

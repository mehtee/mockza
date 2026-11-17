import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/primitives.dart';

/// Supported branded social sign-in providers rendered with vector artwork.
enum SocialBrand {
  /// Google "Continue with Google" mark.
  google,

  /// Apple "Continue with Apple" mark.
  apple,
}

/// Accessible full-width social sign-in button with custom vector brand logo.
class SocialAuthButton extends StatelessWidget {
  /// Creates a [SocialAuthButton].
  const new({
    required this.brand,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.showDevBadge = false,
    super.key,
  });

  /// Provider logo to draw.
  final SocialBrand brand;

  /// Accessible button copy (e.g. `Continue with Google`).
  final String label;

  /// Tap callback; `null` disables the control.
  final VoidCallback? onPressed;

  /// Displays a compact loading indicator while authenticating.
  final bool isLoading;

  /// Displays a `DEV SANDBOX` chip when running in development mode without live client secrets.
  final bool showDevBadge;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);
    final disabled = onPressed == null || isLoading;

    return Semantics(
      button: true,
      enabled: !disabled,
      label: label,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 50),
        child: Material(
          color: colors.surface,
          borderRadius: shapes.controlRadius,
          child: InkWell(
            onTap: disabled ? null : onPressed,
            borderRadius: shapes.controlRadius,
            child: Container(
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: SpacingTokens.md,
                vertical: SpacingTokens.sm,
              ),
              decoration: BoxDecoration(
                borderRadius: shapes.controlRadius,
                border: Border.all(
                  color: disabled ? colors.borderSubtle : colors.borderStrong,
                  width: shapes.strokeWidth,
                ),
              ),
              child: Row(
                children: <Widget>[
                  SizedBox(
                    width: 22,
                    height: 22,
                    child: isLoading
                        ? Padding(
                            padding: const EdgeInsetsDirectional.all(2),
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: colors.primary,
                            ),
                          )
                        : CustomPaint(
                            painter: brand == SocialBrand.google
                                ? const _GoogleMarkPainter()
                                : _AppleMarkPainter(color: colors.textPrimary),
                          ),
                  ),
                  const SizedBox(width: SpacingTokens.md),
                  Expanded(
                    child: Text(
                      label,
                      style: typography.body.copyWith(
                        color: disabled
                            ? colors.textTertiary
                            : colors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (showDevBadge) const MzChip(label: 'DEV'),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _GoogleMarkPainter extends CustomPainter {
  const new();

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width * 0.36;
    final stroke = size.width * 0.19;
    final rect = Rect.fromCircle(center: center, radius: radius);

    void arc(Color color, double startDeg, double sweepDeg) {
      final paint = Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.butt;
      canvas.drawArc(
        rect,
        startDeg * math.pi / 180,
        sweepDeg * math.pi / 180,
        false,
        paint,
      );
    }

    arc(const Color(0xFFEA4335), -145, 95);
    arc(const Color(0xFFFBBC05), 145, 70);
    arc(const Color(0xFF34A853), 40, 105);
    arc(const Color(0xFF4285F4), -10, 52);

    final barPaint = Paint()
      ..color = const Color(0xFF4285F4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.square;
    canvas.drawLine(
      Offset(center.dx, center.dy + stroke * 0.05),
      Offset(center.dx + radius + stroke * 0.28, center.dy + stroke * 0.05),
      barPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _GoogleMarkPainter oldDelegate) => false;
}

class _AppleMarkPainter extends CustomPainter {
  const new({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    // Stylized silhouette leaf + body centered in optical square.
    final leaf = Path()
      ..moveTo(w * 0.52, h * 0.28)
      ..cubicTo(w * 0.51, h * 0.14, w * 0.62, h * 0.06, w * 0.72, h * 0.07)
      ..cubicTo(w * 0.73, h * 0.19, w * 0.63, h * 0.28, w * 0.52, h * 0.28)
      ..close();
    canvas.drawPath(leaf, paint);

    final body = Path()
      ..moveTo(w * 0.80, h * 0.65)
      ..cubicTo(w * 0.77, h * 0.78, w * 0.69, h * 0.91, w * 0.61, h * 0.91)
      ..cubicTo(w * 0.56, h * 0.91, w * 0.53, h * 0.88, w * 0.48, h * 0.88)
      ..cubicTo(w * 0.43, h * 0.88, w * 0.40, h * 0.91, w * 0.35, h * 0.91)
      ..cubicTo(w * 0.26, h * 0.91, w * 0.16, h * 0.74, w * 0.16, h * 0.55)
      ..cubicTo(w * 0.16, h * 0.37, w * 0.27, h * 0.28, w * 0.38, h * 0.28)
      ..cubicTo(w * 0.44, h * 0.28, w * 0.48, h * 0.31, w * 0.51, h * 0.31)
      ..cubicTo(w * 0.54, h * 0.31, w * 0.59, h * 0.28, w * 0.66, h * 0.28)
      ..cubicTo(w * 0.74, h * 0.28, w * 0.81, h * 0.32, w * 0.84, h * 0.39)
      ..cubicTo(w * 0.69, h * 0.47, w * 0.71, h * 0.61, w * 0.80, h * 0.65)
      ..close();
    canvas.drawPath(body, paint);
  }

  @override
  bool shouldRepaint(covariant _AppleMarkPainter oldDelegate) =>
      oldDelegate.color != color;
}

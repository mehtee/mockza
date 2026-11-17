// Path drawing in CustomPainter uses sequential commands rather than cascades.
// ignore_for_file: cascade_invocations

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:mockza/theme/app_gradients.dart';
import 'package:mockza/theme/primitives.dart';

/// Supported vector icon identifiers matching design.md Sec. 3 Lucide family.
enum LucideGlyph {
  /// House navigation glyph.
  house,

  /// Circle play navigation glyph.
  circlePlay,

  /// Layers 3 navigation glyph.
  layers3,

  /// Increasing chart navigation glyph.
  chartIncreasing,

  /// Settings gear glyph.
  settings,

  /// Chevron down dropdown arrow.
  chevronDown,

  /// Chevron right navigation arrow.
  chevronRight,

  /// Chevron left navigation arrow.
  chevronLeft,

  /// Chevron up expand/collapse glyph.
  chevronUp,

  /// Minus decrement glyph.
  minus,

  /// Plus increment glyph.
  plus,

  /// Unselected radio circle glyph.
  circle,

  /// Selected radio circle dot glyph.
  circleDot,

  /// Eye visibility show glyph.
  eye,

  /// Eye-off visibility hide glyph.
  eyeOff,

  /// Sliders configuration glyph.
  slidersHorizontal,

  /// Target bullseye glyph.
  target,

  /// Microphone input glyph.
  mic,

  /// Muted microphone glyph.
  micOff,

  /// Pencil writing glyph.
  pencil,

  /// Book open reading glyph.
  bookOpen,

  /// Headphones listening glyph.
  headphones,

  /// Audio lines waveform glyph.
  audioLines,

  /// Arrow right CTA glyph.
  arrowRight,

  /// Arrow left back glyph.
  arrowLeft,

  /// Trending up score improvement glyph.
  trendingUp,

  /// Flame study streak glyph.
  flame,

  /// Checkmark glyph.
  check,

  /// Circle checkmark completion glyph.
  checkCircle2,

  /// Calendar days test date glyph.
  calendarDays,

  /// Stopwatch timer glyph.
  timer,

  /// Counter-clockwise replay glyph.
  rotateCcw,

  /// Bookmark plus save phrase glyph.
  bookmarkPlus,

  /// Download asset glyph.
  download,

  /// Cloud upload evaluation glyph.
  cloudUpload,

  /// Loading spinner glyph.
  loaderCircle,

  /// Refresh cycle retry glyph.
  refreshCw,

  /// Pause control glyph.
  pause,

  /// Play control glyph.
  play,

  /// Close / dismiss glyph.
  x,

  /// Information glyph.
  info,

  /// Shield check privacy glyph.
  shieldCheck,

  /// Git compare arrows glyph.
  gitCompare,

  /// Alert circle error glyph.
  alertCircle,

  /// Alert triangle warning glyph.
  alertTriangle,

  /// Volume audio speaker glyph.
  volume2,

  /// Sparkles AI recommendation glyph.
  sparkles,

  /// Search magnifying glass glyph.
  search,

  /// Filter funnel glyph.
  filter,

  /// Trash can delete glyph.
  trash2,
}

/// Lightweight, dependency-free vector icon widget rendering Lucide glyphs
/// with 2.0px stroke and round caps/joins in a 24px optical box (design.md Sec. 3).
class AppIcon extends StatelessWidget {
  /// Creates an [AppIcon].
  const new(
    this.glyph, {
    this.size = 24,
    this.color,
    this.semanticLabel,
    super.key,
  });

  /// The vector glyph to render.
  final LucideGlyph glyph;

  /// The box dimension in logical pixels (default 24).
  final double size;

  /// The stroke ink color.
  final Color? color;

  /// Screen reader label for accessibility.
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final effectiveColor =
        color ?? IconTheme.of(context).color ?? PalettePrimitives.darkText;

    final iconWidget = SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _LucidePainter(glyph: glyph, color: effectiveColor),
      ),
    );

    if (semanticLabel != null && semanticLabel!.isNotEmpty) {
      return Semantics(
        label: semanticLabel,
        image: true,
        child: iconWidget,
      );
    }
    return iconWidget;
  }
}

/// Signature Mockza gradient "M" brand mark (design.md Sec. 3).
class MockzaMark extends StatelessWidget {
  /// Creates a [MockzaMark].
  const new({this.size = 28, super.key});

  /// Box dimension (default 28).
  final double size;

  @override
  Widget build(BuildContext context) {
    final gradients = AppGradients.of(context);
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        painter: _MockzaMarkPainter(gradient: gradients.primaryButton),
      ),
    );
  }
}

class _MockzaMarkPainter extends CustomPainter {
  const new({required this.gradient});

  final Gradient gradient;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final paint = Paint()
      ..shader = gradient.createShader(rect)
      ..style = PaintingStyle.fill;

    // Smooth rounded "M" logo geometry
    final path = Path();
    final w = size.width;
    final h = size.height;

    // Draw stylized dynamic "M" mark
    path.moveTo(w * 0.12, h * 0.88);
    path.lineTo(w * 0.12, h * 0.22);
    path.cubicTo(w * 0.12, h * 0.15, w * 0.20, h * 0.12, w * 0.26, h * 0.18);
    path.lineTo(w * 0.50, h * 0.52);
    path.lineTo(w * 0.74, h * 0.18);
    path.cubicTo(w * 0.80, h * 0.12, w * 0.88, h * 0.15, w * 0.88, h * 0.22);
    path.lineTo(w * 0.88, h * 0.88);
    path.cubicTo(w * 0.88, h * 0.94, w * 0.82, h * 0.98, w * 0.76, h * 0.94);
    path.lineTo(w * 0.76, h * 0.38);
    path.lineTo(w * 0.54, h * 0.68);
    path.cubicTo(w * 0.52, h * 0.71, w * 0.48, h * 0.71, w * 0.46, h * 0.68);
    path.lineTo(w * 0.24, h * 0.38);
    path.lineTo(w * 0.24, h * 0.94);
    path.cubicTo(w * 0.18, h * 0.98, w * 0.12, h * 0.94, w * 0.12, h * 0.88);
    path.close();

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _MockzaMarkPainter oldDelegate) =>
      oldDelegate.gradient != gradient;
}

class _LucidePainter extends CustomPainter {
  const new({required this.glyph, required this.color});

  final LucideGlyph glyph;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final strokeWidth = size.width * (2.0 / 24.0);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final fillPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    // Scale canvas from 24x24 coordinate space
    canvas.save();
    canvas.scale(size.width / 24.0, size.height / 24.0);

    _drawGlyph(canvas, glyph, paint, fillPaint);

    canvas.restore();
  }

  void _drawGlyph(
    Canvas canvas,
    LucideGlyph glyph,
    Paint stroke,
    Paint fill,
  ) {
    final path = Path();
    switch (glyph) {
      case LucideGlyph.house:
        path.moveTo(3, 10);
        path.lineTo(12, 2.5);
        path.lineTo(21, 10);
        path.lineTo(21, 20);
        path.cubicTo(21, 20.55, 20.55, 21, 20, 21);
        path.lineTo(4, 21);
        path.cubicTo(3.45, 21, 3, 20.55, 3, 20);
        path.close();
        path.moveTo(9, 21);
        path.lineTo(9, 13);
        path.cubicTo(9, 12.45, 9.45, 12, 10, 12);
        path.lineTo(14, 12);
        path.cubicTo(14.55, 12, 15, 12.45, 15, 13);
        path.lineTo(15, 21);
        canvas.drawPath(path, stroke);

      case LucideGlyph.circlePlay:
        canvas.drawCircle(const Offset(12, 12), 10, stroke);
        final tri = Path()
          ..moveTo(10, 8)
          ..lineTo(16, 12)
          ..lineTo(10, 16)
          ..close();
        canvas.drawPath(tri, stroke);

      case LucideGlyph.layers3:
        path.moveTo(12, 2);
        path.lineTo(2, 7);
        path.lineTo(12, 12);
        path.lineTo(22, 7);
        path.close();
        path.moveTo(2, 12);
        path.lineTo(12, 17);
        path.lineTo(22, 12);
        path.moveTo(2, 17);
        path.lineTo(12, 22);
        path.lineTo(22, 17);
        canvas.drawPath(path, stroke);

      case LucideGlyph.chartIncreasing:
        path.moveTo(3, 3);
        path.lineTo(3, 21);
        path.lineTo(21, 21);
        path.moveTo(7, 16);
        path.lineTo(11, 11);
        path.lineTo(15, 15);
        path.lineTo(21, 7);
        path.moveTo(16, 7);
        path.lineTo(21, 7);
        path.lineTo(21, 12);
        canvas.drawPath(path, stroke);

      case LucideGlyph.settings:
        canvas.drawCircle(const Offset(12, 12), 3, stroke);
        path.moveTo(19.4, 15);
        path.lineTo(20.4, 13.3);
        path.lineTo(18.9, 10.7);
        path.lineTo(17.1, 11.2);
        path.lineTo(15.7, 9.8);
        path.lineTo(16.2, 8);
        path.lineTo(13.6, 6.5);
        path.lineTo(12, 7.5);
        path.lineTo(10.4, 6.5);
        path.lineTo(7.8, 8);
        path.lineTo(8.3, 9.8);
        path.lineTo(6.9, 11.2);
        path.lineTo(5.1, 10.7);
        path.lineTo(3.6, 13.3);
        path.lineTo(4.6, 15);
        path.lineTo(3.6, 16.7);
        path.lineTo(5.1, 19.3);
        path.lineTo(6.9, 18.8);
        path.lineTo(8.3, 20.2);
        path.lineTo(7.8, 22);
        path.lineTo(10.4, 23.5);
        path.lineTo(12, 22.5);
        path.lineTo(13.6, 23.5);
        path.lineTo(16.2, 22);
        path.lineTo(15.7, 20.2);
        path.lineTo(17.1, 18.8);
        path.lineTo(18.9, 19.3);
        path.lineTo(20.4, 16.7);
        path.close();
        canvas.drawPath(path, stroke);

      case LucideGlyph.chevronDown:
        path.moveTo(6, 9);
        path.lineTo(12, 15);
        path.lineTo(18, 9);
        canvas.drawPath(path, stroke);

      case LucideGlyph.chevronRight:
        path.moveTo(9, 18);
        path.lineTo(15, 12);
        path.lineTo(9, 6);
        canvas.drawPath(path, stroke);

      case LucideGlyph.chevronLeft:
        path.moveTo(15, 18);
        path.lineTo(9, 12);
        path.lineTo(15, 6);
        canvas.drawPath(path, stroke);

      case LucideGlyph.target:
        canvas.drawCircle(const Offset(12, 12), 10, stroke);
        canvas.drawCircle(const Offset(12, 12), 6, stroke);
        canvas.drawCircle(const Offset(12, 12), 2, fill);

      case LucideGlyph.mic:
        path.addRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(8, 2, 8, 12),
            const Radius.circular(4),
          ),
        );
        path.moveTo(5, 10);
        path.cubicTo(5, 14, 8, 17, 12, 17);
        path.cubicTo(16, 17, 19, 14, 19, 10);
        path.moveTo(12, 17);
        path.lineTo(12, 22);
        path.moveTo(8, 22);
        path.lineTo(16, 22);
        canvas.drawPath(path, stroke);

      case LucideGlyph.micOff:
        path.moveTo(2, 2);
        path.lineTo(22, 22);
        path.moveTo(9, 9);
        path.lineTo(9, 10);
        path.cubicTo(9, 11.66, 10.34, 13, 12, 13);
        path.moveTo(15, 9.34);
        path.lineTo(15, 5);
        path.cubicTo(15, 3.34, 13.66, 2, 12, 2);
        path.cubicTo(10.34, 2, 9, 3.34, 9, 5);
        path.moveTo(5, 10);
        path.cubicTo(5, 13.5, 7.5, 16.5, 11, 16.9);
        path.moveTo(12, 17);
        path.lineTo(12, 22);
        canvas.drawPath(path, stroke);

      case LucideGlyph.pencil:
        path.moveTo(18, 2);
        path.lineTo(22, 6);
        path.lineTo(7.5, 20.5);
        path.lineTo(2, 22);
        path.lineTo(3.5, 16.5);
        path.close();
        canvas.drawPath(path, stroke);

      case LucideGlyph.bookOpen:
        path.moveTo(2, 4);
        path.cubicTo(5.5, 3, 9, 4, 12, 6);
        path.cubicTo(15, 4, 18.5, 3, 22, 4);
        path.lineTo(22, 19);
        path.cubicTo(18.5, 18, 15, 19, 12, 21);
        path.cubicTo(9, 19, 5.5, 18, 2, 19);
        path.close();
        path.moveTo(12, 6);
        path.lineTo(12, 21);
        canvas.drawPath(path, stroke);

      case LucideGlyph.headphones:
        path.moveTo(3, 14);
        path.cubicTo(3, 7.9, 7, 3, 12, 3);
        path.cubicTo(17, 3, 21, 7.9, 21, 14);
        path.moveTo(3, 14);
        path.lineTo(3, 19);
        path.cubicTo(3, 20.1, 3.9, 21, 5, 21);
        path.lineTo(6, 21);
        path.cubicTo(7.1, 21, 8, 20.1, 8, 19);
        path.lineTo(8, 14);
        path.cubicTo(8, 12.9, 7.1, 12, 6, 12);
        path.lineTo(4, 12);
        path.moveTo(21, 14);
        path.lineTo(21, 19);
        path.cubicTo(21, 20.1, 20.1, 21, 19, 21);
        path.lineTo(18, 21);
        path.cubicTo(16.9, 21, 16, 20.1, 16, 19);
        path.lineTo(16, 14);
        path.cubicTo(16, 12.9, 16.9, 12, 18, 12);
        path.lineTo(20, 12);
        canvas.drawPath(path, stroke);

      case LucideGlyph.audioLines:
        path.moveTo(2, 10);
        path.lineTo(2, 14);
        path.moveTo(6, 6);
        path.lineTo(6, 18);
        path.moveTo(10, 3);
        path.lineTo(10, 21);
        path.moveTo(14, 8);
        path.lineTo(14, 16);
        path.moveTo(18, 5);
        path.lineTo(18, 19);
        path.moveTo(22, 10);
        path.lineTo(22, 14);
        canvas.drawPath(path, stroke);

      case LucideGlyph.arrowRight:
        path.moveTo(5, 12);
        path.lineTo(19, 12);
        path.moveTo(12, 5);
        path.lineTo(19, 12);
        path.lineTo(12, 19);
        canvas.drawPath(path, stroke);

      case LucideGlyph.arrowLeft:
        path.moveTo(19, 12);
        path.lineTo(5, 12);
        path.moveTo(12, 19);
        path.lineTo(5, 12);
        path.lineTo(12, 5);
        canvas.drawPath(path, stroke);

      case LucideGlyph.trendingUp:
        path.moveTo(22, 7);
        path.lineTo(13.5, 15.5);
        path.lineTo(8.5, 10.5);
        path.lineTo(2, 17);
        path.moveTo(16, 7);
        path.lineTo(22, 7);
        path.lineTo(22, 13);
        canvas.drawPath(path, stroke);

      case LucideGlyph.flame:
        path.moveTo(8.5, 14.5);
        path.cubicTo(8.5, 12, 10, 10, 11, 8);
        path.cubicTo(11, 6, 9.5, 4.5, 8, 3);
        path.cubicTo(8, 7, 5, 9, 5, 13.5);
        path.cubicTo(5, 17.5, 8, 21, 12, 21);
        path.cubicTo(16, 21, 19, 17.5, 19, 13.5);
        path.cubicTo(19, 9, 16, 7, 15, 6);
        path.cubicTo(15, 8.5, 13, 10.5, 12, 12);
        canvas.drawPath(path, stroke);

      case LucideGlyph.check:
        path.moveTo(20, 6);
        path.lineTo(9, 17);
        path.lineTo(4, 12);
        canvas.drawPath(path, stroke);

      case LucideGlyph.checkCircle2:
        canvas.drawCircle(const Offset(12, 12), 10, stroke);
        path.moveTo(8, 12);
        path.lineTo(11, 15);
        path.lineTo(16, 9);
        canvas.drawPath(path, stroke);

      case LucideGlyph.calendarDays:
        path.addRRect(
          RRect.fromRectAndRadius(
            const Rect.fromLTWH(3, 4, 18, 18),
            const Radius.circular(2),
          ),
        );
        path.moveTo(16, 2);
        path.lineTo(16, 6);
        path.moveTo(8, 2);
        path.lineTo(8, 6);
        path.moveTo(3, 10);
        path.lineTo(21, 10);
        path.moveTo(8, 14);
        path.lineTo(8, 14.01);
        path.moveTo(12, 14);
        path.lineTo(12, 14.01);
        path.moveTo(16, 14);
        path.lineTo(16, 14.01);
        path.moveTo(8, 18);
        path.lineTo(8, 18.01);
        path.moveTo(12, 18);
        path.lineTo(12, 18.01);
        canvas.drawPath(path, stroke);

      case LucideGlyph.timer:
        canvas.drawCircle(const Offset(12, 13), 9, stroke);
        path.moveTo(12, 1);
        path.lineTo(12, 4);
        path.moveTo(12, 9);
        path.lineTo(12, 13);
        path.lineTo(15, 13);
        canvas.drawPath(path, stroke);

      case LucideGlyph.rotateCcw:
        path.moveTo(3, 12);
        path.cubicTo(3, 7, 7, 3, 12, 3);
        path.cubicTo(16.5, 3, 20.3, 6.5, 21, 11);
        path.moveTo(3, 5);
        path.lineTo(3, 12);
        path.lineTo(10, 12);
        canvas.drawPath(path, stroke);

      case LucideGlyph.bookmarkPlus:
        path.moveTo(19, 21);
        path.lineTo(12, 16);
        path.lineTo(5, 21);
        path.lineTo(5, 5);
        path.cubicTo(5, 3.9, 5.9, 3, 7, 3);
        path.lineTo(17, 3);
        path.cubicTo(18.1, 3, 19, 3.9, 19, 5);
        path.close();
        path.moveTo(12, 7);
        path.lineTo(12, 13);
        path.moveTo(9, 10);
        path.lineTo(15, 10);
        canvas.drawPath(path, stroke);

      case LucideGlyph.download:
        path.moveTo(21, 15);
        path.lineTo(21, 19);
        path.cubicTo(21, 20.1, 20.1, 21, 19, 21);
        path.lineTo(5, 21);
        path.cubicTo(3.9, 21, 3, 20.1, 3, 19);
        path.lineTo(3, 15);
        path.moveTo(7, 10);
        path.lineTo(12, 15);
        path.lineTo(17, 10);
        path.moveTo(12, 15);
        path.lineTo(12, 3);
        canvas.drawPath(path, stroke);

      case LucideGlyph.cloudUpload:
        path.moveTo(4, 14.899);
        path.cubicTo(2.8, 14.3, 2, 13, 2, 11.5);
        path.cubicTo(2, 9.6, 3.5, 8, 5.5, 8);
        path.cubicTo(5.9, 5.7, 7.9, 4, 10.3, 4);
        path.cubicTo(13.1, 4, 15.3, 6, 15.6, 8.8);
        path.cubicTo(17.6, 9.1, 19.1, 10.8, 19.1, 12.8);
        path.cubicTo(19.1, 15.1, 17.2, 17, 14.9, 17);
        path.lineTo(14, 17);
        path.moveTo(12, 12);
        path.lineTo(12, 21);
        path.moveTo(8, 16);
        path.lineTo(12, 12);
        path.lineTo(16, 16);
        canvas.drawPath(path, stroke);

      case LucideGlyph.loaderCircle:
        path.addArc(const Rect.fromLTWH(2, 2, 20, 20), 0, math.pi * 1.5);
        canvas.drawPath(path, stroke);

      case LucideGlyph.refreshCw:
        path.moveTo(21, 12);
        path.cubicTo(21, 17, 17, 21, 12, 21);
        path.cubicTo(8.5, 21, 5.5, 19, 4, 16);
        path.moveTo(21, 3);
        path.lineTo(21, 10);
        path.lineTo(14, 10);
        path.moveTo(3, 12);
        path.cubicTo(3, 7, 7, 3, 12, 3);
        path.cubicTo(15.5, 3, 18.5, 5, 20, 8);
        path.moveTo(3, 21);
        path.lineTo(3, 14);
        path.lineTo(10, 14);
        canvas.drawPath(path, stroke);

      case LucideGlyph.pause:
        path.moveTo(7, 5);
        path.lineTo(7, 19);
        path.moveTo(17, 5);
        path.lineTo(17, 19);
        canvas.drawPath(path, stroke);

      case LucideGlyph.play:
        path.moveTo(6, 4);
        path.lineTo(20, 12);
        path.lineTo(6, 20);
        path.close();
        canvas.drawPath(path, stroke);

      case LucideGlyph.x:
        path.moveTo(18, 6);
        path.lineTo(6, 18);
        path.moveTo(6, 6);
        path.lineTo(18, 18);
        canvas.drawPath(path, stroke);

      case LucideGlyph.info:
        canvas.drawCircle(const Offset(12, 12), 10, stroke);
        path.moveTo(12, 16);
        path.lineTo(12, 12);
        path.moveTo(12, 8);
        path.lineTo(12, 8.01);
        canvas.drawPath(path, stroke);

      case LucideGlyph.shieldCheck:
        path.moveTo(12, 2);
        path.lineTo(20, 5);
        path.lineTo(20, 11);
        path.cubicTo(20, 16.5, 16.5, 21.5, 12, 22.5);
        path.cubicTo(7.5, 21.5, 4, 16.5, 4, 11);
        path.lineTo(4, 5);
        path.close();
        path.moveTo(9, 12);
        path.lineTo(11, 14);
        path.lineTo(15, 10);
        canvas.drawPath(path, stroke);

      case LucideGlyph.gitCompare:
        canvas.drawCircle(const Offset(6, 6), 3, stroke);
        canvas.drawCircle(const Offset(18, 18), 3, stroke);
        path.moveTo(6, 9);
        path.lineTo(6, 18);
        path.cubicTo(6, 19.1, 6.9, 20, 8, 20);
        path.lineTo(15, 20);
        path.moveTo(18, 15);
        path.lineTo(18, 6);
        path.cubicTo(18, 4.9, 17.1, 4, 16, 4);
        path.lineTo(9, 4);
        canvas.drawPath(path, stroke);

      case LucideGlyph.alertCircle:
        canvas.drawCircle(const Offset(12, 12), 10, stroke);
        path.moveTo(12, 8);
        path.lineTo(12, 12);
        path.moveTo(12, 16);
        path.lineTo(12, 16.01);
        canvas.drawPath(path, stroke);

      case LucideGlyph.alertTriangle:
        path.moveTo(12, 3);
        path.lineTo(22, 20);
        path.lineTo(2, 20);
        path.close();
        path.moveTo(12, 9);
        path.lineTo(12, 13);
        path.moveTo(12, 17);
        path.lineTo(12, 17.01);
        canvas.drawPath(path, stroke);

      case LucideGlyph.volume2:
        path.moveTo(11, 5);
        path.lineTo(6, 9);
        path.lineTo(2, 9);
        path.lineTo(2, 15);
        path.lineTo(6, 15);
        path.lineTo(11, 19);
        path.close();
        path.moveTo(15.54, 8.46);
        path.cubicTo(16.5, 9.4, 17, 10.6, 17, 12);
        path.cubicTo(17, 13.4, 16.5, 14.6, 15.54, 15.54);
        path.moveTo(19.07, 4.93);
        path.cubicTo(20.94, 6.8, 22, 9.3, 22, 12);
        path.cubicTo(22, 14.7, 20.94, 17.2, 19.07, 19.07);
        canvas.drawPath(path, stroke);

      case LucideGlyph.sparkles:
        path.moveTo(12, 3);
        path.lineTo(14, 9);
        path.lineTo(20, 11);
        path.lineTo(14, 13);
        path.lineTo(12, 19);
        path.lineTo(10, 13);
        path.lineTo(4, 11);
        path.lineTo(10, 9);
        path.close();
        canvas.drawPath(path, stroke);

      case LucideGlyph.search:
        canvas.drawCircle(const Offset(11, 11), 8, stroke);
        path.moveTo(21, 21);
        path.lineTo(16.65, 16.65);
        canvas.drawPath(path, stroke);

      case LucideGlyph.filter:
        path.moveTo(22, 3);
        path.lineTo(2, 3);
        path.lineTo(10, 12.46);
        path.lineTo(10, 19);
        path.lineTo(14, 21);
        path.lineTo(14, 12.46);
        path.close();
        canvas.drawPath(path, stroke);

      case LucideGlyph.trash2:
        path.moveTo(3, 6);
        path.lineTo(21, 6);
        path.moveTo(19, 6);
        path.lineTo(18, 20);
        path.cubicTo(18, 20.55, 17.55, 21, 17, 21);
        path.lineTo(7, 21);
        path.cubicTo(6.45, 21, 6, 20.55, 6, 20);
        path.lineTo(5, 6);
        path.moveTo(10, 11);
        path.lineTo(10, 17);
        path.moveTo(14, 11);
        path.lineTo(14, 17);
        path.moveTo(9, 6);
        path.lineTo(9, 4);
        path.cubicTo(9, 3.45, 9.45, 3, 10, 3);
        path.lineTo(14, 3);
        path.cubicTo(14.55, 3, 15, 3.45, 15, 4);
        path.lineTo(15, 6);
        canvas.drawPath(path, stroke);

      case LucideGlyph.chevronUp:
        path.moveTo(18, 15);
        path.lineTo(12, 9);
        path.lineTo(6, 15);
        canvas.drawPath(path, stroke);

      case LucideGlyph.minus:
        path.moveTo(5, 12);
        path.lineTo(19, 12);
        canvas.drawPath(path, stroke);

      case LucideGlyph.plus:
        path.moveTo(5, 12);
        path.lineTo(19, 12);
        path.moveTo(12, 5);
        path.lineTo(12, 19);
        canvas.drawPath(path, stroke);

      case LucideGlyph.circle:
        canvas.drawCircle(const Offset(12, 12), 9, stroke);

      case LucideGlyph.circleDot:
        canvas.drawCircle(const Offset(12, 12), 9, stroke);
        final fill = Paint()
          ..color = color
          ..style = PaintingStyle.fill;
        canvas.drawCircle(const Offset(12, 12), 4, fill);

      case LucideGlyph.eye:
        path.moveTo(2, 12);
        path.cubicTo(5, 6.5, 8.5, 5, 12, 5);
        path.cubicTo(15.5, 5, 19, 6.5, 22, 12);
        path.cubicTo(19, 17.5, 15.5, 19, 12, 19);
        path.cubicTo(8.5, 19, 5, 17.5, 2, 12);
        path.close();
        canvas.drawPath(path, stroke);
        canvas.drawCircle(const Offset(12, 12), 3, stroke);

      case LucideGlyph.eyeOff:
        path.moveTo(9.88, 9.88);
        path.cubicTo(9.3, 10.45, 9, 11.2, 9, 12);
        path.cubicTo(9, 13.66, 10.34, 15, 12, 15);
        path.cubicTo(12.8, 15, 13.55, 14.7, 14.12, 14.12);
        path.moveTo(10.73, 5.08);
        path.cubicTo(11.15, 5.03, 11.57, 5, 12, 5);
        path.cubicTo(17, 5, 20.3, 8.3, 22, 12);
        path.cubicTo(21.4, 13.3, 20.6, 14.6, 19.6, 15.7);
        path.moveTo(6.6, 6.6);
        path.cubicTo(4.6, 7.9, 3, 9.8, 2, 12);
        path.cubicTo(3.7, 15.7, 7, 19, 12, 19);
        path.cubicTo(13.8, 19, 15.4, 18.5, 16.8, 17.7);
        path.moveTo(2, 2);
        path.lineTo(22, 22);
        canvas.drawPath(path, stroke);

      case LucideGlyph.slidersHorizontal:
        path.moveTo(21, 4);
        path.lineTo(14, 4);
        path.moveTo(10, 4);
        path.lineTo(3, 4);
        path.moveTo(21, 12);
        path.lineTo(12, 12);
        path.moveTo(8, 12);
        path.lineTo(3, 12);
        path.moveTo(21, 20);
        path.lineTo(16, 20);
        path.moveTo(12, 20);
        path.lineTo(3, 20);
        path.moveTo(14, 2);
        path.lineTo(14, 6);
        path.moveTo(8, 10);
        path.lineTo(8, 14);
        path.moveTo(16, 18);
        path.lineTo(16, 22);
        canvas.drawPath(path, stroke);
    }
  }

  @override
  bool shouldRepaint(covariant _LucidePainter oldDelegate) =>
      oldDelegate.glyph != glyph || oldDelegate.color != color;
}

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_typography.dart';

/// Single point in [TrendChart].
class ScoreTrendPoint {
  /// Creates a [ScoreTrendPoint].
  const new({
    required this.dateLabel,
    required this.score,
    required this.timestampUtcMs,
    this.isCalibrated = true,
  });

  /// Short date label (e.g. "Oct 12").
  final String dateLabel;

  /// Band score value (e.g. 6.5).
  final double score;

  /// UTC millisecond timestamp for ordering.
  final int timestampUtcMs;

  /// Whether this point came from a calibrated full/section evaluation (`true`)
  /// or a provisional baseline / study attempt (`false`).
  final bool isCalibrated;
}

/// Accessible low-ink score trend chart (design.md Sec. 5, Screenshot 20).
class TrendChart extends StatelessWidget {
  /// Creates a [TrendChart].
  const new({
    required this.points,
    this.targetScore = 7.5,
    this.minScore = 4.0,
    this.maxScore = 9.0,
    this.height = 160,
    super.key,
  });

  /// Historical score trend points.
  final List<ScoreTrendPoint> points;

  /// Target band line.
  final double targetScore;

  /// Vertical scale floor.
  final double minScore;

  /// Vertical scale ceiling.
  final double maxScore;

  /// Total chart height in logical pixels.
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    if (points.isEmpty) {
      return SizedBox(
        height: height,
        child: Center(
          child: Text(
            'Complete your first practice attempt to see score trends.',
            style: typography.caption.copyWith(color: colors.textTertiary),
          ),
        ),
      );
    }

    final summary = points
        .map(
          (p) =>
              '${p.dateLabel}: ${p.score} (${p.isCalibrated ? 'Calibrated' : 'Provisional'})',
        )
        .join(', ');

    return Semantics(
      label: 'Score trend history. Target: $targetScore. Data points: $summary',
      child: SizedBox(
        height: height,
        child: CustomPaint(
          size: Size.infinite,
          painter: _TrendChartPainter(
            points: points,
            targetScore: targetScore,
            minScore: minScore,
            maxScore: maxScore,
            lineColor: colors.primary,
            targetLineColor: colors.textTertiary.withValues(alpha: 0.5),
            pointFillColor: colors.surface,
            gridColor: colors.borderSubtle,
            axisLabelColor: colors.textTertiary,
          ),
        ),
      ),
    );
  }
}

class _TrendChartPainter extends CustomPainter {
  const new({
    required this.points,
    required this.targetScore,
    required this.minScore,
    required this.maxScore,
    required this.lineColor,
    required this.targetLineColor,
    required this.pointFillColor,
    required this.gridColor,
    required this.axisLabelColor,
  });

  final List<ScoreTrendPoint> points;
  final double targetScore;
  final double minScore;
  final double maxScore;
  final Color lineColor;
  final Color targetLineColor;
  final Color pointFillColor;
  final Color gridColor;
  final Color axisLabelColor;

  @override
  void paint(Canvas canvas, Size size) {
    const leftPadding = 28.0;
    const rightPadding = 8.0;
    const bottomPadding = 22.0;
    const topPadding = 12.0;
    final chartHeight = size.height - bottomPadding - topPadding;
    final chartWidth = size.width - leftPadding - rightPadding;

    final range = maxScore - minScore;
    if (range <= 0 || chartWidth <= 0) return;

    double getY(double score) {
      final fraction = ((score - minScore) / range).clamp(0.0, 1.0);
      return size.height - bottomPadding - (fraction * chartHeight);
    }

    void drawLabel(
      String text,
      Offset offset, {
      TextAlign align = TextAlign.left,
    }) {
      TextPainter(
          text: TextSpan(
            text: text,
            style: TextStyle(color: axisLabelColor, fontSize: 10),
          ),
          textDirection: TextDirection.ltr,
          textAlign: align,
        )
        ..layout()
        ..paint(canvas, offset);
    }

    // Draw horizontal grid lines and Y-axis band labels (`UX-12`)
    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 1.0;

    final safeRange = range <= 0 ? 1.0 : range;
    final gridStep = safeRange <= 10
        ? 1.0
        : (safeRange == 150 ? 50.0 : (safeRange / 4).roundToDouble());
    final isIntegerScale = maxScore > 10;

    for (var s = minScore; s <= maxScore + 0.001; s += gridStep) {
      final y = getY(s);
      canvas.drawLine(
        Offset(leftPadding, y),
        Offset(leftPadding + chartWidth, y),
        gridPaint,
      );
      if (isIntegerScale) {
        drawLabel(s.round().toString(), Offset(0, y - 6));
      } else if (s == minScore ||
          s == maxScore ||
          s == ((minScore + maxScore) / 2).roundToDouble()) {
        drawLabel(s.toStringAsFixed(1), Offset(0, y - 6));
      }
    }

    // Draw dashed target line
    final targetY = getY(targetScore);
    final targetPaint = Paint()
      ..color = targetLineColor
      ..strokeWidth = 1.5;

    const dashWidth = 5.0;
    const dashSpace = 4.0;
    var startX = leftPadding;
    while (startX < leftPadding + chartWidth) {
      canvas.drawLine(
        Offset(startX, targetY),
        Offset(
          (startX + dashWidth).clamp(leftPadding, leftPadding + chartWidth),
          targetY,
        ),
        targetPaint,
      );
      startX += dashWidth + dashSpace;
    }

    void drawPoint(Offset center, {required bool isCalibrated}) {
      if (isCalibrated) {
        canvas
          ..drawCircle(
            center,
            4.5,
            Paint()
              ..color = lineColor
              ..style = PaintingStyle.fill,
          )
          ..drawCircle(
            center,
            5,
            Paint()
              ..color = pointFillColor
              ..strokeWidth = 1.5
              ..style = PaintingStyle.stroke,
          );
      } else {
        canvas.drawCircle(
          center,
          4.5,
          Paint()
            ..color = pointFillColor
            ..style = PaintingStyle.fill,
        );
        final dashPaint = Paint()
          ..color = lineColor
          ..strokeWidth = 2.0
          ..style = PaintingStyle.stroke;
        final rect = Rect.fromCircle(center: center, radius: 4.5);
        for (var d = 0; d < 4; d++) {
          canvas.drawArc(
            rect,
            d * (math.pi / 2),
            math.pi / 3,
            false,
            dashPaint,
          );
        }
      }
    }

    if (points.length < 2) {
      final pY = getY(points.first.score);
      final pX = leftPadding + (chartWidth / 2);
      drawPoint(Offset(pX, pY), isCalibrated: points.first.isCalibrated);
      drawLabel(
        points.first.dateLabel,
        Offset(pX - 16, size.height - bottomPadding + 4),
      );
      return;
    }

    // Compute point coordinates
    final dx = chartWidth / (points.length - 1);
    final offsets = <Offset>[];
    for (var i = 0; i < points.length; i++) {
      final x = leftPadding + (i * dx);
      final y = getY(points[i].score);
      offsets.add(Offset(x, y));
    }

    // Draw X-axis start & end date labels (`UX-12`)
    drawLabel(
      points.first.dateLabel,
      Offset(leftPadding, size.height - bottomPadding + 4),
    );
    drawLabel(
      points.last.dateLabel,
      Offset(
        (leftPadding + chartWidth - 28).clamp(leftPadding, size.width),
        size.height - bottomPadding + 4,
      ),
    );

    // Draw trend line
    final linePath = Path()..moveTo(offsets.first.dx, offsets.first.dy);
    for (var i = 1; i < offsets.length; i++) {
      linePath.lineTo(offsets[i].dx, offsets[i].dy);
    }

    final linePaint = Paint()
      ..color = lineColor
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    canvas.drawPath(linePath, linePaint);

    // Draw data points (solid for calibrated, hollow dashed for provisional)
    for (var i = 0; i < offsets.length; i++) {
      drawPoint(offsets[i], isCalibrated: points[i].isCalibrated);
    }
  }

  @override
  bool shouldRepaint(covariant _TrendChartPainter oldDelegate) => true;
}

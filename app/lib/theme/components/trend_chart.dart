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
  });

  /// Short date label (e.g. "Oct 12").
  final String dateLabel;

  /// Band score value (e.g. 6.5).
  final double score;

  /// UTC millisecond timestamp for ordering.
  final int timestampUtcMs;
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

    final summary = points.map((p) => '${p.dateLabel}: ${p.score}').join(', ');

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
  });

  final List<ScoreTrendPoint> points;
  final double targetScore;
  final double minScore;
  final double maxScore;
  final Color lineColor;
  final Color targetLineColor;
  final Color pointFillColor;
  final Color gridColor;

  @override
  void paint(Canvas canvas, Size size) {
    const bottomPadding = 20.0;
    const topPadding = 12.0;
    final chartHeight = size.height - bottomPadding - topPadding;
    final chartWidth = size.width;

    final range = maxScore - minScore;
    if (range <= 0) return;

    double getY(double score) {
      final fraction = ((score - minScore) / range).clamp(0.0, 1.0);
      return size.height - bottomPadding - (fraction * chartHeight);
    }

    // Draw horizontal grid lines
    final gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 1.0;

    for (var s = minScore; s <= maxScore; s += 1.0) {
      final y = getY(s);
      canvas.drawLine(Offset(0, y), Offset(chartWidth, y), gridPaint);
    }

    // Draw dashed target line
    final targetY = getY(targetScore);
    final targetPaint = Paint()
      ..color = targetLineColor
      ..strokeWidth = 1.5;

    const dashWidth = 5.0;
    const dashSpace = 4.0;
    var startX = 0.0;
    while (startX < chartWidth) {
      canvas.drawLine(
        Offset(startX, targetY),
        Offset(startX + dashWidth, targetY),
        targetPaint,
      );
      startX += dashWidth + dashSpace;
    }

    if (points.length < 2) {
      // Single point
      final pY = getY(points.first.score);
      final pX = chartWidth / 2;
      canvas.drawCircle(Offset(pX, pY), 5, Paint()..color = lineColor);
      return;
    }

    // Compute point coordinates
    final dx = chartWidth / (points.length - 1);
    final offsets = <Offset>[];
    for (var i = 0; i < points.length; i++) {
      final x = i * dx;
      final y = getY(points[i].score);
      offsets.add(Offset(x, y));
    }

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

    // Draw data points
    final dotStrokePaint = Paint()
      ..color = lineColor
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke;

    final dotFillPaint = Paint()
      ..color = pointFillColor
      ..style = PaintingStyle.fill;

    for (final offset in offsets) {
      canvas
        ..drawCircle(offset, 4.5, dotFillPaint)
        ..drawCircle(offset, 4.5, dotStrokePaint);
    }
  }

  @override
  bool shouldRepaint(covariant _TrendChartPainter oldDelegate) => true;
}

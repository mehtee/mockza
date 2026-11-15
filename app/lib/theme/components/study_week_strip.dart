import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/primitives.dart';

/// Single day study status state.
enum DayStudyStatus {
  /// Study goal met on this calendar day.
  completed,

  /// Active local calendar day (current today).
  today,

  /// Missed study day in the past.
  missed,

  /// Upcoming day in the future.
  upcoming,
}

/// Day status model for [StudyWeekStrip].
class DayStatus {
  /// Creates a [DayStatus] token.
  const new({
    required this.dayLabel,
    required this.status,
    required this.isToday,
  });

  /// Short day label (e.g. "M", "T", "W").
  final String dayLabel;

  /// Day study outcome.
  final DayStudyStatus status;

  /// Whether this tile corresponds to today.
  final bool isToday;
}

/// 7-day study week habit strip (design.md Sec. 4.3 & 5, Screenshot 01).
class StudyWeekStrip extends StatelessWidget {
  /// Creates a [StudyWeekStrip].
  const new({
    required this.days,
    required this.daysStudiedCount,
    super.key,
  });

  /// 7 calendar day status items.
  final List<DayStatus> days;

  /// Number of completed study days in the current week (e.g. 4).
  final int daysStudiedCount;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          // Header row: Title + "X/7 days studied"
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Expanded(
                child: Text(
                  'Study Activity',
                  style: typography.cardTitle.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: SpacingTokens.sm),
              Text(
                '$daysStudiedCount/7 days studied',
                style: typography.caption.copyWith(
                  color: colors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.lg),
          // 7 day tiles row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: days.map((day) {
              final isCompleted = day.status == DayStudyStatus.completed;

              Color tileBg;
              Color borderColor;

              if (day.isToday) {
                borderColor = colors.primary;
                tileBg = isCompleted ? colors.primary : colors.surfaceAlt;
              } else if (isCompleted) {
                borderColor = colors.success.withValues(alpha: 0.5);
                tileBg = colors.mintBg;
              } else {
                borderColor = colors.borderSubtle;
                tileBg = colors.surfaceAlt;
              }

              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      Container(
                        height: 44,
                        decoration: BoxDecoration(
                          color: tileBg,
                          borderRadius: shapes.compactRadius,
                          border: Border.all(
                            color: borderColor,
                            width: day.isToday ? 2.0 : shapes.strokeWidth,
                          ),
                        ),
                        child: Center(
                          child: isCompleted
                              ? AppIcon(
                                  LucideGlyph.check,
                                  size: 18,
                                  color: day.isToday
                                      ? colors.onPrimary
                                      : colors.success,
                                )
                              : (day.isToday
                                    ? Container(
                                        width: 8,
                                        height: 8,
                                        decoration: BoxDecoration(
                                          color: colors.primary,
                                          shape: BoxShape.circle,
                                        ),
                                      )
                                    : null),
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.xs),
                      Text(
                        day.dayLabel,
                        style: typography.caption.copyWith(
                          color: day.isToday
                              ? colors.primary
                              : colors.textTertiary,
                          fontWeight: day.isToday
                              ? FontWeight.w700
                              : FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/formatting/jalali_edge_formatter.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_bottom_sheet.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/primitives.dart';

/// Opens a responsive Jalali (`شمسی`) calendar sheet returning a canonical UTC [SerialDay],
/// or `null` when dismissed (`-1` sentinel inside internal value if cleared; returns null on dismiss).
Future<({bool cleared, SerialDay? day})?> showMzJalaliDatePickerSheet(
  BuildContext context, {
  required SerialDay today,
  SerialDay? initialSelectedDay,
}) {
  return showMzBottomSheet<({bool cleared, SerialDay? day})>(
    context: context,
    title: 'انتخاب تاریخ آزمون (شمسی)',
    child: _JalaliPickerBody(
      today: today,
      initialSelectedDay: initialSelectedDay,
    ),
  );
}

class _JalaliPickerBody extends StatefulWidget {
  const new({
    required this.today,
    this.initialSelectedDay,
  });

  final SerialDay today;
  final SerialDay? initialSelectedDay;

  @override
  State<_JalaliPickerBody> createState() => _JalaliPickerBodyState();
}

class _JalaliPickerBodyState extends State<_JalaliPickerBody> {
  late int _jy;
  late int _jm;
  JalaliYmd? _selected;

  @override
  void initState() {
    super.initState();
    final initial = widget.initialSelectedDay ?? widget.today;
    final ymd = JalaliEdgeFormatter.serialDayToJalali(initial);
    _jy = ymd.jy;
    _jm = ymd.jm;
    _selected = widget.initialSelectedDay != null ? ymd : null;
  }

  void _stepMonth(int delta) {
    setState(() {
      var nextM = _jm + delta;
      var nextY = _jy;
      if (nextM > 12) {
        nextM = 1;
        nextY += 1;
      } else if (nextM < 1) {
        nextM = 12;
        nextY -= 1;
      }
      _jy = nextY;
      _jm = nextM;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);

    final daysInMonth = JalaliEdgeFormatter.monthLength(_jy, _jm);
    final todayYmd = JalaliEdgeFormatter.serialDayToJalali(widget.today);
    final monthName = JalaliEdgeFormatter.persianMonthNames[_jm - 1];

    final maxSheetHeight = MediaQuery.sizeOf(context).height * 0.72;

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxSheetHeight),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[
                IconButton(
                  tooltip: 'ماه قبل',
                  onPressed: () => _stepMonth(-1),
                  icon: AppIcon(
                    LucideGlyph.chevronRight,
                    size: 20,
                    color: colors.textPrimary,
                  ),
                ),
                Text(
                  '$monthName ${EdgeNumerals.toPersianDigits(_jy)}',
                  style: typography.cardTitle.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                IconButton(
                  tooltip: 'ماه بعد',
                  onPressed: () => _stepMonth(1),
                  icon: AppIcon(
                    LucideGlyph.chevronLeft,
                    size: 20,
                    color: colors.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: SpacingTokens.sm),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 7,
                mainAxisSpacing: SpacingTokens.xs,
                crossAxisSpacing: SpacingTokens.xs,
                childAspectRatio: 1.05,
              ),
              itemCount: daysInMonth,
              itemBuilder: (ctx, index) {
                final dayNum = index + 1;
                final candidate = JalaliYmd(jy: _jy, jm: _jm, jd: dayNum);
                final candidateSerial = JalaliEdgeFormatter.jalaliToSerialDay(
                  candidate,
                );
                final isPast = candidateSerial.value < widget.today.value;
                final isSelected = _selected == candidate;
                final isToday = todayYmd == candidate;

                return InkWell(
                  onTap: isPast
                      ? null
                      : () {
                          setState(() {
                            _selected = candidate;
                          });
                        },
                  borderRadius: shapes.compactRadius,
                  child: Container(
                    alignment: AlignmentDirectional.center,
                    decoration: BoxDecoration(
                      color: isSelected
                          ? colors.primary
                          : (isToday ? colors.surfaceAlt : colors.surface),
                      borderRadius: shapes.compactRadius,
                      border: Border.all(
                        color: isSelected
                            ? colors.primary
                            : (isToday ? colors.primary : colors.borderSubtle),
                        width: shapes.strokeWidth,
                      ),
                    ),
                    child: Text(
                      EdgeNumerals.toPersianDigits(dayNum),
                      style: typography.secondary.copyWith(
                        color: isSelected
                            ? colors.onPrimary
                            : (isPast
                                  ? colors.textTertiary
                                  : colors.textPrimary),
                        fontWeight: isSelected || isToday
                            ? FontWeight.w700
                            : FontWeight.w500,
                      ),
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: SpacingTokens.md),
            Wrap(
              spacing: SpacingTokens.sm,
              runSpacing: SpacingTokens.xs,
              children: <Widget>[
                ActionChip(
                  label: Text(
                    '۳۰ روز آینده',
                    style: typography.caption.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  onPressed: () {
                    final target = JalaliEdgeFormatter.serialDayToJalali(
                      widget.today.addDays(30),
                    );
                    setState(() {
                      _jy = target.jy;
                      _jm = target.jm;
                      _selected = target;
                    });
                  },
                ),
                ActionChip(
                  label: Text(
                    '۹۰ روز آینده',
                    style: typography.caption.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  onPressed: () {
                    final target = JalaliEdgeFormatter.serialDayToJalali(
                      widget.today.addDays(90),
                    );
                    setState(() {
                      _jy = target.jy;
                      _jm = target.jm;
                      _selected = target;
                    });
                  },
                ),
                if (widget.initialSelectedDay != null)
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(
                      const (cleared: true, day: null),
                    ),
                    child: Text(
                      'حذف تاریخ',
                      style: typography.caption.copyWith(color: colors.error),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: SpacingTokens.md),
            PrimaryButton(
              label: 'تایید تاریخ آزمون',
              onPressed: _selected == null
                  ? null
                  : () => Navigator.of(context).pop((
                      cleared: false,
                      day: JalaliEdgeFormatter.jalaliToSerialDay(_selected!),
                    )),
            ),
          ],
        ),
      ),
    );
  }
}

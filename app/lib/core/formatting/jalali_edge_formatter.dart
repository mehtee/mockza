import 'package:meta/meta.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/vocab/serial_day.dart';

/// Immutable Jalali (`شمسی`) year/month/day triple used strictly at the UI edge.
@immutable
class JalaliYmd {
  /// Creates a [JalaliYmd].
  const new({required this.jy, required this.jm, required this.jd});

  /// Jalali year (e.g. `1405`).
  final int jy;

  /// Jalali month (`1..12`).
  final int jm;

  /// Jalali day (`1..31`).
  final int jd;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is JalaliYmd && jy == other.jy && jm == other.jm && jd == other.jd;

  @override
  int get hashCode => Object.hash(jy, jm, jd);

  @override
  String toString() =>
      '${jy.toString().padLeft(4, '0')}/${jm.toString().padLeft(2, '0')}/${jd.toString().padLeft(2, '0')}';
}

/// Pure-Dart Gregorian <-> Jalali edge converter aligned bit-for-bit with `jalaali-js`
/// and `web/src/edition/calendar/jalali-edge.ts`.
///
/// Storage (Drift SQLite, Postgres, SM-2 `SerialDay`) remains canonical UTC.
abstract final class JalaliEdgeFormatter {
  static const List<int> _breaks = <int>[
    -61,
    9,
    38,
    199,
    426,
    686,
    756,
    818,
    1111,
    1181,
    1210,
    1635,
    2060,
    2097,
    2192,
    2262,
    2324,
    2394,
    2456,
    3178,
  ];

  /// Persian month names ordered 1..12.
  static const List<String> persianMonthNames = <String>[
    'فروردین',
    'اردیبهشت',
    'خرداد',
    'تیر',
    'مرداد',
    'شهریور',
    'مهر',
    'آبان',
    'آذر',
    'دی',
    'بهمن',
    'اسفند',
  ];

  static const List<String> _englishMonthShort = <String>[
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  /// Returns whether Jalali year [jy] is a 366-day leap year (`Esfand = 30`).
  static bool isLeapJalaaliYear(int jy) =>
      _jalCal(jy, withoutLeap: true).leap == 0;

  /// Returns day count (`29`, `30`, or `31`) of Jalali month [jm] in year [jy].
  static int monthLength(int jy, int jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isLeapJalaaliYear(jy) ? 30 : 29;
  }

  /// Validates Jalali date bounds (`1..12`, `1..monthLength`).
  static bool isValidDate(int jy, int jm, int jd) =>
      jy >= -61 &&
      jy <= 3177 &&
      jm >= 1 &&
      jm <= 12 &&
      jd >= 1 &&
      jd <= monthLength(jy, jm);

  /// Converts a Gregorian UTC triple ([gy], [gm], [gd]) to [JalaliYmd].
  static JalaliYmd toJalali(int gy, int gm, int gd) => _d2j(_g2d(gy, gm, gd));

  /// Converts a [JalaliYmd] ([jy], [jm], [jd]) to Gregorian `(gy, gm, gd)`.
  static ({int gy, int gm, int gd}) toGregorian(int jy, int jm, int jd) =>
      _d2g(_j2d(jy, jm, jd));

  /// Converts canonical UTC [SerialDay] to [JalaliYmd] without local-TZ drift.
  static JalaliYmd serialDayToJalali(SerialDay serialDay) {
    final dt = DateTime.fromMillisecondsSinceEpoch(
      serialDay.value * Duration.millisecondsPerDay,
      isUtc: true,
    );
    return toJalali(dt.year, dt.month, dt.day);
  }

  /// Converts a validated [JalaliYmd] to canonical UTC [SerialDay].
  static SerialDay jalaliToSerialDay(JalaliYmd ymd) {
    if (!isValidDate(ymd.jy, ymd.jm, ymd.jd)) {
      throw RangeError('Invalid Jalali date: $ymd');
    }
    final g = toGregorian(ymd.jy, ymd.jm, ymd.jd);
    return SerialDay.fromUtcDateTime(DateTime.utc(g.gy, g.gm, g.gd));
  }

  /// Formats canonical UTC milliseconds for UI chrome:
  /// - `global`: `Nov 18, 2026`
  /// - `iran`: `۱۴۰۵/۰۸/۲۷` (or `۲۷ آبان ۱۴۰۵` when [longPersian] is true)
  static String formatDisplayDate(
    int utcMs,
    AppEdition edition, {
    bool longPersian = false,
  }) {
    final dt = DateTime.fromMillisecondsSinceEpoch(utcMs, isUtc: true);
    if (edition == AppEdition.iran) {
      final j = toJalali(dt.year, dt.month, dt.day);
      if (longPersian) {
        final mName = persianMonthNames[j.jm - 1];
        return '${EdgeNumerals.toPersianDigits(j.jd)} $mName ${EdgeNumerals.toPersianDigits(j.jy)}';
      }
      return EdgeNumerals.toPersianDigits(j.toString());
    }
    final mName = _englishMonthShort[dt.month - 1];
    return '$mName ${dt.day}, ${dt.year}';
  }

  /// Formats canonical UTC [SerialDay] for UI chrome.
  static String formatSerialDay(
    SerialDay serialDay,
    AppEdition edition, {
    bool longPersian = false,
  }) => formatDisplayDate(
    serialDay.value * Duration.millisecondsPerDay,
    edition,
    longPersian: longPersian,
  );

  static ({int leap, int gy, int march}) _jalCal(
    int jy, {
    bool withoutLeap = false,
  }) {
    final bl = _breaks.length;
    final gy = jy + 621;
    var leapJ = -14;
    var jp = _breaks[0];
    if (jy < jp || jy >= _breaks[bl - 1]) {
      throw RangeError('Invalid Jalaali year $jy');
    }
    var jump = 0;
    for (var i = 1; i < bl; i++) {
      final jm = _breaks[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + (jump ~/ 33) * 8 + ((jump % 33) ~/ 4);
      jp = jm;
    }
    var n = jy - jp;
    leapJ = leapJ + (n ~/ 33) * 8 + (((n % 33) + 3) ~/ 4);
    if ((jump % 33) == 4 && (jump - n) == 4) {
      leapJ += 1;
    }
    final leapG = (gy ~/ 4) - (((gy ~/ 100) + 1) * 3 ~/ 4) - 150;
    final march = 20 + leapJ - leapG;
    if (withoutLeap) {
      if (jump - n < 6) {
        n = n - jump + ((jump + 4) ~/ 33) * 33;
      }
      var leap = (((n + 1) % 33) - 1) % 4;
      if (leap == -1) leap = 4;
      return (leap: leap, gy: gy, march: march);
    }
    return (leap: 0, gy: gy, march: march);
  }

  static int _g2d(int gy, int gm, int gd) {
    final d =
        (((gy + ((gm - 8) ~/ 6) + 100100) * 1461) ~/ 4) +
        ((153 * ((gm + 9) % 12) + 2) ~/ 5) +
        gd -
        34840408;
    return d - ((((gy + 100100 + ((gm - 8) ~/ 6)) ~/ 100) * 3) ~/ 4) + 752;
  }

  static ({int gy, int gm, int gd}) _d2g(int jdn) {
    var j = 4 * jdn + 139361631;
    j = j + ((((4 * jdn + 183187720) ~/ 146097) * 3) ~/ 4) * 4 - 3908;
    final i = ((j % 1461) ~/ 4) * 5 + 308;
    final gd = ((i % 153) ~/ 5) + 1;
    final gm = ((i ~/ 153) % 12) + 1;
    final gy = (j ~/ 1461) - 100100 + ((8 - gm) ~/ 6);
    return (gy: gy, gm: gm, gd: gd);
  }

  static int _j2d(int jy, int jm, int jd) {
    final r = _jalCal(jy);
    return _g2d(r.gy, 3, r.march) +
        (jm - 1) * 31 -
        (jm ~/ 7) * (jm - 7) +
        jd -
        1;
  }

  static JalaliYmd _d2j(int jdn) {
    final gy = _d2g(jdn).gy;
    var jy = gy - 621;
    final r = _jalCal(jy, withoutLeap: true);
    final jdn1f = _g2d(gy, 3, r.march);
    var k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) {
        final jm = 1 + (k ~/ 31);
        final jd = (k % 31) + 1;
        return JalaliYmd(jy: jy, jm: jm, jd: jd);
      } else {
        k -= 186;
      }
    } else {
      jy -= 1;
      k += 179;
      if (r.leap == 1) k += 1;
    }
    final jm = 7 + (k ~/ 30);
    final jd = (k % 30) + 1;
    return JalaliYmd(jy: jy, jm: jm, jd: jd);
  }
}

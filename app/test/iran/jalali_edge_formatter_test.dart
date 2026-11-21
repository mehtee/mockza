import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/formatting/jalali_edge_formatter.dart';
import 'package:mockza/core/vocab/serial_day.dart';

void main() {
  group('JalaliEdgeFormatter', () {
    test('matches known Nowruz equinox & leap-year anchors cleanly', () {
      // 2024-03-20 -> 1403/01/01 (Farvardin 1, leap year 1403)
      expect(
        JalaliEdgeFormatter.toJalali(2024, 3, 20),
        const JalaliYmd(jy: 1403, jm: 1, jd: 1),
      );
      expect(JalaliEdgeFormatter.isLeapJalaaliYear(1403), isTrue);
      expect(JalaliEdgeFormatter.monthLength(1403, 12), 30);

      // 2025-03-20 -> 1403/12/30 (leap day Esfand 30!)
      expect(
        JalaliEdgeFormatter.toJalali(2025, 3, 20),
        const JalaliYmd(jy: 1403, jm: 12, jd: 30),
      );

      // 2025-03-21 -> 1404/01/01 (non-leap year 1404)
      expect(
        JalaliEdgeFormatter.toJalali(2025, 3, 21),
        const JalaliYmd(jy: 1404, jm: 1, jd: 1),
      );
      expect(JalaliEdgeFormatter.isLeapJalaaliYear(1404), isFalse);
      expect(JalaliEdgeFormatter.monthLength(1404, 12), 29);
    });

    test('round-trips SerialDay UTC -> Jalali -> SerialDay accurately', () {
      for (final dayVal in <int>[19800, 20168, 20533, 20900, 21200]) {
        final serial = SerialDay(dayVal);
        final jalali = JalaliEdgeFormatter.serialDayToJalali(serial);
        final restored = JalaliEdgeFormatter.jalaliToSerialDay(jalali);
        expect(restored.value, serial.value);
        expect(
          JalaliEdgeFormatter.isValidDate(jalali.jy, jalali.jm, jalali.jd),
          isTrue,
        );
      }
    });

    test(
      'formats IRN dates in Persian digits with Shamsi month names and GLB in English',
      () {
        final nov21 = SerialDay.fromUtcDateTime(DateTime.utc(2026, 11, 21));
        final faNumeric = JalaliEdgeFormatter.formatSerialDay(
          nov21,
          AppEdition.iran,
        );
        final faLong = JalaliEdgeFormatter.formatSerialDay(
          nov21,
          AppEdition.iran,
          longPersian: true,
        );
        final enStr = JalaliEdgeFormatter.formatSerialDay(
          nov21,
          AppEdition.global,
        );

        expect(faNumeric, '۱۴۰۵/۰۸/۳۰');
        expect(faLong, '۳۰ آبان ۱۴۰۵');
        expect(enStr, 'Nov 21, 2026');
      },
    );
  });
}

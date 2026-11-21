import 'package:mockza/core/config/edition_config.dart';

const List<String> _persianDigits = <String>[
  '۰',
  '۱',
  '۲',
  '۳',
  '۴',
  '۵',
  '۶',
  '۷',
  '۸',
  '۹',
];

/// Edge-only Persian digit & currency formatting matching `web/src/edition/bidi/numerals.ts`.
///
/// Never call inside `LtrExamBoundary` (exam timers, scores, and stimuli stay ASCII).
abstract final class EdgeNumerals {
  /// Converts ASCII digits `0–9` inside [input] to Persian digits `۰–۹`.
  static String toPersianDigits(Object input) {
    final raw = '$input';
    final buf = StringBuffer();
    for (var i = 0; i < raw.length; i++) {
      final code = raw.codeUnitAt(i);
      if (code >= 48 && code <= 57) {
        buf.write(_persianDigits[code - 48]);
      } else {
        buf.writeCharCode(code);
      }
    }
    return buf.toString();
  }

  /// Normalizes Persian (`۰–۹`) and Arabic-Indic (`٠–٩`) digits into ASCII `0–9`.
  static String toAsciiDigits(String input) {
    final buf = StringBuffer();
    for (var i = 0; i < input.length; i++) {
      final code = input.codeUnitAt(i);
      if (code >= 0x06F0 && code <= 0x06F9) {
        buf.writeCharCode(48 + (code - 0x06F0));
      } else if (code >= 0x0660 && code <= 0x0669) {
        buf.writeCharCode(48 + (code - 0x0660));
      } else {
        buf.writeCharCode(code);
      }
    }
    return buf.toString();
  }

  /// Formats UI-chrome numbers/dates for [edition] without touching exam stimuli.
  static String formatChromeNumber(Object value, AppEdition edition) {
    final raw = '$value';
    return edition == AppEdition.iran
        ? toPersianDigits(raw)
        : toAsciiDigits(raw);
  }

  /// Formats canonical integer Rial (`IRR`) to Toman (`amountRial ~/ 10`) with
  /// thousands separators, Persian digits, and `تومان`.
  static String formatTomanFromRial(int amountRial) {
    final isNegative = amountRial < 0;
    final absToman = (amountRial.abs() ~/ 10).toString();
    final grouped = StringBuffer();
    for (var i = 0; i < absToman.length; i++) {
      if (i > 0 && (absToman.length - i) % 3 == 0) {
        grouped.write(',');
      }
      grouped.write(absToman[i]);
    }
    final prefix = isNegative ? '-' : '';
    return '$prefix${toPersianDigits(grouped.toString())} تومان';
  }
}

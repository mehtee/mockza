import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/core/auth/auth_models.dart';
import 'package:mockza/core/config/brand_identity.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';

void main() {
  group('EdgeNumerals & Iran phone normalization', () {
    test('converts ASCII digits to Persian numerals and back', () {
      expect(EdgeNumerals.toPersianDigits('0123456789'), '۰۱۲۳۴۵۶۷۸۹');
      expect(EdgeNumerals.toAsciiDigits('۰۹۱۲-۳۴۵-۶۷۸۹'), '0912-345-6789');
      expect(EdgeNumerals.toAsciiDigits('٠٩١٢٣٤٥٦٧٨٩'), '09123456789');
      expect(
        EdgeNumerals.formatChromeNumber(42, AppEdition.iran),
        '۴۲',
      );
      expect(
        EdgeNumerals.formatChromeNumber(42, AppEdition.global),
        '42',
      );
    });

    test('formats integer Rial prices cleanly in grouped Toman', () {
      expect(EdgeNumerals.formatTomanFromRial(1990000), '۱۹۹,۰۰۰ تومان');
      expect(EdgeNumerals.formatTomanFromRial(3900000), '۳۹۰,۰۰۰ تومان');
      expect(EdgeNumerals.formatTomanFromRial(8900000), '۸۹۰,۰۰۰ تومان');
    });

    test('normalizes Iranian mobile formats with Persian/Arabic digits to +98 E.164', () {
      expect(normalizeIranPhoneToE164('۰۹۱۲۳۴۵۶۷۸۹'), '+989123456789');
      expect(normalizeIranPhoneToE164('0912 345 6789'), '+989123456789');
      expect(normalizeIranPhoneToE164('+989123456789'), '+989123456789');
      expect(normalizeIranPhoneToE164('00989123456789'), '+989123456789');
      expect(normalizeIranPhoneToE164('9123456789'), '+989123456789');
      expect(normalizeIranPhoneToE164('12345'), isNull);
    });

    test('separates Global Mockza and Iran Sanjia BrandIdentity', () {
      final glb = BrandIdentity.forEdition(AppEdition.global);
      final irn = BrandIdentity.forEdition(AppEdition.iran);
      expect(glb.localizedName(persian: false), 'Mockza');
      expect(irn.localizedName(persian: true), 'سنجیا');
      expect(irn.domain, 'sanjia.ir');
      expect(irn.naviaUrl, 'https://navia.ir');
    });
  });
}

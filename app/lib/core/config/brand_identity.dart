import 'package:meta/meta.dart';
import 'package:mockza/core/config/edition_config.dart';

/// Edition-bound product identity separating Global `Mockza` from Iran `Sanjia`.
@immutable
class BrandIdentity {
  /// Creates a [BrandIdentity].
  const new({
    required this.edition,
    required this.brandNameEn,
    required this.brandNameFa,
    required this.shortMarkChar,
    required this.domain,
    required this.supportEmail,
    required this.naviaUrl,
  });

  /// Resolves the canonical [BrandIdentity] for [edition].
  factory forEdition(AppEdition edition) => switch (edition) {
    AppEdition.global => global,
    AppEdition.iran => iran,
  };

  /// Global clean-room Mockza identity (`mockza.com`).
  static const global = BrandIdentity(
    edition: AppEdition.global,
    brandNameEn: 'Mockza',
    brandNameFa: 'موکزا',
    shortMarkChar: 'M',
    domain: 'mockza.com',
    supportEmail: 'support@mockza.com',
    naviaUrl: '',
  );

  /// Iran domestic Sanjia identity (`sanjia.ir`).
  static const iran = BrandIdentity(
    edition: AppEdition.iran,
    brandNameEn: 'Sanjia',
    brandNameFa: 'سنجیا',
    shortMarkChar: 'س',
    domain: 'sanjia.ir',
    supportEmail: 'support@sanjia.ir',
    naviaUrl: 'https://navia.ir',
  );

  /// Target edition enum.
  final AppEdition edition;

  /// Canonical English wordmark.
  final String brandNameEn;

  /// Canonical Persian wordmark.
  final String brandNameFa;

  /// Single character emblem identifier.
  final String shortMarkChar;

  /// Canonical web origin domain.
  final String domain;

  /// Support contact email.
  final String supportEmail;

  /// Sister university-admissions platform URL (`IRN` only).
  final String naviaUrl;

  /// Localized display brand name matching [persian] chrome.
  String localizedName({required bool persian}) =>
      persian ? brandNameFa : brandNameEn;
}

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

/// Store offering package model.
@immutable
class StorePackage {
  /// Creates a [StorePackage].
  const new({
    required this.identifier,
    required this.title,
    required this.description,
    required this.priceString,
    required this.periodDuration,
  });

  /// Canonical product identifier (e.g. `mockza_cram_weekly`, `mockza_pro_monthly`, `mockza_quarterly`).
  final String identifier;

  /// Display title.
  final String title;

  /// Detailed description.
  final String description;

  /// Formatted localized price.
  final String priceString;

  /// Subscription period duration (e.g. '1 week', '1 month', '3 months').
  final String periodDuration;
}

/// Canonical Global Mockza Pro subscription plans.
const List<StorePackage> defaultGlobalStorePackages = <StorePackage>[
  StorePackage(
    identifier: 'mockza_cram_weekly',
    title: 'Exam Cram Pass',
    description: 'Intensive unlimited AI evaluation access for 7 days.',
    priceString: r'$9.99',
    periodDuration: '1 week',
  ),
  StorePackage(
    identifier: 'mockza_pro_monthly',
    title: 'Pro Monthly',
    description: 'Unlimited Speaking & Writing AI reviews + Explanations.',
    priceString: r'$19.99',
    periodDuration: '1 month',
  ),
  StorePackage(
    identifier: 'mockza_quarterly',
    title: 'Quarterly Bundle',
    description: 'Full 3-month preparation window with max savings.',
    priceString: r'$44.99',
    periodDuration: '3 months',
  ),
];

/// Gateway contract abstracting store billing (`glb` RevenueCat vs `irn` stores).
abstract interface class BillingGateway {
  /// Queries whether the current account holds an active Pro entitlement.
  Future<Result<bool, Failure>> checkProEntitlement();

  /// Triggers an asynchronous entitlement restoration flow.
  Future<Result<bool, Failure>> restorePurchases();

  /// Fetches currently available Pro offerings.
  Future<Result<List<StorePackage>, Failure>> fetchOfferings();

  /// Initiates store checkout for [packageId].
  Future<Result<bool, Failure>> purchasePackage(String packageId);
}

/// Global flavor [BillingGateway] backed by `purchases_flutter` (RevenueCat)
/// with explicit Mockza identity binding and safe guards for Web/unconfigured dev builds.
final class RevenueCatBillingGateway implements BillingGateway {
  /// Creates a [RevenueCatBillingGateway].
  const new({this.resolveAppUserId});

  /// Resolves the canonical Mockza billing identity (`userId` or `deviceId`).
  final Future<String?> Function()? resolveAppUserId;

  static const _rcApiKey = String.fromEnvironment('REVENUECAT_PUBLIC_KEY');
  static bool _configured = false;
  static String? _boundAppUserId;

  Future<bool> _ensureConfigured() async {
    if (kIsWeb || _rcApiKey.isEmpty) {
      return false;
    }
    final appUserId = await resolveAppUserId?.call();
    if (appUserId == null || appUserId.isEmpty) {
      return false;
    }
    try {
      if (!_configured) {
        final cfg = PurchasesConfiguration(_rcApiKey)..appUserID = appUserId;
        await Purchases.configure(cfg);
        _configured = true;
        _boundAppUserId = appUserId;
        return true;
      }
      if (_boundAppUserId != appUserId) {
        await Purchases.logIn(appUserId);
        _boundAppUserId = appUserId;
      }
      return true;
    } on Object {
      return false;
    }
  }

  @override
  Future<Result<bool, Failure>> checkProEntitlement() async {
    if (!await _ensureConfigured()) {
      return const Ok(false);
    }
    try {
      final info = await Purchases.getCustomerInfo();
      return Ok(info.entitlements.active.containsKey('pro'));
    } on MissingPluginException {
      return const Ok(false);
    } on PlatformException catch (e) {
      return Err(NetworkFailure('Billing query failed: ${e.message}'));
    } on Object catch (e) {
      return Err(NetworkFailure('Billing check unavailable: $e'));
    }
  }

  @override
  Future<Result<bool, Failure>> restorePurchases() async {
    if (!await _ensureConfigured()) {
      return const Err(
        ValidationFailure(
          'Store purchase restoration requires Google Play or App Store on mobile.',
        ),
      );
    }
    try {
      final info = await Purchases.restorePurchases();
      return Ok(info.entitlements.active.containsKey('pro'));
    } on PlatformException catch (e) {
      return Err(NetworkFailure('Purchase restore failed: ${e.message}'));
    } on Object catch (e) {
      return Err(NetworkFailure('Restore failed: $e'));
    }
  }

  @override
  Future<Result<List<StorePackage>, Failure>> fetchOfferings() async {
    if (!await _ensureConfigured()) {
      return const Ok(defaultGlobalStorePackages);
    }
    try {
      final offerings = await Purchases.getOfferings();
      final current = offerings.current;
      if (current == null || current.availablePackages.isEmpty) {
        return const Ok(defaultGlobalStorePackages);
      }
      final packages = current.availablePackages
          .map((p) {
            return StorePackage(
              identifier: p.identifier,
              title: p.storeProduct.title,
              description: p.storeProduct.description,
              priceString: p.storeProduct.priceString,
              periodDuration: p.packageType.name,
            );
          })
          .toList(growable: false);
      return Ok(packages);
    } on MissingPluginException {
      return const Ok(defaultGlobalStorePackages);
    } on PlatformException catch (e) {
      return Err(
        NetworkFailure('Failed to fetch store offerings: ${e.message}'),
      );
    } on Object {
      return const Ok(defaultGlobalStorePackages);
    }
  }

  @override
  Future<Result<bool, Failure>> purchasePackage(String packageId) async {
    if (!await _ensureConfigured()) {
      return const Err(
        ValidationFailure(
          'Direct web checkout is not enabled. Subscribe from Android or iOS Mockza.',
        ),
      );
    }
    try {
      final offerings = await Purchases.getOfferings();
      final current = offerings.current;
      final packages = current?.availablePackages ?? const <Package>[];
      Package? selected;
      for (final p in packages) {
        if (p.identifier == packageId) {
          selected = p;
          break;
        }
      }
      if (selected == null) {
        return const Err(
          ValidationFailure('Selected package is currently unavailable'),
        );
      }
      final purchaseResult = await Purchases.purchase(
        PurchaseParams.package(selected),
      );
      return Ok(
        purchaseResult.customerInfo.entitlements.active.containsKey('pro'),
      );
    } on PlatformException catch (e) {
      return Err(NetworkFailure('Purchase transaction failed: ${e.message}'));
    } on Object catch (e) {
      return Err(NetworkFailure('Purchase failed: $e'));
    }
  }
}

/// Iran flavor [BillingGateway] adapter targeting CafeBazaar / Myket in-app billing.
final class IranBillingGateway implements BillingGateway {
  /// Creates an [IranBillingGateway].
  const new();

  static const List<StorePackage> _iranPackages = <StorePackage>[
    StorePackage(
      identifier: 'mockza_cram_weekly',
      title: 'گذرنامه فشرده ۷ روزه',
      description: 'ارزیابی نامحدود اسپیکینگ و رایتینگ با هوش مصنوعی (۷ روز).',
      priceString: '۱۹۹,۰۰۰ تومان',
      periodDuration: '1 week',
    ),
    StorePackage(
      identifier: 'mockza_pro_monthly',
      title: 'اشتراک ماهانه پرو',
      description: 'تحلیل نامحدود، توضیحات هوشمند ریدینگ و لیسنینگ.',
      priceString: '۳۹۰,۰۰۰ تومان',
      periodDuration: '1 month',
    ),
    StorePackage(
      identifier: 'mockza_quarterly',
      title: 'بسته سه‌ماهه آمادگی کامل',
      description: 'صرفه‌جویی ویژه برای دوره آمادگی ۹۰ روزه.',
      priceString: '۸۹۰,۰۰۰ تومان',
      periodDuration: '3 months',
    ),
  ];

  @override
  Future<Result<bool, Failure>> checkProEntitlement() async => const Ok(false);

  @override
  Future<Result<bool, Failure>> restorePurchases() async => const Err(
    ValidationFailure(
      'بازیابی خرید در نسخه ایران نیازمند نصب کافه‌بازار یا مایکت روی اندروید است.',
    ),
  );

  @override
  Future<Result<List<StorePackage>, Failure>> fetchOfferings() async =>
      const Ok(_iranPackages);

  @override
  Future<Result<bool, Failure>> purchasePackage(String packageId) async =>
      const Err(
        ValidationFailure(
          'پرداخت درون‌برنامه‌ای در نسخه اندروید کافه‌بازار یا مایکت فعال است.',
        ),
      );
}

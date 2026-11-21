import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/services/external_link_platform.dart';
import 'package:mockza/services/native/iran_iap_channel.dart';
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
    description: 'Full Pro AI evaluation allowance for 7 days (10 Speaking + 10 Writing daily).',
    priceString: r'$9.99',
    periodDuration: '1 week',
  ),
  StorePackage(
    identifier: 'mockza_pro_monthly',
    title: 'Pro Monthly',
    description: 'Pro Speaking & Writing AI reviews (10+10 daily, 150/month) + Explanations.',
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

/// Compile-time IRN store channel (`zarinpal`, `bazaar`, or `myket`).
const String kIrnBillingChannel = String.fromEnvironment(
  'IRN_BILLING_CHANNEL',
  defaultValue: 'zarinpal',
);

/// Iran flavor [BillingGateway] supporting:
/// - **Zarinpal** (`POST /v1/billing/zarinpal/request` + `/verify`) on Flutter Web PWA & Direct APK
/// - **Cafe Bazaar / Myket** (`IranIapChannel` + `/v1/billing/{bazaar,myket}/verify`) on Android store builds
final class IranBillingGateway implements BillingGateway {
  /// Creates an [IranBillingGateway]. Optional HTTP client enables live API checkout & verification.
  const new({
    this._dio,
    IranIapChannel? storeChannel,
    this._channelOverride,
  }) : _storeChannel = storeChannel ?? const IranIapChannel();

  final Dio? _dio;
  final IranIapChannel _storeChannel;
  final String? _channelOverride;

  static const List<
    ({
      String id,
      int amountRial,
      String title,
      String description,
      String period,
    })
  >
  _iranPlanSpecs =
      <
        ({
          String id,
          int amountRial,
          String title,
          String description,
          String period,
        })
      >[
        (
          id: 'mockza_cram_weekly',
          amountRial: 1990000,
          title: 'گذرنامه فشرده ۷ روزه',
          description:
              'ارزیابی هوشمند اسپیکینگ و رایتینگ با هوش مصنوعی (۷ روز).',
          period: '1 week',
        ),
        (
          id: 'mockza_pro_monthly',
          amountRial: 3900000,
          title: 'اشتراک ماهانه پرو',
          description: 'تحلیل هوشمند روزانه (۱۰+۱۰ در روز)، توضیحات ریدینگ و لیسنینگ و واژگان نامحدود.',
          period: '1 month',
        ),
        (
          id: 'mockza_quarterly',
          amountRial: 8900000,
          title: 'بسته سه‌ماهه آمادگی کامل',
          description: 'بیشترین صرفه‌جویی برای دوره آمادگی ۹۰ روزه اپلای.',
          period: '3 months',
        ),
      ];

  static final List<StorePackage> _iranPackages = _iranPlanSpecs
      .map(
        (p) => StorePackage(
          identifier: p.id,
          title: p.title,
          description: p.description,
          priceString: EdgeNumerals.formatTomanFromRial(p.amountRial),
          periodDuration: p.period,
        ),
      )
      .toList(growable: false);

  String get _effectiveChannel {
    if (kIsWeb) return 'zarinpal';
    final raw = (_channelOverride ?? kIrnBillingChannel).trim().toLowerCase();
    return switch (raw) {
      'bazaar' || 'myket' => raw,
      _ => 'zarinpal',
    };
  }

  @override
  Future<Result<bool, Failure>> checkProEntitlement() async {
    final dio = _dio;
    if (dio == null) return const Ok(false);
    try {
      final res = await dio.get<Map<String, Object?>>('/v1/account/me');
      final data = res.data;
      if (data == null) return const Ok(false);
      final user = data['user'] as Map<String, Object?>?;
      final ent = data['entitlement'] as Map<String, Object?>?;
      final isPro = (ent?['isPro'] == true) || (user?['isPro'] == true);
      return Ok(isPro);
    } on Object {
      return const Ok(false);
    }
  }

  @override
  Future<Result<bool, Failure>> restorePurchases() async {
    final channel = _effectiveChannel;
    if ((channel == 'bazaar' || channel == 'myket') &&
        !kIsWeb &&
        _dio != null) {
      final latestRes = await _storeChannel.queryLatestPurchase(store: channel);
      if (latestRes case Ok(:final value) when value != null) {
        final matchedPlan = _iranPlanSpecs
            .where((p) => p.id == value.productId)
            .firstOrNull;
        if (matchedPlan != null) {
          return await _verifyStoreReceipt(
            store: channel,
            planId: matchedPlan.id,
            productId: value.productId,
            purchaseToken: value.purchaseToken,
          );
        }
      }
    }

    final dio = _dio;
    if (dio == null) {
      return const Err(
        ValidationFailure(
          'بازیابی اشتراک در نسخه آفلاین ممکن نیست؛ ابتدا وارد حساب کاربری خود شوید.',
        ),
      );
    }
    return await checkProEntitlement();
  }

  @override
  Future<Result<List<StorePackage>, Failure>> fetchOfferings() async =>
      Ok(_iranPackages);

  @override
  Future<Result<bool, Failure>> purchasePackage(String packageId) async {
    final dio = _dio;
    if (dio == null) {
      return const Err(
        ValidationFailure(
          'اتصال سرور برای ثبت پرداخت در دسترس نیست.',
        ),
      );
    }

    final plan = _iranPlanSpecs.where((p) => p.id == packageId).firstOrNull;
    if (plan == null) {
      return const Err(ValidationFailure('طرح انتخاب‌شده معتبر نیست.'));
    }

    final channel = _effectiveChannel;
    if (channel == 'bazaar' || channel == 'myket') {
      final iapRes = await _storeChannel.launchPurchase(
        store: channel,
        productId: plan.id,
      );
      switch (iapRes) {
        case Err<({String purchaseToken, String productId}), Failure>(
          :final failure,
        ):
          return Err(failure);
        case Ok<({String purchaseToken, String productId}), Failure>(
          :final value,
        ):
          return await _verifyStoreReceipt(
            store: channel,
            planId: plan.id,
            productId: value.productId,
            purchaseToken: value.purchaseToken,
          );
      }
    }

    final origin = currentWebOriginImpl();
    final returnUrl = (origin != null && origin.isNotEmpty)
        ? '$origin/billing/callback'
        : 'sanjia://billing/callback';

    try {
      final res = await dio.post<Map<String, Object?>>(
        '/v1/billing/zarinpal/request',
        data: <String, Object?>{
          'planId': plan.id,
          'amountRial': plan.amountRial,
          'acceptedSingleDevicePerSlotTos': true,
          'returnUrl': returnUrl,
        },
      );
      final data = res.data ?? const <String, Object?>{};
      final activated = data['activatedSession'] as Map<String, Object?>?;
      if (activated?['isPro'] == true) {
        return const Ok(true);
      }
      final redirectUrl =
          (data['redirectUrl'] as String?) ?? (data['paymentUrl'] as String?);
      final authority = data['authority'] as String?;

      if (redirectUrl == null || redirectUrl.isEmpty) {
        return const Err(
          NetworkFailure('لینک انتقال به درگاه زرین‌پال از سرور دریافت نشد.'),
        );
      }

      // In local/staging sandbox mode, backend returns our own returnUrl directly with Authority=...&Status=OK.
      final parsedUri = Uri.tryParse(redirectUrl);
      if (parsedUri != null &&
          (parsedUri.path.endsWith('/billing/callback') ||
              parsedUri.scheme == 'sanjia') &&
          authority != null &&
          authority.isNotEmpty) {
        return await verifyZarinpalCallback(
          authority: parsedUri.queryParameters['Authority'] ?? authority,
          status: parsedUri.queryParameters['Status'] ?? 'OK',
        );
      }

      final launchRes = await openExternalUrlImpl(
        redirectUrl,
        replaceCurrentTab: kIsWeb,
      );
      if (launchRes case Err<void, Failure>(:final failure)) {
        return Err(failure);
      }
      return const Ok(false);
    } on DioException catch (e) {
      return Err(_mapBillingDioError(e, 'شروع پرداخت زرین‌پال ناموفق بود.'));
    } on Object catch (e) {
      return Err(NetworkFailure('خطای پرداخت زرین‌پال: $e'));
    }
  }

  /// Confirms a returned Zarinpal transaction strictly server-side (`POST /v1/billing/zarinpal/verify`).
  Future<Result<bool, Failure>> verifyZarinpalCallback({
    required String authority,
    String? status,
  }) async {
    final dio = _dio;
    if (dio == null) {
      return const Err(
        ValidationFailure('اتصال سرور برای تایید پرداخت در دسترس نیست.'),
      );
    }
    try {
      final res = await dio.post<Map<String, Object?>>(
        '/v1/billing/zarinpal/verify',
        data: <String, Object?>{
          'authority': authority,
          if (status != null && status.isNotEmpty) 'status': status,
        },
      );
      return Ok(res.data?['isPro'] == true);
    } on DioException catch (e) {
      return Err(_mapBillingDioError(e, 'تایید تراکنش زرین‌پال ناموفق بود.'));
    } on Object catch (e) {
      return Err(NetworkFailure('خطا در تایید پرداخت: $e'));
    }
  }

  Future<Result<bool, Failure>> _verifyStoreReceipt({
    required String store,
    required String planId,
    required String productId,
    required String purchaseToken,
  }) async {
    final dio = _dio!;
    try {
      final res = await dio.post<Map<String, Object?>>(
        '/v1/billing/$store/verify',
        data: <String, Object?>{
          'planId': planId,
          'productId': productId,
          'purchaseToken': purchaseToken,
          'acceptedSingleDevicePerSlotTos': true,
        },
      );
      return Ok(res.data?['isPro'] == true);
    } on DioException catch (e) {
      return Err(_mapBillingDioError(e, 'تایید خرید از فروشگاه ناموفق بود.'));
    } on Object catch (e) {
      return Err(NetworkFailure('خطا در تایید خرید فروشگاه: $e'));
    }
  }

  Failure _mapBillingDioError(DioException e, String fallback) {
    final body = e.response?.data;
    final msg = body is Map<Object?, Object?>
        ? body['message'] as String?
        : null;
    if (msg != null && msg.trim().isNotEmpty) {
      return ValidationFailure(msg);
    }
    return NetworkFailure(fallback, statusCode: e.response?.statusCode);
  }
}

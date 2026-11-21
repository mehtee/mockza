import 'package:flutter/services.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';

/// Quarantined native MethodChannel bridge for Cafe Bazaar Poolakey & Myket IAB SDKs (`IRN` Android).
final class IranIapChannel {
  /// Creates an [IranIapChannel].
  const new([
    this._channel = const MethodChannel('ir.sanjia.app/iran_iap'),
  ]);

  final MethodChannel _channel;

  /// Initiates an Android in-app purchase on [store] (`bazaar` | `myket`) for [productId].
  Future<Result<({String purchaseToken, String productId}), Failure>>
  launchPurchase({
    required String store,
    required String productId,
  }) async {
    try {
      final res = await _channel.invokeMapMethod<String, Object?>(
        'launchPurchase',
        <String, Object?>{'store': store, 'productId': productId},
      );
      final token = res?['purchaseToken'] as String?;
      if (token == null || token.trim().isEmpty) {
        return const Err(
          ValidationFailure('خرید تکمیل نشد یا توکن فروشگاه دریافت نگردید.'),
        );
      }
      return Ok((
        purchaseToken: token.trim(),
        productId: (res?['productId'] as String?) ?? productId,
      ));
    } on MissingPluginException {
      return const Err(
        ValidationFailure(
          'درگاه خرید کافه‌بازار/مایکت روی این دستگاه نصب نیست. از نسخه اندروید فروشگاه یا پرداخت زرین‌پال استفاده کنید.',
        ),
      );
    } on PlatformException catch (e) {
      return Err(
        NetworkFailure(
          'خطا در پرداخت فروشگاه (${e.message ?? e.code})',
        ),
      );
    }
  }

  /// Queries previously purchased active tokens on [store] (`bazaar` | `myket`).
  Future<Result<({String purchaseToken, String productId})?, Failure>>
  queryLatestPurchase({required String store}) async {
    try {
      final res = await _channel.invokeMapMethod<String, Object?>(
        'queryLatestPurchase',
        <String, Object?>{'store': store},
      );
      final token = res?['purchaseToken'] as String?;
      final productId = res?['productId'] as String?;
      if (token == null ||
          token.trim().isEmpty ||
          productId == null ||
          productId.trim().isEmpty) {
        return const Ok(null);
      }
      return Ok((
        purchaseToken: token.trim(),
        productId: productId.trim(),
      ));
    } on MissingPluginException {
      return const Ok(null);
    } on PlatformException catch (e) {
      return Err(
        NetworkFailure(
          'بازیابی خرید فروشگاه ناموفق بود (${e.message ?? e.code})',
        ),
      );
    }
  }
}

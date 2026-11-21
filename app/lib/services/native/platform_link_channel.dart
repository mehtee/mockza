import 'package:flutter/services.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';

/// Quarantined native MethodChannel bridge for opening external checkout/Navia URLs on Android/iOS.
final class PlatformLinkChannel {
  /// Creates a [PlatformLinkChannel].
  const new([
    this._channel = const MethodChannel('com.mockza/external_link'),
  ]);

  final MethodChannel _channel;

  /// Requests native OS browser / custom tab launch for [url].
  Future<Result<void, Failure>> openExternalUrl(String url) async {
    try {
      await _channel.invokeMethod<void>('openUrl', <String, Object?>{
        'url': url,
      });
      return const Ok(null);
    } on MissingPluginException {
      return const Err(
        ValidationFailure(
          'External browser handler is unavailable in this environment.',
        ),
      );
    } on PlatformException catch (e) {
      return Err(
        NetworkFailure('Could not open browser URL: ${e.message ?? e.code}'),
      );
    }
  }
}

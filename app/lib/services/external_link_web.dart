import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:web/web.dart' as web;

/// Launches [url] in the Web browser (`location.assign` for payment redirects, `open` otherwise).
Future<Result<void, Failure>> openExternalUrlImpl(
  String url, {
  bool replaceCurrentTab = false,
}) async {
  try {
    if (replaceCurrentTab) {
      web.window.location.assign(url);
    } else {
      web.window.open(url, '_blank', 'noopener,noreferrer');
    }
    return const Ok(null);
  } on Object catch (e) {
    return Err(NetworkFailure('Unable to open external URL: $e'));
  }
}

/// Returns current Web origin (e.g. `https://app.sanjia.ir`) for Zarinpal return callbacks.
String? currentWebOriginImpl() {
  try {
    return web.window.location.origin;
  } on Object {
    return null;
  }
}

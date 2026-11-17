import 'dart:js_interop';

import 'package:mockza/core/auth/auth_models.dart';
import 'package:web/web.dart' as web;

@JS('Intl.DateTimeFormat')
external _IntlDateTimeFormat _createIntlDateTimeFormat();

extension type _IntlDateTimeFormat._(JSObject _) implements JSObject {
  external _IntlResolvedOptions resolvedOptions();
}

@JS()
extension type _IntlResolvedOptions._(JSObject _) implements JSObject {
  external String? get timeZone;
}

String? _readBrowserTimezone() {
  try {
    final tz = _createIntlDateTimeFormat().resolvedOptions().timeZone;
    return (tz != null && tz.trim().isNotEmpty) ? tz.trim() : null;
  } on Object {
    return null;
  }
}

/// Reads browser User-Agent and timezone on Flutter Web so mobile browsers
/// occupy the `mobile` slot and desktop browsers occupy the `desktop_web` slot.
DeviceClientMeta readDeviceMeta() {
  final ua = web.window.navigator.userAgent;
  final isMobile = RegExp(
    'Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini',
    caseSensitive: false,
  ).hasMatch(ua);

  final browser = ua.contains('Edg/')
      ? 'Edge'
      : ua.contains('Brave')
      ? 'Brave'
      : ua.contains('Firefox/')
      ? 'Firefox'
      : ua.contains('Chrome/') || ua.contains('CriOS/')
      ? 'Chrome'
      : ua.contains('Safari/')
      ? 'Safari'
      : 'Browser';

  final os = ua.contains('iPhone')
      ? 'iPhone'
      : ua.contains('iPad')
      ? 'iPad'
      : ua.contains('Android')
      ? 'Android'
      : ua.contains('Windows')
      ? 'Windows'
      : ua.contains('Macintosh')
      ? 'macOS'
      : ua.contains('Linux')
      ? 'Linux'
      : 'Web';

  return DeviceClientMeta(
    slotKind: isMobile ? DeviceSlotKind.mobile : DeviceSlotKind.desktopWeb,
    platform: isMobile ? 'web_mobile' : 'web_desktop',
    appSurface: 'flutter_web',
    deviceName: '$browser on $os',
    timezone: _readBrowserTimezone(),
  );
}

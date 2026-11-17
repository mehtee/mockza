import 'package:flutter/foundation.dart';
import 'package:mockza/core/auth/auth_models.dart';

/// Reads native Android/iOS/Desktop metadata cleanly without VM-only `dart:io` dependencies.
DeviceClientMeta readDeviceMeta() {
  switch (defaultTargetPlatform) {
    case TargetPlatform.iOS:
      return const DeviceClientMeta(
        slotKind: DeviceSlotKind.mobile,
        platform: 'ios',
        appSurface: 'flutter_app',
        deviceName: 'iPhone / iPad App',
      );
    case TargetPlatform.android:
      return const DeviceClientMeta(
        slotKind: DeviceSlotKind.mobile,
        platform: 'android',
        appSurface: 'flutter_app',
        deviceName: 'Android Phone',
      );
    case TargetPlatform.macOS:
      return const DeviceClientMeta(
        slotKind: DeviceSlotKind.desktopWeb,
        platform: 'web_desktop',
        appSurface: 'flutter_app',
        deviceName: 'macOS Desktop',
      );
    case TargetPlatform.windows:
      return const DeviceClientMeta(
        slotKind: DeviceSlotKind.desktopWeb,
        platform: 'web_desktop',
        appSurface: 'flutter_app',
        deviceName: 'Windows Desktop',
      );
    case TargetPlatform.linux:
      return const DeviceClientMeta(
        slotKind: DeviceSlotKind.desktopWeb,
        platform: 'web_desktop',
        appSurface: 'flutter_app',
        deviceName: 'Linux Desktop',
      );
    case TargetPlatform.fuchsia:
      return const DeviceClientMeta(
        slotKind: DeviceSlotKind.mobile,
        platform: 'unknown',
        appSurface: 'flutter_app',
        deviceName: 'Mockza Mobile',
      );
  }
}

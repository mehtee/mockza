import 'package:mockza/core/auth/auth_models.dart';
import 'package:mockza/services/device_meta_native.dart'
    if (dart.library.js_interop) 'package:mockza/services/device_meta_web.dart'
    as platform;

/// Collects honest platform and hardware slot metadata sent on auth handshakes.
DeviceClientMeta readPlatformDeviceMeta() => platform.readDeviceMeta();

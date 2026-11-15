import 'package:mockza/services/secure_storage_native.dart'
    if (dart.library.js_interop) 'package:mockza/services/secure_storage_web.dart'
    as platform;

/// Reads a fallback secret string from browser storage on Web (`null` on Native).
String? readPlatformFallbackSecret(String key) =>
    platform.readFallbackSecret(key);

/// Persists a fallback secret string into browser storage on Web (no-op on Native).
void writePlatformFallbackSecret(String key, String value) =>
    platform.writeFallbackSecret(key, value);

/// Removes a fallback secret string from browser storage on Web (no-op on Native).
void deletePlatformFallbackSecret(String key) =>
    platform.deleteFallbackSecret(key);

/// Native no-op fallback reader (Keychain/Keystore are handled by `FlutterSecureStorage`).
String? readFallbackSecret(String key) => null;

/// Native no-op fallback writer.
void writeFallbackSecret(String key, String value) {}

/// Native no-op fallback deleter.
void deleteFallbackSecret(String key) {}

import 'package:web/web.dart' as web;

/// Reads a persisted secret from browser `localStorage` so device identity and
/// auth tokens survive refreshes even over plain HTTP LAN URLs without WebCrypto.
String? readFallbackSecret(String key) {
  try {
    return web.window.localStorage.getItem(key);
  } on Object {
    return null;
  }
}

/// Persists [value] under [key] into browser `localStorage`.
void writeFallbackSecret(String key, String value) {
  try {
    web.window.localStorage.setItem(key, value);
  } on Object {
    // Ignore storage quota / private mode restrictions.
  }
}

/// Removes [key] from browser `localStorage`.
void deleteFallbackSecret(String key) {
  try {
    web.window.localStorage.removeItem(key);
  } on Object {
    // Ignore storage access errors.
  }
}

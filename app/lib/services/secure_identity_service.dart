import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/services/entropy_source.dart';
import 'package:mockza/services/secure_storage_platform.dart';

/// Thin gateway interface over secure OS credential storage (`Keychain`/`Keystore`).
abstract interface class SecureStorageGateway {
  /// Persists a secret [value] under [key].
  Future<Result<void, Failure>> write({
    required String key,
    required String value,
  });

  /// Reads a stored secret value for [key], returning `null` if absent.
  Future<Result<String?, Failure>> read({required String key});

  /// Removes any secret value stored under [key].
  Future<Result<void, Failure>> delete({required String key});
}

/// Concrete [SecureStorageGateway] wrapping [FlutterSecureStorage] with Web `localStorage` fallback.
final class FlutterSecureStorageGateway implements SecureStorageGateway {
  /// Creates a [FlutterSecureStorageGateway].
  const new([
    this._storage = const FlutterSecureStorage(),
  ]);

  static final Map<String, String> _fallbackStore = <String, String>{};

  final FlutterSecureStorage _storage;

  @override
  Future<Result<void, Failure>> write({
    required String key,
    required String value,
  }) async {
    _fallbackStore[key] = value;
    writePlatformFallbackSecret(key, value);
    try {
      await _storage.write(key: key, value: value);
      return const Ok(null);
    } on MissingPluginException {
      return const Ok(null);
    } on PlatformException catch (e) {
      return Err(
        StorageFailure(
          'Failed to write secure credential: ${e.message ?? e.code}',
        ),
      );
    } on Object catch (e) {
      return Err(StorageFailure('Failed to write secure credential: $e'));
    }
  }

  @override
  Future<Result<String?, Failure>> read({required String key}) async {
    try {
      final value = await _storage.read(key: key);
      if (value != null && value.isNotEmpty) {
        return Ok(value);
      }
    } on Object {
      // Fall through to platform/in-memory cache.
    }
    return Ok(readPlatformFallbackSecret(key) ?? _fallbackStore[key]);
  }

  @override
  Future<Result<void, Failure>> delete({required String key}) async {
    _fallbackStore.remove(key);
    deletePlatformFallbackSecret(key);
    try {
      await _storage.delete(key: key);
      return const Ok(null);
    } on MissingPluginException {
      return const Ok(null);
    } on PlatformException catch (e) {
      return Err(
        StorageFailure(
          'Failed to delete secure credential: ${e.message ?? e.code}',
        ),
      );
    } on Object catch (e) {
      return Err(StorageFailure('Failed to delete secure credential: $e'));
    }
  }
}

/// Manages pseudonymous device identity and bearer tokens backed by [SecureStorageGateway].
final class SecureIdentityService {
  /// Creates a [SecureIdentityService].
  const new({
    required this._storage,
    required this._entropy,
  });

  static const _deviceIdKey = 'mockza_device_id_v1';
  static const _deviceSecretKey = 'mockza_device_secret_v1';
  static const _accessTokenKey = 'mockza_access_token_v1';
  static const _erasureReceiptKey = 'mockza_pending_erasure_v1';

  final SecureStorageGateway _storage;
  final EntropySource _entropy;

  /// Returns an existing device ID or generates and stores a fresh UUIDv4.
  Future<Result<String, Failure>> getOrCreateDeviceId() async {
    final existing = await _storage.read(key: _deviceIdKey);
    switch (existing) {
      case Ok<String?, Failure>(:final value)
          when value != null && value.isNotEmpty:
        return Ok(value);
      case Err<String?, Failure>(:final failure):
        return Err(failure);
      case Ok<String?, Failure>():
        final freshId = _entropy.nextUuidV4();
        final saved = await _storage.write(key: _deviceIdKey, value: freshId);
        return saved.map((_) => freshId);
    }
  }

  /// Reads the server-issued device renewal secret if present.
  Future<String?> readDeviceSecret() async {
    final res = await _storage.read(key: _deviceSecretKey);
    return res.valueOrNull;
  }

  /// Saves the server-issued device renewal secret into secure storage.
  Future<Result<void, Failure>> saveDeviceSecret(String secret) =>
      _storage.write(key: _deviceSecretKey, value: secret);

  /// Reads the cached API access token if present.
  Future<String?> readAccessToken() async {
    final res = await _storage.read(key: _accessTokenKey);
    return res.valueOrNull;
  }

  /// Saves a rotated API access token into secure storage.
  Future<Result<void, Failure>> saveAccessToken(String token) =>
      _storage.write(key: _accessTokenKey, value: token);

  /// Persists an incomplete-erasure receipt so retry works after server device removal (`RR-05`).
  Future<Result<void, Failure>> savePendingErasureReceipt({
    required String erasureId,
    required String receiptToken,
  }) => _storage.write(
    key: _erasureReceiptKey,
    value: jsonEncode({'erasureId': erasureId, 'receiptToken': receiptToken}),
  );

  /// Reads an incomplete-erasure receipt if a prior account deletion returned 503.
  Future<({String erasureId, String receiptToken})?>
  readPendingErasureReceipt() async {
    final res = await _storage.read(key: _erasureReceiptKey);
    final raw = res.valueOrNull;
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) return null;
      final id = decoded['erasureId'] as String?;
      final token = decoded['receiptToken'] as String?;
      if (id == null || id.isEmpty || token == null || token.isEmpty) {
        return null;
      }
      return (erasureId: id, receiptToken: token);
    } on Object {
      return null;
    }
  }

  /// Clears stored session tokens during explicit account deletion/reset.
  Future<Result<void, Failure>> clearCredentials() async {
    final tokenRes = await _storage.delete(key: _accessTokenKey);
    final secretRes = await _storage.delete(key: _deviceSecretKey);
    final idRes = await _storage.delete(key: _deviceIdKey);
    if (tokenRes case Err<void, Failure>()) return tokenRes;
    if (secretRes case Err<void, Failure>()) return secretRes;
    return idRes;
  }

  /// Clears tokens, device secret, device UUID, and erasure receipt on full account deletion.
  Future<Result<void, Failure>> clearAll() async {
    final credRes = await clearCredentials();
    final receiptRes = await _storage.delete(key: _erasureReceiptKey);
    if (credRes case Err<void, Failure>()) return credRes;
    return receiptRes;
  }
}

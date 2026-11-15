import 'dart:convert';

import 'package:clock/clock.dart';
import 'package:dio/dio.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/services/crash_log.dart';
import 'package:mockza/services/secure_identity_service.dart';

/// Coordinates pseudonymous device JWT issuance, refresh, and account deletion.
final class AuthSessionService {
  /// Creates an [AuthSessionService].
  new({
    required EditionConfig config,
    required this._identity,
    required this._clock,
    required this._crashLog,
    Dio? authDio,
    this.appVersion = '1.0.0',
  }) : _config = config,
       _authDio =
           authDio ??
           Dio(
             BaseOptions(
               baseUrl: config.apiBaseUrl,
               connectTimeout: const Duration(
                 microseconds: 15 * Duration.microsecondsPerSecond,
               ),
               receiveTimeout: const Duration(
                 microseconds: 15 * Duration.microsecondsPerSecond,
               ),
               sendTimeout: const Duration(
                 microseconds: 15 * Duration.microsecondsPerSecond,
               ),
               headers: <String, Object?>{
                 'x-mockza-edition': config.edition.code,
                 'accept': 'application/json',
               },
             ),
           );

  final EditionConfig _config;
  final SecureIdentityService _identity;
  final Clock _clock;
  final CrashLog _crashLog;
  final Dio _authDio;

  /// Reported application semantic version sent on device handshake.
  final String appVersion;

  Future<Result<String, Failure>>? _inflightAuth;

  /// Returns a valid bearer access token, performing `POST /v1/auth/anonymous`
  /// when missing or expired. Concurrent callers coalesce onto one network request.
  Future<Result<String, Failure>> ensureAuthenticated({
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh) {
      final existingToken = await _identity.readAccessToken();
      if (existingToken != null &&
          existingToken.isNotEmpty &&
          _isTokenFresh(existingToken)) {
        return Ok(existingToken);
      }
    }

    final inflight = _inflightAuth;
    if (inflight != null && !forceRefresh) {
      return await inflight;
    }

    final future = _performAnonymousAuth();
    _inflightAuth = future;
    try {
      return await future;
    } finally {
      if (identical(_inflightAuth, future)) {
        _inflightAuth = null;
      }
    }
  }

  Future<Result<String, Failure>> _performAnonymousAuth() async {
    final deviceResult = await _identity.getOrCreateDeviceId();
    final String deviceId;
    switch (deviceResult) {
      case Ok<String, Failure>(:final value):
        deviceId = value;
      case Err<String, Failure>(:final failure):
        return Err(failure);
    }

    try {
      final response = await _authDio.post<Map<String, Object?>>(
        '/v1/auth/anonymous',
        data: <String, Object?>{
          'deviceId': deviceId,
          'appVersion': appVersion,
        },
      );
      final data = response.data;
      final token = data?['accessToken'] as String?;
      if (token == null || token.isEmpty) {
        return const Err(
          ValidationFailure('Authentication response missing accessToken'),
        );
      }
      await _identity.saveAccessToken(token);
      _crashLog.info(
        'Authenticated anonymous session for ${_config.edition.code}',
      );
      return Ok(token);
    } on DioException catch (e) {
      return Err(
        NetworkFailure(
          'Anonymous auth failed: ${e.message ?? 'offline'}',
          statusCode: e.response?.statusCode,
        ),
      );
    } on Object catch (e, st) {
      _crashLog.recordError(e, st);
      return const Err(NetworkFailure('Anonymous authentication error'));
    }
  }

  /// Refreshes and returns the bearer token string for [Dio] retry interceptors.
  Future<String?> refreshTokenOrNull() async {
    final res = await ensureAuthenticated(forceRefresh: true);
    return res.valueOrNull;
  }

  /// Calls `DELETE /v1/account` when an authenticated token exists, then clears
  /// stored device credentials so a fresh identity is minted next session.
  Future<Result<void, Failure>> deleteRemoteAccount() async {
    try {
      var token = await _identity.readAccessToken();
      if (token == null || token.isEmpty) {
        final ensured = await ensureAuthenticated();
        token = ensured.valueOrNull;
      }
      if (token != null && token.isNotEmpty) {
        await _authDio.delete<void>(
          '/v1/account',
          options: Options(
            headers: <String, Object?>{'authorization': 'Bearer $token'},
          ),
        );
      }
      await _identity.clearAll();
      return const Ok(null);
    } on DioException catch (e) {
      // Clear local credentials even if server was unreachable so local wipe completes cleanly.
      await _identity.clearAll();
      return Err(
        NetworkFailure(
          'Remote account deletion incomplete: ${e.message ?? 'offline'}',
          statusCode: e.response?.statusCode,
        ),
      );
    } on Object catch (e) {
      await _identity.clearAll();
      return Err(UnexpectedFailure('Account reset error: $e'));
    }
  }

  bool _isTokenFresh(String token) {
    try {
      final parts = token.split('.');
      if (parts.length < 2) return true;
      final rem = parts[1].length % 4;
      final payload = rem == 0
          ? parts[1]
          : parts[1].padRight(parts[1].length + (4 - rem), '=');
      final decoded = utf8.decode(base64Url.decode(payload));
      final map = jsonDecode(decoded);
      if (map is Map<String, Object?> && map['exp'] is num) {
        final expSec = (map['exp']! as num).toInt();
        final nowSec = _clock.now().toUtc().millisecondsSinceEpoch ~/ 1000;
        return expSec > (nowSec + 60);
      }
      return true;
    } on Object {
      return false;
    }
  }
}

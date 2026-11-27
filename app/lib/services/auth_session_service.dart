import 'dart:convert';

import 'package:clock/clock.dart';
import 'package:dio/dio.dart';
import 'package:mockza/core/auth/auth_models.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/services/crash_log.dart';
import 'package:mockza/services/device_meta_platform.dart';
import 'package:mockza/services/secure_identity_service.dart';
import 'package:mockza/services/social_auth_gateway.dart';

/// Coordinates device JWT issuance, account auth (Email/Google/Apple),
/// strict 1-phone + 1-desktop-web slot enforcement, and active session management.
final class AuthSessionService {
  /// Creates an [AuthSessionService].
  new({
    required EditionConfig config,
    required this._identity,
    required this._clock,
    required this._crashLog,
    Dio? authDio,
    SocialAuthGateway? socialAuthGateway,
    DeviceClientMeta Function()? readDeviceMeta,
    this.onRemoteSessionUnlinked,
    this.appVersion = '1.0.0',
  }) : _config = config,
       _socialAuthGateway =
           socialAuthGateway ?? const DefaultSocialAuthGateway(),
       _readDeviceMeta = readDeviceMeta ?? readPlatformDeviceMeta,
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
  final SocialAuthGateway _socialAuthGateway;
  final DeviceClientMeta Function() _readDeviceMeta;

  /// Optional callback invoked when backend reports this device is unlinked after termination.
  final Future<void> Function(String deviceId)? onRemoteSessionUnlinked;

  /// Reported application semantic version sent on auth handshakes.
  final String appVersion;

  Future<Result<String, Failure>>? _inflightAuth;

  /// Returns a valid bearer access token, performing `POST /v1/auth/anonymous`
  /// when missing or expired. Concurrent callers coalesce onto one network request.
  Future<Result<String, Failure>> ensureAuthenticated({
    bool forceRefresh = false,
  }) async {
    if (await _identity.readPendingErasureReceipt() != null) {
      return const Err(
        ValidationFailure(
          'Finish account deletion before starting a new session.',
        ),
      );
    }
    if (!forceRefresh) {
      final existingToken = await _identity.readAccessToken();
      if (existingToken != null &&
          existingToken.isNotEmpty &&
          _isTokenFresh(existingToken)) {
        return Ok(existingToken);
      }
    }

    final inflight = _inflightAuth;
    if (inflight != null) {
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
      final deviceSecret = await _identity.readDeviceSecret();
      final currentToken = await _identity.readAccessToken();
      final response = await _authDio.post<Map<String, Object?>>(
        '/v1/auth/anonymous',
        data: <String, Object?>{
          'deviceId': deviceId,
          'appVersion': appVersion,
          'deviceMeta': _readDeviceMeta().toJson(),
          if (deviceSecret != null && deviceSecret.isNotEmpty)
            'deviceSecret': deviceSecret,
        },
        options: (currentToken != null && currentToken.isNotEmpty)
            ? Options(
                headers: <String, Object?>{
                  'authorization': 'Bearer $currentToken',
                },
              )
            : null,
      );
      final data = response.data;
      final token = data?['accessToken'] as String?;
      if (token == null || token.isEmpty) {
        return const Err(
          ValidationFailure('Authentication response missing accessToken'),
        );
      }
      final returnedSecret = data?['deviceSecret'] as String?;
      if (returnedSecret != null && returnedSecret.isNotEmpty) {
        await _identity.saveDeviceSecret(returnedSecret);
      }
      await _identity.saveAccessToken(token);

      final linkedUserId = data?['linkedUserId'] as String?;
      if ((linkedUserId == null || linkedUserId.isEmpty) &&
          data != null &&
          data.containsKey('linkedUserId')) {
        await onRemoteSessionUnlinked?.call(deviceId);
      }

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

  /// Queries `GET /v1/auth/providers` for configured OAuth/sandbox modes and slot policy.
  Future<Result<AuthProvidersCatalog, Failure>> fetchAuthProviders() async {
    try {
      final res = await _authDio.get<Map<String, Object?>>(
        '/v1/auth/providers',
      );
      final data = res.data;
      if (data == null) {
        return const Ok(AuthProvidersCatalog.fallback);
      }
      return Ok(AuthProvidersCatalog.fromJson(data));
    } on DioException catch (e) {
      return Err(
        _mapDioFailure(
          e,
          fallbackMessage: 'Unable to reach auth configuration.',
        ),
      );
    } on Object catch (e) {
      return Err(NetworkFailure('Auth discovery error: $e'));
    }
  }

  /// Creates an email & password account and claims the caller's device slot.
  Future<Result<AuthSessionResult, Failure>> registerWithEmail({
    required String email,
    required String password,
    String? displayName,
  }) => _submitAuthCredential(
    path: '/v1/auth/register',
    payload: <String, Object?>{
      'email': email.trim(),
      'password': password,
      if (displayName != null && displayName.trim().isNotEmpty)
        'displayName': displayName.trim(),
    },
    fallbackMessage: 'Account registration failed.',
  );

  /// Requests a 6-digit SMS OTP challenge for an Iranian mobile number (`IRN` edition only).
  Future<Result<({int retryAfterSec, String? devOtpHint}), Failure>>
  requestSmsOtp({required String phoneE164}) async {
    try {
      final res = await _authDio.post<Map<String, Object?>>(
        '/v1/auth/otp/request',
        data: <String, Object?>{'phoneE164': phoneE164},
      );
      final data = res.data ?? const <String, Object?>{};
      return Ok((
        retryAfterSec: (data['retryAfterSec'] as num?)?.toInt() ?? 60,
        devOtpHint: data['devOtpHint'] as String?,
      ));
    } on DioException catch (e) {
      return Err(
        _mapDioFailure(
          e,
          fallbackMessage: 'ارسال کد تایید پیامکی ناموفق بود.',
        ),
      );
    } on Object catch (e) {
      return Err(UnexpectedFailure('OTP request error: $e'));
    }
  }

  /// Verifies a `+98` SMS OTP code (`POST /v1/auth/otp/verify`) and claims the caller's device slot.
  Future<Result<AuthSessionResult, Failure>> verifySmsOtp({
    required String phoneE164,
    required String otpCode,
  }) => _submitAuthCredential(
    path: '/v1/auth/otp/verify',
    payload: <String, Object?>{
      'phoneE164': phoneE164,
      'otpCode': EdgeNumerals.toAsciiDigits(otpCode).trim(),
    },
    fallbackMessage: 'کد تایید نامعتبر یا منقضی است.',
  );

  /// Signs in with email & password under strict `1 mobile + 1 desktop_web` enforcement.
  Future<Result<AuthSessionResult, Failure>> signInWithEmail({
    required String email,
    required String password,
  }) => _submitAuthCredential(
    path: '/v1/auth/login',
    payload: <String, Object?>{
      'email': email.trim(),
      'password': password,
    },
    fallbackMessage: 'Sign-in failed.',
  );

  /// Acquires a Google or Apple token via [SocialAuthGateway] and exchanges it with `/v1/auth/oauth`.
  Future<Result<AuthSessionResult, Failure>> signInWithSocial({
    required AuthProviderType provider,
    required SocialProviderDescriptor descriptor,
    DevSocialPersona? sandboxPersona,
  }) async {
    final tokenResult = await _socialAuthGateway.acquireIdToken(
      provider: provider,
      descriptor: descriptor,
      sandboxPersona: sandboxPersona,
    );
    switch (tokenResult) {
      case Err<({String idToken, String? displayName}), Failure>(
        :final failure,
      ):
        return Err(failure);
      case Ok<({String idToken, String? displayName}), Failure>(:final value):
        return await _submitAuthCredential(
          path: '/v1/auth/oauth',
          payload: <String, Object?>{
            'provider': provider.wireValue,
            'idToken': value.idToken,
            if (value.displayName != null &&
                value.displayName!.trim().isNotEmpty)
              'displayName': value.displayName!.trim(),
          },
          fallbackMessage: '${provider.displayLabel} sign-in failed.',
        );
    }
  }

  Future<Result<AuthSessionResult, Failure>> _submitAuthCredential({
    required String path,
    required Map<String, Object?> payload,
    required String fallbackMessage,
  }) async {
    final deviceResult = await _identity.getOrCreateDeviceId();
    final String deviceId;
    switch (deviceResult) {
      case Ok<String, Failure>(:final value):
        deviceId = value;
      case Err<String, Failure>(:final failure):
        return Err(failure);
    }

    try {
      final deviceSecret = await _identity.readDeviceSecret();
      final currentToken = await _identity.readAccessToken();
      final res = await _authDio.post<Map<String, Object?>>(
        path,
        data: <String, Object?>{
          ...payload,
          'deviceId': deviceId,
          'appVersion': appVersion,
          'deviceMeta': _readDeviceMeta().toJson(),
          if (deviceSecret != null && deviceSecret.isNotEmpty)
            'deviceSecret': deviceSecret,
        },
        options: (currentToken != null && currentToken.isNotEmpty)
            ? Options(
                headers: <String, Object?>{
                  'authorization': 'Bearer $currentToken',
                },
              )
            : null,
      );
      final data = res.data;
      if (data == null) {
        return const Err(ValidationFailure('Empty authentication response.'));
      }
      final bundle = AuthSessionResult.fromJson(data);
      if (bundle.accessToken.isEmpty) {
        return const Err(
          ValidationFailure('Authentication response missing accessToken.'),
        );
      }
      if (bundle.deviceSecret != null && bundle.deviceSecret!.isNotEmpty) {
        await _identity.saveDeviceSecret(bundle.deviceSecret!);
      }
      await _identity.saveAccessToken(bundle.accessToken);
      return Ok(bundle);
    } on DioException catch (e) {
      return Err(_mapDioFailure(e, fallbackMessage: fallbackMessage));
    } on Object catch (e) {
      return Err(UnexpectedFailure('Authentication error: $e'));
    }
  }

  /// Signs out the current device on the server (`POST /v1/auth/logout`) and stores downgraded token.
  Future<Result<void, Failure>> signOutCurrentDevice() async {
    final res = await _authorizedCall<Map<String, Object?>>(
      (headers) => _authDio.post<Map<String, Object?>>(
        '/v1/auth/logout',
        options: Options(headers: headers),
      ),
      fallbackMessage: 'Sign-out failed.',
    );
    switch (res) {
      case Err<Map<String, Object?>, Failure>(:final failure):
        return Err(failure);
      case Ok<Map<String, Object?>, Failure>(:final value):
        final newToken = value['accessToken'] as String?;
        final deviceId = value['deviceId'] as String?;
        if (newToken != null && newToken.isNotEmpty) {
          await _identity.saveAccessToken(newToken);
        }
        if (deviceId != null && deviceId.isNotEmpty) {
          await onRemoteSessionUnlinked?.call(deviceId);
        }
        return const Ok(null);
    }
  }

  /// Fetches active signed-in devices & slot occupancy (`GET /v1/account/devices`).
  Future<Result<AccountSessionsSnapshot, Failure>>
  fetchAccountSessions() async {
    final res = await _authorizedCall<Map<String, Object?>>(
      (headers) => _authDio.get<Map<String, Object?>>(
        '/v1/account/devices',
        options: Options(headers: headers),
      ),
      fallbackMessage: 'Could not load signed-in devices.',
    );
    return res.map(AccountSessionsSnapshot.fromJson);
  }

  /// Remotely terminates [targetDeviceId] via `DELETE /v1/account/devices/:targetDeviceId`.
  Future<
    Result<
      ({
        List<String> revokedDeviceIds,
        bool signedOutCurrentDevice,
        List<DeviceSessionInfo> sessions,
      }),
      Failure
    >
  >
  terminateDeviceSession(String targetDeviceId) async {
    final res = await _authorizedCall<Map<String, Object?>>(
      (headers) => _authDio.delete<Map<String, Object?>>(
        '/v1/account/devices/$targetDeviceId',
        options: Options(headers: headers),
      ),
      fallbackMessage: 'Could not terminate selected device.',
    );
    switch (res) {
      case Err<Map<String, Object?>, Failure>(:final failure):
        return Err(failure);
      case Ok<Map<String, Object?>, Failure>(:final value):
        final revoked =
            (value['revokedDeviceIds'] as List<Object?>? ?? const [])
                .whereType<String>()
                .toList(growable: false);
        final signedOutSelf = value['signedOutCurrentDevice'] == true;
        final sessions = (value['sessions'] as List<Object?>? ?? const [])
            .whereType<Map<String, Object?>>()
            .map(DeviceSessionInfo.fromJson)
            .toList(growable: false);
        if (signedOutSelf) {
          await ensureAuthenticated(forceRefresh: true);
        }
        return Ok((
          revokedDeviceIds: revoked,
          signedOutCurrentDevice: signedOutSelf,
          sessions: sessions,
        ));
    }
  }

  /// Terminates all signed-in devices except this one (`POST /v1/account/devices/revoke-others`).
  Future<Result<List<DeviceSessionInfo>, Failure>>
  terminateOtherSessions() async {
    final res = await _authorizedCall<Map<String, Object?>>(
      (headers) => _authDio.post<Map<String, Object?>>(
        '/v1/account/devices/revoke-others',
        options: Options(headers: headers),
      ),
      fallbackMessage: 'Could not sign out other devices.',
    );
    return res.map((data) {
      final raw = data['sessions'] as List<Object?>? ?? const [];
      return raw
          .whereType<Map<String, Object?>>()
          .map(DeviceSessionInfo.fromJson)
          .toList(growable: false);
    });
  }

  /// Records acceptance of the strict 1-phone + 1-desktop-web policy before subscribing.
  Future<Result<AccountUserSummary, Failure>>
  recordDevicePolicyConsent() async {
    final res = await _authorizedCall<Map<String, Object?>>(
      (headers) => _authDio.post<Map<String, Object?>>(
        '/v1/account/device-policy-consent',
        options: Options(headers: headers),
      ),
      fallbackMessage: 'Could not save subscription policy consent.',
    );
    return res.map(AccountUserSummary.fromJson);
  }

  Future<Result<T, Failure>> _authorizedCall<T>(
    Future<Response<T>> Function(Map<String, Object?> headers) requestFn, {
    required String fallbackMessage,
  }) async {
    final authRes = await ensureAuthenticated();
    var token = authRes.valueOrNull;
    if (token == null || token.isEmpty) {
      return Err(
        authRes.failureOrNull ??
            const UnauthorizedFailure('Authentication required.'),
      );
    }

    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        final response = await requestFn(<String, Object?>{
          'authorization': 'Bearer $token',
        });
        final data = response.data;
        if (data == null) {
          return const Err(ValidationFailure('Empty server response.'));
        }
        return Ok(data);
      } on DioException catch (e) {
        if (e.response?.statusCode == 401 && attempt == 0) {
          final refreshed = await ensureAuthenticated(forceRefresh: true);
          final freshToken = refreshed.valueOrNull;
          if (freshToken != null && freshToken.isNotEmpty) {
            token = freshToken;
            continue;
          }
        }
        return Err(_mapDioFailure(e, fallbackMessage: fallbackMessage));
      } on Object catch (e) {
        return Err(UnexpectedFailure('$fallbackMessage ($e)'));
      }
    }
    return Err(UnexpectedFailure(fallbackMessage));
  }

  /// Refreshes and returns the bearer token string for [Dio] retry interceptors.
  Future<String?> refreshTokenOrNull() async {
    final res = await ensureAuthenticated(forceRefresh: true);
    return res.valueOrNull;
  }

  /// Calls `DELETE /v1/account` or resumes an existing partial erasure receipt via
  /// `POST /v1/erasure/:erasureId/retry`, retaining its receipt until local erasure completes.
  Future<Result<void, Failure>> deleteRemoteAccount() async {
    try {
      final pendingReceipt = await _identity.readPendingErasureReceipt();
      if (pendingReceipt != null) {
        await _authDio.post<void>(
          '/v1/erasure/${pendingReceipt.erasureId}/retry',
          options: Options(
            headers: <String, Object?>{
              'x-erasure-receipt': pendingReceipt.receiptToken,
            },
          ),
        );
        final cleared = await _identity.clearCredentials();
        if (cleared case Err<void, Failure>(:final failure)) {
          return Err(failure);
        }
        return const Ok(null);
      }

      var token = await _identity.readAccessToken();
      if (token == null || token.isEmpty) {
        final ensured = await ensureAuthenticated();
        switch (ensured) {
          case Ok<String, Failure>(:final value):
            token = value;
          case Err<String, Failure>(:final failure):
            return Err(failure);
        }
      }
      if (token.isNotEmpty) {
        final response = await _authDio.delete<Map<String, Object?>>(
          '/v1/account',
          options: Options(
            headers: <String, Object?>{'authorization': 'Bearer $token'},
          ),
        );
        final erasureId = response.data?['erasureId'] as String?;
        final receiptToken = response.data?['receiptToken'] as String?;
        if (erasureId == null ||
            erasureId.isEmpty ||
            receiptToken == null ||
            receiptToken.isEmpty) {
          return const Err(
            ValidationFailure('Account deletion receipt was not returned.'),
          );
        }
        final saved = await _identity.savePendingErasureReceipt(
          erasureId: erasureId,
          receiptToken: receiptToken,
        );
        if (saved case Err<void, Failure>(:final failure)) return Err(failure);
      }
      final cleared = await _identity.clearCredentials();
      if (cleared case Err<void, Failure>(:final failure)) {
        return Err(failure);
      }
      return const Ok(null);
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      final body = e.response?.data;
      if (status == 503 && body is Map) {
        final erasureId = body['erasureId'] as String?;
        final receiptToken = body['receiptToken'] as String?;
        if (erasureId != null &&
            erasureId.isNotEmpty &&
            receiptToken != null &&
            receiptToken.isNotEmpty) {
          final saved = await _identity.savePendingErasureReceipt(
            erasureId: erasureId,
            receiptToken: receiptToken,
          );
          if (saved case Err<void, Failure>(:final failure)) {
            return Err(failure);
          }
          // Revoked DB device credentials are no longer usable; clear them and rely on receipt (`RR-05`).
          final cleared = await _identity.clearCredentials();
          if (cleared case Err<void, Failure>(:final failure)) {
            return Err(failure);
          }
        }
      }
      return Err(
        NetworkFailure(
          'Remote account deletion failed: ${e.message ?? 'offline'}',
          statusCode: status,
        ),
      );
    } on Object catch (e) {
      return Err(UnexpectedFailure('Account deletion error: $e'));
    }
  }

  Failure _mapDioFailure(
    DioException e, {
    required String fallbackMessage,
  }) {
    final status = e.response?.statusCode;
    final body = e.response?.data;
    String? serverCode;
    String? serverMessage;
    Map<String, Object?>? details;

    if (body is Map<Object?, Object?>) {
      serverCode = body['code'] as String?;
      serverMessage = body['message'] as String?;
      final rawDetails = body['details'];
      if (rawDetails is Map<Object?, Object?>) {
        details = rawDetails.map(
          (k, v) => MapEntry(k?.toString() ?? '', v),
        );
      }
    }

    final resolvedMessage =
        (serverMessage != null && serverMessage.trim().isNotEmpty)
        ? serverMessage
        : fallbackMessage;

    if (status == 409 &&
        serverCode == 'device_slot_limit_reached' &&
        details != null) {
      return DeviceSlotLimitFailure(
        resolvedMessage,
        conflict: OccupyingDeviceConflict.fromErrorDetails(details),
      );
    }
    if (status == 401 || serverCode == 'invalid_credentials') {
      return UnauthorizedFailure(resolvedMessage);
    }
    if (status == 400 || status == 409) {
      return ValidationFailure(resolvedMessage);
    }
    return NetworkFailure(
      resolvedMessage,
      statusCode: status,
    );
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

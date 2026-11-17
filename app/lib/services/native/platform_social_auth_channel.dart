import 'package:flutter/services.dart';
import 'package:mockza/core/auth/auth_models.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';

/// Quarantined native platform-channel bridge for Google Sign-In and Sign in with Apple
/// when native SDK credentials are configured.
final class PlatformSocialAuthChannel {
  /// Creates a [PlatformSocialAuthChannel].
  const new([
    this._channel = const MethodChannel('com.mockza/social_auth'),
  ]);

  final MethodChannel _channel;

  /// Requests an OIDC ID token from native Google Play Services or ASAuthorization.
  Future<Result<({String idToken, String? displayName}), Failure>>
  requestProviderIdToken({
    required AuthProviderType provider,
    required String clientId,
  }) async {
    try {
      final res = await _channel.invokeMapMethod<String, Object?>(
        'signInWithProvider',
        <String, Object?>{
          'provider': provider.wireValue,
          'clientId': clientId,
        },
      );
      final idToken = res?['idToken'] as String?;
      if (idToken == null || idToken.trim().isEmpty) {
        return Err(
          UnauthorizedFailure(
            '${provider.displayLabel} sign-in did not return an ID token.',
          ),
        );
      }
      return Ok((
        idToken: idToken.trim(),
        displayName: res?['displayName'] as String?,
      ));
    } on MissingPluginException {
      return Err(
        ValidationFailure(
          'Native ${provider.displayLabel} SDK handler is not installed yet. Configure the native runner or use Dev Sandbox in development.',
        ),
      );
    } on PlatformException catch (e) {
      return Err(
        UnauthorizedFailure(
          '${provider.displayLabel} sign-in cancelled or failed: ${e.message ?? e.code}',
        ),
      );
    }
  }
}

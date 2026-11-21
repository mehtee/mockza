import 'dart:async';

import 'package:mockza/core/auth/auth_models.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:web/web.dart' as web;

/// Launches live OIDC ID token authentication popup flow on Web when client IDs are configured.
Future<Result<({String idToken, String? displayName}), Failure>>
performPlatformOidcSignIn({
  required AuthProviderType provider,
  required String clientId,
}) async {
  try {
    final origin = web.window.location.origin;
    final nonce =
        'mz_${DateTime.fromMillisecondsSinceEpoch(0).millisecond}_${clientId.hashCode}';
    final authUrl = switch (provider) {
      AuthProviderType.google => Uri.https(
        'accounts.google.com',
        '/o/oauth2/v2/auth',
        <String, String>{
          'client_id': clientId,
          'redirect_uri': '$origin/',
          'response_type': 'id_token',
          'scope': 'openid email profile',
          'nonce': nonce,
          'prompt': 'select_account',
        },
      ),
      AuthProviderType.apple => Uri.https(
        'appleid.apple.com',
        '/auth/authorize',
        <String, String>{
          'client_id': clientId,
          'redirect_uri': '$origin/',
          'response_type': 'code id_token',
          'response_mode': 'fragment',
          'scope': 'name email',
          'nonce': nonce,
        },
      ),
      AuthProviderType.email || AuthProviderType.smsOtp => null,
    };
    if (authUrl == null) {
      return const Err(ValidationFailure('Unsupported Web OAuth provider.'));
    }

    final popup = web.window.open(
      authUrl.toString(),
      'mockza_oauth_popup',
      'width=500,height=640,menubar=no,toolbar=no',
    );
    if (popup == null) {
      return const Err(
        ValidationFailure(
          'Browser blocked the sign-in popup window. Allow popups for Mockza and retry.',
        ),
      );
    }

    const deadlineTicks = 240; // ~60s polling every 250ms
    for (var i = 0; i < deadlineTicks; i++) {
      await Future<void>.delayed(const Duration(milliseconds: 250));
      if (popup.closed) {
        return Err(
          UnauthorizedFailure(
            '${provider.displayLabel} sign-in window was closed before completion.',
          ),
        );
      }
      try {
        final popupOrigin = popup.location.origin;
        if (popupOrigin == origin) {
          final hash = popup.location.hash;
          final query = popup.location.search;
          final fragmentParams = Uri.splitQueryString(
            hash.startsWith('#') ? hash.substring(1) : hash,
          );
          final queryParams = Uri.splitQueryString(
            query.startsWith('?') ? query.substring(1) : query,
          );
          final idToken = fragmentParams['id_token'] ?? queryParams['id_token'];
          final error = fragmentParams['error'] ?? queryParams['error'];
          popup.close();
          if (error != null && error.isNotEmpty) {
            return Err(
              UnauthorizedFailure(
                '${provider.displayLabel} sign-in error: $error',
              ),
            );
          }
          if (idToken != null && idToken.trim().isNotEmpty) {
            return Ok((idToken: idToken.trim(), displayName: null));
          }
          return Err(
            UnauthorizedFailure(
              '${provider.displayLabel} callback did not contain an ID token.',
            ),
          );
        }
      } on Object {
        // Expected cross-origin DOM exception while user authenticates on accounts.google.com / appleid.apple.com.
      }
    }

    popup.close();
    return Err(
      TimeoutFailure('${provider.displayLabel} sign-in timed out.'),
    );
  } on Object catch (e) {
    return Err(NetworkFailure('Web OAuth launch failed: $e'));
  }
}

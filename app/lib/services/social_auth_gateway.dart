import 'dart:convert';

import 'package:mockza/core/auth/auth_models.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/services/social_auth_native.dart'
    if (dart.library.js_interop) 'package:mockza/services/social_auth_web.dart'
    as platform;

/// Obtains a provider ID token (either live OIDC token or dev-mode sandbox token)
/// decoupled behind an interface so UI & auth service obey DIP/OCP.
abstract interface class SocialAuthGateway {
  /// Acquires an ID token for [provider] under [descriptor], using [sandboxPersona] when in dev sandbox mode.
  Future<Result<({String idToken, String? displayName}), Failure>>
  acquireIdToken({
    required AuthProviderType provider,
    required SocialProviderDescriptor descriptor,
    DevSocialPersona? sandboxPersona,
  });
}

/// Default [SocialAuthGateway] supporting both configured OIDC client IDs
/// (`--dart-define=GOOGLE_OAUTH_CLIENT_ID` / `APPLE_OAUTH_CLIENT_ID` or server descriptor)
/// and local dev sandbox personas.
final class DefaultSocialAuthGateway implements SocialAuthGateway {
  /// Creates a [DefaultSocialAuthGateway].
  const new();

  static const _compileGoogleClientId = String.fromEnvironment(
    'GOOGLE_OAUTH_CLIENT_ID',
  );
  static const _compileAppleClientId = String.fromEnvironment(
    'APPLE_OAUTH_CLIENT_ID',
  );

  /// Encodes a dev-mode OAuth sandbox token accepted ONLY when `ALLOW_DEV_AUTH_PROVIDERS=true` outside production.
  static String encodeDevSandboxToken({
    required AuthProviderType provider,
    required DevSocialPersona persona,
  }) {
    final jsonPayload = jsonEncode(<String, Object?>{
      'provider': provider.wireValue,
      'sub': persona.sub,
      'email': persona.email,
      'name': persona.displayName,
    });
    final encoded = base64Url
        .encode(utf8.encode(jsonPayload))
        .replaceAll('=', '');
    return 'mockza_dev_oauth_v1.$encoded';
  }

  @override
  Future<Result<({String idToken, String? displayName}), Failure>>
  acquireIdToken({
    required AuthProviderType provider,
    required SocialProviderDescriptor descriptor,
    DevSocialPersona? sandboxPersona,
  }) async {
    if (provider == AuthProviderType.email) {
      return const Err(
        ValidationFailure('Use email & password form directly.'),
      );
    }

    if (descriptor.mode == SocialProviderMode.devSandbox) {
      final persona =
          sandboxPersona ??
          DevSocialPersona(
            sub: 'dev-${provider.wireValue}-learner-01',
            email: '${provider.wireValue}.dev@mockza.test',
            displayName: 'Mockza ${provider.displayLabel} Dev',
          );
      return Ok((
        idToken: encodeDevSandboxToken(provider: provider, persona: persona),
        displayName: persona.displayName,
      ));
    }

    final compileClientId = provider == AuthProviderType.google
        ? _compileGoogleClientId
        : _compileAppleClientId;
    final resolvedClientId = (descriptor.clientId?.trim().isNotEmpty ?? false)
        ? descriptor.clientId!.trim()
        : compileClientId.trim();

    if (!descriptor.enabled ||
        descriptor.mode == SocialProviderMode.disabled ||
        resolvedClientId.isEmpty) {
      return Err(
        ValidationFailure(
          '${provider.displayLabel} Sign-In client ID is not configured yet.',
        ),
      );
    }

    return await platform.performPlatformOidcSignIn(
      provider: provider,
      clientId: resolvedClientId,
    );
  }
}

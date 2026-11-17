import 'package:mockza/core/auth/auth_models.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/services/native/platform_social_auth_channel.dart';

/// Launches live OIDC sign-in on Native (iOS / Android) via [PlatformSocialAuthChannel].
Future<Result<({String idToken, String? displayName}), Failure>>
performPlatformOidcSignIn({
  required AuthProviderType provider,
  required String clientId,
  PlatformSocialAuthChannel? channel,
}) {
  final bridge = channel ?? const PlatformSocialAuthChannel();
  return bridge.requestProviderIdToken(
    provider: provider,
    clientId: clientId,
  );
}

import 'package:meta/meta.dart';

/// Build flavor / regional compliance edition selected at the app entrypoint.
enum AppEdition {
  /// Global distribution (`glb`): LTR English, RevenueCat/StoreKit/Play Billing.
  global('glb'),

  /// Iran distribution (`irn`): Bazaar/Myket billing & IR-hosted CDN endpoints.
  iran('irn');

  new(this.code);

  /// Wire code sent to backend headers (`x-mockza-edition`).
  final String code;
}

/// Immutable runtime configuration injected from `main_global` or `main_iran`.
@immutable
class EditionConfig {
  /// Creates an [EditionConfig].
  const new({
    required this.edition,
    required this.apiBaseUrl,
    required this.enableTelemetry,
  });

  static const _globalApiBaseUrl = String.fromEnvironment(
    'MOCKZA_API_BASE_URL',
  );

  static const _iranApiBaseUrl = String.fromEnvironment('MOCKZA_API_BASE_URL');

  /// Default global flavor configuration.
  static const globalDefault = EditionConfig(
    edition: AppEdition.global,
    apiBaseUrl: _globalApiBaseUrl,
    enableTelemetry: true,
  );

  /// Default Iran flavor configuration.
  static const iranDefault = EditionConfig(
    edition: AppEdition.iran,
    apiBaseUrl: _iranApiBaseUrl,
    enableTelemetry: true,
  );

  /// Active distribution edition.
  final AppEdition edition;

  /// Base URL of the TypeScript Hono API backend. Empty means same-origin proxy.
  final String apiBaseUrl;

  /// Whether anonymized product analytics events are permitted.
  final bool enableTelemetry;

  /// Resolves an API or S3 media path (e.g. `media/writing/task1_chart.svg` or
  /// `/v1/media/...`) into a full request URL using [apiBaseUrl].
  String resolveMediaUrl(String objectKeyOrPath) {
    if (objectKeyOrPath.startsWith('http://') ||
        objectKeyOrPath.startsWith('https://')) {
      return objectKeyOrPath;
    }
    final normalizedPath = objectKeyOrPath.startsWith('/v1/')
        ? objectKeyOrPath
        : '/v1/media/${objectKeyOrPath.startsWith('/') ? objectKeyOrPath.substring(1) : objectKeyOrPath}';
    if (apiBaseUrl.isEmpty) {
      return normalizedPath;
    }
    final base = apiBaseUrl.endsWith('/')
        ? apiBaseUrl.substring(0, apiBaseUrl.length - 1)
        : apiBaseUrl;
    return '$base$normalizedPath';
  }
}

import 'package:dio/dio.dart';
import 'package:mockza/core/config/edition_config.dart';

bool _isSameApiOrigin(RequestOptions options, EditionConfig config) {
  final rawPath = options.path;
  if (!rawPath.startsWith('http://') && !rawPath.startsWith('https://')) {
    return true;
  }
  final reqUri = Uri.tryParse(rawPath);
  if (reqUri == null) return false;

  if (config.apiBaseUrl.isEmpty) {
    return reqUri.scheme == Uri.base.scheme &&
        reqUri.host == Uri.base.host &&
        reqUri.port == Uri.base.port;
  }

  final apiUri = Uri.tryParse(config.apiBaseUrl);
  if (apiUri == null || apiUri.host.isEmpty) {
    return false;
  }
  return reqUri.scheme == apiUri.scheme &&
      reqUri.host == apiUri.host &&
      reqUri.port == apiUri.port;
}

/// Builds the preconfigured [Dio] HTTP client for the Mockza API with bearer auth
/// injection scoped strictly to the configured API origin and 401 refresh support.
Dio createApiDioClient({
  required EditionConfig config,
  required Future<String?> Function() readAccessToken,
  Future<String?> Function()? refreshAccessToken,
}) {
  const timeout = Duration(
    microseconds: 15 * Duration.microsecondsPerSecond,
  );
  final dio = Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: timeout,
      receiveTimeout: timeout,
      sendTimeout: timeout,
      headers: <String, Object?>{
        'x-mockza-edition': config.edition.code,
        'accept': 'application/json',
      },
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final sameOrigin = _isSameApiOrigin(options, config);
        final isAuthRoute = options.path.contains('/v1/auth/');
        final isSignedPut = options.path.contains('/v1/uploads/signed-put');
        final skipAuth = options.extra['_skipAuth'] == true;

        if (!sameOrigin || isSignedPut || skipAuth) {
          // Never send API credentials or custom edition headers to presigned S3 / external CDNs.
          options.headers.remove('authorization');
          options.headers.remove('x-mockza-edition');
        } else if (!isAuthRoute) {
          final token = await readAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['authorization'] = 'Bearer $token';
          }
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        final status = error.response?.statusCode;
        final request = error.requestOptions;
        final sameOrigin = _isSameApiOrigin(request, config);
        final alreadyRetried = request.extra['_authRetried'] == true;
        final isAuthRoute = request.path.contains('/v1/auth/');
        final isUploadRoute = request.path.contains('/v1/uploads/signed-put');

        if (sameOrigin &&
            status == 401 &&
            !alreadyRetried &&
            !isAuthRoute &&
            !isUploadRoute &&
            refreshAccessToken != null) {
          final freshToken = await refreshAccessToken();
          if (freshToken != null && freshToken.isNotEmpty) {
            request.extra['_authRetried'] = true;
            request.headers['authorization'] = 'Bearer $freshToken';
            try {
              final retried = await dio.fetch<Object?>(request);
              return handler.resolve(retried);
            } on DioException catch (retryError) {
              return handler.next(retryError);
            }
          }
        }
        handler.next(error);
      },
    ),
  );

  return dio;
}

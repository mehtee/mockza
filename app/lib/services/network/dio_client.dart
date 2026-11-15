import 'package:dio/dio.dart';
import 'package:mockza/core/config/edition_config.dart';

/// Builds the preconfigured [Dio] HTTP client for the Mockza API with bearer auth
/// injection and automatic 401 token refresh support.
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
        // Signed S3 / proxy PUT uploads carry their own query signature and should
        // not accidentally forward an Authorization header unless same-origin needs it.
        if (!options.path.contains('/v1/auth/')) {
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
        final alreadyRetried = request.extra['_authRetried'] == true;
        final isAuthRoute = request.path.contains('/v1/auth/');
        final isUploadRoute = request.path.contains('/v1/uploads/signed-put');

        if (status == 401 &&
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

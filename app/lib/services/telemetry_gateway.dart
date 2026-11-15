import 'package:clock/clock.dart';
import 'package:dio/dio.dart';
import 'package:mockza/core/config/edition_config.dart';

/// Gateway contract for anonymous telemetry events respecting user opt-out.
abstract interface class TelemetryGateway {
  /// Sends a non-PII domain event [eventName] with scalar [properties].
  Future<void> captureEvent(
    String eventName, {
    Map<String, Object?> properties = const <String, Object?>{},
  });
}

/// Batched/async HTTP telemetry adapter controlled by [EditionConfig.enableTelemetry].
final class HttpTelemetryGateway implements TelemetryGateway {
  /// Creates an [HttpTelemetryGateway].
  const new({
    required this._dio,
    required this._config,
    Clock? clock,
  }) : _clock = clock ?? const Clock();

  final Dio _dio;
  final EditionConfig _config;
  final Clock _clock;

  @override
  Future<void> captureEvent(
    String eventName, {
    Map<String, Object?> properties = const <String, Object?>{},
  }) async {
    if (!_config.enableTelemetry) return;
    try {
      await _dio.post<void>(
        '/v1/events',
        data: <String, Object?>{
          'events': <Map<String, Object?>>[
            <String, Object?>{
              'eventName': eventName,
              'properties': <String, Object?>{
                ...properties,
                'edition': _config.edition.code,
              },
              'timestamp': _clock.now().toUtc().toIso8601String(),
            },
          ],
        },
      );
    } on DioException {
      // Non-critical telemetry drops never disrupt learner workflows.
    }
  }
}

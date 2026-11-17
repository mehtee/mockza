import 'package:meta/meta.dart';
import 'package:mockza/core/auth/auth_models.dart';

/// Base sealed failure hierarchy for domain, storage, and gateway operations.
@immutable
sealed class Failure {
  /// Creates a [Failure] with a human-readable diagnostic [message].
  const new(this.message);

  /// Diagnostic summary intended for logs and error mapping (never raw secrets).
  final String message;

  /// Machine-readable stable code for analytics and L10n lookup.
  String get code;

  @override
  String toString() => 'Failure($code): $message';
}

/// Connectivity, DNS, TLS, or HTTP transport failure.
final class NetworkFailure extends Failure {
  /// Creates a [NetworkFailure].
  const new(super.message, {this.statusCode});

  /// HTTP status code if a response was received.
  final int? statusCode;

  @override
  String get code => 'network_error';
}

/// Operation exceeded its configured timeout budget.
final class TimeoutFailure extends Failure {
  /// Creates a [TimeoutFailure].
  const new(super.message);

  @override
  String get code => 'timeout';
}

/// Missing or invalid device/session authorization credential.
final class UnauthorizedFailure extends Failure {
  /// Creates an [UnauthorizedFailure].
  const new(super.message);

  @override
  String get code => 'unauthorized';
}

/// Pro subscription entitlement required for requested AI action (`HTTP 402`).
final class EntitlementRequiredFailure extends Failure {
  /// Creates an [EntitlementRequiredFailure].
  const new(super.message);

  @override
  String get code => 'entitlement_required';
}

/// Remote AI evaluation or daily usage quota has been exhausted.
final class QuotaExceededFailure extends Failure {
  /// Creates a [QuotaExceededFailure].
  const new(super.message, {this.retryAfterSeconds});

  /// Optional server hint in seconds until quota replenishes.
  final int? retryAfterSeconds;

  @override
  String get code => 'quota_exceeded';
}

/// Local SQLite, file system, or secure keystore read/write failure.
final class StorageFailure extends Failure {
  /// Creates a [StorageFailure].
  const new(super.message);

  @override
  String get code => 'storage_error';
}

/// Domain or payload validation failure (e.g., corrupted checksum or audio limit).
final class ValidationFailure extends Failure {
  /// Creates a [ValidationFailure].
  const new(super.message);

  @override
  String get code => 'validation_error';
}

/// Account already has the maximum allowed active device(s) in this slot (`HTTP 409`).
final class DeviceSlotLimitFailure extends Failure {
  /// Creates a [DeviceSlotLimitFailure].
  const new(super.message, {this.conflict});

  /// Details about the already-signed-in device occupying the slot.
  final OccupyingDeviceConflict? conflict;

  @override
  String get code => 'device_slot_limit_reached';
}

/// Fallback failure when an unexpected boundary error occurs.
final class UnexpectedFailure extends Failure {
  /// Creates an [UnexpectedFailure].
  const new(super.message);

  @override
  String get code => 'unexpected_error';
}

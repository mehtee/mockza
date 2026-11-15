import 'package:meta/meta.dart';
import 'package:mockza/core/result/failure.dart';

/// Discriminated union representing either a success value [Ok] or a [Failure] in [Err].
@immutable
sealed class Result<T, F extends Failure> {
  /// Creates a [Result].
  const new();

  /// Returns `true` when this result is [Ok].
  bool get isOk => this is Ok<T, F>;

  /// Alias for [isOk].
  bool get isSuccess => isOk;

  /// Returns `true` when this result is [Err].
  bool get isErr => this is Err<T, F>;

  /// Alias for [isErr].
  bool get isFailure => isErr;

  /// Returns the wrapped value if [Ok], otherwise `null`.
  T? get valueOrNull => switch (this) {
    Ok<T, F>(:final value) => value,
    Err<T, F>() => null,
  };

  /// Returns the wrapped failure if [Err], otherwise `null`.
  F? get failureOrNull => switch (this) {
    Ok<T, F>() => null,
    Err<T, F>(:final failure) => failure,
  };

  /// Matches both outcomes using `success` and `failure` callbacks.
  R when<R>({
    required R Function(T value) success,
    required R Function(F failure) failure,
  }) => switch (this) {
    Ok<T, F>(:final value) => success(value),
    Err<T, F>(failure: final err) => failure(err),
  };

  /// Matches both outcomes and returns a single typed value [R].
  R fold<R>({
    required R Function(T value) onOk,
    required R Function(F failure) onErr,
  }) => switch (this) {
    Ok<T, F>(:final value) => onOk(value),
    Err<T, F>(:final failure) => onErr(failure),
  };

  /// Transforms the success value while preserving any [Err] failure.
  @useResult
  Result<R, F> map<R>(R Function(T value) transform) => switch (this) {
    Ok<T, F>(:final value) => Ok<R, F>(transform(value)),
    Err<T, F>(:final failure) => Err<R, F>(failure),
  };
}

/// Successful [Result] containing [value].
final class Ok<T, F extends Failure> extends Result<T, F> {
  /// Creates an [Ok] result wrapping [value].
  const new(this.value);

  /// The successful payload.
  final T value;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Ok<T, F> &&
          runtimeType == other.runtimeType &&
          value == other.value;

  @override
  int get hashCode => value.hashCode;
}

/// Failed [Result] containing typed [failure].
final class Err<T, F extends Failure> extends Result<T, F> {
  /// Creates an [Err] result wrapping [failure].
  const new(this.failure);

  /// Typed failure details.
  final F failure;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Err<T, F> &&
          runtimeType == other.runtimeType &&
          failure == other.failure;

  @override
  int get hashCode => failure.hashCode;
}

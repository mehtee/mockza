import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:test/test.dart';

void main() {
  group('Result<T, F> exhaustive sealed types', () {
    test(
      'Ok holds value, isOk = true, isErr = false, valueOrNull returns value',
      () {
        const Result<int, Failure> result = Ok(42);

        expect(result.isOk, isTrue);
        expect(result.isErr, isFalse);
        expect(result.valueOrNull, 42);

        final folded = result.fold(
          onOk: (v) => 'success: $v',
          onErr: (f) => 'failure: ${f.message}',
        );
        expect(folded, 'success: 42');

        final mapped = result.map((v) => v * 2);
        expect(mapped, const Ok<int, Failure>(84));
      },
    );

    test(
      'Err holds failure, isOk = false, isErr = true, valueOrNull returns null',
      () {
        const failure = NetworkFailure('Connection refused', statusCode: 503);
        const Result<int, Failure> result = Err(failure);

        expect(result.isOk, isFalse);
        expect(result.isErr, isTrue);
        expect(result.valueOrNull, isNull);

        final folded = result.fold(
          onOk: (v) => 'success: $v',
          onErr: (f) => 'failure: ${f.code} - ${f.message}',
        );
        expect(folded, 'failure: network_error - Connection refused');

        final mapped = result.map((v) => v * 2);
        expect(mapped, const Err<int, Failure>(failure));
      },
    );

    test('Ok value equality and hashCode', () {
      const ok1 = Ok<String, Failure>('token-abc');
      const ok2 = Ok<String, Failure>('token-abc');
      const ok3 = Ok<String, Failure>('token-xyz');

      expect(ok1, equals(ok2));
      expect(ok1.hashCode, equals(ok2.hashCode));
      expect(ok1, isNot(equals(ok3)));
    });

    test('Err failure equality and hashCode', () {
      const err1 = Err<int, Failure>(QuotaExceededFailure('Limit reached'));
      const err2 = Err<int, Failure>(QuotaExceededFailure('Limit reached'));
      const err3 = Err<int, Failure>(UnauthorizedFailure('Bad token'));

      expect(err1, equals(err2));
      expect(err1.hashCode, equals(err2.hashCode));
      expect(err1, isNot(equals(err3)));
    });

    test('Failure subclasses have stable machine codes', () {
      expect(const NetworkFailure('net').code, 'network_error');
      expect(const TimeoutFailure('time').code, 'timeout');
      expect(const UnauthorizedFailure('auth').code, 'unauthorized');
      expect(const QuotaExceededFailure('quota').code, 'quota_exceeded');
      expect(const StorageFailure('store').code, 'storage_error');
      expect(const ValidationFailure('val').code, 'validation_error');
      expect(const UnexpectedFailure('unexp').code, 'unexpected_error');
    });
  });
}

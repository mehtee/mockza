import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/services/auth_session_service.dart';
import 'package:mockza/services/crash_log.dart';
import 'package:mockza/services/secure_identity_service.dart';
import 'package:test/test.dart';

import '../support/fakes.dart';

void main() {
  test(
    'credential deletion failure retains the erasure receipt for retry',
    () async {
      final storage = _FailingStorage();
      final identity = SecureIdentityService(
        storage: storage,
        entropy: FixedEntropySource(),
      );
      await identity.savePendingErasureReceipt(
        erasureId: 'erase-1',
        receiptToken: 'receipt-1',
      );
      storage.failCredentialDelete = true;
      expect((await identity.clearAll()).isFailure, isTrue);
      expect(await identity.readPendingErasureReceipt(), isNotNull);
    },
  );

  test(
    'receipt persistence failure does not silently clear revoked credentials',
    () async {
      final storage = _FailingStorage()..failReceiptWrite = true;
      final identity = SecureIdentityService(
        storage: storage,
        entropy: FixedEntropySource(),
      );
      await identity.saveAccessToken('test-token');
      final adapter = _ErasureAdapter(503);
      final service = _service(identity, adapter);
      final result = await service.deleteRemoteAccount();
      expect(result.failureOrNull, isA<StorageFailure>());
      expect(await identity.readAccessToken(), 'test-token');
    },
  );

  test('remote success retains a receipt until local erasure completes and blocks fresh authentication', () async {
    final identity = SecureIdentityService(
      storage: InMemorySecureStorageGateway(),
      entropy: FixedEntropySource(),
    );
    await identity.saveAccessToken('test-token');
    final adapter = _ErasureAdapter(200);
    final service = _service(identity, adapter);
    expect((await service.deleteRemoteAccount()).isSuccess, isTrue);
    expect(await identity.readPendingErasureReceipt(), isNotNull);
    expect(
      (await service.ensureAuthenticated(forceRefresh: true)).isFailure,
      isTrue,
    );
    expect(adapter.paths, ['/v1/account']);
    expect((await service.deleteRemoteAccount()).isSuccess, isTrue);
    expect(adapter.paths.last, '/v1/erasure/erase-1/retry');
    expect(await identity.readPendingErasureReceipt(), isNotNull);
  });
}

AuthSessionService _service(
  SecureIdentityService identity,
  _ErasureAdapter adapter,
) => AuthSessionService(
  config: EditionConfig.globalDefault,
  identity: identity,
  clock: fixedTestClock(),
  crashLog: const DeveloperCrashLog(AppEdition.global),
  authDio: Dio(BaseOptions(baseUrl: 'https://example.test'))
    ..httpClientAdapter = adapter,
);

class _ErasureAdapter implements HttpClientAdapter {
  new(this.status);
  final int status;
  final List<String> paths = [];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    paths.add(options.path);
    return ResponseBody.fromString(
      jsonEncode({
        'erasureId': 'erase-1',
        'receiptToken': 'receipt-1',
        'success': status == 200,
      }),
      status,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _FailingStorage implements SecureStorageGateway {
  final inner = InMemorySecureStorageGateway();
  bool failReceiptWrite = false;
  bool failCredentialDelete = false;

  @override
  Future<Result<void, Failure>> write({
    required String key,
    required String value,
  }) async {
    if (failReceiptWrite && key == 'mockza_pending_erasure_v1') {
      return const Err(StorageFailure('Storage full'));
    }
    return await inner.write(key: key, value: value);
  }

  @override
  Future<Result<String?, Failure>> read({required String key}) =>
      inner.read(key: key);

  @override
  Future<Result<void, Failure>> delete({required String key}) async {
    if (failCredentialDelete && key == 'mockza_access_token_v1') {
      return const Err(StorageFailure('Storage unavailable'));
    }
    return await inner.delete(key: key);
  }
}

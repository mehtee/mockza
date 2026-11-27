import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/core/vocab/sm2_scheduler.dart';
import 'package:mockza/features/auth/presentation/auth_screen.dart';
import 'package:mockza/features/register_shifter/presentation/register_shifter_screen.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/auth_session_service.dart';
import 'package:mockza/services/crash_log.dart';
import 'package:mockza/services/linguistic_gateway.dart';
import 'package:mockza/services/secure_identity_service.dart';
import 'package:mockza/theme/app_theme.dart';
import 'package:mockza/theme/components/vocab_flip_card.dart';
import 'package:mockza/theme/theme_catalog.dart';

import '../support/fakes.dart';

void main() {
  test(
    'QA-002: AuthSessionService coalesces concurrent forceRefresh=true calls into 1 POST',
    () async {
      final identity = SecureIdentityService(
        storage: InMemorySecureStorageGateway(),
        entropy: FixedEntropySource(),
      );
      final adapter = _CountingAnonymousAuthAdapter();
      final service = AuthSessionService(
        config: EditionConfig.globalDefault,
        identity: identity,
        clock: fixedTestClock(),
        crashLog: const DeveloperCrashLog(AppEdition.global),
        authDio: Dio(BaseOptions(baseUrl: 'https://example.test'))
          ..httpClientAdapter = adapter,
      );

      final results = await Future.wait(<Future<Result<String, Failure>>>[
        service.ensureAuthenticated(forceRefresh: true),
        service.ensureAuthenticated(forceRefresh: true),
        service.ensureAuthenticated(forceRefresh: true),
      ]);

      expect(adapter.anonymousCallCount, 1);
      for (final res in results) {
        expect(res.valueOrNull, 'token-1');
      }
    },
  );

  testWidgets(
    'QA-004 & QA-006: IRN AuthScreen hides SMS OTP when server reports smsOtp disabled',
    (tester) async {
      final db = createTestDatabase();
      final identity = SecureIdentityService(
        storage: InMemorySecureStorageGateway(),
        entropy: FixedEntropySource(),
      );
      final authService = AuthSessionService(
        config: EditionConfig.iranDefault,
        identity: identity,
        clock: fixedTestClock(),
        crashLog: const DeveloperCrashLog(AppEdition.iran),
        authDio: Dio(BaseOptions(baseUrl: 'https://example.test'))
          ..httpClientAdapter = _ProvidersAdapter(smsEnabled: false),
      );

      await tester.pumpWidget(
        ProviderScope(
          retry: (count, error) => null,
          overrides: [
            editionConfigProvider.overrideWithValue(EditionConfig.iranDefault),
            clockProvider.overrideWithValue(fixedTestClock()),
            appDatabaseProvider.overrideWithValue(db),
            entropySourceProvider.overrideWithValue(FixedEntropySource()),
            secureStorageGatewayProvider.overrideWithValue(
              InMemorySecureStorageGateway(),
            ),
            authSessionServiceProvider.overrideWithValue(authService),
          ],
          child: MaterialApp(
            locale: const Locale('fa'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            theme: AppTheme.build(
              preset: MzThemeCatalog.midnightIndigo,
              brightness: Brightness.dark,
              persian: true,
            ),
            home: const Directionality(
              textDirection: TextDirection.rtl,
              child: AuthScreen(),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('حساب کاربری سنجیا'), findsOneWidget);
      expect(
        find.text(
          'ورود پیامکی در این سرور فعال نیست؛ لطفاً با ایمیل وارد شوید.',
        ),
        findsOneWidget,
      );
      expect(find.text('ارسال کد تایید پیامکی'), findsNothing);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 25));
      await tester.runAsync(db.close);
    },
  );

  testWidgets(
    'QA-013: RegisterShifterScreen renders live 15-char counter and validation feedback',
    (tester) async {
      final db = createTestDatabase();
      final linguisticGateway = HttpLinguisticGateway(
        Dio(BaseOptions(baseUrl: 'https://example.test'))
          ..httpClientAdapter = _QuotaAdapter(),
      );

      await tester.pumpWidget(
        ProviderScope(
          retry: (count, error) => null,
          overrides: [
            editionConfigProvider.overrideWithValue(
              EditionConfig.globalDefault,
            ),
            clockProvider.overrideWithValue(fixedTestClock()),
            appDatabaseProvider.overrideWithValue(db),
            entropySourceProvider.overrideWithValue(FixedEntropySource()),
            linguisticGatewayProvider.overrideWithValue(linguisticGateway),
          ],
          child: MaterialApp(
            locale: const Locale('en'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            theme: AppTheme.build(
              preset: MzThemeCatalog.midnightIndigo,
              brightness: Brightness.dark,
            ),
            home: const RegisterShifterScreen(),
          ),
        ),
      );

      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const ValueKey<String>('shifter_mode_text')));
      await tester.pumpAndSettle();

      expect(find.text('Minimum 15 characters (0 / 15)'), findsOneWidget);

      await tester.enterText(
        find.byKey(const ValueKey<String>('shifter_text_input')),
        'hi',
      );
      await tester.pump();
      expect(find.text('Minimum 15 characters (2 / 15)'), findsOneWidget);

      await tester.ensureVisible(
        find.byKey(const ValueKey<String>('shifter_submit_text_btn')),
      );
      await tester.tap(
        find.byKey(const ValueKey<String>('shifter_submit_text_btn')),
      );
      await tester.pump();

      expect(
        find.text('Write at least one full casual sentence (15+ characters).'),
        findsOneWidget,
      );

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 25));
      await tester.runAsync(db.close);
    },
  );

  testWidgets(
    'QA-012: VocabFlipCard localizes SM-2 rating labels and intervals for fa locale',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('fa'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          theme: AppTheme.build(
            preset: MzThemeCatalog.midnightIndigo,
            brightness: Brightness.dark,
            persian: true,
          ),
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: Scaffold(
              body: SingleChildScrollView(
                child: VocabFlipCard(
                  headword: 'ubiquitous',
                  definition: 'Present, appearing, or found everywhere.',
                  glossFa: 'همه‌جا حاضر',
                  isRevealed: true,
                  enableSpeechPractice: false,
                  onTapFlip: () {},
                  onSelectRating: (_) {},
                  synonyms: const <String>['omnipresent', 'pervasive'],
                  previewIntervals: const <ReviewQuality, String>{
                    ReviewQuality.again: '1m',
                    ReviewQuality.hard: '1d',
                    ReviewQuality.good: '4d',
                    ReviewQuality.easy: '7d',
                  },
                ),
              ),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('مترادف‌های آکادمیک'), findsOneWidget);
      expect(find.text('دوباره'), findsOneWidget);
      expect(find.text('سخت'), findsOneWidget);
      expect(find.text('خوب'), findsOneWidget);
      expect(find.text('آسان'), findsOneWidget);
      expect(find.text('۱ دقیقه'), findsOneWidget);
      expect(find.text('۴ روز'), findsOneWidget);
    },
  );
}

class _CountingAnonymousAuthAdapter implements HttpClientAdapter {
  int anonymousCallCount = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (options.path == '/v1/auth/anonymous') {
      anonymousCallCount++;
      await Future<void>.delayed(const Duration(milliseconds: 20));
      return ResponseBody.fromString(
        jsonEncode(<String, Object?>{
          'accessToken': 'token-$anonymousCallCount',
          'deviceSecret': 'secret-1',
        }),
        200,
        headers: <String, List<String>>{
          Headers.contentTypeHeader: <String>[Headers.jsonContentType],
        },
      );
    }
    return ResponseBody.fromString('{}', 404);
  }

  @override
  void close({bool force = false}) {}
}

class _ProvidersAdapter implements HttpClientAdapter {
  new({required this.smsEnabled});

  final bool smsEnabled;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (options.path == '/v1/auth/providers') {
      return ResponseBody.fromString(
        jsonEncode(<String, Object?>{
          'edition': 'irn',
          'emailPassword': <String, Object?>{'enabled': true},
          'smsOtp': <String, Object?>{
            'enabled': smsEnabled,
            'mode': smsEnabled ? 'dev_sandbox' : 'disabled',
          },
          'google': <String, Object?>{'enabled': false, 'mode': 'disabled'},
          'apple': <String, Object?>{'enabled': false, 'mode': 'disabled'},
          'slotPolicy': <String, Object?>{'maxMobile': 1, 'maxWebDesktop': 1},
        }),
        200,
        headers: <String, List<String>>{
          Headers.contentTypeHeader: <String>[Headers.jsonContentType],
        },
      );
    }
    return ResponseBody.fromString('{}', 404);
  }

  @override
  void close({bool force = false}) {}
}

class _QuotaAdapter implements HttpClientAdapter {
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return ResponseBody.fromString(
      jsonEncode(<String, Object?>{
        'advancedQuota': <String, Object?>{
          'isPro': false,
          'freeSampleUsed': false,
          'shifterRemainingToday': 3,
          'dropsRemainingToday': 3,
          'audioDropAllowed': false,
          'monthlyRemaining': 10,
        },
      }),
      200,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>[Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

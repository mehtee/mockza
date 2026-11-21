import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/app.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/formatting/jalali_edge_formatter.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/features/auth/presentation/auth_screen.dart';
import 'package:mockza/features/paywall/presentation/paywall_screen.dart';
import 'package:mockza/features/progress/presentation/widgets/navia_handoff_card.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/billing_gateway.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_theme.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_jalali_date_picker.dart';
import 'package:mockza/theme/theme_catalog.dart';

import '../support/fakes.dart';

void main() {
  testWidgets(
    'Sanjia (IRN) boots in RTL with Vazirmatn, SanjiaMark, and Persian copy',
    (tester) async {
      final db = createTestDatabase();

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
            billingGatewayProvider.overrideWithValue(
              const IranBillingGateway(channelOverride: 'zarinpal'),
            ),
            gradingGatewayProvider.overrideWithValue(FakeGradingGateway()),
          ],
          child: const MockzaApp(),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byType(SanjiaMark), findsOneWidget);
      expect(find.byType(MockzaMark), findsNothing);
      expect(find.text('به سنجیا خوش آمدید'), findsOneWidget);
      expect(find.text('Welcome to Mockza'), findsNothing);

      final ctx = tester.element(find.text('به سنجیا خوش آمدید'));
      expect(Directionality.of(ctx), TextDirection.rtl);
      expect(Localizations.localeOf(ctx).languageCode, 'fa');
      expect(Theme.of(ctx).textTheme.bodyMedium?.fontFamily, 'Vazirmatn');

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 25));
      await tester.runAsync(db.close);
    },
  );

  testWidgets(
    'IRN AuthScreen prioritizes +98 SMS OTP and hides Google/Apple OAuth',
    (tester) async {
      final db = createTestDatabase();

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

      expect(find.byType(SanjiaMark), findsOneWidget);
      expect(find.text('ورود به سنجیا'), findsOneWidget);
      expect(find.text('شماره موبایل ایران'), findsOneWidget);
      expect(find.text('ارسال کد تایید پیامکی'), findsOneWidget);
      expect(find.text('Continue with Google'), findsNothing);
      expect(find.text('Continue with Apple'), findsNothing);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 25));
      await tester.runAsync(db.close);
    },
  );

  testWidgets(
    'IRN PaywallScreen renders Toman prices, SanjiaMark, and unlocked checkout CTA',
    (tester) async {
      final db = createTestDatabase();

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
            billingGatewayProvider.overrideWithValue(
              const IranBillingGateway(channelOverride: 'zarinpal'),
            ),
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
              child: PaywallScreen(),
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.byType(SanjiaMark), findsOneWidget);
      expect(find.text('سنجیا پرو'), findsOneWidget);
      expect(find.text('۳۹۰,۰۰۰ تومان'), findsOneWidget);
      expect(find.text('پرداخت و فعال‌سازی سنجیا پرو'), findsOneWidget);
      expect(find.text('Subscribe via Android / iOS App'), findsNothing);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(milliseconds: 25));
      await tester.runAsync(db.close);
    },
  );

  testWidgets(
    'LtrExamBoundary isolates English subtree inside RTL and NaviaHandoffCard renders score',
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
          home: const Directionality(
            textDirection: TextDirection.rtl,
            child: Scaffold(
              body: Column(
                children: <Widget>[
                  LtrExamBoundary(child: Text('Passage A: Urban Forests')),
                  NaviaHandoffCard(
                    track: ExamTrack.ieltsAcademic,
                    estimatedScore: 7.5,
                    targetScore: 7.5,
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      final ltrElem = tester.element(find.text('Passage A: Urban Forests'));
      expect(Directionality.of(ltrElem), TextDirection.ltr);
      expect(Localizations.localeOf(ltrElem).languageCode, 'en');

      expect(
        find.text('انتقال نمره تاییدشده به ناویا (Navia)'),
        findsOneWidget,
      );
      expect(find.text('ارسال نمره به ناویا (navia.ir)'), findsOneWidget);
    },
  );

  testWidgets(
    'showMzJalaliDatePickerSheet selects day and returns canonical SerialDay',
    (tester) async {
      ({bool cleared, SerialDay? day})? result;
      final today = SerialDay.fromUtcDateTime(DateTime.utc(2026, 3, 21));

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
            child: Builder(
              builder: (ctx) => Scaffold(
                body: ElevatedButton(
                  onPressed: () async {
                    result = await showMzJalaliDatePickerSheet(
                      ctx,
                      today: today,
                    );
                  },
                  child: const Text('Open Jalali'),
                ),
              ),
            ),
          ),
        ),
      );

      await tester.tap(find.text('Open Jalali'));
      await tester.pumpAndSettle();

      expect(find.text('انتخاب تاریخ آزمون (شمسی)'), findsOneWidget);
      await tester.tap(find.text('۱۵'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('تایید تاریخ آزمون'));
      await tester.tap(find.text('تایید تاریخ آزمون'));
      await tester.pumpAndSettle();

      expect(result, isNotNull);
      expect(result!.cleared, isFalse);
      expect(
        JalaliEdgeFormatter.serialDayToJalali(result!.day!),
        const JalaliYmd(jy: 1405, jm: 1, jd: 15),
      );
    },
  );
}

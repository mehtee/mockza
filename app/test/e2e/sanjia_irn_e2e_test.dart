import 'package:drift/drift.dart' show Value;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/features/home/presentation/home_screen.dart';
import 'package:mockza/features/settings/presentation/settings_screen.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_icons.dart';

import 'harness/e2e_app_harness.dart';
import 'robots/shell_and_home_robot.dart';

void main() {
  testWidgets(
    'Sanjia IRN E2E: Onboarding (Jalali picker) -> Home -> Vocab glossFa -> Progress Navia -> Paywall -> Settings',
    (tester) async {
      final harness = E2eAppHarness.create(
        editionConfig: EditionConfig.iranDefault,
      );
      addTearDown(() => harness.dispose(tester));

      await harness.mountApp(tester, surfaceSize: const Size(430, 900));

      // Step 0: Onboarding renders Sanjia RTL + Vazirmatn
      expect(find.byType(SanjiaMark), findsOneWidget);
      expect(find.text('به سنجیا خوش آمدید'), findsOneWidget);

      await harness.scrollToAndTap(tester, find.text('ادامه'));
      expect(find.text('نمره هدف خود را تعیین کنید'), findsOneWidget);

      // Open Jalali picker in Step 1 & pick 30 days ahead using preset chip
      await harness.scrollToAndTap(tester, find.text('انتخاب از تقویم شمسی'));
      expect(find.text('انتخاب تاریخ آزمون (شمسی)'), findsOneWidget);
      await tester.tap(find.text('۳۰ روز آینده'));
      await harness.pumpFrames(tester, count: 3);
      await tester.ensureVisible(find.text('تایید تاریخ آزمون'));
      await tester.tap(find.text('تایید تاریخ آزمون'));
      await harness.pumpFrames(tester);

      // Disable diagnostic jump for direct Home landing and finish onboarding
      await harness.scrollToAndTap(
        tester,
        find.text('شروع با تعیین سطح رایگان (~۱۰ تا ۱۵ دقیقه)'),
      );
      await harness.scrollToAndTap(tester, find.text('شروع یادگیری'));

      // Seed bilingual vocab card with glossFa into Drift
      await tester.runAsync(() async {
        final now = harness.clock.current.toUtc();
        final today = SerialDay.fromUtcDateTime(now).value;
        await harness.db.vocabDao.upsertSyncedCardsPreservingSchedule(
          <VocabCardsCompanion>[
            VocabCardsCompanion.insert(
              cardId: 'irn-e2e-word-1',
              headword: 'ubiquitous',
              ipa: const Value('/juːˈbɪk.wɪ.təs/'),
              definition: 'Seeming to be everywhere at once.',
              glossFa: const Value('همه‌جا حاضر، فراگیر'),
              topicTag: 'technology',
              dueDay: today,
              dueDaySerial: Value(today),
              createdAt: now,
              updatedAt: now,
            ),
          ],
        );
      });

      // Home displays Target pill + days remaining in Persian
      expect(find.textContaining('روز تا تاریخ آزمون'), findsOneWidget);

      final shellRobot = ShellAndHomeRobot(harness);

      // Navigate to Vocabulary tab & verify glossFa + LTR English headword
      await shellRobot.openTab(tester, 'واژگان');
      expect(find.text('دفترچه واژگان'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('ubiquitous'),
        180,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.text('ubiquitous'), findsOneWidget);
      expect(find.text('همه‌جا حاضر، فراگیر'), findsOneWidget);
      expect(
        Directionality.of(tester.element(find.text('ubiquitous'))),
        TextDirection.ltr,
      );

      // Navigate to Progress tab & verify Navia handoff card
      await shellRobot.openTab(tester, 'پیشرفت');
      expect(find.text('پیشرفت و تحلیل نمرات'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('انتقال نمره تاییدشده به ناویا (Navia)'),
        180,
        scrollable: find.byType(Scrollable).first,
      );
      expect(
        find.text('انتقال نمره تاییدشده به ناویا (Navia)'),
        findsOneWidget,
      );

      // Navigate to Settings via GoRouter and verify Jalali date row + Sanjia footer
      GoRouter.of(
        tester.element(find.byType(HomeScreen, skipOffstage: false).first),
      ).go(AppRoutes.settings);
      await harness.pumpFrames(tester);
      expect(find.text('تاریخ آزمون (شمسی)'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.textContaining('Edition: irn'),
        220,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.textContaining('Edition: irn'), findsOneWidget);

      // Navigate to Paywall via GoRouter and verify Sanjia Pro branding
      GoRouter.of(
        tester.element(find.byType(SettingsScreen)),
      ).go(AppRoutes.paywall);
      await harness.pumpFrames(tester);
      expect(find.text('سنجیا پرو'), findsOneWidget);
    },
  );
}

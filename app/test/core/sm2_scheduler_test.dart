import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/core/vocab/sm2_scheduler.dart';
import 'package:test/test.dart';

void main() {
  group('Sm2Scheduler Exhaustive Tier 1 Suite', () {
    const today = SerialDay(20000);

    test('initializes fresh card for immediate study on today with default 2500 easeFactorMilli', () {
      final initial = SrsCardState.initial(today);
      expect(initial.repetitions, 0);
      expect(initial.intervalDays, 0);
      expect(initial.easeFactorMilli, 2500);
      expect(initial.easeFactor, 2.5);
      expect(initial.dueDay, today);
    });

    test('assigns interval 1 then 6 days on consecutive Good reviews', () {
      final initial = SrsCardState.initial(today);
      final first = Sm2Scheduler.schedule(
        current: initial,
        quality: ReviewQuality.good,
        today: today,
      );
      expect(first.repetitions, 1);
      expect(first.intervalDays, 1);
      expect(first.dueDay, today.addDays(1));
      expect(first.easeFactorMilli, 2500);

      final second = Sm2Scheduler.schedule(
        current: first,
        quality: ReviewQuality.good,
        today: today.addDays(1),
      );
      expect(second.repetitions, 2);
      expect(second.intervalDays, 6);
      expect(second.dueDay, today.addDays(7));
    });

    test('progresses beyond 2 repetitions using ease factor multiplier', () {
      const rep2Card = SrsCardState(
        repetitions: 2,
        intervalDays: 6,
        easeFactorMilli: 2500,
        dueDay: today,
      );

      final rep3 = Sm2Scheduler.schedule(
        current: rep2Card,
        quality: ReviewQuality.good,
        today: today,
      );
      expect(rep3.repetitions, 3);
      expect(rep3.intervalDays, (6 * 2.5).round()); // 15 days
      expect(rep3.dueDay, today.addDays(15));
    });

    test('Easy quality awards ease bonus (+100 milli) and schedules interval advancement', () {
      final initial = SrsCardState.initial(today);
      final reviewed = Sm2Scheduler.schedule(
        current: initial,
        quality: ReviewQuality.easy,
        today: today,
      );
      expect(reviewed.repetitions, 1);
      expect(reviewed.easeFactorMilli, 2600);
      expect(reviewed.easeFactor, 2.6);
    });

    test('Hard quality applies ease penalty (-140 milli) but advances repetitions streak', () {
      const card = SrsCardState(
        repetitions: 1,
        intervalDays: 1,
        easeFactorMilli: 2500,
        dueDay: today,
      );
      final reviewed = Sm2Scheduler.schedule(
        current: card,
        quality: ReviewQuality.hard,
        today: today,
      );
      expect(reviewed.repetitions, 2);
      expect(reviewed.easeFactorMilli, 2360);
      expect(reviewed.intervalDays, 6);
    });

    test('resets repetitions to 0 and schedules next day on Again lapse', () {
      const progressed = SrsCardState(
        repetitions: 5,
        intervalDays: 30,
        easeFactorMilli: 2500,
        dueDay: today,
      );
      final lapsed = Sm2Scheduler.schedule(
        current: progressed,
        quality: ReviewQuality.again,
        today: today,
      );
      expect(lapsed.repetitions, 0);
      expect(lapsed.intervalDays, 1);
      expect(lapsed.dueDay, today.addDays(1));
      expect(
        lapsed.easeFactorMilli,
        greaterThanOrEqualTo(Sm2Scheduler.minEaseFactorMilli),
      );
    });

    test(
      'strictly clamps ease factor to minEaseFactorMilli floor (1300 / 1.3)',
      () {
        var card = const SrsCardState(
          repetitions: 1,
          intervalDays: 1,
          easeFactorMilli: 1350,
          dueDay: today,
        );

        // Multiple lapses to force ease downward
        for (var i = 0; i < 5; i++) {
          card = Sm2Scheduler.schedule(
            current: card,
            quality: ReviewQuality.again,
            today: today,
          );
        }

        expect(card.easeFactorMilli, equals(Sm2Scheduler.minEaseFactorMilli));
        expect(card.easeFactorMilli, 1300);
        expect(card.easeFactor, 1.3);
      },
    );

    test('previewIntervals provides user-friendly labels for UI buttons', () {
      final initial = SrsCardState.initial(today);
      final previews = Sm2Scheduler.previewIntervals(initial);
      expect(previews[ReviewQuality.again], '1m');
      expect(previews[ReviewQuality.hard], '1d');
      expect(previews[ReviewQuality.good], '1d');
      expect(previews[ReviewQuality.easy], '4d');

      const mature = SrsCardState(
        repetitions: 3,
        intervalDays: 15,
        easeFactorMilli: 2500,
        dueDay: today,
      );
      final maturePreviews = Sm2Scheduler.previewIntervals(mature);
      expect(maturePreviews[ReviewQuality.again], '10m');
      expect(maturePreviews[ReviewQuality.good], '1mo');
    });

    test('SerialDay handles integer calendar days across leap years & DST without shifts', () {
      const day1 = SerialDay(19723); // 2024 leap year
      final day2 = day1.addDays(366);
      expect(day2.differenceDays(day1), 366);
      expect(day2.value - day1.value, 366);
    });
  });
}

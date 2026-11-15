import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/models/user_profile.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/data/repositories/progress_repository.dart';
import 'package:mockza/features/progress/presentation/progress_notifier.dart';
import 'package:mockza/providers.dart';

/// Provides [ProgressState] via [ProgressNotifier].
final NotifierProvider<ProgressNotifier, ProgressState>
progressNotifierProvider = NotifierProvider<ProgressNotifier, ProgressState>(
  ProgressNotifier.new,
);

/// Streams the learner's primary profile (target band, active track).
final StreamProvider<UserProfile?> progressProfileProvider =
    StreamProvider<UserProfile?>(
      (ref) => ref.watch(profileRepositoryProvider).watchPrimaryProfile(),
    );

/// Streams daily study logs for the Progress streak calculation.
final StreamProvider<List<DailyStudySummary>> recentDailyStudyLogsProvider =
    StreamProvider<List<DailyStudySummary>>(
      (ref) =>
          ref.watch(progressRepositoryProvider).watchRecentActivity(limit: 90),
    );

/// Streams recent exam attempts for analytics and history.
final StreamProvider<List<AttemptSummary>> recentAttemptsProvider =
    StreamProvider<List<AttemptSummary>>(
      (ref) =>
          ref.watch(attemptRepositoryProvider).watchRecentAttempts(limit: 100),
    );

/// Selected timeframe filter for progress charts.
class TimeframeNotifier extends Notifier<String> {
  @override
  String build() => '30D';

  /// Selects active timeframe filter.
  void setTimeframe(String timeframe) {
    if (state == timeframe) return;
    state = timeframe;
  }
}

/// Provides active timeframe string ('7D', '30D', '90D', 'ALL').
final NotifierProvider<TimeframeNotifier, String> timeframeProvider =
    NotifierProvider<TimeframeNotifier, String>(TimeframeNotifier.new);

/// Selected skill filter for attempt history.
class HistoryFilterNotifier extends Notifier<String> {
  @override
  String build() => 'All';

  /// Selects active history filter.
  void setFilter(String filter) {
    if (state == filter) return;
    state = filter;
  }
}

/// Provides active attempt history filter ('All', 'Speaking', etc.).
final NotifierProvider<HistoryFilterNotifier, String> historyFilterProvider =
    NotifierProvider<HistoryFilterNotifier, String>(HistoryFilterNotifier.new);

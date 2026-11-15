import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/features/home/presentation/home_notifier.dart';
import 'package:mockza/providers.dart';

/// Provides [HomeState] via [HomeNotifier].
final NotifierProvider<HomeNotifier, HomeState> homeNotifierProvider =
    NotifierProvider<HomeNotifier, HomeState>(HomeNotifier.new);

/// Streams the five most recent attempts for the Home dashboard.
final StreamProvider<List<AttemptSummary>> homeRecentAttemptsProvider =
    StreamProvider<List<AttemptSummary>>(
      (ref) =>
          ref.watch(attemptRepositoryProvider).watchRecentAttempts(limit: 5),
    );

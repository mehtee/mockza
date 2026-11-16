import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/reading_sim/presentation/reading_sim_notifier.dart';

/// Route-scoped [ReadingSimState] so timers release cleanly on exit.
final NotifierProvider<ReadingSimNotifier, ReadingSimState>
readingSimNotifierProvider =
    NotifierProvider.autoDispose<ReadingSimNotifier, ReadingSimState>(
      ReadingSimNotifier.new,
    );

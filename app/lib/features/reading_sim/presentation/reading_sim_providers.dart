import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/reading_sim/presentation/reading_sim_notifier.dart';

/// Provides [ReadingSimState] via [ReadingSimNotifier].
final NotifierProvider<ReadingSimNotifier, ReadingSimState>
readingSimNotifierProvider =
    NotifierProvider<ReadingSimNotifier, ReadingSimState>(
      ReadingSimNotifier.new,
    );

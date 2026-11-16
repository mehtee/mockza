import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/writing_sim/presentation/writing_sim_notifier.dart';

/// Route-scoped [WritingSimState] so timers and autosave state release cleanly on exit.
final NotifierProvider<WritingSimNotifier, WritingSimState>
writingSimNotifierProvider =
    NotifierProvider.autoDispose<WritingSimNotifier, WritingSimState>(
      WritingSimNotifier.new,
    );

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/writing_sim/presentation/writing_sim_notifier.dart';

/// Provides [WritingSimState] via [WritingSimNotifier].
final NotifierProvider<WritingSimNotifier, WritingSimState>
writingSimNotifierProvider =
    NotifierProvider<WritingSimNotifier, WritingSimState>(
      WritingSimNotifier.new,
    );

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/speaking_sim/presentation/speaking_sim_notifier.dart';

/// Route-scoped [SpeakingSimState] so mic, preview, playback & timers release cleanly on exit.
final NotifierProvider<SpeakingSimNotifier, SpeakingSimState>
speakingSimNotifierProvider =
    NotifierProvider.autoDispose<SpeakingSimNotifier, SpeakingSimState>(
      SpeakingSimNotifier.new,
    );

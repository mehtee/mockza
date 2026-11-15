import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/speaking_sim/presentation/speaking_sim_notifier.dart';

/// Provides [SpeakingSimState] via [SpeakingSimNotifier].
final NotifierProvider<SpeakingSimNotifier, SpeakingSimState>
speakingSimNotifierProvider =
    NotifierProvider<SpeakingSimNotifier, SpeakingSimState>(
      SpeakingSimNotifier.new,
    );

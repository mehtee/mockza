import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/listening_sim/presentation/listening_sim_notifier.dart';

/// Route-scoped [ListeningSimState] so audio playback subscriptions release cleanly on exit.
final NotifierProvider<ListeningSimNotifier, ListeningSimState>
listeningSimNotifierProvider =
    NotifierProvider.autoDispose<ListeningSimNotifier, ListeningSimState>(
      ListeningSimNotifier.new,
    );

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/listening_sim/presentation/listening_sim_notifier.dart';

/// Provides [ListeningSimState] via [ListeningSimNotifier].
final NotifierProvider<ListeningSimNotifier, ListeningSimState>
listeningSimNotifierProvider =
    NotifierProvider<ListeningSimNotifier, ListeningSimState>(
      ListeningSimNotifier.new,
    );

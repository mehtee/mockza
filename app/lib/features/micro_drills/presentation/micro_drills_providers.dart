import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/micro_drills/presentation/micro_drills_notifier.dart';

/// Route-scoped [MicroDrillsState] so timers release cleanly on exit.
final NotifierProvider<MicroDrillsNotifier, MicroDrillsState>
microDrillsNotifierProvider =
    NotifierProvider.autoDispose<MicroDrillsNotifier, MicroDrillsState>(
      MicroDrillsNotifier.new,
    );

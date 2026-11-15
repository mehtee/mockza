import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/micro_drills/presentation/micro_drills_notifier.dart';

/// Provides [MicroDrillsState] via [MicroDrillsNotifier].
final NotifierProvider<MicroDrillsNotifier, MicroDrillsState>
microDrillsNotifierProvider =
    NotifierProvider<MicroDrillsNotifier, MicroDrillsState>(
      MicroDrillsNotifier.new,
    );

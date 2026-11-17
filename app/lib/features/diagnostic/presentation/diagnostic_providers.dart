import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_notifier.dart';

/// Holds shared [DiagnosticNotifier] state across `/diagnostic/intro`,
/// `/diagnostic/session/:diagId`, and `/diagnostic/results/:diagId`.
final NotifierProvider<DiagnosticNotifier, DiagnosticState>
diagnosticNotifierProvider =
    NotifierProvider<DiagnosticNotifier, DiagnosticState>(
      DiagnosticNotifier.new,
    );

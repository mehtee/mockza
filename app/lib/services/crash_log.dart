import 'dart:developer' as developer;
import 'dart:io';

import 'package:clock/clock.dart';
import 'package:mockza/core/config/edition_config.dart';

/// Application diagnostic and error boundary sink.
abstract interface class CrashLog {
  /// Records an unhandled [error] and optional [stackTrace].
  void recordError(Object error, [StackTrace? stackTrace]);

  /// Records an informational diagnostic event [message].
  void info(String message);
}

/// Default local diagnostic logger backed by `dart:developer` (safe under `avoid_print`).
final class DeveloperCrashLog implements CrashLog {
  /// Creates a [DeveloperCrashLog] scoped to [edition].
  const new(this.edition);

  /// Active app edition context attached to log metadata.
  final AppEdition edition;

  @override
  void recordError(Object error, [StackTrace? stackTrace]) {
    developer.log(
      'Unhandled error in ${edition.code}: $error',
      name: 'mockza.crash',
      error: error,
      stackTrace: stackTrace,
      level: 1000,
    );
  }

  @override
  void info(String message) {
    developer.log(
      message,
      name: 'mockza.app.${edition.code}',
      level: 800,
    );
  }
}

/// Persistent ring-buffered size-bounded file sink writing to `crash.log`.
///
/// Automatically truncates the oldest lines on overflow to prevent unbounded disk growth.
final class FileRingBufferCrashLog implements CrashLog {
  /// Creates a [FileRingBufferCrashLog].
  const new({
    required this.logFile,
    required this.edition,
    this.clock = const Clock(),
    this.maxBytes = 512 * 1024, // 512 KB
    this.maxLines = 1000,
  });

  /// The local file backing the ring buffer sink.
  final File logFile;

  /// Active edition scoping.
  final AppEdition edition;

  /// Clock instance for deterministic timestamp generation.
  final Clock clock;

  /// Maximum file size in bytes before ring rotation triggers.
  final int maxBytes;

  /// Maximum line count retained in rotation.
  final int maxLines;

  @override
  void recordError(Object error, [StackTrace? stackTrace]) {
    final now = clock.now().toUtc().toIso8601String();
    final entry =
        '[$now] [ERROR] [${edition.code}] $error\n${stackTrace ?? ''}\n';
    _appendEntry(entry);

    developer.log(
      'Unhandled error in ${edition.code}: $error',
      name: 'mockza.crash',
      error: error,
      stackTrace: stackTrace,
      level: 1000,
    );
  }

  @override
  void info(String message) {
    final now = clock.now().toUtc().toIso8601String();
    final entry = '[$now] [INFO] [${edition.code}] $message\n';
    _appendEntry(entry);

    developer.log(
      message,
      name: 'mockza.app.${edition.code}',
      level: 800,
    );
  }

  void _appendEntry(String entry) {
    try {
      if (!logFile.existsSync()) {
        logFile.createSync(recursive: true);
      }
      logFile.writeAsStringSync(entry, mode: FileMode.append, flush: true);

      // Check size threshold
      if (logFile.lengthSync() > maxBytes) {
        _rotateBuffer();
      }
    } on Object catch (_) {
      // Diagnostic logger must never crash the host application
    }
  }

  void _rotateBuffer() {
    try {
      final lines = logFile.readAsLinesSync();
      if (lines.length > maxLines) {
        // Keep newest half of lines
        final keepLines = lines.sublist(lines.length - (maxLines ~/ 2));
        logFile.writeAsStringSync(
          '--- RING ROTATION AT ${clock.now().toUtc().toIso8601String()} ---\n${keepLines.join('\n')}\n',
          flush: true,
        );
      }
    } on Object catch (_) {
      // Fallback
    }
  }
}

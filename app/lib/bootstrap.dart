import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/app.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/crash_log.dart';

/// Initializes global error boundaries, edition overrides, and mounts [MockzaApp].
Future<void> bootstrap(EditionConfig config) async {
  WidgetsFlutterBinding.ensureInitialized();
  final crashLog = DeveloperCrashLog(config.edition);

  FlutterError.onError = (details) {
    crashLog.recordError(details.exception, details.stack);
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    crashLog.recordError(error, stack);
    return true;
  };

  runApp(
    ProviderScope(
      retry: (count, error) => null,
      overrides: [
        editionConfigProvider.overrideWithValue(config),
        crashLogProvider.overrideWithValue(crashLog),
      ],
      child: const MockzaApp(),
    ),
  );
}

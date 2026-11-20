import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/app.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/appearance_storage_service.dart';
import 'package:mockza/services/crash_log.dart';
import 'package:mockza/services/secure_identity_service.dart';

Stream<LicenseEntry> _fontLicenses() async* {
  for (final (name, file) in [
    ('Inter', 'inter'),
    ('Vazirmatn', 'vazirmatn'),
    ('Instrument Serif', 'instrument-serif'),
  ]) {
    final license = await rootBundle.loadString(
      'assets/fonts/$file-license.txt',
    );
    yield LicenseEntryWithLineBreaks([name], license);
  }
}

/// Initializes global error boundaries, theme preferences, edition overrides, and mounts [MockzaApp].
Future<void> bootstrap(EditionConfig config) async {
  WidgetsFlutterBinding.ensureInitialized();
  LicenseRegistry.addLicense(_fontLicenses);
  final crashLog = DeveloperCrashLog(config.edition);
  final initialAppearance = await const AppearanceStorageService(
    FlutterSecureStorageGateway(),
  ).load();

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
        initialAppearanceSettingsProvider.overrideWithValue(initialAppearance),
      ],
      child: const MockzaApp(),
    ),
  );
}

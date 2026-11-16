import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/data/db/connection_native.dart'
    if (dart.library.js_interop) 'package:mockza/data/db/connection_web.dart'
    as platform;

/// Opens the platform-appropriate [AppDatabase] (SQLite on mobile/VM, Wasm/IndexedDB SQLite on Web).
AppDatabase openProductionDatabase() => platform.openPlatformDatabase();

/// Whether the active database degraded to volatile in-memory storage (e.g., restricted browser privacy mode).
bool get isDatabaseEphemeral => platform.platformDatabaseIsEphemeral;

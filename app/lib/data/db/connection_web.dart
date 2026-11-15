import 'package:drift/drift.dart';
import 'package:drift/wasm.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:sqlite3/wasm.dart';

/// Opens a persistent SQLite database on Flutter Web using `sqlite3.wasm`
/// backed by browser IndexedDB (`IndexedDbFileSystem`), with an in-memory
/// fallback if browser storage is restricted.
AppDatabase openPlatformDatabase() {
  return AppDatabase(
    LazyDatabase(() async {
      final sqlite3 = await WasmSqlite3.loadFromUrl(Uri.parse('sqlite3.wasm'));
      try {
        final fileSystem = await IndexedDbFileSystem.open(dbName: 'mockza_db');
        sqlite3.registerVirtualFileSystem(fileSystem, makeDefault: true);
        return WasmDatabase(
          sqlite3: sqlite3,
          path: '/mockza.sqlite',
          fileSystem: fileSystem,
          setup: (rawDb) {
            rawDb.execute('PRAGMA foreign_keys = ON;');
          },
        );
      } on Object {
        final fallbackFs = InMemoryFileSystem();
        sqlite3.registerVirtualFileSystem(fallbackFs, makeDefault: true);
        return WasmDatabase.inMemory(
          sqlite3,
          setup: (rawDb) {
            rawDb.execute('PRAGMA foreign_keys = ON;');
          },
        );
      }
    }),
  );
}

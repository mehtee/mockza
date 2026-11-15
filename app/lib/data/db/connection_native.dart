import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// Opens the persistent mobile/VM SQLite [AppDatabase] with WAL & FK pragmas.
AppDatabase openPlatformDatabase() => AppDatabase(_openNativeExecutor());

QueryExecutor _openNativeExecutor() => LazyDatabase(() async {
  final dir = await getApplicationSupportDirectory();
  final file = File(p.join(dir.path, 'mockza.sqlite'));
  return NativeDatabase.createInBackground(
    file,
    setup: (rawDb) {
      rawDb
        ..execute('PRAGMA journal_mode = WAL;')
        ..execute('PRAGMA foreign_keys = ON;')
        ..execute('PRAGMA busy_timeout = 5000;')
        ..execute('PRAGMA synchronous = FULL;');
    },
  );
});

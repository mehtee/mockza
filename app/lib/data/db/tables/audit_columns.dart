import 'package:drift/drift.dart';

/// Shared UTC audit timestamps mixed into local SQLite tables.
mixin AuditColumns on Table {
  /// Record creation timestamp in UTC.
  DateTimeColumn get createdAt => dateTime()();

  /// Last local mutation timestamp in UTC.
  DateTimeColumn get updatedAt => dateTime()();
}

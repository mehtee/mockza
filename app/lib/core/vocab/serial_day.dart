/// Timezone-safe integer UTC day counter for streak and SRS due-date math.
extension type const SerialDay(int value) {
  /// Converts a [DateTime] into its UTC calendar day count since Unix epoch.
  factory fromUtcDateTime(DateTime utcTimestamp) {
    final utc = utcTimestamp.toUtc();
    final midnightUtc = DateTime.utc(utc.year, utc.month, utc.day);
    return SerialDay(
      midnightUtc.millisecondsSinceEpoch ~/ Duration.millisecondsPerDay,
    );
  }

  /// Adds [days] to produce a future [SerialDay].
  SerialDay addDays(int days) => SerialDay(value + days);

  /// Signed day difference (`this - other`).
  int differenceDays(SerialDay other) => value - other.value;
}

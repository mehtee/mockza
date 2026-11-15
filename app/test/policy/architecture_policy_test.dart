import 'dart:io';

import 'package:test/test.dart';

void main() {
  group('Architecture policy gates', () {
    final libDir = Directory('lib');

    test('lib/ exists and uses zero DateTime.now() outside clock wrappers', () {
      expect(libDir.existsSync(), isTrue);
      final offenders = <String>[];
      for (final entity in libDir.listSync(recursive: true)) {
        if (entity is! File || !entity.path.endsWith('.dart')) continue;
        if (entity.path.endsWith('.g.dart') ||
            entity.path.endsWith('.drift.dart')) {
          continue;
        }
        final lines = entity.readAsLinesSync();
        for (var i = 0; i < lines.length; i++) {
          final codeOnly = lines[i].replaceAll(RegExp(r'//.*$'), '');
          if (RegExp(r'DateTime\.(now|timestamp)\(').hasMatch(codeOnly)) {
            offenders.add('${entity.path}:${i + 1}');
          }
        }
      }
      expect(
        offenders,
        isEmpty,
        reason: 'Inject Clock via clockProvider instead of DateTime.now()',
      );
    });

    test('package:drift is strictly confined to lib/data/', () {
      final offenders = <String>[];
      for (final entity in libDir.listSync(recursive: true)) {
        if (entity is! File || !entity.path.endsWith('.dart')) continue;
        if (entity.path.contains(
          '${Platform.pathSeparator}data${Platform.pathSeparator}',
        )) {
          continue;
        }
        final content = entity.readAsStringSync();
        if (content.contains('package:drift/') ||
            content.contains('package:sqlite3/')) {
          offenders.add(entity.path);
        }
      }
      expect(
        offenders,
        isEmpty,
        reason: 'Only lib/data/ may import Drift or SQLite libraries',
      );
    });
  });
}

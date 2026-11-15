import 'dart:io';
import 'dart:typed_data';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// Reads recorded audio bytes from the local filesystem.
Future<Uint8List?> readRecordedAudioBytes(String pathOrUrl) async {
  if (pathOrUrl.isEmpty) return null;
  final file = File(pathOrUrl);
  if (!file.existsSync()) return null;
  return await file.readAsBytes();
}

/// Deletes a local recorded audio file if it exists.
Future<void> deleteRecordedAudioClip(String pathOrUrl) async {
  if (pathOrUrl.isEmpty) return;
  try {
    final file = File(pathOrUrl);
    if (file.existsSync()) {
      await file.delete();
    }
  } on Object {
    // Best-effort local cleanup.
  }
}

/// Allocates a recording output path inside the app's support audio directory.
Future<String> createTempRecordingPath(String fileName) async {
  final dir = await getApplicationSupportDirectory();
  final audioDir = Directory(p.join(dir.path, 'speaking_clips'));
  if (!audioDir.existsSync()) {
    await audioDir.create(recursive: true);
  }
  return p.join(audioDir.path, fileName);
}

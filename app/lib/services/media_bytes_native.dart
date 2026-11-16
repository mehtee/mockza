import 'dart:io';
import 'dart:typed_data';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// On native platforms, audio files are already written directly to app support disk.
Future<String> persistRecordedAudioClip(String pathOrUrl, String clipId) async =>
    pathOrUrl;

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

/// Persists downloaded pack media bytes to app support storage for offline playback (`TD-32`).
Future<String> persistCachedMediaBytes(
  Uint8List bytes,
  String mediaKey,
) async {
  final dir = await getApplicationSupportDirectory();
  final mediaDir = Directory(p.join(dir.path, 'cached_media'));
  if (!mediaDir.existsSync()) {
    await mediaDir.create(recursive: true);
  }
  final safeName = mediaKey.replaceAll(RegExp('[^A-Za-z0-9._-]'), '_');
  final file = File(p.join(mediaDir.path, safeName));
  await file.writeAsBytes(bytes, flush: true);
  return file.path;
}

/// Verifies and returns an existing local file path for offline playback.
Future<String?> resolveCachedAudioPlayableUrl(String refOrPath) async {
  if (refOrPath.isEmpty) return null;
  final file = File(refOrPath);
  if (file.existsSync()) return file.path;
  return null;
}

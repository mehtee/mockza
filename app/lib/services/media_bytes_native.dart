import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:mockza/services/native/native_media_picker_channel.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// On native platforms, audio files are already written directly to app support disk.
Future<String> persistRecordedAudioClip(
  String pathOrUrl,
  String clipId, {
  String? mimeType,
}) async => pathOrUrl;

/// Verifies the local file exists and returns explicit durability status (`RR-07`).
Future<({String pathOrUrl, bool isDurable, String? errorMessage})>
persistRecordedAudioClipWithStatus(
  String pathOrUrl,
  String clipId, {
  String? mimeType,
}) async {
  if (pathOrUrl.isEmpty) {
    return (
      pathOrUrl: '',
      isDurable: false,
      errorMessage: 'Empty audio recording path',
    );
  }
  final file = File(pathOrUrl);
  if (!file.existsSync()) {
    return (
      pathOrUrl: pathOrUrl,
      isDurable: false,
      errorMessage: 'Recorded file missing on disk',
    );
  }
  return (pathOrUrl: pathOrUrl, isDurable: true, errorMessage: null);
}

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
  String mediaKey, {
  String? mimeType,
}) async {
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

/// Verifies and returns an existing local file path for playback.
Future<String?> resolveCachedAudioPlayableUrl(
  String refOrPath, {
  String? mimeType,
}) async {
  if (refOrPath.isEmpty) return null;
  final file = File(refOrPath);
  if (file.existsSync()) return file.path;
  return null;
}

/// No-op on native platforms where local file paths are used directly.
Future<void> releasePlayableAudioUrl(String? url) async {}

/// Erases all local speaking clips and cached media directories on account wipe (`RR-05`).
Future<bool> clearAllCachedMediaAndClips() async {
  var allCleared = true;
  try {
    final dir = await getApplicationSupportDirectory();
    for (final folder in const <String>['speaking_clips', 'cached_media']) {
      final target = Directory(p.join(dir.path, folder));
      if (target.existsSync()) {
        await target.delete(recursive: true);
      }
    }
  } on Object {
    allCleared = false;
  }
  return allCleared;
}

/// Opens native Android/iOS document/photo picker via platform channel and reads bytes.
Future<List<({String name, String mimeType, Uint8List bytes})>>
pickLocalMediaFiles({
  required String acceptMime,
  bool allowMultiple = false,
  int maxFiles = 4,
}) async {
  final paths = await NativeMediaPickerChannel.pickMediaPaths(
    acceptMime: acceptMime,
    allowMultiple: allowMultiple,
    maxFiles: maxFiles,
  );
  if (paths.isEmpty) {
    return const <({String name, String mimeType, Uint8List bytes})>[];
  }
  final picked = <({String name, String mimeType, Uint8List bytes})>[];
  for (final rawPath in paths.take(maxFiles)) {
    final file = File(rawPath);
    if (!file.existsSync()) continue;
    final bytes = await file.readAsBytes();
    if (bytes.isEmpty) continue;
    final ext = p.extension(rawPath).toLowerCase();
    final mime = switch (ext) {
      '.png' => 'image/png',
      '.webp' => 'image/webp',
      '.mp3' => 'audio/mpeg',
      '.ogg' => 'audio/ogg',
      '.wav' => 'audio/wav',
      '.m4a' || '.mp4' => 'audio/mp4',
      _ => acceptMime.startsWith('audio/') ? 'audio/mp4' : 'image/jpeg',
    };
    picked.add((
      name: p.basename(rawPath),
      mimeType: mime,
      bytes: bytes,
    ));
  }
  return picked;
}

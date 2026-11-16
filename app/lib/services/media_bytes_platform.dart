import 'dart:typed_data';

import 'package:mockza/services/media_bytes_native.dart'
    if (dart.library.js_interop) 'package:mockza/services/media_bytes_web.dart'
    as platform;

/// Result of attempting to durably persist a captured recording (`RR-07`).
typedef PersistedAudioClipResult = ({
  String pathOrUrl,
  bool isDurable,
  String? errorMessage,
});

/// Persists a captured recording durably across restarts/reloads when needed (`idb://` on Web).
Future<String> persistRecordedAudioClip(
  String pathOrUrl,
  String clipId, {
  String? mimeType,
}) => platform.persistRecordedAudioClip(pathOrUrl, clipId, mimeType: mimeType);

/// Persists a captured recording and explicitly reports whether durable storage succeeded (`RR-07`).
Future<PersistedAudioClipResult> persistRecordedAudioClipWithStatus(
  String pathOrUrl,
  String clipId, {
  String? mimeType,
}) => platform.persistRecordedAudioClipWithStatus(
  pathOrUrl,
  clipId,
  mimeType: mimeType,
);

/// Reads binary bytes from a local filesystem path (Native) or IndexedDB/`blob:` (Web).
Future<Uint8List?> readRecordedAudioBytes(String pathOrUrl) =>
    platform.readRecordedAudioBytes(pathOrUrl);

/// Deletes a temporary recorded audio clip (file on Native, object URL or IndexedDB key on Web).
Future<void> deleteRecordedAudioClip(String pathOrUrl) =>
    platform.deleteRecordedAudioClip(pathOrUrl);

/// Returns a writable output file path on Native platforms, or empty string on Web.
Future<String> createTempRecordingPath(String fileName) =>
    platform.createTempRecordingPath(fileName);

/// Persists downloaded offline media bytes (audio/images) durably for offline playback (`TD-32`).
Future<String> persistCachedMediaBytes(
  Uint8List bytes,
  String mediaKey, {
  String? mimeType,
}) => platform.persistCachedMediaBytes(bytes, mediaKey, mimeType: mimeType);

/// Resolves a stored offline or recorded audio reference (`idb://...` or local file path)
/// to a playable URI/path, preserving [mimeType] on Web (`RR-02`).
Future<String?> resolveCachedAudioPlayableUrl(
  String refOrPath, {
  String? mimeType,
}) => platform.resolveCachedAudioPlayableUrl(refOrPath, mimeType: mimeType);

/// Releases any temporary playback URL allocated by [resolveCachedAudioPlayableUrl] (e.g. Web `blob:`).
Future<void> releasePlayableAudioUrl(String? url) =>
    platform.releasePlayableAudioUrl(url);

/// Completely erases ALL local recorded clips and cached media bytes for account deletion (`RR-05`).
Future<bool> clearAllCachedMediaAndClips() =>
    platform.clearAllCachedMediaAndClips();

import 'dart:typed_data';

import 'package:mockza/services/media_bytes_native.dart'
    if (dart.library.js_interop) 'package:mockza/services/media_bytes_web.dart'
    as platform;

/// Persists a captured recording durably across restarts/reloads when needed (`idb://` on Web).
Future<String> persistRecordedAudioClip(String pathOrUrl, String clipId) =>
    platform.persistRecordedAudioClip(pathOrUrl, clipId);

/// Reads binary bytes from a local filesystem path (Native) or IndexedDB/`blob:` (Web).
Future<Uint8List?> readRecordedAudioBytes(String pathOrUrl) =>
    platform.readRecordedAudioBytes(pathOrUrl);

/// Deletes a temporary recorded audio clip (file on Native, object URL on Web).
Future<void> deleteRecordedAudioClip(String pathOrUrl) =>
    platform.deleteRecordedAudioClip(pathOrUrl);

/// Returns a writable output file path on Native platforms, or empty string on Web.
Future<String> createTempRecordingPath(String fileName) =>
    platform.createTempRecordingPath(fileName);

/// Persists downloaded offline media bytes (audio/images) durably for offline playback (`TD-32`).
Future<String> persistCachedMediaBytes(Uint8List bytes, String mediaKey) =>
    platform.persistCachedMediaBytes(bytes, mediaKey);

/// Resolves a stored offline media reference (`idb://...` or local file path) to a playable URI/path.
Future<String?> resolveCachedAudioPlayableUrl(String refOrPath) =>
    platform.resolveCachedAudioPlayableUrl(refOrPath);

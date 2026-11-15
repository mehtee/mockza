import 'dart:typed_data';

import 'package:mockza/services/media_bytes_native.dart'
    if (dart.library.js_interop) 'package:mockza/services/media_bytes_web.dart'
    as platform;

/// Reads binary bytes from a local filesystem path (Native) or `blob:` URL (Web).
Future<Uint8List?> readRecordedAudioBytes(String pathOrUrl) =>
    platform.readRecordedAudioBytes(pathOrUrl);

/// Deletes a temporary recorded audio clip (file on Native, object URL on Web).
Future<void> deleteRecordedAudioClip(String pathOrUrl) =>
    platform.deleteRecordedAudioClip(pathOrUrl);

/// Returns a writable output file path on Native platforms, or empty string on Web.
Future<String> createTempRecordingPath(String fileName) =>
    platform.createTempRecordingPath(fileName);

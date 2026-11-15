import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

/// Fetches recorded audio bytes from a browser `blob:` URL created by `record`.
Future<Uint8List?> readRecordedAudioBytes(String pathOrUrl) async {
  if (pathOrUrl.isEmpty) return null;
  try {
    final response = await web.window.fetch(pathOrUrl.toJS).toDart;
    if (!response.ok) return null;
    final buffer = await response.arrayBuffer().toDart;
    return buffer.toDart.asUint8List();
  } on Object {
    return null;
  }
}

/// Revokes a browser `blob:` object URL to release memory.
Future<void> deleteRecordedAudioClip(String pathOrUrl) async {
  if (!pathOrUrl.startsWith('blob:')) return;
  try {
    web.URL.revokeObjectURL(pathOrUrl);
  } on Object {
    // Ignore invalid object URL.
  }
}

/// On Web `package:record` returns an in-memory `blob:` URL on `stop()`, so an empty path suffices.
Future<String> createTempRecordingPath(String fileName) async => '';

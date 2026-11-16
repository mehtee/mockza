import 'dart:async';
import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

const String _idbPrefix = 'idb://';
const String _idbName = 'mockza_audio_clips';
const String _idbStore = 'clips';

Future<web.IDBDatabase?> _openClipsDb() async {
  try {
    final req = web.window.indexedDB.open(_idbName, 1);
    final completer = Completer<web.IDBDatabase?>();
    req.onupgradeneeded = (web.Event _) {
      final db = req.result as web.IDBDatabase?;
      if (db != null && !db.objectStoreNames.contains(_idbStore)) {
        db.createObjectStore(_idbStore);
      }
    }.toJS;
    req.onsuccess = (web.Event _) {
      if (!completer.isCompleted) {
        completer.complete(req.result as web.IDBDatabase?);
      }
    }.toJS;
    req.onerror = (web.Event _) {
      if (!completer.isCompleted) {
        completer.complete(null);
      }
    }.toJS;
    return await completer.future;
  } on Object {
    return null;
  }
}

Future<bool> _putIdbBytes(String clipKey, Uint8List bytes) async {
  final db = await _openClipsDb();
  if (db == null) return false;
  try {
    final tx = db.transaction(_idbStore.toJS, 'readwrite');
    final store = tx.objectStore(_idbStore);
    final completer = Completer<bool>();
    store.put(bytes.toJS, clipKey.toJS)
      ..onsuccess = (web.Event _) {
        if (!completer.isCompleted) completer.complete(true);
      }.toJS
      ..onerror = (web.Event _) {
        if (!completer.isCompleted) completer.complete(false);
      }.toJS;
    return await completer.future;
  } on Object {
    return false;
  } finally {
    db.close();
  }
}

Future<Uint8List?> _getIdbBytes(String clipKey) async {
  final db = await _openClipsDb();
  if (db == null) return null;
  try {
    final tx = db.transaction(_idbStore.toJS, 'readonly');
    final store = tx.objectStore(_idbStore);
    final req = store.get(clipKey.toJS);
    final completer = Completer<Uint8List?>();
    req
      ..onsuccess = (web.Event _) {
        if (completer.isCompleted) return;
        final res = req.result;
        if (res != null && res.isA<JSUint8Array>()) {
          completer.complete((res as JSUint8Array).toDart);
        } else {
          completer.complete(null);
        }
      }.toJS
      ..onerror = (web.Event _) {
        if (!completer.isCompleted) completer.complete(null);
      }.toJS;
    return await completer.future;
  } on Object {
    return null;
  } finally {
    db.close();
  }
}

Future<void> _deleteIdbBytes(String clipKey) async {
  final db = await _openClipsDb();
  if (db == null) return;
  try {
    final tx = db.transaction(_idbStore.toJS, 'readwrite');
    final store = tx.objectStore(_idbStore);
    final completer = Completer<void>();
    store.delete(clipKey.toJS)
      ..onsuccess = (web.Event _) {
        if (!completer.isCompleted) completer.complete();
      }.toJS
      ..onerror = (web.Event _) {
        if (!completer.isCompleted) completer.complete();
      }.toJS;
    await completer.future;
  } on Object {
    // Ignore IDB cleanup failures.
  } finally {
    db.close();
  }
}

/// Persists a newly stopped browser `blob:` recording into IndexedDB under a stable
/// `idb://<clipId>` key so pending speaking recordings survive page reloads (`TD-41`).
Future<String> persistRecordedAudioClip(String pathOrUrl, String clipId) async {
  if (pathOrUrl.isEmpty) return '';
  if (pathOrUrl.startsWith(_idbPrefix)) return pathOrUrl;

  final bytes = await readRecordedAudioBytes(pathOrUrl);
  if (bytes == null || bytes.isEmpty) return pathOrUrl;

  final stored = await _putIdbBytes(clipId, bytes);
  if (stored) {
    if (pathOrUrl.startsWith('blob:')) {
      try {
        web.URL.revokeObjectURL(pathOrUrl);
      } on Object {
        // Ignore invalid object URL.
      }
    }
    return '$_idbPrefix$clipId';
  }
  return pathOrUrl;
}

/// Reads recorded audio bytes from durable IndexedDB (`idb://...`) or browser `blob:` URL.
Future<Uint8List?> readRecordedAudioBytes(String pathOrUrl) async {
  if (pathOrUrl.isEmpty) return null;
  if (pathOrUrl.startsWith(_idbPrefix)) {
    return await _getIdbBytes(pathOrUrl.substring(_idbPrefix.length));
  }
  try {
    final response = await web.window.fetch(pathOrUrl.toJS).toDart;
    if (!response.ok) return null;
    final buffer = await response.arrayBuffer().toDart;
    return buffer.toDart.asUint8List();
  } on Object {
    return null;
  }
}

/// Deletes a durable IndexedDB clip or revokes a temporary `blob:` object URL.
Future<void> deleteRecordedAudioClip(String pathOrUrl) async {
  if (pathOrUrl.isEmpty) return;
  if (pathOrUrl.startsWith(_idbPrefix)) {
    await _deleteIdbBytes(pathOrUrl.substring(_idbPrefix.length));
    return;
  }
  if (!pathOrUrl.startsWith('blob:')) return;
  try {
    web.URL.revokeObjectURL(pathOrUrl);
  } on Object {
    // Ignore invalid object URL.
  }
}

/// On Web `package:record` returns an in-memory `blob:` URL on `stop()`, so an empty path suffices.
Future<String> createTempRecordingPath(String fileName) async => '';

/// Persists downloaded pack media bytes into IndexedDB under `idb://media_<key>` (`TD-32`).
Future<String> persistCachedMediaBytes(
  Uint8List bytes,
  String mediaKey,
) async {
  final safeKey =
      'media_${mediaKey.replaceAll(RegExp('[^A-Za-z0-9._-]'), '_')}';
  final stored = await _putIdbBytes(safeKey, bytes);
  return stored ? '$_idbPrefix$safeKey' : '';
}

/// Materializes an `idb://` media clip into an in-memory `blob:` URL for `just_audio` web playback.
Future<String?> resolveCachedAudioPlayableUrl(String refOrPath) async {
  if (!refOrPath.startsWith(_idbPrefix)) return null;
  final bytes = await _getIdbBytes(refOrPath.substring(_idbPrefix.length));
  if (bytes == null || bytes.isEmpty) return null;
  final mimeType = refOrPath.toLowerCase().contains('.wav')
      ? 'audio/wav'
      : refOrPath.toLowerCase().contains('.ogg')
      ? 'audio/ogg'
      : 'audio/mp4';
  final blob = web.Blob(
    <JSAny>[bytes.toJS].toJS,
    web.BlobPropertyBag(type: mimeType),
  );
  return web.URL.createObjectURL(blob);
}

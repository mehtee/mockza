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
    req
      ..onupgradeneeded = (web.Event _) {
        final db = req.result as web.IDBDatabase?;
        if (db != null && !db.objectStoreNames.contains(_idbStore)) {
          db.createObjectStore(_idbStore);
        }
      }.toJS
      ..onsuccess = (web.Event _) {
        if (!completer.isCompleted) {
          completer.complete(req.result as web.IDBDatabase?);
        }
      }.toJS
      ..onerror = (web.Event _) {
        if (!completer.isCompleted) {
          completer.complete(null);
        }
      }.toJS
      ..onblocked = (web.Event _) {
        if (!completer.isCompleted) {
          completer.complete(null);
        }
      }.toJS;
    return await completer.future;
  } on Object {
    return null;
  }
}

/// Writes binary bytes and optional companion MIME type, waiting for full
/// `tx.oncomplete` (or abort/error) before reporting success (`RR-07`).
Future<bool> _putIdbBytes(
  String clipKey,
  Uint8List bytes, {
  String? mimeType,
}) async {
  final db = await _openClipsDb();
  if (db == null) return false;
  try {
    final tx = db.transaction(_idbStore.toJS, 'readwrite');
    final store = tx.objectStore(_idbStore);
    final completer = Completer<bool>();

    tx
      ..oncomplete = (web.Event _) {
        if (!completer.isCompleted) completer.complete(true);
      }.toJS
      ..onabort = (web.Event _) {
        if (!completer.isCompleted) completer.complete(false);
      }.toJS
      ..onerror = (web.Event _) {
        if (!completer.isCompleted) completer.complete(false);
      }.toJS;

    store.put(bytes.toJS, clipKey.toJS).onerror = (web.Event _) {
      if (!completer.isCompleted) completer.complete(false);
    }.toJS;

    if (mimeType != null && mimeType.isNotEmpty) {
      store
          .put(mimeType.toJS, '${clipKey}__mime'.toJS)
          .onerror = (web.Event _) {
        if (!completer.isCompleted) completer.complete(false);
      }.toJS;
    }

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

Future<String?> _getIdbMimeType(String clipKey) async {
  final db = await _openClipsDb();
  if (db == null) return null;
  try {
    final tx = db.transaction(_idbStore.toJS, 'readonly');
    final store = tx.objectStore(_idbStore);
    final req = store.get('${clipKey}__mime'.toJS);
    final completer = Completer<String?>();
    req
      ..onsuccess = (web.Event _) {
        if (completer.isCompleted) return;
        final res = req.result;
        if (res != null && res.isA<JSString>()) {
          completer.complete((res as JSString).toDart);
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
    tx
      ..oncomplete = (web.Event _) {
        if (!completer.isCompleted) completer.complete();
      }.toJS
      ..onabort = (web.Event _) {
        if (!completer.isCompleted) completer.complete();
      }.toJS
      ..onerror = (web.Event _) {
        if (!completer.isCompleted) completer.complete();
      }.toJS;
    store
      ..delete(clipKey.toJS)
      ..delete('${clipKey}__mime'.toJS);
    await completer.future;
  } on Object {
    // Ignore IDB cleanup failures.
  } finally {
    db.close();
  }
}

/// Persists a newly stopped browser `blob:` recording into IndexedDB and explicitly reports
/// whether the transaction committed (`RR-07`).
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
      errorMessage: 'No recorded audio URL to store.',
    );
  }
  if (pathOrUrl.startsWith(_idbPrefix)) {
    return (pathOrUrl: pathOrUrl, isDurable: true, errorMessage: null);
  }

  final bytes = await readRecordedAudioBytes(pathOrUrl);
  if (bytes == null || bytes.isEmpty) {
    return (
      pathOrUrl: pathOrUrl,
      isDurable: false,
      errorMessage: 'Recorded audio buffer could not be read.',
    );
  }

  final stored = await _putIdbBytes(clipId, bytes, mimeType: mimeType);
  if (stored) {
    if (pathOrUrl.startsWith('blob:')) {
      await releasePlayableAudioUrl(pathOrUrl);
    }
    return (
      pathOrUrl: '$_idbPrefix$clipId',
      isDurable: true,
      errorMessage: null,
    );
  }
  return (
    pathOrUrl: pathOrUrl,
    isDurable: false,
    errorMessage:
        'Browser IndexedDB storage transaction aborted or quota exceeded.',
  );
}

/// Persists a newly stopped browser `blob:` recording into IndexedDB under a stable
/// `idb://<clipId>` key so pending speaking recordings survive page reloads (`TD-41`).
Future<String> persistRecordedAudioClip(
  String pathOrUrl,
  String clipId, {
  String? mimeType,
}) async {
  final res = await persistRecordedAudioClipWithStatus(
    pathOrUrl,
    clipId,
    mimeType: mimeType,
  );
  return res.pathOrUrl;
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
  await releasePlayableAudioUrl(pathOrUrl);
}

/// On Web `package:record` returns an in-memory `blob:` URL on `stop()`, so an empty path suffices.
Future<String> createTempRecordingPath(String fileName) async => '';

/// Persists downloaded pack media bytes into IndexedDB under `idb://media_<key>` (`TD-32`).
Future<String> persistCachedMediaBytes(
  Uint8List bytes,
  String mediaKey, {
  String? mimeType,
}) async {
  final safeKey =
      'media_${mediaKey.replaceAll(RegExp('[^A-Za-z0-9._-]'), '_')}';
  final stored = await _putIdbBytes(safeKey, bytes, mimeType: mimeType);
  return stored ? '$_idbPrefix$safeKey' : '';
}

/// Materializes an `idb://` media or recording clip into an in-memory `blob:` URL
/// using its preserved MIME type for `just_audio` web playback (`RR-02`).
Future<String?> resolveCachedAudioPlayableUrl(
  String refOrPath, {
  String? mimeType,
}) async {
  if (!refOrPath.startsWith(_idbPrefix)) {
    return refOrPath.isEmpty ? null : refOrPath;
  }
  final clipKey = refOrPath.substring(_idbPrefix.length);
  final bytes = await _getIdbBytes(clipKey);
  if (bytes == null || bytes.isEmpty) return null;
  final storedMime = await _getIdbMimeType(clipKey);
  final lowerRef = refOrPath.toLowerCase();
  final resolvedMime = (storedMime != null && storedMime.trim().isNotEmpty)
      ? storedMime.trim()
      : (mimeType != null && mimeType.trim().isNotEmpty)
      ? mimeType.trim()
      : lowerRef.contains('.wav')
      ? 'audio/wav'
      : lowerRef.contains('.ogg')
      ? 'audio/ogg'
      : lowerRef.contains('.webm')
      ? 'audio/webm'
      : 'audio/mp4';
  final blob = web.Blob(
    <JSAny>[bytes.toJS].toJS,
    web.BlobPropertyBag(type: resolvedMime),
  );
  return web.URL.createObjectURL(blob);
}

/// Revokes a materialized browser `blob:` URL once replaced or released (`RR-02`).
Future<void> releasePlayableAudioUrl(String? url) async {
  if (url == null || !url.startsWith('blob:')) return;
  try {
    web.URL.revokeObjectURL(url);
  } on Object {
    // Ignore invalid object URL.
  }
}

/// Clears the entire IndexedDB audio/media store for full account erasure (`RR-05`).
Future<bool> clearAllCachedMediaAndClips() async {
  final db = await _openClipsDb();
  if (db == null) return false;
  try {
    final tx = db.transaction(_idbStore.toJS, 'readwrite');
    final store = tx.objectStore(_idbStore);
    final completer = Completer<bool>();
    tx
      ..oncomplete = (web.Event _) {
        if (!completer.isCompleted) completer.complete(true);
      }.toJS
      ..onabort = (web.Event _) {
        if (!completer.isCompleted) completer.complete(false);
      }.toJS
      ..onerror = (web.Event _) {
        if (!completer.isCompleted) completer.complete(false);
      }.toJS;
    store.clear();
    return await completer.future;
  } on Object {
    return false;
  } finally {
    db.close();
  }
}

/// Opens a browser `<input type="file">` picker for images or audio and reads bytes cleanly.
Future<List<({String name, String mimeType, Uint8List bytes})>>
pickLocalMediaFiles({
  required String acceptMime,
  bool allowMultiple = false,
  int maxFiles = 4,
}) async {
  final input = web.document.createElement('input') as web.HTMLInputElement
    ..type = 'file'
    ..accept = acceptMime
    ..multiple = allowMultiple;
  final completer = Completer<List<web.File>>();

  input
    ..onchange = (web.Event _) {
      if (completer.isCompleted) return;
      final fileList = input.files;
      final out = <web.File>[];
      if (fileList != null) {
        for (var i = 0; i < fileList.length && i < maxFiles; i++) {
          final item = fileList.item(i);
          if (item != null) out.add(item);
        }
      }
      completer.complete(out);
    }.toJS
    ..oncancel = (web.Event _) {
      if (!completer.isCompleted) completer.complete(const <web.File>[]);
    }.toJS;

  input.click();
  final selected = await completer.future.timeout(
    const Duration(seconds: 60),
    onTimeout: () => const <web.File>[],
  );
  final out = <({String name, String mimeType, Uint8List bytes})>[];
  for (final file in selected.take(maxFiles)) {
    final buf = await file.arrayBuffer().toDart;
    final bytes = buf.toDart.asUint8List();
    if (bytes.isEmpty) continue;
    final mime = file.type.trim().isNotEmpty
        ? file.type.trim()
        : (acceptMime.startsWith('audio/') ? 'audio/mp4' : 'image/jpeg');
    out.add((name: file.name, mimeType: mime, bytes: bytes));
  }
  return out;
}

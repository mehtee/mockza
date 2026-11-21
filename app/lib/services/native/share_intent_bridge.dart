import 'dart:async';

import 'package:flutter/services.dart';
import 'package:meta/meta.dart';

/// Typed payload shared into Mockza/Sanjia from Android `ACTION_SEND` or iOS App Group Share Extension.
@immutable
class InboundSharePayload {
  /// Creates an [InboundSharePayload].
  const new({
    required this.kind,
    this.textOrUrl,
    this.filePaths = const <String>[],
    this.mimeType,
  });

  /// Input kind (`url`, `text`, `image`, or `audio`).
  final String kind;

  /// Shared URL or text snippet.
  final String? textOrUrl;

  /// Bounded temporary file paths staged in app sandbox/App Group container.
  final List<String> filePaths;

  /// Original OS MIME type hint.
  final String? mimeType;

  /// Parses raw platform channel map safely.
  static InboundSharePayload? fromPlatformMap(Object? raw) {
    if (raw is! Map<Object?, Object?>) return null;
    final text = raw['text']?.toString().trim();
    final files = ((raw['files'] as List<Object?>?) ?? const <Object?>[])
        .map((e) => e.toString())
        .where((s) => s.isNotEmpty)
        .take(4)
        .toList(growable: false);
    final mime = raw['mimeType']?.toString().toLowerCase();

    if (files.isNotEmpty) {
      final isAudio = mime != null && mime.startsWith('audio/');
      return InboundSharePayload(
        kind: isAudio ? 'audio' : 'image',
        filePaths: files,
        mimeType: mime,
      );
    }
    if (text != null && text.isNotEmpty) {
      final looksUrl =
          text.startsWith('http://') || text.startsWith('https://');
      return InboundSharePayload(
        kind: looksUrl ? 'url' : 'text',
        textOrUrl: text,
        mimeType: mime,
      );
    }
    return null;
  }
}

/// Quarantined OS Share Sheet native bridge (sole channel boundary outside `services/native/`).
final class ShareIntentBridge {
  /// Creates a [ShareIntentBridge].
  new({MethodChannel? channel})
    : _channel = channel ?? const MethodChannel('com.mockza.app/share_intent');

  final MethodChannel _channel;
  final StreamController<InboundSharePayload> _controller =
      StreamController<InboundSharePayload>.broadcast();
  bool _initialized = false;

  /// Reactive stream of inbound OS share events routed to `/drop`.
  Stream<InboundSharePayload> get incomingShares => _controller.stream;

  /// Registers native callback and drains any cold-launch share intent.
  Future<InboundSharePayload?> initializeAndDrainInitialShare() async {
    if (!_initialized) {
      _initialized = true;
      _channel.setMethodCallHandler((call) async {
        if (call.method == 'onShareReceived') {
          final parsed = InboundSharePayload.fromPlatformMap(call.arguments);
          if (parsed != null && !_controller.isClosed) {
            _controller.add(parsed);
          }
        }
      });
    }
    try {
      final rawInitial = await _channel.invokeMethod<Object?>(
        'consumeInitialShare',
      );
      return InboundSharePayload.fromPlatformMap(rawInitial);
    } on MissingPluginException {
      return null;
    } on PlatformException {
      return null;
    }
  }

  /// Emits a synthetic share payload cleanly in integration/E2E tests.
  void emitSyntheticShare(InboundSharePayload payload) {
    if (!_controller.isClosed) {
      _controller.add(payload);
    }
  }

  /// Releases stream controller cleanly.
  Future<void> dispose() => _controller.close();
}

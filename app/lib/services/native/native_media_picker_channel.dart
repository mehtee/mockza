import 'package:flutter/services.dart';

/// Quarantined platform channel for invoking native Android/iOS media document pickers.
abstract final class NativeMediaPickerChannel {
  static const MethodChannel _channel = MethodChannel(
    'com.mockza.app/media_picker',
  );

  /// Requests native document/photo picker paths bounded by [acceptMime], [allowMultiple], and [maxFiles].
  static Future<List<String>> pickMediaPaths({
    required String acceptMime,
    required bool allowMultiple,
    required int maxFiles,
  }) async {
    try {
      final paths = await _channel.invokeListMethod<String>(
        'pickMediaFiles',
        <String, Object?>{
          'mimeType': acceptMime,
          'multiple': allowMultiple,
          'maxFiles': maxFiles,
        },
      );
      return paths ?? const <String>[];
    } on MissingPluginException {
      return const <String>[];
    } on PlatformException {
      return const <String>[];
    }
  }
}

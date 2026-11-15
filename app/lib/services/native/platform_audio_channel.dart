import 'package:flutter/services.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';

/// Quarantined native platform-channel boundary for OS audio focus, session tuning,
/// and deep-linking to OS app permission settings.
final class PlatformAudioChannel {
  /// Creates a [PlatformAudioChannel] wrapping the OS method channel.
  const new([
    this._channel = const MethodChannel('com.mockza/audio_session'),
  ]);

  final MethodChannel _channel;

  /// Requests transient native voice-recording audio focus from the OS.
  Future<Result<void, Failure>> configureRecordingSession() async {
    try {
      await _channel.invokeMethod<void>('configureRecordingSession');
      return const Ok(null);
    } on MissingPluginException {
      // Safe fallback when native platform handlers are absent (e.g., Web or VM tests).
      return const Ok(null);
    } on PlatformException catch (e) {
      return Err(StorageFailure('Audio session setup failed: ${e.message}'));
    }
  }

  /// Opens the operating system's application permission settings screen so the
  /// learner can re-enable microphone access after permanently denying it.
  Future<Result<bool, Failure>> openAppSettings() async {
    try {
      final opened = await _channel.invokeMethod<bool>('openAppSettings');
      return Ok(opened ?? false);
    } on MissingPluginException {
      return const Ok(false);
    } on PlatformException catch (e) {
      return Err(StorageFailure('Unable to open OS settings: ${e.message}'));
    }
  }
}

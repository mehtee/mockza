import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:record/record.dart';

/// Thin gateway interface for microphone permission, live level metering & capture.
abstract interface class AudioRecorderGateway {
  /// MIME content type produced by the active platform encoder (`audio/webm` on Web, `audio/mp4` on Mobile).
  String get activeContentType;

  /// Checks or prompts for OS / browser microphone permission.
  Future<Result<bool, Failure>> hasPermission({bool request = true});

  /// Starts recording speech audio to [outputPath] (ignored on Web where a `blob:` URL is generated).
  Future<Result<void, Failure>> startRecording({required String outputPath});

  /// Stops capture and returns the finalized output file path or Web `blob:` URL if present.
  Future<Result<String?, Failure>> stopRecording();

  /// Streams real-time normalized microphone amplitude `[0.0..1.0]` for the waveform meter.
  Stream<double> watchAmplitude();

  /// Releases native microphone resources.
  Future<void> dispose();
}

/// Concrete [AudioRecorderGateway] backed by `package:record`.
final class RecordAudioRecorderGateway implements AudioRecorderGateway {
  /// Creates a [RecordAudioRecorderGateway].
  new([AudioRecorder? recorder]) : _recorder = recorder ?? AudioRecorder();

  final AudioRecorder _recorder;

  @override
  String get activeContentType => kIsWeb ? 'audio/webm' : 'audio/mp4';

  @override
  Future<Result<bool, Failure>> hasPermission({bool request = true}) async {
    try {
      final granted = await _recorder.hasPermission(request: request);
      return Ok(granted);
    } on MissingPluginException {
      return const Ok(false);
    } on PlatformException catch (e) {
      return Err(
        StorageFailure('Microphone permission check failed: ${e.message}'),
      );
    } on Object catch (e) {
      return Err(
        StorageFailure('Microphone permission unavailable: $e'),
      );
    }
  }

  @override
  Future<Result<void, Failure>> startRecording({
    required String outputPath,
  }) async {
    try {
      final isAlreadyRecording = await _recorder.isRecording();
      if (isAlreadyRecording) {
        await _recorder.stop();
      }
      const config = RecordConfig(
        encoder: kIsWeb ? AudioEncoder.opus : AudioEncoder.aacLc,
        bitRate: 64000,
        sampleRate: 16000,
      );
      await _recorder.start(config, path: outputPath);
      return const Ok(null);
    } on MissingPluginException {
      return const Err(
        StorageFailure('Microphone recorder unavailable on this platform'),
      );
    } on PlatformException catch (e) {
      return Err(StorageFailure('Audio capture start failed: ${e.message}'));
    } on Object catch (e) {
      return Err(StorageFailure('Microphone could not start: $e'));
    }
  }

  @override
  Future<Result<String?, Failure>> stopRecording() async {
    try {
      final isRecording = await _recorder.isRecording();
      if (!isRecording) return const Ok(null);
      final path = await _recorder.stop();
      return Ok(path);
    } on MissingPluginException {
      return const Ok(null);
    } on PlatformException catch (e) {
      return Err(StorageFailure('Audio capture stop failed: ${e.message}'));
    } on Object catch (e) {
      return Err(StorageFailure('Audio capture stop failed: $e'));
    }
  }

  @override
  Stream<double> watchAmplitude() => _recorder
      .onAmplitudeChanged(const Duration(milliseconds: 80))
      .map((amp) {
        // Convert dBFS (-55..0) into sensitive normalized linear unit [0.0..1.0].
        final raw = amp.current.isFinite ? amp.current : -60.0;
        final clamped = raw.clamp(-55.0, 0.0);
        return ((clamped + 55.0) / 55.0).clamp(0.0, 1.0);
      })
      .handleError((Object _) {});

  @override
  Future<void> dispose() => _recorder.dispose();
}

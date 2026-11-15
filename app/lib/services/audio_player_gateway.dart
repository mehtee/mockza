import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';

/// Audio playback mode distinguishing rigid exam conditions from study review.
enum AudioPlaybackMode {
  /// Strict IELTS exam rules: track plays once linearly, forward scrubbing and speed change disabled.
  examLinearLocked,

  /// Flexible study mode: interactive scrubbing, backward rewinds, and variable speed allowed.
  studyInteractive,
}

/// Thin gateway interface for streamed SeaweedFS/HTTP Listening prompts and speaking turn replay.
abstract interface class AudioPlayerGateway {
  /// Loads an audio source from a local file path, Web `blob:` URL, or HTTP/HTTPS URL.
  Future<Result<Duration?, Failure>> loadFile(String filePath);

  /// Starts or resumes playback.
  Future<Result<void, Failure>> play();

  /// Pauses active playback without resetting position.
  Future<Result<void, Failure>> pause();

  /// Seeks to [position] (subject to [playbackMode] rules).
  Future<Result<void, Failure>> seek(Duration position);

  /// Adjusts playback rate (e.g., `0.85`, `1.0`, `1.25`).
  Future<Result<void, Failure>> setSpeed(double speed);

  /// Streams current playback elapsed position.
  Stream<Duration> watchPosition();

  /// Streams total track duration.
  Stream<Duration?> watchDuration();

  /// Streams whether playback is currently playing.
  Stream<bool> watchIsPlaying();

  /// Sets the active playback constraint mode.
  void setPlaybackMode(AudioPlaybackMode mode);

  /// Current playback mode.
  AudioPlaybackMode get playbackMode;

  /// Releases native audio player resources.
  Future<void> dispose();
}

/// Concrete [AudioPlayerGateway] wrapping `package:just_audio` for Web & Mobile.
final class JustAudioPlayerGateway implements AudioPlayerGateway {
  /// Creates a [JustAudioPlayerGateway].
  new([AudioPlayer? player]) : _player = player ?? AudioPlayer();

  final AudioPlayer _player;
  AudioPlaybackMode _mode = AudioPlaybackMode.studyInteractive;

  @override
  AudioPlaybackMode get playbackMode => _mode;

  @override
  void setPlaybackMode(AudioPlaybackMode mode) {
    _mode = mode;
  }

  bool _isUrlLike(String source) =>
      source.startsWith('http://') ||
      source.startsWith('https://') ||
      source.startsWith('blob:') ||
      source.startsWith('/v1/');

  @override
  Future<Result<Duration?, Failure>> loadFile(String filePath) async {
    try {
      final duration = _isUrlLike(filePath)
          ? await _player.setUrl(filePath)
          : await _player.setFilePath(filePath);
      return Ok(duration);
    } on PlayerException catch (e) {
      return Err(
        ValidationFailure('Audio load error: ${e.message ?? e.code}'),
      );
    } on MissingPluginException {
      return const Err(StorageFailure('Audio player plugin unavailable'));
    } on PlatformException catch (e) {
      return Err(StorageFailure('Audio platform error: ${e.message}'));
    } on Object catch (e) {
      return Err(ValidationFailure('Audio stream error: $e'));
    }
  }

  @override
  Future<Result<void, Failure>> play() async {
    try {
      await _player.play();
      return const Ok(null);
    } on MissingPluginException {
      return const Err(StorageFailure('Audio player plugin unavailable'));
    } on PlatformException catch (e) {
      return Err(StorageFailure('Playback failed: ${e.message}'));
    } on Object catch (e) {
      return Err(StorageFailure('Playback error: $e'));
    }
  }

  @override
  Future<Result<void, Failure>> pause() async {
    try {
      await _player.pause();
      return const Ok(null);
    } on PlatformException catch (e) {
      return Err(StorageFailure('Pause failed: ${e.message}'));
    } on Object catch (e) {
      return Err(StorageFailure('Pause error: $e'));
    }
  }

  @override
  Future<Result<void, Failure>> seek(Duration position) async {
    if (_mode == AudioPlaybackMode.examLinearLocked) {
      return const Err(
        ValidationFailure('Scrubbing disabled during exam mode simulation'),
      );
    }
    try {
      await _player.seek(position);
      return const Ok(null);
    } on PlatformException catch (e) {
      return Err(StorageFailure('Seek failed: ${e.message}'));
    } on Object catch (e) {
      return Err(StorageFailure('Seek error: $e'));
    }
  }

  @override
  Future<Result<void, Failure>> setSpeed(double speed) async {
    if (_mode == AudioPlaybackMode.examLinearLocked && speed != 1.0) {
      return const Err(
        ValidationFailure('Speed modification locked to 1.0x in exam mode'),
      );
    }
    try {
      await _player.setSpeed(speed);
      return const Ok(null);
    } on PlatformException catch (e) {
      return Err(ValidationFailure('Playback speed rejected: ${e.message}'));
    } on Object catch (e) {
      return Err(ValidationFailure('Playback speed error: $e'));
    }
  }

  @override
  Stream<Duration> watchPosition() => _player.positionStream;

  @override
  Stream<Duration?> watchDuration() => _player.durationStream;

  @override
  Stream<bool> watchIsPlaying() => _player.playingStream;

  @override
  Future<void> dispose() => _player.dispose();
}

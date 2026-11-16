import 'package:clock/clock.dart';

/// Wall-clock countdown tracker resistant to background suspension and JS timer throttling.
final class CountdownClockTracker {
  /// Creates a [CountdownClockTracker].
  new({required this.clock});

  /// Injected clock source (`const Clock()` in prod, `Clock.fixed(...)` in tests).
  final Clock clock;

  int _totalSeconds = 0;
  int _remainingAtAnchor = 0;
  DateTime? _anchorTime;
  bool _isPaused = false;

  /// Total duration configured for this timer window.
  int get totalSeconds => _totalSeconds;

  /// Whether timer is currently paused.
  bool get isPaused => _isPaused;

  /// Starts or resets the tracker at [remainingSeconds] out of [totalSeconds].
  void start({required int remainingSeconds, int? totalSeconds}) {
    _totalSeconds = totalSeconds ?? remainingSeconds;
    _remainingAtAnchor = remainingSeconds.clamp(0, _totalSeconds);
    _anchorTime = _remainingAtAnchor > 0 ? clock.now() : null;
    _isPaused = false;
  }

  /// Freezes remaining time at current elapsed value.
  int pause() {
    final rem = currentRemaining();
    _remainingAtAnchor = rem;
    _anchorTime = null;
    _isPaused = true;
    return rem;
  }

  /// Resumes counting down from the frozen remaining value.
  void resume() {
    if (!_isPaused) return;
    _isPaused = false;
    _anchorTime = _remainingAtAnchor > 0 ? clock.now() : null;
  }

  /// Computes remaining seconds directly from elapsed wall clock time.
  int currentRemaining() {
    if (_isPaused || _anchorTime == null) {
      return _remainingAtAnchor.clamp(0, _totalSeconds);
    }
    final elapsed = clock.now().difference(_anchorTime!).inSeconds;
    if (elapsed <= 0) return _remainingAtAnchor.clamp(0, _totalSeconds);
    return (_remainingAtAnchor - elapsed).clamp(0, _totalSeconds);
  }

  /// Returns `true` when remaining time has reached zero.
  bool get isExpired => currentRemaining() <= 0;
}

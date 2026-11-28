import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Playback policy mode.
enum AudioPlaybackPolicy {
  /// Exam mode: single linear play, no scrub, no speed changes.
  examLinearLock,

  /// Study mode: scrubbing, replay, 0.85x/1.0x/1.25x speed enabled.
  studyInteractive,
}

/// Compact audio player bar conforming to design.md Sec. 5.
class AudioPlayerBar extends StatelessWidget {
  /// Creates an [AudioPlayerBar].
  const new({
    required this.position,
    required this.duration,
    required this.isPlaying,
    required this.onTapPlayPause,
    this.policy = AudioPlaybackPolicy.studyInteractive,
    this.playbackSpeed = 1.0,
    this.onTapSpeed,
    this.onSeek,
    super.key,
  });

  /// Current playback position.
  final Duration position;

  /// Total audio duration.
  final Duration duration;

  /// Whether audio is actively playing.
  final bool isPlaying;

  /// Play/Pause toggle callback.
  final VoidCallback onTapPlayPause;

  /// Playback policy (exam linear lock vs study).
  final AudioPlaybackPolicy policy;

  /// Current playback speed (0.85, 1.0, 1.25).
  final double playbackSpeed;

  /// Speed toggle callback (Study mode only).
  final VoidCallback? onTapSpeed;

  /// Seek callback (Study mode only).
  final ValueChanged<Duration>? onSeek;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final isExam = policy == AudioPlaybackPolicy.examLinearLock;

    String formatDuration(Duration d) {
      final m = d.inMinutes.toString().padLeft(2, '0');
      final s = (d.inSeconds % 60).toString().padLeft(2, '0');
      return '$m:$s';
    }

    final posStr = formatDuration(position);
    final durStr = formatDuration(duration);

    final progressFraction = duration.inMilliseconds > 0
        ? (position.inMilliseconds / duration.inMilliseconds).clamp(0.0, 1.0)
        : 0.0;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: SpacingTokens.md,
        vertical: SpacingTokens.sm,
      ),
      decoration: BoxDecoration(
        color: colors.surfaceAlt,
        borderRadius: shapes.cardRadius,
        border: Border.all(
          color: colors.borderSubtle,
          width: shapes.strokeWidth,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          // Progress slider or non-interactive track
          if (isExam)
            Container(
              height: 4,
              decoration: BoxDecoration(
                color: colors.track,
                borderRadius: shapes.pillRadius,
              ),
              child: FractionallySizedBox(
                alignment: AlignmentDirectional.centerStart,
                widthFactor: progressFraction,
                child: Container(
                  decoration: BoxDecoration(
                    color: colors.speakingAccent,
                    borderRadius: shapes.pillRadius,
                  ),
                ),
              ),
            )
          else
            SliderTheme(
              data: SliderThemeData(
                trackHeight: 4,
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                activeTrackColor: colors.speakingAccent,
                inactiveTrackColor: colors.track,
                thumbColor: colors.textPrimary,
                overlayColor: colors.speakingAccent.withValues(alpha: 0.2),
              ),
              child: Slider(
                value: progressFraction,
                onChanged: onSeek != null
                    ? (val) {
                        final targetMs = (val * duration.inMilliseconds)
                            .round();
                        onSeek!(Duration(milliseconds: targetMs));
                      }
                    : null,
              ),
            ),
          const SizedBox(height: SpacingTokens.xs),
          // Controls and timestamps row
          LayoutBuilder(
            builder: (context, constraints) {
              final isFa = Localizations.localeOf(context).languageCode == 'fa';
              final isCompact = constraints.maxWidth < 400;
              final startBtn = Semantics(
                button: true,
                label: position > Duration.zero
                    ? (isFa ? 'ادامه پخش صدا' : 'Resume exam audio')
                    : (isFa ? 'شروع پخش صدای آزمون' : 'Start listening test audio'),
                child: FilledButton.tonalIcon(
                  onPressed: onTapPlayPause,
                  icon: const AppIcon(LucideGlyph.play, size: 16),
                  label: Text(
                    position > Duration.zero
                        ? (isFa ? 'ادامه پخش' : 'Resume')
                        : (isFa ? 'شروع پخش' : 'Start Audio'),
                    maxLines: 1,
                    softWrap: false,
                  ),
                ),
              );
              final examModeLabel = isFa
                  ? 'حالت آزمون · پخش خطی'
                  : 'Exam Mode · Linear';

              if (isExam && !isPlaying && isCompact) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        startBtn,
                        const SizedBox(width: SpacingTokens.sm),
                        Expanded(
                          child: Align(
                            alignment: AlignmentDirectional.centerEnd,
                            child: Text(
                              '$posStr / $durStr',
                              textDirection: TextDirection.ltr,
                              maxLines: 1,
                              style: typography.timerMono.copyWith(
                                color: colors.textSecondary,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      examModeLabel,
                      style: typography.caption.copyWith(
                        color: colors.textTertiary,
                      ),
                    ),
                  ],
                );
              }

              return Row(
                children: <Widget>[
                  // Play/Start button (`BF-04` / `UX-07`: Exam Mode must still expose a Start control)
                  if (!isExam)
                    IconButton(
                      tooltip: isPlaying
                          ? (isFa ? 'توقف صدا' : 'Pause audio')
                          : (isFa ? 'پخش صدا' : 'Play audio'),
                      onPressed: onTapPlayPause,
                      icon: AppIcon(
                        isPlaying ? LucideGlyph.pause : LucideGlyph.play,
                        size: 20,
                        color: colors.textPrimary,
                      ),
                    )
                  else if (!isPlaying)
                    startBtn
                  else
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: SpacingTokens.sm,
                      ),
                      child: AppIcon(
                        LucideGlyph.volume2,
                        size: 20,
                        color: colors.speakingAccent,
                      ),
                    ),
                  const SizedBox(width: SpacingTokens.xs),
                  if (isExam) ...<Widget>[
                    Text(
                      '$posStr / $durStr',
                      textDirection: TextDirection.ltr,
                      maxLines: 1,
                      style: typography.timerMono.copyWith(
                        color: colors.textSecondary,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(width: SpacingTokens.xs),
                    Expanded(
                      child: Align(
                        alignment: AlignmentDirectional.centerEnd,
                        child: Text(
                          examModeLabel,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: typography.caption.copyWith(
                            color: colors.textTertiary,
                          ),
                        ),
                      ),
                    ),
                  ] else ...<Widget>[
                    Expanded(
                      child: Text(
                        '$posStr / $durStr',
                        textDirection: TextDirection.ltr,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: typography.timerMono.copyWith(
                          color: colors.textSecondary,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    if (onTapSpeed != null) ...<Widget>[
                      const SizedBox(width: SpacingTokens.xs),
                      InkWell(
                        onTap: onTapSpeed,
                        borderRadius: shapes.pillRadius,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: SpacingTokens.sm,
                            vertical: SpacingTokens.xs,
                          ),
                          decoration: BoxDecoration(
                            color: colors.surface,
                            borderRadius: shapes.pillRadius,
                            border: Border.all(
                              color: colors.borderSubtle,
                              width: shapes.strokeWidth,
                            ),
                          ),
                          child: Text(
                            '${playbackSpeed}x',
                            style: typography.caption.copyWith(
                              color: colors.textPrimary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Timer operational state.
enum TimerPhase {
  /// Preparation countdown (e.g. Speaking Part 2 60s prep).
  prep,

  /// Active response countdown.
  response,

  /// Paused in Study Mode.
  paused,

  /// Expired / hard stop reached.
  expired,
}

/// Large readable countdown bar with phase badge (design.md Sec. 5, Screenshots 04 & 06).
class TimerBar extends StatelessWidget {
  /// Creates a [TimerBar].
  const new({
    required this.remainingSeconds,
    this.phase = TimerPhase.response,
    this.totalSeconds,
    this.isStudyMode = false,
    this.onTapPauseResume,
    super.key,
  });

  /// Seconds left in current phase.
  final int remainingSeconds;

  /// Active timer phase.
  final TimerPhase phase;

  /// Total starting seconds for progress calculation.
  final int? totalSeconds;

  /// Whether current session is in Study Mode (allows pause).
  final bool isStudyMode;

  /// Pause/Resume toggle callback for Study Mode.
  final VoidCallback? onTapPauseResume;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final minutes = (remainingSeconds ~/ 60).toString().padLeft(2, '0');
    final seconds = (remainingSeconds % 60).toString().padLeft(2, '0');
    final timeString = '$minutes:$seconds';

    final (String phaseLabel, Color badgeColor) = switch (phase) {
      TimerPhase.prep => ('Preparation Time', colors.vocabAccent),
      TimerPhase.response => ('Time Remaining', colors.textSecondary),
      TimerPhase.paused => ('Paused', colors.vocabAccent),
      TimerPhase.expired => ('Time Up', colors.error),
    };

    final isUrgent = remainingSeconds <= 30 && phase == TimerPhase.response;

    return Semantics(
      label: '$phaseLabel: $minutes minutes $seconds seconds remaining',
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: SpacingTokens.md,
          vertical: SpacingTokens.sm,
        ),
        decoration: BoxDecoration(
          color: colors.surfaceAlt,
          borderRadius: shapes.controlRadius,
          border: Border.all(
            color: isUrgent ? colors.error : colors.borderSubtle,
            width: isUrgent ? 1.5 : shapes.strokeWidth,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            AppIcon(
              LucideGlyph.timer,
              size: 18,
              color: isUrgent ? colors.error : colors.textSecondary,
            ),
            const SizedBox(width: SpacingTokens.sm),
            Text(
              timeString,
              style: typography.timerMono.copyWith(
                color: isUrgent ? colors.error : colors.textPrimary,
                fontSize: 18,
              ),
            ),
            const SizedBox(width: SpacingTokens.sm),
            Flexible(
              child: Text(
                phaseLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: typography.caption.copyWith(
                  color: badgeColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            if (isStudyMode && onTapPauseResume != null) ...<Widget>[
              const SizedBox(width: SpacingTokens.sm),
              InkWell(
                onTap: onTapPauseResume,
                child: AppIcon(
                  phase == TimerPhase.paused
                      ? LucideGlyph.play
                      : LucideGlyph.pause,
                  size: 16,
                  color: colors.textSecondary,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Live audio level & mic activity meter (design.md Sec. 5, Screenshots 04 & 05).
class AudioLevelMeter extends StatelessWidget {
  /// Creates an [AudioLevelMeter].
  const new({
    this.normalizedLevel = 0.0,
    this.isRecording = false,
    this.isPreviewing = false,
    this.hasPermission = true,
    this.isClipping = false,
    this.isSilent = false,
    this.barCount = 18,
    this.height = 48,
    super.key,
  });

  /// Current normalized audio peak level (0.0 to 1.0).
  final double normalizedLevel;

  /// Whether audio is actively capturing for a scored turn.
  final bool isRecording;

  /// Whether live mic check preview is active.
  final bool isPreviewing;

  /// Whether microphone permission was granted.
  final bool hasPermission;

  /// Whether input audio is clipping / too loud.
  final bool isClipping;

  /// Whether input is silent during active speaking phase.
  final bool isSilent;

  /// Number of waveform bars.
  final int barCount;

  /// Height of the waveform box.
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final isFa = Localizations.localeOf(context).languageCode == 'fa';

    if (!hasPermission) {
      return Container(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
        decoration: BoxDecoration(
          color: colors.amberBg,
          borderRadius: shapes.controlRadius,
          border: Border.all(
            color: colors.warning.withValues(alpha: 0.5),
            width: shapes.strokeWidth,
          ),
        ),
        child: Row(
          children: <Widget>[
            AppIcon(LucideGlyph.micOff, size: 20, color: colors.warning),
            const SizedBox(width: SpacingTokens.sm),
            Expanded(
              child: Text(
                isFa
                    ? 'برای تمرین اسپیکینگ، دسترسی میکروفون لازم است.'
                    : 'Microphone permission required for Speaking practice.',
                style: typography.caption.copyWith(
                  color: colors.warning,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      );
    }

    final isActive = isRecording || isPreviewing;
    final waveColor = isClipping
        ? colors.error
        : (isRecording
              ? colors.speakingAccent
              : (isPreviewing ? colors.primary : colors.textTertiary));

    return Semantics(
      label: isActive
          ? 'Microphone active. Level: ${(normalizedLevel * 100).toInt()}%'
          : 'Microphone ready',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          SizedBox(
            height: height,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(barCount, (index) {
                final envelope = math.sin(((index + 0.5) / barCount) * math.pi);
                final harmonic =
                    0.65 +
                    0.35 *
                        math.sin(
                          (index * 0.9) + (normalizedLevel * math.pi * 4),
                        );
                final level = isActive
                    ? (0.12 + (normalizedLevel * envelope * harmonic * 0.95))
                          .clamp(0.10, 1.0)
                    : 0.15 * envelope.clamp(0.4, 1.0);
                final barHeight = ((height * level).clamp(4.0, height) as num)
                    .toDouble();

                return Padding(
                  padding: const EdgeInsetsDirectional.symmetric(horizontal: 2),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 80),
                    width: 3.5,
                    height: barHeight,
                    decoration: BoxDecoration(
                      color: waveColor,
                      borderRadius: shapes.pillRadius,
                    ),
                  ),
                );
              }),
            ),
          ),
          if (isClipping) ...<Widget>[
            const SizedBox(height: SpacingTokens.xs),
            Text(
              'Audio is too loud / clipping',
              style: typography.caption.copyWith(color: colors.error),
            ),
          ] else if (isActive && isSilent) ...<Widget>[
            const SizedBox(height: SpacingTokens.xs),
            Text(
              'Speak into the microphone...',
              style: typography.caption.copyWith(color: colors.textSecondary),
            ),
          ] else if (isPreviewing) ...<Widget>[
            const SizedBox(height: SpacingTokens.xs),
            Text(
              'Voice detected — mic ready',
              style: typography.caption.copyWith(color: colors.primary),
            ),
          ],
        ],
      ),
    );
  }
}

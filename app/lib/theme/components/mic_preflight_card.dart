import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/audio_level_meter.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/primitives.dart';

/// Shared compact pre-flight card for microphone and optional sound playback verification (`ISP` / `OCP`).
///
/// Uses progressive disclosure so the [AudioLevelMeter] appears only when [showLiveMeter]
/// is true, preventing vertical bloat on mobile viewports while remaining ready when
/// actively previewing audio input or surfacing permission issues.
class MicPreflightCard extends StatelessWidget {
  /// Creates a [MicPreflightCard].
  const new({
    required this.title,
    required this.micButtonLabel,
    required this.micButtonGlyph,
    required this.onTapMicCheck,
    required this.showLiveMeter,
    this.trailingLabel,
    this.soundButtonLabel,
    this.soundButtonGlyph,
    this.onTapSoundCheck,
    this.normalizedLevel = 0,
    this.isRecording = false,
    this.isPreviewing = false,
    this.hasPermission = true,
    this.isClipping = false,
    this.isSilent = false,
    this.statusFooter,
    super.key,
  });

  /// Header title (e.g. "Quick Sound & Mic Check" or "Live Microphone Check").
  final String title;

  /// Optional subtle trailing label (e.g. "Optional").
  final String? trailingLabel;

  /// Optional sound test button label (`null` omits the sound test control).
  final String? soundButtonLabel;

  /// Optional sound test button icon.
  final LucideGlyph? soundButtonGlyph;

  /// Optional callback for the sound test control.
  final VoidCallback? onTapSoundCheck;

  /// Label for the microphone test button.
  final String micButtonLabel;

  /// Icon for the microphone test button.
  final LucideGlyph micButtonGlyph;

  /// Callback for the microphone check button.
  final VoidCallback? onTapMicCheck;

  /// Whether the live [AudioLevelMeter] should be expanded in the card.
  final bool showLiveMeter;

  /// Normalized mic input level `[0.0, 1.0]`.
  final double normalizedLevel;

  /// Whether full turn recording is active.
  final bool isRecording;

  /// Whether mic preflight preview is active.
  final bool isPreviewing;

  /// Whether OS microphone permission is granted.
  final bool hasPermission;

  /// Whether microphone input is clipping.
  final bool isClipping;

  /// Whether microphone input appears silent.
  final bool isSilent;

  /// Optional contextual footer banners or recovery actions.
  final Widget? statusFooter;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    final micButton = SecondaryButton(
      label: micButtonLabel,
      glyph: micButtonGlyph,
      onPressed: onTapMicCheck,
    );

    return MzCard(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: SpacingTokens.sm,
            runSpacing: SpacingTokens.xs,
            children: <Widget>[
              Text(title, style: typography.cardTitle),
              if (trailingLabel != null)
                Text(
                  trailingLabel!,
                  style: typography.caption.copyWith(
                    color: colors.textTertiary,
                  ),
                ),
            ],
          ),
          const SizedBox(height: SpacingTokens.sm),
          if (soundButtonLabel != null)
            LayoutBuilder(
              builder: (ctx, constraints) {
                final stackVertically =
                    constraints.maxWidth < 300 ||
                    MediaQuery.textScalerOf(ctx).scale(1) > 1.35;
                final soundButton = SecondaryButton(
                  label: soundButtonLabel!,
                  glyph: soundButtonGlyph ?? LucideGlyph.volume2,
                  onPressed: onTapSoundCheck,
                );
                if (stackVertically) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      soundButton,
                      const SizedBox(height: SpacingTokens.xs),
                      micButton,
                    ],
                  );
                }
                return Row(
                  children: <Widget>[
                    Expanded(child: soundButton),
                    const SizedBox(width: SpacingTokens.sm),
                    Expanded(child: micButton),
                  ],
                );
              },
            )
          else
            micButton,
          if (showLiveMeter) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            AudioLevelMeter(
              normalizedLevel: normalizedLevel,
              isRecording: isRecording,
              isPreviewing: isPreviewing,
              hasPermission: hasPermission,
              isClipping: isClipping,
              isSilent: isSilent,
            ),
          ],
          if (statusFooter != null) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            statusFooter!,
          ],
        ],
      ),
    );
  }
}

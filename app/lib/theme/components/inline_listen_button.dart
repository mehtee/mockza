import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_toast.dart';
import 'package:mockza/theme/primitives.dart';

/// Shared OpenRouter (`hexgrad/kokoro-82m`) audio playback button with 1.0x and 0.8x speed.
/// Zero local OS TTS (`flutter_tts`) is ever invoked.
class InlineListenButton extends ConsumerStatefulWidget {
  /// Creates an [InlineListenButton].
  const new({
    required this.text,
    this.sourceContext = 'vocab',
    this.voice,
    this.compact = false,
    this.showSlowToggle = true,
    this.label,
    super.key,
  });

  /// English word, collocation, or sentence to synthesize via Kokoro-82m API.
  final String text;

  /// Telemetry context label (`vocab`, `reading`, `listening_feedback`, etc.).
  final String sourceContext;

  /// Optional explicit Kokoro voice ID override (`null` uses preferred Settings accent).
  final String? voice;

  /// Whether to render a compact icon/chip trigger.
  final bool compact;

  /// Whether to include a secondary `0.8x` slow toggle next to play.
  final bool showSlowToggle;

  /// Optional custom label override.
  final String? label;

  @override
  ConsumerState<InlineListenButton> createState() => _InlineListenButtonState();
}

class _InlineListenButtonState extends ConsumerState<InlineListenButton> {
  bool _isLoading = false;
  bool _isPlaying = false;
  double _activeSpeed = 1;
  StreamSubscription<bool>? _playingSub;

  @override
  void initState() {
    super.initState();
    try {
      final player = ref.read(audioPlayerGatewayProvider);
      _playingSub = player.watchIsPlaying().listen((playing) {
        if (!playing && mounted && _isPlaying) {
          setState(() => _isPlaying = false);
        }
      });
    } on Object {
      // Safe no-op in minimal widget tests without audio provider binding.
    }
  }

  @override
  void dispose() {
    unawaited(_playingSub?.cancel() ?? Future<void>.value());
    super.dispose();
  }

  Future<void> _playAtSpeed(double speed) async {
    final trimmed = widget.text.trim();
    if (trimmed.isEmpty || _isLoading) return;

    final player = ref.read(audioPlayerGatewayProvider);
    if (_isPlaying && _activeSpeed == speed) {
      await player.pause();
      if (mounted) setState(() => _isPlaying = false);
      return;
    }

    setState(() {
      _isLoading = true;
      _activeSpeed = speed;
    });

    var resolvedAccent = 'us';
    try {
      resolvedAccent = ref.read(preferredTtsAccentProvider);
    } on Object {
      resolvedAccent = 'us';
    }
    final effectiveVoice =
        widget.voice ?? (resolvedAccent == 'uk' ? 'bf_emma' : 'af_bella');

    final gateway = ref.read(speechPracticeGatewayProvider);
    final synthResult = await gateway.synthesizeTtsPlayableRef(
      text: trimmed,
      speed: speed,
      voice: effectiveVoice,
      sourceContext: widget.sourceContext,
    );

    if (!mounted) return;
    switch (synthResult) {
      case Ok<String, Failure>(:final value):
        final loadRes = await player.loadFile(value);
        if (!mounted) return;
        if (loadRes.isErr) {
          setState(() {
            _isLoading = false;
            _isPlaying = false;
          });
          final l10nFallback =
              Localizations.of<AppLocalizations>(context, AppLocalizations);
          showMzToast(
            context,
            message:
                loadRes.failureOrNull?.message ??
                l10nFallback?.audioLoadFailed ??
                'Audio load failed',
            glyph: LucideGlyph.alertCircle,
          );
          return;
        }
        final playRes = await player.play();
        if (!mounted) return;
        setState(() {
          _isLoading = false;
          _isPlaying = playRes.isOk;
        });
        if (playRes.isErr) {
          showMzToast(
            context,
            message: playRes.failureOrNull?.message ?? 'Playback failed',
            glyph: LucideGlyph.alertCircle,
          );
        }
      case Err<String, Failure>(:final failure):
        setState(() {
          _isLoading = false;
          _isPlaying = false;
        });
        showMzToast(
          context,
          message: failure.message,
          glyph: LucideGlyph.alertCircle,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);
    final l10n = AppLocalizations.of(context);

    final effectiveLabel = widget.label ?? l10n.listenCta;

    if (widget.compact && !widget.showSlowToggle) {
      return IconButton(
        tooltip: effectiveLabel,
        onPressed: _isLoading ? null : () => unawaited(_playAtSpeed(1)),
        icon: AppIcon(
          _isLoading
              ? LucideGlyph.loaderCircle
              : (_isPlaying ? LucideGlyph.pause : LucideGlyph.volume2),
          size: 18,
          color: colors.vocabAccent,
        ),
      );
    }

    return Wrap(
      spacing: SpacingTokens.xs,
      runSpacing: SpacingTokens.xs,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: <Widget>[
        InkWell(
          onTap: _isLoading ? null : () => unawaited(_playAtSpeed(1)),
          borderRadius: shapes.pillRadius,
          child: Container(
            padding: const EdgeInsetsDirectional.symmetric(
              horizontal: SpacingTokens.sm,
              vertical: SpacingTokens.xs,
            ),
            decoration: BoxDecoration(
              color: _isPlaying && _activeSpeed == 1.0
                  ? colors.primary.withValues(alpha: 0.14)
                  : colors.bgRaised,
              borderRadius: shapes.pillRadius,
              border: Border.all(
                color: _isPlaying && _activeSpeed == 1.0
                    ? colors.primary
                    : colors.borderSubtle,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                AppIcon(
                  _isLoading && _activeSpeed == 1.0
                      ? LucideGlyph.loaderCircle
                      : (_isPlaying && _activeSpeed == 1.0
                            ? LucideGlyph.pause
                            : LucideGlyph.volume2),
                  size: 14,
                  color: colors.primary,
                ),
                if (!widget.compact) ...<Widget>[
                  const SizedBox(width: SpacingTokens.xs),
                  Text(
                    effectiveLabel,
                    style: typography.caption.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
        if (widget.showSlowToggle)
          InkWell(
            onTap: _isLoading ? null : () => unawaited(_playAtSpeed(0.8)),
            borderRadius: shapes.pillRadius,
            child: Container(
              padding: const EdgeInsetsDirectional.symmetric(
                horizontal: SpacingTokens.sm,
                vertical: SpacingTokens.xs,
              ),
              decoration: BoxDecoration(
                color: _isPlaying && _activeSpeed == 0.8
                    ? colors.amberBg
                    : colors.bgRaised,
                borderRadius: shapes.pillRadius,
                border: Border.all(
                  color: _isPlaying && _activeSpeed == 0.8
                      ? colors.vocabAccent
                      : colors.borderSubtle,
                ),
              ),
              child: Text(
                l10n.listenSlowCta,
                style: typography.caption.copyWith(
                  color: colors.vocabAccent,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/audio_player_gateway.dart';
import 'package:mockza/services/media_bytes_platform.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/status_banner.dart';
import 'package:mockza/theme/primitives.dart';

final Provider<AudioPlayerGateway> _reviewAudioPlayerProvider =
    Provider.autoDispose<AudioPlayerGateway>((
      ref,
    ) {
      final player = JustAudioPlayerGateway();
      ref.onDispose(() => unawaited(player.dispose()));
      return player;
    });

/// Plays a saved Listening cue from the source version used for the attempt.
class ListeningEvidenceSheet extends ConsumerStatefulWidget {
  /// Creates a sheet for an identified audio cue.
  const new({
    required this.packId,
    required this.contentVersion,
    required this.sectionId,
    required this.cueTimestampMs,
    super.key,
  });

  /// Pack that owns the original recording.
  final String packId;

  /// Exact version of the source used for the answer.
  final String contentVersion;

  /// Section that owns the question.
  final String sectionId;

  /// Start position of the supporting audio.
  final int cueTimestampMs;

  @override
  ConsumerState<ListeningEvidenceSheet> createState() =>
      _ListeningEvidenceSheetState();
}

class _ListeningEvidenceSheetState
    extends ConsumerState<ListeningEvidenceSheet> {
  late final AudioPlayerGateway _player;
  late final AppLifecycleListener _lifecycle;
  late final Future<bool> _sourceReady;
  late final Duration _start = Duration(milliseconds: widget.cueTimestampMs);
  Duration? _end;
  StreamSubscription<Duration>? _positions;
  String? _playableUrl;
  String? _transcript;
  bool _playing = false;
  bool _preparing = false;
  int _playGeneration = 0;
  bool _playFailed = false;

  @override
  void initState() {
    super.initState();
    _player = ref.read(_reviewAudioPlayerProvider);
    _lifecycle = AppLifecycleListener(onInactive: () => unawaited(_stop()));
    _sourceReady = _loadSource();
  }

  Future<bool> _loadSource() async {
    final catalog = ref.read(examCatalogRepositoryProvider);
    final sync = ref.read(contentSyncServiceProvider);
    final edition = ref.read(editionConfigProvider);
    try {
      var bundle = await catalog.getCachedExamBundle(widget.packId);
      if (!mounted) return false;
      var pack = bundle?['pack'];
      if (pack is! Map<String, dynamic> ||
          pack['version'] != widget.contentVersion) {
        bundle = (await sync.ensureExamBundle(widget.packId)).valueOrNull;
        pack = bundle?['pack'];
      }
      if (!mounted ||
          pack is! Map<String, dynamic> ||
          pack['version'] != widget.contentVersion) {
        return false;
      }

      final sections = (bundle?['sections'] as List<dynamic>?)
          ?.whereType<Map<String, dynamic>>()
          .toList(growable: false);
      if (sections == null || sections.isEmpty) return false;
      final sectionIndex = sections.indexWhere(
        (section) => section['sectionId'] == widget.sectionId,
      );
      if (sectionIndex == -1) return false;
      final section = sections[sectionIndex];
      final media =
          section['mediaUrl'] ?? (sectionIndex == 0 ? pack['mediaUrl'] : null);
      if (media is! String || media.isEmpty) return false;

      final transcript = section['transcript'];
      if (transcript is List<dynamic>) {
        for (final line in transcript.whereType<Map<String, dynamic>>()) {
          final start = line['startMs'];
          final end = line['endMs'];
          if (start is int &&
              end is int &&
              start >= 0 &&
              start <= widget.cueTimestampMs &&
              widget.cueTimestampMs < end) {
            _end = Duration(milliseconds: end);
            _transcript = line['text'] as String?;
            break;
          }
        }
      }

      final cachedPaths = bundle?['cachedMediaPaths'];
      final cachedPath = cachedPaths is Map<String, dynamic>
          ? cachedPaths[media]
          : null;
      final playable = cachedPath is String
          ? await resolveCachedAudioPlayableUrl(cachedPath)
          : null;
      if (!mounted) {
        await releasePlayableAudioUrl(playable);
        return false;
      }
      _playableUrl = playable;
      final loaded = await _player.loadFile(
        playable ?? edition.resolveMediaUrl(media),
      );
      final duration = loaded.valueOrNull;
      if (!mounted ||
          loaded.isFailure ||
          (duration != null && _start >= duration)) {
        return false;
      }
      // Without transcript timing, play a short preview from the authored cue.
      _end ??= _start + const Duration(seconds: 8);
      _positions = _player.watchPosition().listen((position) {
        if (_playing && !_preparing && position >= _end!) unawaited(_stop());
      });
      return true;
    } on Object {
      return false;
    }
  }

  Future<void> _play() async {
    final generation = ++_playGeneration;
    setState(() {
      _preparing = true;
      _playFailed = false;
    });
    final seek = await _player.seek(_start);
    if (!mounted || generation != _playGeneration) return;
    setState(() {
      _preparing = false;
      _playing = !seek.isFailure;
      _playFailed = seek.isFailure;
    });
    if (seek.isFailure) return;

    final play = await _player.play();
    if (!mounted || generation != _playGeneration) return;
    setState(() {
      _playing = false;
      _playFailed = play.isFailure;
    });
  }

  Future<void> _stop() async {
    if (!_playing && !_preparing) return;
    final generation = ++_playGeneration;
    setState(() => _preparing = true);
    await _player.pause();
    if (!mounted || generation != _playGeneration) return;
    setState(() {
      _playing = false;
      _preparing = false;
    });
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    unawaited(_positions?.cancel());
    unawaited(releasePlayableAudioUrl(_playableUrl));
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(_reviewAudioPlayerProvider);
    final l10n = AppLocalizations.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
      child: FutureBuilder<bool>(
        future: _sourceReady,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return Center(
              child: CircularProgressIndicator(
                semanticsLabel: l10n.objectiveAudioLoading,
              ),
            );
          }
          if (snapshot.data != true) {
            return StatusBanner(message: l10n.objectiveAudioUnavailable);
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_transcript case final transcript?) ...[
                Text(
                  transcript,
                  textDirection: TextDirection.ltr,
                  style: AppTypography.of(context).readingPassage,
                ),
                const SizedBox(height: SpacingTokens.md),
              ],
              if (_playFailed) ...[
                StatusBanner(message: l10n.objectiveAudioUnavailable),
                const SizedBox(height: SpacingTokens.md),
              ],
              PrimaryButton(
                label: _playing
                    ? l10n.objectiveAudioPause
                    : l10n.objectiveAudioReplay,
                trailingGlyph: _playing ? LucideGlyph.pause : LucideGlyph.play,
                onPressed: _preparing
                    ? null
                    : () => unawaited(_playing ? _stop() : _play()),
              ),
            ],
          );
        },
      ),
    );
  }
}

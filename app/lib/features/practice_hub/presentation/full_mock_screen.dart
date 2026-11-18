import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/exams/exam_descriptor.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/features/practice_hub/presentation/practice_hub_providers.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/routing/safe_pop.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/primitives.dart';

/// Guided 4-skill / 5-stage IELTS Full Mock orchestrator screen (`/practice/full-mock/:mockId`).
class FullMockScreen extends ConsumerStatefulWidget {
  /// Creates a [FullMockScreen].
  const new({required this.mockId, super.key});

  /// Identifier selecting Academic (`mock-acad-*`) vs General (`mock-gt-*`).
  final String mockId;

  @override
  ConsumerState<FullMockScreen> createState() => _FullMockScreenState();
}

class _FullMockScreenState extends ConsumerState<FullMockScreen> {
  MockSessionRecord? _session;
  int? _sessionStartedAtUtcMs;
  bool _examMode = true;

  ExamTrack get _track {
    final lower = widget.mockId.toLowerCase();
    if (lower.contains('toefl')) return ExamTrack.toeflIbt;
    if (lower.contains('pte')) return ExamTrack.pteAcademic;
    if (lower.contains('det')) return ExamTrack.det;
    if (lower.contains('gt')) return ExamTrack.ieltsGeneral;
    final profile = ref.read(practiceProfileProvider).asData?.value;
    return profile != null
        ? ExamTrack.fromId(profile.examId)
        : ExamTrack.ieltsAcademic;
  }

  @override
  void initState() {
    super.initState();
    unawaited(_loadOrInitSession());
  }

  Future<void> _loadOrInitSession() async {
    final repo = ref.read(attemptRepositoryProvider);
    try {
      final session = await repo.getOrCreateMockSession(
        mockId: widget.mockId,
        track: _track.catalogTrack,
        defaultExamMode: _examMode,
      );
      if (mounted) {
        setState(() {
          _session = session;
          _sessionStartedAtUtcMs = session.startedAtUtcMs;
          _examMode = session.examMode;
        });
      }
    } on Object {
      if (mounted) {
        setState(() {
          _sessionStartedAtUtcMs = ref
              .read(clockProvider)
              .now()
              .toUtc()
              .millisecondsSinceEpoch;
        });
      }
    }
  }

  Future<void> _persistSessionState({
    required int startedAtUtcMs,
    required bool examMode,
    bool resetStages = false,
  }) async {
    final nextStages = resetStages
        ? const <String, String>{}
        : (_session?.stageAttemptIds ?? const <String, String>{});
    if (mounted) {
      setState(() {
        _sessionStartedAtUtcMs = startedAtUtcMs;
        _examMode = examMode;
        if (resetStages && _session != null) {
          _session = MockSessionRecord(
            mockId: _session!.mockId,
            track: _session!.track,
            startedAtUtcMs: startedAtUtcMs,
            examMode: examMode,
          );
        }
      });
    }
    try {
      final saved = await ref
          .read(attemptRepositoryProvider)
          .saveMockSession(
            mockId: widget.mockId,
            track: _track.catalogTrack,
            startedAtUtcMs: startedAtUtcMs,
            examMode: examMode,
            stageAttemptIds: nextStages,
          );
      if (mounted) {
        setState(() => _session = saved);
      }
    } on Object {
      // Ignore in isolated widget tests without storage channel.
    }
  }

  List<
    ({
      String key,
      SkillKind skill,
      String packId,
      String title,
      String subtitle,
      String duration,
      String route,
    })
  >
  get _stages {
    final track = _track;
    final descriptor = ExamDescriptor.forTrack(track);
    final isGeneral = track == ExamTrack.ieltsGeneral;
    final writingStages = descriptor.writingTasks.asMap().entries.map((entry) {
      final idx = entry.key;
      final task = entry.value;
      final stageNum = idx + 3;
      final mins = (task.defaultDurationSeconds / 60).ceil();
      return (
        key: 'writing_task${idx + 1}',
        skill: SkillKind.writing,
        packId: descriptor.writingPackId,
        title:
            '$stageNum. ${track.isIelts ? 'Writing ${task.shortTabLabel}' : task.fullTitle}',
        subtitle: task.requiresSingleSentence
            ? 'Single complete sentence (5–75 words)'
            : 'Target ${task.defaultMinWords}+ words',
        duration: '$mins min',
        route: AppRoutes.buildWritingSim(
          descriptor.writingPackId,
          _examMode,
          widget.mockId,
          'writing_task${idx + 1}',
          idx,
        ),
      );
    });

    final speakStageNum = 3 + descriptor.writingTasks.length;
    return [
      (
        key: 'listening',
        skill: SkillKind.listening,
        packId: descriptor.listeningPackId,
        title: '1. Listening Test',
        subtitle: '${track.shortName} audio comprehension',
        duration: '30 min',
        route: AppRoutes.buildListeningSim(
          descriptor.listeningPackId,
          _examMode,
          widget.mockId,
          'listening',
        ),
      ),
      (
        key: 'reading',
        skill: SkillKind.reading,
        packId: descriptor.readingPackId,
        title: '2. Reading Test',
        subtitle: isGeneral
            ? 'General Training workplace & societal texts'
            : '${track.shortName} passages & objective tasks',
        duration: '60 min',
        route: AppRoutes.buildReadingSim(
          descriptor.readingPackId,
          _examMode,
          widget.mockId,
          'reading',
        ),
      ),
      ...writingStages,
      (
        key: 'speaking',
        skill: SkillKind.speaking,
        packId: descriptor.speakingPackId,
        title:
            '$speakStageNum. ${track.isIelts ? 'Speaking Interview' : 'Speaking Test'}',
        subtitle: '${track.shortName} live microphone recording',
        duration: track == ExamTrack.toeflIbt ? '8 min' : '14 min',
        route: AppRoutes.buildSpeakingSim(
          descriptor.speakingPackId,
          _examMode,
          widget.mockId,
          'speaking',
        ),
      ),
    ];
  }

  AttemptSummary? _findStageAttempt(
    String stageKey,
    SkillKind skill,
    String packId,
    List<AttemptSummary> attempts,
    int sessionStartMs,
  ) {
    final linkedId = _session?.stageAttemptIds[stageKey];
    if (linkedId != null) {
      for (final a in attempts) {
        if (a.attemptId == linkedId && a.status != AttemptStatus.inProgress) {
          if (!_examMode || !a.usedStudyMode) return a;
        }
      }
    }
    for (final a in attempts) {
      if (a.mockSessionId == widget.mockId &&
          a.mockStageKey == stageKey &&
          a.skill == skill &&
          a.packId == packId &&
          a.status != AttemptStatus.inProgress &&
          a.effectiveCompletedAtUtcMs >= sessionStartMs &&
          (!_examMode || !a.usedStudyMode)) {
        return a;
      }
    }
    return null;
  }

  Future<void> _openStageRoute(String route) async {
    await context.push(route);
    if (!mounted) return;
    ref.invalidate(practiceHubAttemptsProvider);
    await _loadOrInitSession();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final attempts =
        ref.watch(practiceHubAttemptsProvider).asData?.value ??
        const <AttemptSummary>[];
    final sessionStartMs = _sessionStartedAtUtcMs;

    // Derive stage state strictly from real linked/session-scoped persisted submissions (`RR-11`).
    final attemptByStageKey = <String, AttemptSummary>{};
    final scoredByStageKey = <String, AttemptSummary>{};
    if (sessionStartMs != null) {
      for (final stage in _stages) {
        final found = _findStageAttempt(
          stage.key,
          stage.skill,
          stage.packId,
          attempts,
          sessionStartMs,
        );
        if (found != null) {
          attemptByStageKey[stage.key] = found;
          if (found.status == AttemptStatus.scored &&
              found.overallBand != null) {
            scoredByStageKey[stage.key] = found;
          }
        }
      }
    }

    final track = _track;
    final stages = _stages;
    final completedCount = scoredByStageKey.length;
    final listeningBand = scoredByStageKey['listening']?.overallBand;
    final readingBand = scoredByStageKey['reading']?.overallBand;
    final writingScores = stages
        .where((s) => s.skill == SkillKind.writing)
        .map((s) => scoredByStageKey[s.key]?.overallBand)
        .whereType<double>()
        .toList(growable: false);
    final writingTaskCount = stages
        .where((s) => s.skill == SkillKind.writing)
        .length;
    final speakingBand = scoredByStageKey['speaking']?.overallBand;

    final double? combinedBand;
    if (listeningBand != null &&
        readingBand != null &&
        writingScores.length == writingTaskCount &&
        writingScores.isNotEmpty &&
        speakingBand != null) {
      final double writingComposite;
      if (track.isIelts && writingScores.length >= 2) {
        writingComposite = ExamSpec.calculateWritingOverallBand(
          task1Band: writingScores[0],
          task2Band: writingScores[1],
        );
      } else {
        writingComposite =
            writingScores.reduce((a, b) => a + b) / writingScores.length;
      }
      final rawMean =
          (listeningBand + readingBand + writingComposite + speakingBand) / 4.0;
      combinedBand = track.isIelts
          ? ExamSpec.roundIeltsBand(rawMean)
          : track.quantizeScore(rawMean);
    } else {
      combinedBand = null;
    }

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const AppIcon(LucideGlyph.arrowLeft, size: 20),
          onPressed: () => context.safePopOrGo(AppRoutes.practice),
        ),
        title: Text('Full ${track.shortName} Mock'),
        actions: <Widget>[
          if (attemptByStageKey.isNotEmpty)
            MzIconButton(
              glyph: LucideGlyph.rotateCcw,
              semanticLabel: 'Reset mock session',
              onPressed: () => unawaited(
                _persistSessionState(
                  startedAtUtcMs: ref
                      .read(clockProvider)
                      .now()
                      .toUtc()
                      .millisecondsSinceEpoch,
                  examMode: _examMode,
                  resetStages: true,
                ),
              ),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsetsDirectional.symmetric(
          vertical: SpacingTokens.md,
        ),
        children: <Widget>[
          MzCard(
            variant: MzCardVariant.hero,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  combinedBand != null
                      ? 'Full Mock ${track.formatScoreWithUnit(combinedBand)} (${stages.length}/${stages.length} Scored)'
                      : '$completedCount of ${stages.length} Stages Scored',
                  style: typography.cardTitle,
                ),
                const SizedBox(height: SpacingTokens.xs),
                Text(
                  'Complete all ${track.shortName} Listening, Reading, Writing, and Speaking stages in Exam Mode. Stages mark completed only after final scoring.',
                  style: typography.secondary.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.md),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: SecondaryButton(
                        label: _examMode ? 'Mode: Exam' : 'Mode: Study',
                        onPressed: () {
                          final nextMode = !_examMode;
                          if (sessionStartMs != null) {
                            unawaited(
                              _persistSessionState(
                                startedAtUtcMs: sessionStartMs,
                                examMode: nextMode,
                              ),
                            );
                          } else {
                            setState(() => _examMode = nextMode);
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: SpacingTokens.sm),
                    Expanded(
                      child: PrimaryButton(
                        label: completedCount < _stages.length
                            ? 'Start Next Stage'
                            : 'View Progress',
                        onPressed: () async {
                          final remaining = _stages
                              .where(
                                (s) => !attemptByStageKey.containsKey(s.key),
                              )
                              .toList();
                          if (remaining.isEmpty) {
                            context.go(AppRoutes.progress);
                            return;
                          }
                          await _openStageRoute(remaining.first.route);
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: SpacingTokens.lg),
          ..._stages.map((stage) {
            final submitted = attemptByStageKey[stage.key];
            final isScored =
                submitted != null &&
                submitted.status == AttemptStatus.scored &&
                submitted.overallBand != null;
            final isFailed =
                submitted != null &&
                submitted.status == AttemptStatus.failedRetryable;
            final statusText = submitted == null
                ? stage.duration
                : isScored
                ? track.formatScoreWithUnit(submitted.overallBand!)
                : isFailed
                ? 'Failed — Tap to Retry'
                : 'Grading in Progress...';
            return Padding(
              padding: const EdgeInsetsDirectional.only(
                bottom: SpacingTokens.sm,
              ),
              child: MzCard(
                onTap: () {
                  if (submitted != null) {
                    unawaited(
                      context.push(
                        AppRoutes.buildAttemptReview(submitted.attemptId),
                      ),
                    );
                  } else {
                    unawaited(_openStageRoute(stage.route));
                  }
                },
                child: Row(
                  children: <Widget>[
                    IconWell(
                      glyph: switch (stage.skill) {
                        SkillKind.listening => LucideGlyph.headphones,
                        SkillKind.reading => LucideGlyph.bookOpen,
                        SkillKind.writing => LucideGlyph.pencil,
                        SkillKind.speaking => LucideGlyph.mic,
                        SkillKind.vocabulary => LucideGlyph.layers3,
                      },
                      tint: isScored
                          ? IconWellTint.mint
                          : isFailed
                          ? IconWellTint.danger
                          : IconWellTint.blue,
                    ),
                    const SizedBox(width: SpacingTokens.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(stage.title, style: typography.cardTitle),
                          const SizedBox(height: SpacingTokens.xs),
                          Text(
                            '$statusText • ${stage.subtitle}',
                            style: typography.secondary.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    AppIcon(
                      isScored
                          ? LucideGlyph.checkCircle2
                          : LucideGlyph.chevronRight,
                      color: isScored ? colors.success : colors.textTertiary,
                      size: 20,
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

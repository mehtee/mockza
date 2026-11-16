import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/features/practice_hub/presentation/practice_hub_providers.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/primitives.dart';

/// Guided 4-skill IELTS Full Mock orchestrator screen (`/practice/full-mock/:mockId`).
class FullMockScreen extends ConsumerStatefulWidget {
  /// Creates a [FullMockScreen].
  const new({required this.mockId, super.key});

  /// Identifier selecting Academic (`mock-acad-*`) vs General (`mock-gt-*`).
  final String mockId;

  @override
  ConsumerState<FullMockScreen> createState() => _FullMockScreenState();
}

class _FullMockScreenState extends ConsumerState<FullMockScreen> {
  int? _sessionStartedAtUtcMs;
  bool _examMode = true;

  bool get _isGeneral => widget.mockId.contains('gt');
  String get _sessionStorageKey => '__mock_session_${widget.mockId}';

  @override
  void initState() {
    super.initState();
    unawaited(_loadOrInitSession());
  }

  Future<void> _loadOrInitSession() async {
    final repo = ref.read(attemptRepositoryProvider);
    final clock = ref.read(clockProvider);
    try {
      final draft = await repo.getWritingDraft(_sessionStorageKey);
      if (draft != null && draft.draftText.isNotEmpty) {
        final decoded = jsonDecode(draft.draftText);
        if (decoded is Map<String, dynamic>) {
          final started = (decoded['startedAtUtcMs'] as num?)?.toInt();
          final examMode = decoded['examMode'] as bool? ?? true;
          if (started != null && mounted) {
            setState(() {
              _sessionStartedAtUtcMs = started;
              _examMode = examMode;
            });
            return;
          }
        }
      }
    } on Object {
      // Fall through to initializing a new durable session marker.
    }
    await _persistSessionState(
      startedAtUtcMs: clock.now().toUtc().millisecondsSinceEpoch,
      examMode: _examMode,
    );
  }

  Future<void> _persistSessionState({
    required int startedAtUtcMs,
    required bool examMode,
  }) async {
    if (mounted) {
      setState(() {
        _sessionStartedAtUtcMs = startedAtUtcMs;
        _examMode = examMode;
      });
    }
    try {
      await ref
          .read(attemptRepositoryProvider)
          .saveWritingDraft(
            attemptId: _sessionStorageKey,
            packId: widget.mockId,
            taskType: 'full_mock',
            draftText: jsonEncode(<String, Object?>{
              'startedAtUtcMs': startedAtUtcMs,
              'examMode': examMode,
            }),
            wordCount: 0,
            timerRemainingSec: 0,
          );
    } on Object {
      // Ignore in isolated widget tests without storage channel.
    }
  }

  List<
    ({
      SkillKind skill,
      String packId,
      String title,
      String subtitle,
      String duration,
      String route,
    })
  >
  get _stages => [
    (
      skill: SkillKind.listening,
      packId: 'ielts-listening-seed-01',
      title: '1. Listening Test',
      subtitle: '4 sections • Audio comprehension',
      duration: '30 min',
      route: AppRoutes.buildListeningSim('ielts-listening-seed-01', _examMode),
    ),
    (
      skill: SkillKind.reading,
      packId: _isGeneral
          ? 'ielts-gt-reading-seed-01'
          : 'ielts-acad-reading-seed-01',
      title: '2. Reading Test',
      subtitle: _isGeneral
          ? 'General Training workplace & societal texts'
          : 'Academic passages & evidence questions',
      duration: '60 min',
      route: AppRoutes.buildReadingSim(
        _isGeneral ? 'ielts-gt-reading-seed-01' : 'ielts-acad-reading-seed-01',
        _examMode,
      ),
    ),
    (
      skill: SkillKind.writing,
      packId: _isGeneral ? 'ielts-writing-gt-01' : 'ielts-writing-seed-01',
      title: '3. Writing Tasks 1 & 2',
      subtitle: _isGeneral
          ? 'Formal/informal letter + essay'
          : 'Academic chart report + essay',
      duration: '60 min',
      route: AppRoutes.buildWritingSim(
        _isGeneral ? 'ielts-writing-gt-01' : 'ielts-writing-seed-01',
        _examMode,
      ),
    ),
    (
      skill: SkillKind.speaking,
      packId: 'ielts-speaking-seed-01',
      title: '4. Speaking Interview',
      subtitle: 'Parts 1, 2 & 3 live microphone recording',
      duration: '14 min',
      route: AppRoutes.buildSpeakingSim('ielts-speaking-seed-01', _examMode),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final attempts =
        ref.watch(practiceHubAttemptsProvider).asData?.value ??
        const <AttemptSummary>[];
    final sessionStartMs = _sessionStartedAtUtcMs;

    // Derive stage completion strictly from real persisted submissions in this mock session (`TD-34`, `BF-03`).
    final completedBySkill = <SkillKind, AttemptSummary>{};
    if (sessionStartMs != null) {
      for (final stage in _stages) {
        for (final a in attempts) {
          if (a.skill == stage.skill &&
              a.packId == stage.packId &&
              a.status != AttemptStatus.inProgress &&
              a.effectiveCompletedAtUtcMs >= sessionStartMs) {
            completedBySkill.putIfAbsent(stage.skill, () => a);
            break;
          }
        }
      }
    }

    final completedCount = completedBySkill.length;
    final scoredValues = completedBySkill.values
        .where((a) => a.overallBand != null)
        .map((a) => a.overallBand!)
        .toList(growable: false);
    final combinedBand = scoredValues.length == 4
        ? ExamSpec.roundIeltsBand(scoredValues.reduce((a, b) => a + b) / 4.0)
        : null;

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const AppIcon(LucideGlyph.arrowLeft, size: 20),
          onPressed: () => context.pop(),
        ),
        title: Text(
          _isGeneral ? 'Full General Training Mock' : 'Full Academic Mock',
        ),
        actions: <Widget>[
          if (completedCount > 0)
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
                ),
              ),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
        children: <Widget>[
          MzCard(
            variant: MzCardVariant.hero,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  combinedBand != null
                      ? 'Full Mock Band ${combinedBand.toStringAsFixed(1)} (4/4 Completed)'
                      : '$completedCount of 4 Sections Completed',
                  style: typography.cardTitle,
                ),
                const SizedBox(height: SpacingTokens.xs),
                Text(
                  'Complete Listening, Reading, Writing, and Speaking in order. Sections mark completed only once submitted.',
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
                        label: completedCount < 4
                            ? 'Start Next Section'
                            : 'View Progress',
                        onPressed: () async {
                          final remaining = _stages
                              .where(
                                (s) => !completedBySkill.containsKey(s.skill),
                              )
                              .toList();
                          if (remaining.isEmpty) {
                            context.go(AppRoutes.progress);
                            return;
                          }
                          final next = remaining.first;
                          await context.push(next.route);
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
            final submitted = completedBySkill[stage.skill];
            final isDone = submitted != null;
            final statusText = submitted == null
                ? stage.duration
                : submitted.overallBand != null
                ? 'Band ${submitted.overallBand!.toStringAsFixed(1)}'
                : 'Submitted';
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
                    unawaited(context.push(stage.route));
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
                      tint: isDone ? IconWellTint.mint : IconWellTint.blue,
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
                      isDone
                          ? LucideGlyph.checkCircle2
                          : LucideGlyph.chevronRight,
                      color: isDone ? colors.success : colors.textTertiary,
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

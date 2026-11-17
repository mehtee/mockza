import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/features/home/presentation/home_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/brand_header.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/metric_hero.dart';
import 'package:mockza/theme/components/mz_bottom_sheet.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/recommendation_card.dart';
import 'package:mockza/theme/components/skill_metric_card.dart';
import 'package:mockza/theme/components/study_week_strip.dart';
import 'package:mockza/theme/primitives.dart';

/// Home Dashboard primary landing view (01_Home_Dashboard.png).
class HomeScreen extends ConsumerWidget {
  /// Creates a [HomeScreen].
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final state = ref.watch(homeNotifierProvider);

    // Delta pill display
    String? deltaText;
    if (state.estimatedSummary.changeThisMonth != null) {
      final delta = state.estimatedSummary.changeThisMonth!;
      final prefix = delta >= 0 ? '+' : '';
      deltaText = '$prefix${delta.toStringAsFixed(1)} this month';
    }

    // Extract four individual skill score readouts
    double? speakingScore;
    double? writingScore;
    double? readingScore;
    double? listeningScore;

    for (final s in state.skillMetrics) {
      switch (s.skill) {
        case SkillKind.speaking:
          speakingScore = s.score;
        case SkillKind.writing:
          writingScore = s.score;
        case SkillKind.reading:
          readingScore = s.score;
        case SkillKind.listening:
          listeningScore = s.score;
        case SkillKind.vocabulary:
          break;
      }
    }

    // Map study week model into tiles
    final weekTiles = state.studyWeek.days
        .map((d) {
          final DayStudyStatus status;
          if (d.isCompleted) {
            status = DayStudyStatus.completed;
          } else if (d.isToday) {
            status = DayStudyStatus.today;
          } else if (d.isFuture) {
            status = DayStudyStatus.upcoming;
          } else {
            status = DayStudyStatus.missed;
          }
          return DayStatus(
            dayLabel: d.dayLabel,
            status: status,
            isToday: d.isToday,
          );
        })
        .toList(growable: false);

    final isGeneral = state.track == ExamTrack.ieltsGeneral;
    final isIelts = state.track == ExamTrack.ieltsAcademic || isGeneral;
    final targetChipText = isIelts
        ? 'Target ${state.targetBand.toStringAsFixed(1)}'
        : 'Target ${state.targetBand.round()}';

    return MzScaffold(
      body: Column(
        children: <Widget>[
          BrandHeader(
            selectedExam: state.track.displayName,
            onTapExamSelector: () => _openTrackPicker(
              context,
              ref,
              activeTrack: state.track,
            ),
            onTapSettings: () => context.push(AppRoutes.settings),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsetsDirectional.symmetric(
                vertical: SpacingTokens.sm,
              ),
              children: <Widget>[
                // Context Area (overflow-safe at 320dp + 2.0x scale)
                Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.end,
                  spacing: SpacingTokens.sm,
                  runSpacing: SpacingTokens.xs,
                  children: <Widget>[
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        Text('Keep improving.', style: typography.headline),
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          state.daysUntilExam != null
                              ? '${state.daysUntilExam} days until your exam'
                              : 'Target your highest-leverage skill',
                          style: typography.secondary.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    MzChip(
                      label: targetChipText,
                      variant: MzChipVariant.target,
                    ),
                  ],
                ),
                const SizedBox(height: SpacingTokens.md),

                if (state.estimatedSummary.overallBand == null &&
                    (state.latestDiagnosticId == null ||
                        state.latestDiagnosticStatus ==
                            'in_progress')) ...<Widget>[
                  MzCard(
                    onTap: () => unawaited(
                      context.push(
                        AppRoutes.buildDiagnosticIntro(examId: state.track.id),
                      ),
                    ),
                    child: Row(
                      children: <Widget>[
                        const IconWell(
                          glyph: LucideGlyph.sparkles,
                          tint: IconWellTint.blue,
                          size: 38,
                          iconSize: 18,
                        ),
                        const SizedBox(width: SpacingTokens.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(
                                'Find Your Starting Level (~10–15 Min)',
                                style: typography.cardTitle,
                              ),
                              Text(
                                'Quick 4-skill placement to personalize drills for your level.',
                                style: typography.caption.copyWith(
                                  color: colors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: SpacingTokens.xs),
                        AppIcon(
                          LucideGlyph.chevronRight,
                          size: 18,
                          color: colors.textTertiary,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.md),
                ],

                // Metric Hero Card
                MetricHero(
                  estimatedScore: state.estimatedSummary.overallBand,
                  targetScore: state.targetBand,
                  scoreDeltaText: deltaText,
                  scaleLabel: state.track.scaleLabel,
                  onTapDiagnostic: () {
                    final diagId = state.latestDiagnosticId;
                    if (diagId != null &&
                        diagId.isNotEmpty &&
                        state.latestDiagnosticStatus != 'in_progress') {
                      unawaited(
                        context.push(AppRoutes.buildDiagnosticResults(diagId)),
                      );
                    } else {
                      unawaited(
                        context.push(
                          AppRoutes.buildDiagnosticIntro(
                            examId: state.track.id,
                          ),
                        ),
                      );
                    }
                  },
                  onTapCard: () => context.go(AppRoutes.progress),
                ),
                const SizedBox(height: SpacingTokens.lg),

                // Skill Metric 2-column Grid
                Row(
                  children: <Widget>[
                    Expanded(
                      child: SkillMetricCard(
                        skillTitle: 'Speaking',
                        glyph: LucideGlyph.mic,
                        tint: IconWellTint.blue,
                        score: speakingScore,
                        maxScore: state.track.maxScore,
                        onTap: () => context.push(
                          AppRoutes.buildSpeakingSim(),
                        ),
                      ),
                    ),
                    const SizedBox(width: SpacingTokens.md),
                    Expanded(
                      child: SkillMetricCard(
                        skillTitle: 'Writing',
                        glyph: LucideGlyph.pencil,
                        tint: IconWellTint.violet,
                        score: writingScore,
                        maxScore: state.track.maxScore,
                        onTap: () => context.push(
                          AppRoutes.buildWritingSim(
                            isGeneral
                                ? 'ielts-writing-gt-01'
                                : 'ielts-writing-seed-01',
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: SpacingTokens.md),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: SkillMetricCard(
                        skillTitle: 'Reading',
                        glyph: LucideGlyph.bookOpen,
                        tint: IconWellTint.mint,
                        score: readingScore,
                        maxScore: state.track.maxScore,
                        onTap: () => context.push(
                          AppRoutes.buildReadingSim(
                            isGeneral
                                ? 'ielts-gt-reading-seed-01'
                                : 'ielts-acad-reading-seed-01',
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: SpacingTokens.md),
                    Expanded(
                      child: SkillMetricCard(
                        skillTitle: 'Listening',
                        glyph: LucideGlyph.headphones,
                        tint: IconWellTint.blue,
                        score: listeningScore,
                        maxScore: state.track.maxScore,
                        onTap: () => context.push(
                          AppRoutes.buildListeningSim(),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: SpacingTokens.lg),

                // Recommendation Card
                RecommendationCard(
                  title: state.recommendedTitle,
                  subtitle: state.recommendedSubtitle,
                  onTapStart: () => context.push(state.recommendedRoute),
                ),
                const SizedBox(height: SpacingTokens.lg),

                // 7-day Study Week Strip
                StudyWeekStrip(
                  days: weekTiles,
                  daysStudiedCount: state.studyWeek.completedCount,
                ),
                const SizedBox(height: SpacingTokens.xxl),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _openTrackPicker(
    BuildContext context,
    WidgetRef ref, {
    required ExamTrack activeTrack,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    unawaited(
      showMzBottomSheet<void>(
        context: context,
        title: 'Switch Exam Track',
        child: Builder(
          builder: (sheetCtx) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              for (final track in <ExamTrack>[
                ExamTrack.ieltsAcademic,
                ExamTrack.ieltsGeneral,
              ]) ...<Widget>[
                GestureDetector(
                  onTap: () {
                    ref.read(homeNotifierProvider.notifier).setTrack(track);
                    Navigator.of(sheetCtx).pop();
                  },
                  child: MzCard(
                    child: Row(
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            track.displayName,
                            style: typography.cardTitle,
                          ),
                        ),
                        AppIcon(
                          track == activeTrack
                              ? LucideGlyph.checkCircle2
                              : LucideGlyph.chevronRight,
                          color: track == activeTrack
                              ? colors.primary
                              : colors.textTertiary,
                          size: 20,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: SpacingTokens.sm),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/exams/study_metrics_calculator.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/data/repositories/progress_repository.dart';
import 'package:mockza/features/progress/presentation/progress_providers.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/brand_header.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/score_meter.dart';
import 'package:mockza/theme/components/trend_chart.dart';
import 'package:mockza/theme/primitives.dart';

/// Comprehensive progress analytics dashboard backed strictly by persisted attempts & study logs.
class ProgressScreen extends ConsumerWidget {
  /// Creates a [ProgressScreen].
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final attemptsAsync = ref.watch(recentAttemptsProvider);
    final logsAsync = ref.watch(recentDailyStudyLogsProvider);
    final profileAsync = ref.watch(progressProfileProvider);
    final timeframe = ref.watch(timeframeProvider);

    final attempts = attemptsAsync.asData?.value ?? const <AttemptSummary>[];
    final dailyLogs = logsAsync.asData?.value ?? const <DailyStudySummary>[];
    final profile = profileAsync.asData?.value;
    final targetBand = profile?.targetBand ?? 7.5;
    final track = profile?.examModule == ExamModuleType.generalTraining
        ? ExamTrack.ieltsGeneral
        : ExamTrack.ieltsAcademic;

    final now = ref.watch(clockProvider).now();
    final filteredAttempts = _filterByTimeframe(attempts, timeframe, now);

    final scoredAttempts = filteredAttempts
        .where(
          (a) => a.overallBand != null && a.skill != SkillKind.vocabulary,
        )
        .map(
          (a) => (
            score: a.overallBand!,
            skill: a.skill,
            completedAtUtcMs: a.effectiveCompletedAtUtcMs,
          ),
        )
        .toList(growable: false);

    final skillAttempts = filteredAttempts
        .where((a) => a.overallBand != null)
        .map((a) => (score: a.overallBand!, skill: a.skill))
        .toList(growable: false);

    final bandSummary = StudyMetricsCalculator.calculateEstimatedOverallBand(
      scoredAttempts: scoredAttempts,
      track: track,
      targetBand: targetBand,
      currentUtcMs: now.millisecondsSinceEpoch,
    );

    final skillMetrics = StudyMetricsCalculator.calculateSkillMetrics(
      attempts: skillAttempts,
      track: track,
    );

    final today = SerialDay.fromUtcDateTime(now);
    final studyDays = <SerialDay>{
      ...attempts.map(
        (a) => SerialDay.fromUtcDateTime(
          DateTime.fromMillisecondsSinceEpoch(
            a.effectiveCompletedAtUtcMs,
            isUtc: true,
          ),
        ),
      ),
      ...dailyLogs
          .where((d) => d.studySeconds > 0 || d.completedItems > 0)
          .map((d) => d.serialDay),
    };
    final streakDays = StudyMetricsCalculator.calculateCurrentStreak(
      studyDays: studyDays,
      today: today,
    );

    final trendPoints = _buildTrendPoints(filteredAttempts);

    return MzScaffold(
      body: CustomScrollView(
        slivers: <Widget>[
          SliverToBoxAdapter(
            child: BrandHeader(
              title: 'Progress & Analytics',
              onTapSettings: () => context.push(AppRoutes.settings),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
            sliver: SliverList(
              delegate: SliverChildListDelegate(
                <Widget>[
                  _buildTimeframeBar(context, ref, timeframe),
                  const SizedBox(height: SpacingTokens.lg),
                  _buildScoreHero(context, bandSummary, targetBand),
                  const SizedBox(height: SpacingTokens.lg),
                  _buildStatsRow(context, filteredAttempts.length, streakDays),
                  const SizedBox(height: SpacingTokens.xl),
                  Text(
                    'Score Trend ($timeframe)',
                    style: typography.cardTitle.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  _buildTrendCard(context, trendPoints, targetBand),
                  const SizedBox(height: SpacingTokens.xl),
                  Row(
                    children: <Widget>[
                      Text(
                        'Skill Breakdown',
                        style: typography.cardTitle.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        'Tap for detailed analytics',
                        style: typography.caption.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  ...skillMetrics.map(
                    (metric) => _buildSkillCard(context, metric),
                  ),
                  const SizedBox(height: SpacingTokens.xl),
                  PrimaryButton(
                    label: 'View Complete Attempt History',
                    glyph: LucideGlyph.chartIncreasing,
                    trailingGlyph: LucideGlyph.arrowRight,
                    onPressed: () => context.push(AppRoutes.progressAttempts),
                  ),
                  const SizedBox(height: SpacingTokens.xxl),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<AttemptSummary> _filterByTimeframe(
    List<AttemptSummary> attempts,
    String timeframe,
    DateTime now,
  ) {
    final days = switch (timeframe) {
      '7D' => 7,
      '30D' => 30,
      '90D' => 90,
      _ => null,
    };
    if (days == null) return attempts;
    final cutoffMs = now
        .subtract(Duration(days: days))
        .millisecondsSinceEpoch;
    return attempts
        .where((a) => a.effectiveCompletedAtUtcMs >= cutoffMs)
        .toList(growable: false);
  }

  Widget _buildTimeframeBar(
    BuildContext context,
    WidgetRef ref,
    String activeTimeframe,
  ) {
    final frames = <String>['7D', '30D', '90D', 'ALL'];
    return Row(
      children: frames
          .map((f) {
            final isSelected = activeTimeframe == f;
            return Padding(
              padding: const EdgeInsetsDirectional.only(end: SpacingTokens.sm),
              child: MzChip(
                label: f,
                isSelected: isSelected,
                onTap: () =>
                    ref.read(timeframeProvider.notifier).setTimeframe(f),
              ),
            );
          })
          .toList(growable: false),
    );
  }

  Widget _buildScoreHero(
    BuildContext context,
    EstimatedBandSummary summary,
    double target,
  ) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final scoreText = summary.overallBand != null
        ? 'Band ${summary.overallBand!.toStringAsFixed(1)}'
        : 'Not yet estimated';

    return MzCard(
      variant: MzCardVariant.hero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              const AppIcon(LucideGlyph.target, size: 20),
              const SizedBox(width: SpacingTokens.xs),
              Text(
                summary.overallBand == null
                    ? 'ESTIMATED OVERALL BAND'
                    : (summary.isFullFourSkillEstimate
                          ? 'ESTIMATED OVERALL BAND'
                          : 'PARTIAL ESTIMATE (${summary.attemptedSkillsCount}/4 SKILLS)'),
                style: typography.caption.copyWith(
                  color: colors.textSecondary,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              if (summary.changeThisMonth != null)
                MzChip(
                  label:
                      '${summary.changeThisMonth! >= 0 ? '+' : ''}${summary.changeThisMonth!.toStringAsFixed(1)} this month',
                  isSelected: true,
                ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          Text(
            scoreText,
            style: typography.heroScore.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: SpacingTokens.sm),
          ScoreMeter(
            score: summary.overallBand ?? 0.0,
            targetScore: target,
            label: 'Target Band ${target.toStringAsFixed(1)}',
          ),
        ],
      ),
    );
  }

  Widget _buildStatsRow(BuildContext context, int totalAttempts, int streak) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Row(
      children: <Widget>[
        Expanded(
          child: MzCard(
            padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'Attempts',
                  style: typography.caption.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.xs),
                Text(
                  '$totalAttempts',
                  style: typography.cardScore.copyWith(color: colors.primary),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: SpacingTokens.sm),
        Expanded(
          child: MzCard(
            padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'Day Streak',
                  style: typography.caption.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.xs),
                Row(
                  children: <Widget>[
                    Text(
                      '$streak',
                      style: typography.cardScore.copyWith(
                        color: colors.warning,
                      ),
                    ),
                    const SizedBox(width: SpacingTokens.xs),
                    AppIcon(LucideGlyph.flame, color: colors.warning, size: 20),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTrendCard(
    BuildContext context,
    List<ScoreTrendPoint> points,
    double target,
  ) => MzCard(
    child: TrendChart(
      points: points,
      targetScore: target,
    ),
  );

  Widget _buildSkillCard(BuildContext context, SkillScoreSummary metric) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);

    Color accent;
    LucideGlyph glyph;

    switch (metric.skill) {
      case SkillKind.speaking:
        accent = colors.speakingAccent;
        glyph = LucideGlyph.mic;
      case SkillKind.writing:
        accent = colors.writingAccent;
        glyph = LucideGlyph.pencil;
      case SkillKind.reading:
        accent = colors.readingAccent;
        glyph = LucideGlyph.bookOpen;
      case SkillKind.listening:
        accent = colors.listeningAccent;
        glyph = LucideGlyph.headphones;
      case SkillKind.vocabulary:
        accent = colors.vocabAccent;
        glyph = LucideGlyph.layers3;
    }

    final skillName = metric.skill.name.toUpperCase();

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.sm),
      child: InkWell(
        onTap: () =>
            context.push(AppRoutes.buildProgressSkill(metric.skill.name)),
        borderRadius: shapes.controlRadius,
        child: Container(
          padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: shapes.controlRadius,
            border: Border.all(color: colors.borderSubtle),
          ),
          child: Row(
            children: <Widget>[
              AppIcon(glyph, color: accent, size: 22),
              const SizedBox(width: SpacingTokens.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      skillName,
                      style: typography.cardTitle.copyWith(
                        color: colors.textPrimary,
                      ),
                    ),
                    Text(
                      '${metric.sampleCount} attempts',
                      style: typography.caption.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                metric.scoreLabel,
                style: typography.cardScore.copyWith(
                  color: metric.score != null
                      ? colors.textPrimary
                      : colors.textTertiary,
                ),
              ),
              const SizedBox(width: SpacingTokens.sm),
              const AppIcon(LucideGlyph.chevronRight, size: 18),
            ],
          ),
        ),
      ),
    );
  }

  List<ScoreTrendPoint> _buildTrendPoints(List<AttemptSummary> attempts) {
    final scored = attempts.where((a) => a.overallBand != null).toList()
      ..sort(
        (a, b) => a.effectiveCompletedAtUtcMs.compareTo(
          b.effectiveCompletedAtUtcMs,
        ),
      );

    if (scored.isEmpty) {
      return const <ScoreTrendPoint>[];
    }

    return scored
        .map((a) {
          final dt = DateTime.fromMillisecondsSinceEpoch(
            a.effectiveCompletedAtUtcMs,
            isUtc: true,
          );
          return ScoreTrendPoint(
            dateLabel: '${dt.month}/${dt.day}',
            score: a.overallBand!,
            timestampUtcMs: a.effectiveCompletedAtUtcMs,
          );
        })
        .toList(growable: false);
  }
}

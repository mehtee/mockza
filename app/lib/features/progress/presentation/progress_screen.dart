import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/exams/exam_descriptor.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/exams/study_metrics_calculator.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/formatting/jalali_edge_formatter.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/data/repositories/progress_repository.dart';
import 'package:mockza/features/progress/presentation/progress_providers.dart';
import 'package:mockza/features/progress/presentation/widgets/navia_handoff_card.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/speech_practice_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/brand_header.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/score_meter.dart';
import 'package:mockza/theme/components/speech_practice_sheet.dart';
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
    final edition = ref.watch(editionConfigProvider).edition;
    final isIran = edition == AppEdition.iran;

    final attempts = attemptsAsync.asData?.value ?? const <AttemptSummary>[];
    final dailyLogs = logsAsync.asData?.value ?? const <DailyStudySummary>[];
    final profile = profileAsync.asData?.value;
    final track = ExamTrack.fromId(profile?.examId ?? 'ielts_academic');
    final targetBand = profile?.targetBand ?? track.targetScoreDefault;

    final now = ref.watch(clockProvider).now();
    final scaleAttempts = attempts
        .where((a) {
          final aTrack = ExamTrack.fromId(a.examId);
          return (track.isIelts && aTrack.isIelts) || aTrack == track;
        })
        .toList(growable: false);
    final filteredAttempts = _filterByTimeframe(scaleAttempts, timeframe, now);

    final scoredAttempts = filteredAttempts
        .where((a) => a.countsTowardCalibratedBand)
        .map(
          (a) => (
            score: a.overallBand!,
            skill: a.skill,
            completedAtUtcMs: a.effectiveCompletedAtUtcMs,
          ),
        )
        .toList(growable: false);

    final skillAttempts = filteredAttempts
        .where((a) => a.countsTowardCalibratedBand)
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

    final trendPoints = _buildTrendPoints(filteredAttempts, edition: edition);

    return MzScaffold(
      body: CustomScrollView(
        slivers: <Widget>[
          SliverToBoxAdapter(
            child: BrandHeader(
              title: isIran ? 'پیشرفت و تحلیل نمرات' : 'Progress & Analytics',
              onTapSettings: () => context.push(AppRoutes.settings),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsetsDirectional.symmetric(
              vertical: SpacingTokens.lg,
            ),
            sliver: SliverList(
              delegate: SliverChildListDelegate(
                <Widget>[
                  _buildTimeframeBar(context, ref, timeframe, isIran: isIran),
                  const SizedBox(height: SpacingTokens.lg),
                  _buildScoreHero(
                    context,
                    bandSummary,
                    targetBand,
                    track,
                    skillMetrics,
                    isIran: isIran,
                  ),
                  if (isIran) ...<Widget>[
                    const SizedBox(height: SpacingTokens.md),
                    NaviaHandoffCard(
                      track: track,
                      estimatedScore: bandSummary.overallBand,
                      targetScore: targetBand,
                    ),
                  ],
                  const SizedBox(height: SpacingTokens.lg),
                  _buildStatsRow(
                    context,
                    filteredAttempts.length,
                    streakDays,
                    edition: edition,
                  ),
                  const SizedBox(height: SpacingTokens.xl),
                  Text(
                    isIran
                        ? 'روند پیشرفت ($timeframe)'
                        : 'Score Trend ($timeframe)',
                    style: typography.cardTitle.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  _buildTrendCard(context, trendPoints, targetBand, track),
                  const SizedBox(height: SpacingTokens.xl),
                  Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: SpacingTokens.sm,
                    runSpacing: SpacingTokens.xs,
                    children: <Widget>[
                      Text(
                        isIran ? 'تفکیک مهارت‌ها' : 'Skill Breakdown',
                        style: typography.cardTitle.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                      Text(
                        isIran
                            ? 'برای جزئیات هر مهارت لمس کنید'
                            : 'Tap for detailed analytics',
                        style: typography.caption.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  ...skillMetrics.map(
                    (metric) =>
                        _buildSkillCard(context, metric, edition: edition),
                  ),
                  const SizedBox(height: SpacingTokens.xl),
                  SecondaryButton(
                    label: AppLocalizations.of(context).roadmapViewFullCta,
                    glyph: LucideGlyph.target,
                    onPressed: () => context.push(AppRoutes.roadmap),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  SecondaryButton(
                    label: AppLocalizations.of(context).speechStudioTitle,
                    glyph: LucideGlyph.mic,
                    onPressed: () => unawaited(
                      SpeechPracticeSheet.show(
                        context,
                        targetText:
                            'Consistent daily articulation sharpens clarity and fluency.',
                        sourceRefType: 'progress_studio',
                        sourceContext: 'progress',
                      ),
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  const _PronunciationHistorySection(),
                  const SizedBox(height: SpacingTokens.sm),
                  PrimaryButton(
                    label: isIran
                        ? 'مشاهده تاریخچه کامل آزمون‌ها'
                        : 'View Complete Attempt History',
                    glyph: LucideGlyph.chartIncreasing,
                    trailingGlyph: isIran
                        ? LucideGlyph.arrowLeft
                        : LucideGlyph.arrowRight,
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
    final cutoffMs = now.subtract(Duration(days: days)).millisecondsSinceEpoch;
    return attempts
        .where((a) => a.effectiveCompletedAtUtcMs >= cutoffMs)
        .toList(growable: false);
  }

  Widget _buildTimeframeBar(
    BuildContext context,
    WidgetRef ref,
    String activeTimeframe, {
    required bool isIran,
  }) {
    final frames = <({String key, String label})>[
      (key: '7D', label: isIran ? '۷ روز' : '7D'),
      (key: '30D', label: isIran ? '۳۰ روز' : '30D'),
      (key: '90D', label: isIran ? '۹۰ روز' : '90D'),
      (key: 'ALL', label: isIran ? 'همه' : 'ALL'),
    ];
    return Row(
      children: frames
          .map((f) {
            final isSelected = activeTimeframe == f.key;
            return Padding(
              padding: const EdgeInsetsDirectional.only(end: SpacingTokens.sm),
              child: MzChip(
                label: f.label,
                isSelected: isSelected,
                onTap: () =>
                    ref.read(timeframeProvider.notifier).setTimeframe(f.key),
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
    ExamTrack track,
    List<SkillScoreSummary> skillMetrics, {
    required bool isIran,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final scoreText = summary.overallBand != null
        ? track.formatScoreWithUnit(summary.overallBand!)
        : (isIran ? 'هنوز برآورد نشده' : 'Not yet estimated');
    final headingLabel = isIran
        ? 'نمره کل تخمینی'
        : (track.isIelts || track == ExamTrack.toeflIbt
              ? 'ESTIMATED OVERALL BAND'
              : 'ESTIMATED OVERALL SCORE');

    double? skillVal(SkillKind s) => skillMetrics
        .cast<SkillScoreSummary?>()
        .firstWhere((m) => m?.skill == s, orElse: () => null)
        ?.score;
    final insights = summary.overallBand != null
        ? ExamDescriptor.forTrack(track).buildScoreInsights(
            overallScore: summary.overallBand!,
            reading: skillVal(SkillKind.reading),
            listening: skillVal(SkillKind.listening),
            writing: skillVal(SkillKind.writing),
            speaking: skillVal(SkillKind.speaking),
          )
        : const <({String label, String detail})>[];

    return MzCard(
      variant: MzCardVariant.hero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: SpacingTokens.sm,
            runSpacing: SpacingTokens.xs,
            children: <Widget>[
              Row(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  const AppIcon(LucideGlyph.target, size: 20),
                  const SizedBox(width: SpacingTokens.xs),
                  Flexible(
                    child: Text(
                      summary.overallBand == null
                          ? headingLabel
                          : (summary.isFullFourSkillEstimate
                                ? headingLabel
                                : 'PARTIAL ESTIMATE (${summary.attemptedSkillsCount}/4 SKILLS)'),
                      style: typography.caption.copyWith(
                        color: colors.textSecondary,
                        letterSpacing: 1.2,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              if (summary.changeThisMonth != null)
                MzChip(
                  label:
                      '${summary.changeThisMonth! >= 0 ? '+' : ''}${track.usesIntegerDisplay ? summary.changeThisMonth!.round().toString() : summary.changeThisMonth!.toStringAsFixed(1)} this month',
                  isSelected: true,
                ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          LtrExamBoundary(
            useLatinFont: summary.overallBand != null,
            child: Text(
              scoreText,
              style: typography.heroScore.copyWith(color: colors.textPrimary),
            ),
          ),
          const SizedBox(height: SpacingTokens.sm),
          LtrExamBoundary(
            useLatinFont: !isIran,
            child: ScoreMeter(
              score: summary.overallBand ?? track.minScore,
              targetScore: target,
              minScore: track.minScore,
              maxScore: track.maxScore,
              label: isIran
                  ? 'هدف ${track.formatScoreWithUnit(target)}'
                  : 'Target ${track.formatScoreWithUnit(target)}',
            ),
          ),
          if (insights.isNotEmpty) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            Wrap(
              spacing: SpacingTokens.xs,
              runSpacing: SpacingTokens.xs,
              children: insights
                  .map(
                    (i) => MzChip(
                      label: '${i.label}: ${i.detail}',
                      isSelected: true,
                    ),
                  )
                  .toList(growable: false),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatsRow(
    BuildContext context,
    int totalAttempts,
    int streak, {
    required AppEdition edition,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isIran = edition == AppEdition.iran;

    return Row(
      children: <Widget>[
        Expanded(
          child: MzCard(
            padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  isIran ? 'آزمون‌ها' : 'Attempts',
                  style: typography.caption.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.xs),
                Text(
                  EdgeNumerals.formatChromeNumber(totalAttempts, edition),
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
                  isIran ? 'زنجیره روزانه' : 'Day Streak',
                  style: typography.caption.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.xs),
                Row(
                  children: <Widget>[
                    Text(
                      EdgeNumerals.formatChromeNumber(streak, edition),
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
    ExamTrack track,
  ) => MzCard(
    child: TrendChart(
      points: points,
      targetScore: target,
      minScore: track.minScore,
      maxScore: track.maxScore,
    ),
  );

  Widget _buildSkillCard(
    BuildContext context,
    SkillScoreSummary metric, {
    required AppEdition edition,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);
    final isIran = edition == AppEdition.iran;

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
                    LtrExamBoundary(
                      child: Text(
                        skillName,
                        style: typography.cardTitle.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                    ),
                    Text(
                      isIran
                          ? '${EdgeNumerals.formatChromeNumber(metric.sampleCount, edition)} تمرین'
                          : '${metric.sampleCount} attempts',
                      style: typography.caption.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              LtrExamBoundary(
                child: Text(
                  metric.scoreLabel,
                  style: typography.cardScore.copyWith(
                    color: metric.score != null
                        ? colors.textPrimary
                        : colors.textTertiary,
                  ),
                ),
              ),
              const SizedBox(width: SpacingTokens.sm),
              AppIcon(
                isIran ? LucideGlyph.chevronLeft : LucideGlyph.chevronRight,
                size: 18,
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<ScoreTrendPoint> _buildTrendPoints(
    List<AttemptSummary> attempts, {
    required AppEdition edition,
  }) {
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
          final label = edition == AppEdition.iran
              ? (() {
                  final j = JalaliEdgeFormatter.toJalali(
                    dt.year,
                    dt.month,
                    dt.day,
                  );
                  return EdgeNumerals.toPersianDigits('${j.jm}/${j.jd}');
                })()
              : '${dt.month}/${dt.day}';
          return ScoreTrendPoint(
            dateLabel: label,
            score: a.overallBand!,
            timestampUtcMs: a.effectiveCompletedAtUtcMs,
            isCalibrated: a.countsTowardCalibratedBand,
          );
        })
        .toList(growable: false);
  }
}

class _PronunciationHistorySection extends ConsumerStatefulWidget {
  const new();

  @override
  ConsumerState<_PronunciationHistorySection> createState() =>
      _PronunciationHistorySectionState();
}

class _PronunciationHistorySectionState
    extends ConsumerState<_PronunciationHistorySection> {
  List<PronunciationPracticeItemDto> _items =
      const <PronunciationPracticeItemDto>[];
  String? _playingId;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    try {
      final repo = ref.read(personalizationRepositoryProvider);
      final local = await repo.listLocalPronunciationHistory(limit: 5);
      if (mounted && local.isNotEmpty) {
        setState(() => _items = local);
      }
      final remote = await ref
          .read(speechPracticeGatewayProvider)
          .listHistory(limit: 5);
      final items = remote.valueOrNull;
      if (mounted && items != null && items.isNotEmpty) {
        for (final item in items) {
          await repo.savePronunciationPractice(item);
        }
        if (mounted) setState(() => _items = items);
      }
    } on Object {
      // Offline fallback preserved.
    }
  }

  Future<void> _play(PronunciationPracticeItemDto item) async {
    final audioUrl = item.audioPlayUrl;
    if (audioUrl == null || audioUrl.isEmpty) return;
    setState(() => _playingId = item.practiceId);
    final res = await ref
        .read(speechPracticeGatewayProvider)
        .fetchPlayableRecordingRef(
          practiceId: item.practiceId,
          relativeAudioPath: audioUrl,
        );
    final playable = res.valueOrNull;
    if (playable != null) {
      final player = ref.read(audioPlayerGatewayProvider);
      final loadRes = await player.loadFile(playable);
      if (loadRes.isOk) {
        await player.play();
      }
    }
    if (mounted) setState(() => _playingId = null);
  }

  @override
  Widget build(BuildContext context) {
    if (_items.isEmpty) return const SizedBox.shrink();
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            l10n.speechHistoryTitle,
            style: typography.cardTitle.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: SpacingTokens.sm),
          ..._items.map(
            (item) => Padding(
              padding: const EdgeInsetsDirectional.only(
                bottom: SpacingTokens.xs,
              ),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: LtrExamBoundary(
                      child: Text(
                        '${item.overallScore ?? '--'}% · ${item.targetText}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: typography.caption.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                    ),
                  ),
                  if (item.audioPlayUrl != null)
                    IconButton(
                      tooltip: l10n.speechReplayMine,
                      onPressed: _playingId == item.practiceId
                          ? null
                          : () => unawaited(_play(item)),
                      icon: AppIcon(
                        _playingId == item.practiceId
                            ? LucideGlyph.loaderCircle
                            : LucideGlyph.play,
                        size: 16,
                        color: colors.primary,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

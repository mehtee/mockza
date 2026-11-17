import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/evaluation_models.dart';
import 'package:mockza/features/progress/presentation/progress_providers.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/routing/safe_pop.dart';
import 'package:mockza/services/grading_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/empty_state.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/score_meter.dart';
import 'package:mockza/theme/primitives.dart';

/// Deep-dive skill analytics computed dynamically from persisted scored attempts & criteria.
class ProgressSkillScreen extends ConsumerStatefulWidget {
  /// Creates a [ProgressSkillScreen].
  const new({
    required this.skill,
    super.key,
  });

  /// Skill slug (`speaking`, `writing`, `reading`, `listening`).
  final String skill;

  @override
  ConsumerState<ProgressSkillScreen> createState() =>
      _ProgressSkillScreenState();
}

class _ProgressSkillScreenState extends ConsumerState<ProgressSkillScreen> {
  bool _isLoading = true;
  double? _averageBand;
  int _attemptCount = 0;
  List<({String label, double band})> _criterionAverages =
      const <({String label, double band})>[];
  String? _strongestNote;
  String? _weakestNote;
  String? _nextStepRecommendation;
  RecommendedDrill? _recommendedDrill;
  double? _objectiveAccuracyPct;

  @override
  void initState() {
    super.initState();
    unawaited(Future.microtask(_loadSkillAnalytics));
  }

  @override
  void didUpdateWidget(covariant ProgressSkillScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.skill != widget.skill) {
      unawaited(Future.microtask(_loadSkillAnalytics));
    }
  }

  Future<void> _loadSkillAnalytics() async {
    if (!mounted) return;
    setState(() => _isLoading = true);

    final targetSkill = SkillKind.values.firstWhere(
      (s) => s.name.toLowerCase() == widget.skill.toLowerCase(),
      orElse: () => SkillKind.speaking,
    );

    final attemptRepo = ref.read(attemptRepositoryProvider);
    final recent = await attemptRepo.watchRecentAttempts(limit: 100).first;
    final matching = recent
        .where(
          (a) =>
              a.skill == targetSkill &&
              a.status == AttemptStatus.scored &&
              a.overallBand != null,
        )
        .toList(growable: false);

    if (!mounted) return;
    if (matching.isEmpty) {
      setState(() {
        _isLoading = false;
        _attemptCount = 0;
        _averageBand = null;
        _criterionAverages = const [];
        _strongestNote = null;
        _weakestNote = null;
        _nextStepRecommendation = null;
        _recommendedDrill = null;
        _objectiveAccuracyPct = null;
      });
      return;
    }

    final totalBand = matching.fold<double>(
      0,
      (sum, item) => sum + item.overallBand!,
    );
    final avgBand = ExamSpec.roundIeltsBand(totalBand / matching.length);

    final criterionSums = <String, List<double>>{};
    final feedbackByCriterion = <String, String>{};
    String? latestNextStep;
    RecommendedDrill? latestDrill;
    var totalCorrect = 0;
    var totalQuestions = 0;

    for (final summary in matching.take(10)) {
      final row = await attemptRepo.getAttemptRow(summary.attemptId);
      if (row == null) continue;

      if (targetSkill == SkillKind.writing &&
          row.evaluationJson != null &&
          row.evaluationJson!.isNotEmpty) {
        final map = _decodeMap(row.evaluationJson!);
        final parsed = HttpGradingGateway.parseWritingEvaluation(map);
        for (final c in parsed.criteria) {
          criterionSums
              .putIfAbsent(c.criterionLabel, () => <double>[])
              .add(c.band);
          if (c.feedbackNote.isNotEmpty) {
            feedbackByCriterion.putIfAbsent(
              c.criterionLabel,
              () => c.feedbackNote,
            );
          }
        }
        latestNextStep ??= parsed.actionableNextStep.isNotEmpty
            ? parsed.actionableNextStep
            : null;
        latestDrill ??= parsed.recommendedDrill;
      } else if (targetSkill == SkillKind.speaking &&
          row.evaluationJson != null &&
          row.evaluationJson!.isNotEmpty) {
        final map = _decodeMap(row.evaluationJson!);
        final parsed = HttpGradingGateway.parseSpeakingEvaluation(map);
        for (final c in parsed.criteria) {
          criterionSums
              .putIfAbsent(c.criterionLabel, () => <double>[])
              .add(c.band);
          if (c.feedbackNote.isNotEmpty) {
            feedbackByCriterion.putIfAbsent(
              c.criterionLabel,
              () => c.feedbackNote,
            );
          }
        }
        latestNextStep ??= parsed.actionableNextStep.isNotEmpty
            ? parsed.actionableNextStep
            : null;
        latestDrill ??= parsed.recommendedDrill;
      } else if (targetSkill == SkillKind.reading ||
          targetSkill == SkillKind.listening) {
        final subMap = _decodeMap(row.submissionJson);
        totalCorrect += (subMap['correctCount'] as num?)?.toInt() ?? 0;
        totalQuestions += (subMap['totalCount'] as num?)?.toInt() ?? 0;
      }
    }

    final criterionAvgs = criterionSums.entries
        .map((e) {
          final avg = e.value.reduce((a, b) => a + b) / e.value.length;
          return (label: e.key, band: ExamSpec.roundIeltsBand(avg));
        })
        .toList(growable: false);

    String? strongest;
    String? weakest;
    if (criterionAvgs.isNotEmpty) {
      final sorted = [...criterionAvgs]
        ..sort((a, b) => b.band.compareTo(a.band));
      strongest =
          '${sorted.first.label} (${sorted.first.band.toStringAsFixed(1)}): ${feedbackByCriterion[sorted.first.label] ?? 'Highest scoring criterion across recent attempts.'}';
      weakest =
          '${sorted.last.label} (${sorted.last.band.toStringAsFixed(1)}): ${feedbackByCriterion[sorted.last.label] ?? 'Focus on this criterion in your next practice test.'}';
    } else if (totalQuestions > 0) {
      final acc = ((totalCorrect / totalQuestions) * 100).round();
      strongest =
          '$totalCorrect of $totalQuestions answers correct overall ($acc% accuracy).';
      weakest = 'Review missed items and distractor explanations inside recent attempt feedback.';
    }

    if (!mounted) return;
    setState(() {
      _isLoading = false;
      _attemptCount = matching.length;
      _averageBand = avgBand;
      _criterionAverages = criterionAvgs;
      _strongestNote = strongest;
      _weakestNote = weakest;
      _nextStepRecommendation = latestNextStep;
      _recommendedDrill = latestDrill;
      _objectiveAccuracyPct = totalQuestions > 0
          ? (totalCorrect / totalQuestions) * 100
          : null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final profile = ref.watch(progressProfileProvider).asData?.value;
    final targetBand = profile?.targetBand ?? 7.5;
    final skillName = _formattedSkillName(widget.skill);

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const AppIcon(LucideGlyph.chevronLeft, size: 22),
          onPressed: () => context.safePopOrGo(AppRoutes.progress),
        ),
        title: Text('$skillName Analytics'),
      ),
      body: _isLoading
          ? Center(
              child: CircularProgressIndicator(color: colors.primary),
            )
          : (_attemptCount == 0 || _averageBand == null
                ? EmptyState(
                    glyph: LucideGlyph.chartIncreasing,
                    title: 'No scored $skillName sessions yet',
                    description:
                        'Complete a $skillName practice session to unlock detailed rubric & trend analytics.',
                    actionLabel: 'Practice $skillName',
                    onTapAction: () => context.push(
                      AppRoutes.buildPracticeSetup(widget.skill),
                    ),
                  )
                : SingleChildScrollView(
                    padding: const EdgeInsetsDirectional.symmetric(
                      vertical: SpacingTokens.lg,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        _buildSkillHeroCard(
                          context,
                          skillName: skillName,
                          averageBand: _averageBand!,
                          targetBand: targetBand,
                          attemptCount: _attemptCount,
                        ),
                        if (_criterionAverages.isNotEmpty) ...<Widget>[
                          const SizedBox(height: SpacingTokens.lg),
                          Text(
                            'Criterion Averages',
                            style: typography.cardTitle.copyWith(
                              color: colors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.sm),
                          ..._criterionAverages.map(
                            (c) => _buildCriterionRow(
                              context,
                              c.label,
                              c.band,
                              targetBand,
                            ),
                          ),
                        ] else if (_objectiveAccuracyPct != null) ...<Widget>[
                          const SizedBox(height: SpacingTokens.lg),
                          MzCard(
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: <Widget>[
                                Text(
                                  'Overall Objective Accuracy',
                                  style: typography.cardTitle,
                                ),
                                MzChip(
                                  label: '${_objectiveAccuracyPct!.round()}%',
                                  variant: MzChipVariant.positive,
                                ),
                              ],
                            ),
                          ),
                        ],
                        if (_strongestNote != null ||
                            _weakestNote != null) ...<Widget>[
                          const SizedBox(height: SpacingTokens.xl),
                          Text(
                            'Strengths & Focus Areas',
                            style: typography.cardTitle.copyWith(
                              color: colors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.sm),
                          _buildStrengthsWeaknesses(context),
                        ],
                        if (_nextStepRecommendation != null ||
                            _recommendedDrill != null) ...<Widget>[
                          const SizedBox(height: SpacingTokens.xl),
                          _buildNextStepsCard(context),
                        ],
                        const SizedBox(height: SpacingTokens.xxl),
                      ],
                    ),
                  )),
    );
  }

  Widget _buildSkillHeroCard(
    BuildContext context, {
    required String skillName,
    required double averageBand,
    required double targetBand,
    required int attemptCount,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final gap = averageBand - targetBand;
    final gapLabel = gap >= 0
        ? 'On target (+${gap.toStringAsFixed(1)})'
        : 'Gap to Target: ${gap.toStringAsFixed(1)} Band';

    return MzCard(
      variant: MzCardVariant.hero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              MzChip(label: skillName, isSelected: true),
              const Spacer(),
              MzChip(label: 'Target ${targetBand.toStringAsFixed(1)}'),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          Text(
            'Band ${averageBand.toStringAsFixed(1)}',
            style: typography.heroScore.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            'Averaged across $attemptCount scored $skillName attempts.',
            style: typography.body.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.md),
          ScoreMeter(
            score: averageBand,
            targetScore: targetBand,
            label: gapLabel,
          ),
        ],
      ),
    );
  }

  Widget _buildCriterionRow(
    BuildContext context,
    String name,
    double score,
    double targetBand,
  ) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.sm),
      child: MzCard(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    name,
                    style: typography.cardTitle.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                ),
                Text(
                  'Band ${score.toStringAsFixed(1)}',
                  style: typography.cardScore.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: SpacingTokens.xs),
            ScoreMeter(
              score: score,
              targetScore: targetBand,
              trackHeight: 6,
              showLabels: false,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStrengthsWeaknesses(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);

    return Column(
      children: <Widget>[
        if (_strongestNote != null)
          Container(
            padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
            decoration: BoxDecoration(
              color: colors.mintBg,
              borderRadius: shapes.controlRadius,
              border: Border.all(color: colors.success),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                AppIcon(
                  LucideGlyph.checkCircle2,
                  color: colors.success,
                  size: 20,
                ),
                const SizedBox(width: SpacingTokens.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'Top Strength',
                        style: typography.secondary.copyWith(
                          color: colors.success,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.xs),
                      Text(
                        _strongestNote!,
                        style: typography.body.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        if (_strongestNote != null && _weakestNote != null)
          const SizedBox(height: SpacingTokens.sm),
        if (_weakestNote != null)
          Container(
            padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
            decoration: BoxDecoration(
              color: colors.dangerBg,
              borderRadius: shapes.controlRadius,
              border: Border.all(color: colors.error),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                AppIcon(LucideGlyph.x, color: colors.error, size: 20),
                const SizedBox(width: SpacingTokens.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'Primary Focus Area',
                        style: typography.secondary.copyWith(
                          color: colors.error,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.xs),
                      Text(
                        _weakestNote!,
                        style: typography.body.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }

  Widget _buildNextStepsCard(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final drill = _recommendedDrill;

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              const AppIcon(LucideGlyph.trendingUp, size: 20),
              const SizedBox(width: SpacingTokens.sm),
              Text(
                'NEXT PRACTICE RECOMMENDATION',
                style: typography.caption.copyWith(
                  color: colors.textSecondary,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          if (drill != null) ...<Widget>[
            Text(
              drill.title,
              style: typography.cardTitle.copyWith(color: colors.textPrimary),
            ),
            const SizedBox(height: SpacingTokens.xs),
          ],
          if (_nextStepRecommendation != null) ...<Widget>[
            Text(
              _nextStepRecommendation!,
              style: typography.body.copyWith(color: colors.textSecondary),
            ),
            const SizedBox(height: SpacingTokens.lg),
          ],
          if (drill != null)
            PrimaryButton(
              label: 'Start ${drill.durationMinutes}-Min Micro-Drill',
              glyph: LucideGlyph.circlePlay,
              onPressed: () => context.push(
                AppRoutes.buildMicroDrill(drill.drillId),
              ),
            )
          else
            SecondaryButton(
              label: 'Open Practice Drills',
              glyph: LucideGlyph.circlePlay,
              onPressed: () => context.push(AppRoutes.microDrills),
            ),
        ],
      ),
    );
  }

  Map<String, Object?> _decodeMap(String raw) {
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, Object?>) return decoded;
      if (decoded is Map) {
        return decoded.map(
          (k, v) => MapEntry<String, Object?>(k.toString(), v),
        );
      }
    } on Object {
      // Ignore malformed historical rows.
    }
    return const <String, Object?>{};
  }

  String _formattedSkillName(String raw) => switch (raw.toLowerCase()) {
    'speaking' => 'Speaking',
    'writing' => 'Writing',
    'reading' => 'Reading',
    'listening' => 'Listening',
    _ => raw,
  };
}

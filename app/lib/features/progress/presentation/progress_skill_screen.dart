import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/localization/edition_copy.dart';
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

    final isIran = ref.read(editionConfigProvider).edition == AppEdition.iran;
    final targetSkill = SkillKind.values.firstWhere(
      (s) => s.name.toLowerCase() == widget.skill.toLowerCase(),
      orElse: () => SkillKind.speaking,
    );

    final profile = await ref
        .read(profileRepositoryProvider)
        .loadOrInitializePrimary();
    final activeTrack = ExamTrack.fromId(profile.examId);
    final attemptRepo = ref.read(attemptRepositoryProvider);
    final recent = await attemptRepo.watchRecentAttempts(limit: 100).first;
    final matching = recent
        .where((a) {
          if (a.skill != targetSkill ||
              a.status != AttemptStatus.scored ||
              a.overallBand == null) {
            return false;
          }
          final aTrack = ExamTrack.fromId(a.examId);
          return (activeTrack.isIelts && aTrack.isIelts) ||
              aTrack == activeTrack;
        })
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
    final rawAvg = totalBand / matching.length;
    final avgBand = activeTrack.isIelts
        ? ExamSpec.roundIeltsBand(rawAvg)
        : activeTrack.quantizeScore(rawAvg);

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
          final rounded = activeTrack.isIelts
              ? ExamSpec.roundIeltsBand(avg)
              : activeTrack.quantizeScore(avg);
          return (label: e.key, band: rounded);
        })
        .toList(growable: false);

    String? strongest;
    String? weakest;
    if (criterionAvgs.isNotEmpty) {
      final sorted = [...criterionAvgs]
        ..sort((a, b) => b.band.compareTo(a.band));
      final topScore = EditionCopy.formatScoreFor(
        activeTrack,
        sorted.first.band,
        isIran: isIran,
      );
      final lowScore = EditionCopy.formatScoreFor(
        activeTrack,
        sorted.last.band,
        isIran: isIran,
      );
      strongest = isIran
          ? '${sorted.first.label} ($topScore): ${feedbackByCriterion[sorted.first.label] ?? 'بالاترین معیار در آزمون‌های اخیر.'}'
          : '${sorted.first.label} ($topScore): ${feedbackByCriterion[sorted.first.label] ?? 'Highest scoring criterion across recent attempts.'}';
      weakest = isIran
          ? '${sorted.last.label} ($lowScore): ${feedbackByCriterion[sorted.last.label] ?? 'در تمرین بعدی روی این معیار تمرکز کنید.'}'
          : '${sorted.last.label} ($lowScore): ${feedbackByCriterion[sorted.last.label] ?? 'Focus on this criterion in your next practice test.'}';
    } else if (totalQuestions > 0) {
      final acc = ((totalCorrect / totalQuestions) * 100).round();
      if (isIran) {
        final correctStr = EdgeNumerals.toPersianDigits('$totalCorrect');
        final totalStr = EdgeNumerals.toPersianDigits('$totalQuestions');
        final accStr = EdgeNumerals.toPersianDigits('$acc%');
        strongest = '$correctStr از $totalStr پاسخ صحیح (دقت $accStr).';
        weakest = 'پرسش‌های اشتباه و نکات گزینه‌های انحرافی را در بازخورد آزمون‌های اخیر مرور کنید.';
      } else {
        strongest =
            '$totalCorrect of $totalQuestions answers correct overall ($acc% accuracy).';
        weakest = 'Review missed items and distractor explanations inside recent attempt feedback.';
      }
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
    final activeTrack = ExamTrack.fromId(profile?.examId ?? 'ielts_academic');
    final targetBand = profile?.targetBand ?? activeTrack.targetScoreDefault;
    final isIran = ref.watch(editionConfigProvider).edition == AppEdition.iran;
    final skillName = EditionCopy.skillName(widget.skill, isIran: isIran);

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: AppIcon(
            isIran ? LucideGlyph.chevronRight : LucideGlyph.chevronLeft,
            size: 22,
          ),
          onPressed: () => context.safePopOrGo(AppRoutes.progress),
        ),
        title: Text(isIran ? 'تحلیل $skillName' : '$skillName Analytics'),
      ),
      body: _isLoading
          ? Center(
              child: CircularProgressIndicator(color: colors.primary),
            )
          : (_attemptCount == 0 || _averageBand == null
                ? EmptyState(
                    glyph: LucideGlyph.chartIncreasing,
                    title: isIran
                        ? 'هنوز آزمون نمره‌دار $skillName ثبت نشده'
                        : 'No scored $skillName sessions yet',
                    description: isIran
                        ? 'یک تمرین یا آزمون $skillName را کامل کنید تا تحلیل جزئیات و روند پیشرفت باز شود.'
                        : 'Complete a $skillName practice session to unlock detailed rubric & trend analytics.',
                    actionLabel: isIran
                        ? 'تمرین $skillName'
                        : 'Practice $skillName',
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
                          track: activeTrack,
                          skillName: skillName,
                          averageBand: _averageBand!,
                          targetBand: targetBand,
                          attemptCount: _attemptCount,
                          isIran: isIran,
                        ),
                        if (_criterionAverages.isNotEmpty) ...<Widget>[
                          const SizedBox(height: SpacingTokens.lg),
                          Text(
                            isIran ? 'میانگین معیارها' : 'Criterion Averages',
                            style: typography.cardTitle.copyWith(
                              color: colors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.sm),
                          ..._criterionAverages.map(
                            (c) => _buildCriterionRow(
                              context,
                              activeTrack,
                              c.label,
                              c.band,
                              targetBand,
                              isIran: isIran,
                            ),
                          ),
                        ] else if (_objectiveAccuracyPct != null) ...<Widget>[
                          const SizedBox(height: SpacingTokens.lg),
                          MzCard(
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: <Widget>[
                                Text(
                                  isIran
                                      ? 'دقت کلی پاسخ‌های تستی'
                                      : 'Overall Objective Accuracy',
                                  style: typography.cardTitle,
                                ),
                                MzChip(
                                  label: isIran
                                      ? EdgeNumerals.toPersianDigits(
                                          '${_objectiveAccuracyPct!.round()}%',
                                        )
                                      : '${_objectiveAccuracyPct!.round()}%',
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
                            isIran
                                ? 'نقاط قوت و حوزه‌های تمرکز'
                                : 'Strengths & Focus Areas',
                            style: typography.cardTitle.copyWith(
                              color: colors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.sm),
                          _buildStrengthsWeaknesses(context, isIran: isIran),
                        ],
                        if (_nextStepRecommendation != null ||
                            _recommendedDrill != null) ...<Widget>[
                          const SizedBox(height: SpacingTokens.xl),
                          _buildNextStepsCard(context, isIran: isIran),
                        ],
                        const SizedBox(height: SpacingTokens.xxl),
                      ],
                    ),
                  )),
    );
  }

  Widget _buildSkillHeroCard(
    BuildContext context, {
    required ExamTrack track,
    required String skillName,
    required double averageBand,
    required double targetBand,
    required int attemptCount,
    required bool isIran,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final gap = averageBand - targetBand;
    final formattedGap = track.usesIntegerDisplay
        ? gap.round().toString()
        : gap.toStringAsFixed(1);
    final displayGap = isIran
        ? EdgeNumerals.toPersianDigits(formattedGap)
        : formattedGap;
    final unit = EditionCopy.unitLabelFor(track, isIran: isIran);
    final gapLabel = gap >= 0
        ? (isIran ? 'در سطح هدف (+$displayGap)' : 'On target (+$displayGap)')
        : (isIran
              ? 'فاصله تا هدف: $displayGap $unit'
              : 'Gap to Target: $displayGap ${track.unitLabel}');
    final attemptStr = isIran
        ? EdgeNumerals.toPersianDigits('$attemptCount')
        : '$attemptCount';

    return MzCard(
      variant: MzCardVariant.hero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              MzChip(label: skillName, isSelected: true),
              const Spacer(),
              MzChip(
                label: isIran
                    ? 'هدف ${EditionCopy.formatScoreFor(track, targetBand, isIran: true)}'
                    : 'Target ${track.formatScore(targetBand)}',
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          Text(
            EditionCopy.formatScoreWithUnitFor(
              track,
              averageBand,
              isIran: isIran,
            ),
            style: typography.heroScore.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            isIran
                ? 'میانگین بر اساس $attemptStr آزمون نمره‌دار $skillName.'
                : 'Averaged across $attemptCount scored $skillName attempts.',
            style: typography.body.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.md),
          ScoreMeter(
            score: averageBand,
            targetScore: targetBand,
            minScore: track.minScore,
            maxScore: track.maxScore,
            label: gapLabel,
            targetPrefix: isIran ? 'هدف' : 'Target',
            usePersianDigits: isIran,
          ),
        ],
      ),
    );
  }

  Widget _buildCriterionRow(
    BuildContext context,
    ExamTrack track,
    String name,
    double score,
    double targetBand, {
    required bool isIran,
  }) {
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
                  EditionCopy.formatScoreWithUnitFor(
                    track,
                    score,
                    isIran: isIran,
                  ),
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
              minScore: track.minScore,
              maxScore: track.maxScore,
              trackHeight: 6,
              showLabels: false,
              usePersianDigits: isIran,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStrengthsWeaknesses(
    BuildContext context, {
    required bool isIran,
  }) {
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
                        isIran ? 'برجسته‌ترین نقطه قوت' : 'Top Strength',
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
                        isIran ? 'اولویت اصلی بهبود' : 'Primary Focus Area',
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

  Widget _buildNextStepsCard(BuildContext context, {required bool isIran}) {
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
              Expanded(
                child: Text(
                  isIran
                      ? 'پیشنهاد تمرین بعدی'
                      : 'NEXT PRACTICE RECOMMENDATION',
                  style: typography.caption.copyWith(
                    color: colors.textSecondary,
                    letterSpacing: isIran ? 0 : 1.2,
                    fontWeight: FontWeight.w600,
                  ),
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
              label: isIran
                  ? 'شروع تمرین ${EdgeNumerals.toPersianDigits('${drill.durationMinutes}')} دقیقه‌ای'
                  : 'Start ${drill.durationMinutes}-Min Micro-Drill',
              glyph: LucideGlyph.circlePlay,
              onPressed: () => context.push(
                AppRoutes.buildMicroDrill(drill.drillId),
              ),
            )
          else
            SecondaryButton(
              label: isIran ? 'مشاهده تمرین‌های کوتاه' : 'Open Practice Drills',
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
}

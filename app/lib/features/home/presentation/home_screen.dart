import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/exams/exam_descriptor.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/features/home/presentation/home_providers.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/roadmap_route_resolver.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/personalization_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/brand_header.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/linguistic_cards.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/metric_hero.dart';
import 'package:mockza/theme/components/mz_bottom_sheet.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
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
    final l10n = AppLocalizations.of(context);
    final resumeRoute = state.resumeSpeakingRoute;
    final needsLevelCheck =
        state.estimatedSummary.overallBand == null &&
        (state.latestDiagnosticId == null ||
            state.latestDiagnosticStatus == 'in_progress');
    final diagnosticRoute = AppRoutes.buildDiagnosticIntro(
      examId: state.track.id,
    );

    // Delta pill display
    String? deltaText;
    if (state.estimatedSummary.changeThisMonth != null) {
      final delta = state.estimatedSummary.changeThisMonth!;
      final prefix = delta >= 0 ? '+' : '';
      final formattedDelta = state.track.usesIntegerDisplay
          ? delta.round().toString()
          : delta.toStringAsFixed(1);
      deltaText = '$prefix$formattedDelta this month';
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

    final edition = ref.watch(editionConfigProvider).edition;
    final isIran = edition == AppEdition.iran;
    final descriptor = ExamDescriptor.forTrack(state.track);
    final targetChipText = isIran
        ? 'هدف ${state.track.formatScore(state.targetBand)}'
        : 'Target ${state.track.formatScore(state.targetBand)}';
    final insights = state.estimatedSummary.overallBand != null
        ? descriptor.buildScoreInsights(
            overallScore: state.estimatedSummary.overallBand!,
            reading: readingScore,
            listening: listeningScore,
            writing: writingScore,
            speaking: speakingScore,
          )
        : const <({String label, String detail})>[];

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
                        Text(l10n.homeStudyRoom, style: typography.headline),
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          state.daysUntilExam != null
                              ? (isIran
                                    ? '${EdgeNumerals.formatChromeNumber(state.daysUntilExam!, edition)} روز تا تاریخ آزمون'
                                    : '${state.daysUntilExam} days until your exam')
                              : l10n.homeStudyRoomDescription,
                          style: typography.secondary.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    LtrExamBoundary(
                      useLatinFont: !isIran,
                      child: MzChip(
                        label: targetChipText,
                        variant: MzChipVariant.target,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: SpacingTokens.md),

                Wrap(
                  spacing: SpacingTokens.xs,
                  runSpacing: SpacingTokens.xs,
                  children: <Widget>[
                    MzChip(
                      label: l10n.navPractice,
                      isSelected: state.studyFocus != 'coach',
                      onTap: () => context.go(AppRoutes.practice),
                    ),
                    MzChip(
                      label: l10n.navSmartCoach,
                      isSelected: state.studyFocus == 'coach',
                      onTap: () => context.go(AppRoutes.coach),
                    ),
                  ],
                ),
                const SizedBox(height: SpacingTokens.sm),

                if (state.studyFocus == 'coach') ...<Widget>[
                  MissionProgressCard(
                    isRtl: isIran,
                    onStartMission: () =>
                        context.push(AppRoutes.buildDailyMission()),
                    onOpenRegisterShifter: () =>
                        context.push(AppRoutes.registerShifter),
                    onOpenDropAnything: () =>
                        context.push(AppRoutes.dropIngest),
                    onOpenCoachHub: () => context.go(AppRoutes.coach),
                  ),
                  const SizedBox(height: SpacingTokens.md),
                  RecommendationCard(
                    ctaLabel: resumeRoute != null
                        ? l10n.homeResumeAttempt
                        : needsLevelCheck
                        ? l10n.homeCheckLevel
                        : l10n.studyStart,
                    title: resumeRoute != null
                        ? l10n.speakingSimTitle
                        : needsLevelCheck
                        ? l10n.homeCheckLevel
                        : state.recommendedTitle,
                    subtitle: resumeRoute != null
                        ? l10n.homeResumeDescription
                        : needsLevelCheck
                        ? l10n.homeLevelCheckDescription
                        : state.recommendedSubtitle,
                    onTapStart: () => context.push(
                      resumeRoute ??
                          (needsLevelCheck
                              ? diagnosticRoute
                              : state.recommendedRoute),
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  SecondaryButton(
                    label: l10n.homePractiseSkill,
                    glyph: LucideGlyph.circlePlay,
                    onPressed: () => context.go(AppRoutes.practice),
                  ),
                ] else ...<Widget>[
                  RecommendationCard(
                    ctaLabel: resumeRoute != null
                        ? l10n.homeResumeAttempt
                        : needsLevelCheck
                        ? l10n.homeCheckLevel
                        : l10n.studyStart,
                    title: resumeRoute != null
                        ? l10n.speakingSimTitle
                        : needsLevelCheck
                        ? l10n.homeCheckLevel
                        : state.recommendedTitle,
                    subtitle: resumeRoute != null
                        ? l10n.homeResumeDescription
                        : needsLevelCheck
                        ? l10n.homeLevelCheckDescription
                        : state.recommendedSubtitle,
                    onTapStart: () => context.push(
                      resumeRoute ??
                          (needsLevelCheck
                              ? diagnosticRoute
                              : state.recommendedRoute),
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  SecondaryButton(
                    label: l10n.homePractiseSkill,
                    glyph: LucideGlyph.circlePlay,
                    onPressed: () => context.go(AppRoutes.practice),
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  SecondaryButton(
                    label: l10n.roadmapViewFullCta,
                    glyph: LucideGlyph.target,
                    onPressed: () => context.push(AppRoutes.roadmap),
                  ),
                  const SizedBox(height: SpacingTokens.md),
                  MissionProgressCard(
                    isRtl: isIran,
                    onStartMission: () =>
                        context.push(AppRoutes.buildDailyMission()),
                    onOpenRegisterShifter: () =>
                        context.push(AppRoutes.registerShifter),
                    onOpenDropAnything: () =>
                        context.push(AppRoutes.dropIngest),
                    onOpenCoachHub: () => context.go(AppRoutes.coach),
                  ),
                ],
                const SizedBox(height: SpacingTokens.lg),
                if (state.personalization != null) ...<Widget>[
                  _PersonalizationRoadmapCard(
                    personalization: state.personalization!,
                    isIran: isIran,
                    bandShiftDismissed: state.bandShiftDismissed,
                    onAckBandShift: () => unawaited(
                      ref.read(homeNotifierProvider.notifier).acknowledgeBandShift(),
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.lg),
                ],

                // Metric Hero Card
                MetricHero(
                  estimatedScore: state.estimatedSummary.overallBand,
                  targetScore: state.targetBand,
                  minScore: state.track.minScore,
                  maxScore: state.track.maxScore,
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
                if (insights.isNotEmpty) ...<Widget>[
                  const SizedBox(height: SpacingTokens.sm),
                  Wrap(
                    spacing: SpacingTokens.xs,
                    runSpacing: SpacingTokens.xs,
                    children: insights
                        .map(
                          (item) => MzChip(
                            label: '${item.label}: ${item.detail}',
                            isSelected: true,
                          ),
                        )
                        .toList(growable: false),
                  ),
                ],
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
                        minScore: state.track.minScore,
                        maxScore: state.track.maxScore,
                        onTap: () => context.push(
                          AppRoutes.buildSpeakingSim(descriptor.speakingPackId),
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
                        minScore: state.track.minScore,
                        maxScore: state.track.maxScore,
                        onTap: () => context.push(
                          AppRoutes.buildWritingSim(descriptor.writingPackId),
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
                        minScore: state.track.minScore,
                        maxScore: state.track.maxScore,
                        onTap: () => context.push(
                          AppRoutes.buildReadingSim(descriptor.readingPackId),
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
                        minScore: state.track.minScore,
                        maxScore: state.track.maxScore,
                        onTap: () => context.push(
                          AppRoutes.buildListeningSim(
                            descriptor.listeningPackId,
                          ),
                        ),
                      ),
                    ),
                  ],
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
          builder: (sheetCtx) => SingleChildScrollView(
            padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                for (final track in ExamTrack.values) ...<Widget>[
                  GestureDetector(
                    onTap: () {
                      ref.read(homeNotifierProvider.notifier).setTrack(track);
                      Navigator.of(sheetCtx).pop();
                    },
                    child: MzCard(
                      child: Row(
                        children: <Widget>[
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: <Widget>[
                                Text(
                                  track.displayName,
                                  style: typography.cardTitle,
                                ),
                                Text(
                                  ExamDescriptor.forTrack(track).subtitle,
                                  style: typography.caption.copyWith(
                                    color: colors.textSecondary,
                                  ),
                                ),
                              ],
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
      ),
    );
  }
}

class _PersonalizationRoadmapCard extends StatelessWidget {
  const new({
    required this.personalization,
    required this.isIran,
    required this.bandShiftDismissed,
    required this.onAckBandShift,
  });

  final PersonalizationStateDto personalization;
  final bool isIran;
  final bool bandShiftDismissed;
  final VoidCallback onAckBandShift;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);
    final step = personalization.currentStep;
    final confLabel = switch (personalization.liveBand.confidence) {
      BandConfidenceTier.calibrated => l10n.confidenceCalibrated,
      BandConfidenceTier.developing => l10n.confidenceDeveloping,
      BandConfidenceTier.provisional => l10n.confidenceProvisional,
    };
    final showBandUp =
        personalization.liveBand.bandShift >= 0.3 &&
        !personalization.bandShiftAcknowledged &&
        !bandShiftDismissed &&
        personalization.liveBand.currentBand != null;

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (showBandUp) ...<Widget>[
            Container(
              padding: const EdgeInsetsDirectional.all(SpacingTokens.sm),
              decoration: BoxDecoration(
                color: colors.mintBg,
                borderRadius: shapes.compactRadius,
                border: Border.all(color: colors.success),
              ),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          l10n.roadmapBandUpTitle(
                            personalization.liveBand.bandShift.toStringAsFixed(1),
                            personalization.liveBand.currentBand!.toStringAsFixed(1),
                          ),
                          style: typography.caption.copyWith(
                            color: colors.success,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          l10n.roadmapBandUpBody,
                          style: typography.caption.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: l10n.cancelAction,
                    onPressed: onAckBandShift,
                    icon: const AppIcon(LucideGlyph.x, size: 16),
                  ),
                ],
              ),
            ),
            const SizedBox(height: SpacingTokens.sm),
          ],
          Wrap(
            spacing: SpacingTokens.xs,
            runSpacing: SpacingTokens.xs,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: <Widget>[
              Text(
                l10n.roadmapTitle,
                style: typography.cardTitle.copyWith(color: colors.textPrimary),
              ),
              MzChip(label: confLabel),
            ],
          ),
          if (personalization.milestones.isNotEmpty) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            Wrap(
              spacing: SpacingTokens.xs,
              runSpacing: SpacingTokens.xs,
              children: personalization.milestones
                  .map(
                    (m) => MzChip(
                      label:
                          'M${m.index}${m.status == 'completed' ? ' ✓' : ''}',
                      isSelected: m.status == 'active',
                      variant: m.status == 'completed'
                          ? MzChipVariant.positive
                          : MzChipVariant.neutral,
                    ),
                  )
                  .toList(growable: false),
            ),
          ],
          if (personalization.weaknesses.isNotEmpty) ...<Widget>[
            const SizedBox(height: SpacingTokens.xs),
            Wrap(
              spacing: SpacingTokens.xs,
              runSpacing: SpacingTokens.xs,
              children: personalization.weaknesses
                  .take(2)
                  .map(
                    (w) => MzChip(
                      label: isIran ? w.displayLabelFa : w.displayLabelEn,
                    ),
                  )
                  .toList(growable: false),
            ),
          ],
          if (step != null) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            Text(
              isIran ? step.titleFa : step.titleEn,
              style: typography.body.copyWith(
                color: colors.primary,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: SpacingTokens.xs),
            Text(
              isIran ? step.reasonFa : step.reasonEn,
              style: typography.caption.copyWith(color: colors.textSecondary),
            ),
            const SizedBox(height: SpacingTokens.xs),
            Wrap(
              spacing: SpacingTokens.sm,
              runSpacing: SpacingTokens.xs,
              children: <Widget>[
                PrimaryButton(
                  label: l10n.studyStart,
                  glyph: LucideGlyph.arrowRight,
                  isFullWidth: false,
                  onPressed: () => context.push(
                    resolveFlutterRoadmapStepRoute(step),
                  ),
                ),
                SecondaryButton(
                  label: l10n.roadmapViewFullCta,
                  isFullWidth: false,
                  onPressed: () => context.push(AppRoutes.roadmap),
                ),
              ],
            ),
          ] else ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            SecondaryButton(
              label: l10n.roadmapViewFullCta,
              glyph: LucideGlyph.target,
              onPressed: () => context.push(AppRoutes.roadmap),
            ),
          ],
        ],
      ),
    );
  }
}

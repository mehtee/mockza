import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_help_sheet.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/diagnostic_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/status_banner.dart';
import 'package:mockza/theme/primitives.dart';

/// 4-skill provisional placement results & async status dashboard (`/diagnostic/results/:diagId`).
class DiagnosticResultsScreen extends ConsumerStatefulWidget {
  /// Creates a [DiagnosticResultsScreen].
  const new({
    required this.diagId,
    super.key,
  });

  /// Diagnostic session UUID.
  final String diagId;

  @override
  ConsumerState<DiagnosticResultsScreen> createState() =>
      _DiagnosticResultsScreenState();
}

class _DiagnosticResultsScreenState
    extends ConsumerState<DiagnosticResultsScreen> {
  static const List<DiagnosticExamScaleInfo> _defaultExamScales =
      <DiagnosticExamScaleInfo>[
        DiagnosticExamScaleInfo(
          examId: 'ielts_academic',
          label: 'IELTS (0–9 Bands)',
          summary: 'Reports four skill bands and an overall band in 0.5 increments. Full calibrated mocks measure exam-format stamina.',
        ),
        DiagnosticExamScaleInfo(
          examId: 'toefl',
          label: 'TOEFL iBT',
          summary: 'Measures Academic Reading, Listening, Speaking, and Writing across university-level tasks.',
        ),
        DiagnosticExamScaleInfo(
          examId: 'det',
          label: 'Duolingo English Test (10–160)',
          summary: 'Integrates adaptive short comprehension and production tasks on a 10–160 scale.',
        ),
        DiagnosticExamScaleInfo(
          examId: 'pte',
          label: 'PTE Academic (10–90)',
          summary: 'Evaluates communicative skills and enabling language traits on a 10–90 scale.',
        ),
      ];

  @override
  void initState() {
    super.initState();
    unawaited(
      Future<void>.microtask(() {
        if (!mounted) return;
        unawaited(
          ref
              .read(diagnosticNotifierProvider.notifier)
              .openResults(widget.diagId),
        );
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(diagnosticNotifierProvider);
    final notifier = ref.read(diagnosticNotifierProvider.notifier);
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final snapshot = state.sessionSnapshot;

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Home',
          onPressed: () => context.go(AppRoutes.home),
          icon: const AppIcon(LucideGlyph.x, size: 22),
        ),
        title: const Text('Starting Check Results'),
        actions: <Widget>[
          IconButton(
            tooltip: 'Refresh status',
            onPressed: notifier.refreshResults,
            icon: const AppIcon(LucideGlyph.refreshCw, size: 20),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsetsDirectional.fromSTEB(
            SpacingTokens.lg,
            SpacingTokens.md,
            SpacingTokens.lg,
            SpacingTokens.xxl,
          ),
          child: snapshot == null
              ? _LoadingSnapshotCard(
                  diagId: widget.diagId,
                  onRetry: notifier.refreshResults,
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    // Provisional disclaimer banner / hero
                    MzCard(
                      variant: MzCardVariant.hero,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            'Your Starting Practice Placement',
                            style: typography.sectionHeading,
                          ),
                          const SizedBox(height: SpacingTokens.xs),
                          Text(
                            'These provisional suggestions are based only on your short samples so we can tailor your first drills — never an official exam score.',
                            style: typography.secondary.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                          const SizedBox(height: SpacingTokens.sm),
                          Wrap(
                            spacing: SpacingTokens.xs,
                            runSpacing: SpacingTokens.xs,
                            children: <Widget>[
                              if (snapshot.mode == DiagnosticMode.extended)
                                const MzChip(
                                  label: 'Completed with extended help',
                                )
                              else if (snapshot.mode ==
                                  DiagnosticMode.accessible)
                                const MzChip(
                                  label: 'Accessible audio mode',
                                ),
                              if (snapshot.hasPendingWork)
                                MzChip(
                                  label: state.resultsRemainingSeconds > 0
                                      ? 'Checking Writing/Speaking (${state.resultsRemainingSeconds}s)'
                                      : 'Finishing in background',
                                  variant: MzChipVariant.target,
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.md),

                    if (snapshot.hasPendingWork &&
                        state.resultsRemainingSeconds <= 0 &&
                        state.isTimed) ...<Widget>[
                      StatusBanner(
                        message: 'Your Reading & Listening results are ready now. Writing or Speaking feedback is still finishing in the background — start practice anytime.',
                        variant: StatusBannerVariant.uploading,
                        actionLabel: 'Check now',
                        onTapAction: notifier.refreshResults,
                      ),
                      const SizedBox(height: SpacingTokens.md),
                    ],

                    // Recommended First Action
                    MzCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          Row(
                            children: <Widget>[
                              const IconWell(
                                glyph: LucideGlyph.sparkles,
                                tint: IconWellTint.blue,
                                size: 36,
                                iconSize: 18,
                              ),
                              const SizedBox(width: SpacingTokens.sm),
                              Expanded(
                                child: Text(
                                  snapshot.recommendedActionTitle,
                                  style: typography.cardTitle,
                                ),
                              ),
                            ],
                          ),
                          if (snapshot
                              .recommendedActionDescription
                              .isNotEmpty) ...<Widget>[
                            const SizedBox(height: SpacingTokens.sm),
                            Text(
                              snapshot.recommendedActionDescription,
                              style: typography.secondary.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                          ],
                          const SizedBox(height: SpacingTokens.md),
                          PrimaryButton(
                            label: 'Start Recommended Practice',
                            onPressed: () => context.go(
                              _routeForSkill(snapshot.recommendedTargetSkill),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.lg),

                    Text(
                      'Skill Breakdown',
                      style: typography.sectionHeading,
                    ),
                    const SizedBox(height: SpacingTokens.sm),

                    for (final outcome in <DiagnosticSkillOutcomeSnapshot>[
                      snapshot.reading,
                      snapshot.listening,
                      snapshot.writing,
                      snapshot.speaking,
                    ]) ...<Widget>[
                      _SkillOutcomeCard(
                        outcome: outcome,
                        onRetakeSkill: () async {
                          final router = GoRouter.of(context);
                          final id = await notifier.startSingleSkillRetake(
                            outcome.skill,
                          );
                          if (id != null) {
                            router.go(AppRoutes.buildDiagnosticSession(id));
                          }
                        },
                      ),
                      const SizedBox(height: SpacingTokens.md),
                    ],

                    SecondaryButton(
                      label: 'Continue to practice',
                      onPressed: () => context.go(AppRoutes.home),
                    ),
                    const SizedBox(height: SpacingTokens.sm),
                    TextButton(
                      onPressed: () {
                        unawaited(
                          showDiagnosticExamScaleSheet(
                            context,
                            examScales:
                                state.bank?.examScaleInfo ?? _defaultExamScales,
                            activeExamId: snapshot.examId,
                          ),
                        );
                      },
                      child: const Text("About Your Exam's Scores"),
                    ),
                  ],
                ),
        ),
      ),
    );
  }

  String _routeForSkill(String? skill) => switch (skill) {
    'listening' => AppRoutes.buildListeningSim(),
    'reading' => AppRoutes.buildReadingSim(),
    'writing' => AppRoutes.buildWritingSim(),
    'speaking' => AppRoutes.buildSpeakingSim(),
    _ => AppRoutes.practice,
  };
}

class _LoadingSnapshotCard extends StatelessWidget {
  const new({
    required this.diagId,
    required this.onRetry,
  });

  final String diagId;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const Center(child: CircularProgressIndicator()),
          const SizedBox(height: SpacingTokens.md),
          Text(
            'Loading your starting check...',
            textAlign: TextAlign.center,
            style: typography.cardTitle,
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            'Session ID: $diagId',
            textAlign: TextAlign.center,
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.md),
          SecondaryButton(
            label: 'Refresh status',
            onPressed: onRetry,
          ),
          const SizedBox(height: SpacingTokens.sm),
          TextButton(
            onPressed: () => context.go(AppRoutes.home),
            child: const Text('Back to Home'),
          ),
        ],
      ),
    );
  }
}

class _SkillOutcomeCard extends StatelessWidget {
  const new({
    required this.outcome,
    required this.onRetakeSkill,
  });

  final DiagnosticSkillOutcomeSnapshot outcome;
  final VoidCallback onRetakeSkill;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    final (
      String title,
      LucideGlyph glyph,
      IconWellTint tint,
    ) = switch (outcome.skill) {
      'reading' => ('Reading', LucideGlyph.bookOpen, IconWellTint.mint),
      'listening' => ('Listening', LucideGlyph.headphones, IconWellTint.blue),
      'writing' => ('Writing', LucideGlyph.pencil, IconWellTint.violet),
      _ => ('Speaking', LucideGlyph.mic, IconWellTint.blue),
    };

    final (
      String statusLabel,
      MzChipVariant chipVariant,
    ) = switch (outcome.status) {
      DiagnosticSkillStatus.provisional => (
        outcome.suggestedPracticeLevel ?? 'Provisional placement',
        MzChipVariant.positive,
      ),
      DiagnosticSkillStatus.pending => (
        'Checking your response...',
        MzChipVariant.target,
      ),
      DiagnosticSkillStatus.insufficientEvidence => (
        'Not enough evidence yet',
        MzChipVariant.neutral,
      ),
      DiagnosticSkillStatus.unscorable => (
        'Audio/response unclear',
        MzChipVariant.neutral,
      ),
      DiagnosticSkillStatus.failed => (
        'Evaluation unavailable',
        MzChipVariant.neutral,
      ),
      DiagnosticSkillStatus.skipped => (
        'Skipped',
        MzChipVariant.neutral,
      ),
    };

    final showRetake = outcome.status != DiagnosticSkillStatus.pending;

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              IconWell(glyph: glyph, tint: tint, size: 36, iconSize: 18),
              const SizedBox(width: SpacingTokens.sm),
              Expanded(child: Text(title, style: typography.cardTitle)),
              if (outcome.quotaRefunded)
                const MzChip(
                  label: 'Credit refunded',
                  variant: MzChipVariant.positive,
                ),
            ],
          ),
          const SizedBox(height: SpacingTokens.sm),
          MzChip(label: statusLabel, variant: chipVariant),
          if (outcome.reducedSampling ||
              outcome.hasContradictoryEvidence) ...<Widget>[
            const SizedBox(height: SpacingTokens.xs),
            Text(
              [
                if (outcome.reducedSampling) 'Limited sample collected',
                if (outcome.hasContradictoryEvidence)
                  'Mixed item performance observed',
              ].join(' · '),
              style: typography.caption.copyWith(color: colors.textSecondary),
            ),
          ],
          if (outcome.observations.isNotEmpty) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            for (final obs in outcome.observations)
              Padding(
                padding: const EdgeInsetsDirectional.only(
                  bottom: SpacingTokens.xs / 2,
                ),
                child: Text(
                  '• $obs',
                  style: typography.secondary.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ),
          ],
          if (showRetake) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton(
                onPressed: onRetakeSkill,
                child: const Text('Check this skill again'),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

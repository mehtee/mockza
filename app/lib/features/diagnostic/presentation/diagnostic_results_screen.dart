import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/localization/edition_copy.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_help_sheet.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_providers.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/roadmap_route_resolver.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/diagnostic_gateway.dart';
import 'package:mockza/services/personalization_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/mz_sticky_bottom_bar.dart';
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
  PersonalizationStateDto? _personalization;

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

  static const List<DiagnosticExamScaleInfo> _defaultExamScalesFa =
      <DiagnosticExamScaleInfo>[
        DiagnosticExamScaleInfo(
          examId: 'ielts_academic',
          label: 'آیلتس (باند ۰ تا ۹)',
          summary: 'چهار مهارت و نمره کل را با گام‌های ۰.۵ گزارش می‌دهد. آزمون‌های شبیه‌ساز کامل استقامت شما در شرایط آزمون را می‌سنجند.',
        ),
        DiagnosticExamScaleInfo(
          examId: 'toefl_ibt',
          label: 'تافل iBT',
          summary: 'مهارت‌های ریدینگ، لیسنینگ، اسپیکینگ و رایتینگ آکادمیک را در تسک‌های دانشگاهی می‌سنجد.',
        ),
        DiagnosticExamScaleInfo(
          examId: 'det',
          label: 'آزمون دولینگو DET (۱۰ تا ۱۶۰)',
          summary: 'درک مطلب و تولید زبان را به‌صورت تطبیقی در بازه ۱۰ تا ۱۶۰ ارزیابی می‌کند.',
        ),
        DiagnosticExamScaleInfo(
          examId: 'pte_academic',
          label: 'آزمون PTE Academic (۱۰ تا ۹۰)',
          summary: 'مهارت‌های ارتباطی و توانایی‌های زبانی را در بازه ۱۰ تا ۹۰ نمره‌گذاری می‌کند.',
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
        unawaited(_loadPersonalization());
      }),
    );
  }

  Future<void> _loadPersonalization() async {
    try {
      final repo = ref.read(personalizationRepositoryProvider);
      final cached = await repo.getCachedState();
      if (mounted && cached != null) {
        setState(() => _personalization = cached);
      }
      final remote = await ref.read(personalizationGatewayProvider).getState();
      final fresh = remote.valueOrNull;
      if (fresh != null) {
        await repo.cacheState(fresh);
        if (mounted) setState(() => _personalization = fresh);
      }
    } on Object {
      // Offline fallback.
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(diagnosticNotifierProvider);
    final notifier = ref.read(diagnosticNotifierProvider.notifier);
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final snapshot = state.sessionSnapshot;
    final edition = ref.watch(editionConfigProvider).edition;
    final isIran =
        edition == AppEdition.iran ||
        Localizations.localeOf(context).languageCode == 'fa';

    final localizedAction = snapshot == null
        ? null
        : EditionCopy.localizeDiagnosticAction(
            snapshot.recommendedActionTitle,
            snapshot.recommendedActionDescription,
            isIran: isIran,
          );

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: isIran ? 'خانه' : 'Home',
          onPressed: () => context.go(AppRoutes.home),
          icon: const AppIcon(LucideGlyph.x, size: 22),
        ),
        title: Text(isIran ? 'نتیجه ارزیابی اولیه' : 'Starting Check Results'),
        actions: <Widget>[
          IconButton(
            tooltip: isIran ? 'به‌روزرسانی وضعیت' : 'Refresh status',
            onPressed: notifier.refreshResults,
            icon: const AppIcon(LucideGlyph.refreshCw, size: 20),
          ),
        ],
      ),
      bottomBar: snapshot == null
          ? null
          : MzStickyBottomBar(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  PrimaryButton(
                    label: isIran
                        ? 'شروع تمرین پیشنهادی'
                        : 'Start Recommended Practice',
                    onPressed: () => context.go(
                      _routeForSkill(snapshot.recommendedTargetSkill),
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: SpacingTokens.sm,
                    runSpacing: SpacingTokens.xs,
                    children: <Widget>[
                      TextButton(
                        onPressed: () => context.push(AppRoutes.roadmap),
                        child: Text(
                          Localizations.of<AppLocalizations>(
                                context,
                                AppLocalizations,
                              )?.roadmapViewFullCta ??
                              (isIran
                                  ? 'مشاهده نقشه راه کامل'
                                  : 'View Full Roadmap'),
                        ),
                      ),
                      TextButton(
                        onPressed: () => context.go(AppRoutes.home),
                        child: Text(
                          isIran ? 'بازگشت به خانه' : 'Continue Home',
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
      body: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.symmetric(
          vertical: SpacingTokens.md,
        ),
        child: snapshot == null
            ? _LoadingSnapshotCard(
                diagId: widget.diagId,
                isIran: isIran,
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
                          isIran
                              ? 'سطح پیشنهادی شروع تمرین شما'
                              : 'Your Starting Practice Placement',
                          style: typography.sectionHeading,
                        ),
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          isIran
                              ? 'این پیشنهادهای اولیه فقط بر اساس نمونه‌های کوتاه شما ساخته شده‌اند تا تمرین‌های نخست متناسب‌تر شوند — و نمره رسمی آزمون محسوب نمی‌شوند.'
                              : 'These provisional suggestions are based only on your short samples so we can tailor your first drills — never an official exam score.',
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
                              MzChip(
                                label: isIran
                                    ? 'تکمیل‌شده با زمان بیشتر'
                                    : 'Completed with extended help',
                              )
                            else if (snapshot.mode == DiagnosticMode.accessible)
                              MzChip(
                                label: isIran
                                    ? 'حالت صوتی دسترس‌پذیر'
                                    : 'Accessible audio mode',
                              ),
                            if (snapshot.hasPendingWork)
                              MzChip(
                                label: state.resultsRemainingSeconds > 0
                                    ? (isIran
                                          ? 'در حال بررسی رایتینگ/اسپیکینگ (${EdgeNumerals.toPersianDigits(state.resultsRemainingSeconds)} ثانیه)'
                                          : 'Checking Writing/Speaking (${state.resultsRemainingSeconds}s)')
                                    : (isIran
                                          ? 'در حال تکمیل در پس‌زمینه'
                                          : 'Finishing in background'),
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
                      message: isIran
                          ? 'نتیجه ریدینگ و لیسنینگ شما آماده است. تحلیل رایتینگ یا اسپیکینگ همچنان در پس‌زمینه در حال تکمیل است — هر زمان خواستید تمرین را شروع کنید.'
                          : 'Your Reading & Listening results are ready now. Writing or Speaking feedback is still finishing in the background — start practice anytime.',
                      variant: StatusBannerVariant.uploading,
                      actionLabel: isIran ? 'بررسی مجدد' : 'Check now',
                      onTapAction: notifier.refreshResults,
                    ),
                    const SizedBox(height: SpacingTokens.md),
                  ],

                  // Recommended First Action + Adaptive Roadmap Preview
                  if (_personalization != null) ...<Widget>[
                    MzCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          Wrap(
                            alignment: WrapAlignment.spaceBetween,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            spacing: SpacingTokens.sm,
                            children: <Widget>[
                              Text(
                                Localizations.of<AppLocalizations>(
                                      context,
                                      AppLocalizations,
                                    )?.liveBandTitle ??
                                    (isIran
                                        ? 'باند تخمینی زنده'
                                        : 'Live Estimated Band'),
                                style: typography.secondary.copyWith(
                                  color: colors.textSecondary,
                                ),
                              ),
                              Text(
                                () {
                                  final cur =
                                      _personalization!.liveBand.currentBand !=
                                          null
                                      ? _personalization!.liveBand.currentBand!
                                            .toStringAsFixed(1)
                                      : '--';
                                  final tgt = _personalization!.targetBand
                                      .toStringAsFixed(1);
                                  return isIran
                                      ? '${EdgeNumerals.toPersianDigits(cur)} → ${EdgeNumerals.toPersianDigits(tgt)}'
                                      : '$cur → $tgt';
                                }(),
                                style: typography.cardScore.copyWith(
                                  color: colors.primary,
                                ),
                              ),
                            ],
                          ),
                          if (_personalization!
                              .weaknesses
                              .isNotEmpty) ...<Widget>[
                            const SizedBox(height: SpacingTokens.sm),
                            Wrap(
                              spacing: SpacingTokens.xs,
                              runSpacing: SpacingTokens.xs,
                              children: _personalization!.weaknesses
                                  .take(2)
                                  .map(
                                    (w) => MzChip(
                                      label: isIran
                                          ? w.displayLabelFa
                                          : w.displayLabelEn,
                                    ),
                                  )
                                  .toList(growable: false),
                            ),
                          ],
                          if (_personalization!
                              .milestones
                              .isNotEmpty) ...<Widget>[
                            const SizedBox(height: SpacingTokens.sm),
                            Wrap(
                              spacing: SpacingTokens.xs,
                              children: _personalization!.milestones
                                  .map(
                                    (m) => MzChip(
                                      label: EditionCopy.milestoneChipLabel(
                                        m.index,
                                        isIran: isIran,
                                        completed: m.status == 'completed',
                                      ),
                                      isSelected: m.status == 'active',
                                    ),
                                  )
                                  .toList(growable: false),
                            ),
                          ],
                          if (_personalization!.currentStep !=
                              null) ...<Widget>[
                            const SizedBox(height: SpacingTokens.sm),
                            PrimaryButton(
                              label:
                                  Localizations.of<AppLocalizations>(
                                    context,
                                    AppLocalizations,
                                  )?.diagStartStepCta ??
                                  (isIran
                                      ? 'شروع گام اول در نقشه راه'
                                      : 'Start Step 1 on Your Roadmap'),
                              glyph: isIran
                                  ? LucideGlyph.arrowLeft
                                  : LucideGlyph.arrowRight,
                              onPressed: () => context.go(
                                resolveFlutterRoadmapStepRoute(
                                  _personalization!.currentStep!,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: SpacingTokens.md),
                  ],
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
                                localizedAction?.title ??
                                    snapshot.recommendedActionTitle,
                                style: typography.cardTitle,
                              ),
                            ),
                          ],
                        ),
                        if ((localizedAction?.description ??
                                snapshot.recommendedActionDescription)
                            .isNotEmpty) ...<Widget>[
                          const SizedBox(height: SpacingTokens.xs),
                          Text(
                            localizedAction?.description ??
                                snapshot.recommendedActionDescription,
                            style: typography.secondary.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.lg),

                  Text(
                    isIran ? 'تحلیل مهارت‌ها' : 'Skill Breakdown',
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
                      isIran: isIran,
                      onRetakeSkill: () async {
                        final router = GoRouter.of(context);
                        final id = await notifier.startSingleSkillRetake(
                          outcome.skill,
                        );
                        if (!mounted) return;
                        if (id != null) {
                          router.go(AppRoutes.buildDiagnosticSession(id));
                        }
                      },
                    ),
                    const SizedBox(height: SpacingTokens.md),
                  ],

                  TextButton(
                    onPressed: () {
                      final fallbackScales = isIran
                          ? _defaultExamScalesFa
                          : _defaultExamScales;
                      unawaited(
                        showDiagnosticExamScaleSheet(
                          context,
                          examScales: isIran
                              ? fallbackScales
                              : (state.bank?.examScaleInfo ?? fallbackScales),
                          activeExamId: snapshot.examId,
                        ),
                      );
                    },
                    child: Text(
                      isIran
                          ? 'درباره مقیاس نمرات آزمون‌ها'
                          : "About Your Exam's Scores",
                    ),
                  ),
                ],
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
    required this.isIran,
    required this.onRetry,
  });

  final String diagId;
  final bool isIran;
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
            isIran
                ? 'در حال بارگذاری نتیجه ارزیابی اولیه...'
                : 'Loading your starting check...',
            textAlign: TextAlign.center,
            style: typography.cardTitle,
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            isIran ? 'شناسه جلسه: $diagId' : 'Session ID: $diagId',
            textAlign: TextAlign.center,
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.md),
          SecondaryButton(
            label: isIran ? 'به‌روزرسانی وضعیت' : 'Refresh status',
            onPressed: onRetry,
          ),
          const SizedBox(height: SpacingTokens.sm),
          TextButton(
            onPressed: () => context.go(AppRoutes.home),
            child: Text(isIran ? 'بازگشت به خانه' : 'Back to Home'),
          ),
        ],
      ),
    );
  }
}

class _SkillOutcomeCard extends StatelessWidget {
  const new({
    required this.outcome,
    required this.isIran,
    required this.onRetakeSkill,
  });

  final DiagnosticSkillOutcomeSnapshot outcome;
  final bool isIran;
  final VoidCallback onRetakeSkill;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    final (LucideGlyph glyph, IconWellTint tint) = switch (outcome.skill) {
      'reading' => (LucideGlyph.bookOpen, IconWellTint.mint),
      'listening' => (LucideGlyph.headphones, IconWellTint.blue),
      'writing' => (LucideGlyph.pencil, IconWellTint.violet),
      _ => (LucideGlyph.mic, IconWellTint.blue),
    };
    final title = EditionCopy.skillName(outcome.skill, isIran: isIran);

    final (
      String statusLabel,
      MzChipVariant chipVariant,
    ) = switch (outcome.status) {
      DiagnosticSkillStatus.provisional => (
        outcome.suggestedPracticeLevel != null
            ? EditionCopy.localizeDiagnosticLevel(
                outcome.suggestedPracticeLevel!,
                isIran: isIran,
              )
            : (isIran ? 'تعیین سطح اولیه' : 'Provisional placement'),
        MzChipVariant.positive,
      ),
      DiagnosticSkillStatus.pending => (
        isIran ? 'در حال بررسی پاسخ شما...' : 'Checking your response...',
        MzChipVariant.target,
      ),
      DiagnosticSkillStatus.insufficientEvidence => (
        isIran ? 'شواهد کافی وجود ندارد' : 'Not enough evidence yet',
        MzChipVariant.neutral,
      ),
      DiagnosticSkillStatus.unscorable => (
        isIran ? 'صدا یا پاسخ نامشخص بود' : 'Audio/response unclear',
        MzChipVariant.neutral,
      ),
      DiagnosticSkillStatus.failed => (
        isIran ? 'ارزیابی در دسترس نیست' : 'Evaluation unavailable',
        MzChipVariant.neutral,
      ),
      DiagnosticSkillStatus.skipped => (
        isIran ? 'رد شده' : 'Skipped',
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
                MzChip(
                  label: isIran ? 'اعتبار بازگشت خورد' : 'Credit refunded',
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
                if (outcome.reducedSampling && isIran)
                  'نمونه محدود جمع‌آوری شد'
                else if (outcome.reducedSampling)
                  'Limited sample collected',
                if (outcome.hasContradictoryEvidence && isIran)
                  'عملکرد ترکیبی در پرسش‌ها مشاهده شد'
                else if (outcome.hasContradictoryEvidence)
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
                  '• ${EditionCopy.localizeDiagnosticObservation(obs, isIran: isIran)}',
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
                child: Text(
                  isIran ? 'بررسی مجدد این مهارت' : 'Check this skill again',
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

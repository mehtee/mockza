import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/exams/exam_descriptor.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/localization/edition_copy.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/data/repositories/exam_catalog_repository.dart';
import 'package:mockza/features/practice_hub/presentation/practice_hub_providers.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/personalization_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_motion.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mz_bottom_sheet.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/task_card.dart';
import 'package:mockza/theme/primitives.dart';

/// Practice Hub test catalog and simulator launcher screen (Screens 02 & 03).
class PracticeHubScreen extends ConsumerStatefulWidget {
  /// Creates a [PracticeHubScreen].
  const new({super.key});

  @override
  ConsumerState<PracticeHubScreen> createState() => _PracticeHubScreenState();
}

class _PracticeHubScreenState extends ConsumerState<PracticeHubScreen> {
  bool _isExamMode = true;
  bool _forYourPathOnly = true;
  PersonalizationStateDto? _personalization;

  @override
  void initState() {
    super.initState();
    unawaited(_loadPersonalization());
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
      // Offline safe.
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(practiceHubNotifierProvider);
    final notifier = ref.read(practiceHubNotifierProvider.notifier);
    final packsAsync = ref.watch(installedExamPacksProvider);
    final drillsAsync = ref.watch(drillsCatalogProvider);
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);
    final l10n = AppLocalizations.of(context);
    final isFa =
        Localizations.localeOf(context).languageCode == 'fa' ||
        ref.watch(editionConfigProvider).edition == AppEdition.iran;

    final allPacks = packsAsync.asData?.value ?? const <InstalledExamPack>[];
    final profile = ref.watch(practiceProfileProvider).asData?.value;
    final activeTrack = state.selectedTrack == 'all'
        ? ExamTrack.fromId(profile?.examId ?? 'ielts_academic')
        : ExamTrack.fromId(state.selectedTrack);
    final descriptor = ExamDescriptor.forTrack(activeTrack);
    final filteredPacks = allPacks
        .where((pack) {
          if (state.selectedSkill != null &&
              pack.skill != state.selectedSkill) {
            return false;
          }
          if (state.selectedTrack != 'all' &&
              pack.track != state.selectedTrack &&
              pack.track != 'shared') {
            return false;
          }
          return true;
        })
        .toList(growable: false);

    final rawDrills = state.selectedSkill == null
        ? (drillsAsync.asData?.value ?? const <MicroDrillSpec>[])
        : const <MicroDrillSpec>[];
    final trackMatchedDrills = rawDrills
        .where((d) => EditionCopy.matchesDrillTrack(d.drillId, activeTrack))
        .toList(growable: false);
    final drills =
        (trackMatchedDrills.isNotEmpty || state.selectedTrack != 'all')
        ? trackMatchedDrills
        : rawDrills;

    return MzScaffold(
      body: Column(
        children: <Widget>[
          Padding(
            padding: const EdgeInsetsDirectional.symmetric(
              vertical: SpacingTokens.sm,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(l10n.practiceHubTitle, style: typography.headline),
                      const SizedBox(height: SpacingTokens.xs),
                      Text(
                        l10n.practiceHubSubtitle,
                        style: typography.secondary.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: isFa ? 'به‌روزرسانی کاتالوگ' : 'Sync Catalog',
                  icon: AppIcon(
                    state.isSyncingCatalog
                        ? LucideGlyph.loaderCircle
                        : LucideGlyph.refreshCw,
                    size: 20,
                  ),
                  onPressed: state.isSyncingCatalog
                      ? null
                      : notifier.refreshCatalog,
                ),
                IconButton(
                  tooltip: l10n.settingsTitle,
                  icon: const AppIcon(LucideGlyph.settings, size: 20),
                  onPressed: () => context.push(AppRoutes.settings),
                ),
              ],
            ),
          ),
          if (state.statusMessage != null)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: Text(
                state.statusMessage!,
                style: typography.caption.copyWith(color: colors.primary),
              ),
            ),
          Expanded(
            child: ListView(
              padding: const EdgeInsetsDirectional.symmetric(
                vertical: SpacingTokens.sm,
              ),
              children: <Widget>[
                // Mode Segmented Switch (Study vs Exam)
                Container(
                  padding: const EdgeInsetsDirectional.all(3),
                  decoration: BoxDecoration(
                    color: colors.surfaceAlt,
                    borderRadius: shapes.pillRadius,
                    border: Border.all(color: colors.borderSubtle),
                  ),
                  child: Row(
                    children: <Widget>[
                      Expanded(
                        child: _ModeTogglePill(
                          label: l10n.practiceModeExam,
                          subtitle: isFa ? 'زمان‌دار' : 'Timed',
                          isSelected: _isExamMode,
                          onTap: () => setState(() => _isExamMode = true),
                        ),
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      Expanded(
                        child: _ModeTogglePill(
                          label: l10n.practiceModeStudy,
                          subtitle: isFa
                              ? 'بدون زمان + راهنما'
                              : 'Untimed & hints',
                          isSelected: !_isExamMode,
                          onTap: () => setState(() => _isExamMode = false),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: SpacingTokens.md),

                // Skill Filter Chips Strip
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: <Widget>[
                      _FilterChip(
                        label: isFa ? 'همه' : 'All',
                        isSelected: state.selectedSkill == null,
                        onTap: () => notifier.setFilter(null),
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      _FilterChip(
                        label: EditionCopy.skillName('speaking', isIran: isFa),
                        isSelected: state.selectedSkill == SkillKind.speaking,
                        onTap: () => notifier.setFilter(SkillKind.speaking),
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      _FilterChip(
                        label: EditionCopy.skillName('writing', isIran: isFa),
                        isSelected: state.selectedSkill == SkillKind.writing,
                        onTap: () => notifier.setFilter(SkillKind.writing),
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      _FilterChip(
                        label: EditionCopy.skillName('reading', isIran: isFa),
                        isSelected: state.selectedSkill == SkillKind.reading,
                        onTap: () => notifier.setFilter(SkillKind.reading),
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      _FilterChip(
                        label: EditionCopy.skillName('listening', isIran: isFa),
                        isSelected: state.selectedSkill == SkillKind.listening,
                        onTap: () => notifier.setFilter(SkillKind.listening),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: SpacingTokens.md),
                SecondaryButton(
                  label: l10n.roadmapViewFullCta,
                  glyph: LucideGlyph.target,
                  onPressed: () => context.push(AppRoutes.roadmap),
                ),
                const SizedBox(height: SpacingTokens.md),

                // Core Skill Simulators Quick-Launch
                if (state.selectedSkill == null ||
                    state.selectedSkill == SkillKind.speaking)
                  TaskCard(
                    title: isFa ? 'شبیه‌ساز اسپیکینگ' : 'Speaking Simulator',
                    subtitle: isFa
                        ? '${activeTrack.shortName} · ارزیابی هوشمند اسپیکینگ'
                        : '${activeTrack.shortName} · Speaking Evaluation',
                    glyph: LucideGlyph.mic,
                    tint: IconWellTint.blue,
                    durationText: _isExamMode
                        ? (isFa ? 'زمان‌دار' : 'Timed')
                        : (isFa ? 'بدون محدودیت' : 'Untimed'),
                    questionsText: isFa
                        ? '${EdgeNumerals.toPersianDigits(activeTrack == ExamTrack.toeflIbt ? 2 : 3)} بخش'
                        : (activeTrack == ExamTrack.toeflIbt
                              ? '2 Parts'
                              : '3 Parts'),
                    onTap: () => context.push(
                      AppRoutes.buildSpeakingSim(
                        descriptor.speakingPackId,
                        _isExamMode,
                      ),
                    ),
                  ),
                if (state.selectedSkill == null ||
                    state.selectedSkill == SkillKind.writing)
                  TaskCard(
                    title: isFa ? 'شبیه‌ساز رایتینگ' : 'Writing Simulator',
                    subtitle: isFa
                        ? '${activeTrack.shortName} · ارزیابی هوشمند بر اساس معیار آزمون'
                        : '${activeTrack.shortName} · AI Rubric Evaluator',
                    glyph: LucideGlyph.pencil,
                    tint: IconWellTint.violet,
                    durationText: _isExamMode
                        ? (isFa ? 'زمان‌دار' : 'Timed')
                        : (isFa ? 'بدون محدودیت' : 'Untimed'),
                    questionsText: isFa
                        ? '${EdgeNumerals.toPersianDigits(descriptor.writingTasks.length)} تسک'
                        : '${descriptor.writingTasks.length} Tasks',
                    onTap: () => context.push(
                      AppRoutes.buildWritingSim(
                        descriptor.writingPackId,
                        _isExamMode,
                      ),
                    ),
                  ),
                if (state.selectedSkill == null ||
                    state.selectedSkill == SkillKind.reading)
                  TaskCard(
                    title: isFa ? 'شبیه‌ساز ریدینگ' : 'Reading Simulator',
                    subtitle: isFa
                        ? '${activeTrack.shortName} · هایلایت متن و نمره فوری'
                        : '${activeTrack.shortName} · Highlighting & Instant Score',
                    glyph: LucideGlyph.bookOpen,
                    tint: IconWellTint.mint,
                    durationText: _isExamMode
                        ? (isFa ? 'زمان‌دار' : 'Timed')
                        : (isFa ? 'بدون محدودیت' : 'Untimed'),
                    questionsText: isFa ? 'ریدینگ' : 'Reading',
                    onTap: () => context.push(
                      AppRoutes.buildReadingSim(
                        descriptor.readingPackId,
                        _isExamMode,
                      ),
                    ),
                  ),
                if (state.selectedSkill == null ||
                    state.selectedSkill == SkillKind.listening)
                  TaskCard(
                    title: isFa ? 'شبیه‌ساز لیسنینگ' : 'Listening Simulator',
                    subtitle: isFa
                        ? '${activeTrack.shortName} · فایل صوتی و متن پیاده‌شده'
                        : '${activeTrack.shortName} · Audio Track & Transcript',
                    glyph: LucideGlyph.headphones,
                    tint: IconWellTint.blue,
                    durationText: _isExamMode
                        ? (isFa ? 'زمان‌دار' : 'Timed')
                        : (isFa ? 'حالت تمرینی' : 'Study Mode'),
                    questionsText: isFa ? 'لیسنینگ' : 'Listening',
                    onTap: () => context.push(
                      AppRoutes.buildListeningSim(
                        descriptor.listeningPackId,
                        _isExamMode,
                      ),
                    ),
                  ),
                if (state.selectedSkill != null)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(
                      bottom: SpacingTokens.md,
                    ),
                    child: SecondaryButton(
                      label: isFa
                          ? 'مشاهده و تنظیم بسته‌های ${EditionCopy.skillName(state.selectedSkill!.name, isIran: true)}'
                          : 'Browse & Configure ${state.selectedSkill!.name.toUpperCase()} Packs',
                      onPressed: () => context.push(
                        AppRoutes.buildPracticeSetup(
                          state.selectedSkill!.name,
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: SpacingTokens.sm),

                // Quick 4-Skill Check & Full Mock Planner
                if (state.selectedSkill == null) ...<Widget>[
                  TaskCard(
                    title: isFa
                        ? 'ارزیابی سریع ۴ مهارته'
                        : 'Quick 4-Skill Starting Check',
                    subtitle: isFa
                        ? 'ارزیابی کوتاه و تطبیقی برای تنظیم سطح شروع تمرین شما.'
                        : 'Short adaptive check to calibrate your starting practice tier.',
                    glyph: LucideGlyph.sparkles,
                    tint: IconWellTint.blue,
                    durationText: isFa ? 'حدود ۱۰ تا ۱۵ دقیقه' : '~10–15 min',
                    questionsText: isFa ? '۴ مهارت' : '4 Skills',
                    onTap: () => context.push(
                      AppRoutes.buildDiagnosticIntro(examId: activeTrack.id),
                    ),
                  ),
                  MzCard(
                    variant: MzCardVariant.hero,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Row(
                          children: <Widget>[
                            const IconWell(
                              glyph: LucideGlyph.target,
                              tint: IconWellTint.blue,
                            ),
                            const SizedBox(width: SpacingTokens.sm),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: <Widget>[
                                  Text(
                                    isFa
                                        ? (activeTrack == ExamTrack.ieltsGeneral
                                              ? 'آزمون آزمایشی کامل آیلتس جنرال'
                                              : activeTrack ==
                                                    ExamTrack.ieltsAcademic
                                              ? 'آزمون آزمایشی کامل آیلتس آکادمیک'
                                              : 'آزمون آزمایشی کامل ${activeTrack.displayName}')
                                        : (activeTrack == ExamTrack.ieltsGeneral
                                              ? 'Full IELTS General Training Mock'
                                              : activeTrack ==
                                                    ExamTrack.ieltsAcademic
                                              ? 'Full IELTS Academic Mock Exam'
                                              : 'Full ${activeTrack.displayName} Mock Exam'),
                                    style: typography.cardTitle,
                                  ),
                                  const SizedBox(height: SpacingTokens.xs),
                                  Text(
                                    isFa
                                        ? 'هر ۴ مهارت • لیسنینگ، ریدینگ، رایتینگ و اسپیکینگ'
                                        : 'All 4 skills • Listening, Reading, Writing & Speaking',
                                    style: typography.secondary.copyWith(
                                      color: colors.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: SpacingTokens.md),
                        PrimaryButton(
                          label: isFa
                              ? 'باز کردن برنامه‌ریز آزمون کامل'
                              : 'Open Full Mock Planner',
                          onPressed: () => context.push(
                            AppRoutes.buildPracticeFullMock(
                              activeTrack == ExamTrack.ieltsGeneral
                                  ? 'mock-gt-01'
                                  : activeTrack == ExamTrack.ieltsAcademic
                                  ? 'mock-acad-01'
                                  : 'mock-${activeTrack.catalogTrack}-01',
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.lg),
                ],

                // Live Catalog Packs from Postgres
                if (packsAsync.isLoading && allPacks.isEmpty)
                  const Padding(
                    padding: EdgeInsetsDirectional.all(SpacingTokens.lg),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (filteredPacks.isEmpty)
                  MzCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(
                          isFa
                              ? (allPacks.isEmpty
                                    ? 'کاتالوگ هنوز همگام‌سازی نشده است'
                                    : 'بسته‌ای با این فیلتر یافت نشد')
                              : (allPacks.isEmpty
                                    ? 'Catalog not synced yet'
                                    : 'No packs match this filter'),
                          style: typography.cardTitle,
                        ),
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          isFa
                              ? (allPacks.isEmpty
                                    ? 'برای دریافت آزمون‌ها و بسته‌های صوتی به سرور متصل شوید.'
                                    : 'فیلتر مهارت یا آزمون را تغییر دهید تا بسته‌های موجود نمایش داده شوند.')
                              : (allPacks.isEmpty
                                    ? 'Connect to Mockza API to fetch exams and audio/chart packs.'
                                    : 'Switch skill or track filters to see available packs.'),
                          style: typography.secondary.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                        if (allPacks.isEmpty) ...<Widget>[
                          const SizedBox(height: SpacingTokens.md),
                          SecondaryButton(
                            label: isFa
                                ? (state.isSyncingCatalog
                                      ? 'در حال همگام‌سازی...'
                                      : 'همگام‌سازی کاتالوگ')
                                : (state.isSyncingCatalog
                                      ? 'Syncing...'
                                      : 'Sync Catalog Now'),
                            onPressed: state.isSyncingCatalog
                                ? null
                                : notifier.refreshCatalog,
                          ),
                        ],
                      ],
                    ),
                  )
                else ...<Widget>[
                  if ((_personalization?.recommendedPacks ??
                          const <RecommendedItemDto>[])
                      .isNotEmpty) ...<Widget>[
                    Wrap(
                      spacing: SpacingTokens.xs,
                      children: <Widget>[
                        ChoiceChip(
                          label: Text(l10n.practiceTabForYourPath),
                          selected: _forYourPathOnly,
                          onSelected: (_) =>
                              setState(() => _forYourPathOnly = true),
                        ),
                        ChoiceChip(
                          label: Text(l10n.practiceTabAllTests),
                          selected: !_forYourPathOnly,
                          onSelected: (_) =>
                              setState(() => _forYourPathOnly = false),
                        ),
                      ],
                    ),
                    const SizedBox(height: SpacingTokens.sm),
                  ],
                  ...(() {
                    final recIds =
                        _personalization?.recommendedPacks
                            .map((r) => r.id)
                            .toSet() ??
                        const <String>{};
                    final pathFiltered = (_forYourPathOnly && recIds.isNotEmpty)
                        ? filteredPacks
                              .where((p) => recIds.contains(p.packId))
                              .toList(growable: false)
                        : filteredPacks;
                    final displayPacks = pathFiltered.isNotEmpty
                        ? pathFiltered
                        : filteredPacks;
                    return displayPacks.map(
                      (pack) => TaskCard(
                        title: pack.title,
                        subtitle: pack.description.isNotEmpty
                            ? pack.description
                            : '${_localizedTrackTag(pack.track, isFa: isFa)} • ${EditionCopy.skillName(pack.skill.name, isIran: isFa)}',
                        glyph: _glyphForSkill(pack.skill),
                        tint: _tintForSkill(pack.skill),
                        durationText: _formatDuration(pack, isFa: isFa),
                        questionsText: _formatCountLabel(pack, isFa: isFa),
                        badgeText: recIds.contains(pack.packId)
                            ? (isFa ? 'مسیر شما' : 'For Your Path')
                            : (pack.accent ??
                                  (pack.track == 'general'
                                      ? (isFa ? 'جنرال' : 'General')
                                      : null)),
                        isDownloaded: pack.isCachedOffline,
                        isDownloading: state.downloadingPackIds.contains(
                          pack.packId,
                        ),
                        onTapDownload: () =>
                            notifier.toggleOfflineDownload(pack),
                        onTap: () => _openTestSetupSheet(
                          context,
                          pack: pack,
                          isFa: isFa,
                        ),
                      ),
                    );
                  }()),
                ],

                // Synced 3-Minute Micro-Drills Section
                if (drills.isNotEmpty) ...<Widget>[
                  const SizedBox(height: SpacingTokens.md),
                  Text(
                    isFa ? 'تمرین‌های کوتاه هدفمند' : 'Targeted Micro-Drills',
                    style: typography.cardTitle,
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  ...drills.map((drill) {
                    final mins = (drill.durationSeconds / 60).ceil();
                    final minsLabel = isFa
                        ? '${EdgeNumerals.toPersianDigits(mins)} دقیقه'
                        : '$mins min';
                    final itemsLabel = isFa
                        ? '${EdgeNumerals.toPersianDigits(drill.items.length)} تمرین'
                        : '${drill.items.length} Drills';
                    final catLabel = EditionCopy.localizeMicroDrillCategory(
                      drill.weaknessCode,
                      isIran: isFa,
                    );
                    return TaskCard(
                      title: drill.title,
                      subtitle: '$catLabel • ${drill.subtitle}',
                      glyph: LucideGlyph.chartIncreasing,
                      tint: IconWellTint.neutral,
                      durationText: minsLabel,
                      questionsText: itemsLabel,
                      onTap: () => context.push(
                        AppRoutes.buildMicroDrill(drill.drillId),
                      ),
                    );
                  }),
                ],
                const SizedBox(height: SpacingTokens.xxl),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _localizedTrackTag(String track, {required bool isFa}) {
    if (!isFa) return track.toUpperCase();
    return switch (track.toLowerCase()) {
      'academic' => 'آکادمیک',
      'general' => 'جنرال',
      'toefl' => 'تافل iBT',
      'pte' => 'PTE آکادمیک',
      'det' => 'دولینگو (DET)',
      _ => track.toUpperCase(),
    };
  }

  static LucideGlyph _glyphForSkill(SkillKind skill) => switch (skill) {
    SkillKind.speaking => LucideGlyph.mic,
    SkillKind.writing => LucideGlyph.pencil,
    SkillKind.reading => LucideGlyph.bookOpen,
    SkillKind.listening => LucideGlyph.headphones,
    SkillKind.vocabulary => LucideGlyph.layers3,
  };

  static IconWellTint _tintForSkill(SkillKind skill) => switch (skill) {
    SkillKind.speaking => IconWellTint.blue,
    SkillKind.writing => IconWellTint.violet,
    SkillKind.reading => IconWellTint.mint,
    SkillKind.listening => IconWellTint.blue,
    SkillKind.vocabulary => IconWellTint.neutral,
  };

  static String _formatDuration(
    InstalledExamPack pack, {
    required bool isFa,
  }) {
    final mins = pack.durationSeconds <= 0
        ? switch (pack.skill) {
            SkillKind.speaking => 14,
            SkillKind.writing => 60,
            SkillKind.reading => 60,
            SkillKind.listening => 30,
            SkillKind.vocabulary => 5,
          }
        : (pack.durationSeconds / 60).ceil();
    return isFa ? '${EdgeNumerals.toPersianDigits(mins)} دقیقه' : '$mins min';
  }

  static String _formatCountLabel(
    InstalledExamPack pack, {
    required bool isFa,
  }) {
    if (pack.questionCount > 0) {
      return isFa
          ? '${EdgeNumerals.toPersianDigits(pack.questionCount)} پرسش'
          : '${pack.questionCount} Questions';
    }
    return switch (pack.skill) {
      SkillKind.speaking => isFa ? '۳ بخش' : '3 Parts',
      SkillKind.writing => isFa ? '۲ تسک' : '2 Tasks',
      SkillKind.reading => isFa ? 'مجموعه متن' : 'Passage Set',
      SkillKind.listening => isFa ? 'آزمون صوتی' : 'Audio Test',
      SkillKind.vocabulary => isFa ? 'جعبه واژگان' : 'Deck',
    };
  }

  void _openTestSetupSheet(
    BuildContext context, {
    required InstalledExamPack pack,
    required bool isFa,
  }) {
    unawaited(
      showMzBottomSheet<void>(
        context: context,
        title: isFa ? 'تنظیم آزمون' : 'Test Setup',
        child: Builder(
          builder: (sheetCtx) => _TestSetupContent(
            title: pack.title,
            skill: pack.skill.name,
            duration: _formatDuration(pack, isFa: isFa),
            questions: _formatCountLabel(pack, isFa: isFa),
            initialExamMode: _isExamMode,
            isFa: isFa,
            onStart: (isExamMode) {
              Navigator.of(sheetCtx).pop();
              final route = switch (pack.skill) {
                SkillKind.speaking => AppRoutes.buildSpeakingSim(
                  pack.packId,
                  isExamMode,
                ),
                SkillKind.writing => AppRoutes.buildWritingSim(
                  pack.packId,
                  isExamMode,
                ),
                SkillKind.reading => AppRoutes.buildReadingSim(
                  pack.packId,
                  isExamMode,
                ),
                SkillKind.listening => AppRoutes.buildListeningSim(
                  pack.packId,
                  isExamMode,
                ),
                SkillKind.vocabulary => AppRoutes.vocabulary,
              };
              unawaited(context.push(route));
            },
          ),
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const new({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: AppMotion.standard.microDuration,
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: SpacingTokens.md,
          vertical: SpacingTokens.xs,
        ),
        decoration: BoxDecoration(
          color: isSelected ? colors.surfaceAlt : colors.surface,
          borderRadius: shapes.pillRadius,
          border: Border.all(
            color: isSelected ? colors.primary : colors.borderSubtle,
          ),
        ),
        child: Text(
          label,
          style: typography.secondary.copyWith(
            color: isSelected ? colors.primary : colors.textPrimary,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}

class _ModeTogglePill extends StatelessWidget {
  const new({
    required this.label,
    required this.subtitle,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final String subtitle;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: AppMotion.standard.microDuration,
        constraints: const BoxConstraints(minHeight: 44),
        padding: const EdgeInsetsDirectional.symmetric(
          horizontal: SpacingTokens.sm,
          vertical: SpacingTokens.xs,
        ),
        decoration: BoxDecoration(
          color: isSelected ? colors.surface : Colors.transparent,
          borderRadius: shapes.pillRadius,
          border: Border.all(
            color: isSelected ? colors.primary : Colors.transparent,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: typography.secondary.copyWith(
                color: isSelected ? colors.primary : colors.textPrimary,
                fontWeight: FontWeight.w700,
              ),
            ),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: typography.caption.copyWith(
                color: colors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TestSetupContent extends StatefulWidget {
  const new({
    required this.title,
    required this.skill,
    required this.duration,
    required this.questions,
    required this.initialExamMode,
    required this.isFa,
    required this.onStart,
  });

  final String title;
  final String skill;
  final String duration;
  final String questions;
  final bool initialExamMode;
  final bool isFa;
  final ValueChanged<bool> onStart;

  @override
  State<_TestSetupContent> createState() => _TestSetupContentState();
}

class _TestSetupContentState extends State<_TestSetupContent> {
  late bool isExamMode = widget.initialExamMode;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isFa = widget.isFa;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(widget.title, style: typography.cardTitle),
        const SizedBox(height: SpacingTokens.xs),
        Text(
          '${widget.duration} • ${widget.questions}',
          style: typography.secondary.copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: SpacingTokens.lg),
        Text(
          isFa ? 'انتخاب حالت اجرا' : 'Select Mode',
          style: typography.cardTitle,
        ),
        const SizedBox(height: SpacingTokens.sm),
        Row(
          children: <Widget>[
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => isExamMode = true),
                child: MzCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: <Widget>[
                          Expanded(
                            child: Text(
                              isFa ? 'حالت آزمون' : 'Exam Mode',
                              style: typography.cardTitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: SpacingTokens.xs),
                          AppIcon(
                            isExamMode
                                ? LucideGlyph.checkCircle2
                                : LucideGlyph.circlePlay,
                            color: isExamMode
                                ? colors.primary
                                : colors.textTertiary,
                            size: 20,
                          ),
                        ],
                      ),
                      const SizedBox(height: SpacingTokens.xs),
                      Text(
                        isFa
                            ? 'زمان‌بندی دقیق، پخش خطی صدا، بدون راهنما'
                            : 'Strict timer, linear audio playback, no hints',
                        style: typography.caption.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: SpacingTokens.sm),
            Expanded(
              child: GestureDetector(
                onTap: () => setState(() => isExamMode = false),
                child: MzCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: <Widget>[
                          Expanded(
                            child: Text(
                              isFa ? 'حالت تمرینی' : 'Study Mode',
                              style: typography.cardTitle,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: SpacingTokens.xs),
                          AppIcon(
                            !isExamMode
                                ? LucideGlyph.checkCircle2
                                : LucideGlyph.circlePlay,
                            color: !isExamMode
                                ? colors.primary
                                : colors.textTertiary,
                            size: 20,
                          ),
                        ],
                      ),
                      const SizedBox(height: SpacingTokens.xs),
                      Text(
                        isFa
                            ? 'پخش تعاملی، متن پیاده‌شده، توضیح هوشمند'
                            : 'Interactive playback, transcript, AI explain',
                        style: typography.caption.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: SpacingTokens.xl),
        PrimaryButton(
          label: isFa
              ? (isExamMode ? 'شروع حالت آزمون' : 'شروع حالت تمرینی')
              : (isExamMode ? 'Start Exam Mode' : 'Start Study Mode'),
          onPressed: () => widget.onStart(isExamMode),
        ),
        const SizedBox(height: SpacingTokens.md),
      ],
    );
  }
}

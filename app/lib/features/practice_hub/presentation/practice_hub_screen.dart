import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/exams/exam_descriptor.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/data/repositories/exam_catalog_repository.dart';
import 'package:mockza/features/practice_hub/presentation/practice_hub_providers.dart';
import 'package:mockza/routing/routes.dart';
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

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(practiceHubNotifierProvider);
    final notifier = ref.read(practiceHubNotifierProvider.notifier);
    final packsAsync = ref.watch(installedExamPacksProvider);
    final drillsAsync = ref.watch(drillsCatalogProvider);
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);

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

    final drills = state.selectedSkill == null
        ? (drillsAsync.asData?.value ?? const <MicroDrillSpec>[])
        : const <MicroDrillSpec>[];

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
                      Text('Practice Hub', style: typography.headline),
                      const SizedBox(height: SpacingTokens.xs),
                      Text(
                        'Offline exam library • Sync & download packs',
                        style: typography.secondary.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Sync Catalog',
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
                  tooltip: 'Settings',
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
                          label: 'Exam Mode',
                          subtitle: 'Timed',
                          isSelected: _isExamMode,
                          onTap: () => setState(() => _isExamMode = true),
                        ),
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      Expanded(
                        child: _ModeTogglePill(
                          label: 'Study Mode',
                          subtitle: 'Untimed & hints',
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
                        label: 'All',
                        isSelected: state.selectedSkill == null,
                        onTap: () => notifier.setFilter(null),
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      _FilterChip(
                        label: 'Speaking',
                        isSelected: state.selectedSkill == SkillKind.speaking,
                        onTap: () => notifier.setFilter(SkillKind.speaking),
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      _FilterChip(
                        label: 'Writing',
                        isSelected: state.selectedSkill == SkillKind.writing,
                        onTap: () => notifier.setFilter(SkillKind.writing),
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      _FilterChip(
                        label: 'Reading',
                        isSelected: state.selectedSkill == SkillKind.reading,
                        onTap: () => notifier.setFilter(SkillKind.reading),
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      _FilterChip(
                        label: 'Listening',
                        isSelected: state.selectedSkill == SkillKind.listening,
                        onTap: () => notifier.setFilter(SkillKind.listening),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: SpacingTokens.sm),

                // Track Filter Row
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: <Widget>[
                      _FilterChip(
                        label: 'All Tracks',
                        isSelected: state.selectedTrack == 'all',
                        onTap: () => notifier.setTrackFilter('all'),
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      _FilterChip(
                        label: 'Academic',
                        isSelected: state.selectedTrack == 'academic',
                        onTap: () => notifier.setTrackFilter('academic'),
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      _FilterChip(
                        label: 'General',
                        isSelected: state.selectedTrack == 'general',
                        onTap: () => notifier.setTrackFilter('general'),
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      _FilterChip(
                        label: 'TOEFL',
                        isSelected: state.selectedTrack == 'toefl',
                        onTap: () => notifier.setTrackFilter('toefl'),
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      _FilterChip(
                        label: 'PTE',
                        isSelected: state.selectedTrack == 'pte',
                        onTap: () => notifier.setTrackFilter('pte'),
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      _FilterChip(
                        label: 'DET',
                        isSelected: state.selectedTrack == 'det',
                        onTap: () => notifier.setTrackFilter('det'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: SpacingTokens.md),

                // Core Skill Simulators Quick-Launch
                if (state.selectedSkill == null ||
                    state.selectedSkill == SkillKind.speaking)
                  TaskCard(
                    title: 'Speaking Simulator',
                    subtitle: '${activeTrack.shortName} · Speaking Evaluation',
                    glyph: LucideGlyph.mic,
                    tint: IconWellTint.blue,
                    durationText: _isExamMode ? 'Timed' : 'Untimed',
                    questionsText: activeTrack == ExamTrack.toeflIbt
                        ? '2 Parts'
                        : '3 Parts',
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
                    title: 'Writing Simulator',
                    subtitle: '${activeTrack.shortName} · AI Rubric Evaluator',
                    glyph: LucideGlyph.pencil,
                    tint: IconWellTint.violet,
                    durationText: _isExamMode ? 'Timed' : 'Untimed',
                    questionsText: '${descriptor.writingTasks.length} Tasks',
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
                    title: 'Reading Simulator',
                    subtitle:
                        '${activeTrack.shortName} · Highlighting & Instant Score',
                    glyph: LucideGlyph.bookOpen,
                    tint: IconWellTint.mint,
                    durationText: _isExamMode ? 'Timed' : 'Untimed',
                    questionsText: 'Reading',
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
                    title: 'Listening Simulator',
                    subtitle:
                        '${activeTrack.shortName} · Audio Track & Transcript',
                    glyph: LucideGlyph.headphones,
                    tint: IconWellTint.blue,
                    durationText: _isExamMode ? 'Timed' : 'Study Mode',
                    questionsText: 'Listening',
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
                      label:
                          'Browse & Configure ${state.selectedSkill!.name.toUpperCase()} Packs',
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
                    title: 'Quick 4-Skill Starting Check',
                    subtitle: 'Short adaptive check to calibrate your starting practice tier.',
                    glyph: LucideGlyph.sparkles,
                    tint: IconWellTint.blue,
                    durationText: '~10–15 min',
                    questionsText: '4 Skills',
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
                                    activeTrack == ExamTrack.ieltsGeneral
                                        ? 'Full IELTS General Training Mock'
                                        : activeTrack == ExamTrack.ieltsAcademic
                                        ? 'Full IELTS Academic Mock Exam'
                                        : 'Full ${activeTrack.displayName} Mock Exam',
                                    style: typography.cardTitle,
                                  ),
                                  const SizedBox(height: SpacingTokens.xs),
                                  Text(
                                    'All 4 skills • Listening, Reading, Writing & Speaking',
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
                          label: 'Open Full Mock Planner',
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
                          allPacks.isEmpty
                              ? 'Catalog not synced yet'
                              : 'No packs match this filter',
                          style: typography.cardTitle,
                        ),
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          allPacks.isEmpty
                              ? 'Connect to Mockza API to fetch IELTS exams and audio/chart packs.'
                              : 'Switch skill or track filters to see available packs.',
                          style: typography.secondary.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                        if (allPacks.isEmpty) ...<Widget>[
                          const SizedBox(height: SpacingTokens.md),
                          SecondaryButton(
                            label: state.isSyncingCatalog
                                ? 'Syncing...'
                                : 'Sync Catalog Now',
                            onPressed: state.isSyncingCatalog
                                ? null
                                : notifier.refreshCatalog,
                          ),
                        ],
                      ],
                    ),
                  )
                else
                  ...filteredPacks.map(
                    (pack) => TaskCard(
                      title: pack.title,
                      subtitle: pack.description.isNotEmpty
                          ? pack.description
                          : '${pack.track.toUpperCase()} • ${pack.skill.name}',
                      glyph: _glyphForSkill(pack.skill),
                      tint: _tintForSkill(pack.skill),
                      durationText: _formatDuration(pack),
                      questionsText: _formatCountLabel(pack),
                      badgeText:
                          pack.accent ??
                          (pack.track == 'general' ? 'General' : null),
                      isDownloaded: pack.isCachedOffline,
                      isDownloading: state.downloadingPackIds.contains(
                        pack.packId,
                      ),
                      onTapDownload: () => notifier.toggleOfflineDownload(pack),
                      onTap: () => _openTestSetupSheet(
                        context,
                        pack: pack,
                      ),
                    ),
                  ),

                // Synced 3-Minute Micro-Drills Section
                if (drills.isNotEmpty) ...<Widget>[
                  const SizedBox(height: SpacingTokens.md),
                  Text('Targeted Micro-Drills', style: typography.cardTitle),
                  const SizedBox(height: SpacingTokens.sm),
                  ...drills.map(
                    (drill) => TaskCard(
                      title: drill.title,
                      subtitle:
                          '${drill.displayCategoryLabel} • ${drill.subtitle}',
                      glyph: LucideGlyph.chartIncreasing,
                      tint: IconWellTint.neutral,
                      durationText:
                          '${(drill.durationSeconds / 60).ceil()} min',
                      questionsText: '${drill.items.length} Drills',
                      onTap: () => context.push(
                        AppRoutes.buildMicroDrill(drill.drillId),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: SpacingTokens.xxl),
              ],
            ),
          ),
        ],
      ),
    );
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

  static String _formatDuration(InstalledExamPack pack) {
    if (pack.durationSeconds <= 0) {
      return switch (pack.skill) {
        SkillKind.speaking => '14 min',
        SkillKind.writing => '60 min',
        SkillKind.reading => '60 min',
        SkillKind.listening => '30 min',
        SkillKind.vocabulary => '5 min',
      };
    }
    final mins = (pack.durationSeconds / 60).ceil();
    return '$mins min';
  }

  static String _formatCountLabel(InstalledExamPack pack) {
    if (pack.questionCount > 0) {
      return '${pack.questionCount} Questions';
    }
    return switch (pack.skill) {
      SkillKind.speaking => '3 Parts',
      SkillKind.writing => '2 Tasks',
      SkillKind.reading => 'Passage Set',
      SkillKind.listening => 'Audio Test',
      SkillKind.vocabulary => 'Deck',
    };
  }

  void _openTestSetupSheet(
    BuildContext context, {
    required InstalledExamPack pack,
  }) {
    unawaited(
      showMzBottomSheet<void>(
        context: context,
        title: 'Test Setup',
        child: Builder(
          builder: (sheetCtx) => _TestSetupContent(
            title: pack.title,
            skill: pack.skill.name,
            duration: _formatDuration(pack),
            questions: _formatCountLabel(pack),
            initialExamMode: _isExamMode,
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
    required this.onStart,
  });

  final String title;
  final String skill;
  final String duration;
  final String questions;
  final bool initialExamMode;
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
        Text('Select Mode', style: typography.cardTitle),
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
                          Text('Exam Mode', style: typography.cardTitle),
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
                        'Strict timer, linear audio playback, no hints',
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
                          Text('Study Mode', style: typography.cardTitle),
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
                        'Interactive playback, transcript, AI explain',
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
          label: isExamMode ? 'Start Exam Mode' : 'Start Study Mode',
          onPressed: () => widget.onStart(isExamMode),
        ),
        const SizedBox(height: SpacingTokens.md),
      ],
    );
  }
}

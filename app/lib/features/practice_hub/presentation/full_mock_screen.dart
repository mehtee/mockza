import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/primitives.dart';

/// Guided 4-skill IELTS Full Mock orchestrator screen (`/practice/full-mock/:mockId`).
class FullMockScreen extends ConsumerStatefulWidget {
  /// Creates a [FullMockScreen].
  const new({required this.mockId, super.key});

  /// Identifier selecting Academic (`mock-acad-*`) vs General (`mock-gt-*`).
  final String mockId;

  @override
  ConsumerState<FullMockScreen> createState() => _FullMockScreenState();
}

class _FullMockScreenState extends ConsumerState<FullMockScreen> {
  final Set<SkillKind> _launchedSkills = <SkillKind>{};
  bool _examMode = true;

  bool get _isGeneral => widget.mockId.contains('gt');

  List<
    ({
      SkillKind skill,
      String title,
      String subtitle,
      String duration,
      String route,
    })
  >
  get _stages => [
    (
      skill: SkillKind.listening,
      title: '1. Listening Test',
      subtitle: '4 sections • Audio comprehension',
      duration: '30 min',
      route: AppRoutes.buildListeningSim('ielts-listening-seed-01', _examMode),
    ),
    (
      skill: SkillKind.reading,
      title: '2. Reading Test',
      subtitle: _isGeneral
          ? 'General Training workplace & societal texts'
          : 'Academic passages & evidence questions',
      duration: '60 min',
      route: AppRoutes.buildReadingSim(
        _isGeneral ? 'ielts-gt-reading-seed-01' : 'ielts-acad-reading-seed-01',
        _examMode,
      ),
    ),
    (
      skill: SkillKind.writing,
      title: '3. Writing Tasks 1 & 2',
      subtitle: _isGeneral
          ? 'Formal/informal letter + essay'
          : 'Academic chart report + essay',
      duration: '60 min',
      route: AppRoutes.buildWritingSim(
        _isGeneral ? 'ielts-writing-gt-01' : 'ielts-writing-seed-01',
        _examMode,
      ),
    ),
    (
      skill: SkillKind.speaking,
      title: '4. Speaking Interview',
      subtitle: 'Parts 1, 2 & 3 live microphone recording',
      duration: '14 min',
      route: AppRoutes.buildSpeakingSim('ielts-speaking-seed-01', _examMode),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final completedCount = _launchedSkills.length;

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const AppIcon(LucideGlyph.arrowLeft, size: 20),
          onPressed: () => context.pop(),
        ),
        title: Text(
          _isGeneral ? 'Full General Training Mock' : 'Full Academic Mock',
        ),
      ),
      body: ListView(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
        children: <Widget>[
          MzCard(
            variant: MzCardVariant.hero,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  '$completedCount of 4 Sections Completed',
                  style: typography.cardTitle,
                ),
                const SizedBox(height: SpacingTokens.xs),
                Text(
                  'Complete Listening, Reading, Writing, and Speaking in order. Scores sync automatically to your dashboard.',
                  style: typography.secondary.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.md),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: SecondaryButton(
                        label: _examMode ? 'Mode: Exam' : 'Mode: Study',
                        onPressed: () => setState(() => _examMode = !_examMode),
                      ),
                    ),
                    const SizedBox(width: SpacingTokens.sm),
                    Expanded(
                      child: PrimaryButton(
                        label: completedCount < 4
                            ? 'Start Next Section'
                            : 'View Progress',
                        onPressed: () async {
                          final remaining = _stages
                              .where((s) => !_launchedSkills.contains(s.skill))
                              .toList();
                          if (remaining.isEmpty) {
                            context.go(AppRoutes.progress);
                            return;
                          }
                          final next = remaining.first;
                          await context.push(next.route);
                          if (mounted) {
                            setState(() => _launchedSkills.add(next.skill));
                          }
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: SpacingTokens.lg),
          ..._stages.map(
            (stage) => Padding(
              padding: const EdgeInsetsDirectional.only(
                bottom: SpacingTokens.sm,
              ),
              child: MzCard(
                onTap: () async {
                  await context.push(stage.route);
                  if (mounted) {
                    setState(() => _launchedSkills.add(stage.skill));
                  }
                },
                child: Row(
                  children: <Widget>[
                    IconWell(
                      glyph: switch (stage.skill) {
                        SkillKind.listening => LucideGlyph.headphones,
                        SkillKind.reading => LucideGlyph.bookOpen,
                        SkillKind.writing => LucideGlyph.pencil,
                        SkillKind.speaking => LucideGlyph.mic,
                        SkillKind.vocabulary => LucideGlyph.layers3,
                      },
                      tint: _launchedSkills.contains(stage.skill)
                          ? IconWellTint.mint
                          : IconWellTint.blue,
                    ),
                    const SizedBox(width: SpacingTokens.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(stage.title, style: typography.cardTitle),
                          const SizedBox(height: SpacingTokens.xs),
                          Text(
                            '${stage.duration} • ${stage.subtitle}',
                            style: typography.secondary.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    AppIcon(
                      _launchedSkills.contains(stage.skill)
                          ? LucideGlyph.checkCircle2
                          : LucideGlyph.chevronRight,
                      color: _launchedSkills.contains(stage.skill)
                          ? colors.success
                          : colors.textTertiary,
                      size: 20,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

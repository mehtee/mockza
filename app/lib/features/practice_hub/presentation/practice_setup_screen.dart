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
import 'package:mockza/routing/safe_pop.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/task_card.dart';
import 'package:mockza/theme/primitives.dart';

/// Deep-linkable Practice Setup screen parameterized by `/practice/setup/:skill`.
class PracticeSetupScreen extends ConsumerStatefulWidget {
  /// Creates a [PracticeSetupScreen].
  const new({required this.skill, super.key});

  /// Skill slug (`speaking`, `writing`, `reading`, or `listening`).
  final String skill;

  @override
  ConsumerState<PracticeSetupScreen> createState() =>
      _PracticeSetupScreenState();
}

class _PracticeSetupScreenState extends ConsumerState<PracticeSetupScreen> {
  bool _isExamMode = true;

  SkillKind get _skillKind => SkillKind.values.firstWhere(
    (s) => s.name == widget.skill.toLowerCase(),
    orElse: () => SkillKind.speaking,
  );

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final hubState = ref.watch(practiceHubNotifierProvider);
    final hubNotifier = ref.read(practiceHubNotifierProvider.notifier);
    final packsAsync = ref.watch(installedExamPacksProvider);
    final profile = ref.watch(practiceProfileProvider).asData?.value;
    final activeTrack = ExamTrack.fromId(profile?.examId ?? 'ielts_academic');

    final skillPacks = (packsAsync.asData?.value ?? const <InstalledExamPack>[])
        .where((p) => p.skill == _skillKind)
        .toList(growable: false);
    final trackPacks = skillPacks
        .where((p) => p.track == activeTrack.catalogTrack)
        .toList(growable: false);
    final matching = trackPacks.isNotEmpty ? trackPacks : skillPacks;

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const AppIcon(LucideGlyph.arrowLeft, size: 20),
          onPressed: () => context.safePopOrGo(AppRoutes.practice),
        ),
        title: Text('${_skillKind.name.toUpperCase()} Practice Setup'),
      ),
      body: ListView(
        padding: const EdgeInsetsDirectional.symmetric(
          vertical: SpacingTokens.md,
        ),
        children: <Widget>[
          Text('Choose Mode', style: typography.cardTitle),
          const SizedBox(height: SpacingTokens.sm),
          Row(
            children: <Widget>[
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _isExamMode = true),
                  child: MzCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Row(
                          children: <Widget>[
                            Expanded(
                              child: Text(
                                'Exam Mode',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: typography.cardTitle,
                              ),
                            ),
                            const SizedBox(width: SpacingTokens.xs),
                            AppIcon(
                              _isExamMode
                                  ? LucideGlyph.checkCircle2
                                  : LucideGlyph.circlePlay,
                              color: _isExamMode
                                  ? colors.primary
                                  : colors.textTertiary,
                              size: 20,
                            ),
                          ],
                        ),
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          'Official timer & linear audio.',
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
                  onTap: () => setState(() => _isExamMode = false),
                  child: MzCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Row(
                          children: <Widget>[
                            Expanded(
                              child: Text(
                                'Study Mode',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: typography.cardTitle,
                              ),
                            ),
                            const SizedBox(width: SpacingTokens.xs),
                            AppIcon(
                              !_isExamMode
                                  ? LucideGlyph.checkCircle2
                                  : LucideGlyph.circlePlay,
                              color: !_isExamMode
                                  ? colors.primary
                                  : colors.textTertiary,
                              size: 20,
                            ),
                          ],
                        ),
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          'Transcripts, speed & AI hints.',
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
          const SizedBox(height: SpacingTokens.lg),
          Text('Available Test Packs', style: typography.cardTitle),
          const SizedBox(height: SpacingTokens.sm),
          if (matching.isEmpty)
            MzCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'Default Starter Pack Ready',
                    style: typography.cardTitle,
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  Text(
                    'Launch the starter module immediately or sync catalog packs online.',
                    style: typography.secondary.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.md),
                  PrimaryButton(
                    label: 'Start Default Module',
                    onPressed: () =>
                        _launchPack(context, _defaultPackForSkill(activeTrack)),
                  ),
                ],
              ),
            )
          else
            ...matching.map(
              (pack) => TaskCard(
                title: pack.title,
                subtitle: pack.description,
                glyph: switch (_skillKind) {
                  SkillKind.speaking => LucideGlyph.mic,
                  SkillKind.writing => LucideGlyph.pencil,
                  SkillKind.reading => LucideGlyph.bookOpen,
                  SkillKind.listening => LucideGlyph.headphones,
                  SkillKind.vocabulary => LucideGlyph.layers3,
                },
                tint: IconWellTint.blue,
                durationText: pack.durationSeconds > 0
                    ? '${(pack.durationSeconds / 60).ceil()} min'
                    : null,
                isDownloaded: pack.isCachedOffline,
                isDownloading: hubState.downloadingPackIds.contains(
                  pack.packId,
                ),
                onTapDownload: () => hubNotifier.toggleOfflineDownload(pack),
                onTap: () => _launchPack(context, pack.packId),
              ),
            ),
        ],
      ),
    );
  }

  String _defaultPackForSkill(ExamTrack track) =>
      ExamDescriptor.forTrack(track).defaultPackIdForSkill(_skillKind);

  void _launchPack(BuildContext context, String packId) {
    final route = switch (_skillKind) {
      SkillKind.speaking => AppRoutes.buildSpeakingSim(packId, _isExamMode),
      SkillKind.writing => AppRoutes.buildWritingSim(packId, _isExamMode),
      SkillKind.reading => AppRoutes.buildReadingSim(packId, _isExamMode),
      SkillKind.listening => AppRoutes.buildListeningSim(packId, _isExamMode),
      SkillKind.vocabulary => AppRoutes.vocabulary,
    };
    unawaited(context.push(route));
  }
}

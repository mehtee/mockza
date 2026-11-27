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
import 'package:mockza/providers.dart';
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
    final isIran = ref.watch(editionConfigProvider).edition == AppEdition.iran;
    final localizedSkill = EditionCopy.skillName(
      _skillKind.name,
      isIran: isIran,
    );

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
          icon: AppIcon(
            isIran ? LucideGlyph.arrowRight : LucideGlyph.arrowLeft,
            size: 20,
          ),
          onPressed: () => context.safePopOrGo(AppRoutes.practice),
        ),
        title: Text(
          isIran
              ? 'تنظیم تمرین $localizedSkill'
              : '${_skillKind.name.toUpperCase()} Practice Setup',
        ),
      ),
      body: ListView(
        padding: const EdgeInsetsDirectional.symmetric(
          vertical: SpacingTokens.md,
        ),
        children: <Widget>[
          Text(
            isIran ? 'انتخاب حالت تمرین' : 'Choose Mode',
            style: typography.cardTitle,
          ),
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
                                isIran ? 'حالت آزمون' : 'Exam Mode',
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
                          isIran
                              ? 'زمان‌بندی رسمی و پخش خطی فایل صوتی.'
                              : 'Official timer & linear audio.',
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
                                isIran ? 'حالت تمرینی' : 'Study Mode',
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
                          isIran
                              ? 'متن پیاده‌سازی، تنظیم سرعت و راهنمای هوشمند.'
                              : 'Transcripts, speed & AI hints.',
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
          Text(
            isIran ? 'بسته‌های آزمون موجود' : 'Available Test Packs',
            style: typography.cardTitle,
          ),
          const SizedBox(height: SpacingTokens.sm),
          if (matching.isEmpty)
            MzCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    isIran
                        ? 'بسته شروع پیش‌فرض آماده است'
                        : 'Default Starter Pack Ready',
                    style: typography.cardTitle,
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  Text(
                    isIran
                        ? 'بسته شروع را همین الان اجرا کنید یا بسته‌های کاتالوگ را آنلاین همگام‌سازی نمایید.'
                        : 'Launch the starter module immediately or sync catalog packs online.',
                    style: typography.secondary.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.md),
                  PrimaryButton(
                    label: isIran
                        ? 'شروع بسته پیش‌فرض'
                        : 'Start Default Module',
                    onPressed: () =>
                        _launchPack(context, _defaultPackForSkill(activeTrack)),
                  ),
                ],
              ),
            )
          else
            ...matching.map(
              (pack) {
                final mins = (pack.durationSeconds / 60).ceil();
                return TaskCard(
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
                      ? (isIran
                            ? '${EdgeNumerals.toPersianDigits('$mins')} دقیقه'
                            : '$mins min')
                      : null,
                  isDownloaded: pack.isCachedOffline,
                  isDownloading: hubState.downloadingPackIds.contains(
                    pack.packId,
                  ),
                  onTapDownload: () => hubNotifier.toggleOfflineDownload(pack),
                  onTap: () => _launchPack(context, pack.packId),
                );
              },
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

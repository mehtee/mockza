import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/linguistic_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/primitives.dart';

/// Dedicated Smart Coach workspace separating daily adaptive coaching from Mock Exams (`/coach`).
class CoachHubScreen extends ConsumerStatefulWidget {
  /// Creates a [CoachHubScreen].
  const new({super.key});

  @override
  ConsumerState<CoachHubScreen> createState() => _CoachHubScreenState();
}

class _CoachHubScreenState extends ConsumerState<CoachHubScreen> {
  DailyMissionSnapshot? _mission;
  LinguisticGraphSnapshot? _graph;
  int _dropCount = 0;
  AdvancedQuotaDto? _quota;

  @override
  void initState() {
    super.initState();
    unawaited(_hydrate());
  }

  Future<void> _hydrate() async {
    final gateway = ref.read(linguisticGatewayProvider);
    var examTrack = 'ielts_academic';
    try {
      final profile = await ref
          .read(profileRepositoryProvider)
          .loadOrInitializePrimary();
      if (profile.examId.isNotEmpty) examTrack = profile.examId;
    } on Object {
      // Non-fatal in minimal widget harnesses.
    }

    try {
      final missionFuture = gateway.getTodayMission(examTrack: examTrack);
      final graphFuture = gateway.getMyGraph();
      final dropsFuture = gateway.getDropHistory();
      final quotaFuture = gateway.fetchAdvancedQuota();

      final missionRes = await missionFuture;
      final graphRes = await graphFuture;
      final dropsRes = await dropsFuture;
      final quotaRes = await quotaFuture;

      if (!mounted) return;
      setState(() {
        _mission = missionRes.valueOrNull;
        _graph = graphRes.valueOrNull;
        _dropCount = dropsRes.valueOrNull?.length ?? 0;
        _quota = quotaRes.valueOrNull;
      });
    } on Object {
      // Keep fast local fallback cards if offline.
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isRtl = ref.watch(editionConfigProvider).edition == AppEdition.iran;
    final missionDone = _mission?.status == 'completed';
    final weakSpots = _graph?.bottlenecks.length ?? 0;

    return MzScaffold(
      appBar: AppBar(
        title: Text(l10n.smartCoachTitle),
        actions: <Widget>[
          IconButton(
            tooltip: l10n.settingsTitle,
            icon: const AppIcon(LucideGlyph.settings, size: 22),
            onPressed: () => context.push(AppRoutes.settings),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
        children: <Widget>[
          Text(
            l10n.smartCoachSubtitle,
            style: typography.secondary.copyWith(color: colors.textSecondary),
          ),
          if (_quota != null) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            Wrap(
              spacing: SpacingTokens.xs,
              runSpacing: SpacingTokens.xs,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: <Widget>[
                MzChip(
                  key: const ValueKey<String>('coach_quota_pill'),
                  label: _quota!.isPro
                      ? (isRtl
                            ? 'اشتراک ویژه · ${_quota!.shifterRemainingToday} ارتقا / ${_quota!.dropsRemainingToday} محتوا امروز'
                            : 'Pro · ${_quota!.shifterRemainingToday} upgrades / ${_quota!.dropsRemainingToday} studies left today')
                      : _quota!.freeSampleUsed
                      ? (isRtl
                            ? 'نمونه رایگان استفاده شده'
                            : 'Free AI sample used')
                      : (isRtl
                            ? '۱ نمونه رایگان + دسترسی کامل با اشتراک'
                            : '1 free sample included'),
                  variant: _quota!.isPro
                      ? MzChipVariant.target
                      : MzChipVariant.neutral,
                ),
                if (!_quota!.isPro)
                  ActionChip(
                    label: Text(isRtl ? 'ارتقای حساب' : 'Upgrade'),
                    onPressed: () => context.push(AppRoutes.paywall),
                  ),
                ActionChip(
                  avatar: const AppIcon(LucideGlyph.target, size: 14),
                  label: Text(l10n.roadmapViewFullCta),
                  onPressed: () => context.push(AppRoutes.roadmap),
                ),
              ],
            ),
          ],
          const SizedBox(height: SpacingTokens.md),
          MzCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    AppIcon(LucideGlyph.flame, size: 20, color: colors.primary),
                    const SizedBox(width: SpacingTokens.xs),
                    Expanded(
                      child: Text(
                        _mission?.promptTitle ?? l10n.missionCardTitle,
                        style: typography.cardTitle.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                    ),
                    if (_mission != null)
                      MzChip(
                        label: missionDone
                            ? (isRtl ? 'انجام شد' : 'Done')
                            : _mission!.focusTopic,
                        variant: missionDone
                            ? MzChipVariant.positive
                            : MzChipVariant.neutral,
                      ),
                  ],
                ),
                const SizedBox(height: SpacingTokens.xs),
                Text(
                  isRtl
                      ? 'قدم اول روزانه: یک تمرین ۱۰ دقیقه‌ای که دقیقاً روی اشتباهات پرتکرار و واژگان سررسید امروز شما تمرکز می‌کند.'
                      : 'Step 1 daily habit: a quick 10-minute prompt that fixes your recurring weak spots and due words together.',
                  style: typography.secondary.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.md),
                PrimaryButton(
                  key: const ValueKey<String>('coach_start_daily_btn'),
                  label: missionDone
                      ? (isRtl
                            ? 'مرور تمرین و بازخورد امروز'
                            : 'Review Today’s Feedback')
                      : l10n.missionStartAction,
                  glyph: LucideGlyph.sparkles,
                  onPressed: () => context.push(AppRoutes.buildDailyMission()),
                ),
              ],
            ),
          ),
          const SizedBox(height: SpacingTokens.md),
          _CoachToolTile(
            key: const ValueKey<String>('coach_upgrade_speaking_tile'),
            icon: LucideGlyph.slidersHorizontal,
            title: l10n.registerShifterTitle,
            whenToUse: isRtl
                ? 'چه زمانی استفاده کنیم؟ وقتی می‌خواهید جمله‌تان را با صدا یا متن بگویید و نسخه روزمره، کاری و نمره ۸+ را با تلفظ مقایسه کنید.'
                : 'When to use: Speak or type casually and compare Everyday, Workplace, and Band 8+ versions with guided listening.',
            ctaLabel: isRtl
                ? 'ارتقای جمله (صدا یا متن)'
                : 'Upgrade My Speaking',
            onTap: () => context.push(AppRoutes.registerShifter),
          ),
          const SizedBox(height: SpacingTokens.sm),
          _CoachToolTile(
            key: const ValueKey<String>('coach_learn_anything_tile'),
            icon: LucideGlyph.cloudUpload,
            title: l10n.dropAnythingTitle,
            badgeLabel: _dropCount > 0
                ? (isRtl ? '$_dropCount منبع' : '$_dropCount saved')
                : null,
            whenToUse: isRtl
                ? 'چه زمانی استفاده کنیم؟ وقتی مقاله، متن کتاب، اسکرین‌شات یا ویس انگلیسی دارید و می‌خواهید در ۲ دقیقه از آن اصطلاح یاد بگیرید و آزمونک بسازید.'
                : 'When to use: Paste any article link, text, screenshot, or short audio to build a 2-minute quiz and save phrases to Vocabulary.',
            extraContent: Padding(
              padding: const EdgeInsetsDirectional.only(top: SpacingTokens.sm),
              child: Wrap(
                spacing: SpacingTokens.xs,
                runSpacing: SpacingTokens.xs,
                children:
                    <(String, String)>[
                          ('url', isRtl ? 'لینک' : 'Link'),
                          ('text', isRtl ? 'متن' : 'Text'),
                          ('image', isRtl ? 'عکس' : 'Photo'),
                          ('audio', isRtl ? 'صدا' : 'Audio'),
                        ]
                        .map(
                          (entry) => ActionChip(
                            key: ValueKey<String>(
                              'coach_quick_drop_${entry.$1}',
                            ),
                            label: Text(entry.$2),
                            avatar:
                                entry.$1 == 'audio' &&
                                    _quota != null &&
                                    !_quota!.audioDropAllowed
                                ? const AppIcon(LucideGlyph.lock, size: 14)
                                : null,
                            onPressed: () => context.push(
                              AppRoutes.buildDropIngest(tab: entry.$1),
                            ),
                          ),
                        )
                        .toList(growable: false),
              ),
            ),
            ctaLabel: isRtl
                ? 'ساخت تمرین از محتوا'
                : 'Turn Content Into a Quiz',
            onTap: () => context.push(AppRoutes.dropIngest),
          ),
          const SizedBox(height: SpacingTokens.sm),
          _CoachToolTile(
            key: const ValueKey<String>('coach_weak_spots_tile'),
            icon: LucideGlyph.chartIncreasing,
            title: l10n.linguisticGraphTitle,
            badgeLabel: weakSpots > 0
                ? (isRtl ? '$weakSpots نقطه ضعف' : '$weakSpots tracked')
                : null,
            whenToUse: isRtl
                ? 'چه زمانی استفاده کنیم؟ برای دیدن خطاهای گرامری/واژگانی پرتکرار و انتخاب موضوعات مورد علاقه (مثل فوتبال یا هوش مصنوعی) برای تمرین‌های آینده.'
                : 'When to use: See what mistakes hold your score back, track mastered habits, and pin favorite topics for daily practice.',
            ctaLabel: isRtl ? 'مشاهده نقاط ضعف و علایق' : 'Open My Weak Spots',
            onTap: () => context.push(AppRoutes.linguisticGraph),
          ),
        ],
      ),
    );
  }
}

class _CoachToolTile extends StatelessWidget {
  const new({
    required this.icon,
    required this.title,
    required this.whenToUse,
    required this.ctaLabel,
    required this.onTap,
    this.badgeLabel,
    this.extraContent,
    super.key,
  });

  final LucideGlyph icon;
  final String title;
  final String whenToUse;
  final String ctaLabel;
  final VoidCallback onTap;
  final String? badgeLabel;
  final Widget? extraContent;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    return MzCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              AppIcon(icon, size: 18, color: colors.primary),
              const SizedBox(width: SpacingTokens.xs),
              Expanded(
                child: Text(
                  title,
                  style: typography.cardTitle.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
              ),
              if (badgeLabel != null) MzChip(label: badgeLabel!),
            ],
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            whenToUse,
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
          ?extraContent,
          const SizedBox(height: SpacingTokens.sm),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: SecondaryButton(
              label: ctaLabel,
              isFullWidth: false,
              onPressed: onTap,
            ),
          ),
        ],
      ),
    );
  }
}

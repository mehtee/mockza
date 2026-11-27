import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/auth/auth_models.dart';
import 'package:mockza/core/config/brand_identity.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/exams/exam_descriptor.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/formatting/jalali_edge_formatter.dart';
import 'package:mockza/core/localization/edition_copy.dart';
import 'package:mockza/core/personalization/topic_taxonomy.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/features/settings/presentation/settings_notifier.dart';
import 'package:mockza/features/settings/presentation/settings_providers.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/routing/safe_pop.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/device_session_card.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_jalali_date_picker.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/mz_toast.dart';
import 'package:mockza/theme/primitives.dart';
import 'package:mockza/theme/theme_catalog.dart';
import 'package:mockza/theme/theme_preset.dart';

/// Top-level Settings & Account management screen.
class SettingsScreen extends ConsumerWidget {
  /// Creates a [SettingsScreen].
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(settingsNotifierProvider);
    final notifier = ref.read(settingsNotifierProvider.notifier);
    final cacheBytes = ref.watch(totalCacheBytesProvider).asData?.value ?? 0;
    final cachedPacksCount =
        ref.watch(downloadedPackCountProvider).asData?.value ?? 0;
    final isIran = state.edition == AppEdition.iran;

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: isIran ? 'بازگشت' : 'Back',
          icon: const AppIcon(LucideGlyph.chevronLeft, size: 22),
          onPressed: () => context.safePopOrGo(AppRoutes.home),
        ),
        title: Text(isIran ? 'تنظیمات' : 'Settings'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.symmetric(
          vertical: SpacingTokens.lg,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _buildSectionHeader(
              context,
              isIran ? 'مسیر مطالعه و تمرین' : 'Learning Focus',
            ),
            const SizedBox(height: SpacingTokens.sm),
            _buildStudyFocusCard(context, state, notifier),
            const SizedBox(height: SpacingTokens.xl),
            _buildSectionHeader(
              context,
              isIran ? 'تنظیمات آزمون و هدف' : 'Exam Calibration',
            ),
            const SizedBox(height: SpacingTokens.sm),
            _buildCalibrationCard(context, state, notifier),
            const SizedBox(height: SpacingTokens.xl),
            _buildSectionHeader(context, isIran ? 'ظاهر برنامه' : 'Appearance'),
            const SizedBox(height: SpacingTokens.sm),
            _buildThemeCard(context, state, notifier),
            const SizedBox(height: SpacingTokens.xl),
            _buildSectionHeader(
              context,
              isIran ? 'اشتراک و سهمیه روزانه' : 'Subscription & Daily Quota',
            ),
            const SizedBox(height: SpacingTokens.sm),
            _buildSubscriptionCard(context, state, notifier),
            const SizedBox(height: SpacingTokens.xl),
            _buildSectionHeader(
              context,
              isIran
                  ? 'حساب کاربری و دستگاه‌های فعال'
                  : 'Account & Signed-In Devices',
            ),
            const SizedBox(height: SpacingTokens.sm),
            _buildAccountCard(context, state, notifier),
            const SizedBox(height: SpacingTokens.xl),
            _buildSectionHeader(
              context,
              isIran ? 'حافظه آفلاین' : 'Offline Storage',
            ),
            const SizedBox(height: SpacingTokens.sm),
            _buildStorageCard(
              context,
              state: state,
              notifier: notifier,
              cacheBytes: cacheBytes,
              cachedPacksCount: cachedPacksCount,
            ),
            const SizedBox(height: SpacingTokens.xl),
            _buildDisclaimerCard(context, state),
            const SizedBox(height: SpacingTokens.xl),
            _buildDangerZone(context, state, notifier),
            const SizedBox(height: SpacingTokens.xxl),
            _buildFooter(context, state),
            const SizedBox(height: SpacingTokens.xxl),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(BuildContext context, String title) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    return Text(
      title,
      style: typography.cardTitle.copyWith(color: colors.textPrimary),
    );
  }

  Widget _buildCalibrationCard(
    BuildContext context,
    SettingsState state,
    SettingsNotifier notifier,
  ) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isIran = state.edition == AppEdition.iran;
    final formattedExamDate = state.targetDateSerial != null
        ? JalaliEdgeFormatter.formatSerialDay(
            SerialDay(state.targetDateSerial!),
            state.edition,
          )
        : (isIran ? 'تنظیم نشده' : 'Not set');

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            isIran ? 'مسیر آزمون' : 'Exam Track',
            style: typography.body.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          LtrExamBoundary(
            child: Text(
              ExamDescriptor.forTrack(state.track).subtitle,
              style: typography.caption.copyWith(
                color: colors.textSecondary,
              ),
            ),
          ),
          const SizedBox(height: SpacingTokens.sm),
          Wrap(
            spacing: SpacingTokens.sm,
            runSpacing: SpacingTokens.sm,
            children: ExamTrack.values
                .map(
                  (track) => MzChip(
                    label: track.displayName,
                    isSelected: state.track == track,
                    onTap: () => notifier.setTrack(track),
                  ),
                )
                .toList(growable: false),
          ),
          const Divider(height: SpacingTokens.xl),
          Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      EditionCopy.targetScoreTitle(
                        state.track,
                        isIran: isIran,
                      ),
                      style: typography.body.copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      state.track == ExamTrack.toeflIbt
                          ? (isIran
                                ? 'معادل تقریبی ${EdgeNumerals.toPersianDigits(ExamSpec.estimateToeflLegacy120(state.targetBand))} از ۱۲۰'
                                : 'Comparable to ~${ExamSpec.estimateToeflLegacy120(state.targetBand)}/120')
                          : (isIran
                                ? 'هدف شخصی برای پیگیری پیشرفت'
                                : 'Personal goal used for progress tracking'),
                      style: typography.caption.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: isIran
                    ? 'کاهش نمره هدف'
                    : 'Decrease target band score',
                icon: const AppIcon(LucideGlyph.minus, size: 20),
                onPressed: state.targetBand > state.track.minScore
                    ? () => notifier.setTargetBand(
                        state.targetBand - state.track.scoreStep,
                      )
                    : null,
              ),
              LtrExamBoundary(
                useLatinFont: !isIran,
                child: Text(
                  EditionCopy.formatScoreFor(
                    state.track,
                    state.targetBand,
                    isIran: isIran,
                  ),
                  style: typography.cardTitle.copyWith(color: colors.primary),
                ),
              ),
              IconButton(
                tooltip: isIran
                    ? 'افزایش نمره هدف'
                    : 'Increase target band score',
                icon: const AppIcon(LucideGlyph.plus, size: 20),
                onPressed: state.targetBand < state.track.maxScore
                    ? () => notifier.setTargetBand(
                        state.targetBand + state.track.scoreStep,
                      )
                    : null,
              ),
            ],
          ),
          const Divider(height: SpacingTokens.xl),
          Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      isIran ? 'تاریخ آزمون (شمسی)' : 'Target Exam Date',
                      style: typography.body.copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      formattedExamDate,
                      style: typography.caption.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              TextButton(
                onPressed: () async {
                  final today = notifier.currentTodaySerialDay();
                  if (isIran) {
                    final picked = await showMzJalaliDatePickerSheet(
                      context,
                      today: today,
                      initialSelectedDay: state.targetDateSerial != null
                          ? SerialDay(state.targetDateSerial!)
                          : null,
                    );
                    if (picked == null) return;
                    await notifier.setTargetDateSerial(
                      picked.cleared ? null : picked.day?.value,
                    );
                  } else {
                    final initialDt = state.targetDateSerial != null
                        ? SerialDay(state.targetDateSerial!).toUtcDateTime()
                        : today.toUtcDateTime().add(const Duration(days: 30));
                    final dt = await showDatePicker(
                      context: context,
                      initialDate: initialDt,
                      firstDate: today.toUtcDateTime(),
                      lastDate: today.toUtcDateTime().add(
                        const Duration(days: 730),
                      ),
                    );
                    if (dt != null) {
                      await notifier.setTargetDateSerial(
                        SerialDay.fromUtcDateTime(
                          DateTime.utc(dt.year, dt.month, dt.day),
                        ).value,
                      );
                    }
                  }
                },
                child: Text(isIran ? 'تغییر تاریخ' : 'Set Date'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStudyFocusCard(
    BuildContext context,
    SettingsState state,
    SettingsNotifier notifier,
  ) {
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isIran = state.edition == AppEdition.iran;
    final options = <({String key, String label})>[
      (key: 'both', label: l10n.learningModeBoth),
      (key: 'exams', label: l10n.learningModeExams),
      (key: 'coach', label: l10n.learningModeCoach),
    ];
    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(
            l10n.learningModeSectionSubtitle,
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.sm),
          Wrap(
            spacing: SpacingTokens.xs,
            runSpacing: SpacingTokens.xs,
            children: options
                .map((opt) {
                  final selected = state.studyFocus == opt.key;
                  return ChoiceChip(
                    key: ValueKey<String>('settings_focus_${opt.key}'),
                    label: Text(opt.label),
                    selected: selected,
                    onSelected: (_) => notifier.setStudyFocus(opt.key),
                  );
                })
                .toList(growable: false),
          ),
          const Divider(height: SpacingTokens.xl),
          Text(
            AppLocalizations.of(context).favoriteTopicsLabel,
            style: typography.secondary.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Wrap(
            spacing: SpacingTokens.xs,
            runSpacing: SpacingTokens.xs,
            children: CanonicalTopicKey.values
                .map((topic) {
                  final wire = topic.wireKey;
                  final selected = state.favoriteTopics.contains(wire);
                  return FilterChip(
                    key: ValueKey<String>('settings_topic_$wire'),
                    label: Text(
                      topic.labelFor(isIran: isIran),
                    ),
                    selected: selected,
                    onSelected: (_) =>
                        unawaited(notifier.toggleFavoriteTopic(wire)),
                  );
                })
                .toList(growable: false),
          ),
          const Divider(height: SpacingTokens.xl),
          Text(
            l10n.settingsDailyNewCapTitle,
            style: typography.secondary.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Wrap(
            spacing: SpacingTokens.xs,
            runSpacing: SpacingTokens.xs,
            children: <int>[5, 10, 20]
                .map(
                  (cap) => ChoiceChip(
                    label: Text(
                      isIran ? EdgeNumerals.toPersianDigits(cap) : '$cap',
                    ),
                    selected: state.dailyNewVocabCap == cap,
                    onSelected: (_) =>
                        unawaited(notifier.setDailyNewVocabCap(cap)),
                  ),
                )
                .toList(growable: false),
          ),
          const Divider(height: SpacingTokens.xl),
          Text(
            l10n.settingsTtsAccentTitle,
            style: typography.secondary.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Wrap(
            spacing: SpacingTokens.xs,
            runSpacing: SpacingTokens.xs,
            children: <Widget>[
              ChoiceChip(
                label: Text(l10n.settingsTtsAccentUs),
                selected: state.preferredTtsAccent == 'us',
                onSelected: (_) =>
                    unawaited(notifier.setPreferredTtsAccent('us')),
              ),
              ChoiceChip(
                label: Text(l10n.settingsTtsAccentUk),
                selected: state.preferredTtsAccent == 'uk',
                onSelected: (_) =>
                    unawaited(notifier.setPreferredTtsAccent('uk')),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildThemeCard(
    BuildContext context,
    SettingsState state,
    SettingsNotifier notifier,
  ) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);
    final isIran = state.edition == AppEdition.iran;
    final modes = <({String key, String label})>[
      (key: 'dark', label: isIran ? 'تیره' : 'Dark'),
      (key: 'light', label: isIran ? 'روشن' : 'Light'),
      (key: 'system', label: isIran ? 'سیستم' : 'System'),
    ];
    final presets = MzThemeCatalog.allPresets;

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            isIran ? 'روشنایی' : 'Brightness',
            style: typography.secondary.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: SpacingTokens.sm),
          Wrap(
            spacing: SpacingTokens.sm,
            runSpacing: SpacingTokens.sm,
            children: modes
                .map((m) {
                  final isSelected = state.themeMode == m.key;
                  return MzChip(
                    label: m.label,
                    isSelected: isSelected,
                    onTap: () => notifier.setThemeMode(m.key),
                  );
                })
                .toList(growable: false),
          ),
          const Divider(height: SpacingTokens.xl),
          Text(
            isIran ? 'پالت رنگی' : 'Color Theme',
            style: typography.secondary.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            isIran
                ? 'پالت رنگی مناسب برای مطالعه راحت‌تر خود را انتخاب کنید.'
                : 'Choose any visual palette for reading comfort.',
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.sm),
          Column(
            children: presets
                .map((preset) {
                  final selected = state.presetId == preset.id;
                  return Padding(
                    padding: const EdgeInsetsDirectional.only(
                      bottom: SpacingTokens.sm,
                    ),
                    child: _buildPresetTile(
                      context,
                      preset: preset,
                      selected: selected,
                      colors: colors,
                      typography: typography,
                      shapes: shapes,
                      onTap: () => notifier.setThemePreset(preset.id),
                    ),
                  );
                })
                .toList(growable: false),
          ),
        ],
      ),
    );
  }

  Widget _buildPresetTile(
    BuildContext context, {
    required MzThemePreset preset,
    required bool selected,
    required AppColors colors,
    required AppTypography typography,
    required AppShapes shapes,
    required VoidCallback onTap,
  }) {
    return Semantics(
      button: true,
      selected: selected,
      label: '${preset.displayName} theme preset. ${preset.description}',
      child: InkWell(
        onTap: onTap,
        borderRadius: shapes.controlRadius,
        child: Container(
          padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
          decoration: BoxDecoration(
            color: selected ? colors.surfaceAlt : colors.bgRaised,
            borderRadius: shapes.controlRadius,
            border: Border.all(
              color: selected ? colors.primary : colors.borderSubtle,
              width: selected ? 1.5 : shapes.strokeWidth,
            ),
          ),
          child: Row(
            children: <Widget>[
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: preset.previewBackgroundDark,
                  borderRadius: shapes.pillRadius,
                  border: Border.all(color: preset.previewPrimary, width: 2.5),
                ),
                child: Center(
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: preset.previewAccent,
                      borderRadius: shapes.pillRadius,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: SpacingTokens.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      preset.displayName,
                      style: typography.secondary.copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      preset.description,
                      style: typography.caption.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              if (selected)
                AppIcon(
                  LucideGlyph.checkCircle2,
                  size: 20,
                  color: colors.primary,
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSubscriptionCard(
    BuildContext context,
    SettingsState state,
    SettingsNotifier notifier,
  ) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isIran = state.edition == AppEdition.iran;

    return MzCard(
      variant: state.isPro ? MzCardVariant.hero : MzCardVariant.standard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: SpacingTokens.sm,
            runSpacing: SpacingTokens.xs,
            children: <Widget>[
              MzChip(
                label: state.isPro
                    ? (isIran ? 'سنجیا پرو فعال' : 'PRO ACTIVE')
                    : (isIran ? 'نسخه رایگان' : 'FREE STARTER'),
                isSelected: state.isPro,
              ),
              if (!state.isPro)
                TextButton(
                  onPressed: () => context.push(AppRoutes.paywall),
                  child: Text(isIran ? 'ارتقا به پرو ←' : 'Upgrade ->'),
                ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          Text(
            state.isPro
                ? (isIran ? 'سهمیه ارزیابی روزانه' : 'Daily Evaluation Quota')
                : (isIran
                      ? 'سهمیه ارزیابی رایگان'
                      : 'Free Diagnostic Allowance'),
            style: typography.body.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            state.isPro
                ? (isIran
                      ? 'امروز ${EdgeNumerals.toPersianDigits(state.speakingRemaining)} ارزیابی اسپیکینگ و ${EdgeNumerals.toPersianDigits(state.writingRemaining)} ارزیابی رایتینگ باقی مانده است.'
                      : '${state.speakingRemaining} Speaking & ${state.writingRemaining} Writing evaluations remaining today.')
                : ((state.speakingRemaining > 0 || state.writingRemaining > 0)
                      ? (isIran
                            ? '۱ ارزیابی رایگان هوش مصنوعی باقی مانده است (اسپیکینگ یا رایتینگ).'
                            : '1 shared free diagnostic AI evaluation remaining (Speaking or Writing).')
                      : (isIran
                            ? 'ارزیابی رایگان شما مصرف شده است. برای دریافت ۱۰ ارزیابی اسپیکینگ + ۱۰ ارزیابی رایتینگ در روز به پرو ارتقا دهید.'
                            : 'Free diagnostic AI evaluation used. Upgrade to Pro for 10 Speaking + 10 Writing evaluations daily.')),
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.md),
          SecondaryButton(
            label: state.isBusy
                ? (isIran ? 'در حال بازیابی...' : 'Restoring...')
                : (isIran ? 'بازیابی خریدها' : 'Restore Purchases'),
            onPressed: state.isBusy
                ? null
                : () => unawaited(notifier.restorePurchases()),
          ),
          if (state.statusMessage != null) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            Text(
              state.statusMessage!,
              style: typography.caption.copyWith(color: colors.primary),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildAccountCard(
    BuildContext context,
    SettingsState state,
    SettingsNotifier notifier,
  ) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);
    final isIran = state.edition == AppEdition.iran;
    final snapshot = state.accountSessions;
    final user = snapshot?.user;
    final isSignedIn = (snapshot?.isAuthenticated ?? false) && user != null;

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          if (isSignedIn) ...<Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        user.displayName?.isNotEmpty ?? false
                            ? user.displayName!
                            : (user.email ??
                                  (isIran
                                      ? 'حساب کاربری فعال'
                                      : 'Signed-in Account')),
                        style: typography.cardTitle.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                      if (user.email != null &&
                          user.email!.isNotEmpty) ...<Widget>[
                        const SizedBox(height: SpacingTokens.xs),
                        Text(
                          user.email!,
                          style: typography.caption.copyWith(
                            color: colors.textSecondary,
                          ),
                        ),
                      ],
                      const SizedBox(height: SpacingTokens.xs),
                      Wrap(
                        spacing: SpacingTokens.xs,
                        runSpacing: SpacingTokens.xs,
                        children: user.linkedProviders
                            .map((p) => MzChip(label: p.displayLabel))
                            .toList(growable: false),
                      ),
                    ],
                  ),
                ),
                TextButton.icon(
                  onPressed: state.isManagingSession
                      ? null
                      : () => _confirmSignOutCurrentDevice(
                          context,
                          notifier,
                          isIran: isIran,
                        ),
                  icon: AppIcon(
                    LucideGlyph.logOut,
                    size: 16,
                    color: colors.textPrimary,
                  ),
                  label: Text(isIran ? 'خروج' : 'Sign Out'),
                ),
              ],
            ),
            const Divider(height: SpacingTokens.xl),
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    isIran
                        ? 'دستگاه‌های فعال (۱ گوشی موبایل + ۱ وب دسکتاپ)'
                        : 'Active Device Slots (1 Phone + 1 Desktop Web)',
                    style: typography.secondary.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: isIran
                      ? 'به‌روزرسانی دستگاه‌های فعال'
                      : 'Refresh active devices',
                  onPressed: state.isLoadingSessions || state.isManagingSession
                      ? null
                      : () => unawaited(notifier.refreshAccountSessions()),
                  icon: const AppIcon(LucideGlyph.refreshCw, size: 16),
                ),
              ],
            ),
            const SizedBox(height: SpacingTokens.xs),
            DeviceSlotCapacityStrip(
              mobileOccupied: snapshot?.mobileOccupied ?? false,
              desktopWebOccupied: snapshot?.desktopWebOccupied ?? false,
            ),
            const SizedBox(height: SpacingTokens.md),
            ...(snapshot?.sessions ?? const <DeviceSessionInfo>[]).map(
              (session) => Padding(
                padding: const EdgeInsetsDirectional.only(
                  bottom: SpacingTokens.sm,
                ),
                child: DeviceSessionTile(
                  session: session,
                  isBusy: state.isManagingSession,
                  onTerminate: () {
                    if (session.isCurrentDevice) {
                      _confirmSignOutCurrentDevice(
                        context,
                        notifier,
                        isIran: isIran,
                      );
                    } else {
                      _confirmTerminateRemoteSession(
                        context,
                        notifier,
                        session,
                        isIran: isIran,
                      );
                    }
                  },
                ),
              ),
            ),
            if ((snapshot?.sessions.length ?? 0) > 1) ...<Widget>[
              const SizedBox(height: SpacingTokens.xs),
              SecondaryButton(
                label: state.isManagingSession
                    ? (isIran
                          ? 'در حال به‌روزرسانی...'
                          : 'Updating Sessions...')
                    : (isIran
                          ? 'خروج از سایر دستگاه‌ها'
                          : 'Terminate All Other Devices'),
                isDestructive: true,
                onPressed: state.isManagingSession
                    ? null
                    : () => _confirmTerminateOtherSessions(
                        context,
                        notifier,
                        isIran: isIran,
                      ),
              ),
            ],
            const Divider(height: SpacingTokens.xl),
          ] else ...<Widget>[
            Container(
              padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
              decoration: BoxDecoration(
                color: colors.surfaceAlt,
                borderRadius: shapes.controlRadius,
                border: Border.all(color: colors.borderSubtle),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Text(
                    isIran
                        ? 'ورود به حساب و محافظت از دستگاه'
                        : 'Sign In & Device Protection',
                    style: typography.body.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  Text(
                    isIran
                        ? 'حساب خود را هم‌زمان روی ۱ گوشی موبایل و ۱ مرورگر دسکتاپ با شماره موبایل یا ایمیل متصل کنید.'
                        : 'Use your account on 1 Mobile Phone and 1 Desktop Web browser with Google, Apple, or Email & Password.',
                    style: typography.caption.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.md),
                  PrimaryButton(
                    label: isIran
                        ? 'ورود یا ساخت حساب کاربری'
                        : 'Sign In or Create Account',
                    onPressed: () async {
                      final router = GoRouter.of(context);
                      await router.push<Object?>(AppRoutes.auth);
                      if (context.mounted) {
                        unawaited(notifier.refreshAccountSessions());
                      }
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: SpacingTokens.md),
          ],
          Text(
            isIran ? 'شناسه ناشناس دستگاه' : 'Pseudonymous Device Identifier',
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.xs),
          SelectableText(
            state.appUserId,
            style: typography.body.copyWith(
              color: colors.textPrimary,
              fontFamily: 'monospace',
            ),
          ),
          const SizedBox(height: SpacingTokens.md),
          Row(
            children: <Widget>[
              Expanded(
                child: SecondaryButton(
                  label: isIran ? 'کپی شناسه' : 'Copy User ID',
                  onPressed: () async {
                    await Clipboard.setData(
                      ClipboardData(text: state.appUserId),
                    );
                    if (context.mounted) {
                      showMzToast(
                        context,
                        message: isIran
                            ? 'شناسه کاربری در کلیپ‌بورد کپی شد.'
                            : 'User ID copied to clipboard.',
                      );
                    }
                  },
                ),
              ),
              const SizedBox(width: SpacingTokens.sm),
              Expanded(
                child: SecondaryButton(
                  label: state.isSyncingCatalog
                      ? (isIran ? 'در حال همگام‌سازی...' : 'Syncing...')
                      : (isIran ? 'همگام‌سازی بسته آزمون' : 'Sync Catalog'),
                  glyph: LucideGlyph.rotateCcw,
                  onPressed: state.isSyncingCatalog
                      ? null
                      : () => unawaited(notifier.syncCatalogNow()),
                ),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.sm),
          SecondaryButton(
            label: state.isSyncingDevices
                ? AppLocalizations.of(context).loadingLabel
                : AppLocalizations.of(context).syncDevicesNow,
            glyph: LucideGlyph.refreshCw,
            onPressed: state.isSyncingDevices
                ? null
                : () => unawaited(notifier.syncAcrossDevicesNow()),
          ),
          const SizedBox(height: SpacingTokens.sm),
          SecondaryButton(
            label: isIran
                ? 'خروجی داده‌های مطالعه (JSON)'
                : 'Export Study Data (JSON)',
            glyph: LucideGlyph.download,
            onPressed: () async {
              final json = await notifier.exportStudyDataJson();
              await Clipboard.setData(ClipboardData(text: json));
              if (context.mounted) {
                showMzToast(
                  context,
                  message: isIran
                      ? 'نسخه پشتیبان (${EdgeNumerals.toPersianDigits(json.length)} کاراکتر) با فرمت JSON کپی شد.'
                      : 'Study backup (${json.length} chars) copied as JSON.',
                );
              }
            },
          ),
        ],
      ),
    );
  }

  void _confirmSignOutCurrentDevice(
    BuildContext context,
    SettingsNotifier notifier, {
    required bool isIran,
  }) {
    unawaited(
      showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(isIran ? 'خروج از این دستگاه؟' : 'Sign Out This Device?'),
          content: Text(
            isIran
                ? 'با خروج از حساب، ظرفیت این دستگاه فوراً آزاد می‌شود و دسترسی پرو روی این دستگاه تا ورود مجدد متوقف خواهد شد.'
                : 'Signing out immediately frees this device slot on your account and pauses Pro access on this device until you sign in again.',
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: Text(isIran ? 'انصراف' : 'Cancel'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.of(dialogContext).pop();
                unawaited(notifier.signOutCurrentDevice());
              },
              child: Text(isIran ? 'خروج' : 'Sign Out'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmTerminateRemoteSession(
    BuildContext context,
    SettingsNotifier notifier,
    DeviceSessionInfo session, {
    required bool isIran,
  }) {
    unawaited(
      showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(
            isIran
                ? 'قطع دسترسی ${session.deviceName}؟'
                : 'Terminate ${session.deviceName}?',
          ),
          content: Text(
            isIran
                ? 'دسترسی دستگاه ${session.deviceName} (${session.locationLabel}) بلافاصله قطع می‌شود و ظرفیت آن برای دستگاه دیگری آزاد خواهد شد.'
                : 'This will immediately sign out ${session.deviceName} (${session.locationLabel}) and open your ${session.slotKind.displayLabel} slot for another device.',
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: Text(isIran ? 'انصراف' : 'Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.of(context).error,
              ),
              onPressed: () {
                Navigator.of(dialogContext).pop();
                unawaited(notifier.terminateDeviceSession(session.deviceId));
              },
              child: Text(isIran ? 'قطع دسترسی' : 'Terminate Session'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmTerminateOtherSessions(
    BuildContext context,
    SettingsNotifier notifier, {
    required bool isIran,
  }) {
    unawaited(
      showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(
            isIran
                ? 'قطع دسترسی سایر دستگاه‌ها؟'
                : 'Terminate All Other Devices?',
          ),
          content: Text(
            isIran
                ? 'تمامی گوشی‌ها و مرورگرهای دیگر بلافاصله از حساب خارج می‌شوند، اما همین دستگاه متصل باقی می‌ماند.'
                : 'Every other signed-in phone or desktop browser will lose access right away while keeping this device signed in.',
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: Text(isIran ? 'انصراف' : 'Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.of(context).error,
              ),
              onPressed: () {
                Navigator.of(dialogContext).pop();
                unawaited(notifier.terminateOtherSessions());
              },
              child: Text(isIran ? 'قطع سایر دستگاه‌ها' : 'Terminate Others'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStorageCard(
    BuildContext context, {
    required SettingsState state,
    required SettingsNotifier notifier,
    required int cacheBytes,
    required int cachedPacksCount,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isIran = state.edition == AppEdition.iran;

    final sizeLabel = _formatBytes(cacheBytes, isIran: isIran);
    final subtitle = cachedPacksCount == 0 && cacheBytes == 0
        ? (isIran
              ? 'بسته آفلاینی ذخیره نشده است'
              : 'No offline exam packs cached')
        : (isIran
              ? '${EdgeNumerals.toPersianDigits(cachedPacksCount)} بسته آفلاین ذخیره شده ($sizeLabel)'
              : '$cachedPacksCount offline packs cached ($sizeLabel)');

    return MzCard(
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  isIran
                      ? 'فایل‌های صوتی و محتوای آفلاین'
                      : 'Offline Audio & Content',
                  style: typography.body.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  subtitle,
                  style: typography.caption.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: state.isClearingCache
                ? null
                : () async {
                    await notifier.clearOfflineCache();
                    if (context.mounted) {
                      showMzToast(
                        context,
                        message: isIran
                            ? 'حافظه موقت آفلاین پاک شد.'
                            : 'Offline caches purged.',
                      );
                    }
                  },
            child: Text(
              state.isClearingCache
                  ? (isIran ? 'در حال پاک‌سازی...' : 'Clearing...')
                  : (isIran ? 'پاک‌سازی حافظه' : 'Clear Cache'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDisclaimerCard(BuildContext context, SettingsState state) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isIran = state.edition == AppEdition.iran;
    final brandName = BrandIdentity.forEdition(
      state.edition,
    ).localizedName(persian: isIran);

    return MzCard(
      variant: MzCardVariant.surfaceAlt,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              const AppIcon(LucideGlyph.info, size: 18),
              const SizedBox(width: SpacingTokens.xs),
              Expanded(
                child: Text(
                  isIran ? 'ابزار تمرین مستقل' : 'Independent Practice Tool',
                  style: typography.caption.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            isIran
                ? '$brandName یک شبیه‌ساز مستقل آمادگی آزمون است و وابسته، تاییدشده یا تحت حمایت سازمان‌های IELTS، Cambridge، British Council، IDP، PTE، Duolingo یا ETS نیست.'
                : '$brandName is an independent prep simulator and is not affiliated with, approved, or endorsed by IELTS, Cambridge Assessment English, British Council, IDP, PTE, Duolingo, or ETS.',
            style: typography.caption.copyWith(
              color: colors.textSecondary,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDangerZone(
    BuildContext context,
    SettingsState state,
    SettingsNotifier notifier,
  ) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);
    final isIran = state.edition == AppEdition.iran;

    return Container(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
      decoration: BoxDecoration(
        color: colors.dangerBg,
        borderRadius: shapes.controlRadius,
        border: Border.all(color: colors.error),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            isIran ? 'منطقه خطر (حذف کامل داده‌ها)' : 'Danger Zone',
            style: typography.cardTitle.copyWith(
              color: colors.error,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            isIran
                ? 'حساب کاربری شما روی سرور به‌همراه تمامی آزمون‌ها، مقالات، فایل‌های صوتی و فلش‌کارت‌های این دستگاه برای همیشه پاک می‌شوند.'
                : 'Permanently deletes your server anonymous account along with all practice attempts, essays, audio recordings, and flashcards from this device.',
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.md),
          SecondaryButton(
            label: state.isBusy
                ? (isIran ? 'در حال پاک‌سازی...' : 'Erasing Data...')
                : (isIran
                      ? 'حذف کامل حساب و تمام داده‌ها'
                      : 'Delete All My Data & Account'),
            isDestructive: true,
            onPressed: state.isBusy
                ? null
                : () => _confirmDataWipe(context, notifier, isIran: isIran),
          ),
        ],
      ),
    );
  }

  Widget _buildFooter(BuildContext context, SettingsState state) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isIran = state.edition == AppEdition.iran;
    final brandName = BrandIdentity.forEdition(
      state.edition,
    ).localizedName(persian: isIran);

    return Center(
      child: Text(
        '$brandName ${EdgeNumerals.formatChromeNumber(state.appVersionLabel, state.edition)} · Edition: ${state.edition.code}',
        style: typography.caption.copyWith(color: colors.textTertiary),
      ),
    );
  }

  void _confirmDataWipe(
    BuildContext context,
    SettingsNotifier notifier, {
    required bool isIran,
  }) {
    unawaited(
      showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(
            isIran ? 'حذف حساب و تمام داده‌ها؟' : 'Delete Account & All Data?',
          ),
          content: Text(
            isIran
                ? 'این عمل غیرقابل بازگشت است. حساب سرور و تمامی تمرین‌ها، فایل‌های صوتی، تاریخچه پیشرفت و فلش‌کارت‌های محلی برای همیشه حذف می‌شوند.'
                : 'This action is irreversible. Your remote evaluation account and all local essays, audio recordings, progress history, and flashcards will be permanently erased.',
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: Text(isIran ? 'انصراف' : 'Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.of(context).error,
              ),
              onPressed: () async {
                Navigator.of(dialogContext).pop();
                await notifier.wipeAllData();
                if (context.mounted) {
                  context.go(AppRoutes.onboarding);
                }
              },
              child: Text(isIran ? 'حذف همه‌چیز' : 'Erase Everything'),
            ),
          ],
        ),
      ),
    );
  }

  String _formatBytes(int bytes, {required bool isIran}) {
    final String raw;
    if (bytes <= 0) {
      raw = '0 KB';
    } else if (bytes < 1024 * 1024) {
      raw = '${(bytes / 1024).round()} KB';
    } else {
      raw = '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }
    return isIran ? EdgeNumerals.toPersianDigits(raw) : raw;
  }
}

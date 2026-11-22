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
                      isIran
                          ? 'نمره هدف (${state.track.unitLabel})'
                          : 'Target ${state.track.unitLabel} Score',
                      style: typography.body.copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      state.track == ExamTrack.toeflIbt
                          ? 'Comparable to ~${ExamSpec.estimateToeflLegacy120(state.targetBand)}/120'
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
                tooltip: 'Decrease target band score',
                icon: const AppIcon(LucideGlyph.minus, size: 20),
                onPressed: state.targetBand > state.track.minScore
                    ? () => notifier.setTargetBand(
                        state.targetBand - state.track.scoreStep,
                      )
                    : null,
              ),
              LtrExamBoundary(
                child: Text(
                  state.track.formatScore(state.targetBand),
                  style: typography.cardTitle.copyWith(color: colors.primary),
                ),
              ),
              IconButton(
                tooltip: 'Increase target band score',
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
                      topic.labelFor(isIran: state.edition == AppEdition.iran),
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
                    label: Text('$cap'),
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
    final modes = <({String key, String label})>[
      (key: 'dark', label: 'Dark'),
      (key: 'light', label: 'Light'),
      (key: 'system', label: 'System'),
    ];
    final presets = MzThemeCatalog.allPresets;

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            'Brightness',
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
            'Color Theme',
            style: typography.secondary.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            'Choose any visual palette for reading comfort.',
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
                label: state.isPro ? 'PRO ACTIVE' : 'FREE STARTER',
                isSelected: state.isPro,
              ),
              if (!state.isPro)
                TextButton(
                  onPressed: () => context.push(AppRoutes.paywall),
                  child: const Text('Upgrade ->'),
                ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          Text(
            state.isPro
                ? 'Daily Evaluation Quota'
                : 'Free Diagnostic Allowance',
            style: typography.body.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            state.isPro
                ? '${state.speakingRemaining} Speaking & ${state.writingRemaining} Writing evaluations remaining today.'
                : ((state.speakingRemaining > 0 || state.writingRemaining > 0)
                      ? '1 shared free diagnostic AI evaluation remaining (Speaking or Writing).'
                      : 'Free diagnostic AI evaluation used. Upgrade to Pro for 10 Speaking + 10 Writing evaluations daily.'),
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.md),
          SecondaryButton(
            label: state.isBusy ? 'Restoring...' : 'Restore Purchases',
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
                            : (user.email ?? 'Signed-in Account'),
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
                      : () => _confirmSignOutCurrentDevice(context, notifier),
                  icon: AppIcon(
                    LucideGlyph.logOut,
                    size: 16,
                    color: colors.textPrimary,
                  ),
                  label: const Text('Sign Out'),
                ),
              ],
            ),
            const Divider(height: SpacingTokens.xl),
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    'Active Device Slots (1 Phone + 1 Desktop Web)',
                    style: typography.secondary.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Refresh active devices',
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
                      _confirmSignOutCurrentDevice(context, notifier);
                    } else {
                      _confirmTerminateRemoteSession(
                        context,
                        notifier,
                        session,
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
                    ? 'Updating Sessions...'
                    : 'Terminate All Other Devices',
                isDestructive: true,
                onPressed: state.isManagingSession
                    ? null
                    : () => _confirmTerminateOtherSessions(context, notifier),
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
                    'Sign In & Device Protection',
                    style: typography.body.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  Text(
                    'Use your account on 1 Mobile Phone and 1 Desktop Web browser with Google, Apple, or Email & Password.',
                    style: typography.caption.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.md),
                  PrimaryButton(
                    label: 'Sign In or Create Account',
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
            'Pseudonymous Device Identifier',
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
                  label: 'Copy User ID',
                  onPressed: () async {
                    await Clipboard.setData(
                      ClipboardData(text: state.appUserId),
                    );
                    if (context.mounted) {
                      showMzToast(
                        context,
                        message: 'User ID copied to clipboard.',
                      );
                    }
                  },
                ),
              ),
              const SizedBox(width: SpacingTokens.sm),
              Expanded(
                child: SecondaryButton(
                  label: state.isSyncingCatalog ? 'Syncing...' : 'Sync Catalog',
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
            label: 'Export Study Data (JSON)',
            glyph: LucideGlyph.download,
            onPressed: () async {
              final json = await notifier.exportStudyDataJson();
              await Clipboard.setData(ClipboardData(text: json));
              if (context.mounted) {
                showMzToast(
                  context,
                  message:
                      'Study backup (${json.length} chars) copied as JSON.',
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
    SettingsNotifier notifier,
  ) {
    unawaited(
      showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Sign Out This Device?'),
          content: const Text(
            'Signing out immediately frees this device slot on your account and pauses Pro access on this device until you sign in again.',
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                Navigator.of(dialogContext).pop();
                unawaited(notifier.signOutCurrentDevice());
              },
              child: const Text('Sign Out'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmTerminateRemoteSession(
    BuildContext context,
    SettingsNotifier notifier,
    DeviceSessionInfo session,
  ) {
    unawaited(
      showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text('Terminate ${session.deviceName}?'),
          content: Text(
            'This will immediately sign out ${session.deviceName} (${session.locationLabel}) and open your ${session.slotKind.displayLabel} slot for another device.',
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.of(context).error,
              ),
              onPressed: () {
                Navigator.of(dialogContext).pop();
                unawaited(notifier.terminateDeviceSession(session.deviceId));
              },
              child: const Text('Terminate Session'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmTerminateOtherSessions(
    BuildContext context,
    SettingsNotifier notifier,
  ) {
    unawaited(
      showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Terminate All Other Devices?'),
          content: const Text(
            'Every other signed-in phone or desktop browser will lose access right away while keeping this device signed in.',
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.of(context).error,
              ),
              onPressed: () {
                Navigator.of(dialogContext).pop();
                unawaited(notifier.terminateOtherSessions());
              },
              child: const Text('Terminate Others'),
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

    final sizeLabel = _formatBytes(cacheBytes);
    final subtitle = cachedPacksCount == 0 && cacheBytes == 0
        ? 'No offline exam packs cached'
        : '$cachedPacksCount offline packs cached ($sizeLabel)';

    return MzCard(
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'Offline Audio & Content',
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
                        message: 'Offline caches purged.',
                      );
                    }
                  },
            child: Text(state.isClearingCache ? 'Clearing...' : 'Clear Cache'),
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
            'Danger Zone',
            style: typography.cardTitle.copyWith(
              color: colors.error,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            'Permanently deletes your server anonymous account along with all practice attempts, essays, audio recordings, and flashcards from this device.',
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.md),
          SecondaryButton(
            label: state.isBusy
                ? 'Erasing Data...'
                : 'Delete All My Data & Account',
            isDestructive: true,
            onPressed: state.isBusy
                ? null
                : () => _confirmDataWipe(context, notifier),
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

  void _confirmDataWipe(BuildContext context, SettingsNotifier notifier) {
    unawaited(
      showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Delete Account & All Data?'),
          content: const Text(
            'This action is irreversible. Your remote evaluation account and all local essays, audio recordings, progress history, and flashcards will be permanently erased.',
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),
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
              child: const Text('Erase Everything'),
            ),
          ],
        ),
      ),
    );
  }

  String _formatBytes(int bytes) {
    if (bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).round()} KB';
    }
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

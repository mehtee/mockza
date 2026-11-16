import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/features/settings/presentation/settings_notifier.dart';
import 'package:mockza/features/settings/presentation/settings_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/mz_toast.dart';
import 'package:mockza/theme/primitives.dart';

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

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const AppIcon(LucideGlyph.chevronLeft, size: 22),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go(AppRoutes.home);
            }
          },
        ),
        title: const Text('Settings'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            _buildSectionHeader(context, 'Exam Calibration'),
            const SizedBox(height: SpacingTokens.sm),
            _buildCalibrationCard(context, state, notifier),
            const SizedBox(height: SpacingTokens.xl),
            _buildSectionHeader(context, 'Appearance'),
            const SizedBox(height: SpacingTokens.sm),
            _buildThemeCard(context, state, notifier),
            const SizedBox(height: SpacingTokens.xl),
            _buildSectionHeader(context, 'Subscription & Daily Quota'),
            const SizedBox(height: SpacingTokens.sm),
            _buildSubscriptionCard(context, state, notifier),
            const SizedBox(height: SpacingTokens.xl),
            _buildSectionHeader(context, 'Account & Privacy'),
            const SizedBox(height: SpacingTokens.sm),
            _buildAccountCard(context, state, notifier),
            const SizedBox(height: SpacingTokens.xl),
            _buildSectionHeader(context, 'Offline Storage'),
            const SizedBox(height: SpacingTokens.sm),
            _buildStorageCard(
              context,
              state: state,
              notifier: notifier,
              cacheBytes: cacheBytes,
              cachedPacksCount: cachedPacksCount,
            ),
            const SizedBox(height: SpacingTokens.xl),
            _buildDisclaimerCard(context),
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

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'IELTS Exam Track',
                      style: typography.body.copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      state.examModule == ExamModuleType.academic
                          ? 'Academic (University / Professional)'
                          : 'General Training (Migration / Work)',
                      style: typography.caption.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Switch(
                value: state.examModule == ExamModuleType.academic,
                onChanged: (val) {
                  notifier.setExamModule(
                    val
                        ? ExamModuleType.academic
                        : ExamModuleType.generalTraining,
                  );
                },
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
                      'Target Band Score',
                      style: typography.body.copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      'Overall goal calibrated in rubrics',
                      style: typography.caption.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.remove_circle_outline),
                onPressed: state.targetBand > 5.0
                    ? () => notifier.setTargetBand(state.targetBand - 0.5)
                    : null,
              ),
              Text(
                state.targetBand.toStringAsFixed(1),
                style: typography.cardTitle.copyWith(color: colors.primary),
              ),
              IconButton(
                icon: const Icon(Icons.add_circle_outline),
                onPressed: state.targetBand < 9.0
                    ? () => notifier.setTargetBand(state.targetBand + 0.5)
                    : null,
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
    final modes = <String>['system', 'dark', 'light'];
    return MzCard(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: modes
            .map((m) {
              final isSelected = state.themeMode == m;
              return MzChip(
                label: m.toUpperCase(),
                isSelected: isSelected,
                onTap: () => notifier.setThemeMode(m),
              );
            })
            .toList(growable: false),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              MzChip(
                label: state.isPro ? 'PRO ACTIVE' : 'FREE STARTER',
                isSelected: state.isPro,
              ),
              const Spacer(),
              if (!state.isPro)
                TextButton(
                  onPressed: () => context.push(AppRoutes.paywall),
                  child: const Text('Upgrade ->'),
                ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          Text(
            'Daily Evaluation Quota',
            style: typography.body.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            '${state.speakingRemaining} Speaking & ${state.writingRemaining} Writing evaluations remaining today.',
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

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
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

  Widget _buildDisclaimerCard(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      variant: MzCardVariant.surfaceAlt,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              const AppIcon(LucideGlyph.info, size: 18),
              const SizedBox(width: SpacingTokens.xs),
              Text(
                'Independent Practice Tool',
                style: typography.caption.copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            'Mockza is an independent prep simulator and is not affiliated with, approved, or endorsed by IELTS, Cambridge Assessment English, British Council, IDP, PTE, or ETS. IELTS is a registered trademark.',
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

    return Center(
      child: Text(
        'Mockza ${state.appVersionLabel} · Edition: ${state.edition.code}',
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

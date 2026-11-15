import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/features/paywall/presentation/paywall_notifier.dart';
import 'package:mockza/features/paywall/presentation/paywall_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/billing_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/status_banner.dart';
import 'package:mockza/theme/primitives.dart';

/// Transparent Pro paywall with fair-use allowance & store platform handling (Screen 13).
class PaywallScreen extends ConsumerWidget {
  /// Creates a [PaywallScreen].
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final state = ref.watch(paywallNotifierProvider);
    final notifier = ref.read(paywallNotifierProvider.notifier);

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const AppIcon(LucideGlyph.x, size: 20),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go(AppRoutes.home);
            }
          },
        ),
        title: const Text('Mockza Pro'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            if (kIsWeb) ...<Widget>[
              const StatusBanner(
                variant: StatusBannerVariant.offline,
                message: 'Subscriptions are managed via Google Play / App Store on mobile devices and synced automatically to your account.',
              ),
              const SizedBox(height: SpacingTokens.lg),
            ],
            _buildHeroHeader(context),
            const SizedBox(height: SpacingTokens.lg),
            _buildFairUseAllowanceCard(context),
            const SizedBox(height: SpacingTokens.xl),
            Text(
              'Select Your Study Plan',
              style: typography.cardTitle.copyWith(color: colors.textPrimary),
            ),
            const SizedBox(height: SpacingTokens.sm),
            ...state.packages.map(
              (p) => _buildPackageCard(context, p, state, notifier),
            ),
            const SizedBox(height: SpacingTokens.xl),
            PrimaryButton(
              label: state.isPro
                  ? 'Pro Active'
                  : (kIsWeb
                        ? 'Subscribe via Android / iOS App'
                        : 'Subscribe to Mockza Pro'),
              isLoading: state.isBusy,
              onPressed: state.isPro || state.isBusy || kIsWeb
                  ? null
                  : () => unawaited(notifier.purchaseSelected()),
            ),
            const SizedBox(height: SpacingTokens.md),
            Center(
              child: TextButton(
                onPressed: state.isBusy || kIsWeb
                    ? null
                    : () => unawaited(notifier.restorePurchases()),
                child: const Text('Restore Previous Purchases'),
              ),
            ),
            if (state.statusMessage != null) ...<Widget>[
              const SizedBox(height: SpacingTokens.sm),
              Center(
                child: Text(
                  state.statusMessage!,
                  textAlign: TextAlign.center,
                  style: typography.caption.copyWith(color: colors.primary),
                ),
              ),
            ],
            const SizedBox(height: SpacingTokens.xl),
            _buildFreeComparisonCard(context),
            const SizedBox(height: SpacingTokens.xl),
            _buildTermsNotice(context),
            const SizedBox(height: SpacingTokens.xxl),
          ],
        ),
      ),
    );
  }

  Widget _buildHeroHeader(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Column(
      children: <Widget>[
        const MockzaMark(size: 48),
        const SizedBox(height: SpacingTokens.md),
        Text(
          'Reach Your Target Band',
          textAlign: TextAlign.center,
          style: typography.headline.copyWith(color: colors.textPrimary),
        ),
        const SizedBox(height: SpacingTokens.xs),
        Text(
          'Structured IELTS Speaking & Writing rubric coaching paired with official objective tests.',
          textAlign: TextAlign.center,
          style: typography.body.copyWith(color: colors.textSecondary),
        ),
      ],
    );
  }

  Widget _buildFairUseAllowanceCard(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      variant: MzCardVariant.hero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              const AppIcon(LucideGlyph.checkCircle2, size: 20),
              const SizedBox(width: SpacingTokens.xs),
              Text(
                'TRANSPARENT FAIR-USE ALLOWANCE',
                style: typography.caption.copyWith(
                  color: colors.textSecondary,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          _buildAllowanceBullet(
            context,
            '10 Speaking & 10 Writing evaluations / day',
          ),
          _buildAllowanceBullet(
            context,
            '150 evaluations / month',
          ),
          _buildAllowanceBullet(
            context,
            'Unlimited 1-tap Mistake-to-Deck vocab saves',
          ),
          _buildAllowanceBullet(
            context,
            'Full offline Reading & Listening exam packs unlocked',
          ),
          _buildAllowanceBullet(
            context,
            'Instant "Ask AI Why?" rationale explanations',
          ),
        ],
      ),
    );
  }

  Widget _buildAllowanceBullet(BuildContext context, String text) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          const AppIcon(LucideGlyph.check, size: 16),
          const SizedBox(width: SpacingTokens.sm),
          Expanded(
            child: Text(
              text,
              style: typography.body.copyWith(color: colors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPackageCard(
    BuildContext context,
    StorePackage package,
    PaywallState state,
    PaywallNotifier notifier,
  ) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);
    final isSelected = state.selectedPackageId == package.identifier;
    final isBestValue = package.identifier == 'mockza_pro_monthly';

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.sm),
      child: InkWell(
        onTap: () => notifier.selectPackage(package.identifier),
        borderRadius: shapes.controlRadius,
        child: Container(
          padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
          decoration: BoxDecoration(
            color: isSelected
                ? colors.primary.withValues(alpha: 0.08)
                : colors.surface,
            borderRadius: shapes.controlRadius,
            border: Border.all(
              color: isSelected ? colors.primary : colors.borderSubtle,
              width: isSelected ? 2 : 1,
            ),
          ),
          child: Row(
            children: <Widget>[
              Icon(
                isSelected
                    ? Icons.radio_button_checked
                    : Icons.radio_button_off,
                color: isSelected ? colors.primary : colors.textTertiary,
                size: 20,
              ),
              const SizedBox(width: SpacingTokens.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Flexible(
                          child: Text(
                            package.title,
                            style: typography.cardTitle.copyWith(
                              color: colors.textPrimary,
                            ),
                          ),
                        ),
                        if (isBestValue) ...<Widget>[
                          const SizedBox(width: SpacingTokens.sm),
                          const MzChip(
                            label: 'BEST VALUE',
                            isSelected: true,
                          ),
                        ],
                      ],
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                    Text(
                      package.description,
                      style: typography.caption.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: SpacingTokens.sm),
              Text(
                package.priceString,
                style: typography.cardTitle.copyWith(
                  color: isSelected ? colors.primary : colors.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFreeComparisonCard(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      variant: MzCardVariant.surfaceAlt,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            'Free Starter Plan Includes:',
            style: typography.cardTitle.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            '1 free diagnostic evaluation, unlimited local objective Reading & Listening exams, and daily spaced repetition vocabulary reviews.',
            style: typography.caption.copyWith(
              color: colors.textSecondary,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTermsNotice(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Text(
      'Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period. Manage or cancel anytime in App Store or Google Play account settings.',
      textAlign: TextAlign.center,
      style: typography.caption.copyWith(
        color: colors.textTertiary,
        height: 1.4,
      ),
    );
  }
}

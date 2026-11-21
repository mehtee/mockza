import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/features/paywall/presentation/paywall_notifier.dart';
import 'package:mockza/features/paywall/presentation/paywall_providers.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/routing/safe_pop.dart';
import 'package:mockza/services/billing_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/device_session_card.dart';
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
    final isIran = ref.watch(editionConfigProvider).edition == AppEdition.iran;
    final webBillingLocked = kIsWeb && !isIran;

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const AppIcon(LucideGlyph.x, size: 20),
          onPressed: () => context.safePopOrGo(AppRoutes.home),
        ),
        title: Text(isIran ? 'سنجیا پرو' : 'Mockza Pro'),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: SingleChildScrollView(
            padding: const EdgeInsetsDirectional.symmetric(
              vertical: SpacingTokens.lg,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                if (webBillingLocked) ...<Widget>[
                  const StatusBanner(
                    variant: StatusBannerVariant.offline,
                    message: 'Subscriptions are managed via Google Play / App Store on mobile devices and synced automatically to your account.',
                  ),
                  const SizedBox(height: SpacingTokens.lg),
                ],
                _buildHeroHeader(context, isIran: isIran),
                const SizedBox(height: SpacingTokens.lg),
                _buildFairUseAllowanceCard(context, isIran: isIran),
                const SizedBox(height: SpacingTokens.xl),
                Text(
                  isIran
                      ? 'انتخاب بسته آمادگی آزمون'
                      : 'Select Your Study Plan',
                  style: typography.cardTitle.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.sm),
                ...state.packages.map(
                  (p) => _buildPackageCard(
                    context,
                    p,
                    state,
                    notifier,
                    isIran: isIran,
                  ),
                ),
                const SizedBox(height: SpacingTokens.lg),
                DevicePolicyNoticeCard(
                  title: isIran
                      ? 'قانون دقیق اشتراک شخصی (۱ موبایل + ۱ وب دسکتاپ)'
                      : 'Strict 1-Phone + 1-Desktop-Web Subscription Rule',
                ),
                const SizedBox(height: SpacingTokens.sm),
                _buildDevicePolicyConsentBox(
                  context,
                  state,
                  notifier,
                  isIran: isIran,
                ),
                if (!state.isSignedIn && !state.isPro) ...<Widget>[
                  const SizedBox(height: SpacingTokens.sm),
                  _buildSignInPromptCard(context, notifier, isIran: isIran),
                ],
                const SizedBox(height: SpacingTokens.xl),
                PrimaryButton(
                  label: state.isPro
                      ? (isIran ? 'اشتراک پرو فعال است' : 'Pro Active')
                      : (webBillingLocked
                            ? 'Subscribe via Android / iOS App'
                            : (isIran
                                  ? 'پرداخت و فعال‌سازی سنجیا پرو'
                                  : 'Subscribe to Mockza Pro')),
                  isLoading: state.isBusy,
                  onPressed: state.isPro || state.isBusy || webBillingLocked
                      ? null
                      : () => unawaited(
                          notifier.purchaseSelected(requirePolicyConsent: true),
                        ),
                ),
                const SizedBox(height: SpacingTokens.sm),
                SecondaryButton(
                  label: isIran ? 'بازیابی خرید قبلی' : 'Restore Purchases',
                  onPressed: state.isBusy || webBillingLocked
                      ? null
                      : () => unawaited(notifier.restorePurchases()),
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
                _buildFreeComparisonCard(context, isIran: isIran),
                const SizedBox(height: SpacingTokens.xl),
                _buildTermsNotice(context, isIran: isIran),
                const SizedBox(height: SpacingTokens.xxl),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeroHeader(BuildContext context, {required bool isIran}) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Column(
      children: <Widget>[
        EditionBrandMark(size: 48, isIran: isIran),
        const SizedBox(height: SpacingTokens.md),
        Text(
          isIran ? 'به نمره هدف خود برسید' : 'Reach Your Target Band',
          textAlign: TextAlign.center,
          style: typography.headline.copyWith(color: colors.textPrimary),
        ),
        const SizedBox(height: SpacingTokens.xs),
        Text(
          isIran
              ? 'ارزیابی دقیق اسپیکینگ و رایتینگ با هوش مصنوعی، همراه با آزمون‌های کامل ریدینگ و لیسنینگ آیلتس، تافل، پی‌تی‌ای و دولینگو.'
              : 'Structured IELTS Speaking & Writing rubric coaching paired with original Reading & Listening practice tests.',
          textAlign: TextAlign.center,
          style: typography.body.copyWith(color: colors.textSecondary),
        ),
      ],
    );
  }

  Widget _buildFairUseAllowanceCard(
    BuildContext context, {
    required bool isIran,
  }) {
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
              Expanded(
                child: Text(
                  isIran
                      ? 'سهمیه شفاف و حرفه‌ای مصرف روزانه'
                      : 'TRANSPARENT FAIR-USE ALLOWANCE',
                  style: typography.caption.copyWith(
                    color: colors.textSecondary,
                    letterSpacing: isIran ? 0 : 1.2,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.md),
          _buildAllowanceBullet(
            context,
            isIran
                ? 'روزانه ۱۰ ارزیابی اسپیکینگ و ۱۰ ارزیابی رایتینگ'
                : '10 Speaking & 10 Writing evaluations / day',
          ),
          _buildAllowanceBullet(
            context,
            isIran ? 'ماهانه ۱۵۰ ارزیابی هوشمند' : '150 evaluations / month',
          ),
          _buildAllowanceBullet(
            context,
            isIran
                ? 'ذخیره نامحدود اشتباهات به عنوان فلش‌کارت واژگان با معنی فارسی'
                : 'Unlimited 1-tap Mistake-to-Deck vocab saves',
          ),
          _buildAllowanceBullet(
            context,
            isIran
                ? 'دسترسی کامل به بسته‌های آفلاین ریدینگ و لیسنینگ'
                : 'Full offline Reading & Listening exam packs unlocked',
          ),
          _buildAllowanceBullet(
            context,
            isIran
                ? 'تحلیل فوری «چرا این پاسخ درست/غلط است؟» با هوش مصنوعی'
                : 'Instant "Ask AI Why?" rationale explanations',
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
    PaywallNotifier notifier, {
    required bool isIran,
  }) {
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
              AppIcon(
                isSelected ? LucideGlyph.circleDot : LucideGlyph.circle,
                color: isSelected ? colors.primary : colors.textTertiary,
                size: 20,
              ),
              const SizedBox(width: SpacingTokens.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Wrap(
                      spacing: SpacingTokens.sm,
                      runSpacing: SpacingTokens.xs,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: <Widget>[
                        Text(
                          package.title,
                          style: typography.cardTitle.copyWith(
                            color: colors.textPrimary,
                          ),
                        ),
                        if (isBestValue)
                          MzChip(
                            label: isIran ? 'محبوب‌ترین' : 'BEST VALUE',
                            isSelected: true,
                          ),
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

  Widget _buildFreeComparisonCard(
    BuildContext context, {
    required bool isIran,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      variant: MzCardVariant.surfaceAlt,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            isIran
                ? 'امکانات نسخه رایگان پایه:'
                : 'Free Starter Plan Includes:',
            style: typography.cardTitle.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            isIran
                ? '۱ ارزیابی رایگان تشخیص سطح با هوش مصنوعی (اسپیکینگ یا رایتینگ)، دسترسی به آزمون‌های آفلاین ریدینگ و لیسنینگ و مرور روزانه واژگان.'
                : '1 shared free diagnostic AI evaluation (Speaking or Writing), full offline Reading & Listening practice tests, and daily spaced repetition vocabulary reviews.',
            style: typography.caption.copyWith(
              color: colors.textSecondary,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDevicePolicyConsentBox(
    BuildContext context,
    PaywallState state,
    PaywallNotifier notifier, {
    required bool isIran,
  }) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return Semantics(
      toggled: state.hasAcceptedDevicePolicy,
      button: true,
      label: isIran
          ? 'تایید قانون استفاده شخصی در ۱ گوشی موبایل و ۱ مرورگر دسکتاپ'
          : 'Agree to strict 1 Mobile Phone and 1 Desktop Web personal-use subscription policy',
      child: InkWell(
        onTap: state.isPro ? null : notifier.toggleDevicePolicyConsent,
        borderRadius: shapes.controlRadius,
        child: Container(
          padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
          decoration: BoxDecoration(
            color: state.hasAcceptedDevicePolicy
                ? colors.surfaceAlt
                : colors.surface,
            borderRadius: shapes.controlRadius,
            border: Border.all(
              color: state.hasAcceptedDevicePolicy
                  ? colors.primary
                  : colors.borderSubtle,
              width: state.hasAcceptedDevicePolicy ? 1.5 : shapes.strokeWidth,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              AppIcon(
                state.hasAcceptedDevicePolicy
                    ? LucideGlyph.checkCircle2
                    : LucideGlyph.circle,
                size: 20,
                color: state.hasAcceptedDevicePolicy
                    ? colors.primary
                    : colors.textTertiary,
              ),
              const SizedBox(width: SpacingTokens.md),
              Expanded(
                child: Text(
                  isIran
                      ? 'قوانین استفاده شخصی را می‌پذیرم: اشتراک سنجیا هم‌زمان حداکثر روی ۱ گوشی موبایل و ۱ مرورگر وب دسکتاپ قابل استفاده است.'
                      : 'I understand and agree that my subscription permits at most 1 active Mobile Phone and 1 active Desktop Web browser at a time (personal use only; no account sharing).',
                  style: typography.caption.copyWith(
                    color: colors.textPrimary,
                    height: 1.35,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSignInPromptCard(
    BuildContext context,
    PaywallNotifier notifier, {
    required bool isIran,
  }) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  isIran
                      ? 'ابتدا وارد حساب کاربری شوید'
                      : 'Link Your Account First',
                  style: typography.body.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  isIran
                      ? 'با شماره موبایل یا ایمیل وارد شوید تا اشتراک پرو بین گوشی و وب همگام شود.'
                      : 'Sign in with Google, Apple, or Email to carry Pro between your phone and Desktop Web.',
                  style: typography.caption.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: SpacingTokens.sm),
          TextButton(
            onPressed: () async {
              final router = GoRouter.of(context);
              await router.push<Object?>(
                AppRoutes.buildAuth(mode: 'signup'),
              );
              if (context.mounted) {
                unawaited(notifier.refreshAccountLinkState());
              }
            },
            child: Text(isIran ? 'ورود' : 'Sign In'),
          ),
        ],
      ),
    );
  }

  Widget _buildTermsNotice(BuildContext context, {required bool isIran}) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Text(
      isIran
          ? 'پرداخت ریالی از طریق درگاه بانکی شاپرک (زرین‌پال) یا مارکت‌های رسمی کافه‌بازار و مایکت انجام می‌شود و اشتراک به‌صورت فردی روی ۱ موبایل و ۱ مرورگر دسکتاپ فعال می‌گردد.'
          : 'Subscriptions are strictly licensed to one individual across at most 1 Mobile Phone and 1 Desktop Web browser and automatically renew unless canceled at least 24 hours before the end of the current period. Manage devices anytime in Settings or cancel in App Store / Google Play account settings.',
      textAlign: TextAlign.center,
      style: typography.caption.copyWith(
        color: colors.textTertiary,
        height: 1.4,
      ),
    );
  }
}

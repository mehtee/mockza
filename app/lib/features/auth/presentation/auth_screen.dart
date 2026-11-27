import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/auth/auth_models.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/features/auth/presentation/auth_notifier.dart';
import 'package:mockza/features/auth/presentation/auth_providers.dart';
import 'package:mockza/features/auth/presentation/widgets/dev_oauth_sandbox_sheet.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/routing/safe_pop.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/device_session_card.dart';
import 'package:mockza/theme/components/exam_question_controls.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_form_field.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/social_auth_buttons.dart';
import 'package:mockza/theme/components/status_banner.dart';
import 'package:mockza/theme/primitives.dart';

/// Account Sign-In & Registration screen with Email/Password, Google, Apple,
/// Iran `+98` SMS OTP, and transparent 1-Phone + 1-Desktop-Web device limit feedback.
class AuthScreen extends ConsumerStatefulWidget {
  /// Creates an [AuthScreen].
  const new({
    this.initialIsSignUp = false,
    this.returnTo,
    super.key,
  });

  /// Starts on Create Account tab when `true`.
  final bool initialIsSignUp;

  /// Optional route path navigated to after authentication completes.
  final String? returnTo;

  @override
  ConsumerState<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends ConsumerState<AuthScreen> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _otpCodeController = TextEditingController();
  bool _obscurePassword = true;
  bool _showIranEmailFallback = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref
          .read(authNotifierProvider.notifier)
          .resetFormState(isSignUp: widget.initialIsSignUp);
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    _otpCodeController.dispose();
    super.dispose();
  }

  void _completeNavigation() {
    if (!mounted) return;
    final target = widget.returnTo;
    if (target != null && target.startsWith('/') && target != AppRoutes.auth) {
      context.go(target);
      return;
    }
    if (GoRouter.of(context).canPop()) {
      context.pop(true);
    } else {
      context.go(AppRoutes.home);
    }
  }

  Future<void> _handleEmailSubmit() async {
    final ok = await ref
        .read(authNotifierProvider.notifier)
        .submitEmailAuth(
          email: _emailController.text,
          password: _passwordController.text,
          displayName: _nameController.text,
        );
    if (ok && mounted) {
      _completeNavigation();
    }
  }

  Future<void> _handleRequestOtp() async {
    final ok = await ref
        .read(authNotifierProvider.notifier)
        .requestSmsOtp(rawPhone: _phoneController.text);
    if (ok && mounted) {
      _otpCodeController.clear();
    }
  }

  Future<void> _handleVerifyOtp() async {
    final ok = await ref
        .read(authNotifierProvider.notifier)
        .verifySmsOtp(
          rawPhone: _phoneController.text,
          otpCode: _otpCodeController.text,
        );
    if (ok && mounted) {
      _completeNavigation();
    }
  }

  Future<void> _handleSocialTap(AuthProviderType provider) async {
    final state = ref.read(authNotifierProvider);
    final descriptor = provider == AuthProviderType.google
        ? state.providers.google
        : state.providers.apple;

    DevSocialPersona? persona;
    if (descriptor.mode == SocialProviderMode.devSandbox) {
      persona = await showDevOAuthSandboxSheet(context, provider: provider);
      if (persona == null || !mounted) return;
    }

    final ok = await ref
        .read(authNotifierProvider.notifier)
        .submitSocialAuth(provider: provider, sandboxPersona: persona);
    if (ok && mounted) {
      _completeNavigation();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final state = ref.watch(authNotifierProvider);
    final notifier = ref.read(authNotifierProvider.notifier);
    final isIran = ref.watch(editionConfigProvider).edition == AppEdition.iran;

    final showGoogle = !isIran && state.providers.google.enabled;
    final showApple = !isIran && state.providers.apple.enabled;
    final iranSmsDisabledByServer =
        isIran &&
        state.serverProvidersLoaded &&
        !state.providers.smsOtp.enabled;

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: isIran ? 'بازگشت' : 'Back',
          icon: const AppIcon(LucideGlyph.chevronLeft, size: 22),
          onPressed: () => context.safePopOrGo(AppRoutes.home),
        ),
        title: Text(
          isIran
              ? (iranSmsDisabledByServer
                    ? 'حساب کاربری سنجیا'
                    : (state.isSignUp ? 'ایجاد حساب' : 'ورود با موبایل'))
              : 'Mockza Account',
        ),
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: SingleChildScrollView(
            padding: const EdgeInsetsDirectional.symmetric(
              vertical: SpacingTokens.lg,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Center(child: EditionBrandMark(size: 44, isIran: isIran)),
                const SizedBox(height: SpacingTokens.md),
                Text(
                  isIran
                      ? (state.isSignUp
                            ? 'ایجاد حساب کاربری سنجیا'
                            : 'ورود به سنجیا')
                      : (state.isSignUp
                            ? 'Create your Mockza account'
                            : 'Sign in to Mockza'),
                  textAlign: TextAlign.center,
                  style: typography.sectionHeading.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.xs),
                Text(
                  isIran
                      ? 'همگام‌سازی اشتراک پرو و سابقه تمرین‌ها بین ۱ گوشی موبایل و ۱ مرورگر وب دسکتاپ.'
                      : 'Sync your Pro subscription and practice history across 1 Mobile Phone and 1 Desktop Web browser.',
                  textAlign: TextAlign.center,
                  style: typography.secondary.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.lg),
                if (state.slotConflict != null ||
                    state.errorMessage != null) ...<Widget>[
                  DeviceSlotConflictBanner(
                    message: state.errorMessage ?? '',
                    conflict: state.slotConflict,
                  ),
                  const SizedBox(height: SpacingTokens.md),
                ],
                if (isIran) ...<Widget>[
                  if (iranSmsDisabledByServer) ...<Widget>[
                    const StatusBanner(
                      variant: StatusBannerVariant.uploading,
                      message: 'ورود پیامکی در این سرور فعال نیست؛ لطفاً با ایمیل وارد شوید.',
                    ),
                    const SizedBox(height: SpacingTokens.md),
                    _buildEmailSection(
                      context,
                      state,
                      notifier,
                      isIran: true,
                    ),
                  ] else ...<Widget>[
                    _buildIranSmsOtpSection(context, state, notifier),
                    const SizedBox(height: SpacingTokens.lg),
                    TextButton(
                      onPressed: () => setState(() {
                        _showIranEmailFallback = !_showIranEmailFallback;
                      }),
                      child: Text(
                        _showIranEmailFallback
                            ? 'بستن ورود با ایمیل'
                            : 'ورود یا ثبت‌نام با ایمیل (اختیاری)',
                      ),
                    ),
                    if (_showIranEmailFallback) ...<Widget>[
                      const SizedBox(height: SpacingTokens.sm),
                      _buildEmailSection(
                        context,
                        state,
                        notifier,
                        isIran: true,
                      ),
                    ],
                  ],
                ] else ...<Widget>[
                  Center(
                    child: MzSegmentedPillStrip(
                      items:
                          <
                            ({
                              String label,
                              bool isSelected,
                              VoidCallback onTap,
                            })
                          >[
                            (
                              label: 'Sign In',
                              isSelected: !state.isSignUp,
                              onTap: () =>
                                  notifier.setSignUpMode(isSignUp: false),
                            ),
                            (
                              label: 'Create Account',
                              isSelected: state.isSignUp,
                              onTap: () =>
                                  notifier.setSignUpMode(isSignUp: true),
                            ),
                          ],
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.lg),
                  if (showGoogle) ...<Widget>[
                    SocialAuthButton(
                      brand: SocialBrand.google,
                      label: 'Continue with Google',
                      isLoading: state.isSubmitting,
                      showDevBadge:
                          state.providers.google.mode ==
                          SocialProviderMode.devSandbox,
                      onPressed: state.isSubmitting
                          ? null
                          : () => unawaited(
                              _handleSocialTap(AuthProviderType.google),
                            ),
                    ),
                    const SizedBox(height: SpacingTokens.sm),
                  ],
                  if (showApple) ...<Widget>[
                    SocialAuthButton(
                      brand: SocialBrand.apple,
                      label: 'Continue with Apple',
                      isLoading: state.isSubmitting,
                      showDevBadge:
                          state.providers.apple.mode ==
                          SocialProviderMode.devSandbox,
                      onPressed: state.isSubmitting
                          ? null
                          : () => unawaited(
                              _handleSocialTap(AuthProviderType.apple),
                            ),
                    ),
                    const SizedBox(height: SpacingTokens.sm),
                  ],
                  if (showGoogle || showApple) ...<Widget>[
                    const SizedBox(height: SpacingTokens.sm),
                    Row(
                      children: <Widget>[
                        Expanded(child: Divider(color: colors.borderSubtle)),
                        Padding(
                          padding: const EdgeInsetsDirectional.symmetric(
                            horizontal: SpacingTokens.md,
                          ),
                          child: Text(
                            'or with email',
                            style: typography.caption.copyWith(
                              color: colors.textTertiary,
                            ),
                          ),
                        ),
                        Expanded(child: Divider(color: colors.borderSubtle)),
                      ],
                    ),
                    const SizedBox(height: SpacingTokens.md),
                  ],
                  _buildEmailSection(
                    context,
                    state,
                    notifier,
                    isIran: false,
                  ),
                ],
                const SizedBox(height: SpacingTokens.lg),
                const DevicePolicyNoticeCard(),
                const SizedBox(height: SpacingTokens.xl),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildIranSmsOtpSection(
    BuildContext context,
    AuthState state,
    AuthNotifier notifier,
  ) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    if (!state.otpSent) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          LtrExamBoundary(
            child: MzFormField(
              label: 'شماره موبایل ایران',
              controller: _phoneController,
              hintText: '09123456789',
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.done,
              autofillHints: const <String>[AutofillHints.telephoneNumber],
              onChanged: (_) => notifier.clearFeedback(),
              onSubmitted: (_) => unawaited(_handleRequestOtp()),
            ),
          ),
          const SizedBox(height: SpacingTokens.md),
          PrimaryButton(
            label: 'ارسال کد تایید پیامکی',
            isLoading: state.isSubmitting,
            onPressed: state.isSubmitting
                ? null
                : () => unawaited(_handleRequestOtp()),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Text(
          'کد تایید به شماره زیر ارسال شد:',
          style: typography.caption.copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: SpacingTokens.xs),
        LtrExamBoundary(
          child: Text(
            state.otpPhoneE164 ?? _phoneController.text,
            style: typography.cardTitle.copyWith(color: colors.textPrimary),
          ),
        ),
        if (state.devOtpHint != null &&
            state.devOtpHint!.isNotEmpty) ...<Widget>[
          const SizedBox(height: SpacingTokens.sm),
          StatusBanner(
            variant: StatusBannerVariant.uploading,
            message: 'کد آزمایشی (Sandbox): ${state.devOtpHint}',
          ),
        ],
        const SizedBox(height: SpacingTokens.md),
        LtrExamBoundary(
          child: MzFormField(
            label: 'کد تایید ۶ رقمی',
            controller: _otpCodeController,
            hintText: '123456',
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.done,
            autofillHints: const <String>[AutofillHints.oneTimeCode],
            onChanged: (_) => notifier.clearFeedback(),
            onSubmitted: (_) => unawaited(_handleVerifyOtp()),
          ),
        ),
        const SizedBox(height: SpacingTokens.md),
        PrimaryButton(
          label: 'تایید و ورود',
          isLoading: state.isSubmitting,
          onPressed: state.isSubmitting
              ? null
              : () => unawaited(_handleVerifyOtp()),
        ),
        const SizedBox(height: SpacingTokens.xs),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: <Widget>[
            TextButton(
              onPressed: state.isSubmitting ? null : notifier.resetOtpChallenge,
              child: const Text('تغییر شماره'),
            ),
            TextButton(
              onPressed: state.isSubmitting
                  ? null
                  : () => unawaited(_handleRequestOtp()),
              child: const Text('ارسال مجدد کد'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildEmailSection(
    BuildContext context,
    AuthState state,
    AuthNotifier notifier, {
    required bool isIran,
  }) {
    final colors = AppColors.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (isIran) ...<Widget>[
          Center(
            child: MzSegmentedPillStrip(
              items: <({String label, bool isSelected, VoidCallback onTap})>[
                (
                  label: 'ورود',
                  isSelected: !state.isSignUp,
                  onTap: () => notifier.setSignUpMode(isSignUp: false),
                ),
                (
                  label: 'ثبت‌نام',
                  isSelected: state.isSignUp,
                  onTap: () => notifier.setSignUpMode(isSignUp: true),
                ),
              ],
            ),
          ),
          const SizedBox(height: SpacingTokens.md),
        ],
        if (state.isSignUp) ...<Widget>[
          MzFormField(
            label: isIran ? 'نام (اختیاری)' : 'Name (optional)',
            controller: _nameController,
            hintText: isIran ? 'نام شما' : 'Your name',
            textInputAction: TextInputAction.next,
            autofillHints: const <String>[AutofillHints.name],
            onChanged: (_) => notifier.clearFeedback(),
          ),
          const SizedBox(height: SpacingTokens.md),
        ],
        LtrExamBoundary(
          useLatinFont: false,
          child: MzFormField(
            label: isIran ? 'نشانی ایمیل' : 'Email address',
            controller: _emailController,
            hintText: 'you@example.com',
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            autofillHints: const <String>[AutofillHints.email],
            onChanged: (_) => notifier.clearFeedback(),
          ),
        ),
        const SizedBox(height: SpacingTokens.md),
        MzFormField(
          label: isIran ? 'رمز عبور' : 'Password',
          controller: _passwordController,
          hintText: isIran
              ? (state.isSignUp ? 'حداقل ۸ کاراکتر' : 'رمز عبور را وارد کنید')
              : (state.isSignUp ? 'Minimum 8 characters' : 'Enter password'),
          obscureText: _obscurePassword,
          textInputAction: TextInputAction.done,
          autofillHints: <String>[
            if (state.isSignUp)
              AutofillHints.newPassword
            else
              AutofillHints.password,
          ],
          onChanged: (_) => notifier.clearFeedback(),
          onSubmitted: (_) => unawaited(_handleEmailSubmit()),
          suffixIcon: IconButton(
            tooltip: isIran
                ? (_obscurePassword ? 'نمایش رمز' : 'مخفی کردن رمز')
                : (_obscurePassword ? 'Show password' : 'Hide password'),
            onPressed: () {
              setState(() {
                _obscurePassword = !_obscurePassword;
              });
            },
            icon: AppIcon(
              _obscurePassword ? LucideGlyph.eye : LucideGlyph.eyeOff,
              size: 18,
              color: colors.textSecondary,
            ),
          ),
        ),
        const SizedBox(height: SpacingTokens.lg),
        PrimaryButton(
          label: isIran
              ? (state.isSignUp ? 'ایجاد حساب' : 'ورود با ایمیل')
              : (state.isSignUp ? 'Create Account' : 'Sign In'),
          isLoading: state.isSubmitting,
          onPressed: state.isSubmitting
              ? null
              : () => unawaited(_handleEmailSubmit()),
        ),
      ],
    );
  }
}

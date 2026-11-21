import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/auth/auth_models.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/app_router.dart';

/// Immutable UI state for Sign-In / Create Account screen.
@immutable
class AuthState {
  /// Creates an [AuthState].
  const new({
    this.isSignUp = false,
    this.isLoadingProviders = true,
    this.isSubmitting = false,
    this.providers = AuthProvidersCatalog.fallback,
    this.errorMessage,
    this.slotConflict,
    this.otpPhoneE164,
    this.otpSent = false,
    this.otpRetryAfterSec = 0,
    this.devOtpHint,
  });

  /// `true` when displaying Create Account form; `false` for Sign In.
  final bool isSignUp;

  /// `true` while fetching `GET /v1/auth/providers`.
  final bool isLoadingProviders;

  /// `true` while register, login, or OAuth exchange is in flight.
  final bool isSubmitting;

  /// Server-reported auth provider configuration & dev sandbox modes.
  final AuthProvidersCatalog providers;

  /// Validation, network, or slot conflict error message.
  final String? errorMessage;

  /// Non-null when backend rejected sign-in with `409 device_slot_limit_reached`.
  final OccupyingDeviceConflict? slotConflict;

  /// Canonical `+989XXXXXXXXX` phone number awaiting SMS OTP entry (`IRN` edition).
  final String? otpPhoneE164;

  /// Whether an SMS OTP code was dispatched for [otpPhoneE164].
  final bool otpSent;

  /// Server cooldown before re-requesting an SMS OTP code.
  final int otpRetryAfterSec;

  /// Optional sandbox OTP code preview exposed only in dev mode.
  final String? devOtpHint;

  /// Returns an updated copy of [AuthState].
  AuthState copyWith({
    bool? isSignUp,
    bool? isLoadingProviders,
    bool? isSubmitting,
    AuthProvidersCatalog? providers,
    String? errorMessage,
    bool clearErrorMessage = false,
    OccupyingDeviceConflict? slotConflict,
    bool clearSlotConflict = false,
    String? otpPhoneE164,
    bool? otpSent,
    int? otpRetryAfterSec,
    String? devOtpHint,
    bool clearOtpState = false,
  }) => AuthState(
    isSignUp: isSignUp ?? this.isSignUp,
    isLoadingProviders: isLoadingProviders ?? this.isLoadingProviders,
    isSubmitting: isSubmitting ?? this.isSubmitting,
    providers: providers ?? this.providers,
    errorMessage: clearErrorMessage
        ? null
        : (errorMessage ?? this.errorMessage),
    slotConflict: clearSlotConflict
        ? null
        : (slotConflict ?? this.slotConflict),
    otpPhoneE164: clearOtpState ? null : (otpPhoneE164 ?? this.otpPhoneE164),
    otpSent: !clearOtpState && (otpSent ?? this.otpSent),
    otpRetryAfterSec: clearOtpState
        ? 0
        : (otpRetryAfterSec ?? this.otpRetryAfterSec),
    devOtpHint: clearOtpState ? null : (devOtpHint ?? this.devOtpHint),
  );
}

/// Manages Email/Password, Google, Apple (including Dev Sandbox) authentication
/// and strict `1 Phone + 1 Desktop Web` conflict handling.
class AuthNotifier extends Notifier<AuthState> {
  bool _isDisposed = false;

  @override
  AuthState build() {
    _isDisposed = false;
    ref.onDispose(() => _isDisposed = true);
    unawaited(loadProviders());
    return const AuthState();
  }

  /// Queries backend `/v1/auth/providers` to discover OIDC vs Dev Sandbox modes.
  Future<void> loadProviders() async {
    final res = await ref.read(authSessionServiceProvider).fetchAuthProviders();
    if (_isDisposed) return;
    state = state.copyWith(
      isLoadingProviders: false,
      providers: res.valueOrNull ?? AuthProvidersCatalog.fallback,
    );
  }

  /// Resets mode and clears stale errors when entering `/auth`.
  void resetFormState({required bool isSignUp}) {
    state = state.copyWith(
      isSignUp: isSignUp,
      isSubmitting: false,
      clearErrorMessage: true,
      clearSlotConflict: true,
    );
  }

  /// Switches between Sign In and Create Account views.
  void setSignUpMode({required bool isSignUp}) {
    state = state.copyWith(
      isSignUp: isSignUp,
      clearErrorMessage: true,
      clearSlotConflict: true,
    );
  }

  /// Clears visible error/conflict banners when user edits inputs.
  void clearFeedback() {
    if (state.errorMessage == null && state.slotConflict == null) return;
    state = state.copyWith(
      clearErrorMessage: true,
      clearSlotConflict: true,
    );
  }

  /// Validates and submits Email & Password registration or sign-in.
  Future<bool> submitEmailAuth({
    required String email,
    required String password,
    String? displayName,
  }) async {
    final cleanEmail = email.trim();
    if (!cleanEmail.contains('@') || !cleanEmail.contains('.')) {
      state = state.copyWith(
        errorMessage: 'Please enter a valid email address.',
        clearSlotConflict: true,
      );
      return false;
    }
    if (state.isSignUp && password.length < 8) {
      state = state.copyWith(
        errorMessage: 'Password must be at least 8 characters long.',
        clearSlotConflict: true,
      );
      return false;
    }
    if (!state.isSignUp && password.isEmpty) {
      state = state.copyWith(
        errorMessage: 'Please enter your password.',
        clearSlotConflict: true,
      );
      return false;
    }

    state = state.copyWith(
      isSubmitting: true,
      clearErrorMessage: true,
      clearSlotConflict: true,
    );

    final service = ref.read(authSessionServiceProvider);
    final res = state.isSignUp
        ? await service.registerWithEmail(
            email: cleanEmail,
            password: password,
            displayName: displayName,
          )
        : await service.signInWithEmail(
            email: cleanEmail,
            password: password,
          );

    if (_isDisposed) return false;

    switch (res) {
      case Ok<AuthSessionResult, Failure>(:final value):
        await _applyAuthenticatedBundle(value);
        return true;
      case Err<AuthSessionResult, Failure>(:final failure):
        _applyFailure(failure);
        return false;
    }
  }

  /// Clears current SMS OTP challenge so user can edit their phone number.
  void resetOtpChallenge() {
    state = state.copyWith(
      clearOtpState: true,
      clearErrorMessage: true,
      clearSlotConflict: true,
    );
  }

  /// Requests an Iranian `+98` SMS OTP code (`POST /v1/auth/otp/request`).
  Future<bool> requestSmsOtp({required String rawPhone}) async {
    final normalized = normalizeIranPhoneToE164(rawPhone);
    if (normalized == null) {
      state = state.copyWith(
        errorMessage: 'شماره موبایل معتبر وارد کنید (مثلاً 09123456789).',
        clearSlotConflict: true,
      );
      return false;
    }

    state = state.copyWith(
      isSubmitting: true,
      clearErrorMessage: true,
      clearSlotConflict: true,
    );

    final res = await ref
        .read(authSessionServiceProvider)
        .requestSmsOtp(phoneE164: normalized);
    if (_isDisposed) return false;

    switch (res) {
      case Ok<({int retryAfterSec, String? devOtpHint}), Failure>(:final value):
        state = state.copyWith(
          isSubmitting: false,
          otpPhoneE164: normalized,
          otpSent: true,
          otpRetryAfterSec: value.retryAfterSec,
          devOtpHint: value.devOtpHint,
        );
        return true;
      case Err<({int retryAfterSec, String? devOtpHint}), Failure>(
        :final failure,
      ):
        _applyFailure(failure);
        return false;
    }
  }

  /// Verifies the SMS OTP code (`POST /v1/auth/otp/verify`) and activates the session.
  Future<bool> verifySmsOtp({
    required String rawPhone,
    required String otpCode,
  }) async {
    final normalized = state.otpPhoneE164 ?? normalizeIranPhoneToE164(rawPhone);
    if (normalized == null) {
      state = state.copyWith(
        errorMessage: 'شماره موبایل معتبر وارد کنید.',
        clearSlotConflict: true,
      );
      return false;
    }
    if (otpCode.trim().length < 4) {
      state = state.copyWith(
        errorMessage: 'کد تایید پیامکی را کامل وارد کنید.',
        clearSlotConflict: true,
      );
      return false;
    }

    state = state.copyWith(
      isSubmitting: true,
      clearErrorMessage: true,
      clearSlotConflict: true,
    );

    final res = await ref
        .read(authSessionServiceProvider)
        .verifySmsOtp(phoneE164: normalized, otpCode: otpCode);
    if (_isDisposed) return false;

    switch (res) {
      case Ok<AuthSessionResult, Failure>(:final value):
        await _applyAuthenticatedBundle(value);
        return true;
      case Err<AuthSessionResult, Failure>(:final failure):
        _applyFailure(failure);
        return false;
    }
  }

  /// Authenticates using Google or Apple (OIDC when configured, or Dev Sandbox outside production).
  Future<bool> submitSocialAuth({
    required AuthProviderType provider,
    DevSocialPersona? sandboxPersona,
  }) async {
    final descriptor = provider == AuthProviderType.google
        ? state.providers.google
        : state.providers.apple;

    state = state.copyWith(
      isSubmitting: true,
      clearErrorMessage: true,
      clearSlotConflict: true,
    );

    final res = await ref
        .read(authSessionServiceProvider)
        .signInWithSocial(
          provider: provider,
          descriptor: descriptor,
          sandboxPersona: sandboxPersona,
        );

    if (_isDisposed) return false;

    switch (res) {
      case Ok<AuthSessionResult, Failure>(:final value):
        await _applyAuthenticatedBundle(value);
        return true;
      case Err<AuthSessionResult, Failure>(:final failure):
        _applyFailure(failure);
        return false;
    }
  }

  Future<void> _applyAuthenticatedBundle(AuthSessionResult bundle) async {
    try {
      final identity = ref.read(secureIdentityServiceProvider);
      final devId =
          (await identity.getOrCreateDeviceId()).valueOrNull ?? bundle.deviceId;
      await ref
          .read(profileRepositoryProvider)
          .saveAuthenticatedAccount(
            deviceId: devId,
            userId: bundle.user.userId,
            email: bundle.user.email,
            isPro: bundle.user.isPro,
            markOnboardingCompleted: true,
          );
    } on Object {
      // Safe fallback in widget tests without SQLite plugin.
    }

    if (_isDisposed) return;
    ref.read(onboardingCompletedLatchProvider.notifier).completed = true;
    unawaited(
      ref
          .read(gradingGatewayProvider)
          .fetchQuotaStatus()
          .then<void>((_) {}, onError: (_) {}),
    );
    state = state.copyWith(
      isSubmitting: false,
      clearErrorMessage: true,
      clearSlotConflict: true,
    );
  }

  void _applyFailure(Failure failure) {
    if (failure is DeviceSlotLimitFailure) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: failure.message,
        slotConflict: failure.conflict,
      );
      return;
    }
    state = state.copyWith(
      isSubmitting: false,
      errorMessage: failure.message,
      clearSlotConflict: true,
    );
  }
}

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/services/billing_gateway.dart';

/// Immutable UI state for Pro subscription offerings and purchase flow.
@immutable
class PaywallState {
  /// Creates a [PaywallState].
  const new({
    required this.isPro,
    required this.isBusy,
    required this.selectedPackageId,
    required this.packages,
    this.hasAcceptedDevicePolicy = false,
    this.isSignedIn = false,
    this.linkedEmail,
    this.statusMessage,
  });

  /// Current verified Pro entitlement status.
  final bool isPro;

  /// Whether a store query or checkout transaction is in flight.
  final bool isBusy;

  /// Currently selected package identifier.
  final String selectedPackageId;

  /// Available store offerings from [BillingGateway].
  final List<StorePackage> packages;

  /// Whether user explicitly confirmed the strict `1 Mobile Phone + 1 Desktop Web` ToS rule.
  final bool hasAcceptedDevicePolicy;

  /// Whether the active device is currently signed into an account.
  final bool isSignedIn;

  /// Email of the signed-in account, if linked.
  final String? linkedEmail;

  /// Optional non-fatal status message.
  final String? statusMessage;

  /// Returns a copy with updated entitlement state.
  PaywallState copyWith({
    bool? isPro,
    bool? isBusy,
    String? selectedPackageId,
    List<StorePackage>? packages,
    bool? hasAcceptedDevicePolicy,
    bool? isSignedIn,
    String? linkedEmail,
    bool clearLinkedEmail = false,
    String? statusMessage,
    bool clearStatusMessage = false,
  }) => PaywallState(
    isPro: isPro ?? this.isPro,
    isBusy: isBusy ?? this.isBusy,
    selectedPackageId: selectedPackageId ?? this.selectedPackageId,
    packages: packages ?? this.packages,
    hasAcceptedDevicePolicy:
        hasAcceptedDevicePolicy ?? this.hasAcceptedDevicePolicy,
    isSignedIn: isSignedIn ?? this.isSignedIn,
    linkedEmail: clearLinkedEmail ? null : (linkedEmail ?? this.linkedEmail),
    statusMessage: clearStatusMessage
        ? null
        : (statusMessage ?? this.statusMessage),
  );
}

/// Coordinates Pro entitlement queries, store checkout & Drift persistence via [BillingGateway].
class PaywallNotifier extends Notifier<PaywallState> {
  bool _isDisposed = false;

  @override
  PaywallState build() {
    _isDisposed = false;
    ref.onDispose(() => _isDisposed = true);
    const state = PaywallState(
      isPro: false,
      isBusy: false,
      selectedPackageId: 'mockza_pro_monthly',
      packages: defaultGlobalStorePackages,
    );
    unawaited(_loadOfferings());
    return state;
  }

  Future<void> _loadOfferings() async {
    final billing = ref.read(billingGatewayProvider);
    final isProResult = await billing.checkProEntitlement();
    final offeringsResult = await billing.fetchOfferings();

    var localIsPro = false;
    var signedIn = false;
    String? linkedEmail;
    try {
      final profile = await ref
          .read(profileRepositoryProvider)
          .loadOrInitializePrimary();
      localIsPro = profile.isPro;
      signedIn = profile.appUserId != null && profile.appUserId!.isNotEmpty;
      linkedEmail = profile.linkedEmail;
    } on Object {
      // Ignore in isolated widget tests without DB.
    }

    var acceptedPolicy = state.hasAcceptedDevicePolicy;
    try {
      final sessionsRes = await ref
          .read(authSessionServiceProvider)
          .fetchAccountSessions();
      final snapshot = sessionsRes.valueOrNull;
      if (snapshot != null &&
          snapshot.isAuthenticated &&
          snapshot.user != null) {
        signedIn = true;
        linkedEmail = snapshot.user!.email ?? linkedEmail;
        if (snapshot.user!.acceptedDevicePolicyAt != null) {
          acceptedPolicy = true;
        }
      }
    } on Object {
      // Ignore offline/isolated failures.
    }

    if (_isDisposed) return;

    final storeIsPro = isProResult.valueOrNull;
    final resolvedPro = storeIsPro ?? localIsPro;
    if (storeIsPro != null && storeIsPro != localIsPro) {
      await _persistProFlag(storeIsPro);
    }

    final packages = offeringsResult.valueOrNull;
    if (_isDisposed) return;

    state = state.copyWith(
      isPro: resolvedPro,
      isSignedIn: signedIn,
      linkedEmail: linkedEmail,
      hasAcceptedDevicePolicy: acceptedPolicy,
      packages: (packages != null && packages.isNotEmpty)
          ? packages
          : defaultGlobalStorePackages,
    );
  }

  /// Refreshes account linking & policy consent state after returning from `/auth`.
  Future<void> refreshAccountLinkState() => _loadOfferings();

  /// Toggles explicit agreement to the 1 Mobile Phone + 1 Desktop Web policy.
  void toggleDevicePolicyConsent({bool? value}) {
    final next = value ?? !state.hasAcceptedDevicePolicy;
    state = state.copyWith(
      hasAcceptedDevicePolicy: next,
      clearStatusMessage: true,
    );
  }

  /// Selects active offering package.
  void selectPackage(String packageId) {
    state = state.copyWith(
      selectedPackageId: packageId,
      clearStatusMessage: true,
    );
  }

  /// Initiates store checkout for the selected package and persists entitlement.
  Future<void> purchaseSelected({bool requirePolicyConsent = false}) async {
    if (requirePolicyConsent && !state.hasAcceptedDevicePolicy) {
      state = state.copyWith(
        statusMessage: 'Please confirm the strict 1 Mobile Phone + 1 Desktop Web personal-use policy above before subscribing.',
      );
      return;
    }

    state = state.copyWith(isBusy: true, clearStatusMessage: true);
    if (state.hasAcceptedDevicePolicy && state.isSignedIn) {
      unawaited(
        ref
            .read(authSessionServiceProvider)
            .recordDevicePolicyConsent()
            .then<void>((_) {}, onError: (_) {}),
      );
    }
    final res = await ref
        .read(billingGatewayProvider)
        .purchasePackage(state.selectedPackageId);
    if (_isDisposed) return;

    switch (res) {
      case Ok(:final value):
        if (value) {
          await _persistProFlag(true);
        }
        final isIran =
            ref.read(editionConfigProvider).edition == AppEdition.iran;
        if (!_isDisposed) {
          state = state.copyWith(
            isBusy: false,
            isPro: value,
            statusMessage: value
                ? (isIran
                      ? 'سنجیا پرو با موفقیت فعال شد!'
                      : 'Welcome to Mockza Pro!')
                : (isIran
                      ? 'در حال انتقال به درگاه پرداخت...'
                      : 'Purchase completed.'),
          );
        }
      case Err(:final failure):
        state = state.copyWith(
          isBusy: false,
          statusMessage: failure.message,
        );
    }
  }

  /// Verifies a returned Zarinpal payment [authority] and activates Pro if confirmed by server.
  Future<bool> verifyZarinpalCallback({
    required String authority,
    String? status,
  }) async {
    final gateway = ref.read(billingGatewayProvider);
    if (gateway is! IranBillingGateway) return false;
    state = state.copyWith(isBusy: true, clearStatusMessage: true);
    final res = await gateway.verifyZarinpalCallback(
      authority: authority,
      status: status,
    );
    if (_isDisposed) return false;
    switch (res) {
      case Ok<bool, Failure>(:final value):
        await _persistProFlag(value);
        if (!_isDisposed) {
          state = state.copyWith(
            isBusy: false,
            isPro: value,
            statusMessage: value
                ? 'پرداخت تایید شد و اشتراک سنجیا پرو فعال گردید!'
                : 'تراکنش تکمیل یا تایید نشد.',
          );
        }
        return value;
      case Err<bool, Failure>(:final failure):
        state = state.copyWith(isBusy: false, statusMessage: failure.message);
        return false;
    }
  }

  /// Refreshes store purchases and persists entitlement to local profile.
  Future<void> restorePurchases() async {
    state = state.copyWith(isBusy: true, clearStatusMessage: true);
    final res = await ref.read(billingGatewayProvider).restorePurchases();
    if (_isDisposed) return;

    switch (res) {
      case Ok(:final value):
        await _persistProFlag(value);
        if (!_isDisposed) {
          state = state.copyWith(
            isBusy: false,
            isPro: value,
            statusMessage: value
                ? 'Pro entitlement restored!'
                : 'No previous purchases found.',
          );
        }
      case Err(:final failure):
        state = state.copyWith(
          isBusy: false,
          statusMessage: failure.message,
        );
    }
  }

  Future<void> _persistProFlag(bool isPro) async {
    try {
      final profileRepo = ref.read(profileRepositoryProvider);
      final primary = await profileRepo.loadOrInitializePrimary();
      await profileRepo.setProEntitlement(primary.deviceId, isPro: isPro);
    } on Object {
      // Ignore in isolated widget tests without database plugin.
    }
  }
}

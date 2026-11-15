import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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

  /// Optional non-fatal status message.
  final String? statusMessage;

  /// Returns a copy with updated entitlement state.
  PaywallState copyWith({
    bool? isPro,
    bool? isBusy,
    String? selectedPackageId,
    List<StorePackage>? packages,
    String? statusMessage,
    bool clearStatusMessage = false,
  }) => PaywallState(
    isPro: isPro ?? this.isPro,
    isBusy: isBusy ?? this.isBusy,
    selectedPackageId: selectedPackageId ?? this.selectedPackageId,
    packages: packages ?? this.packages,
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
    try {
      final profile = await ref
          .read(profileRepositoryProvider)
          .loadOrInitializePrimary();
      localIsPro = profile.isPro;
    } on Object {
      // Ignore in isolated widget tests without DB.
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
      packages: (packages != null && packages.isNotEmpty)
          ? packages
          : defaultGlobalStorePackages,
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
  Future<void> purchaseSelected() async {
    state = state.copyWith(isBusy: true, clearStatusMessage: true);
    final res = await ref
        .read(billingGatewayProvider)
        .purchasePackage(state.selectedPackageId);
    if (_isDisposed) return;

    switch (res) {
      case Ok(:final value):
        await _persistProFlag(value);
        if (!_isDisposed) {
          state = state.copyWith(
            isBusy: false,
            isPro: value,
            statusMessage: value
                ? 'Welcome to Mockza Pro!'
                : 'Purchase completed.',
          );
        }
      case Err(:final failure):
        state = state.copyWith(
          isBusy: false,
          statusMessage: failure.message,
        );
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

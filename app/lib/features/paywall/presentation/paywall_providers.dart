import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/paywall/presentation/paywall_notifier.dart';

/// Provides [PaywallState] via [PaywallNotifier].
final NotifierProvider<PaywallNotifier, PaywallState> paywallNotifierProvider =
    NotifierProvider<PaywallNotifier, PaywallState>(PaywallNotifier.new);

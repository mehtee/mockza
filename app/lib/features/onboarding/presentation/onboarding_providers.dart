import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/onboarding/presentation/onboarding_notifier.dart';

/// Provides [OnboardingState] via [OnboardingNotifier].
final NotifierProvider<OnboardingNotifier, OnboardingState>
onboardingNotifierProvider =
    NotifierProvider<OnboardingNotifier, OnboardingState>(
      OnboardingNotifier.new,
    );

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/auth/presentation/auth_notifier.dart';

/// Provides [AuthState] via [AuthNotifier].
final NotifierProvider<AuthNotifier, AuthState> authNotifierProvider =
    NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

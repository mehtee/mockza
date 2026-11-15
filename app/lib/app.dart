import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/settings/presentation/settings_providers.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/app_router.dart';
import 'package:mockza/theme/app_theme.dart';

/// Root Mockza widget wiring themes, localization, lifecycle sync, and `GoRouter`.
class MockzaApp extends ConsumerStatefulWidget {
  /// Creates the root [MockzaApp].
  const new({super.key});

  @override
  ConsumerState<MockzaApp> createState() => _MockzaAppState();
}

class _MockzaAppState extends ConsumerState<MockzaApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(_bootstrapServices());
    });
  }

  Future<void> _bootstrapServices() async {
    try {
      final identity = ref.read(secureIdentityServiceProvider);
      final deviceRes = await identity.getOrCreateDeviceId();
      final fallbackId =
          deviceRes.valueOrNull ?? ref.read(entropySourceProvider).nextUuidV4();
      await ref
          .read(profileRepositoryProvider)
          .loadOrInitializePrimary(fallbackDeviceId: fallbackId);
      await ref.read(contentSyncServiceProvider).syncAllCatalogData();
      await ref.read(outboxSyncServiceProvider).processPendingQueue();
    } on Object catch (e, st) {
      ref.read(crashLogProvider).recordError(e, st);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    ref.read(crashLogProvider).info('Lifecycle state -> ${state.name}');
    if (state == AppLifecycleState.resumed) {
      unawaited(ref.read(outboxSyncServiceProvider).processPendingQueue());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    final themeModeStr = ref.watch(
      settingsNotifierProvider.select((s) => s.themeMode),
    );
    final themeMode = switch (themeModeStr) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
    return MaterialApp.router(
      onGenerateTitle: (ctx) => AppLocalizations.of(ctx).appTitle,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: themeMode,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: router,
    );
  }
}

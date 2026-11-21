import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/app_router.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/native/share_intent_bridge.dart';
import 'package:mockza/theme/app_theme.dart';
import 'package:mockza/theme/theme_catalog.dart';

/// Root Mockza widget wiring themes, localization, lifecycle sync, and `GoRouter`.
class MockzaApp extends ConsumerStatefulWidget {
  /// Creates the root [MockzaApp].
  const new({super.key});

  @override
  ConsumerState<MockzaApp> createState() => _MockzaAppState();
}

class _MockzaAppState extends ConsumerState<MockzaApp>
    with WidgetsBindingObserver {
  StreamSubscription<InboundSharePayload>? _shareSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(_bootstrapServices());
    });
  }

  void _routeInboundShare(InboundSharePayload payload) {
    if (!mounted) return;
    unawaited(
      ref
          .read(appRouterProvider)
          .push(
            AppRoutes.dropIngest,
            extra: payload,
          ),
    );
  }

  Future<void> _bootstrapServices() async {
    try {
      final shareBridge = ref.read(shareIntentBridgeProvider);
      _shareSub ??= shareBridge.incomingShares.listen(_routeInboundShare);
      final initialShare = await shareBridge.initializeAndDrainInitialShare();

      final identity = ref.read(secureIdentityServiceProvider);
      final deviceRes = await identity.getOrCreateDeviceId();
      final fallbackId =
          deviceRes.valueOrNull ?? ref.read(entropySourceProvider).nextUuidV4();
      await ref
          .read(profileRepositoryProvider)
          .loadOrInitializePrimary(fallbackDeviceId: fallbackId);
      await ref.read(contentSyncServiceProvider).syncAllCatalogData();
      await ref.read(outboxSyncServiceProvider).processPendingQueue();

      if (initialShare != null) {
        _routeInboundShare(initialShare);
      }
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
    unawaited(_shareSub?.cancel());
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);
    final appearance = ref.watch(appearanceSettingsProvider);
    final preset = MzThemeCatalog.resolvePreset(appearance.presetId);
    final persian = ref.watch(editionConfigProvider).edition == AppEdition.iran;
    final themeMode = switch (appearance.themeModeKey) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
    return MaterialApp.router(
      onGenerateTitle: (ctx) => AppLocalizations.of(ctx).appTitle,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.build(
        preset: preset,
        brightness: Brightness.light,
        persian: persian,
      ),
      darkTheme: AppTheme.build(
        preset: preset,
        brightness: Brightness.dark,
        persian: persian,
      ),
      locale: persian ? const Locale('fa') : null,
      themeMode: themeMode,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: router,
    );
  }
}

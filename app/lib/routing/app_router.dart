import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/features/auth/presentation/auth_screen.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_intro_screen.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_results_screen.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_session_screen.dart';
import 'package:mockza/features/drop_anything/presentation/drop_drill_screen.dart';
import 'package:mockza/features/drop_anything/presentation/drop_hub_screen.dart';
import 'package:mockza/features/evaluation_review/presentation/evaluation_review_screen.dart';
import 'package:mockza/features/home/presentation/home_screen.dart';
import 'package:mockza/features/linguistic_mission/presentation/daily_mission_screen.dart';
import 'package:mockza/features/linguistic_mission/presentation/linguistic_graph_screen.dart';
import 'package:mockza/features/listening_sim/presentation/listening_sim_screen.dart';
import 'package:mockza/features/micro_drills/presentation/micro_drills_screen.dart';
import 'package:mockza/features/onboarding/presentation/onboarding_screen.dart';
import 'package:mockza/features/paywall/presentation/billing_callback_screen.dart';
import 'package:mockza/features/paywall/presentation/paywall_screen.dart';
import 'package:mockza/features/practice_hub/presentation/full_mock_screen.dart';
import 'package:mockza/features/practice_hub/presentation/practice_hub_screen.dart';
import 'package:mockza/features/practice_hub/presentation/practice_setup_screen.dart';
import 'package:mockza/features/progress/presentation/progress_attempts_screen.dart';
import 'package:mockza/features/progress/presentation/progress_screen.dart';
import 'package:mockza/features/progress/presentation/progress_skill_screen.dart';
import 'package:mockza/features/reading_sim/presentation/reading_sim_screen.dart';
import 'package:mockza/features/register_shifter/presentation/register_shifter_screen.dart';
import 'package:mockza/features/settings/presentation/settings_screen.dart';
import 'package:mockza/features/speaking_sim/presentation/speaking_sim_screen.dart';
import 'package:mockza/features/vocabulary/presentation/vocab_review_screen.dart';
import 'package:mockza/features/vocabulary/presentation/vocab_word_detail_screen.dart';
import 'package:mockza/features/vocabulary/presentation/vocabulary_screen.dart';
import 'package:mockza/features/writing_sim/presentation/writing_sim_screen.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/app_scaffold_shell.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/primitives.dart';

/// Synchronous in-memory latch so onboarding completion immediately unblocks
/// [GoRouter] redirects before Drift's stream emits on the next microtask.
class OnboardingCompletedLatch extends Notifier<bool> {
  @override
  bool build() => false;

  /// Synchronous completion flag.
  bool get completed => state;

  /// Updates the synchronous onboarding completion latch.
  set completed(bool value) {
    state = value;
  }
}

/// Provides [OnboardingCompletedLatch] to coordinate onboarding completion and account wipes.
final NotifierProvider<OnboardingCompletedLatch, bool>
onboardingCompletedLatchProvider =
    NotifierProvider<OnboardingCompletedLatch, bool>(
      OnboardingCompletedLatch.new,
    );

/// Streams whether initial learner onboarding has completed (`null` while loading).
final StreamProvider<bool?> _onboardingGateProvider = StreamProvider<bool?>((
  ref,
) async* {
  final repo = ref.watch(profileRepositoryProvider);
  final identity = ref.watch(secureIdentityServiceProvider);
  try {
    final idRes = await identity.getOrCreateDeviceId();
    await repo.loadOrInitializePrimary(
      fallbackDeviceId: idRes.valueOrNull ?? 'anonymous-device',
    );
  } on Object {
    // Ignore when running isolated tests without platform storage.
  }
  await for (final profile in repo.watchPrimaryProfile()) {
    yield profile?.onboardingCompleted ?? false;
  }
});

class _RouterRefreshNotifier extends ChangeNotifier {
  new(Ref ref) {
    _sub = ref.listen<AsyncValue<bool?>>(
      _onboardingGateProvider,
      (_, _) => notifyListeners(),
      fireImmediately: true,
    );
  }

  late final ProviderSubscription<AsyncValue<bool?>> _sub;

  @override
  void dispose() {
    _sub.close();
    super.dispose();
  }
}

/// Root application [GoRouter] instance (sole router in the codebase per ADR-005).
final Provider<GoRouter> appRouterProvider = Provider<GoRouter>((ref) {
  final refreshListenable = _RouterRefreshNotifier(ref);

  final router = GoRouter(
    initialLocation: AppRoutes.home,
    refreshListenable: refreshListenable,
    redirect: (context, state) {
      final gateValue = ref.read(_onboardingGateProvider).asData?.value;
      final latched = ref.read(onboardingCompletedLatchProvider);
      if (gateValue == null && !latched) return null;
      final completed = latched || (gateValue ?? false);
      final loc = state.matchedLocation;
      if (!completed && loc != AppRoutes.onboarding && loc != AppRoutes.auth) {
        return AppRoutes.onboarding;
      }
      if (completed && loc == AppRoutes.onboarding) {
        return AppRoutes.home;
      }
      return null;
    },
    routes: <RouteBase>[
      StatefulShellRoute.indexedStack(
        builder:
            (
              context,
              state,
              navigationShell,
            ) => AppScaffoldShell(
              currentIndex: navigationShell.currentIndex,
              onSelectTab: (index) => navigationShell.goBranch(
                index,
                initialLocation: index == navigationShell.currentIndex,
              ),
              onOpenSettings: () => context.push(AppRoutes.settings),
              child: navigationShell,
            ),
        branches: <StatefulShellBranch>[
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: AppRoutes.home,
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: AppRoutes.practice,
                builder: (context, state) => const PracticeHubScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: AppRoutes.vocabulary,
                builder: (context, state) => const VocabularyScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: AppRoutes.progress,
                builder: (context, state) => const ProgressScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: AppRoutes.onboarding,
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: AppRoutes.settings,
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: AppRoutes.paywall,
        builder: (context, state) => const PaywallScreen(),
      ),
      GoRoute(
        path: AppRoutes.billingCallback,
        builder: (context, state) => BillingCallbackScreen(
          authority:
              state.uri.queryParameters['Authority'] ??
              state.uri.queryParameters['authority'] ??
              '',
          status:
              state.uri.queryParameters['Status'] ??
              state.uri.queryParameters['status'],
        ),
      ),
      GoRoute(
        path: AppRoutes.auth,
        builder: (context, state) => AuthScreen(
          initialIsSignUp: state.uri.queryParameters['mode'] == 'signup',
          returnTo: state.uri.queryParameters['returnTo'],
        ),
      ),
      GoRoute(
        path: AppRoutes.diagnosticIntro,
        builder: (context, state) => DiagnosticIntroScreen(
          examId: state.uri.queryParameters['examId'],
          initialMode: state.uri.queryParameters['mode'],
        ),
      ),
      GoRoute(
        path: AppRoutes.diagnosticSession,
        builder: (context, state) => DiagnosticSessionScreen(
          diagId: state.pathParameters['diagId'] ?? '',
        ),
      ),
      GoRoute(
        path: AppRoutes.diagnosticResults,
        builder: (context, state) => DiagnosticResultsScreen(
          diagId: state.pathParameters['diagId'] ?? '',
        ),
      ),
      GoRoute(
        path: AppRoutes.practiceSetup,
        builder: (context, state) => PracticeSetupScreen(
          skill: state.pathParameters['skill'] ?? 'speaking',
        ),
      ),
      GoRoute(
        path: AppRoutes.practiceFullMock,
        builder: (context, state) => FullMockScreen(
          mockId: state.pathParameters['mockId'] ?? 'mock-acad-01',
        ),
      ),
      GoRoute(
        path: AppRoutes.speakingSim,
        builder: (context, state) => SpeakingSimScreen(
          examId: state.pathParameters['examId'] ?? 'ielts-speaking-seed-01',
          isExamMode: state.uri.queryParameters['mode'] != 'study',
          mockSessionId: state.uri.queryParameters['mockSessionId'],
          mockStageKey: state.uri.queryParameters['mockStageKey'],
        ),
      ),
      GoRoute(
        path: AppRoutes.writingSim,
        builder: (context, state) => WritingSimScreen(
          taskId: state.pathParameters['taskId'] ?? 'ielts-writing-seed-01',
          isExamMode: state.uri.queryParameters['mode'] != 'study',
          mockSessionId: state.uri.queryParameters['mockSessionId'],
          mockStageKey: state.uri.queryParameters['mockStageKey'],
          initialTaskIndex:
              int.tryParse(state.uri.queryParameters['taskIndex'] ?? '') ?? 0,
        ),
      ),
      GoRoute(
        path: AppRoutes.readingSim,
        builder: (context, state) => ReadingSimScreen(
          packId:
              state.pathParameters['packId'] ?? 'ielts-acad-reading-seed-01',
          isExamMode: state.uri.queryParameters['mode'] != 'study',
          mockSessionId: state.uri.queryParameters['mockSessionId'],
          mockStageKey: state.uri.queryParameters['mockStageKey'],
        ),
      ),
      GoRoute(
        path: AppRoutes.listeningSim,
        builder: (context, state) => ListeningSimScreen(
          packId: state.pathParameters['packId'] ?? 'ielts-listening-seed-01',
          isExamMode: state.uri.queryParameters['mode'] != 'study',
          mockSessionId: state.uri.queryParameters['mockSessionId'],
          mockStageKey: state.uri.queryParameters['mockStageKey'],
        ),
      ),
      GoRoute(
        path: AppRoutes.microDrill,
        builder: (context, state) => MicroDrillsScreen(
          drillId: state.pathParameters['drillId'] ?? 'ielts-micro-drill-01',
        ),
      ),
      GoRoute(
        path: AppRoutes.microDrills,
        builder: (context, state) => const MicroDrillsScreen(),
      ),
      GoRoute(
        path: AppRoutes.attemptReview,
        builder: (context, state) => EvaluationReviewScreen(
          attemptId: state.pathParameters['attemptId'] ?? 'unknown',
        ),
      ),
      GoRoute(
        path: AppRoutes.vocabReview,
        builder: (context, state) {
          final rawLimit = state.uri.queryParameters['limit'];
          final batchLimit = rawLimit == 'all'
              ? null
              : (int.tryParse(rawLimit ?? '') ?? 20);
          return VocabReviewScreen(
            reviewAhead: state.uri.queryParameters['mode'] == 'ahead',
            batchLimit: batchLimit,
          );
        },
      ),
      GoRoute(
        path: AppRoutes.vocabWordDetail,
        builder: (context, state) => VocabWordDetailScreen(
          wordId: state.pathParameters['wordId'] ?? 'unknown',
        ),
      ),
      GoRoute(
        path: AppRoutes.progressSkill,
        builder: (context, state) => ProgressSkillScreen(
          skill: state.pathParameters['skill'] ?? 'speaking',
        ),
      ),
      GoRoute(
        path: AppRoutes.progressAttempts,
        builder: (context, state) => const ProgressAttemptsScreen(),
      ),
      GoRoute(
        path: AppRoutes.linguisticGraph,
        builder: (context, state) => const LinguisticGraphScreen(),
      ),
      GoRoute(
        path: AppRoutes.dailyMission,
        builder: (context, state) => DailyMissionScreen(
          missionId: state.pathParameters['missionId'] ?? 'today',
        ),
      ),
      GoRoute(
        path: AppRoutes.registerShifter,
        builder: (context, state) => const RegisterShifterScreen(),
      ),
      GoRoute(
        path: AppRoutes.registerShifterRun,
        builder: (context, state) => RegisterShifterScreen(
          runId: state.pathParameters['runId'],
        ),
      ),
      GoRoute(
        path: AppRoutes.dropIngest,
        builder: (context, state) => DropHubScreen(
          initialUrl: state.uri.queryParameters['url'],
          initialText: state.uri.queryParameters['text'],
        ),
      ),
      GoRoute(
        path: AppRoutes.dropDrill,
        builder: (context, state) => DropDrillScreen(
          dropId: state.pathParameters['dropId'] ?? '',
        ),
      ),
    ],
    errorBuilder: (context, state) {
      final l10n = AppLocalizations.of(context);
      final colors = AppColors.of(context);
      final typography = AppTypography.of(context);

      return MzScaffold(
        appBar: AppBar(title: Text(l10n.routeNotFoundTitle)),
        body: Center(
          child: Padding(
            padding: const EdgeInsetsDirectional.all(SpacingTokens.xl),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                const AppIcon(LucideGlyph.info, size: 48),
                const SizedBox(height: SpacingTokens.lg),
                Text(
                  'Screen Not Found',
                  style: typography.cardTitle.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.sm),
                Text(
                  'The requested route does not exist or has been moved.',
                  textAlign: TextAlign.center,
                  style: typography.body.copyWith(color: colors.textSecondary),
                ),
                const SizedBox(height: SpacingTokens.xl),
                PrimaryButton(
                  label: l10n.backToHome,
                  onPressed: () => context.go(AppRoutes.home),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );

  ref.onDispose(() {
    refreshListenable.dispose();
    router.dispose();
  });
  return router;
});

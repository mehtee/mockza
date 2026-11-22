import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/personalization_gateway.dart';

/// Resolves an adaptive [RoadmapStepDto] deterministically to an [AppRoutes] path
/// without cross-feature imports so Home, Roadmap, and PlanImpactCard stay decoupled.
String resolveFlutterRoadmapStepRoute(RoadmapStepDto step) {
  final entityId = (step.targetEntityId ?? '').trim();
  switch (step.stepKind) {
    case 'vocab_wave':
    case 'pronunciation':
      return AppRoutes.vocabulary;
    case 'micro_drill':
      return entityId.isNotEmpty
          ? AppRoutes.buildMicroDrill(entityId)
          : AppRoutes.buildMicroDrill();
    case 'daily_mission':
      return AppRoutes.buildDailyMission();
    case 'register_shifter':
      return AppRoutes.registerShifter;
    case 'drop_anything':
      return AppRoutes.dropIngest;
    case 'full_mock':
      return AppRoutes.buildPracticeFullMock(
        entityId.isNotEmpty ? entityId : 'mock-acad-01',
      );
    case 'diagnostic':
      return AppRoutes.buildDiagnosticIntro();
    case 'practice_section':
    case 'practice_pack':
      switch (step.skill) {
        case 'listening':
          return entityId.isNotEmpty
              ? AppRoutes.buildListeningSim(entityId)
              : AppRoutes.buildListeningSim();
        case 'writing':
          return entityId.isNotEmpty
              ? AppRoutes.buildWritingSim(entityId)
              : AppRoutes.buildWritingSim();
        case 'speaking':
          return entityId.isNotEmpty
              ? AppRoutes.buildSpeakingSim(entityId)
              : AppRoutes.buildSpeakingSim();
        case 'reading':
          return entityId.isNotEmpty
              ? AppRoutes.buildReadingSim(entityId)
              : AppRoutes.buildReadingSim();
        default:
          break;
      }
  }

  final route = step.targetRoute.trim();
  if (route == '/vocab' || route == '/vocabulary') return AppRoutes.vocabulary;
  if (route == '/drills') {
    return entityId.isNotEmpty
        ? AppRoutes.buildMicroDrill(entityId)
        : AppRoutes.buildMicroDrill();
  }
  if (route == '/coach') return AppRoutes.buildDailyMission();
  if (route == '/register-shifter') return AppRoutes.registerShifter;
  if (route == '/drop') return AppRoutes.dropIngest;
  if (route == '/practice') return AppRoutes.practice;
  return route.startsWith('/') ? route : AppRoutes.practice;
}

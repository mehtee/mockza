import type { PersonalizationStateDto } from '@/gateways/personalization.gateway';

export type RoadmapStepDto = PersonalizationStateDto['roadmap']['steps'][number];

function inferPackSkillFromId(packId: string | null | undefined, stepSkill?: string): 'reading' | 'listening' | 'writing' | 'speaking' | null {
  if (
    stepSkill === 'reading' ||
    stepSkill === 'listening' ||
    stepSkill === 'writing' ||
    stepSkill === 'speaking'
  ) {
    return stepSkill;
  }
  const lower = (packId ?? '').toLowerCase();
  if (lower.includes('reading')) return 'reading';
  if (lower.includes('listening')) return 'listening';
  if (lower.includes('writing')) return 'writing';
  if (lower.includes('speaking')) return 'speaking';
  return null;
}

/**
 * Resolves any RoadmapStepDto into a canonical Web SPA route under `/app` basepath,
 * preventing 404s from raw backend route templates.
 */
export function resolveWebRoadmapStepPath(step: RoadmapStepDto): string {
  const entityId = step.targetEntityId ?? '';
  switch (step.stepKind) {
    case 'diagnostic':
      return '/diagnostic/intro';
    case 'vocab_wave':
      return '/vocabulary';
    case 'daily_mission':
      return '/mission/today';
    case 'register_shifter':
      return '/register-shifter';
    case 'drop_anything':
      return '/drop';
    case 'micro_drill':
      return entityId ? `/practice/drills/${encodeURIComponent(entityId)}` : '/practice/drills';
    case 'full_mock':
      return entityId ? `/practice/full-mock/${encodeURIComponent(entityId)}` : '/practice/full-mock';
    case 'practice_section':
    case 'practice_pack': {
      const skill = inferPackSkillFromId(entityId, step.skill);
      if (entityId && skill) {
        return `/practice/${skill}/${encodeURIComponent(entityId)}`;
      }
      return '/practice';
    }
    case 'pronunciation':
      return '/progress';
    default:
      return '/roadmap';
  }
}

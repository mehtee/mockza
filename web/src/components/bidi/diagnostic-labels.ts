import {
  formatMicroDrillCategoryLabel,
  getMicroDrillItemHeaderTitle,
} from '@mockza/domain';
import type { EditionCode } from '@/edition/edition-config';
import { formatChromeNumber } from '@/edition/bidi/numerals';
import type { AudioErrorCode } from '@/gateways/result';
import { translate } from '@/i18n';
import { formatSkillLabel, formatTopicLabel } from './topic-labels';

export function localizeAudioError(
  error: { readonly code?: AudioErrorCode; readonly message: string },
  edition: EditionCode,
): string {
  switch (error.code) {
    case 'PERMISSION_DENIED':
      return translate(edition, 'micErrPermissionDenied');
    case 'NO_MICROPHONE':
      return translate(edition, 'micErrNoDevice');
    case 'MUTED_MICROPHONE':
      return translate(edition, 'micErrMuted');
    case 'LOCKED_EXAM_PLAYBACK':
      return translate(edition, 'micErrLockedPlayback');
    case 'CODEC_UNSUPPORTED':
      return translate(edition, 'micErrCodecUnsupported');
    case 'RECORDING_FAILED':
      return translate(edition, 'micErrRecordingFailed');
    case 'PLAYBACK_FAILED':
      return translate(edition, 'micErrPlaybackFailed');
    default:
      return error.message;
  }
}

export function localizeScaleLabel(
  scaleLabel: string,
  edition: EditionCode,
): string {
  if (scaleLabel === 'Estimated Band') {
    return translate(edition, 'scaleEstimatedBandLabel');
  }
  if (scaleLabel === 'Estimated Score') {
    return translate(edition, 'scaleEstimatedScoreLabel');
  }
  return scaleLabel;
}

export function localizeDiagnosticAction(
  action: {
    readonly title: string;
    readonly description: string;
    readonly targetSkill: string | null;
  },
  edition: EditionCode,
): { readonly title: string; readonly description: string } {
  const practiceMatch = /^Practice (Reading|Listening|Writing|Speaking):\s*(.+)$/i.exec(
    action.title.trim(),
  );

  let localizedTitle = action.title;
  if (practiceMatch?.[1] && practiceMatch[2]) {
    const rawSkill = practiceMatch[1].toLowerCase();
    const rawFocus = practiceMatch[2].trim();
    localizedTitle = translate(edition, 'diagActionPracticeSkill', {
      skill: formatSkillLabel(rawSkill, edition),
      focus: formatTopicLabel(rawFocus, edition),
    });
  } else if (
    action.title.trim() === 'Explore starter practice across skills'
  ) {
    localizedTitle = translate(edition, 'diagActionExploreTitle');
  }

  let localizedDescription = action.description;
  if (
    action.description.trim() ===
    'Targeted short practice based directly on what appeared in your starting check.'
  ) {
    localizedDescription = translate(edition, 'diagActionPracticeDesc');
  } else if (
    action.description.trim() ===
    'A short starting check. Your profile improves as you complete everyday Reading, Listening, Writing, and Speaking practice.'
  ) {
    localizedDescription = translate(edition, 'diagActionExploreDesc');
  }

  return { title: localizedTitle, description: localizedDescription };
}

function localizeBroadBandLabel(band: string, edition: EditionCode): string {
  switch (band.trim()) {
    case 'Foundational':
      return translate(edition, 'diagLevelFoundational');
    case 'Intermediate':
      return translate(edition, 'diagLevelIntermediate');
    case 'Upper-Intermediate':
      return translate(edition, 'diagLevelUpperIntermediate');
    case 'Advanced':
      return translate(edition, 'diagLevelAdvanced');
    case 'Upper-Intermediate to Advanced':
      return translate(edition, 'diagLevelUpperToAdvanced');
    default:
      return band;
  }
}

export function localizeDiagnosticLevel(
  raw: string,
  edition: EditionCode,
): string {
  if (edition !== 'irn') return raw;
  const match =
    /^Suggested practice:\s*(.+?)\s*\(([^)]+?)\s*focus\)\s*(?:—|-)\s*(provisional(?:\s*\(reduced sampling\))?)$/i.exec(
      raw.trim(),
    );
  if (!match?.[1] || !match[2] || !match[3]) {
    return raw;
  }
  const band = localizeBroadBandLabel(match[1], edition);
  const range = match[2].trim();
  const status = match[3].toLowerCase().includes('reduced sampling')
    ? translate(edition, 'diagLevelReducedSampling')
    : translate(edition, 'diagLevelProvisional');
  return translate(edition, 'diagLevelTemplate', { band, range, status });
}

export function localizeWorkerStage(
  rawStage: string | null | undefined,
  edition: EditionCode,
): string {
  const stage = (rawStage ?? '').trim();
  if (!stage) return '';

  if (stage === 'stage.register_shifting') {
    return translate(edition, 'shifterStageShifting');
  }
  if (stage === 'stage.register_complete') {
    return translate(edition, 'shifterStageComplete');
  }
  if (stage === 'stage.register_failed') {
    return translate(edition, 'shifterStageFailed');
  }
  if (stage.startsWith('stage.register_retrying:')) {
    const attempt = formatChromeNumber(
      stage.slice('stage.register_retrying:'.length),
      edition,
    );
    return translate(edition, 'shifterStageRetrying', { attempt });
  }

  if (stage === 'stage.drop_extracting') {
    return translate(edition, 'dropStageExtracting');
  }
  if (stage === 'stage.drop_reading_images') {
    return translate(edition, 'dropStageReadingImages');
  }
  if (stage === 'stage.drop_building_drill') {
    return translate(edition, 'dropStageBuildingDrill');
  }
  if (stage === 'stage.drop_ready') {
    return translate(edition, 'dropStageReady');
  }
  if (stage === 'stage.drop_failed') {
    return translate(edition, 'dropStageFailed');
  }
  if (stage.startsWith('stage.drop_retrying:')) {
    const attempt = formatChromeNumber(
      stage.slice('stage.drop_retrying:'.length),
      edition,
    );
    return translate(edition, 'dropStageRetrying', { attempt });
  }

  return stage;
}

export function localizeDiagnosticObservation(
  raw: string,
  edition: EditionCode,
): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  if (trimmed.startsWith('stage.')) {
    return localizeWorkerStage(trimmed, edition);
  }
  if (edition !== 'irn') return trimmed;

  if (/^No responses collected yet\.?$/i.test(trimmed)) {
    return 'هنوز پاسخی ثبت نشده است.';
  }

  const skippedMatch = /^This (reading|listening|writing|speaking) check was skipped/i.exec(
    trimmed,
  );
  if (skippedMatch?.[1]) {
    return translate(edition, 'diagObsSkipped', {
      skill: formatSkillLabel(skippedMatch[1].toLowerCase(), edition),
    });
  }

  if (
    trimmed ===
    'Audio playback was unavailable before usable evidence could be collected.'
  ) {
    return translate(edition, 'diagObsPlaybackFail');
  }
  if (trimmed === 'Too few completed answers to suggest a practice level yet.') {
    return translate(edition, 'diagObsTooFew');
  }

  const strongMatch =
    /^Answered all questions accurately on (.+?)-oriented (reading|listening|writing|speaking) tasks\.$/i.exec(
      trimmed,
    );
  if (strongMatch?.[1] && strongMatch[2]) {
    return translate(edition, 'diagObsStrong', {
      tiers: strongMatch[1],
      skill: formatSkillLabel(strongMatch[2].toLowerCase(), edition),
    });
  }

  const chalMatch =
    /^Found (.+?)-oriented (reading|listening|writing|speaking) tasks challenging\.$/i.exec(
      trimmed,
    );
  if (chalMatch?.[1] && chalMatch[2]) {
    return translate(edition, 'diagObsChallenging', {
      tiers: chalMatch[1],
      skill: formatSkillLabel(chalMatch[2].toLowerCase(), edition),
    });
  }

  const partMatch =
    /^Showed partial accuracy on (.+?)-oriented (reading|listening|writing|speaking) tasks\.$/i.exec(
      trimmed,
    );
  if (partMatch?.[1] && partMatch[2]) {
    return translate(edition, 'diagObsPartial', {
      tiers: partMatch[1],
      skill: formatSkillLabel(partMatch[2].toLowerCase(), edition),
    });
  }

  if (
    trimmed ===
    'Responses across difficulty tiers were mixed; additional practice will sharpen placement.'
  ) {
    return translate(edition, 'diagObsMixed');
  }
  if (trimmed === 'Collected fewer than three blocks within the time limit.') {
    return translate(edition, 'diagObsReduced');
  }

  const moreMatch = /^More (reading|listening|writing|speaking) evidence is needed\.$/i.exec(
    trimmed,
  );
  if (moreMatch?.[1]) {
    return translate(edition, 'diagObsMoreNeeded', {
      skill: formatSkillLabel(moreMatch[1].toLowerCase(), edition),
    });
  }

  const shortMatch = /^Short (reading|listening|writing|speaking) response reviewed\.$/i.exec(
    trimmed,
  );
  if (shortMatch?.[1]) {
    return translate(edition, 'diagObsShortReviewed', {
      skill: formatSkillLabel(shortMatch[1].toLowerCase(), edition),
    });
  }

  if (trimmed === 'Recording was unavailable or could not be decoded.') {
    return translate(edition, 'diagObsAudioUnavailable');
  }
  if (trimmed === 'Evaluation did not complete. Retry when ready.') {
    return translate(edition, 'diagObsFailedRetry');
  }

  const evalMatch = /^Evaluating your (reading|listening|writing|speaking) response\.\.\.$/i.exec(
    trimmed,
  );
  if (evalMatch?.[1]) {
    return translate(edition, 'diagObsEvaluating', {
      skill: formatSkillLabel(evalMatch[1].toLowerCase(), edition),
    });
  }

  return trimmed;
}

export function localizeMicroDrillCategory(
  drillType: string,
  edition: EditionCode,
): string {
  switch (drillType.trim().toLowerCase()) {
    case 'speed_tfng':
      return translate(edition, 'drillsCatSpeedTfng');
    case 'speed_ynng':
      return translate(edition, 'drillsCatSpeedYnng');
    case 'summary_gap_fill':
    case 'gap_fill':
      return translate(edition, 'drillsCatSummaryCompletion');
    case 'complex_grammar':
      return translate(edition, 'drillsCatComplexGrammar');
    case 'pronunciation_rhythm':
      return translate(edition, 'drillsCatPronunciationRhythm');
    case 'coherence_linking':
      return translate(edition, 'drillsCatCoherenceLinking');
    case 'lexical_precision':
      return translate(edition, 'drillsCatLexicalPrecision');
    case 'collocation_matcher':
      return translate(edition, 'drillsCatCollocationMatcher');
    case 'distractor_spotter':
      return translate(edition, 'drillsCatDistractorSpotter');
    case 'paraphrase_matcher':
      return translate(edition, 'drillsCatParaphraseMatcher');
    case 'toefl_complete_words':
      return translate(edition, 'drillsCatToeflCompleteWords');
    case 'pte_reorder_swt':
      return translate(edition, 'drillsCatPteReorderSwt');
    case 'det_read_select':
      return translate(edition, 'drillsCatDetReadSelect');
    default:
      return formatMicroDrillCategoryLabel(drillType);
  }
}

export function localizeMicroDrillHeader(
  drillType: string,
  edition: EditionCode,
): string {
  const normalized = drillType.trim().toLowerCase();
  if (normalized.includes('tfng')) {
    return translate(edition, 'drillsCatSpeedTfng');
  }
  if (normalized.includes('ynng')) {
    return translate(edition, 'drillsCatSpeedYnng');
  }
  if (normalized.includes('gap') || normalized.includes('summary')) {
    return translate(edition, 'drillsHeaderCompleteSummary');
  }
  if (edition === 'irn') {
    return translate(edition, 'drillsHeaderChooseBest');
  }
  return getMicroDrillItemHeaderTitle(drillType);
}

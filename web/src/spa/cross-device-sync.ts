import type { SupportedExamId } from '@mockza/domain';
import { serialDayFromUtcMs } from '@mockza/domain';
import type { SyncPullDto } from '@/gateways/personalization.gateway';
import { setGlobalDefaultTtsAccent } from '@/components/speech-tts';
import type { CompletedAttemptRecord, UserProfileRecord, VocabSrsStateRecord } from '@/gateways/storage.gateway';
import type { AppDependencies } from './deps';

export interface CrossDevicePullSummary {
  readonly pulled: boolean;
  readonly syncedAtIso: string | null;
  readonly attemptsMerged: number;
  readonly vocabStatesMerged: number;
  readonly pronunciationMerged: number;
}

/**
 * Pulls `/v1/sync/pull` from the backend and merges personalization state,
 * attempts, vocab SRS states, and pronunciation practice history into Dexie/stores.
 */
export async function pullCrossDeviceState(
  deps: Pick<
    AppDependencies,
    'personalization' | 'attemptStore' | 'syncOutbox' | 'vocabStore' | 'clock' | 'edition' | 'dexieDb'
  >,
): Promise<CrossDevicePullSummary> {
  if (!deps.personalization) {
    return {
      pulled: false,
      syncedAtIso: null,
      attemptsMerged: 0,
      vocabStatesMerged: 0,
      pronunciationMerged: 0,
    };
  }

  // First flush any pending local changes before pulling remote truth
  await deps.syncOutbox.flushPending().catch(() => {});

  const cursorStorageKey = `mockza_last_sync_iso_${deps.edition}`;
  const storedSince =
    typeof window !== 'undefined' ? window.localStorage.getItem(cursorStorageKey) ?? undefined : undefined;
  const pullRes = await deps.personalization.pullSync(storedSince);
  if (!pullRes.ok) {
    return {
      pulled: false,
      syncedAtIso: null,
      attemptsMerged: 0,
      vocabStatesMerged: 0,
      pronunciationMerged: 0,
    };
  }

  const data: SyncPullDto = pullRes.value;
  if (typeof window !== 'undefined' && data.syncedAt) {
    window.localStorage.setItem(cursorStorageKey, data.syncedAt);
  }
  let attemptsMerged = 0;
  let vocabStatesMerged = 0;
  let pronunciationMerged = 0;

  if (data.profile) {
    const existingRes = await deps.attemptStore.getUserProfile();
    const existing = existingRes.ok ? existingRes.value : null;
    const safeRemoteMs = deps.clock.nowMs();
    if (!existing || data.profile.favoriteTopics.length > (existing.favoriteTopics?.length ?? 0) || data.profile.onboardingCompleted) {
      const targetDateSerial = data.profile.targetDateIso
        ? serialDayFromUtcMs(Date.parse(data.profile.targetDateIso))
        : (existing?.targetDateSerial ?? null);
      const normalizedFocus: 'exams' | 'coach' | 'both' =
        data.profile.studyFocus === 'speaking_only' || data.profile.studyFocus === 'coach'
          ? 'coach'
          : data.profile.studyFocus === 'exams'
            ? 'exams'
            : 'both';
      const mergedProfile: UserProfileRecord = {
        deviceId: existing?.deviceId ?? 'synced-device',
        examId: (data.profile.examTrack as SupportedExamId) ?? existing?.examId ?? 'ielts_academic',
        examModule: existing?.examModule ?? 'academic',
        studyFocus: normalizedFocus,
        favoriteTopics: data.profile.favoriteTopics,
        targetBand: data.profile.targetBand,
        targetDateSerial,
        onboardingCompleted: data.profile.onboardingCompleted,
        freeDiagnosticUsed: existing?.freeDiagnosticUsed ?? false,
        linkedEmail: existing?.linkedEmail ?? null,
        appUserId: existing?.appUserId ?? null,
        isPro: existing?.isPro ?? false,
        updatedAtMs: Math.max(safeRemoteMs, existing?.updatedAtMs ?? 0),
      };
      await deps.attemptStore.saveUserProfile(mergedProfile).catch(() => {});
    }
    if (data.profile.preferredTtsAccent === 'uk' || data.profile.preferredTtsAccent === 'us') {
      setGlobalDefaultTtsAccent(data.profile.preferredTtsAccent);
    }
  }

  const db = deps.dexieDb;

  if (data.vocabSrs.length > 0 && db) {
    const toPut: VocabSrsStateRecord[] = [];
    const cardsToPut: import('@/gateways/storage.gateway').VocabCardRecord[] = [];
    const nowMs = deps.clock.nowMs();
    for (const remote of data.vocabSrs) {
      if (remote.cardSnapshotJson && db.vocabCards) {
        const snap = remote.cardSnapshotJson;
        const headword = typeof snap['headword'] === 'string' ? snap['headword'] : '';
        const definition = typeof snap['definition'] === 'string' ? snap['definition'] : '';
        if (headword && definition) {
          const existingCard = await db.vocabCards.get(remote.cardId).catch(() => undefined);
          if (!existingCard) {
            cardsToPut.push({
              cardId: remote.cardId,
              examId: (typeof snap['examId'] === 'string' ? snap['examId'] : 'ielts_academic') as SupportedExamId,
              headword,
              ipa: typeof snap['ipa'] === 'string' ? snap['ipa'] : null,
              definition,
              glossFa: typeof snap['glossFa'] === 'string' ? snap['glossFa'] : null,
              topicTag: typeof snap['topicTag'] === 'string' ? snap['topicTag'] : 'general_academic',
              sourceKind:
                remote.sourceKind === 'mistake_to_deck' ||
                remote.sourceKind === 'register_shifter' ||
                remote.sourceKind === 'drop_anything'
                  ? remote.sourceKind
                  : 'mistake_to_deck',
              tags: Array.isArray(snap['tags'])
                ? snap['tags'].filter((t): t is string => typeof t === 'string')
                : [],
              contextSentence: typeof snap['contextSentence'] === 'string' ? snap['contextSentence'] : null,
              paraphraseHints: [],
              usageNote: null,
              sourceSkill: null,
              sourceAttemptId: null,
              sourceRefLabel: null,
              createdAtMs: nowMs,
              updatedAtMs: nowMs,
            });
          }
        }
      }
      const local = await db.vocabSrsStates.get(remote.cardId).catch(() => undefined);
      const remoteMs = remote.lastReviewedAt ? Date.parse(remote.lastReviewedAt) : 0;
      if (!local || remoteMs >= local.updatedAtMs || remote.repetitions > local.repetitions) {
        toPut.push({
          cardId: remote.cardId,
          repetitions: remote.repetitions,
          intervalDays: remote.intervalDays,
          easeFactorMilli: remote.easeFactorMilli,
          dueSerialDay: remote.dueSerialDay,
          state:
            remote.repetitions >= 3
              ? 'mastered'
              : remote.repetitions > 0 || remote.lapses > 0
                ? 'learning'
                : 'new',
          updatedAtMs: Math.max(remoteMs, local?.updatedAtMs ?? nowMs),
        });
      }
    }
    if (cardsToPut.length > 0 && db.vocabCards) {
      await db.vocabCards.bulkPut(cardsToPut).catch(() => {});
    }
    if (toPut.length > 0) {
      await db.vocabSrsStates.bulkPut(toPut).catch(() => {});
      vocabStatesMerged = toPut.length;
    }
  }

  if (data.pronunciationPractices.length > 0 && db) {
    await db.pronunciationHistory
      .bulkPut(
        data.pronunciationPractices.map((item) => ({
          practiceId: item.practiceId,
          targetText: item.targetText,
          overallScore: item.overallScore ?? null,
          payloadJson: JSON.stringify(item),
          createdAtMs: Number.isFinite(Date.parse(item.createdAt))
            ? Date.parse(item.createdAt)
            : deps.clock.nowMs(),
        })),
      )
      .catch(() => {});
    pronunciationMerged = data.pronunciationPractices.length;
  }

  if (data.attempts.length > 0 && db) {
    const attemptsToPut: CompletedAttemptRecord[] = [];
    for (const remote of data.attempts) {
      const local = await db.completedAttempts.get(remote.attemptId).catch(() => undefined);
      const remoteMs = Date.parse(remote.updatedAt);
      if (!local || (Number.isFinite(remoteMs) && remoteMs > local.updatedAtMs)) {
        attemptsToPut.push({
          attemptId: remote.attemptId,
          examId: (remote.examId as SupportedExamId) ?? 'ielts_academic',
          packId: remote.packId,
          skill: (remote.skill as CompletedAttemptRecord['skill']) ?? 'reading',
          status: remote.status === 'completed' ? 'completed' : 'queued_remote',
          syncStatus: 'synced',
          remoteJobId: local?.remoteJobId ?? null,
          submissionJson: remote.answersJson
            ? JSON.stringify(remote.answersJson)
            : (local?.submissionJson ?? '{}'),
          evaluationJson: remote.feedbackJson
            ? JSON.stringify(remote.feedbackJson)
            : (local?.evaluationJson ?? null),
          overallBand: remote.scoreBand ?? null,
          errorCode: null,
          startedAtUtcMs: local?.startedAtUtcMs ?? null,
          completedAtMs: Number.isFinite(remoteMs) ? remoteMs : deps.clock.nowMs(),
          durationSeconds: remote.durationSeconds,
          usedStudyMode: remote.mode === 'study',
          questionCount: local?.questionCount ?? 0,
          isCalibratedFullPack: local?.isCalibratedFullPack ?? true,
          contentVersion: local?.contentVersion ?? null,
          mockSessionId: local?.mockSessionId ?? null,
          mockStageKey: local?.mockStageKey ?? null,
          updatedAtMs: Number.isFinite(remoteMs) ? remoteMs : deps.clock.nowMs(),
        });
      }
    }
    if (attemptsToPut.length > 0) {
      await db.completedAttempts.bulkPut(attemptsToPut).catch(() => {});
      attemptsMerged = attemptsToPut.length;
    }
  }

  return {
    pulled: true,
    syncedAtIso: data.syncedAt,
    attemptsMerged,
    vocabStatesMerged,
    pronunciationMerged,
  };
}

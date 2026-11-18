import {
  calculateCurrentStreak,
  calculateEstimatedOverallBand,
  calculateSkillMetrics,
  calculateStudyWeek,
  computeDetSubscores,
  EXAM_DESCRIPTORS,
  EXAM_TRACK_SPECS,
  estimateToeflLegacy120,
  getPopulatedDetSubscoreEntries,
  nextTargetWhenSwitchingFrom,
  type ScoredAttemptInput,
  type SerialDay,
  type SkillKind,
  type SupportedExamId,
} from '@mockza/domain';
import { useCallback, useEffect, useState } from 'react';
import type { DiagnosticSessionDto } from '@/gateways/diagnostic.gateway';
import type {
  CompletedAttemptRecord,
  UserProfileRecord,
  VocabCardWithSrs,
} from '@/gateways/storage.gateway';
import { useDeps } from '@/spa/deps';
import { useAuthSession } from '@/spa/stores/auth-session';

function resolveIsoWeekday(nowMs: number): number {
  const utcDay = new Date(nowMs).getUTCDay(); // 0 Sun .. 6 Sat
  return utcDay === 0 ? 7 : utcDay;
}

export function useHomeController() {
  const deps = useDeps();
  const { session } = useAuthSession(deps.auth);

  const [isLoading, setIsLoading] = useState(true);
  const [deviceId, setDeviceId] = useState('local-desktop-device');
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [attempts, setAttempts] = useState<readonly CompletedAttemptRecord[]>([]);
  const [studyDays, setStudyDays] = useState<readonly SerialDay[]>([]);
  const [dueCards, setDueCards] = useState<readonly VocabCardWithSrs[]>([]);
  const [latestDiagnostic, setLatestDiagnostic] = useState<DiagnosticSessionDto | null>(null);

  const hydrate = useCallback(async () => {
    const today = deps.clock.todaySerialDay();
    const [idRes, profileRes, attemptsRes, studyRes, dueRes, diagRes] = await Promise.all([
      deps.auth.getDeviceIdentity(),
      deps.attemptStore.getUserProfile(),
      deps.attemptStore.listCompletedAttempts(),
      deps.attemptStore.listRecentDailyStudyLogs(30),
      deps.vocabStore.getDueCards(today, 200),
      deps.attemptStore.getLatestDiagnosticSession(),
    ]);

    if (idRes.ok) {
      setDeviceId(idRes.value.deviceInstallId);
    }
    if (profileRes.ok && profileRes.value) {
      setProfile(profileRes.value);
    }
    if (attemptsRes.ok) {
      setAttempts(attemptsRes.value);
    }
    if (studyRes.ok) {
      setStudyDays(
        studyRes.value
          .filter((log) => log.completedItems > 0 || log.studySeconds > 0)
          .map((log) => log.serialDay),
      );
    }
    if (dueRes.ok) {
      setDueCards(dueRes.value);
    }
    if (diagRes.ok && diagRes.value?.stateJson) {
      try {
        const parsed = JSON.parse(diagRes.value.stateJson) as {
          readonly remoteSession?: DiagnosticSessionDto | null;
        };
        if (parsed.remoteSession) {
          setLatestDiagnostic(parsed.remoteSession);
        }
      } catch {
        // Ignore malformed diagnostic JSON snapshot.
      }
    }
    setIsLoading(false);
  }, [deps.attemptStore, deps.auth, deps.clock, deps.vocabStore]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const activeTrack: SupportedExamId = profile?.examId ?? 'ielts_academic';
  const trackSpec = EXAM_TRACK_SPECS[activeTrack];
  const descriptor = EXAM_DESCRIPTORS[activeTrack];
  const targetScore = profile?.targetBand ?? trackSpec.targetScoreDefault;

  const switchTrack = useCallback(
    async (nextTrack: SupportedExamId) => {
      const nextTarget = nextTargetWhenSwitchingFrom({
        target: nextTrack,
        previous: activeTrack,
        previousTarget: targetScore,
      });
      const updated: UserProfileRecord = {
        deviceId: profile?.deviceId ?? deviceId,
        examId: nextTrack,
        examModule: nextTrack === 'ielts_general' ? 'general_training' : 'academic',
        targetBand: nextTarget,
        targetDateSerial: profile?.targetDateSerial ?? null,
        onboardingCompleted: profile?.onboardingCompleted ?? true,
        freeDiagnosticUsed: profile?.freeDiagnosticUsed ?? false,
        linkedEmail: profile?.linkedEmail ?? session?.user?.email ?? null,
        appUserId: profile?.appUserId ?? session?.user?.userId ?? null,
        isPro: profile?.isPro ?? session?.user?.isPro ?? false,
        updatedAtMs: deps.clock.nowMs(),
      };
      setProfile(updated);
      await deps.attemptStore.saveUserProfile(updated);
    },
    [
      activeTrack,
      deps.attemptStore,
      deps.clock,
      deviceId,
      profile,
      session?.user?.email,
      session?.user?.isPro,
      session?.user?.userId,
      targetScore,
    ],
  );

  // Filter scored attempts relevant to selected track (sharing IELTS R/W/L/S metrics when desired or strict per examId)
  const trackAttempts = attempts.filter((item) => item.examId === activeTrack);
  const scoredAttempts: ScoredAttemptInput[] = trackAttempts
    .filter((item): item is CompletedAttemptRecord & { readonly overallBand: number } =>
      item.overallBand !== null && Number.isFinite(item.overallBand),
    )
    .map((item) => ({
      score: item.overallBand,
      skill: item.skill,
      completedAtUtcMs: item.completedAtMs,
    }));

  const nowMs = deps.clock.nowMs();
  const todaySerial = deps.clock.todaySerialDay();

  const estimatedSummary = calculateEstimatedOverallBand({
    scoredAttempts,
    track: activeTrack,
    targetBand: targetScore,
    currentUtcMs: nowMs,
  });

  const skillMetrics = calculateSkillMetrics({
    attempts: scoredAttempts,
    track: activeTrack,
  });

  const streakDays = calculateCurrentStreak({
    studyDays,
    today: todaySerial,
  });

  const studyWeek = calculateStudyWeek({
    studyDays,
    today: todaySerial,
    weekdayOfToday: resolveIsoWeekday(nowMs),
  });

  const getSkillScore = (skill: SkillKind): number | null =>
    skillMetrics.find((m) => m.skill === skill)?.score ?? null;

  const detSubscores =
    activeTrack === 'det'
      ? getPopulatedDetSubscoreEntries(
          computeDetSubscores({
            reading: getSkillScore('reading'),
            listening: getSkillScore('listening'),
            writing: getSkillScore('writing'),
            speaking: getSkillScore('speaking'),
          }),
        )
      : [];

  const toeflLegacy120 =
    activeTrack === 'toefl_ibt' && estimatedSummary.overallBand !== null
      ? estimateToeflLegacy120(estimatedSummary.overallBand)
      : activeTrack === 'toefl_ibt'
        ? estimateToeflLegacy120(targetScore)
        : null;

  return {
    isLoading,
    activeTrack,
    trackSpec,
    descriptor,
    targetScore,
    targetDateSerial: profile?.targetDateSerial ?? null,
    estimatedSummary,
    skillMetrics,
    streakDays,
    studyWeek,
    dueCards,
    latestDiagnostic,
    detSubscores,
    toeflLegacy120,
    switchTrack,
    refresh: hydrate,
  };
}

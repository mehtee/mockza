import {
  CANONICAL_TOPICS,
  EXAM_DESCRIPTORS,
  EXAM_TRACK_SPECS,
  nextTargetWhenSwitchingFrom,
  normalizeFavoriteTopicList,
  normalizeScoreToQualityRatio,
  quantizeExamScore,
  type SerialDay,
  serialDayFromUtcMs,
  type SupportedExamId,
  TOPIC_METADATA,
  utcMidnightMsFromSerialDay,
} from '@mockza/domain';
import { useCallback, useEffect, useState } from 'react';
import {
  jalaliYmdToSerialDay,
  serialDayToJalaliYmd,
} from '@/edition/calendar/jalali-edge';
import type { UserProfileRecord } from '@/gateways/storage.gateway';
import { useDeps } from '@/spa/deps';
import { useAuthSession } from '@/spa/stores/auth-session';

export interface StarterInterestTopic {
  readonly key: string;
  readonly labelEn: string;
  readonly labelFa: string;
}

export const STARTER_INTEREST_TOPICS: readonly StarterInterestTopic[] = CANONICAL_TOPICS.map(
  (topicKey) => ({
    key: topicKey,
    labelEn: TOPIC_METADATA[topicKey].labelEn,
    labelFa: TOPIC_METADATA[topicKey].labelFa,
  }),
);

export interface JalaliDraftFields {
  readonly jy: string;
  readonly jm: string;
  readonly jd: string;
}

function serialDayToIsoDate(serialDay: SerialDay): string {
  const date = new Date(utcMidnightMsFromSerialDay(serialDay));
  const y = String(date.getUTCFullYear());
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDateToSerialDay(iso: string): SerialDay | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return serialDayFromUtcMs(ms);
}

export function useOnboardingController() {
  const deps = useDeps();
  const { session } = useAuthSession(deps.auth);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deviceId, setDeviceId] = useState('local-desktop-device');
  const [existingProfile, setExistingProfile] = useState<UserProfileRecord | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<SupportedExamId>('ielts_academic');
  const [studyFocus, setStudyFocus] = useState<'exams' | 'coach' | 'both'>('both');
  const [selectedTopics, setSelectedTopics] = useState<readonly string[]>([]);
  const [targetScore, setTargetScore] = useState<number>(
    EXAM_TRACK_SPECS.ielts_academic.targetScoreDefault,
  );
  const [targetDateSerial, setTargetDateSerial] = useState<SerialDay | null>(null);
  const [gregorianInput, setGregorianInput] = useState<string>('');
  const [jalaliDraft, setJalaliDraft] = useState<JalaliDraftFields>({ jy: '', jm: '', jd: '' });
  const [dateError, setDateError] = useState<boolean>(false);

  const syncDateInputsFromSerial = useCallback(
    (serial: SerialDay | null) => {
      if (serial === null) {
        setGregorianInput('');
        setJalaliDraft({ jy: '', jm: '', jd: '' });
        return;
      }
      setGregorianInput(serialDayToIsoDate(serial));
      if (deps.edition === 'irn' && import.meta.env.PUBLIC_EDITION !== 'glb') {
        const ymd = serialDayToJalaliYmd(serial);
        setJalaliDraft({
          jy: String(ymd.jy),
          jm: String(ymd.jm),
          jd: String(ymd.jd),
        });
      }
    },
    [deps.edition],
  );

  useEffect(() => {
    let mounted = true;
    async function hydrate() {
      const [idRes, profileRes] = await Promise.all([
        deps.auth.getDeviceIdentity(),
        deps.attemptStore.getUserProfile(),
      ]);
      if (!mounted) return;
      if (idRes.ok) setDeviceId(idRes.value.deviceInstallId);
      if (profileRes.ok && profileRes.value) {
        const profile = profileRes.value;
        setExistingProfile(profile);
        setSelectedTrack(profile.examId);
        if (profile.studyFocus) setStudyFocus(profile.studyFocus);
        if (profile.favoriteTopics && profile.favoriteTopics.length > 0) {
          setSelectedTopics(normalizeFavoriteTopicList(profile.favoriteTopics));
        }
        setTargetScore(quantizeExamScore(profile.targetBand, profile.examId));
        setTargetDateSerial(profile.targetDateSerial);
        syncDateInputsFromSerial(profile.targetDateSerial);
      }
      setIsLoading(false);
    }
    void hydrate();
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore, deps.auth, syncDateInputsFromSerial]);

  const selectTrack = useCallback(
    (nextTrack: SupportedExamId) => {
      setTargetScore((currentTarget) =>
        nextTargetWhenSwitchingFrom({
          target: nextTrack,
          previous: selectedTrack,
          previousTarget: currentTarget,
        }),
      );
      setSelectedTrack(nextTrack);
    },
    [selectedTrack],
  );

  const updateTargetScore = useCallback(
    (rawScore: number) => {
      setTargetScore(quantizeExamScore(rawScore, selectedTrack));
    },
    [selectedTrack],
  );

  const stepTargetScore = useCallback(
    (delta: -1 | 1) => {
      const spec = EXAM_TRACK_SPECS[selectedTrack];
      setTargetScore((current) => quantizeExamScore(current + delta * spec.scoreStep, selectedTrack));
    },
    [selectedTrack],
  );

  const setExamDateDaysFromNow = useCallback(
    (days: number | null) => {
      setDateError(false);
      if (days === null) {
        setTargetDateSerial(null);
        syncDateInputsFromSerial(null);
        return;
      }
      const nextSerial = deps.clock.todaySerialDay() + days;
      setTargetDateSerial(nextSerial);
      syncDateInputsFromSerial(nextSerial);
    },
    [deps.clock, syncDateInputsFromSerial],
  );

  const handleGregorianDateChange = useCallback(
    (isoValue: string) => {
      setGregorianInput(isoValue);
      if (!isoValue.trim()) {
        setDateError(false);
        setTargetDateSerial(null);
        return;
      }
      const parsed = parseIsoDateToSerialDay(isoValue);
      if (parsed === null) {
        setDateError(true);
        return;
      }
      setDateError(false);
      setTargetDateSerial(parsed);
    },
    [],
  );

  const handleJalaliFieldChange = useCallback(
    (patch: Partial<JalaliDraftFields>) => {
      const nextDraft: JalaliDraftFields = {
        jy: patch.jy ?? jalaliDraft.jy,
        jm: patch.jm ?? jalaliDraft.jm,
        jd: patch.jd ?? jalaliDraft.jd,
      };
      setJalaliDraft(nextDraft);

      if (!nextDraft.jy.trim() && !nextDraft.jm.trim() && !nextDraft.jd.trim()) {
        setDateError(false);
        setTargetDateSerial(null);
        return;
      }

      if (deps.edition !== 'irn' || import.meta.env.PUBLIC_EDITION === 'glb') {
        return;
      }

      const jy = Number(nextDraft.jy);
      const jm = Number(nextDraft.jm);
      const jd = Number(nextDraft.jd);
      try {
        const serial = jalaliYmdToSerialDay(jy, jm, jd);
        setDateError(false);
        setTargetDateSerial(serial);
        setGregorianInput(serialDayToIsoDate(serial));
      } catch {
        setDateError(true);
      }
    },
    [deps.edition, jalaliDraft],
  );

  const toggleTopic = useCallback((topicKey: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicKey) ? prev.filter((item) => item !== topicKey) : [...prev, topicKey],
    );
  }, []);

  const saveProfile = useCallback(
    async (markCompleted: boolean): Promise<boolean> => {
      if (dateError) {
        return false;
      }
      setIsSaving(true);
      const nowMs = deps.clock.nowMs();
      const canonicalTopics = normalizeFavoriteTopicList(selectedTopics);
      const record: UserProfileRecord = {
        deviceId,
        examId: selectedTrack,
        examModule: selectedTrack === 'ielts_general' ? 'general_training' : 'academic',
        studyFocus,
        favoriteTopics: canonicalTopics,
        targetBand: targetScore,
        targetDateSerial,
        onboardingCompleted: markCompleted ? true : (existingProfile?.onboardingCompleted ?? false),
        freeDiagnosticUsed: existingProfile?.freeDiagnosticUsed ?? false,
        linkedEmail: existingProfile?.linkedEmail ?? session?.user?.email ?? null,
        appUserId: existingProfile?.appUserId ?? session?.user?.userId ?? null,
        isPro: existingProfile?.isPro ?? session?.user?.isPro ?? false,
        updatedAtMs: nowMs,
      };
      const res = await deps.attemptStore.saveUserProfile(record);
      if (markCompleted && res.ok) {
        if (canonicalTopics.length > 0) {
          void deps.linguistic.updateInterests({
            pinTopics: canonicalTopics,
            muteTopics: [],
          });
        }
        const profilePayload = {
          examTrack: selectedTrack,
          targetBand: targetScore,
          targetDateIso: targetDateSerial
            ? new Date(utcMidnightMsFromSerialDay(targetDateSerial)).toISOString()
            : null,
          studyFocus: studyFocus === 'coach' ? ('speaking_only' as const) : ('both' as const),
          favoriteTopics: canonicalTopics,
          onboardingCompleted: true,
        };
        if (deps.personalization) {
          const pRes = await deps.personalization.updateProfile(profilePayload);
          if (!pRes.ok) {
            void deps.syncOutbox.enqueue({
              idempotencyKey: `profile.update:${nowMs}`,
              actionType: 'profile.update',
              entityKind: 'attempt',
              payloadJson: JSON.stringify(profilePayload),
            });
          }
        }
      }
      setExistingProfile(record);
      setIsSaving(false);
      return res.ok;
    },
    [
      dateError,
      deps.attemptStore,
      deps.clock,
      deps.linguistic,
      deps.personalization,
      deps.syncOutbox,
      deviceId,
      existingProfile,
      selectedTopics,
      selectedTrack,
      studyFocus,
      session?.user?.email,
      session?.user?.isPro,
      session?.user?.userId,
      targetDateSerial,
      targetScore,
    ],
  );

  const qualityRatio = normalizeScoreToQualityRatio(targetScore, selectedTrack);

  return {
    isLoading,
    isSaving,
    selectedTrack,
    studyFocus,
    selectedTopics,
    targetScore,
    targetDateSerial,
    gregorianInput,
    jalaliDraft,
    dateError,
    qualityRatio,
    trackSpec: EXAM_TRACK_SPECS[selectedTrack],
    trackDescriptor: EXAM_DESCRIPTORS[selectedTrack],
    selectTrack,
    selectStudyFocus: setStudyFocus,
    toggleTopic,
    updateTargetScore,
    stepTargetScore,
    setExamDateDaysFromNow,
    handleGregorianDateChange,
    handleJalaliFieldChange,
    saveProfile,
  };
}

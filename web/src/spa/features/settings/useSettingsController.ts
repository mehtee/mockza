import {
  DEFAULT_DAILY_NEW_CAP,
  EXAM_DESCRIPTORS,
  EXAM_TRACK_SPECS,
  formatExamScore,
  nextTargetWhenSwitchingFrom,
  normalizeFavoriteTopicList,
  quantizeExamScore,
  SUPPORTED_EXAM_IDS,
  type SupportedExamId,
} from '@mockza/domain';
import { useCallback, useEffect, useState } from 'react';
import type { LoopbackTestResult, MicPreflightStatus } from '@/gateways/audio.gateway';
import type { ActiveDeviceSlot, AuthSession } from '@/gateways/auth.gateway';
import type { EntitlementSnapshot } from '@/gateways/billing.gateway';
import type { CacheUsageSummary } from '@/gateways/catalog.gateway';
import type { UserProfileRecord } from '@/gateways/storage.gateway';
import { pullCrossDeviceState } from '@/spa/cross-device-sync';
import { setGlobalDefaultTtsAccent } from '@/components/speech-tts';
import { useDeps } from '@/spa/deps';
import { useAuthSession } from '@/spa/stores/auth-session';
import type { ThemePresetId } from '@/theme/generated-presets';
import {
  type AppearanceState,
  applyAndPersistAppearance,
  readStoredAppearance,
  type ThemeModePreference,
} from '@/theme/theme-controller';

export type SettingsStatusBanner =
  | { readonly tone: 'info' | 'success' | 'warning' | 'danger'; readonly kind: 'raw'; readonly message: string }
  | { readonly tone: 'info'; readonly kind: 'device_revoked' }
  | { readonly tone: 'success'; readonly kind: 'others_revoked'; readonly count: number }
  | { readonly tone: 'success'; readonly kind: 'catalog_synced'; readonly count: number }
  | { readonly tone: 'success'; readonly kind: 'cache_cleared'; readonly bytes: number }
  | { readonly tone: 'info'; readonly kind: 'id_copied' }
  | { readonly tone: 'success'; readonly kind: 'data_exported'; readonly chars: number }
  | { readonly tone: 'success' | 'warning'; readonly kind: 'account_deleted'; readonly completed: boolean; readonly receipt: string };

export interface SettingsControllerState {
  readonly session: AuthSession | null;
  readonly isLoading: boolean;
  readonly deviceId: string;
  readonly userProfile: UserProfileRecord | null;
  readonly activeTrack: SupportedExamId;
  readonly studyFocus: 'exams' | 'coach' | 'both';
  readonly favoriteTopics: readonly string[];
  readonly dailyNewVocabCap: number;
  readonly preferredTtsAccent: 'us' | 'uk';
  readonly lastSyncedAtIso: string | null;
  readonly isSyncingCrossDevice: boolean;
  readonly targetScore: number;
  readonly appearance: AppearanceState;
  readonly activeDevices: readonly ActiveDeviceSlot[];
  readonly revokingSessionId: string | null;
  readonly isRevokingOthers: boolean;
  readonly entitlement: EntitlementSnapshot | null;
  readonly canOpenPortal: boolean;
  readonly isOpeningPortal: boolean;
  readonly cacheSummary: CacheUsageSummary | null;
  readonly isClearingCache: boolean;
  readonly isSyncingCatalog: boolean;
  readonly isExportingData: boolean;
  readonly micStatus: MicPreflightStatus | null;
  readonly isTestingMic: boolean;
  readonly micLevelRms: number;
  readonly loopbackResult: LoopbackTestResult | null;
  readonly isSigningOut: boolean;
  readonly isDeletingAccount: boolean;
  readonly showSignOutModal: boolean;
  readonly showDeleteModal: boolean;
  readonly banner: SettingsStatusBanner | null;
}

export interface SettingsControllerActions {
  readonly selectTrack: (track: SupportedExamId) => Promise<void>;
  readonly setStudyFocus: (focus: 'exams' | 'coach' | 'both') => Promise<void>;
  readonly toggleFavoriteTopic: (topicKey: string) => Promise<void>;
  readonly setDailyNewVocabCap: (cap: number) => Promise<void>;
  readonly setPreferredTtsAccent: (accent: 'us' | 'uk') => Promise<void>;
  readonly syncAcrossDevicesNow: () => Promise<void>;
  readonly setTargetScore: (nextScore: number) => Promise<void>;
  readonly stepTargetScore: (delta: -1 | 1) => Promise<void>;
  readonly setThemeMode: (mode: ThemeModePreference) => Promise<void>;
  readonly setThemePreset: (presetId: ThemePresetId) => Promise<void>;
  readonly refreshDevices: () => Promise<void>;
  readonly revokeDevice: (sessionId: string) => Promise<void>;
  readonly revokeOtherDevices: () => Promise<void>;
  readonly openBillingPortal: () => Promise<void>;
  readonly runMicCheck: () => Promise<void>;
  readonly syncCatalogNow: () => Promise<void>;
  readonly clearCacheNow: () => Promise<void>;
  readonly copyUserId: () => Promise<void>;
  readonly exportStudyData: () => Promise<string | null>;
  readonly setShowSignOutModal: (open: boolean) => void;
  readonly confirmSignOut: () => Promise<void>;
  readonly setShowDeleteModal: (open: boolean) => void;
  readonly confirmDeleteAccount: () => Promise<void>;
  readonly dismissBanner: () => void;
}

export type SettingsController = SettingsControllerState & SettingsControllerActions;

function buildDefaultProfile(
  deviceId: string,
  nowMs: number,
  session: AuthSession | null,
): UserProfileRecord {
  const defaultTrack: SupportedExamId = 'ielts_academic';
  return {
    deviceId,
    examId: defaultTrack,
    examModule: 'academic',
    targetBand: EXAM_TRACK_SPECS[defaultTrack].targetScoreDefault,
    targetDateSerial: null,
    onboardingCompleted: false,
    freeDiagnosticUsed: false,
    linkedEmail: session?.user?.email ?? null,
    appUserId: session?.user?.userId ?? null,
    isPro: session?.user?.isPro ?? false,
    updatedAtMs: nowMs,
  };
}

export function useSettingsController(options?: {
  readonly onExternalRedirect?: (url: string) => void;
}): SettingsController {
  const deps = useDeps();
  const { session } = useAuthSession(deps.auth);

  const [isLoading, setIsLoading] = useState(true);
  const [deviceId, setDeviceId] = useState('local-desktop-device');
  const [userProfile, setUserProfile] = useState<UserProfileRecord | null>(null);
  const [appearance, setAppearance] = useState<AppearanceState>(() => readStoredAppearance());
  const [activeDevices, setActiveDevices] = useState<readonly ActiveDeviceSlot[]>([]);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);
  const [entitlement, setEntitlement] = useState<EntitlementSnapshot | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [cacheSummary, setCacheSummary] = useState<CacheUsageSummary | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isSyncingCatalog, setIsSyncingCatalog] = useState(false);
  const [isSyncingCrossDevice, setIsSyncingCrossDevice] = useState(false);
  const [lastSyncedAtIso, setLastSyncedAtIso] = useState<string | null>(null);
  const [dailyNewVocabCap, setDailyNewVocabCapState] = useState<number>(DEFAULT_DAILY_NEW_CAP);
  const [preferredTtsAccent, setPreferredTtsAccentState] = useState<'us' | 'uk'>('us');
  const [isExportingData, setIsExportingData] = useState(false);
  const [micStatus, setMicStatus] = useState<MicPreflightStatus | null>(null);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevelRms, setMicLevelRms] = useState(0);
  const [loopbackResult, setLoopbackResult] = useState<LoopbackTestResult | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [banner, setBanner] = useState<SettingsStatusBanner | null>(null);

  const loadDevices = useCallback(
    async (activeSession: AuthSession | null) => {
      if (!activeSession?.isAuthenticated) {
        setActiveDevices([]);
        return;
      }
      const res = await deps.deviceSlots.listActiveDevices();
      if (res.ok) {
        setActiveDevices(res.value);
      }
    },
    [deps.deviceSlots],
  );

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const [identityRes, profileRes, appearanceRes, billingRes, cacheRes, micRes] =
        await Promise.all([
          deps.auth.getDeviceIdentity(),
          deps.attemptStore.getUserProfile(),
          deps.attemptStore.getAppearance(),
          deps.billing.getPlansAndEntitlement(),
          deps.catalog.getCacheUsageSummary(),
          deps.audioRecorder.checkMicPermissionAndDevices(),
        ]);

      if (!mounted) return;

      const resolvedDeviceId = identityRes.ok
        ? identityRes.value.deviceInstallId
        : 'local-desktop-device';
      setDeviceId(resolvedDeviceId);

      if (profileRes.ok && profileRes.value) {
        setUserProfile(profileRes.value);
      } else {
        setUserProfile(buildDefaultProfile(resolvedDeviceId, deps.clock.nowMs(), session));
      }

      if (appearanceRes.ok && appearanceRes.value) {
        const synced = applyAndPersistAppearance({
          presetId: appearanceRes.value.presetId,
          modePreference: appearanceRes.value.themeModeKey,
        });
        setAppearance(synced);
      }

      if (billingRes.ok) {
        setEntitlement(billingRes.value.entitlement);
      }

      if (cacheRes.ok) {
        setCacheSummary(cacheRes.value);
      }

      if (micRes.ok) {
        setMicStatus(micRes.value);
      }

      if (deps.personalization) {
        const pRes = await deps.personalization.getState();
        if (mounted && pRes.ok) {
          const acc = pRes.value.profile.preferredTtsAccent === 'uk' ? 'uk' : 'us';
          setDailyNewVocabCapState(pRes.value.profile.dailyNewVocabCap);
          setPreferredTtsAccentState(acc);
          setGlobalDefaultTtsAccent(acc);
        }
      }

      setIsLoading(false);
    }

    void hydrate();
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore, deps.audioRecorder, deps.auth, deps.billing, deps.catalog, deps.clock, session]);

  useEffect(() => {
    void loadDevices(session);
  }, [loadDevices, session]);

  const activeTrack: SupportedExamId = userProfile?.examId ?? 'ielts_academic';
  const studyFocus: 'exams' | 'coach' | 'both' = userProfile?.studyFocus ?? 'both';
  const favoriteTopics: readonly string[] = normalizeFavoriteTopicList(
    userProfile?.favoriteTopics ?? [],
  );
  const targetScore = userProfile?.targetBand ?? EXAM_TRACK_SPECS[activeTrack].targetScoreDefault;

  const persistProfile = useCallback(
    async (patch: Partial<UserProfileRecord>) => {
      const base =
        userProfile ?? buildDefaultProfile(deviceId, deps.clock.nowMs(), session);
      const next: UserProfileRecord = {
        ...base,
        ...patch,
        updatedAtMs: deps.clock.nowMs(),
      };
      setUserProfile(next);
      const res = await deps.attemptStore.saveUserProfile(next);
      if (!res.ok) {
        setBanner({ tone: 'danger', kind: 'raw', message: res.error.message });
      }
      if (deps.personalization) {
        const pRes = await deps.personalization.updateProfile({
          examTrack: next.examId,
          targetBand: next.targetBand,
          favoriteTopics: normalizeFavoriteTopicList(next.favoriteTopics ?? []),
          studyFocus: next.studyFocus ?? 'both',
        });
        if (!pRes.ok) {
          void deps.syncOutbox.enqueue({
            idempotencyKey: `profile.update:${next.updatedAtMs}`,
            actionType: 'profile.update',
            entityKind: 'attempt',
            payloadJson: JSON.stringify({
              examTrack: next.examId,
              targetBand: next.targetBand,
              studyFocus: next.studyFocus ?? 'both',
              favoriteTopics: normalizeFavoriteTopicList(next.favoriteTopics ?? []),
            }),
          });
        }
      }
    },
    [deps.attemptStore, deps.clock, deps.personalization, deps.syncOutbox, deviceId, session, userProfile],
  );

  const setDailyNewVocabCap = useCallback(
    async (cap: number) => {
      setDailyNewVocabCapState(cap);
      await deps.personalization?.updateProfile({ dailyNewVocabCap: cap });
    },
    [deps.personalization],
  );

  const setPreferredTtsAccent = useCallback(
    async (accent: 'us' | 'uk') => {
      setPreferredTtsAccentState(accent);
      setGlobalDefaultTtsAccent(accent);
      await deps.personalization?.updateProfile({ preferredTtsAccent: accent });
    },
    [deps.personalization],
  );

  const toggleFavoriteTopic = useCallback(
    async (topicKey: string) => {
      const current = normalizeFavoriteTopicList(userProfile?.favoriteTopics ?? []);
      const nextTopics = current.includes(topicKey as never)
        ? current.filter((t) => t !== topicKey)
        : [...current, topicKey];
      await persistProfile({ favoriteTopics: normalizeFavoriteTopicList(nextTopics) });
    },
    [persistProfile, userProfile?.favoriteTopics],
  );

  const syncAcrossDevicesNow = useCallback(async () => {
    setIsSyncingCrossDevice(true);
    const summary = await pullCrossDeviceState(deps);
    setIsSyncingCrossDevice(false);
    if (!summary.pulled) {
      setBanner({
        tone: 'warning',
        kind: 'raw',
        message: 'Cross-device sync requires sign-in and active connection.',
      });
      return;
    }
    setLastSyncedAtIso(summary.syncedAtIso);
    const profileRes = await deps.attemptStore.getUserProfile();
    if (profileRes.ok && profileRes.value) {
      setUserProfile(profileRes.value);
    }
    setBanner({
      tone: 'success',
      kind: 'raw',
      message: `Synced ${summary.attemptsMerged} attempts, ${summary.vocabStatesMerged} vocab states, ${summary.pronunciationMerged} voice takes.`,
    });
  }, [deps]);

  const selectTrack = useCallback(
    async (track: SupportedExamId) => {
      const nextTarget = nextTargetWhenSwitchingFrom({
        target: track,
        previous: activeTrack,
        previousTarget: targetScore,
      });
      await persistProfile({
        examId: track,
        examModule: track === 'ielts_general' ? 'general_training' : 'academic',
        targetBand: nextTarget,
      });
    },
    [activeTrack, persistProfile, targetScore],
  );

  const setStudyFocus = useCallback(
    async (focus: 'exams' | 'coach' | 'both') => {
      await persistProfile({ studyFocus: focus });
    },
    [persistProfile],
  );

  const setTargetScore = useCallback(
    async (nextScore: number) => {
      const quantized = quantizeExamScore(nextScore, activeTrack);
      await persistProfile({ targetBand: quantized });
    },
    [activeTrack, persistProfile],
  );

  const stepTargetScore = useCallback(
    async (delta: -1 | 1) => {
      const spec = EXAM_TRACK_SPECS[activeTrack];
      const candidate = quantizeExamScore(targetScore + delta * spec.scoreStep, activeTrack);
      await persistProfile({ targetBand: candidate });
    },
    [activeTrack, persistProfile, targetScore],
  );

  const persistAppearance = useCallback(
    async (nextPresetId: ThemePresetId, nextMode: ThemeModePreference) => {
      const updated = applyAndPersistAppearance({
        presetId: nextPresetId,
        modePreference: nextMode,
      });
      setAppearance(updated);
      await deps.attemptStore.saveAppearance({
        presetId: updated.presetId,
        themeModeKey: updated.modePreference,
        updatedAtMs: deps.clock.nowMs(),
      });
    },
    [deps.attemptStore, deps.clock],
  );

  const setThemeMode = useCallback(
    async (mode: ThemeModePreference) => {
      await persistAppearance(appearance.presetId, mode);
    },
    [appearance.presetId, persistAppearance],
  );

  const setThemePreset = useCallback(
    async (presetId: ThemePresetId) => {
      await persistAppearance(presetId, appearance.modePreference);
    },
    [appearance.modePreference, persistAppearance],
  );

  const revokeDevice = useCallback(
    async (sessionId: string) => {
      const target = activeDevices.find((item) => item.sessionId === sessionId);
      if (!target) return;

      setRevokingSessionId(sessionId);
      const res = await deps.deviceSlots.revokeDeviceSession(target.deviceId);
      setRevokingSessionId(null);

      if (!res.ok) {
        setBanner({ tone: 'danger', kind: 'raw', message: res.error.message });
        return;
      }

      setActiveDevices(res.value.sessions);
      setBanner({ tone: 'info', kind: 'device_revoked' });
      if (res.value.signedOutCurrentDevice) {
        await deps.auth.signOutCurrentDevice();
      }
    },
    [activeDevices, deps.auth, deps.deviceSlots],
  );

  const revokeOtherDevices = useCallback(async () => {
    setIsRevokingOthers(true);
    const res = await deps.deviceSlots.revokeOtherDeviceSessions();
    setIsRevokingOthers(false);

    if (!res.ok) {
      setBanner({ tone: 'danger', kind: 'raw', message: res.error.message });
      return;
    }

    setActiveDevices(res.value.sessions);
    setBanner({
      tone: 'success',
      kind: 'others_revoked',
      count: res.value.revokedDeviceIds.length,
    });
  }, [deps.deviceSlots]);

  const openBillingPortal = useCallback(async () => {
    if (!deps.billing.openCustomerPortal) return;
    setIsOpeningPortal(true);
    const res = await deps.billing.openCustomerPortal();
    setIsOpeningPortal(false);

    if (!res.ok) {
      setBanner({ tone: 'danger', kind: 'raw', message: res.error.message });
      return;
    }

    if (options?.onExternalRedirect) {
      options.onExternalRedirect(res.value.portalUrl);
    } else if (typeof window !== 'undefined') {
      window.location.assign(res.value.portalUrl);
    }
  }, [deps.billing, options]);

  const runMicCheck = useCallback(async () => {
    setIsTestingMic(true);
    setLoopbackResult(null);
    const statusRes = await deps.audioRecorder.checkMicPermissionAndDevices();
    if (statusRes.ok) {
      setMicStatus(statusRes.value);
    } else {
      setIsTestingMic(false);
      setBanner({ tone: 'danger', kind: 'raw', message: statusRes.error.message });
      return;
    }

    const loopbackRes = await deps.audioRecorder.runPreflightLoopbackTest(1500, (rms) => {
      setMicLevelRms(rms);
    });
    setIsTestingMic(false);

    if (!loopbackRes.ok) {
      setBanner({ tone: 'warning', kind: 'raw', message: loopbackRes.error.message });
      return;
    }

    setLoopbackResult(loopbackRes.value);
    setMicLevelRms(loopbackRes.value.peakRms);
  }, [deps.audioRecorder]);

  const syncCatalogNow = useCallback(async () => {
    setIsSyncingCatalog(true);
    const res = await deps.catalog.syncCatalogManifest();
    setIsSyncingCatalog(false);
    if (!res.ok) {
      setBanner({ tone: 'danger', kind: 'raw', message: res.error.message });
      return;
    }
    const cacheRes = await deps.catalog.getCacheUsageSummary();
    if (cacheRes.ok) {
      setCacheSummary(cacheRes.value);
    }
    setBanner({
      tone: 'success',
      kind: 'catalog_synced',
      count: res.value.length,
    });
  }, [deps.catalog]);

  const clearCacheNow = useCallback(async () => {
    setIsClearingCache(true);
    const res = await deps.catalog.clearDownloadedCaches();
    const summaryRes = await deps.catalog.getCacheUsageSummary();
    setIsClearingCache(false);

    if (!res.ok) {
      setBanner({ tone: 'danger', kind: 'raw', message: res.error.message });
      return;
    }
    if (summaryRes.ok) {
      setCacheSummary(summaryRes.value);
    }
    setBanner({
      tone: 'success',
      kind: 'cache_cleared',
      bytes: res.value.clearedBytes,
    });
  }, [deps.catalog]);

  const copyUserId = useCallback(async () => {
    const idText = session?.user?.userId ?? deviceId;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(idText);
      } catch {
        // Ignore clipboard denial in restricted environments.
      }
    }
    setBanner({ tone: 'info', kind: 'id_copied' });
  }, [deviceId, session?.user?.userId]);

  const exportStudyData = useCallback(async () => {
    setIsExportingData(true);
    const res = await deps.attemptStore.exportStudyDataJson();
    setIsExportingData(false);

    if (!res.ok) {
      setBanner({ tone: 'danger', kind: 'raw', message: res.error.message });
      return null;
    }

    const json = JSON.stringify(res.value, null, 2);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(json);
      } catch {
        // Clipboard permission unavailable; continue cleanly.
      }
    }
    setBanner({ tone: 'success', kind: 'data_exported', chars: json.length });
    return json;
  }, [deps.attemptStore]);

  const confirmSignOut = useCallback(async () => {
    setIsSigningOut(true);
    const res = await deps.auth.signOutCurrentDevice();
    setIsSigningOut(false);
    setShowSignOutModal(false);

    if (!res.ok) {
      setBanner({ tone: 'danger', kind: 'raw', message: res.error.message });
      return;
    }
    setActiveDevices([]);
  }, [deps.auth]);

  const confirmDeleteAccount = useCallback(async () => {
    setIsDeletingAccount(true);
    const remoteRes = await deps.auth.deleteRemoteAccount();
    await deps.catalog.eraseAllCachedMedia();
    await deps.attemptStore.wipeAllData();
    setIsDeletingAccount(false);
    setShowDeleteModal(false);

    if (!remoteRes.ok) {
      setBanner({ tone: 'danger', kind: 'raw', message: remoteRes.error.message });
      return;
    }

    setActiveDevices([]);
    setUserProfile(buildDefaultProfile(deviceId, deps.clock.nowMs(), null));
    setCacheSummary({
      totalBytes: 0,
      quotaBytes: 262_144_000,
      packCount: 0,
      userRecordingBytes: 0,
    });

    const receipt = remoteRes.value.receiptToken ?? remoteRes.value.erasureId ?? 'local-wipe';
    setBanner({
      tone: remoteRes.value.deleted ? 'success' : 'warning',
      kind: 'account_deleted',
      completed: remoteRes.value.deleted,
      receipt,
    });
  }, [deps.attemptStore, deps.auth, deps.catalog, deps.clock, deviceId]);

  return {
    session,
    isLoading,
    deviceId,
    userProfile,
    activeTrack,
    studyFocus,
    favoriteTopics,
    dailyNewVocabCap,
    preferredTtsAccent,
    lastSyncedAtIso,
    isSyncingCrossDevice,
    targetScore,
    appearance,
    activeDevices,
    revokingSessionId,
    isRevokingOthers,
    entitlement,
    canOpenPortal: Boolean(deps.billing.openCustomerPortal),
    isOpeningPortal,
    cacheSummary,
    isClearingCache,
    isSyncingCatalog,
    isExportingData,
    micStatus,
    isTestingMic,
    micLevelRms,
    loopbackResult,
    isSigningOut,
    isDeletingAccount,
    showSignOutModal,
    showDeleteModal,
    banner,
    selectTrack,
    setStudyFocus,
    toggleFavoriteTopic,
    setDailyNewVocabCap,
    setPreferredTtsAccent,
    syncAcrossDevicesNow,
    setTargetScore,
    stepTargetScore,
    setThemeMode,
    setThemePreset,
    refreshDevices: async () => loadDevices(session),
    revokeDevice,
    revokeOtherDevices,
    openBillingPortal,
    runMicCheck,
    syncCatalogNow,
    clearCacheNow,
    copyUserId,
    exportStudyData,
    setShowSignOutModal,
    confirmSignOut,
    setShowDeleteModal,
    confirmDeleteAccount,
    dismissBanner: () => setBanner(null),
  };
}

export { EXAM_DESCRIPTORS, EXAM_TRACK_SPECS, formatExamScore, SUPPORTED_EXAM_IDS };

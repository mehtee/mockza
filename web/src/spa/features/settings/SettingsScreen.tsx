import { estimateToeflLegacy120, type SupportedExamId } from '@mockza/domain';
import { Link } from '@tanstack/react-router';
import {
  Check,
  Copy,
  Crown,
  Download,
  ExternalLink,
  HardDrive,
  Info,
  LogOut,
  Mic,
  Minus,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  DeviceSessionCard,
  DeviceSlotStrip,
  MzBanner,
  MzButton,
  MzCard,
  MzModal,
  MzSegmentedControl,
} from '@/components/ui';
import { formatByteSize } from '@/edition/bidi/format-bytes';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { formatDisplayDate } from '@/edition/calendar/jalali-edge';
import { BdiLtr, createTranslator, type TranslationKey } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { THEME_PRESETS, type ThemePresetId } from '@/theme/generated-presets';
import type { ThemeModePreference } from '@/theme/theme-controller';
import {
  EXAM_DESCRIPTORS,
  EXAM_TRACK_SPECS,
  formatExamScore,
  type SettingsStatusBanner,
  SUPPORTED_EXAM_IDS,
  useSettingsController,
} from './useSettingsController';

const TRACK_I18N_KEYS: Record<SupportedExamId, TranslationKey> = {
  ielts_academic: 'trackIeltsAcademic',
  ielts_general: 'trackIeltsGeneral',
  toefl_ibt: 'trackToeflIbt',
  pte_academic: 'trackPteAcademic',
  det: 'trackDet',
};

const PRESET_I18N_KEYS: Record<ThemePresetId, TranslationKey> = {
  midnight_indigo: 'presetMidnightIndigo',
  nordic_emerald: 'presetNordicEmerald',
  editorial_amber: 'presetEditorialAmber',
  oceanic_cobalt: 'presetOceanicCobalt',
};

export interface SettingsScreenProps {
  readonly onExternalRedirect?: (url: string) => void;
}

export function SettingsScreen({ onExternalRedirect }: SettingsScreenProps = {}) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const ctrl = useSettingsController({ onExternalRedirect });

  const trackSpec = EXAM_TRACK_SPECS[ctrl.activeTrack];
  const trackDescriptor = EXAM_DESCRIPTORS[ctrl.activeTrack];
  const isAuthenticated = Boolean(ctrl.session?.isAuthenticated);
  const identityLabel =
    ctrl.session?.user?.email ??
    ctrl.session?.user?.phoneE164 ??
    ctrl.session?.user?.displayName ??
    t('settingsIdentityGuestTitle');
  const effectiveUserId = ctrl.session?.user?.userId ?? ctrl.deviceId;

  const mobileOccupied = ctrl.activeDevices.some((slot) => slot.slotKind === 'mobile');
  const desktopOccupied = ctrl.activeDevices.some((slot) => slot.slotKind === 'desktop_web');
  const hasOtherDevices = ctrl.activeDevices.some((slot) => !slot.isCurrentDevice);

  const isPro = Boolean(ctrl.entitlement?.isPro || ctrl.session?.user?.isPro);
  const expiresTimestamp = ctrl.entitlement?.expiresAt ? Date.parse(ctrl.entitlement.expiresAt) : Number.NaN;
  const formattedExpiry = Number.isFinite(expiresTimestamp)
    ? formatDisplayDate(expiresTimestamp, deps.edition)
    : null;

  const renderBannerMessage = (banner: SettingsStatusBanner): string => {
    switch (banner.kind) {
      case 'raw':
        return banner.message;
      case 'device_revoked':
        return t('settingsDeviceRevokedToast');
      case 'others_revoked':
        return `${t('settingsDeviceRevokedToast')} (${banner.count})`;
      case 'catalog_synced':
        return t('settingsCatalogSyncedToast', { count: banner.count });
      case 'cache_cleared':
        return t('settingsCacheClearedToast', { size: formatByteSize(banner.bytes, deps.edition) });
      case 'id_copied':
        return t('settingsCopiedToast');
      case 'data_exported':
        return t('settingsExportReadyToast', { bytes: banner.chars });
      case 'account_deleted':
        return banner.completed
          ? t('settingsDeletionDoneMessage', { receipt: banner.receipt })
          : t('settingsDeletionPartialMessage', { receipt: banner.receipt });
    }
  };

  return (
    <div data-testid="settings-screen" className="mx-auto flex max-w-6xl flex-col gap-6 pb-10 text-start">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('navSettings')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('settingsSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={[
              'inline-flex items-center gap-1.5 rounded-[var(--mz-radius-pill)] border px-3 py-1 text-xs font-semibold',
              isPro
                ? 'border-primary/40 bg-mint-bg text-success'
                : 'border-border-subtle bg-surface-alt text-text-secondary',
            ].join(' ')}
          >
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            {isPro ? t('settingsProActiveBadge') : t('settingsFreePlanBadge')}
          </span>
        </div>
      </header>

      {ctrl.banner ? (
        <MzBanner
          tone={ctrl.banner.tone}
          actions={
            <button
              type="button"
              onClick={ctrl.dismissBanner}
              aria-label="Dismiss"
              className="rounded p-1 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          }
        >
          {renderBannerMessage(ctrl.banner)}
        </MzBanner>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Primary Column: Account + Active 1+1 Devices + Exam Track + Appearance */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          <MzCard variant="default">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  {t('settingsActiveDevicesSection')}
                </h2>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {isAuthenticated ? <BdiLtr>{identityLabel}</BdiLtr> : t('settingsIdentityGuestDesc')}
                </p>
              </div>
              {isAuthenticated ? (
                <MzButton
                  variant="ghost"
                  size="sm"
                  data-testid="settings-signout-btn"
                  leadingIcon={<LogOut className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() => ctrl.setShowSignOutModal(true)}
                >
                  {t('authSignOutAction')}
                </MzButton>
              ) : (
                <Link
                  to="/auth/login"
                  search={{ returnTo: '/app/settings' }}
                  data-testid="settings-signin-link"
                  className="inline-flex h-8 items-center justify-center rounded-[var(--mz-radius-compact)] bg-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-strong"
                >
                  {t('authSignInAction')}
                </Link>
              )}
            </div>

            <div className="mt-4">
              <DeviceSlotStrip
                mobileOccupied={mobileOccupied}
                desktopWebOccupied={desktopOccupied}
                mobileTitle={t('authMobileSlotTitle')}
                desktopTitle={t('authDesktopSlotTitle')}
                activeLabel={t('authSlotActiveBadge')}
                openLabel={t('authSlotOpenBadge')}
              />
            </div>

            {isAuthenticated ? (
              <div className="mt-4 flex flex-col gap-2.5">
                {ctrl.activeDevices.length === 0 ? (
                  <p className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3 text-xs text-text-secondary">
                    {t('settingsNoActiveDevicesHint')}
                  </p>
                ) : (
                  ctrl.activeDevices.map((slot) => (
                    <DeviceSessionCard
                      key={slot.sessionId}
                      session={slot}
                      edition={deps.edition}
                      currentBadgeLabel={t('settingsCurrentDeviceBadge')}
                      mobileLabel={t('authMobileSlotTitle')}
                      desktopLabel={t('authDesktopSlotTitle')}
                      revokeLabel={t('settingsRevokeDeviceAction')}
                      isRevoking={ctrl.revokingSessionId === slot.sessionId}
                      onRevoke={(sessionId) => void ctrl.revokeDevice(sessionId)}
                    />
                  ))
                )}

                {hasOtherDevices ? (
                  <div className="pt-1">
                    <MzButton
                      variant="secondary"
                      size="sm"
                      data-testid="settings-revoke-others-btn"
                      isLoading={ctrl.isRevokingOthers}
                      onClick={() => void ctrl.revokeOtherDevices()}
                    >
                      {t('settingsRevokeOthersAction')}
                    </MzButton>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 border-t border-border-subtle pt-4">
              <p className="text-xs font-medium text-text-secondary">{t('settingsDeviceIdLabel')}</p>
              <p className="mt-1 truncate font-mono-exam text-xs text-text-primary">
                <BdiLtr>{effectiveUserId}</BdiLtr>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <MzButton
                  variant="secondary"
                  size="sm"
                  data-testid="settings-copy-id-btn"
                  leadingIcon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() => void ctrl.copyUserId()}
                >
                  {t('settingsCopyIdAction')}
                </MzButton>
                <MzButton
                  variant="secondary"
                  size="sm"
                  data-testid="settings-sync-catalog-btn"
                  isLoading={ctrl.isSyncingCatalog}
                  leadingIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() => void ctrl.syncCatalogNow()}
                >
                  {ctrl.isSyncingCatalog ? t('settingsSyncingCatalog') : t('settingsSyncCatalogAction')}
                </MzButton>
                <MzButton
                  variant="secondary"
                  size="sm"
                  data-testid="settings-export-btn"
                  isLoading={ctrl.isExportingData}
                  leadingIcon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() => void ctrl.exportStudyData()}
                >
                  {t('settingsExportDataAction')}
                </MzButton>
              </div>
            </div>
          </MzCard>

          <MzCard variant="default">
            <h2 className="text-base font-semibold text-text-primary">
              {t('settingsExamTrackSection')}
            </h2>
            <p className="mt-0.5 text-xs text-text-secondary">{trackDescriptor.subtitle}</p>

            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t('settingsExamTrackSection')}>
              {SUPPORTED_EXAM_IDS.map((trackId) => {
                const selected = ctrl.activeTrack === trackId;
                return (
                  <button
                    key={trackId}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-testid={`settings-track-${trackId}`}
                    onClick={() => void ctrl.selectTrack(trackId)}
                    className={[
                      'rounded-[var(--mz-radius-pill)] border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                      selected
                        ? 'border-primary bg-primary text-white'
                        : 'border-border-subtle bg-bg-raised text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                    ].join(' ')}
                  >
                    {t(TRACK_I18N_KEYS[trackId])}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle pt-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary">
                  {t('settingsTargetScoreLabel', { unit: trackSpec.unitLabel })}
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {ctrl.activeTrack === 'toefl_ibt'
                    ? t('settingsToeflBridgeHint', {
                        legacy: estimateToeflLegacy120(ctrl.targetScore),
                      })
                    : t('settingsPersonalGoalHint')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <MzButton
                  variant="secondary"
                  size="sm"
                  data-testid="settings-target-dec"
                  disabled={ctrl.targetScore <= trackSpec.minScore}
                  onClick={() => void ctrl.stepTargetScore(-1)}
                  aria-label="Decrease target score"
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                </MzButton>
                <LtrExamBoundary className="min-w-[3.5rem] text-center">
                  <span
                    data-testid="settings-target-value"
                    className="font-mono-exam text-base font-bold text-primary"
                  >
                    {formatExamScore(ctrl.targetScore, ctrl.activeTrack)}
                  </span>
                </LtrExamBoundary>
                <MzButton
                  variant="secondary"
                  size="sm"
                  data-testid="settings-target-inc"
                  disabled={ctrl.targetScore >= trackSpec.maxScore}
                  onClick={() => void ctrl.stepTargetScore(1)}
                  aria-label="Increase target score"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </MzButton>
              </div>
            </div>

            <div className="mt-3">
              <LtrExamBoundary>
                <input
                  type="range"
                  aria-label={t('settingsTargetScoreLabel', { unit: trackSpec.unitLabel })}
                  data-testid="settings-target-slider"
                  min={trackSpec.minScore}
                  max={trackSpec.maxScore}
                  step={trackSpec.scoreStep}
                  value={ctrl.targetScore}
                  onChange={(event) => void ctrl.setTargetScore(Number(event.target.value))}
                  className="w-full accent-primary"
                />
              </LtrExamBoundary>
            </div>
          </MzCard>

          <MzCard variant="default">
            <h2 className="text-base font-semibold text-text-primary">
              {t('settingsAppearanceSection')}
            </h2>

            <div className="mt-3">
              <MzSegmentedControl<ThemeModePreference>
                ariaLabel={t('settingsAppearanceSection')}
                value={ctrl.appearance.modePreference}
                onChange={(mode) => void ctrl.setThemeMode(mode)}
                options={[
                  { value: 'dark', label: t('settingsThemeDark') },
                  { value: 'light', label: t('settingsThemeLight') },
                  { value: 'system', label: t('settingsThemeSystem') },
                ]}
              />
            </div>

            <p className="mt-4 text-xs font-medium text-text-secondary">
              {t('settingsPresetLabel')}
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {THEME_PRESETS.map((preset) => {
                const selected = ctrl.appearance.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`settings-preset-${preset.id}`}
                    aria-pressed={selected}
                    onClick={() => void ctrl.setThemePreset(preset.id)}
                    className={[
                      'flex items-center justify-between gap-3 rounded-[var(--mz-radius-control)] border p-3 text-start transition-colors',
                      selected
                        ? 'border-primary bg-surface-alt'
                        : 'border-border-subtle bg-bg-raised hover:bg-surface-hover',
                    ].join(' ')}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex shrink-0 items-center -space-x-1 rtl:space-x-reverse">
                        <span
                          className="h-4 w-4 rounded-full border border-border-strong"
                          style={{ backgroundColor: preset.preview.backgroundDark }}
                        />
                        <span
                          className="h-4 w-4 rounded-full border border-border-strong"
                          style={{ backgroundColor: preset.preview.primary }}
                        />
                        <span
                          className="h-4 w-4 rounded-full border border-border-strong"
                          style={{ backgroundColor: preset.preview.accent }}
                        />
                      </span>
                      <span className="truncate text-xs font-semibold text-text-primary">
                        {t(PRESET_I18N_KEYS[preset.id])}
                      </span>
                    </div>
                    {selected ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </MzCard>
        </div>

        {/* Right Secondary Column: Subscription, Mic Studio Check, Cache, Legal, Danger Zone */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          <MzCard variant="hero">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  {t('settingsSubscriptionSection')}
                </h2>
                <p className="mt-1 text-xs text-text-secondary">
                  {isPro
                    ? ctrl.entitlement?.activePlanId ?? t('settingsProActiveBadge')
                    : t('paywallAllowanceSpeakingWriting')}
                </p>
                {formattedExpiry ? (
                  <p className="mt-1 text-xs text-text-secondary">
                    {t('settingsExpiresLabel', { date: formattedExpiry })}
                  </p>
                ) : null}
              </div>
              <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/paywall"
                search={{}}
                data-testid="settings-open-paywall-link"
                className="inline-flex h-9 items-center justify-center rounded-[var(--mz-radius-compact)] bg-primary px-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
              >
                {t('paywallSubscribeAction')}
              </Link>
              {isPro && ctrl.canOpenPortal ? (
                <MzButton
                  variant="secondary"
                  size="sm"
                  data-testid="settings-billing-portal-btn"
                  isLoading={ctrl.isOpeningPortal}
                  leadingIcon={<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() => void ctrl.openBillingPortal()}
                >
                  {t('settingsManageBillingAction')}
                </MzButton>
              ) : null}
            </div>
          </MzCard>

          <MzCard variant="default">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4 text-primary" aria-hidden="true" />
                <h2 className="text-base font-semibold text-text-primary">
                  {t('settingsAudioSection')}
                </h2>
              </div>
              <MzButton
                variant="secondary"
                size="sm"
                data-testid="settings-mic-check-btn"
                isLoading={ctrl.isTestingMic}
                onClick={() => void ctrl.runMicCheck()}
              >
                {ctrl.isTestingMic ? t('settingsMicTestingLabel') : t('settingsMicTestAction')}
              </MzButton>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {ctrl.micStatus?.permission === 'denied' ? (
                <MzBanner tone="warning">{t('settingsMicPermissionDenied')}</MzBanner>
              ) : (
                <p className="text-xs text-text-secondary">
                  {t('settingsMicReadyLabel', { count: ctrl.micStatus?.devices.length ?? 0 })}
                </p>
              )}

              <div>
                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span>{t('settingsMicLevelLabel')}</span>
                  <LtrExamBoundary>
                    <span className="font-mono-exam">
                      {Math.round(ctrl.micLevelRms * 100)}%
                    </span>
                  </LtrExamBoundary>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-alt">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, Math.round(ctrl.micLevelRms * 100))}%` }}
                  />
                </div>
              </div>

              {ctrl.loopbackResult?.isMutedWarning ? (
                <MzBanner tone="warning">{t('settingsMicMutedWarning')}</MzBanner>
              ) : null}
            </div>
          </MzCard>

          <MzCard variant="default">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" aria-hidden="true" />
                <div>
                  <h2 className="text-base font-semibold text-text-primary">
                    {t('settingsOfflineCacheSection')}
                  </h2>
                  <p className="mt-0.5 text-xs text-text-secondary" data-testid="settings-cache-summary">
                    {ctrl.cacheSummary && (ctrl.cacheSummary.packCount > 0 || ctrl.cacheSummary.totalBytes > 0)
                      ? t('settingsCacheUsageSummary', {
                          count: ctrl.cacheSummary.packCount,
                          size: formatByteSize(ctrl.cacheSummary.totalBytes, deps.edition),
                        })
                      : t('settingsCacheEmptySummary')}
                  </p>
                </div>
              </div>

              <MzButton
                variant="secondary"
                size="sm"
                data-testid="settings-clear-cache-btn"
                isLoading={ctrl.isClearingCache}
                onClick={() => void ctrl.clearCacheNow()}
              >
                {ctrl.isClearingCache ? t('settingsClearingCache') : t('settingsClearCacheAction')}
              </MzButton>
            </div>
          </MzCard>

          <MzCard variant="alt">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
              <div>
                <h2 className="text-xs font-semibold text-text-primary">
                  {t('settingsDisclaimerTitle')}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                  {t('settingsDisclaimerBody')}
                </p>
              </div>
            </div>
          </MzCard>

          <section
            aria-label={t('settingsDangerZoneTitle')}
            className="rounded-[var(--mz-radius-card)] border border-error bg-danger-bg p-5"
          >
            <div className="flex items-center gap-2 text-error">
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              <h2 className="text-sm font-bold">{t('settingsDangerZoneTitle')}</h2>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
              {t('settingsDangerZoneDesc')}
            </p>
            <div className="mt-4">
              <MzButton
                variant="danger"
                size="sm"
                data-testid="settings-delete-account-btn"
                leadingIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
                onClick={() => ctrl.setShowDeleteModal(true)}
              >
                {t('settingsDeleteAccountAction')}
              </MzButton>
            </div>
          </section>
        </div>
      </div>

      {/* Sign Out Confirmation Modal */}
      <MzModal
        open={ctrl.showSignOutModal}
        onOpenChange={ctrl.setShowSignOutModal}
        title={t('settingsSignOutConfirmTitle')}
        description={t('settingsSignOutConfirmDesc')}
        footer={
          <>
            <MzButton variant="ghost" onClick={() => ctrl.setShowSignOutModal(false)}>
              {t('settingsCancelAction')}
            </MzButton>
            <MzButton
              variant="primary"
              data-testid="settings-confirm-signout-btn"
              isLoading={ctrl.isSigningOut}
              onClick={() => void ctrl.confirmSignOut()}
            >
              {t('settingsSignOutConfirmAction')}
            </MzButton>
          </>
        }
      >
        <p className="text-xs text-text-secondary">{t('authPolicyNoticeBody')}</p>
      </MzModal>

      {/* Account & Data Deletion Confirmation Modal */}
      <MzModal
        open={ctrl.showDeleteModal}
        onOpenChange={ctrl.setShowDeleteModal}
        title={t('settingsDeleteConfirmTitle')}
        description={t('settingsDeleteConfirmDesc')}
        footer={
          <>
            <MzButton variant="ghost" onClick={() => ctrl.setShowDeleteModal(false)}>
              {t('settingsCancelAction')}
            </MzButton>
            <MzButton
              variant="danger"
              data-testid="settings-confirm-delete-btn"
              isLoading={ctrl.isDeletingAccount}
              onClick={() => void ctrl.confirmDeleteAccount()}
            >
              {ctrl.isDeletingAccount
                ? t('settingsDeletingAction')
                : t('settingsDeleteConfirmAction')}
            </MzButton>
          </>
        }
      >
        <p className="text-xs text-text-secondary">{t('settingsDangerZoneDesc')}</p>
      </MzModal>
    </div>
  );
}

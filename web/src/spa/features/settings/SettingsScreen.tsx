import { CANONICAL_TOPICS, estimateToeflLegacy120, TOPIC_METADATA } from '@mockza/domain';
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
  ExamTrackSelector,
  MzBanner,
  MzButton,
  MzCard,
  MzModal,
  MzSegmentedControl,
  resolveOfficialCefrTier,
} from '@/components/ui';
import { formatByteSize } from '@/edition/bidi/format-bytes';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { formatChromeNumber } from '@/edition/bidi/numerals';
import {
  formatTargetScoreHeading,
  formatTrackSubtitle,
} from '@/components/bidi/topic-labels';
import { formatDisplayDate } from '@/edition/calendar/jalali-edge';
import { BdiLtr, createTranslator, type TranslationKey } from '@/i18n';
import { useDeps } from '@/spa/deps';
import { THEME_PRESETS, type ThemePresetId } from '@/theme/generated-presets';
import type { ThemeModePreference } from '@/theme/theme-controller';
import {
  EXAM_TRACK_SPECS,
  formatExamScore,
  type SettingsStatusBanner,
  useSettingsController,
} from './useSettingsController';

const PRESET_I18N_KEYS: Partial<Record<ThemePresetId, TranslationKey>> = {
  midnight_indigo: 'presetMidnightIndigo',
  nordic_emerald: 'presetNordicEmerald',
  editorial_amber: 'presetEditorialAmber',
  oceanic_cobalt: 'presetOceanicCobalt',
  editorial_green: 'presetEditorialGreen',
};

export interface SettingsScreenProps {
  readonly onExternalRedirect?: (url: string) => void;
}

export function SettingsScreen({ onExternalRedirect }: SettingsScreenProps = {}) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const ctrl = useSettingsController({ onExternalRedirect });

  const trackSpec = EXAM_TRACK_SPECS[ctrl.activeTrack];
  const targetScoreHeading = formatTargetScoreHeading(trackSpec, deps.edition);
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
        return `${t('settingsDeviceRevokedToast')} (${formatChromeNumber(banner.count, deps.edition)})`;
      case 'catalog_synced':
        return t('settingsCatalogSyncedToast', {
          count: formatChromeNumber(banner.count, deps.edition),
        });
      case 'cache_cleared':
        return t('settingsCacheClearedToast', { size: formatByteSize(banner.bytes, deps.edition) });
      case 'id_copied':
        return t('settingsCopiedToast');
      case 'data_exported':
        return t('settingsExportReadyToast', {
          bytes: formatChromeNumber(banner.chars, deps.edition),
        });
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
                  search={{ returnTo: '/settings' }}
                  data-testid="settings-signin-link"
                  className="inline-flex min-h-11 items-center justify-center rounded-[var(--mz-radius-compact)] bg-primary px-4 text-xs font-semibold text-on-primary transition-colors hover:bg-primary-pressed"
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <MzButton
                  variant="primary"
                  size="md"
                  data-testid="settings-sync-cross-device-btn"
                  isLoading={ctrl.isSyncingCrossDevice}
                  leadingIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
                  onClick={() => void ctrl.syncAcrossDevicesNow()}
                >
                  {t('settingsSyncNowBtn')}
                </MzButton>
                {ctrl.lastSyncedAtIso ? (
                  <p className="text-[11px] text-text-secondary">
                    {t('settingsLastSyncedLabel', {
                      time: new Date(ctrl.lastSyncedAtIso).toLocaleTimeString(
                        deps.edition === 'irn' ? 'fa-IR' : undefined,
                      ),
                    })}
                  </p>
                ) : null}
              </div>

              <details className="mt-4 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised px-3.5 py-2.5">
                <summary className="cursor-pointer select-none text-xs font-semibold text-text-secondary hover:text-text-primary">
                  {t('settingsTechnicalAccordionTitle')}
                </summary>
                <div className="mt-3 border-t border-border-subtle pt-3">
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
              </details>
            </div>
          </MzCard>

          <MzCard variant="default">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-text-primary">
                {t('settingsExamTrackSection')}
              </h2>
              <p className="mt-0.5 text-xs text-text-secondary">
                {formatTrackSubtitle(ctrl.activeTrack, deps.edition)}
              </p>
            </div>

            <ExamTrackSelector
              value={ctrl.activeTrack}
              onChange={(trackId) => void ctrl.selectTrack(trackId)}
              edition={deps.edition}
              ariaLabel={t('settingsExamTrackSection')}
              testIdPrefix="settings-track"
              columns={1}
            />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle pt-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-text-primary">
                    {targetScoreHeading}
                  </p>
                  <span className="rounded-[var(--mz-radius-pill)] border border-primary/30 bg-surface-alt px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                    {t(
                      resolveOfficialCefrTier(ctrl.targetScore, ctrl.activeTrack) === 'C2'
                        ? 'onboardingCefrC2'
                        : resolveOfficialCefrTier(ctrl.targetScore, ctrl.activeTrack) === 'C1'
                          ? 'onboardingCefrC1'
                          : resolveOfficialCefrTier(ctrl.targetScore, ctrl.activeTrack) === 'B2'
                            ? 'onboardingCefrB2'
                            : resolveOfficialCefrTier(ctrl.targetScore, ctrl.activeTrack) === 'B1'
                              ? 'onboardingCefrB1'
                              : resolveOfficialCefrTier(ctrl.targetScore, ctrl.activeTrack) === 'A2'
                                ? 'onboardingCefrA2'
                                : 'onboardingCefrA1',
                    )}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {ctrl.activeTrack === 'toefl_ibt'
                    ? t('settingsToeflBridgeHint', {
                        legacy: formatChromeNumber(
                          estimateToeflLegacy120(ctrl.targetScore),
                          deps.edition,
                        ),
                      })
                    : t('settingsPersonalGoalHint')}
                </p>
              </div>

              <LtrExamBoundary className="flex items-center gap-2">
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
                <span className="min-w-[3.5rem] text-center">
                  <span
                    data-testid="settings-target-value"
                    className="font-mono-exam text-base font-bold text-primary"
                  >
                    {formatExamScore(ctrl.targetScore, ctrl.activeTrack)}
                  </span>
                </span>
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
              </LtrExamBoundary>
            </div>

            <div className="mt-3">
              <LtrExamBoundary>
                <input
                  type="range"
                  aria-label={targetScoreHeading}
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

          <MzCard variant="default" data-testid="settings-study-focus-card">
            <h2 className="text-sm font-semibold text-text-primary">
              {t('learningFocusHeadline')}
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              {t('learningFocusSubtitle')}
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(['both', 'exams', 'coach'] as const).map((focusKey) => {
                const selected = ctrl.studyFocus === focusKey;
                const label =
                  focusKey === 'both'
                    ? t('learningFocusBothTitle')
                    : focusKey === 'exams'
                      ? t('learningFocusExamsTitle')
                      : t('learningFocusCoachTitle');
                return (
                  <button
                    key={focusKey}
                    type="button"
                    data-testid={`settings-focus-${focusKey}`}
                    aria-pressed={selected}
                    onClick={() => void ctrl.setStudyFocus(focusKey)}
                    className={`min-h-11 rounded-[var(--mz-radius-compact)] border px-3 py-2 text-start text-xs font-semibold transition-colors ${
                      selected
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-border-subtle bg-bg-raised text-text-primary hover:bg-surface-hover'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </MzCard>

          <MzCard variant="default" data-testid="settings-favorite-topics-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-text-primary">
                {t('settingsFavoriteTopicsTitle')}
              </h2>
              <span className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-2.5 py-0.5 text-[11px] font-semibold text-text-secondary">
                {t('settingsDailyNewCapTitle')}: {formatChromeNumber(ctrl.dailyNewVocabCap, deps.edition)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {CANONICAL_TOPICS.map((topicKey) => {
                const selected = ctrl.favoriteTopics.includes(topicKey);
                const label =
                  deps.edition === 'irn'
                    ? TOPIC_METADATA[topicKey].labelFa
                    : TOPIC_METADATA[topicKey].labelEn;
                return (
                  <button
                    key={topicKey}
                    type="button"
                    data-testid={`settings-topic-${topicKey}`}
                    onClick={() => void ctrl.toggleFavoriteTopic(topicKey)}
                    className={`inline-flex min-h-11 items-center rounded-[var(--mz-radius-pill)] border px-3.5 text-xs font-semibold transition-colors ${
                      selected
                        ? 'border-primary bg-primary text-on-primary'
                        : 'border-border-subtle bg-bg-raised text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border-subtle pt-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-text-primary">
                  {t('settingsDailyNewCapTitle')}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[5, 10, 20].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      data-testid={`settings-vocab-cap-${cap}`}
                      onClick={() => void ctrl.setDailyNewVocabCap(cap)}
                      className={[
                        'inline-flex min-h-11 items-center rounded-[var(--mz-radius-compact)] border px-3.5 text-xs font-semibold transition-colors',
                        deps.edition === 'irn' ? '' : 'font-mono',
                        ctrl.dailyNewVocabCap === cap
                          ? 'border-primary bg-primary text-on-primary'
                          : 'border-border-subtle bg-bg-raised text-text-secondary hover:text-text-primary',
                      ].join(' ')}
                    >
                      {t('settingsVocabCapOption', { count: formatChromeNumber(cap, deps.edition) })}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-text-primary">
                  {t('settingsTtsAccentTitle')}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['us', 'uk'] as const).map((acc) => (
                    <button
                      key={acc}
                      type="button"
                      data-testid={`settings-tts-accent-${acc}`}
                      onClick={() => void ctrl.setPreferredTtsAccent(acc)}
                      className={`inline-flex min-h-11 items-center rounded-[var(--mz-radius-compact)] border px-3.5 text-xs font-semibold transition-colors ${
                        ctrl.preferredTtsAccent === acc
                          ? 'border-primary bg-primary text-on-primary'
                          : 'border-border-subtle bg-bg-raised text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {acc === 'us' ? t('settingsTtsAccentUs') : t('settingsTtsAccentUk')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </MzCard>

          <MzCard variant="default">
            <h2 className="text-base font-semibold text-text-primary">
              {t('settingsAppearanceSection')}
            </h2>

            <div className="mt-3">
              <MzSegmentedControl<ThemeModePreference>
                ariaLabel={t('settingsAppearanceSection')}
                fullWidth
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
            <div className="mt-2 grid grid-cols-2 gap-2.5">
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
                      'flex min-h-12 items-center justify-between gap-2.5 rounded-[var(--mz-radius-control)] border p-3 text-start transition-colors',
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
                        {PRESET_I18N_KEYS[preset.id]
                          ? t(PRESET_I18N_KEYS[preset.id]!)
                          : preset.displayName}
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
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--mz-radius-compact)] bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-pressed"
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
                  {t('settingsMicReadyLabel', {
                    count: formatChromeNumber(ctrl.micStatus?.devices.length ?? 0, deps.edition),
                  })}
                </p>
              )}

              <div>
                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span>{t('settingsMicLevelLabel')}</span>
                  <LtrExamBoundary>
                    <span className="font-mono-exam">
                      {formatChromeNumber(Math.round(ctrl.micLevelRms * 100), deps.edition)}%
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
                          count: formatChromeNumber(ctrl.cacheSummary.packCount, deps.edition),
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

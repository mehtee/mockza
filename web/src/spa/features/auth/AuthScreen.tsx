import { CheckCircle2, Lock, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  DeviceSlotStrip,
  MzBanner,
  MzButton,
  MzCard,
  MzModal,
  MzSegmentedControl,
  MzTextField,
} from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { formatDisplayDate } from '@/edition/calendar/jalali-edge';
import { formatChromeNumber } from '@/edition/bidi/numerals';
import { createTranslator } from '@/i18n';
import {
  DEV_SANDBOX_PERSONAS,
  useAuthController,
} from './useAuthController';

export interface AuthScreenProps {
  readonly returnTo?: string;
  readonly reason?: string;
  readonly initialMode?: 'sign_in' | 'sign_up';
}

export function AuthScreen({
  returnTo,
  reason,
  initialMode = 'sign_in',
}: AuthScreenProps) {
  const navigate = useNavigate();

  const handleSuccess = () => {
    const normalizedReturnTo = returnTo?.startsWith('/app/')
      ? returnTo.slice('/app'.length)
      : returnTo === '/app'
        ? '/home'
        : returnTo;
    const safeTarget =
      normalizedReturnTo &&
      normalizedReturnTo.startsWith('/') &&
      normalizedReturnTo !== '/auth/login'
        ? normalizedReturnTo
        : '/home';
    void navigate({ to: safeTarget as '/home' });
  };

  const ctrl = useAuthController({
    reason,
    initialMode,
    onAuthenticated: handleSuccess,
  });

  const t = createTranslator(ctrl.edition);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [otpInput, setOtpInput] = useState('');

  const showSmsOtp =
    ctrl.editionCfg.features.smsOtp && (ctrl.providers.smsOtpEnabled ?? true);
  const showGoogle =
    ctrl.editionCfg.features.oauthGoogleApple && ctrl.providers.google.enabled;
  const showApple =
    ctrl.editionCfg.features.oauthGoogleApple && ctrl.providers.apple.enabled;

  const onEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ctrl.submitEmailAuth({
      email,
      password,
      displayName: ctrl.mode === 'sign_up' ? displayName : undefined,
    });
  };

  const onPhoneSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (ctrl.otpStep === 'phone') {
      void ctrl.requestSmsOtp(phoneInput);
    } else {
      void ctrl.verifySmsOtp({
        phoneE164: phoneInput,
        otpCode: otpInput,
        displayName: displayName || undefined,
      });
    }
  };

  const slotConflictTimestamp = ctrl.slotConflict
    ? Date.parse(ctrl.slotConflict.lastSeenAt)
    : Number.NaN;
  const slotConflictDateLabel =
    ctrl.slotConflict && Number.isFinite(slotConflictTimestamp)
      ? formatDisplayDate(slotConflictTimestamp, ctrl.edition)
      : ctrl.slotConflict?.lastSeenAt ?? '';

  return (
    <div
      data-testid="auth-screen"
      className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-6xl items-center py-6"
    >
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Value & 1+1 Device Slot Column */}
        <MzCard
          variant="hero"
          padding="lg"
          className="order-last flex flex-col justify-between gap-6 lg:order-first lg:col-span-5"
        >
          <div>
            <span className="inline-flex items-center gap-2 rounded-[var(--mz-radius-pill)] border border-border-strong bg-surface/75 px-3 py-1 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {t('authDeviceSlotBadge')}
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-text-primary">
              {t('appTitle')}
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-text-secondary">
              {t('authHeroSubtitle')}
            </p>

            <ul className="mt-6 flex flex-col gap-3 text-sm text-text-secondary">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <span>{t('authMultiExamSyncBullet')}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{t('authPolicyNoticeBody')}</span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
            <DeviceSlotStrip
              mobileOccupied={false}
              desktopWebOccupied={Boolean(ctrl.session?.isAuthenticated)}
              mobileTitle={t('authMobileSlotTitle')}
              desktopTitle={t('authDesktopSlotTitle')}
              activeLabel={t('authSlotActiveBadge')}
              openLabel={t('authSlotOpenBadge')}
            />
          </div>
        </MzCard>

        {/* Right Interactive Auth Panel */}
        <MzCard
          variant="default"
          padding="lg"
          className="order-first flex flex-col gap-5 lg:order-last lg:col-span-7"
        >
          {ctrl.isSessionRevokedNotice && (
            <MzBanner tone="warning" title={t('authSignInAction')}>
              {t('authSessionRevokedBanner')}
            </MzBanner>
          )}

          {ctrl.session?.isAuthenticated && ctrl.session.user && (
            <MzBanner
              tone="success"
              actions={
                <Link
                  to="/home"
                  className="inline-flex h-9 items-center rounded-[var(--mz-radius-control)] bg-primary px-3 text-xs font-semibold text-on-primary hover:bg-primary-pressed"
                >
                  {t('authContinueHomeAction')}
                </Link>
              }
            >
              {t('authAlreadySignedInBanner', {
                identity:
                  ctrl.session.user.email ??
                  ctrl.session.user.phoneE164 ??
                  ctrl.session.user.displayName ??
                  ctrl.session.user.userId,
              })}
            </MzBanner>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-text-primary">
              {ctrl.mode === 'sign_in' ? t('authSignInAction') : t('authSignUpAction')}
            </h2>

            {showSmsOtp ? (
              <MzSegmentedControl
                ariaLabel={t('routeLoginTitle')}
                fullWidth
                value={ctrl.channel}
                onChange={(next) => ctrl.setChannel(next)}
                options={[
                  { value: 'sms_otp', label: t('authTabSmsOtp') },
                  { value: 'email', label: t('authTabEmail') },
                ]}
              />
            ) : (
              <MzSegmentedControl
                ariaLabel={t('routeLoginTitle')}
                value={ctrl.mode}
                onChange={(next) => ctrl.setMode(next)}
                options={[
                  { value: 'sign_in', label: t('authSignInAction') },
                  { value: 'sign_up', label: t('authSignUpAction') },
                ]}
              />
            )}
          </div>

          {ctrl.errorMessage && !ctrl.slotConflict && (
            <MzBanner tone="danger">{ctrl.errorMessage}</MzBanner>
          )}

          {/* GLB OAuth Buttons (dead-code eliminated on IRN builds) */}
          {(showGoogle || showApple) && (
            <div className="flex flex-col gap-2.5">
              {showGoogle && (
                <MzButton
                  variant="secondary"
                  fullWidth
                  isLoading={ctrl.isSubmitting}
                  onClick={() => void ctrl.triggerOAuth('google')}
                  data-testid="auth-google-btn"
                >
                  <span className="inline-flex items-center gap-2">
                    <span>{t('authContinueWithGoogle')}</span>
                    {ctrl.providers.google.mode === 'dev_sandbox' && (
                      <span className="rounded-[var(--mz-radius-pill)] bg-amber-bg px-2 py-0.5 text-[11px] font-semibold text-warning">
                        {t('authDevSandboxBadge')}
                      </span>
                    )}
                  </span>
                </MzButton>
              )}

              {showApple && (
                <MzButton
                  variant="secondary"
                  fullWidth
                  isLoading={ctrl.isSubmitting}
                  onClick={() => void ctrl.triggerOAuth('apple')}
                  data-testid="auth-apple-btn"
                >
                  <span className="inline-flex items-center gap-2">
                    <span>{t('authContinueWithApple')}</span>
                    {ctrl.providers.apple.mode === 'dev_sandbox' && (
                      <span className="rounded-[var(--mz-radius-pill)] bg-amber-bg px-2 py-0.5 text-[11px] font-semibold text-warning">
                        {t('authDevSandboxBadge')}
                      </span>
                    )}
                  </span>
                </MzButton>
              )}

              <div className="my-1 flex items-center gap-3 text-xs text-text-tertiary">
                <span className="h-px flex-1 bg-border-subtle" />
                <span>{t('authOrEmailDivider')}</span>
                <span className="h-px flex-1 bg-border-subtle" />
              </div>
            </div>
          )}

          {/* IRN SMS OTP Flow (dead-code eliminated on GLB builds) */}
          {showSmsOtp && ctrl.channel === 'sms_otp' ? (
            <form onSubmit={onPhoneSubmit} className="flex flex-col gap-4">
              {ctrl.otpStep === 'phone' ? (
                <LtrExamBoundary>
                  <MzTextField
                    label={t('authPhoneNumberLabel')}
                    type="tel"
                    inputMode="tel"
                    inputDir="ltr"
                    placeholder="+98 912 345 6789"
                    value={phoneInput}
                    onChange={(e) => {
                      ctrl.clearFeedback();
                      setPhoneInput(e.target.value);
                    }}
                    required
                    data-testid="auth-phone-input"
                  />
                </LtrExamBoundary>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--mz-radius-control)] border border-border-subtle bg-surface-alt px-3.5 py-2.5 text-xs">
                    <span className="inline-flex items-center gap-2 font-mono-exam text-text-primary" dir="ltr">
                      <Smartphone className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      {phoneInput}
                    </span>
                    <button
                      type="button"
                      onClick={ctrl.resetOtpToPhone}
                      className="font-semibold text-primary hover:underline"
                    >
                      {t('authOtpChangePhoneAction')}
                    </button>
                  </div>

                  {ctrl.devOtpHint && (
                    <MzBanner
                      tone="info"
                      actions={
                        <MzButton
                          size="sm"
                          variant="secondary"
                          onClick={() => setOtpInput(ctrl.devOtpHint ?? '')}
                        >
                          {t('authOtpDevHintBadge', { code: ctrl.devOtpHint })}
                        </MzButton>
                      }
                    >
                      {t('authOtpDevHintBadge', { code: ctrl.devOtpHint })}
                    </MzBanner>
                  )}

                  <LtrExamBoundary>
                    <MzTextField
                      label={t('authOtpCodeLabel')}
                      type="text"
                      inputMode="numeric"
                      inputDir="ltr"
                      placeholder="123456"
                      maxLength={8}
                      value={otpInput}
                      onChange={(e) => {
                        ctrl.clearFeedback();
                        setOtpInput(e.target.value);
                      }}
                      required
                      data-testid="auth-otp-input"
                    />
                  </LtrExamBoundary>

                  <MzTextField
                    label={t('authDisplayNameLabel')}
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <MzButton
                  type="submit"
                  fullWidth={ctrl.otpStep === 'phone'}
                  isLoading={ctrl.isSubmitting}
                  data-testid="auth-otp-submit"
                >
                  {ctrl.otpStep === 'phone'
                    ? t('authSendOtpAction')
                    : t('authVerifyOtpAction')}
                </MzButton>

                {ctrl.otpStep === 'code' && (
                  <MzButton
                    variant="ghost"
                    size="sm"
                    disabled={ctrl.otpCountdownSec > 0 || ctrl.isSubmitting}
                    onClick={() => void ctrl.requestSmsOtp(phoneInput)}
                  >
                    {ctrl.otpCountdownSec > 0
                      ? t('authOtpResendCountdown', {
                          sec: formatChromeNumber(ctrl.otpCountdownSec, ctrl.edition),
                        })
                      : t('authSendOtpAction')}
                  </MzButton>
                )}
              </div>
            </form>
          ) : (
            /* Email & Password Form */
            <form onSubmit={onEmailSubmit} className="flex flex-col gap-4">
              {showSmsOtp && (
                <div className="flex justify-end">
                  <MzSegmentedControl
                    ariaLabel={t('authSignInAction')}
                    value={ctrl.mode}
                    onChange={(next) => ctrl.setMode(next)}
                    options={[
                      { value: 'sign_in', label: t('authSignInAction') },
                      { value: 'sign_up', label: t('authSignUpAction') },
                    ]}
                  />
                </div>
              )}

              {ctrl.mode === 'sign_up' && (
                <MzTextField
                  label={t('authDisplayNameLabel')}
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => {
                    ctrl.clearFeedback();
                    setDisplayName(e.target.value);
                  }}
                  data-testid="auth-name-input"
                />
              )}

              <MzTextField
                label={t('authEmailLabel')}
                type="email"
                inputDir="ltr"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  ctrl.clearFeedback();
                  setEmail(e.target.value);
                }}
                required
                data-testid="auth-email-input"
              />

              <MzTextField
                label={t('authPasswordLabel')}
                type="password"
                inputDir="ltr"
                allowPasswordToggle
                autoComplete={
                  ctrl.mode === 'sign_up' ? 'new-password' : 'current-password'
                }
                hint={ctrl.mode === 'sign_up' ? t('authPasswordHintMin8') : undefined}
                value={password}
                onChange={(e) => {
                  ctrl.clearFeedback();
                  setPassword(e.target.value);
                }}
                required
                data-testid="auth-password-input"
              />

              <MzButton
                type="submit"
                fullWidth
                size="lg"
                isLoading={ctrl.isSubmitting}
                leadingIcon={<Lock className="h-4 w-4" aria-hidden="true" />}
                data-testid="auth-email-submit"
              >
                {ctrl.mode === 'sign_in' ? t('authSignInAction') : t('authSignUpAction')}
              </MzButton>
            </form>
          )}
        </MzCard>
      </div>

      {/* 409 DEVICE_SLOT_OCCUPIED Takeover Modal */}
      <MzModal
        open={Boolean(ctrl.slotConflict)}
        onOpenChange={(open) => {
          if (!open) ctrl.dismissSlotConflict();
        }}
        title={t('authSlotOccupiedTitle')}
        description={
          ctrl.slotConflict
            ? t('authSlotOccupiedDescription', {
                deviceName: ctrl.slotConflict.deviceName,
                location: ctrl.slotConflict.locationLabel ?? '',
              })
            : undefined
        }
        footer={
          <>
            <MzButton variant="secondary" onClick={ctrl.dismissSlotConflict}>
              {t('cancelAction')}
            </MzButton>
            <MzButton
              variant="primary"
              isLoading={ctrl.isSubmitting}
              onClick={() => void ctrl.confirmSlotTakeover()}
              data-testid="auth-slot-replace-btn"
            >
              {t('authSlotReplaceAction')}
            </MzButton>
          </>
        }
      >
        {ctrl.slotConflict && (
          <div className="rounded-[var(--mz-radius-control)] border border-border-subtle bg-surface-alt p-3.5 text-sm">
            <p className="font-semibold text-text-primary">{ctrl.slotConflict.deviceName}</p>
            <p className="mt-1 text-xs text-text-secondary">
              {ctrl.slotConflict.locationLabel ? `${ctrl.slotConflict.locationLabel} · ` : ''}
              <span className="font-mono-exam">{ctrl.slotConflict.deviceId.slice(0, 8)}</span> ·{' '}
              {slotConflictDateLabel}
            </p>
          </div>
        )}
      </MzModal>

      {/* GLB Dev Sandbox Persona Picker Modal */}
      {ctrl.pendingDevPersonaProvider && (
        <MzModal
          open
          onOpenChange={(open) => {
            if (!open) ctrl.dismissDevPersonaModal();
          }}
          title={t('authDevPersonaModalTitle', {
            provider:
              ctrl.pendingDevPersonaProvider === 'google' ? 'Google' : 'Apple',
          })}
          description={t('authDevPersonaModalDesc')}
          footer={
            <MzButton variant="secondary" onClick={ctrl.dismissDevPersonaModal}>
              {t('cancelAction')}
            </MzButton>
          }
        >
          <div className="flex flex-col gap-2.5">
            {DEV_SANDBOX_PERSONAS[ctrl.pendingDevPersonaProvider].map((persona) => (
              <MzButton
                key={persona.email}
                variant="secondary"
                fullWidth
                isLoading={ctrl.isSubmitting}
                onClick={() =>
                  void ctrl.triggerOAuth(ctrl.pendingDevPersonaProvider!, {
                    idTokenOrCode: persona.idTokenOrCode,
                    displayName: persona.label,
                  })
                }
              >
                {persona.label}
              </MzButton>
            ))}
          </div>
        </MzModal>
      )}
    </div>
  );
}

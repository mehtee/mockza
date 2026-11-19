import { useCallback, useEffect, useMemo, useState } from 'react';
import { type EditionCode, getEditionConfig } from '@/edition/edition-config';
import type {
  AuthGatewayError,
  AuthProvidersSnapshot,
  AuthSession,
} from '@/gateways/auth.gateway';
import type { DeviceSlotOccupiedError, OccupyingDeviceInfo } from '@/gateways/result';
import { useDeps } from '@/spa/deps';

export type AuthMode = 'sign_in' | 'sign_up';
export type AuthChannel = 'email' | 'sms_otp';

export interface DevSandboxPersona {
  readonly label: string;
  readonly email: string;
  readonly idTokenOrCode: string;
}

export const DEV_SANDBOX_PERSONAS: Readonly<
  Record<'google' | 'apple', readonly DevSandboxPersona[]>
> = {
  google: [
    {
      label: 'Aria Chen (band 7.5 learner)',
      email: 'aria.chen@mockza.local',
      idTokenOrCode: '',
    },
    {
      label: 'Liam Patel (second test user)',
      email: 'liam.patel@mockza.local',
      idTokenOrCode: '',
    },
  ],
  apple: [
    {
      label: 'Maya Lin (Private Relay)',
      email: 'maya.lin@mockza.local',
      idTokenOrCode: '',
    },
    {
      label: 'Noah Kim (iOS+Web tester)',
      email: 'noah.kim@mockza.local',
      idTokenOrCode: '',
    },
  ],
};

type PendingRetryAction =
  | { readonly kind: 'email_sign_in'; readonly email: string; readonly password: string }
  | {
      readonly kind: 'email_sign_up';
      readonly email: string;
      readonly password: string;
      readonly displayName?: string;
    }
  | {
      readonly kind: 'oauth';
      readonly provider: 'google' | 'apple';
      readonly idTokenOrCode: string;
      readonly displayName?: string;
    }
  | {
      readonly kind: 'sms_otp';
      readonly phoneE164: string;
      readonly otpCode: string;
      readonly displayName?: string;
    };

export interface AuthControllerState {
  readonly edition: EditionCode;
  readonly mode: AuthMode;
  readonly channel: AuthChannel;
  readonly providers: AuthProvidersSnapshot;
  readonly session: AuthSession | null;
  readonly isSubmitting: boolean;
  readonly errorMessage: string | null;
  readonly slotConflict: OccupyingDeviceInfo | null;
  readonly pendingTakeoverSessionId: string | null;
  readonly otpStep: 'phone' | 'code';
  readonly otpCountdownSec: number;
  readonly devOtpHint: string | null;
  readonly pendingDevPersonaProvider: 'google' | 'apple' | null;
  readonly isSessionRevokedNotice: boolean;
}

function defaultProvidersForEdition(edition: EditionCode): AuthProvidersSnapshot {
  const cfg = getEditionConfig(edition);
  const devSandbox = import.meta.env.PUBLIC_ALLOW_DEV_AUTH === 'true';
  return {
    emailPasswordEnabled: true,
    smsOtpEnabled: cfg.features.smsOtp,
    google: {
      enabled: cfg.features.oauthGoogleApple,
      mode: cfg.features.oauthGoogleApple && devSandbox ? 'dev_sandbox' : 'disabled',
    },
    apple: {
      enabled: cfg.features.oauthGoogleApple,
      mode: cfg.features.oauthGoogleApple && devSandbox ? 'dev_sandbox' : 'disabled',
    },
    devicePolicy: { maxMobilePhones: 1, maxDesktopWebInstances: 1 },
  };
}

function normalizePhoneInput(raw: string): string {
  const cleaned = raw.replace(/[\s\-()]/g, '').trim();
  if (/^09\d{9}$/.test(cleaned)) {
    return `+98${cleaned.slice(1)}`;
  }
  if (/^989\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  return cleaned;
}

export function useAuthController(options: {
  readonly reason?: string;
  readonly initialMode?: AuthMode;
  readonly onAuthenticated?: () => void;
} = {}) {
  const deps = useDeps();
  const edition = deps.edition;
  const editionCfg = useMemo(() => getEditionConfig(edition), [edition]);

  const [mode, setMode] = useState<AuthMode>(options.initialMode ?? 'sign_in');
  const [channel, setChannel] = useState<AuthChannel>(
    editionCfg.features.smsOtp ? 'sms_otp' : 'email',
  );
  const [providers, setProviders] = useState<AuthProvidersSnapshot>(() =>
    defaultProvidersForEdition(edition),
  );
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [slotConflict, setSlotConflict] = useState<OccupyingDeviceInfo | null>(null);
  const [pendingRetry, setPendingRetry] = useState<PendingRetryAction | null>(null);

  const [otpStep, setOtpStep] = useState<'phone' | 'code'>('phone');
  const [otpCountdownSec, setOtpCountdownSec] = useState(0);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [pendingDevPersonaProvider, setPendingDevPersonaProvider] = useState<
    'google' | 'apple' | null
  >(null);

  useEffect(() => {
    let mounted = true;
    void deps.auth.getSession().then((res) => {
      if (mounted && res.ok) {
        setSession(res.value);
      }
    });
    void deps.auth.fetchAuthProviders().then((res) => {
      if (mounted && res.ok) {
        setProviders(res.value);
      }
    });
    const unsubscribe = deps.auth.onSessionChanged((nextSession) => {
      if (mounted) {
        setSession(nextSession);
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [deps]);

  useEffect(() => {
    if (otpCountdownSec <= 0) return;
    const timer = setInterval(() => {
      setOtpCountdownSec((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCountdownSec]);

  const clearFeedback = useCallback(() => {
    setErrorMessage(null);
    setSlotConflict(null);
  }, []);

  const handleAuthFailure = useCallback(
    (err: AuthGatewayError, retryPayload: PendingRetryAction) => {
      if (err.kind === 'device_slot_occupied') {
        const occupied = err as DeviceSlotOccupiedError;
        setSlotConflict(occupied.occupyingDevice);
        setPendingRetry(retryPayload);
        setErrorMessage(occupied.message);
        return;
      }
      setErrorMessage(err.message);
    },
    [],
  );

  const submitEmailAuth = useCallback(
    async (input: {
      readonly email: string;
      readonly password: string;
      readonly displayName?: string;
      readonly replaceSessionId?: string;
    }): Promise<boolean> => {
      clearFeedback();
      setIsSubmitting(true);
      try {
        if (mode === 'sign_up') {
          const retryPayload: PendingRetryAction = {
            kind: 'email_sign_up',
            email: input.email.trim(),
            password: input.password,
            displayName: input.displayName?.trim() || undefined,
          };
          const res = await deps.auth.signUpWithEmail({
            ...retryPayload,
            replaceSessionId: input.replaceSessionId,
          });
          if (!res.ok) {
            handleAuthFailure(res.error, retryPayload);
            return false;
          }
          setSession(res.value);
          options.onAuthenticated?.();
          return true;
        }

        const retryPayload: PendingRetryAction = {
          kind: 'email_sign_in',
          email: input.email.trim(),
          password: input.password,
        };
        const res = await deps.auth.signInWithEmail({
          ...retryPayload,
          replaceSessionId: input.replaceSessionId,
        });
        if (!res.ok) {
          handleAuthFailure(res.error, retryPayload);
          return false;
        }
        setSession(res.value);
        options.onAuthenticated?.();
        return true;
      } finally {
        setIsSubmitting(false);
      }
    },
    [clearFeedback, deps.auth, handleAuthFailure, mode, options],
  );

  const triggerOAuth = useCallback(
    async (
      provider: 'google' | 'apple',
      override?: { readonly idTokenOrCode?: string; readonly displayName?: string; readonly replaceSessionId?: string },
    ): Promise<boolean> => {
      clearFeedback();
      const descriptor = provider === 'google' ? providers.google : providers.apple;
      if (descriptor.mode === 'dev_sandbox' && override === undefined) {
        setPendingDevPersonaProvider(provider);
        return false;
      }

      if (!deps.auth.signInWithOAuth) {
        setErrorMessage('OAuth provider is disabled in this edition.');
        return false;
      }

      setIsSubmitting(true);
      setPendingDevPersonaProvider(null);
      try {
        const retryPayload: PendingRetryAction = {
          kind: 'oauth',
          provider,
          idTokenOrCode: override?.idTokenOrCode ?? '',
          displayName: override?.displayName,
        };
        const res = await deps.auth.signInWithOAuth({
          ...retryPayload,
          replaceSessionId: override?.replaceSessionId,
        });
        if (!res.ok) {
          handleAuthFailure(res.error, retryPayload);
          return false;
        }
        setSession(res.value);
        options.onAuthenticated?.();
        return true;
      } finally {
        setIsSubmitting(false);
      }
    },
    [clearFeedback, deps.auth, handleAuthFailure, options, providers.apple, providers.google],
  );

  const requestSmsOtp = useCallback(
    async (rawPhone: string): Promise<boolean> => {
      clearFeedback();
      if (!deps.auth.requestSmsOtp) {
        setErrorMessage('SMS OTP authentication is not available.');
        return false;
      }
      const normalized = normalizePhoneInput(rawPhone);
      setIsSubmitting(true);
      try {
        const res = await deps.auth.requestSmsOtp({ phoneE164: normalized });
        if (!res.ok) {
          setErrorMessage(res.error.message);
          return false;
        }
        setOtpStep('code');
        setOtpCountdownSec(res.value.retryAfterSec);
        setDevOtpHint(res.value.devOtpHint ?? null);
        return true;
      } finally {
        setIsSubmitting(false);
      }
    },
    [clearFeedback, deps.auth],
  );

  const verifySmsOtp = useCallback(
    async (input: {
      readonly phoneE164: string;
      readonly otpCode: string;
      readonly displayName?: string;
      readonly replaceSessionId?: string;
    }): Promise<boolean> => {
      clearFeedback();
      if (!deps.auth.verifySmsOtp) {
        setErrorMessage('SMS OTP verification is not available.');
        return false;
      }
      const normalized = normalizePhoneInput(input.phoneE164);
      const retryPayload: PendingRetryAction = {
        kind: 'sms_otp',
        phoneE164: normalized,
        otpCode: input.otpCode.trim(),
        displayName: input.displayName?.trim() || undefined,
      };
      setIsSubmitting(true);
      try {
        const res = await deps.auth.verifySmsOtp({
          ...retryPayload,
          replaceSessionId: input.replaceSessionId,
        });
        if (!res.ok) {
          handleAuthFailure(res.error, retryPayload);
          return false;
        }
        setSession(res.value);
        options.onAuthenticated?.();
        return true;
      } finally {
        setIsSubmitting(false);
      }
    },
    [clearFeedback, deps.auth, handleAuthFailure, options],
  );

  const confirmSlotTakeover = useCallback(async (): Promise<boolean> => {
    const replaceSessionId = slotConflict?.sessionId;
    if (!replaceSessionId || !pendingRetry) {
      setSlotConflict(null);
      return false;
    }

    if (pendingRetry.kind === 'email_sign_in') {
      return submitEmailAuth({
        email: pendingRetry.email,
        password: pendingRetry.password,
        replaceSessionId,
      });
    }
    if (pendingRetry.kind === 'email_sign_up') {
      return submitEmailAuth({
        email: pendingRetry.email,
        password: pendingRetry.password,
        displayName: pendingRetry.displayName,
        replaceSessionId,
      });
    }
    if (pendingRetry.kind === 'oauth') {
      return triggerOAuth(pendingRetry.provider, {
        idTokenOrCode: pendingRetry.idTokenOrCode,
        displayName: pendingRetry.displayName,
        replaceSessionId,
      });
    }
    return verifySmsOtp({
      phoneE164: pendingRetry.phoneE164,
      otpCode: pendingRetry.otpCode,
      displayName: pendingRetry.displayName,
      replaceSessionId,
    });
  }, [pendingRetry, slotConflict, submitEmailAuth, triggerOAuth, verifySmsOtp]);

  const dismissSlotConflict = useCallback(() => {
    setSlotConflict(null);
    setPendingRetry(null);
  }, []);

  const dismissDevPersonaModal = useCallback(() => {
    setPendingDevPersonaProvider(null);
  }, []);

  const selectMode = useCallback(
    (nextMode: AuthMode) => {
      clearFeedback();
      setMode(nextMode);
    },
    [clearFeedback],
  );

  useEffect(() => {
    if (options.initialMode) {
      setMode(options.initialMode);
    }
  }, [options.initialMode]);

  return {
    edition,
    editionCfg,
    mode,
    setMode: selectMode,
    channel,
    setChannel: (nextChannel: AuthChannel) => {
      clearFeedback();
      setChannel(nextChannel);
    },
    providers,
    session,
    isSubmitting,
    errorMessage,
    slotConflict,
    otpStep,
    resetOtpToPhone: () => {
      clearFeedback();
      setOtpStep('phone');
      setDevOtpHint(null);
    },
    otpCountdownSec,
    devOtpHint,
    pendingDevPersonaProvider,
    isSessionRevokedNotice: options.reason === 'session_revoked',
    clearFeedback,
    submitEmailAuth,
    triggerOAuth,
    requestSmsOtp,
    verifySmsOtp,
    confirmSlotTakeover,
    dismissSlotConflict,
    dismissDevPersonaModal,
  };
}

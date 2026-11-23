import { normalizeSupportedExamId, type DiagnosticMode, type SupportedExamId } from '@mockza/domain';
import { Link, useNavigate } from '@tanstack/react-router';
import { BookOpen, Headphones, MicOff, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CompactPreflightHeader } from '@/components/exam-kit';
import { MzBanner, MzButton, MzCard } from '@/components/ui';
import { ForwardArrowIcon } from '@/components/bidi/DirectionIcon';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { DiagnosticBankDto } from '@/gateways/diagnostic.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import {
  createInitialPersistedState,
  generateUuidV4,
  serializeDiagnosticRecord,
} from './diagnostic-state';

export interface DiagnosticIntroScreenProps {
  readonly initialTrack?: SupportedExamId;
}

export function DiagnosticIntroScreen({ initialTrack }: DiagnosticIntroScreenProps) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const navigate = useNavigate();

  const [mode, setMode] = useState<DiagnosticMode>('standard');
  const [bank, setBank] = useState<DiagnosticBankDto | null>(null);
  const [examId, setExamId] = useState<SupportedExamId>(initialTrack ?? 'ielts_academic');
  const [isLaunching, setIsLaunching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      deps.attemptStore.getUserProfile(),
      deps.diagnostic.fetchDiagnosticBank(),
    ]).then(([profileRes, bankRes]) => {
      if (!mounted) return;
      if (initialTrack) {
        const resolved = normalizeSupportedExamId(initialTrack);
        setExamId(resolved);
        if (profileRes.ok && profileRes.value && profileRes.value.examId !== resolved) {
          void deps.attemptStore.saveUserProfile({
            ...profileRes.value,
            examId: resolved,
            examModule: resolved === 'ielts_general' ? 'general_training' : 'academic',
            updatedAtMs: deps.clock.nowMs(),
          });
        }
      } else if (profileRes.ok && profileRes.value?.examId) {
        setExamId(normalizeSupportedExamId(profileRes.value.examId));
      }
      if (bankRes.ok) {
        setBank(bankRes.value);
      } else {
        setErrorMsg(bankRes.error.message);
      }
    });
    return () => {
      mounted = false;
    };
  }, [deps.attemptStore, deps.clock, deps.diagnostic, initialTrack]);

  const handleLaunch = async (skipSpeaking: boolean) => {
    setErrorMsg(null);
    setIsLaunching(true);

    let resolvedBank = bank;
    if (!resolvedBank) {
      const bankRes = await deps.diagnostic.fetchDiagnosticBank();
      if (!bankRes.ok) {
        setIsLaunching(false);
        setErrorMsg(bankRes.error.message);
        return;
      }
      resolvedBank = bankRes.value;
      setBank(resolvedBank);
    }

    const diagId = generateUuidV4();
    const createRes = await deps.diagnostic.createSession({
      diagId,
      examId,
      mode,
      selectionSeed: diagId,
    });
    if (!createRes.ok) {
      setIsLaunching(false);
      setErrorMsg(createRes.error.message);
      return;
    }

    const initialState = createInitialPersistedState({
      diagId,
      examId,
      mode,
      skipSpeaking,
    });
    const record = serializeDiagnosticRecord(
      { ...initialState, remoteSession: createRes.value },
      resolvedBank,
      deps.clock.nowMs(),
    );
    await deps.attemptStore.saveDiagnosticSession(record);
    setIsLaunching(false);
    await navigate({ to: '/diagnostic/session/$diagId', params: { diagId } });
  };

  return (
    <div data-testid="diagnostic-intro-screen" className="mx-auto flex w-full max-w-6xl flex-col gap-5 pb-6 text-start">
      {errorMsg ? <MzBanner tone="danger">{errorMsg}</MzBanner> : null}

      {/* Zero-Scroll Compact Preflight Strip */}
      <CompactPreflightHeader<DiagnosticMode>
        title={t('diagIntroTitle')}
        subtitle={t('diagIntroSubtitle')}
        selectedMode={mode}
        onModeChange={setMode}
        modeOptions={[
          { value: 'standard', label: t('diagModeStandardLabel') },
          { value: 'extended', label: t('diagModeExtendedLabel') },
          { value: 'accessible', label: t('diagModeAccessibleLabel') },
        ]}
        rulesSummary={[t('diagRule1'), t('diagRule2'), t('diagRule3')]}
      />

      {/* Compact Horizontal Preview + Launch Strip */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MzCard variant="default" padding="sm">
          <div className="flex items-start gap-2.5">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h3 className="text-xs font-bold text-text-primary">
                {bank?.workedExamples.reading.questionPrompt ? (
                  <LtrExamBoundary className="inline-block">
                    {bank.workedExamples.reading.questionPrompt}
                  </LtrExamBoundary>
                ) : (
                  t('diagReadingCalibrationTitle')
                )}
              </h3>
              {bank?.workedExamples.reading.explanation ? (
                <LtrExamBoundary className="mt-1 block text-xs text-text-secondary">
                  {bank.workedExamples.reading.explanation}
                </LtrExamBoundary>
              ) : (
                <p className="mt-1 text-xs text-text-secondary">
                  {t('diagReadingCalibrationDesc')}
                </p>
              )}
            </div>
          </div>
        </MzCard>

        <MzCard variant="default" padding="sm">
          <div className="flex items-start gap-2.5">
            <Headphones className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h3 className="text-xs font-bold text-text-primary">
                {bank?.workedExamples.listening.questionPrompt ? (
                  <LtrExamBoundary className="inline-block">
                    {bank.workedExamples.listening.questionPrompt}
                  </LtrExamBoundary>
                ) : (
                  t('diagListeningCalibrationTitle')
                )}
              </h3>
              {bank?.workedExamples.listening.explanation ? (
                <LtrExamBoundary className="mt-1 block text-xs text-text-secondary">
                  {bank.workedExamples.listening.explanation}
                </LtrExamBoundary>
              ) : (
                <p className="mt-1 text-xs text-text-secondary">
                  {t('diagListeningCalibrationDesc')}
                </p>
              )}
            </div>
          </div>
        </MzCard>
      </div>

      {/* Explicit Action Footer */}
      <MzCard variant="hero" padding="md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MzButton
            variant="primary"
            size="lg"
            data-testid="diag-start-btn"
            className="w-full sm:order-last sm:w-auto"
            isLoading={isLaunching}
            leadingIcon={<Play className="h-4 w-4" aria-hidden="true" />}
            trailingIcon={<ForwardArrowIcon edition={deps.edition} className="h-4 w-4" />}
            onClick={() => void handleLaunch(false)}
          >
            {t('diagStartAction')}
          </MzButton>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/home"
              data-testid="diag-later-link"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-4 text-xs font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            >
              {t('diagDoLaterAction')}
            </Link>

            <MzButton
              variant="secondary"
              size="md"
              data-testid="diag-skip-speaking-btn"
              disabled={isLaunching}
              leadingIcon={<MicOff className="h-4 w-4" aria-hidden="true" />}
              onClick={() => void handleLaunch(true)}
            >
              {t('diagStartWithoutSpeakingAction')}
            </MzButton>
          </div>
        </div>
      </MzCard>
    </div>
  );
}

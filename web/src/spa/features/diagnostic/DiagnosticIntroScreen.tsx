import type { DiagnosticMode } from '@mockza/domain';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, BookOpen, Headphones, MicOff, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CompactPreflightHeader } from '@/components/exam-kit';
import { MzBanner, MzButton, MzCard } from '@/components/ui';
import type { DiagnosticBankDto } from '@/gateways/diagnostic.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import {
  createInitialPersistedState,
  generateUuidV4,
  serializeDiagnosticRecord,
} from './diagnostic-state';

export function DiagnosticIntroScreen() {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const navigate = useNavigate();

  const [mode, setMode] = useState<DiagnosticMode>('standard');
  const [bank, setBank] = useState<DiagnosticBankDto | null>(null);
  const [examId, setExamId] = useState('ielts_academic');
  const [isLaunching, setIsLaunching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ForwardIcon = deps.edition === 'irn' ? ArrowLeft : ArrowRight;

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      deps.attemptStore.getUserProfile(),
      deps.diagnostic.fetchDiagnosticBank(),
    ]).then(([profileRes, bankRes]) => {
      if (!mounted) return;
      if (profileRes.ok && profileRes.value?.examId) {
        setExamId(profileRes.value.examId);
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
  }, [deps.attemptStore, deps.diagnostic]);

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
    <div data-testid="diagnostic-intro-screen" className="mx-auto flex max-w-5xl flex-col gap-5 pb-6 text-start">
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
        rulesSummary={[
          'Stage 1 (Reading) & Stage 2 (Listening) adapt question difficulty in real time across 3–4 micro-blocks.',
          'Writing & Speaking capture short authentic samples evaluated asynchronously.',
          'Every completed skill saves locally so you can retake any individual skill later.',
        ]}
      />

      {/* Compact Horizontal Preview + Launch Strip */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MzCard variant="default" padding="sm">
          <div className="flex items-start gap-2.5">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h3 className="text-xs font-bold text-text-primary">
                {bank?.workedExamples.reading.questionPrompt ?? 'Reading Calibration'}
              </h3>
              <p className="mt-1 text-xs text-text-secondary">
                {bank?.workedExamples.reading.explanation ??
                  'Short excerpt + 2 focused items per adaptive block.'}
              </p>
            </div>
          </div>
        </MzCard>

        <MzCard variant="default" padding="sm">
          <div className="flex items-start gap-2.5">
            <Headphones className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h3 className="text-xs font-bold text-text-primary">
                {bank?.workedExamples.listening.questionPrompt ?? 'Listening Calibration'}
              </h3>
              <p className="mt-1 text-xs text-text-secondary">
                {bank?.workedExamples.listening.explanation ??
                  'Audio briefing + distractor check tailored by selected mode.'}
              </p>
            </div>
          </div>
        </MzCard>
      </div>

      {/* Explicit Action Footer */}
      <MzCard variant="hero" padding="md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/home"
              data-testid="diag-later-link"
              className="inline-flex h-10 items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-subtle bg-canvas px-4 text-xs font-semibold text-text-secondary hover:bg-surface-hover hover:text-text-primary"
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

          <MzButton
            variant="primary"
            size="lg"
            data-testid="diag-start-btn"
            isLoading={isLaunching}
            leadingIcon={<Play className="h-4 w-4" aria-hidden="true" />}
            onClick={() => void handleLaunch(false)}
          >
            <span>{t('diagStartAction')}</span>
            <ForwardIcon className="h-4 w-4" aria-hidden="true" />
          </MzButton>
        </div>
      </MzCard>
    </div>
  );
}

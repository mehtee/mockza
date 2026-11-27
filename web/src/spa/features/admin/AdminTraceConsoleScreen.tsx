import { Download, KeyRound, Play, Search, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { MzButton, MzCard } from '@/components/ui';
import { formatChromeNumber } from '@/edition/bidi/numerals';
import { getEditionConfig } from '@/edition/edition-config';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';

interface UsageRow {
  readonly featureKind: string;
  readonly modelId: string;
  readonly calls: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly totalTtsChars: number;
  readonly totalCostUsdMicros: number;
}

interface AdminTracePayload {
  readonly accountKey?: string;
  readonly profile?: {
    readonly accountKey: string;
    readonly edition: string;
  } | null;
  readonly totals?: {
    readonly totalAiCalls: number;
    readonly totalTokens: number;
    readonly totalCostUsdMicros: number;
    readonly totalCostUsd: number;
  };
  readonly aiUsageLedger?: ReadonlyArray<{
    readonly usageId: string;
    readonly featureKind: string;
    readonly modelId: string;
    readonly totalTokens: number;
    readonly estimatedCostUsdMicros: number;
    readonly createdAt: string;
  }>;
  readonly pronunciationPractices?: ReadonlyArray<{
    readonly practiceId: string;
    readonly targetText: string;
    readonly overallScore: number | null;
    readonly status: string;
    readonly objectKey: string;
    readonly createdAt: string;
  }>;
}

export function AdminTraceConsoleScreen() {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const baseUrl = getEditionConfig(deps.edition).apiBaseUrl;
  const [adminKey, setAdminKey] = useState('');
  const [fromIso, setFromIso] = useState('');
  const [toIso, setToIso] = useState('');
  const [featureKind, setFeatureKind] = useState('');
  const [accountKey, setAccountKey] = useState('');
  const [summaryRows, setSummaryRows] = useState<readonly UsageRow[]>([]);
  const [traceData, setTraceData] = useState<AdminTracePayload | null>(null);
  const [audioPlayUrl, setAudioPlayUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const buildFilterQuery = () => {
    const qp = new URLSearchParams();
    if (fromIso.trim()) qp.set('from', fromIso.trim());
    if (toIso.trim()) qp.set('to', toIso.trim());
    if (featureKind.trim()) qp.set('featureKind', featureKind.trim());
    const s = qp.toString();
    return s ? `?${s}` : '';
  };

  const handleLoadSummary = async () => {
    if (!adminKey.trim()) {
      setErrorMsg(t('adminKeyRequiredErr'));
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${baseUrl}/v1/admin/usage/summary${buildFilterQuery()}`, {
        headers: { 'x-admin-api-key': adminKey.trim() },
      });
      if (!res.ok) {
        setErrorMsg(t('adminReqFailedErr', { status: formatChromeNumber(res.status, deps.edition) }));
        return;
      }
      const json = (await res.json()) as { readonly byFeatureAndModel?: readonly UsageRow[] };
      setSummaryRows(json.byFeatureAndModel ?? []);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t('adminNetworkErr'));
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    if (!adminKey.trim()) {
      setErrorMsg(t('adminKeyRequiredErr'));
      return;
    }
    setErrorMsg(null);
    try {
      const res = await fetch(`${baseUrl}/v1/admin/usage/export.csv${buildFilterQuery()}`, {
        headers: { 'x-admin-api-key': adminKey.trim() },
      });
      if (!res.ok) {
        setErrorMsg(t('adminCsvFailedErr', { status: formatChromeNumber(res.status, deps.edition) }));
        return;
      }
      const csvText = await res.text();
      const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mockza-usage-${Date.now()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t('adminNetworkErr'));
    }
  };

  const handleInspectAccount = async () => {
    if (!adminKey.trim() || !accountKey.trim()) {
      setErrorMsg(t('adminKeyAndAccountRequiredErr'));
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `${baseUrl}/v1/admin/users/${encodeURIComponent(accountKey.trim())}/trace`,
        { headers: { 'x-admin-api-key': adminKey.trim() } },
      );
      if (!res.ok) {
        setErrorMsg(t('adminTraceFailedErr', { status: formatChromeNumber(res.status, deps.edition) }));
        return;
      }
      setTraceData((await res.json()) as AdminTracePayload);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t('adminNetworkErr'));
    } finally {
      setLoading(false);
    }
  };

  const handlePlayRecording = async (objectKey: string) => {
    if (!adminKey.trim()) return;
    setErrorMsg(null);
    try {
      const res = await fetch(
        `${baseUrl}/v1/admin/recordings/stream?key=${encodeURIComponent(objectKey)}`,
        { headers: { 'x-admin-api-key': adminKey.trim() } },
      );
      if (!res.ok) {
        setErrorMsg(t('adminAudioFailedErr', { status: formatChromeNumber(res.status, deps.edition) }));
        return;
      }
      const blob = await res.blob();
      if (audioPlayUrl) URL.revokeObjectURL(audioPlayUrl);
      setAudioPlayUrl(URL.createObjectURL(blob));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t('adminNetworkErr'));
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 text-start">
      <header className="flex items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            {t('adminEyebrow')}
          </span>
          <h1 className="mt-1 text-xl font-bold text-text-primary">{t('adminTitle')}</h1>
        </div>
      </header>

      <MzCard variant="default">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1 font-medium text-text-primary">
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              {t('adminKeyLabel')}
            </span>
            <input
              type="password"
              dir="ltr"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder={t('adminKeyPlaceholder')}
              className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            <span>{t('adminFeatureFilterLabel')}</span>
            <input
              type="text"
              dir="ltr"
              value={featureKind}
              onChange={(e) => setFeatureKind(e.target.value)}
              placeholder={t('adminFeatureFilterPlaceholder')}
              className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            <span>{t('adminFromIsoLabel')}</span>
            <input
              type="text"
              dir="ltr"
              value={fromIso}
              onChange={(e) => setFromIso(e.target.value)}
              placeholder="2026-11-01T00:00:00Z"
              className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            <span>{t('adminToIsoLabel')}</span>
            <input
              type="text"
              dir="ltr"
              value={toIso}
              onChange={(e) => setToIso(e.target.value)}
              placeholder="2026-12-01T00:00:00Z"
              className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <MzButton variant="primary" size="sm" onClick={() => void handleLoadSummary()} disabled={loading}>
            {t('adminLoadSummaryBtn')}
          </MzButton>
          <MzButton variant="secondary" size="sm" onClick={() => void handleExportCsv()}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {t('adminExportCsvBtn')}
          </MzButton>
        </div>

        {errorMsg ? (
          <p role="alert" className="mt-3 text-xs text-danger">
            {errorMsg}
          </p>
        ) : null}
      </MzCard>

      {summaryRows.length > 0 ? (
        <MzCard variant="default">
          <h2 className="text-sm font-semibold text-text-primary">{t('adminSummaryHeading')}</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-start text-xs">
              <thead>
                <tr className="border-b border-border-subtle text-text-secondary">
                  <th className="py-2 pe-3">{t('adminColFeature')}</th>
                  <th className="py-2 pe-3">{t('adminColModel')}</th>
                  <th className="py-2 pe-3">{t('adminColCalls')}</th>
                  <th className="py-2 pe-3">{t('adminColTokens')}</th>
                  <th className="py-2">{t('adminColCost')}</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((r) => (
                  <tr key={`${r.featureKind}:${r.modelId}`} className="border-b border-border-subtle/50">
                    <td className="py-2 pe-3 font-medium text-text-primary">{r.featureKind}</td>
                    <td className="py-2 pe-3 font-mono-exam text-text-secondary">{r.modelId}</td>
                    <td className="py-2 pe-3 tabular-nums">
                      {formatChromeNumber(r.calls, deps.edition)}
                    </td>
                    <td className="py-2 pe-3 tabular-nums">
                      {formatChromeNumber(r.promptTokens, deps.edition)} /{' '}
                      {formatChromeNumber(r.completionTokens, deps.edition)}
                    </td>
                    <td className="py-2 font-mono-exam tabular-nums text-text-primary">
                      <span dir="ltr">${(r.totalCostUsdMicros / 1_000_000).toFixed(4)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MzCard>
      ) : null}

      <MzCard variant="default">
        <h2 className="text-sm font-semibold text-text-primary">{t('adminTraceHeading')}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            dir="ltr"
            value={accountKey}
            onChange={(e) => setAccountKey(e.target.value)}
            placeholder={t('adminAccountPlaceholder')}
            className="min-w-60 flex-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary"
          />
          <MzButton variant="primary" size="sm" onClick={() => void handleInspectAccount()} disabled={loading}>
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            {t('adminInspectBtn')}
          </MzButton>
        </div>

        {audioPlayUrl ? (
          <div className="mt-3 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-2">
            <audio src={audioPlayUrl} controls className="w-full" />
          </div>
        ) : null}

        {traceData ? (
          <div className="mt-4 flex flex-col gap-3 text-xs">
            <div className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-raised p-3">
              <div className="font-semibold text-text-primary">
                {t('adminAccountSummary', {
                  account: traceData.accountKey ?? accountKey,
                  edition: traceData.profile?.edition ?? deps.edition,
                })}
              </div>
              <div className="mt-1 text-text-secondary">
                {t('adminStatsSummary', {
                  calls: formatChromeNumber(traceData.totals?.totalAiCalls ?? 0, deps.edition),
                  tokens: formatChromeNumber(traceData.totals?.totalTokens ?? 0, deps.edition),
                  cost: formatChromeNumber(
                    ((traceData.totals?.totalCostUsdMicros ?? 0) / 1_000_000).toFixed(4),
                    deps.edition,
                  ),
                })}
              </div>
            </div>

            {(traceData.aiUsageLedger ?? []).length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <h3 className="font-semibold text-text-primary">{t('adminRecentCallsHeading')}</h3>
                {traceData.aiUsageLedger!.slice(0, 10).map((call) => (
                  <div
                    key={call.usageId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface p-2"
                  >
                    <span className="font-medium text-text-primary">{call.featureKind}</span>
                    <span className="font-mono-exam text-text-secondary">
                      <span dir="ltr">{call.modelId}</span> ·{' '}
                      {t('adminTokenCount', {
                        tokens: formatChromeNumber(call.totalTokens, deps.edition),
                      })}{' '}
                      · <span dir="ltr">${(call.estimatedCostUsdMicros / 1_000_000).toFixed(5)}</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {(traceData.pronunciationPractices ?? []).length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <h3 className="font-semibold text-text-primary">{t('adminRecordingsHeading')}</h3>
                {traceData.pronunciationPractices!.map((p) => (
                  <div
                    key={p.practiceId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface p-2"
                  >
                    <div>
                      <span dir="ltr" className="font-medium text-text-primary">{p.targetText}</span>
                      <span className="ms-2 text-text-secondary">
                        {t('adminRecordingStatusScore', {
                          status: p.status,
                          score:
                            p.overallScore != null
                              ? formatChromeNumber(p.overallScore, deps.edition)
                              : '—',
                        })}
                      </span>
                    </div>
                    <MzButton
                      variant="ghost"
                      size="sm"
                      onClick={() => void handlePlayRecording(p.objectKey)}
                    >
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('adminStreamAudioBtn')}
                    </MzButton>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </MzCard>
    </div>
  );
}

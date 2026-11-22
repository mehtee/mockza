import { Download, KeyRound, Play, Search, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { MzButton, MzCard } from '@/components/ui';
import { getEditionConfig } from '@/edition/edition-config';
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
      setErrorMsg('Admin API key is required.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${baseUrl}/v1/admin/usage/summary${buildFilterQuery()}`, {
        headers: { 'x-admin-api-key': adminKey.trim() },
      });
      if (!res.ok) {
        setErrorMsg(`Request failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as { readonly byFeatureAndModel?: readonly UsageRow[] };
      setSummaryRows(json.byFeatureAndModel ?? []);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    if (!adminKey.trim()) {
      setErrorMsg('Admin API key is required.');
      return;
    }
    setErrorMsg(null);
    try {
      const res = await fetch(`${baseUrl}/v1/admin/usage/export.csv${buildFilterQuery()}`, {
        headers: { 'x-admin-api-key': adminKey.trim() },
      });
      if (!res.ok) {
        setErrorMsg(`CSV export failed (${res.status})`);
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
      setErrorMsg(e instanceof Error ? e.message : 'Export error');
    }
  };

  const handleInspectAccount = async () => {
    if (!adminKey.trim() || !accountKey.trim()) {
      setErrorMsg('Provide both x-admin-api-key and accountKey.');
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
        setErrorMsg(`Trace lookup failed (${res.status})`);
        return;
      }
      setTraceData((await res.json()) as AdminTracePayload);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Trace error');
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
        setErrorMsg(`Audio stream failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      if (audioPlayUrl) URL.revokeObjectURL(audioPlayUrl);
      setAudioPlayUrl(URL.createObjectURL(blob));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Audio error');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Operator Trace Console
          </span>
          <h1 className="mt-1 text-xl font-bold text-text-primary">
            AI Spend, Token Ledger & User Journey Trace
          </h1>
        </div>
      </header>

      <MzCard variant="default">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            <span className="inline-flex items-center gap-1 font-medium text-text-primary">
              <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              x-admin-api-key
            </span>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Paste ADMIN_API_KEY"
              className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            <span>Feature filter (optional)</span>
            <input
              type="text"
              value={featureKind}
              onChange={(e) => setFeatureKind(e.target.value)}
              placeholder="e.g. kokoro_tts, pronunciation_analyze"
              className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            <span>From ISO (optional)</span>
            <input
              type="text"
              value={fromIso}
              onChange={(e) => setFromIso(e.target.value)}
              placeholder="2026-11-01T00:00:00Z"
              className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            <span>To ISO (optional)</span>
            <input
              type="text"
              value={toIso}
              onChange={(e) => setToIso(e.target.value)}
              placeholder="2026-12-01T00:00:00Z"
              className="rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <MzButton variant="primary" size="sm" onClick={() => void handleLoadSummary()} disabled={loading}>
            Load AI Usage Summary
          </MzButton>
          <MzButton variant="secondary" size="sm" onClick={() => void handleExportCsv()}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export CSV
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
          <h2 className="text-sm font-semibold text-text-primary">Aggregated Spend by Model & Feature</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-start text-xs">
              <thead>
                <tr className="border-b border-border-subtle text-text-secondary">
                  <th className="py-2 pe-3">Feature</th>
                  <th className="py-2 pe-3">Model</th>
                  <th className="py-2 pe-3">Calls</th>
                  <th className="py-2 pe-3">In / Out Tokens</th>
                  <th className="py-2">Est. Cost (USD)</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((r) => (
                  <tr key={`${r.featureKind}:${r.modelId}`} className="border-b border-border-subtle/50">
                    <td className="py-2 pe-3 font-medium text-text-primary">{r.featureKind}</td>
                    <td className="py-2 pe-3 font-mono-exam text-text-secondary">{r.modelId}</td>
                    <td className="py-2 pe-3 tabular-nums">{r.calls}</td>
                    <td className="py-2 pe-3 tabular-nums">
                      {r.promptTokens} / {r.completionTokens}
                    </td>
                    <td className="py-2 font-mono-exam tabular-nums text-text-primary">
                      ${(r.totalCostUsdMicros / 1_000_000).toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </MzCard>
      ) : null}

      <MzCard variant="default">
        <h2 className="text-sm font-semibold text-text-primary">User Trace & Recordings Lookup</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="text"
            value={accountKey}
            onChange={(e) => setAccountKey(e.target.value)}
            placeholder="Account key (e.g. usr_... or dev_...)"
            className="min-w-60 flex-1 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary"
          />
          <MzButton variant="primary" size="sm" onClick={() => void handleInspectAccount()} disabled={loading}>
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            Inspect User Trace
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
                Account: {traceData.accountKey ?? accountKey} ({traceData.profile?.edition ?? deps.edition})
              </div>
              <div className="mt-1 text-text-secondary">
                AI calls: {traceData.totals?.totalAiCalls ?? 0} · Tokens: {traceData.totals?.totalTokens ?? 0} · Total cost: $
                {((traceData.totals?.totalCostUsdMicros ?? 0) / 1_000_000).toFixed(4)}
              </div>
            </div>

            {(traceData.aiUsageLedger ?? []).length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <h3 className="font-semibold text-text-primary">Recent AI Usage Calls</h3>
                {traceData.aiUsageLedger!.slice(0, 10).map((call) => (
                  <div
                    key={call.usageId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface p-2"
                  >
                    <span className="font-medium text-text-primary">{call.featureKind}</span>
                    <span className="font-mono-exam text-text-secondary">
                      {call.modelId} · {call.totalTokens} tok · $
                      {(call.estimatedCostUsdMicros / 1_000_000).toFixed(5)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {(traceData.pronunciationPractices ?? []).length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <h3 className="font-semibold text-text-primary">Recorded Pronunciation Takes</h3>
                {traceData.pronunciationPractices!.map((p) => (
                  <div
                    key={p.practiceId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-border-subtle bg-surface p-2"
                  >
                    <div>
                      <span className="font-medium text-text-primary">{p.targetText}</span>
                      <span className="ms-2 text-text-secondary">
                        ({p.status} · score: {p.overallScore ?? '—'})
                      </span>
                    </div>
                    <MzButton
                      variant="ghost"
                      size="sm"
                      onClick={() => void handlePlayRecording(p.objectKey)}
                    >
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      Stream Audio
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

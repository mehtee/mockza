import {
  EXAM_TRACK_SPECS,
  type SkillKind,
  type SupportedExamId,
} from '@mockza/domain';
import { Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2, Compass, Download, HardDrive, Play, RefreshCw, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MzBanner, MzButton, MzCard, MzSegmentedControl } from '@/components/ui';
import { formatByteSize } from '@/edition/bidi/format-bytes';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { formatSkillLabel, formatTrackLocalizedName } from '@/components/bidi/topic-labels';
import type { CacheUsageSummary } from '@/gateways/catalog.gateway';
import type { PersonalizationStateDto } from '@/gateways/personalization.gateway';
import type { CatalogPackRecord } from '@/gateways/storage.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';
import {
  ensureCatalogSynced,
  readSwrCatalogPacks,
  readSwrTrack,
  subscribeTrackChanged,
  writeSwrCatalogPacks,
  writeSwrTrack,
} from '@/spa/swr-cache';

const SKILL_FILTERS: readonly (SkillKind | 'fullMock' | 'all')[] = [
  'all',
  'reading',
  'listening',
  'writing',
  'speaking',
  'fullMock',
];

function resolveSimulatorPath(
  skill: CatalogPackRecord['skill'],
  packId: string,
): string {
  switch (skill) {
    case 'reading':
      return `/practice/reading/${packId}`;
    case 'listening':
      return `/practice/listening/${packId}`;
    case 'writing':
      return `/practice/writing/${packId}`;
    case 'speaking':
      return `/practice/speaking/${packId}`;
    case 'fullMock':
      return `/practice/full-mock/${packId}`;
    default:
      return '/practice/drills';
  }
}

export interface PracticeCatalogScreenProps {
  readonly initialTrack?: SupportedExamId;
  readonly initialSkill?: 'reading' | 'listening';
}

export function PracticeCatalogScreen({ initialTrack, initialSkill }: PracticeCatalogScreenProps = {}) {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const navigate = useNavigate();

  const [packs, setPacks] = useState<readonly CatalogPackRecord[]>(() =>
    readSwrCatalogPacks(deps.catalog, deps.edition),
  );
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(
    () => readSwrCatalogPacks(deps.catalog, deps.edition).length === 0,
  );
  const [cacheSummary, setCacheSummary] = useState<CacheUsageSummary | null>(null);
  const [selectedExam, setSelectedExam] = useState<SupportedExamId>(
    () => initialTrack ?? readSwrTrack(deps.edition) ?? 'ielts_academic',
  );
  const [selectedSkill, setSelectedSkill] = useState<SkillKind | 'fullMock' | 'all'>(
    initialSkill ?? 'all',
  );
  const [cachedOnly, setCachedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingPackId, setDownloadingPackId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [personalization, setPersonalization] = useState<PersonalizationStateDto | null>(null);
  const [catalogTab, setCatalogTab] = useState<'for_you' | 'all'>('for_you');

  const hydratedRef = useRef(false);

  useEffect(() => {
    return subscribeTrackChanged((nextTrack) => {
      setSelectedExam(nextTrack);
    });
  }, []);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    let mounted = true;
    async function loadLocalCatalog() {
      const hadSwr = readSwrCatalogPacks(deps.catalog, deps.edition).length > 0;
      const syncPromise = !hadSwr ? ensureCatalogSynced(deps.catalog, deps.edition) : null;

      const [packsRes, cacheRes, profileRes, pRes] = await Promise.all([
        deps.catalog.listPacks(),
        deps.catalog.getCacheUsageSummary(),
        deps.attemptStore.getUserProfile(),
        deps.personalization ? deps.personalization.getState() : Promise.resolve(null),
      ]);
      if (!mounted) return;
      if (pRes && pRes.ok) {
        setPersonalization(pRes.value);
      }

      if (cacheRes.ok) {
        setCacheSummary(cacheRes.value);
      }
      if (!initialTrack && profileRes.ok && profileRes.value?.examId) {
        setSelectedExam(profileRes.value.examId);
        writeSwrTrack(deps.edition, profileRes.value.examId);
      }

      if (packsRes.ok && packsRes.value.length > 0) {
        setPacks(packsRes.value);
        writeSwrCatalogPacks(deps.catalog, deps.edition, packsRes.value);
        setIsLoadingCatalog(false);
        return;
      }

      const syncedRows = await (syncPromise ?? ensureCatalogSynced(deps.catalog, deps.edition));
      if (!mounted) return;
      if (syncedRows && syncedRows.length > 0) {
        setPacks(syncedRows);
      }
      setIsLoadingCatalog(false);
    }
    void loadLocalCatalog();
    return () => {
      mounted = false;
    };
  }, [
    deps.attemptStore,
    deps.catalog,
    deps.edition,
    deps.personalization,
    initialTrack,
  ]);

  const handleSyncCatalog = async () => {
    setSyncing(true);
    setErrorMsg(null);
    const res = await deps.catalog.syncCatalogManifest();
    if (!res.ok) {
      setErrorMsg(res.error.message);
    } else {
      setPacks(res.value);
      writeSwrCatalogPacks(deps.catalog, deps.edition, res.value);
    }
    const cacheRes = await deps.catalog.getCacheUsageSummary();
    if (cacheRes.ok) setCacheSummary(cacheRes.value);
    setSyncing(false);
  };

  const handleDownloadOffline = async (packId: string) => {
    setDownloadingPackId(packId);
    setErrorMsg(null);
    const res = await deps.catalog.downloadExamPack(packId);
    if (!res.ok) {
      setErrorMsg(res.error.message);
    } else {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mockza:prefetch-offline-chunks'));
      }
      const [packsRes, cacheRes] = await Promise.all([
        deps.catalog.listPacks(),
        deps.catalog.getCacheUsageSummary(),
      ]);
      if (packsRes.ok) {
        setPacks(packsRes.value);
        writeSwrCatalogPacks(deps.catalog, deps.edition, packsRes.value);
      }
      if (cacheRes.ok) setCacheSummary(cacheRes.value);
    }
    setDownloadingPackId(null);
  };

  const filteredPacks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const recIds = new Set(personalization?.recommendedPacks.map((r) => r.packId) ?? []);
    if (personalization?.nextRecommendedPack) {
      recIds.add(personalization.nextRecommendedPack.packId);
    }
    const base = packs.filter((pack) => {
      if (catalogTab === 'for_you' && recIds.size > 0 && !query && selectedSkill === 'all') {
        if (!recIds.has(pack.packId)) return false;
      }
      if (pack.examId !== selectedExam) return false;
      if (selectedSkill !== 'all' && pack.skill !== selectedSkill) return false;
      if (cachedOnly && pack.isCachedOffline !== 1) return false;
      if (
        query &&
        !pack.title.toLowerCase().includes(query) &&
        !pack.description.toLowerCase().includes(query) &&
        !pack.skill.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
    if (catalogTab === 'for_you' && recIds.size > 0 && base.length > 0) {
      const order = new Map<string, number>();
      personalization?.recommendedPacks.forEach((r, idx) => order.set(r.packId, idx));
      return [...base].sort((a, b) => (order.get(a.packId) ?? 99) - (order.get(b.packId) ?? 99));
    }
    return base;
  }, [cachedOnly, catalogTab, packs, personalization, searchQuery, selectedExam, selectedSkill]);

  const isRtl = deps.edition === 'irn';
  const recommendedByPackId = useMemo(() => {
    const map = new Map<string, { readonly reason: string; readonly phase: string; readonly weaknessKey?: string | null }>();
    for (const rec of personalization?.recommendedPacks ?? []) {
      map.set(rec.packId, {
        reason: isRtl ? rec.reasonFa : rec.reasonEn,
        phase: rec.phase,
        weaknessKey: rec.weaknessKey,
      });
    }
    if (personalization?.nextRecommendedPack) {
      const next = personalization.nextRecommendedPack;
      map.set(next.packId, {
        reason: isRtl ? next.reasonFa : next.reasonEn,
        phase: next.phase,
        weaknessKey: next.weaknessKey,
      });
    }
    return map;
  }, [isRtl, personalization]);

  const spotlightPack = useMemo(() => {
    const recId = personalization?.nextRecommendedPack?.packId;
    if (!recId) return null;
    return packs.find((p) => p.packId === recId) ?? null;
  }, [packs, personalization?.nextRecommendedPack?.packId]);

  const phaseLabelText =
    personalization?.profile.activeWeaknessPhase === 'weakness_transfer'
      ? t('roadmapPhaseWeaknessTransfer')
      : personalization?.profile.activeWeaknessPhase === 'exam_breadth'
        ? t('roadmapPhaseExamBreadth')
        : t('roadmapPhaseFavoriteTopics');

  return (
    <div data-testid="practice-catalog-screen" className="mx-auto flex max-w-6xl flex-col gap-5 pb-12 text-start">
      {personalization && spotlightPack ? (
        <MzCard variant="hero" data-testid="practice-recommended-hero">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t('recommendedNextBadge')}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-canvas px-2.5 py-0.5 text-[11px] font-semibold text-text-secondary">
                  <Compass className="h-3 w-3 text-primary" aria-hidden="true" />
                  <span>{phaseLabelText}</span>
                </span>
              </div>
              <LtrExamBoundary>
                <h2 className="text-lg font-bold text-text-primary">{spotlightPack.title}</h2>
              </LtrExamBoundary>
              <p className="text-xs text-text-secondary">
                {(recommendedByPackId.get(spotlightPack.packId)?.reason ?? spotlightPack.description).replace(
                  /SeaweedFS\s*\.m4a\s*audio/gi,
                  deps.edition === 'irn'
                    ? 'متن همگام‌سازی‌شده و فایل صوتی استودیویی'
                    : 'synchronized transcript and studio audio',
                )}
              </p>
            </div>
            <MzButton
              variant="primary"
              size="md"
              data-testid="launch-recommended-pack-btn"
              leadingIcon={<Play className="h-4 w-4" aria-hidden="true" />}
              onClick={() => void navigate({ to: resolveSimulatorPath(spotlightPack.skill, spotlightPack.packId) })}
            >
              {t('practiceLaunchPackAction')}
            </MzButton>
          </div>
        </MzCard>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{t('practiceCatalogTitle')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('practiceCatalogSubtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MzSegmentedControl<'for_you' | 'all'>
            ariaLabel={t('practiceCatalogTitle')}
            fullWidth
            value={catalogTab}
            onChange={setCatalogTab}
            options={[
              { value: 'for_you', label: t('practiceTabForYourPath') },
              { value: 'all', label: t('practiceTabAllTests') },
            ]}
          />
          <Link
            to="/practice/drills"
            data-testid="practice-goto-drills"
            className="inline-flex min-h-10 items-center whitespace-nowrap rounded-[var(--mz-radius-control)] border border-border-subtle bg-bg-raised px-3.5 text-xs font-semibold text-text-primary hover:bg-surface-hover"
          >
            {t('homeQuickDrillsCta')}
          </Link>
          <Link
            to="/practice/full-mock"
            data-testid="practice-goto-full-mock"
            className="inline-flex min-h-10 items-center whitespace-nowrap rounded-[var(--mz-radius-control)] border border-primary/40 bg-surface-alt px-3.5 text-xs font-semibold text-primary hover:bg-surface-hover"
          >
            {t('homeQuickFullMockCta')}
          </Link>
          <MzButton
            variant="secondary"
            size="sm"
            data-testid="practice-sync-btn"
            isLoading={syncing}
            leadingIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            onClick={() => void handleSyncCatalog()}
          >
            {t('practiceSyncCatalogAction')}
          </MzButton>
        </div>
      </div>

      {errorMsg ? <MzBanner tone="danger">{errorMsg}</MzBanner> : null}

      {/* Filter Bar + Cache Meter */}
      <MzCard variant="default" padding="sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
                aria-hidden="true"
              />
              <input
                type="search"
                data-testid="practice-search-input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('practiceSearchPlaceholder')}
                className="h-9 w-full rounded-[var(--mz-radius-control)] border border-border-subtle bg-canvas ps-9 pe-3 text-xs text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
              />
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-text-primary">
              <input
                type="checkbox"
                data-testid="practice-cached-only-toggle"
                checked={cachedOnly}
                onChange={(event) => setCachedOnly(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span>{t('practiceCachedOnlyLabel')}</span>
            </label>

            {cacheSummary ? (
              <span
                data-testid="practice-cache-summary"
                className="inline-flex items-center gap-1.5 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-canvas px-3 py-1 text-[11px] text-text-secondary"
              >
                <HardDrive className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>
                  {t('practiceCacheUsageLabel', {
                    used: formatByteSize(cacheSummary.totalBytes, deps.edition),
                    quota: formatByteSize(cacheSummary.quotaBytes, deps.edition),
                    count: cacheSummary.packCount,
                  })}
                </span>
              </span>
            ) : null}
          </div>

          <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            <span className="inline-flex min-h-10 shrink-0 items-center rounded-[var(--mz-radius-pill)] border border-primary/30 bg-surface-alt px-3.5 text-xs font-semibold text-primary whitespace-nowrap">
              {formatTrackLocalizedName(selectedExam, deps.edition)}
            </span>
            {SKILL_FILTERS.map((skill) => (
              <button
                key={skill}
                type="button"
                data-testid={`filter-skill-${skill}`}
                onClick={() => setSelectedSkill(skill)}
                className={[
                  'min-h-10 shrink-0 whitespace-nowrap rounded-[var(--mz-radius-pill)] border px-3 text-xs font-semibold transition-colors',
                  selectedSkill === skill
                    ? 'border-focus bg-blue-bg text-focus'
                    : 'border-border-subtle bg-canvas text-text-secondary hover:bg-surface-hover',
                ].join(' ')}
              >
                {skill === 'all' ? t('practiceAllSkillsFilter') : formatSkillLabel(skill, deps.edition)}
              </button>
            ))}
          </div>
        </div>
      </MzCard>

      {/* Pack Grid */}
      {isLoadingCatalog && packs.length === 0 ? (
        <div
          aria-busy="true"
          className="grid animate-pulse gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-44 rounded-[var(--mz-radius-card)] border border-border-subtle bg-surface"
            />
          ))}
        </div>
      ) : filteredPacks.length === 0 ? (
        <MzCard variant="alt">
          <p className="py-6 text-center text-sm text-text-secondary">
            {t('practiceEmptyCatalog')}
          </p>
        </MzCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPacks.map((pack) => {
            const isCached = pack.isCachedOffline === 1;
            const targetPath = resolveSimulatorPath(pack.skill, pack.packId);
            return (
              <MzCard
                key={pack.packId}
                variant="default"
                data-testid={`catalog-pack-card-${pack.packId}`}
                className="flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
                    <span className="rounded-[var(--mz-radius-pill)] bg-surface-alt px-2.5 py-0.5 text-primary">
                      {deps.edition === 'irn'
                        ? formatTrackLocalizedName(pack.examId, deps.edition)
                        : EXAM_TRACK_SPECS[pack.examId].displayName}{' '}
                      · {formatSkillLabel(pack.skill, deps.edition)}
                    </span>
                    {isCached ? (
                      <span
                        data-testid={`pack-offline-badge-${pack.packId}`}
                        className="inline-flex items-center gap-1 text-success"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{t('practiceOfflineReadyBadge')}</span>
                      </span>
                    ) : null}
                  </div>
                  <LtrExamBoundary>
                    <h2 className="mt-2 text-base font-bold text-text-primary">{pack.title}</h2>
                  </LtrExamBoundary>
                  <p className="mt-1 text-xs text-text-secondary">
                    {pack.description.replace(
                      /SeaweedFS\s*\.m4a\s*audio/gi,
                      deps.edition === 'irn'
                        ? 'متن همگام‌سازی‌شده و فایل صوتی استودیویی'
                        : 'synchronized transcript and studio audio',
                    )}
                  </p>
                  {recommendedByPackId.has(pack.packId) ? (
                    <p className="mt-1.5 rounded-[var(--mz-radius-compact)] bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                      {recommendedByPackId.get(pack.packId)?.reason}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-text-tertiary">
                    {t('practicePackMetaSummary', {
                      minutes: Math.max(1, Math.round(pack.durationSeconds / 60)),
                      count: pack.questionCount,
                    })}{' '}
                    · {formatByteSize(pack.byteLength, deps.edition)}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-3">
                  {!isCached ? (
                    <MzButton
                      variant="secondary"
                      size="md"
                      data-testid={`download-pack-${pack.packId}`}
                      isLoading={downloadingPackId === pack.packId}
                      leadingIcon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
                      onClick={() => void handleDownloadOffline(pack.packId)}
                    >
                      {downloadingPackId === pack.packId
                        ? t('practiceDownloadingPackLabel')
                        : t('practiceDownloadPackAction')}
                    </MzButton>
                  ) : (
                    <span className="text-[11px] font-medium text-success">
                      {t('practiceVerifiedOffline')}
                    </span>
                  )}

                  <MzButton
                    variant="primary"
                    size="md"
                    data-testid={`launch-pack-${pack.packId}`}
                    leadingIcon={<Play className="h-3.5 w-3.5" aria-hidden="true" />}
                    onClick={() => void navigate({ to: targetPath })}
                  >
                    {t('practiceLaunchPackAction')}
                  </MzButton>
                </div>
              </MzCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { Link } from '@tanstack/react-router';
import {
  CheckCircle2,
  CloudUpload,
  Compass,
  FileText,
  Flame,
  Headphones,
  Image as ImageIcon,
  Link2,
  Lock,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { MzCard } from '@/components/ui';
import { ForwardArrowIcon } from '@/components/bidi/DirectionIcon';
import { formatTopicLabel } from '@/components/bidi/topic-labels';
import type { QuotaStatusSnapshot } from '@/gateways/evaluation.gateway';
import type {
  DailyMissionSnapshot,
  LinguisticGraphSnapshot,
} from '@/gateways/linguistic.gateway';
import type { PersonalizationStateDto } from '@/gateways/personalization.gateway';
import { createTranslator } from '@/i18n';
import { useDeps } from '@/spa/deps';

export function CoachHubScreen() {
  const deps = useDeps();
  const t = createTranslator(deps.edition);
  const isRtl = deps.edition === 'irn';

  const [mission, setMission] = useState<DailyMissionSnapshot | null>(null);
  const [graph, setGraph] = useState<LinguisticGraphSnapshot | null>(null);
  const [dropCount, setDropCount] = useState<number>(0);
  const [quota, setQuota] = useState<QuotaStatusSnapshot | null>(null);
  const [personalization, setPersonalization] = useState<PersonalizationStateDto | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const profileRes = await deps.attemptStore.getUserProfile();
      const examTrack = profileRes.ok && profileRes.value ? profileRes.value.examId : 'ielts_academic';
      const [missionRes, graphRes, dropsRes, quotaRes, pRes] = await Promise.all([
        deps.linguistic.getTodayMission({ examTrack }),
        deps.linguistic.getMyGraph(),
        deps.linguistic.getDropHistory(),
        deps.evaluation.getQuotaStatus(),
        deps.personalization ? deps.personalization.getState() : Promise.resolve(null),
      ]);
      if (!active) return;
      if (missionRes.ok) setMission(missionRes.value);
      if (graphRes.ok) setGraph(graphRes.value);
      if (dropsRes.ok) setDropCount(dropsRes.value.items.length);
      if (quotaRes.ok) setQuota(quotaRes.value);
      if (pRes && pRes.ok) setPersonalization(pRes.value);
    })();
    return () => {
      active = false;
    };
  }, [deps]);

  const advQuota = quota?.advancedQuota;
  const missionDone = mission?.status === 'completed';
  const weakSpotCount = graph?.bottlenecks.length ?? 0;

  return (
    <div data-testid="coach-hub-screen" className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10 text-start">
      <header className="border-b border-border-subtle pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t('navSmartCoach')}
            </p>
            <h1 className="font-editorial mt-1 text-4xl text-text-primary">
              {t('smartCoachTitle')}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {t('smartCoachSubtitle')}
            </p>
          </div>

          {advQuota ? (
            <div
              data-testid="coach-quota-pill"
              className="flex items-center gap-2 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-surface px-3 py-1.5 text-xs"
            >
              {advQuota.isPro ? (
                <span className="font-semibold text-primary">
                  {isRtl
                    ? `اشتراک ویژه · ${advQuota.shifterRemainingToday} ارتقا / ${advQuota.dropsRemainingToday} محتوا امروز`
                    : `Pro · ${advQuota.shifterRemainingToday} upgrades & ${advQuota.dropsRemainingToday} studies left today`}
                </span>
              ) : (
                <>
                  <span className="font-semibold text-text-primary">
                    {advQuota.freeSampleUsed
                      ? isRtl
                        ? 'نمونه رایگان استفاده شده'
                        : 'Free AI sample used'
                      : isRtl
                        ? '۱ نمونه رایگان + دسترسی صدا با اشتراک'
                        : '1 free sample included'}
                  </span>
                  <Link
                    to="/paywall"
                    className="font-semibold text-primary hover:underline"
                  >
                    {isRtl ? 'ارتقا' : 'Upgrade'}
                  </Link>
                </>
              )}
            </div>
          ) : null}
        </div>
      </header>

      {/* Primary Hero: Today's 10-Min Coach */}
      <MzCard variant="hero" data-testid="coach-daily-hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                {isRtl ? 'قدم ۱ · عادت روزانه ۱۰ دقیقه‌ای' : 'Step 1 · Daily 10-Min Habit'}
              </p>
              {mission ? (
                <span
                  data-testid="coach-mission-status-badge"
                  className={`inline-flex items-center gap-1 rounded-[var(--mz-radius-pill)] border px-2.5 py-0.5 text-[11px] font-semibold ${
                    missionDone
                      ? 'border-success/40 bg-tint text-success'
                      : 'border-primary/40 bg-canvas text-primary'
                  }`}
                >
                  {missionDone ? (
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  ) : null}
                  <span>
                    {missionDone
                      ? isRtl
                        ? 'تمرین امروز انجام شد'
                        : 'Done today'
                      : `${isRtl ? 'موضوع:' : 'Topic:'} ${formatTopicLabel(mission.focusTopic, deps.edition)}`}
                  </span>
                </span>
              ) : null}
              {personalization ? (
                <span className="rounded-[var(--mz-radius-pill)] border border-primary/30 bg-surface-alt px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {personalization.profile.activeWeaknessPhase === 'weakness_transfer'
                    ? t('roadmapPhaseWeaknessTransfer')
                    : personalization.profile.activeWeaknessPhase === 'exam_breadth'
                      ? t('roadmapPhaseExamBreadth')
                      : t('roadmapPhaseFavoriteTopics')}
                </span>
              ) : null}
            </div>
            <h2 className="font-editorial mt-1 text-3xl text-text-primary">
              {mission?.payload.promptTitle ?? t('homeDailyMissionTitle')}
            </h2>
            <p className="mt-1.5 text-sm text-text-secondary">
              {isRtl
                ? 'وقتی فقط ۱۰ دقیقه وقت دارید: یک تمرین کوتاه مخصوص نقاط ضعف واقعی و واژگان سررسید امروز شما می‌سازد و استفاده درست را بررسی می‌کند.'
                : 'When you have 10 minutes a day: get one short personalized prompt combining your recurring weak spots, due words, and favorite topics.'}
            </p>
          </div>
          <Link
            to="/mission/$missionId"
            params={{ missionId: 'today' }}
            data-testid="coach-start-daily-cta"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[var(--mz-radius-compact)] bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary-pressed"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>
              {missionDone
                ? isRtl
                  ? 'مرور تمرین و بازخورد'
                  : 'Review Today’s Feedback'
                : t('homeDailyMissionStartCta')}
            </span>
          </Link>
        </div>
      </MzCard>

      {/* Clear 3-Tool Grid with "When to Use", Live Counts & Quick Launchers */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MzCard variant="default">
          <div className="flex h-full flex-col justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                <span>{t('navRegisterShifter')}</span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                {isRtl
                  ? 'وقتی نمی‌دانید چطور جمله‌های ساده را حرفه‌ای‌تر یا آکادمیک بیان کنید: صحبت کنید یا بنویسید و ۳ سطح روزمره، کاری و نمره ۸+ را بشنوید.'
                  : 'Use when you sound too casual: speak or type a casual thought, compare Everyday vs Work vs Band 8+, and listen to natural pacing.'}
              </p>
            </div>
            <Link
              to="/register-shifter"
              data-testid="coach-upgrade-speaking-cta"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-strong px-3.5 text-xs font-semibold text-primary hover:bg-surface-hover"
            >
              {t('homeRegisterShifterCta')}
            </Link>
          </div>
        </MzCard>

        <MzCard variant="default">
          <div className="flex h-full flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <CloudUpload className="h-4 w-4" aria-hidden="true" />
                  <span>{t('navDropAnything')}</span>
                </p>
                {dropCount > 0 ? (
                  <span className="rounded-[var(--mz-radius-pill)] bg-bg-raised px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                    {isRtl ? `${dropCount} منبع` : `${dropCount} saved`}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                {isRtl
                  ? 'مقاله، متن کتاب، اسکرین‌شات یا ویس انگلیسی وارد کنید تا در ۲ دقیقه آزمونک و فلش‌کارت بسازد.'
                  : 'Turn any article, book excerpt, screenshot, or clip into a 2-minute quiz + flashcards.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(
                  [
                    { tab: 'url', label: isRtl ? 'لینک' : 'Link', Icon: Link2 },
                    { tab: 'text', label: isRtl ? 'متن' : 'Text', Icon: FileText },
                    { tab: 'image', label: isRtl ? 'عکس' : 'Photo', Icon: ImageIcon },
                    { tab: 'audio', label: isRtl ? 'صدا' : 'Audio', Icon: Headphones },
                  ] as const
                ).map(({ tab, label, Icon }) => (
                  <Link
                    key={tab}
                    to="/drop"
                    search={{ tab }}
                    data-testid={`coach-quick-drop-${tab}`}
                    className="inline-flex min-h-9 items-center gap-1 rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-2.5 text-[11px] font-medium text-text-secondary hover:border-primary hover:text-primary"
                  >
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    <span>{label}</span>
                    {tab === 'audio' && advQuota && !advQuota.audioDropAllowed ? (
                      <Lock className="h-2.5 w-2.5 text-warning" aria-hidden="true" />
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
            <Link
              to="/drop"
              data-testid="coach-learn-anything-cta"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-strong px-3.5 text-xs font-semibold text-primary hover:bg-surface-hover"
            >
              {t('homeDropAnythingCta')}
            </Link>
          </div>
        </MzCard>

        <MzCard variant="default">
          <div className="flex h-full flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                  <span>{t('navLinguisticGraph')}</span>
                </p>
                <span className="rounded-[var(--mz-radius-pill)] bg-bg-raised px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                  {weakSpotCount > 0
                    ? isRtl
                      ? `${weakSpotCount} نقطه ضعف`
                      : `${weakSpotCount} tracked`
                    : isRtl
                      ? 'آماده تنظیم'
                      : 'New'}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                {isRtl
                  ? 'ببینید دقیقاً چه گرامر یا واژگانی نمره‌تان را پایین می‌آورد و موضوعات دلخواهتان را برای تمرین روزانه تنظیم کنید.'
                  : 'See recurring grammar/vocab habits, track mastered expressions, and choose personal topics (e.g., AI, Football).'}
              </p>
            </div>
            <Link
              to="/progress/graph"
              data-testid="coach-weak-spots-cta"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--mz-radius-compact)] border border-border-strong px-3.5 text-xs font-semibold text-primary hover:bg-surface-hover"
            >
              {t('dailyMissionViewGraph')}
            </Link>
          </div>
        </MzCard>
      </section>

      {/* Distinction Helper Banner */}
      <MzCard variant="default">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Compass className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="text-xs text-text-secondary">
              {isRtl
                ? 'دنبال آزمون زمان‌دار و نمره دقیق آیلتس/تافل هستید؟ از بخش «آزمون‌ها» استفاده کنید.'
                : 'Want timed full exams & official-style band estimates? Switch to the Mock Exams workspace anytime.'}
            </p>
          </div>
          <Link
            to="/practice"
            className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <span>{t('navPractice')}</span>
            <ForwardArrowIcon edition={deps.edition} className="h-3.5 w-3.5" />
          </Link>
        </div>
      </MzCard>
    </div>
  );
}

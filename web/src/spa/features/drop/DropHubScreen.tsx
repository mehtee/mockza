import { Link, useNavigate } from '@tanstack/react-router';
import {
  FileText,
  Headphones,
  Image as ImageIcon,
  Link2,
  Lock,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  type ClipboardEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MzCard } from '@/components/ui';
import { localizeWorkerStage } from '@/components/bidi/diagnostic-labels';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import { formatChromeNumber } from '@/edition/bidi/numerals';
import type { QuotaStatusSnapshot } from '@/gateways/evaluation.gateway';
import type { DropMediaContentType, DroppedContentItem } from '@/gateways/linguistic.gateway';
import { createTranslator } from '@/i18n';
import { pollAdvancedJobUntilDone, watchDropJobInBackground } from '@/spa/advanced-job-watcher';
import { useDeps } from '@/spa/deps';
import {
  DROP_MAX_AUDIO_SECONDS,
  DROP_MAX_IMAGES,
  validateDropTextSnippet,
  validateDropUrlPreFlight,
  type SupportedExamId,
} from '@mockza/domain';

export type DropTabMode = 'url' | 'text' | 'image' | 'audio';

export interface DropHubScreenProps {
  readonly initialTab?: DropTabMode;
}

interface StagedImageItem {
  readonly bytes: Uint8Array;
  readonly contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  readonly name: string;
  readonly previewUrl: string;
}

interface StagedAudioItem {
  readonly bytes: Uint8Array;
  readonly contentType: 'audio/mp4' | 'audio/mpeg' | 'audio/wav' | 'audio/ogg';
  readonly name: string;
  readonly previewUrl: string;
  readonly durationSeconds: number;
}

const SAMPLE_EXCERPTS = [
  {
    label: 'AI & Work',
    text: 'Generative tools accelerate initial drafting, albeit often introducing subtle factual hallucinations that require seasoned human judgment and deliberate editorial verification before publication.',
  },
  {
    label: 'Urban Design',
    text: 'Forward-thinking municipalities have prioritized walkable green corridors rather than widening highways, recognizing that congestion cannot simply be paved away in dense metropolitan regions.',
  },
  {
    label: 'Habit Science',
    text: 'Sustainable fluency rarely stems from marathon weekend cramming; rather, it compounds through compact daily feedback loops that surface recurring errors while memory traces remain fresh.',
  },
] as const;

function resolveAudioContentType(
  file: File,
): 'audio/mp4' | 'audio/mpeg' | 'audio/wav' | 'audio/ogg' | null {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (mime === 'audio/mp4' || mime === 'audio/x-m4a' || name.endsWith('.m4a')) return 'audio/mp4';
  if (mime === 'audio/mpeg' || mime === 'audio/mp3' || name.endsWith('.mp3')) return 'audio/mpeg';
  if (mime === 'audio/wav' || mime === 'audio/x-wav' || name.endsWith('.wav')) return 'audio/wav';
  if (mime === 'audio/ogg' || name.endsWith('.ogg')) return 'audio/ogg';
  return null;
}

async function probeAudioDurationSeconds(url: string): Promise<number> {
  if (typeof document === 'undefined') return 30;
  return new Promise<number>((resolve) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    const done = (val: number) => {
      audio.src = '';
      resolve(val);
    };
    const timer = window.setTimeout(() => done(30), 1500);
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      done(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30);
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      done(30);
    };
    audio.src = url;
  });
}

async function downscaleImageFileToPngOrWebp(file: File): Promise<StagedImageItem> {
  const fallbackPreview =
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(file)
      : '';
  if (typeof createImageBitmap === 'function' && typeof document !== 'undefined') {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0, width, height);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/webp', 0.85),
        );
        if (blob) {
          const buf = await blob.arrayBuffer();
          return {
            bytes: new Uint8Array(buf),
            contentType: 'image/webp',
            name: file.name,
            previewUrl: fallbackPreview,
          };
        }
      }
    } catch {
      // Fallback to raw bytes if bitmap decoding unavailable in headless runtime
    }
  }
  const arr = await file.arrayBuffer();
  const mime =
    file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
  return {
    bytes: new Uint8Array(arr),
    contentType: mime,
    name: file.name,
    previewUrl: fallbackPreview,
  };
}

export function DropHubScreen({ initialTab }: DropHubScreenProps = {}) {
  const deps = useDeps();
  const navigate = useNavigate();
  const isRtl = deps.edition === 'irn';
  const t = createTranslator(deps.edition);
  const [tab, setTab] = useState<DropTabMode>(initialTab ?? 'url');
  const [examTrack, setExamTrack] = useState<SupportedExamId>('ielts_academic');
  const [quota, setQuota] = useState<QuotaStatusSnapshot | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [queuedImages, setQueuedImages] = useState<StagedImageItem[]>([]);
  const [audioFile, setAudioFile] = useState<StagedAudioItem | null>(null);
  const [history, setHistory] = useState<readonly DroppedContentItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'url' | 'text' | 'image' | 'audio'>('all');
  const [submitting, setSubmitting] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string>('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    mountedRef.current = true;
    void deps.attemptStore.getUserProfile().then((res) => {
      if (mountedRef.current && res.ok && res.value) setExamTrack(res.value.examId);
    });
    void deps.linguistic.getDropHistory().then((res) => {
      if (mountedRef.current && res.ok) setHistory(res.value.items);
    });
    void deps.evaluation.getQuotaStatus().then((res) => {
      if (mountedRef.current && res.ok) setQuota(res.value);
    });
    return () => {
      mountedRef.current = false;
    };
  }, [deps]);

  const stageImages = async (fileList: File[]) => {
    const remaining = Math.max(0, DROP_MAX_IMAGES - queuedImages.length);
    const chosen = fileList.filter((f) => f.type.startsWith('image/')).slice(0, remaining);
    if (chosen.length === 0) return;
    const scaled = await Promise.all(chosen.map(downscaleImageFileToPngOrWebp));
    setQueuedImages((prev) => [...prev, ...scaled].slice(0, DROP_MAX_IMAGES));
    setTab('image');
    setError(null);
  };

  const handlePaste = async (e: ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      await stageImages(imageFiles);
    }
  };

  const handleDropImages = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length > 0) {
      await stageImages(files);
    }
  };

  const handleStageAudio = async (file: File) => {
    const contentType = resolveAudioContentType(file);
    if (!contentType) {
      setError(
        isRtl
          ? 'فرمت صوتی پشتیبانی نمی‌شود. از mp3، m4a، wav یا ogg استفاده کنید.'
          : 'Unsupported audio format. Please pick an MP3, M4A, WAV, or OGG clip.',
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(
        isRtl
          ? 'حجم فایل صوتی باید کمتر از ۵ مگابایت باشد.'
          : 'Audio clip must be under 5 MB.',
      );
      return;
    }
    const previewUrl =
      typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : '';
    const durationSeconds = await probeAudioDurationSeconds(previewUrl);
    if (durationSeconds > DROP_MAX_AUDIO_SECONDS) {
      setError(
        isRtl
          ? 'مدت فایل صوتی باید حداکثر ۳ دقیقه (۱۸۰ ثانیه) باشد.'
          : 'Audio clip exceeds the 3-minute (180s) limit. Trim it or paste a transcript.',
      );
      return;
    }
    const arr = await file.arrayBuffer();
    setError(null);
    setAudioFile({
      bytes: new Uint8Array(arr),
      contentType,
      name: file.name,
      previewUrl,
      durationSeconds,
    });
  };

  const pollDropAndNavigate = async (jobId: string) => {
    setActiveJobId(jobId);
    setStatusLabel(
      isRtl
        ? 'در حال استخراج واژگان و ساخت آزمونک ۲ دقیقه‌ای...'
        : 'Extracting idioms and building your 2-minute quiz...',
    );
    const outcome = await pollAdvancedJobUntilDone<DroppedContentItem>({
      pollFn: () => deps.linguistic.pollAdvancedJob<DroppedContentItem>(jobId),
      timeoutMs: 90_000,
      onStage: (stage) => {
        if (mountedRef.current) setStatusLabel(localizeWorkerStage(stage, deps.edition));
      },
      isCancelled: () => !mountedRef.current,
    });
    if (!mountedRef.current) return;
    setSubmitting(false);
    setActiveJobId(null);
    setStatusLabel('');

    if (outcome.kind === 'completed' && outcome.result.dropId) {
      void navigate({
        to: '/drop/drill/$dropId',
        params: { dropId: outcome.result.dropId },
      });
      return;
    }
    if (outcome.kind === 'error') {
      setError(outcome.error.message);
      return;
    }
    if (outcome.kind === 'timeout') {
      setError(
        isRtl
          ? 'تحلیل بیشتر از حد معمول طول کشید. کمی بعد از بخش تاریخچه بررسی کنید یا متن را مستقیم پیست کنید.'
          : 'Analysis is taking longer than expected. Check History in a moment or paste clean text.',
      );
      return;
    }
    if (outcome.kind === 'failed') {
      setError(
        isRtl
          ? 'استخراج از این منبع کامل نشد (شاید سایت متن قابل خواندن نداشت). متن را پیست کنید یا اسکرین‌شات بفرستید.'
          : 'Could not extract readable text from that source. Paste a text excerpt or try a clearer screenshot.',
      );
    }
  };

  const handleContinueInBackground = () => {
    if (!activeJobId) return;
    watchDropJobInBackground(deps, activeJobId);
    setSubmitting(false);
    setStatusLabel('');
    void navigate({ to: '/coach' });
  };

  const handleIngest = async () => {
    setError(null);
    if (tab === 'url') {
      const check = validateDropUrlPreFlight(sourceUrl, { allowHttpInDev: true });
      if (!check.ok) {
        if (isRtl) {
          const msg =
            check.code === 'SSRF_BLOCKED_HOST'
              ? 'نشانی‌های شبکه داخلی یا پورت‌های سفارشی مجاز نیستند.'
              : check.code === 'UNSUPPORTED_DROP_SOURCE'
                ? 'پلتفرم‌های ویدئویی و فایل‌های استریم پشتیبانی نمی‌شوند. لینک مقاله، متن یا اسکرین‌شات ارسال کنید.'
                : 'نشانی واردشده معتبر نیست. یک لینک عمومی مقاله وارد کنید.';
          setError(msg);
        } else {
          setError(check.reason ?? 'Unsupported URL. Share an article URL, text excerpt, or screenshot.');
        }
        return;
      }
      setSubmitting(true);
      setStatusLabel(isRtl ? 'در حال دریافت متن صفحه...' : 'Fetching readable article text...');
      const res = await deps.linguistic.ingestDrop({
        inputKind: 'text_url',
        sourceUrl: sourceUrl.trim(),
        examTrack,
      });
      if (!res.ok) {
        setError(res.error.message);
        setSubmitting(false);
        setStatusLabel('');
        return;
      }
      await pollDropAndNavigate(res.value.jobId);
      return;
    }

    if (tab === 'text') {
      const tCheck = validateDropTextSnippet(rawText);
      if (!tCheck.ok) {
        if (isRtl) {
          setError(
            tCheck.code === 'DROP_TEXT_TOO_LONG'
              ? 'حداکثر طول متن ۱۵٬۰۰۰ نویسه است.'
              : 'متن باید حداقل ۴۰ نویسه انگلیسی باشد.',
          );
        } else {
          setError(tCheck.reason ?? 'Text must be 40..15,000 characters.');
        }
        return;
      }
      setSubmitting(true);
      setStatusLabel(isRtl ? 'در حال تحلیل متن...' : 'Analyzing excerpt...');
      const res = await deps.linguistic.ingestDrop({
        inputKind: 'text',
        rawText: rawText.trim(),
        examTrack,
      });
      if (!res.ok) {
        setError(res.error.message);
        setSubmitting(false);
        setStatusLabel('');
        return;
      }
      await pollDropAndNavigate(res.value.jobId);
      return;
    }

    if (tab === 'image') {
      if (queuedImages.length === 0) {
        setError(isRtl ? 'حداقل یک تصویر انتخاب یا پیست کنید.' : 'Attach or paste 1–4 screenshots.');
        return;
      }
      setSubmitting(true);
      setStatusLabel(
        isRtl
          ? `در حال آپلود ${formatChromeNumber(queuedImages.length, deps.edition)} تصویر...`
          : `Uploading ${queuedImages.length} image(s)...`,
      );
      const dropId = crypto.randomUUID();
      const batch = await deps.linguistic.uploadDropMediaBatch({
        dropId,
        mediaKind: 'image',
        files: queuedImages.map((img) => ({
          bytes: img.bytes,
          contentType: img.contentType as DropMediaContentType,
        })),
      });
      if (!batch.ok) {
        setError(batch.error.message);
        setSubmitting(false);
        setStatusLabel('');
        return;
      }
      const res = await deps.linguistic.ingestDrop({
        inputKind: 'image',
        imageObjectKeys: [...batch.value.objectKeys],
        examTrack,
      });
      if (!res.ok) {
        setError(res.error.message);
        setSubmitting(false);
        setStatusLabel('');
        return;
      }
      await pollDropAndNavigate(res.value.jobId);
      return;
    }

    if (!audioFile) {
      setError(isRtl ? 'یک فایل صوتی کوتاه انتخاب کنید.' : 'Select a bounded <=180s audio clip.');
      return;
    }
    setSubmitting(true);
    setStatusLabel(isRtl ? 'در حال آپلود فایل صوتی...' : 'Uploading audio clip...');
    const dropId = crypto.randomUUID();
    const up = await deps.linguistic.uploadDropMediaBatch({
      dropId,
      mediaKind: 'audio',
      files: [{ bytes: audioFile.bytes, contentType: audioFile.contentType }],
    });
    if (!up.ok || !up.value.objectKeys[0]) {
      setError(up.ok ? (isRtl ? 'آپلود ناموفق بود.' : 'Upload failed.') : up.error.message);
      setSubmitting(false);
      setStatusLabel('');
      return;
    }
    const res = await deps.linguistic.ingestDrop({
      inputKind: 'audio',
      audioObjectKey: up.value.objectKeys[0],
      durationSeconds: Math.min(DROP_MAX_AUDIO_SECONDS, Math.max(3, audioFile.durationSeconds)),
      examTrack,
    });
    if (!res.ok) {
      setError(res.error.message);
      setSubmitting(false);
      setStatusLabel('');
      return;
    }
    await pollDropAndNavigate(res.value.jobId);
  };

  const handleDeleteHistoryItem = async (dropId: string) => {
    const res = await deps.linguistic.deleteDrop(dropId);
    if (res.ok) {
      setHistory((prev) => prev.filter((item) => item.dropId !== dropId));
    } else {
      setError(res.error.message);
    }
  };

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return history;
    return history.filter((item) => {
      if (historyFilter === 'url') return item.inputKind === 'text_url';
      return item.inputKind === historyFilter;
    });
  }, [history, historyFilter]);

  const advQuota = quota?.advancedQuota;
  const audioBlockedForFree = advQuota ? !advQuota.audioDropAllowed : false;

  return (
    <div
      data-testid="drop-hub-screen"
      onPaste={(e) => void handlePaste(e)}
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-10 text-start"
    >
      <header className="border-b border-border-subtle pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t('dropEyebrow')}
            </p>
            <h1 className="font-editorial mt-1 text-3xl text-text-primary">
              {t('dropTitle')}
            </h1>
            {isRtl ? (
              <p className="mt-1 text-xs text-text-secondary">
                بدون نیاز به فیلترشکن: لینک‌ها روی سرور سنجیا خوانده می‌شوند و برای لینک‌های محدود شده می‌توانید مستقیم متن یا اسکرین‌شات را پیست کنید.
              </p>
            ) : (
              <p className="mt-1 text-xs text-text-secondary">
                Paste any article link, book excerpt, screenshot, or clip to build a 2-minute quiz + flashcards.
              </p>
            )}
          </div>
          {advQuota ? (
            <span
              data-testid="drop-quota-badge"
              className="rounded-[var(--mz-radius-pill)] border border-border-subtle bg-surface px-3 py-1 text-xs font-semibold text-primary"
            >
              {advQuota.isPro
                ? isRtl
                  ? `${formatChromeNumber(advQuota.dropsRemainingToday, deps.edition)} محتوا باقی‌مانده امروز`
                  : `${advQuota.dropsRemainingToday} study sets left today`
                : advQuota.freeSampleUsed
                  ? isRtl
                    ? 'نمونه رایگان مصرف شد'
                    : 'Free sample used'
                  : isRtl
                    ? '۱ نمونه رایگان موجود'
                    : '1 free sample included'}
            </span>
          ) : null}
        </div>
      </header>

      <MzCard variant="hero">
        <div role="tablist" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {(
            [
              { id: 'url', labelEn: 'Article URL', labelFa: 'لینک مقاله', Icon: Link2 },
              { id: 'text', labelEn: 'Paste Text', labelFa: 'چسباندن متن', Icon: FileText },
              { id: 'image', labelEn: 'Screenshot / Photo', labelFa: 'اسکرین‌شات / عکس', Icon: ImageIcon },
              { id: 'audio', labelEn: 'Audio (<=3 min)', labelFa: 'فایل صوتی کوتاه', Icon: Headphones },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              data-testid={`drop-tab-${item.id}`}
              onClick={() => {
                setTab(item.id);
                setError(null);
              }}
              className={`inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--mz-radius-compact)] border px-3 text-xs font-semibold ${
                tab === item.id
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-border-subtle bg-bg-raised text-text-secondary hover:bg-surface-hover'
              }`}
            >
              <item.Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isRtl ? item.labelFa : item.labelEn}</span>
              {item.id === 'audio' && audioBlockedForFree ? (
                <Lock className="h-3 w-3 opacity-80" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {tab === 'url' ? (
            <input
              type="url"
              dir="ltr"
              data-testid="drop-url-input"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://example.com/article-about-ai"
              className="h-10 w-full rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface px-3 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
          ) : null}

          {tab === 'text' ? (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-text-secondary">
                  {isRtl ? 'متن‌های نمونه:' : 'Try a sample excerpt:'}
                </span>
                {SAMPLE_EXCERPTS.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => setRawText(ex.text)}
                    className="inline-flex min-h-9 items-center rounded-[var(--mz-radius-pill)] border border-border-subtle bg-bg-raised px-3 text-xs font-medium text-text-primary hover:border-primary hover:text-primary"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
              <textarea
                dir="ltr"
                rows={5}
                data-testid="drop-text-input"
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste any English article paragraph, podcast transcript, or book excerpt (40..15,000 chars)..."
                className="w-full rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface p-3 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
              <p className="text-[11px] text-text-secondary">
                {formatChromeNumber(rawText.trim().length, deps.edition)} /{' '}
                {formatChromeNumber('15,000', deps.edition)}{' '}
                {isRtl ? 'نویسه (حداقل ۴۰)' : 'chars (min 40)'}
              </p>
            </div>
          ) : null}

          {tab === 'image' ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => void handleDropImages(e)}
              className="rounded-[var(--mz-radius-compact)] border border-dashed border-border-strong bg-bg-raised p-4 text-xs text-text-secondary"
            >
              <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-primary">
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>
                  {isRtl
                    ? 'کشیدن و رها کردن، انتخاب یا پیست (Ctrl+V) حداکثر ۴ تصویر (زیر ۵ مگابایت)'
                    : 'Drag, Choose, or Paste (Ctrl+V) up to 4 PNG/JPEG/WebP screenshots'}
                </span>
                <input
                  type="file"
                  multiple
                  data-testid="drop-image-input"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    void stageImages(files);
                  }}
                />
              </label>
              {queuedImages.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {queuedImages.map((img, idx) => (
                    <div
                      key={`${img.name}-${idx}`}
                      className="relative overflow-hidden rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface p-1.5"
                    >
                      {img.previewUrl ? (
                        <img
                          src={img.previewUrl}
                          alt={img.name}
                          className="h-20 w-full rounded object-cover"
                        />
                      ) : null}
                      <p className="mt-1 truncate font-mono text-[10px] text-text-primary">
                        {img.name}
                      </p>
                      <button
                        type="button"
                        aria-label={`Remove ${img.name}`}
                        onClick={() =>
                          setQueuedImages((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="absolute end-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-canvas/90 text-text-primary shadow hover:text-danger"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === 'audio' ? (
            audioBlockedForFree ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--mz-radius-compact)] border border-warning/40 bg-amber-bg p-4 text-xs">
                <div className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                  <p className="text-text-primary">
                    {isRtl
                      ? 'تبدیل فایل صوتی به آزمونک ویژه اشتراک حرفه‌ای است. با متن یا اسکرین‌شات می‌توانید همین الان رایگان تمرین بسازید.'
                      : 'Audio-to-Quiz is included in Pro plans. Try Article Link, Paste Text, or Screenshots with your free trial.'}
                  </p>
                </div>
                <Link
                  to="/paywall"
                  className="inline-flex h-8 items-center rounded-[var(--mz-radius-compact)] bg-primary px-3 font-semibold text-on-primary hover:bg-primary-pressed"
                >
                  {isRtl ? 'ارتقا به نسخه کامل' : 'Upgrade to Pro'}
                </Link>
              </div>
            ) : (
              <div className="rounded-[var(--mz-radius-compact)] border border-dashed border-border-strong bg-bg-raised p-4 text-xs text-text-secondary">
                <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-primary">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {isRtl
                      ? 'انتخاب فایل صوتی کوتاه (.m4a / .mp3 / .wav، حداکثر ۳ دقیقه)'
                      : 'Choose short voice memo or clip (.m4a / .mp3 / .wav, <= 180s)'}
                  </span>
                  <input
                    type="file"
                    accept="audio/mp4,audio/mpeg,audio/wav,audio/ogg,.m4a,.mp3,.wav,.ogg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleStageAudio(f);
                    }}
                  />
                </label>
                {audioFile ? (
                  <div className="mt-3 space-y-2">
                    <p className="font-mono text-text-primary">
                      {audioFile.name} (
                      {isRtl
                        ? t('unitSecondsShort', {
                            seconds: formatChromeNumber(
                              Math.round(audioFile.durationSeconds),
                              deps.edition,
                            ),
                          })
                        : `${Math.round(audioFile.durationSeconds)}s`}
                      )
                    </p>
                    {audioFile.previewUrl ? (
                      <audio controls src={audioFile.previewUrl} className="h-9 w-full max-w-md" />
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          ) : null}
        </div>

        {statusLabel ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-primary/30 bg-surface-alt p-2.5 text-xs">
            <span className="font-medium text-primary">{statusLabel}</span>
            {activeJobId ? (
              <button
                type="button"
                onClick={handleContinueInBackground}
                className="font-semibold text-primary hover:underline"
              >
                {isRtl ? 'مرور حین آماده‌سازی' : 'Keep browsing — notify me when ready'}
              </button>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div
            data-testid="drop-error-banner"
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--mz-radius-compact)] border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger"
          >
            <span>{error}</span>
            <div className="flex items-center gap-2">
              {tab !== 'text' ? (
                <button
                  type="button"
                  onClick={() => {
                    setTab('text');
                    setError(null);
                  }}
                  className="font-semibold underline"
                >
                  {isRtl ? 'ارسال به صورت متن' : 'Paste text instead'}
                </button>
              ) : null}
              <Link to="/paywall" className="font-semibold underline">
                {isRtl ? 'اشتراک' : 'Plans'}
              </Link>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            data-testid="drop-ingest-btn"
            disabled={submitting || (tab === 'audio' && audioBlockedForFree)}
            onClick={() => void handleIngest()}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--mz-radius-compact)] bg-primary px-5 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>
              {submitting
                ? isRtl
                  ? 'در حال استخراج اصطلاحات و ساخت تمرین...'
                  : 'Extracting Phrases & Building Quiz...'
                : t('dropCreateCta')}
            </span>
          </button>
        </div>
      </MzCard>

      {history.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-text-primary">
              {isRtl ? 'آرشیو شخصی منابع مطالعاتی شما' : 'Your Saved Study Materials'}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'url', 'text', 'image', 'audio'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setHistoryFilter(f)}
                  className={`rounded-[var(--mz-radius-pill)] border px-2.5 py-0.5 text-[11px] font-semibold ${
                    historyFilter === f
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-border-subtle bg-bg-raised text-text-secondary'
                  }`}
                >
                  {f === 'all' ? (isRtl ? 'همه' : 'All') : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filteredHistory.map((item) => (
              <div
                key={item.dropId}
                className="flex items-start justify-between gap-2 rounded-[var(--mz-radius-card)] border border-border-subtle bg-bg-surface p-4 hover:bg-surface-hover"
              >
                <Link
                  to="/drop/drill/$dropId"
                  params={{ dropId: item.dropId }}
                  className="min-w-0 flex-1"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-text-secondary">
                    <span>{item.sourceDomainOrLabel}</span>
                    <LtrExamBoundary className="font-mono font-semibold text-primary">
                      CEFR {item.cefrEstimate}
                    </LtrExamBoundary>
                  </div>
                  <LtrExamBoundary className="mt-1 block truncate font-semibold text-text-primary">
                    {item.title}
                  </LtrExamBoundary>
                </Link>
                <button
                  type="button"
                  data-testid={`drop-delete-${item.dropId}`}
                  aria-label={isRtl ? 'حذف این مورد' : `Delete ${item.title}`}
                  onClick={() => void handleDeleteHistoryItem(item.dropId)}
                  className="rounded p-1 text-text-tertiary hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

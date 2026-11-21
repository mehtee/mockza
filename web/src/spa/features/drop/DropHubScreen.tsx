import { Link, useNavigate } from '@tanstack/react-router';
import { FileText, Headphones, Image as ImageIcon, Link2, Sparkles, Upload } from 'lucide-react';
import { useEffect, useState, type ClipboardEvent } from 'react';
import { MzCard } from '@/components/ui';
import { LtrExamBoundary } from '@/edition/bidi/LtrExamBoundary';
import type { DroppedContentItem } from '@/gateways/linguistic.gateway';
import { useDeps } from '@/spa/deps';
import {
  DROP_MAX_AUDIO_SECONDS,
  DROP_MAX_IMAGES,
  validateDropTextSnippet,
  validateDropUrlPreFlight,
  type SupportedExamId,
} from '@mockza/domain';

type DropTabMode = 'url' | 'text' | 'image' | 'audio';

async function downscaleImageFileToPngOrWebp(file: File): Promise<{
  bytes: Uint8Array;
  contentType: 'image/png' | 'image/jpeg' | 'image/webp';
  name: string;
}> {
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
          return { bytes: new Uint8Array(buf), contentType: 'image/webp', name: file.name };
        }
      }
    } catch {
      // Fallback to raw bytes if bitmap decoding unavailable in headless runtime
    }
  }
  const arr = await file.arrayBuffer();
  const mime =
    file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
  return { bytes: new Uint8Array(arr), contentType: mime, name: file.name };
}

export function DropHubScreen() {
  const deps = useDeps();
  const navigate = useNavigate();
  const isRtl = deps.edition === 'irn';
  const [tab, setTab] = useState<DropTabMode>('url');
  const [examTrack, setExamTrack] = useState<SupportedExamId>('ielts_academic');
  const [sourceUrl, setSourceUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [queuedImages, setQueuedImages] = useState<
    Array<{ bytes: Uint8Array; contentType: 'image/png' | 'image/jpeg' | 'image/webp'; name: string }>
  >([]);
  const [audioFile, setAudioFile] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const [history, setHistory] = useState<readonly DroppedContentItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void deps.attemptStore.getUserProfile().then((res) => {
      if (res.ok && res.value) setExamTrack(res.value.examId);
    });
    void deps.linguistic.getDropHistory().then((res) => {
      if (res.ok) setHistory(res.value.items);
    });
  }, [deps]);

  const handlePaste = async (e: ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file && queuedImages.length < DROP_MAX_IMAGES) {
          const scaled = await downscaleImageFileToPngOrWebp(file);
          setQueuedImages((prev) => [...prev, scaled].slice(0, DROP_MAX_IMAGES));
          setTab('image');
        }
      }
    }
  };

  const pollDropAndNavigate = async (jobId: string) => {
    for (let i = 0; i < 20; i += 1) {
      const poll = await deps.linguistic.pollAdvancedJob<DroppedContentItem>(jobId);
      if (!poll.ok) {
        setError(poll.error.message);
        setSubmitting(false);
        return;
      }
      if (poll.value.status === 'completed' && poll.value.result?.dropId) {
        setSubmitting(false);
        void navigate({
          to: '/drop/drill/$dropId',
          params: { dropId: poll.value.result.dropId },
        });
        return;
      }
      if (poll.value.status === 'failed') {
        setError(
          isRtl
            ? 'این لینک در دسترس نبود؛ متن را پیست کنید یا اسکرین‌شات بفرستید.'
            : 'Could not extract that source. Paste a clean text excerpt or upload a screenshot instead.',
        );
        setSubmitting(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    setSubmitting(false);
  };

  const handleIngest = async () => {
    setError(null);
    if (tab === 'url') {
      const check = validateDropUrlPreFlight(sourceUrl, { allowHttpInDev: true });
      if (!check.ok) {
        setError(
          isRtl
            ? `لینک مسدود یا پشتیبانی‌نشده است (${check.reason ?? 'ویدئو/داخلی'}). لطفاً لینک مقاله، متن یا اسکرین‌شات ارسال کنید.`
            : check.reason ?? 'Unsupported URL. Share an article URL, text excerpt, or screenshot.',
        );
        return;
      }
      setSubmitting(true);
      const res = await deps.linguistic.ingestDrop({
        inputKind: 'text_url',
        sourceUrl: sourceUrl.trim(),
        examTrack,
      });
      if (!res.ok) {
        setError(res.error.message);
        setSubmitting(false);
        return;
      }
      await pollDropAndNavigate(res.value.jobId);
      return;
    }

    if (tab === 'text') {
      const tCheck = validateDropTextSnippet(rawText);
      if (!tCheck.ok) {
        setError(tCheck.reason ?? 'Text must be 40..15,000 characters.');
        return;
      }
      setSubmitting(true);
      const res = await deps.linguistic.ingestDrop({
        inputKind: 'text',
        rawText: rawText.trim(),
        examTrack,
      });
      if (!res.ok) {
        setError(res.error.message);
        setSubmitting(false);
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
      const dropId = crypto.randomUUID();
      const keys: string[] = [];
      for (let i = 0; i < queuedImages.length; i += 1) {
        const up = await deps.linguistic.uploadDropMediaFile({
          dropId,
          mediaKind: 'image',
          index: i,
          bytes: queuedImages[i]!.bytes,
          contentType: queuedImages[i]!.contentType,
        });
        if (!up.ok) {
          setError(up.error.message);
          setSubmitting(false);
          return;
        }
        keys.push(up.value.objectKey);
      }
      const res = await deps.linguistic.ingestDrop({
        inputKind: 'image',
        imageObjectKeys: keys,
        examTrack,
      });
      if (!res.ok) {
        setError(res.error.message);
        setSubmitting(false);
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
    const dropId = crypto.randomUUID();
    const up = await deps.linguistic.uploadDropMediaFile({
      dropId,
      mediaKind: 'audio',
      index: 0,
      bytes: audioFile.bytes,
      contentType: 'audio/mp4',
    });
    if (!up.ok) {
      setError(up.error.message);
      setSubmitting(false);
      return;
    }
    const res = await deps.linguistic.ingestDrop({
      inputKind: 'audio',
      audioObjectKey: up.value.objectKey,
      durationSeconds: DROP_MAX_AUDIO_SECONDS,
      examTrack,
    });
    if (!res.ok) {
      setError(res.error.message);
      setSubmitting(false);
      return;
    }
    await pollDropAndNavigate(res.value.jobId);
  };

  return (
    <div
      data-testid="drop-hub-screen"
      onPaste={(e) => void handlePaste(e)}
      className="mx-auto flex max-w-5xl flex-col gap-6 pb-10 text-start"
    >
      <header className="border-b border-border-subtle pb-4">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {isRtl ? 'ورود هر محتوایی (Drop Anything)' : 'Drop Anything · Personal Immersion to 2-Min Drill'}
        </p>
        <h1 className="font-editorial mt-1 text-3xl text-text-primary">
          {isRtl
            ? 'از مقاله، صفحه کتاب یا اسکرین‌شات دلخواهت میکرودریل بساز'
            : 'Turn Any Article, Excerpt, or Screenshot Into a 2-Min Drill'}
        </h1>
        {isRtl ? (
          <p className="mt-1 text-xs text-text-secondary">
            بدون نیاز به فیلترشکن: لینک‌ها روی سرور سنجیا خوانده می‌شوند و برای لینک‌های محدود شده می‌توانید مستقیم متن یا اسکرین‌شات را پیست کنید.
          </p>
        ) : null}
      </header>

      <MzCard variant="hero">
        <div role="tablist" className="flex flex-wrap gap-2">
          {(
            [
              { id: 'url', labelEn: 'Article URL', labelFa: 'لینک مقاله', Icon: Link2 },
              { id: 'text', labelEn: 'Paste Text', labelFa: 'چسباندن متن', Icon: FileText },
              { id: 'image', labelEn: 'Screenshot / Image', labelFa: 'اسکرین‌شات / عکس', Icon: ImageIcon },
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
              className={`inline-flex items-center gap-1.5 rounded-[var(--mz-radius-compact)] border px-3 py-2 text-xs font-semibold ${
                tab === item.id
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-border-subtle bg-bg-raised text-text-secondary hover:bg-surface-hover'
              }`}
            >
              <item.Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isRtl ? item.labelFa : item.labelEn}</span>
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
            <textarea
              dir="ltr"
              rows={5}
              data-testid="drop-text-input"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste any English article paragraph, podcast transcript, or book excerpt (40..15,000 chars)..."
              className="w-full rounded-[var(--mz-radius-compact)] border border-border-subtle bg-bg-surface p-3 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
          ) : null}

          {tab === 'image' ? (
            <div className="rounded-[var(--mz-radius-compact)] border border-dashed border-border-strong bg-bg-raised p-4 text-xs text-text-secondary">
              <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-primary">
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>
                  {isRtl
                    ? 'انتخاب یا پیست (Ctrl+V) حداکثر ۴ تصویر (زیر ۵ مگابایت)'
                    : 'Choose or Paste (Ctrl+V) up to 4 PNG/JPEG/WebP screenshots'}
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []).slice(0, DROP_MAX_IMAGES);
                    const scaled = await Promise.all(files.map(downscaleImageFileToPngOrWebp));
                    setQueuedImages(scaled);
                  }}
                />
              </label>
              {queuedImages.length > 0 ? (
                <p className="mt-2 font-mono text-text-primary">
                  {queuedImages.map((img) => img.name).join(', ')}
                </p>
              ) : null}
            </div>
          ) : null}

          {tab === 'audio' ? (
            <div className="rounded-[var(--mz-radius-compact)] border border-dashed border-border-strong bg-bg-raised p-4 text-xs text-text-secondary">
              <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-primary">
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>
                  {isRtl
                    ? 'انتخاب فایل صوتی کوتاه (.m4a / .mp3، حداکثر ۳ دقیقه)'
                    : 'Choose short voice memo or clip (.m4a / .mp3 / .wav, <= 180s)'}
                </span>
                <input
                  type="file"
                  accept="audio/mp4,audio/mpeg,audio/wav,audio/ogg"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const arr = await f.arrayBuffer();
                      setAudioFile({ bytes: new Uint8Array(arr), name: f.name });
                    }
                  }}
                />
              </label>
              {audioFile ? <p className="mt-2 font-mono text-text-primary">{audioFile.name}</p> : null}
            </div>
          ) : null}
        </div>

        {error ? (
          <p data-testid="drop-error-banner" className="mt-3 text-xs font-medium text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            data-testid="drop-ingest-btn"
            disabled={submitting}
            onClick={() => void handleIngest()}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--mz-radius-compact)] bg-primary px-5 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>
              {submitting
                ? isRtl
                  ? 'در حال استخراج اصطلاحات و ساخت تمرین...'
                  : 'Extracting Phrases & Building Drill...'
                : isRtl
                  ? 'ساخت میکرودریل ۲ دقیقه‌ای'
                  : 'Generate 2-Min Micro-Drill'}
            </span>
          </button>
        </div>
      </MzCard>

      {history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">
            {isRtl ? 'آرشیو شخصی محتوای ارسالی شما' : 'Your Recent Dropped Materials'}
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {history.map((item) => (
              <Link
                key={item.dropId}
                to="/drop/drill/$dropId"
                params={{ dropId: item.dropId }}
                className="rounded-[var(--mz-radius-card)] border border-border-subtle bg-bg-surface p-4 hover:bg-surface-hover"
              >
                <div className="flex items-center justify-between gap-2 text-[11px] text-text-secondary">
                  <span>{item.sourceDomainOrLabel}</span>
                  <LtrExamBoundary className="font-mono font-semibold text-primary">
                    {item.cefrEstimate}
                  </LtrExamBoundary>
                </div>
                <LtrExamBoundary className="mt-1 block font-semibold text-text-primary">
                  {item.title}
                </LtrExamBoundary>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

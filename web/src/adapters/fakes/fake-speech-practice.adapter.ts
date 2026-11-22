import {
  AnalyzePronunciationRequestSchema,
  TtsSynthesizeRequestSchema,
} from '@mockza/contracts';
import type { RecordedClip } from '@/gateways/audio.gateway';
import { err, ok, type Result } from '@/gateways/result';
import type {
  ISpeechPracticeGateway,
  PronunciationHistoryDto,
  PronunciationPracticeItemDto,
  SpeechPracticeGatewayError,
  TtsSynthesizeInput,
  TtsSynthesizeResult,
} from '@/gateways/speech-practice.gateway';

// Tiny 44-byte valid silent WAV data URI for isolated unit tests & Playwright fakes
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export class FakeSpeechPracticeAdapter implements ISpeechPracticeGateway {
  private readonly history: PronunciationPracticeItemDto[] = [];

  async synthesizeTts(
    input: TtsSynthesizeInput,
  ): Promise<Result<{ readonly audioUrl: string; readonly meta: TtsSynthesizeResult }, SpeechPracticeGatewayError>> {
    const parsed = TtsSynthesizeRequestSchema.safeParse(input);
    if (!parsed.success) {
      return err({ kind: 'validation', message: parsed.error.message });
    }
    return ok({
      audioUrl: SILENT_WAV_DATA_URI,
      meta: {
        cacheKey: `fake-${parsed.data.text.length}`,
        audioUrl: SILENT_WAV_DATA_URI,
        cached: true,
        modelUsed: 'hexgrad/kokoro-82m',
        voice: parsed.data.voice ?? 'af_bella',
        format: 'mp3',
      },
    });
  }

  async submitPronunciationPractice(params: {
    readonly targetText: string;
    readonly practiceKind: 'word' | 'sentence' | 'reading_excerpt' | 'feedback_shadow';
    readonly sourceRefType?:
      | 'vocab_card'
      | 'reading_passage'
      | 'listening_feedback'
      | 'writing_feedback'
      | 'speaking_feedback'
      | 'coach'
      | 'custom';
    readonly sourceRefId?: string;
    readonly examTrack: string;
    readonly clip: RecordedClip;
  }): Promise<Result<PronunciationPracticeItemDto, SpeechPracticeGatewayError>> {
    const objectKey = `users/fake/pronunciation/${this.history.length + 1}/take.m4a`;
    const parsed = AnalyzePronunciationRequestSchema.safeParse({
      targetText: params.targetText,
      practiceKind: params.practiceKind,
      sourceRefType: params.sourceRefType,
      sourceRefId: params.sourceRefId,
      examTrack: params.examTrack,
      objectKey,
      durationMs: params.clip.durationMs,
    });
    if (!parsed.success) {
      return err({ kind: 'validation', message: parsed.error.message });
    }
    const words = params.targetText.trim().split(/\s+/).filter(Boolean).slice(0, 12);
    const item: PronunciationPracticeItemDto = {
      practiceId: `30000000-0000-4000-8000-${String(this.history.length + 1).padStart(12, '0')}`,
      targetText: params.targetText,
      practiceKind: params.practiceKind,
      sourceRefType: params.sourceRefType ?? null,
      sourceRefId: params.sourceRefId ?? null,
      objectKey,
      audioPlayUrl: SILENT_WAV_DATA_URI,
      referenceTtsUrl: SILENT_WAV_DATA_URI,
      transcript: params.targetText,
      accuracyScore: 86,
      fluencyScore: 84,
      intonationScore: 82,
      stressScore: 80,
      overallScore: 84,
      bandImpactLabel: 'Band 7.5+ Pronunciation Clarity',
      summaryEn: 'Clean syllable stress and clear consonant articulation.',
      summaryFa: 'وضوح واژگان و تکیه هجاها بسیار خوب و روان بود.',
      mouthTipEn: 'Hold the stressed vowel slightly firmer and release final consonants cleanly.',
      mouthTipFa: 'روی هجای تکیه‌دار کمی واضح‌تر بمانید و صامت پایانی را کامل تلفظ کنید.',
      actionableRetryEn: 'Listen once at 0.85x and record a second smooth take.',
      actionableRetryFa: 'یک بار با سرعت ۰.۸۵ گوش دهید و یک ضبط پیوسته دیگر انجام دهید.',
      wordsFeedback: words.map((w, idx) => ({
        word: w.replace(/[.,!?;:"'()]/g, '') || w,
        status: idx === 0 ? 'accurate' : 'needs_work',
        ipaTarget: '/ˈsɑːmpəl/',
        ipaObserved: '/ˈsɑːmpəl/',
        issueType: idx === 0 ? 'none' : 'stress',
        tipEn: idx === 0 ? 'Clear articulation.' : 'Lift primary syllable stress slightly.',
        tipFa: idx === 0 ? 'تلفظ شفاف و دقیق.' : 'تکیه هجای اصلی را کمی پررنگ‌تر ادا کنید.',
      })),
      status: 'completed',
      modelUsed: 'google/gemini-3.1-flash-lite',
      estimatedCostUsdMicros: 82,
      createdAt: new Date().toISOString(),
    };
    this.history.unshift(item);
    return ok(item);
  }

  async listPronunciationHistory(params?: {
    readonly sourceRefId?: string;
    readonly limit?: number;
    readonly cursor?: string;
  }): Promise<Result<PronunciationHistoryDto, SpeechPracticeGatewayError>> {
    const filtered = params?.sourceRefId
      ? this.history.filter((h) => h.sourceRefId === params.sourceRefId)
      : this.history;
    const limit = params?.limit ?? 30;
    const items = filtered.slice(0, limit);
    const nextCursor = filtered.length > limit && items.length > 0 ? items[items.length - 1]!.createdAt : null;
    return ok({
      items,
      nextCursor,
      remainingDailyQuota: 20,
      dailyQuotaLimit: 20,
    });
  }

  async resolveAuthenticatedAudioUrl(
    relativeAudioPath: string,
  ): Promise<Result<string, SpeechPracticeGatewayError>> {
    return ok(relativeAudioPath || SILENT_WAV_DATA_URI);
  }
}

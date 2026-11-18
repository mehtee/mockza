import type { EditionCode } from '@/edition/edition-config';
import type { RecordedClip } from '@/gateways/audio.gateway';
import type {
  EvaluateSpeakingInput,
  EvaluateWritingInput,
  EvaluationGatewayError,
  ExplainQuestionInput,
  ExplainQuestionResponse,
  IEvaluationGateway,
  JobEnqueueResponse,
  JobStatusResponse,
  QuotaStatusSnapshot,
} from '@/gateways/evaluation.gateway';
import { ok, type Result } from '@/gateways/result';
import type { EvaluationOutputDto } from '@/gateways/storage.gateway';
import type { IClock } from '@/gateways/telemetry.gateway';
import { FakeClock } from './fake-clock';

export class FakeEvaluationAdapter implements IEvaluationGateway {
  private readonly clock: IClock;
  private readonly edition: EditionCode;
  private readonly jobs = new Map<string, JobStatusResponse>();
  private quotaOverride: Partial<QuotaStatusSnapshot> | null = null;
  private nextCounter = 1;

  constructor(options: { readonly clock?: IClock; readonly edition?: EditionCode } = {}) {
    this.clock = options.clock ?? new FakeClock();
    this.edition = options.edition ?? 'glb';
  }

  setQuotaOverride(override: Partial<QuotaStatusSnapshot> | null): void {
    this.quotaOverride = override;
  }

  async getQuotaStatus(): Promise<Result<QuotaStatusSnapshot, EvaluationGatewayError>> {
    const nowIso = this.clock.nowIso();
    return ok({
      isPro: true,
      activePlanId: 'mockza_pro_monthly',
      expiresAt: null,
      source: 'dev_sandbox',
      freeDiagnosticUsed: true,
      dailySpeakingUsed: 0,
      dailySpeakingLimit: 10,
      dailyWritingUsed: 0,
      dailyWritingLimit: 10,
      monthlyUsed: 0,
      monthlyLimit: 150,
      dailyResetAt: nowIso,
      monthlyResetAt: nowIso,
      ...this.quotaOverride,
    });
  }

  async submitWritingEvaluation(
    input: EvaluateWritingInput,
  ): Promise<Result<JobEnqueueResponse, EvaluationGatewayError>> {
    const jobId = `00000000-0000-4000-8000-${String(this.nextCounter++).padStart(12, '0')}`;
    const nowIso = this.clock.nowIso();
    const isIrn = (input.edition ?? this.edition) === 'irn';
    const sampleQuote = input.essayText.slice(0, Math.min(28, input.essayText.length));

    const output: EvaluationOutputDto = {
      attemptId: input.attemptId,
      overallBand: 7.0,
      isEstimated: true,
      criteria: [
        {
          code: 'TR',
          label: 'Task Response',
          band: 7.0,
          evidenceExcerpt: sampleQuote,
          feedbackNote: isIrn
            ? 'پاسخ اصلی به‌خوبی پوشش داده شده است؛ توسعه مثال‌ها نمره را به ۷.۵ می‌رساند.'
            : 'Addresses all parts cleanly; deeper concrete support elevates TR to 7.5+.',
        },
        {
          code: 'CC',
          label: 'Coherence & Cohesion',
          band: 7.0,
          evidenceExcerpt: sampleQuote,
          feedbackNote: 'Logical paragraph progression with clear topic sentences.',
        },
        {
          code: 'LR',
          label: 'Lexical Resource',
          band: 7.0,
          evidenceExcerpt: sampleQuote,
          feedbackNote: 'Appropriate academic register with minor collocation upgrades.',
        },
        {
          code: 'GRA',
          label: 'Grammatical Range & Accuracy',
          band: 7.0,
          evidenceExcerpt: sampleQuote,
          feedbackNote: 'Controlled complex clause structures with rare punctuation slips.',
        },
      ],
      inlineEdits:
        sampleQuote.length >= 4
          ? [
              {
                editId: 'edit-1',
                startOffset: 0,
                endOffset: Math.min(sampleQuote.length, 16),
                originalText: input.essayText.slice(0, Math.min(sampleQuote.length, 16)),
                suggestedText: 'Significantly, modern practice',
                criterionCode: 'LR',
                rationale: isIrn
                  ? 'استفاده از قید دانشگاهی باعث ارتقای نمره Lexical Resource می‌شود.'
                  : 'Using an academic stance adverb strengthens Lexical Resource.',
              },
            ]
          : [],
      modelRewrite: {
        targetBandDelta: 1.5,
        title: 'Band 8.5 Academic Upgrade',
        rewrittenText: `${input.essayText.trim()} Furthermore, empirical evidence underscores measurable gains when structured policy complements local autonomy.`,
        preservedIdeasNote: isIrn
          ? 'ایده اصلی شما حفظ شده و صرفاً انسجام واژگانی ارتقا یافته است.'
          : 'Core arguments preserved with upgraded academic cohesion.',
      },
      vocabUpgrades: [
        {
          id: 'vu-1',
          term: 'mitigate',
          ipa: '/ˈmɪt.ɪ.ɡeɪt/',
          definition: 'Make less severe or painful',
          glossFa: isIrn ? 'کاهش دادن شدت یا اثر' : undefined,
          contextSentence: 'Targeted subsidies help mitigate transition costs.',
          paraphrases: ['alleviate', 'moderate'],
          bandRationale: 'Raises Lexical Resource precision in problem-solution essays.',
        },
      ],
      recommendedDrill: {
        drillType: 'collocation_upgrade',
        weakestCriterionCode: 'LR',
        title: 'Academic Collocation Upgrade',
        durationMinutes: 3,
      },
      actionableNextStep: isIrn
        ? 'ساختار کلی رایتینگ منسجم است؛ در پاراگراف دوم مثال عینی بیشتری اضافه کنید.'
        : 'Expand body paragraph comparisons and vary complex clause openers.',
      modelId: 'fake-evaluator-v1',
      rubricVersion: 'v1',
    };

    this.jobs.set(jobId, {
      jobId,
      attemptId: input.attemptId,
      status: 'completed',
      result: output,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    return ok({ jobId, status: 'queued' });
  }

  async uploadSpeakingTurnAudio(params: {
    readonly attemptId: string;
    readonly partIndex: number;
    readonly turnId?: string;
    readonly clip: RecordedClip;
  }): Promise<Result<{ readonly objectKey: string }, EvaluationGatewayError>> {
    const ext = params.clip.strippedContentType.includes('webm') ? 'webm' : 'm4a';
    return ok({
      objectKey: `audio/speaking/${params.attemptId}/part-${params.partIndex}.${ext}`,
    });
  }

  async submitSpeakingEvaluation(
    input: EvaluateSpeakingInput,
  ): Promise<Result<JobEnqueueResponse, EvaluationGatewayError>> {
    const jobId = `00000000-0000-4000-9000-${String(this.nextCounter++).padStart(12, '0')}`;
    const nowIso = this.clock.nowIso();
    const isIrn = (input.edition ?? this.edition) === 'irn';
    const turnText = input.turns[0]?.promptText ?? 'Speaking response sample';

    const output: EvaluationOutputDto = {
      attemptId: input.attemptId,
      overallBand: 7.0,
      isEstimated: true,
      criteria: [
        {
          code: 'FC',
          label: 'Fluency & Coherence',
          band: 7.0,
          evidenceExcerpt: turnText,
          feedbackNote: isIrn
            ? 'روانی گفتار مناسب است؛ کاهش مکث‌های کوتاه نمره را بالاتر می‌برد.'
            : 'Steady speech flow with coherent topic development.',
        },
        {
          code: 'LR',
          label: 'Lexical Resource',
          band: 7.0,
          evidenceExcerpt: turnText,
          feedbackNote: 'Good idiomatic control across topics.',
        },
        {
          code: 'GRA',
          label: 'Grammatical Range & Accuracy',
          band: 7.0,
          evidenceExcerpt: turnText,
          feedbackNote: 'Accurate tense switching during follow-up reflection.',
        },
        {
          code: 'PR',
          label: 'Pronunciation',
          band: 7.0,
          evidenceExcerpt: turnText,
          feedbackNote: 'Clear syllable stress and intelligible intonation.',
        },
      ],
      transcriptSegments: [
        {
          segmentId: 'seg-1',
          partIndex: input.turns[0]?.partIndex ?? 1,
          startMs: 0,
          endMs: 4200,
          text: 'Well, in my neighborhood, public libraries serve as quiet community hubs.',
          annotations: [
            {
              type: 'phrasing',
              suggestion: 'serve as vibrant community hubs',
              rationale: 'More vivid adjective-noun collocation.',
            },
          ],
        },
      ],
      modelRewrite: {
        targetBandDelta: 1.5,
        title: 'Band 8.5 Spoken Phrasing Model',
        rewrittenText:
          'Public libraries in my district have evolved into vibrant learning hubs that bridge generations.',
        preservedIdeasNote: isIrn
          ? 'محتوای اصلی پاسخ حفظ شده و با اصطلاحات طبیعی‌تر بازنویسی شده است.'
          : 'Preserves original idea while upgrading idiomatic flow.',
      },
      vocabUpgrades: [
        {
          id: 'vu-sp-1',
          term: 'vibrant hub',
          definition: 'An energetic focal point of community activity',
          glossFa: isIrn ? 'کانون پویا و فعال' : undefined,
          contextSentence: 'Community libraries serve as vibrant hubs for students.',
          paraphrases: ['lively center', 'community nexus'],
          bandRationale: 'Natural native-like noun phrase boosts Lexical Resource.',
        },
      ],
      recommendedDrill: {
        drillType: 'discourse_connector',
        weakestCriterionCode: 'FC',
        title: 'Discourse Connector Flow',
        durationMinutes: 3,
      },
      actionableNextStep: isIrn
        ? 'ادای کلمات واضح و پیوستگی جملات خوب است؛ در Part 3 از جملات شرطی بیشتری استفاده کنید.'
        : 'Use wider hypothetical conditionals in Part 3.',
      modelId: 'fake-evaluator-v1',
      rubricVersion: 'v1',
    };

    this.jobs.set(jobId, {
      jobId,
      attemptId: input.attemptId,
      status: 'completed',
      result: output,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    return ok({ jobId, status: 'queued' });
  }

  async pollEvaluationJob(
    jobId: string,
  ): Promise<Result<JobStatusResponse, EvaluationGatewayError>> {
    const existing = this.jobs.get(jobId);
    if (existing) {
      return ok(existing);
    }
    const nowIso = this.clock.nowIso();
    return ok({
      jobId,
      attemptId: '00000000-0000-4000-8000-000000000001',
      status: 'queued',
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  async explainObjectiveQuestion(
    input: ExplainQuestionInput,
  ): Promise<Result<ExplainQuestionResponse, EvaluationGatewayError>> {
    const isIrn = (input.edition ?? this.edition) === 'irn';
    return ok({
      cached: false,
      explanation: isIrn
        ? 'پاسخ صحیح مستقیماً با شواهد متن هم‌خوانی دارد؛ سایر گزینه‌ها یا خارج از محدوده متن هستند یا معنای متضاد دارند.'
        : 'The credited key aligns directly with the exact passage/transcript evidence, whereas distractors either contradict scope or swap cause and effect.',
      evidenceQuote: `Evidence aligned for question ${input.questionId}`,
      whyWrongOptions: [
        {
          option: 'Distractor Option',
          reason: isIrn ? 'در متن به این جزئیات اشاره نشده است.' : 'Not supported by the passage scope.',
        },
      ],
    });
  }
}

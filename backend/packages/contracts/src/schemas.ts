import { z } from '@hono/zod-openapi';

export const ApiErrorCodeSchema = z.enum([
  'validation_error',
  'unauthorized',
  'attestation_required',
  'edition_forbidden',
  'edition_mismatch',
  'entitlement_required',
  'quota_exceeded',
  'attempt_conflict',
  'upload_not_found',
  'upload_too_large',
  'model_unavailable',
  'billing_unavailable',
  'provider_not_configured',
  'erasure_incomplete',
  'not_found',
  'internal_error',
]);

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z
  .object({
    code: ApiErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
  })
  .openapi('ApiError');

export const HealthResponseSchema = z
  .object({
    status: z.literal('ok'),
    edition: z.enum(['glb', 'irn']),
    service: z.string(),
  })
  .openapi('HealthResponse');

export const ReadyResponseSchema = z
  .object({
    status: z.literal('ready'),
    edition: z.enum(['glb', 'irn']),
    database: z.boolean(),
    storage: z.boolean(),
    queue: z.boolean().optional(),
    service: z.string(),
  })
  .openapi('ReadyResponse');

export const RetryEvaluationRequestSchema = z
  .object({
    attemptId: z.string().uuid(),
  })
  .openapi('RetryEvaluationRequest');

export const AnonymousAuthRequestSchema = z
  .object({
    deviceId: z.string().uuid(),
    appVersion: z.string().optional(),
    deviceSecret: z.string().min(16).max(256).optional(),
  })
  .openapi('AnonymousAuthRequest');

export const AnonymousAuthResponseSchema = z
  .object({
    accessToken: z.string(),
    deviceId: z.string().uuid(),
    expiresAt: z.string(),
    deviceSecret: z.string().min(16).max(256).optional(),
  })
  .openapi('AnonymousAuthResponse');

export const LinkAccountRequestSchema = z
  .object({
    provider: z.enum(['apple', 'google']),
    idToken: z.string().min(1),
  })
  .openapi('LinkAccountRequest');

export const LinkAccountResponseSchema = z
  .object({
    success: z.boolean(),
    userId: z.string().uuid(),
    accessToken: z.string(),
    expiresAt: z.string(),
  })
  .openapi('LinkAccountResponse');

export const PresignUploadRequestSchema = z
  .object({
    attemptId: z.string().uuid(),
    partIndex: z.number().int().min(1).max(3),
    turnId: z.string().min(1).max(64).optional(),
    byteLength: z
      .number()
      .int()
      .positive()
      .max(15 * 1024 * 1024),
    contentType: z.enum(['audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav']).default('audio/mp4'),
    sha256Base64: z.string().optional(),
  })
  .openapi('PresignUploadRequest');

export const PresignUploadResponseSchema = z
  .object({
    uploadUrl: z.string().min(1),
    objectKey: z.string(),
    expiresInSeconds: z.number().int().positive(),
  })
  .openapi('PresignUploadResponse');

export const EvaluateWritingRequestSchema = z
  .object({
    attemptId: z.string().uuid(),
    packId: z.string().min(1).max(120),
    examId: z.enum(['ielts_academic', 'ielts_general']).default('ielts_academic'),
    taskType: z.enum(['task1Academic', 'task1General', 'task2Essay']),
    promptTitle: z.string().default(''),
    promptBody: z.string().default(''),
    essayText: z.string().min(20).max(12000),
    durationSeconds: z.number().int().nonnegative().optional(),
    wordCount: z.number().int().nonnegative().optional(),
  })
  .openapi('EvaluateWritingRequest');

export const SpeakingTurnSchema = z
  .object({
    partIndex: z.number().int().min(1).max(3),
    turnId: z.string().min(1).max(64).optional(),
    promptText: z.string().default(''),
    objectKey: z.string().min(1),
    durationMs: z.number().int().nonnegative().optional(),
    byteLength: z.number().int().positive().optional(),
    sha256Base64: z.string().optional(),
  })
  .openapi('SpeakingTurn');

export const EvaluateSpeakingRequestSchema = z
  .object({
    attemptId: z.string().uuid(),
    packId: z.string().min(1).max(120),
    examId: z.enum(['ielts_academic', 'ielts_general']).default('ielts_academic'),
    partSequence: z.enum(['part1', 'part2', 'part3', 'full', 'diagnostic']).default('full'),
    turns: z.array(SpeakingTurnSchema).min(1).max(12),
    audioObjectKeys: z.array(z.string().min(1)).min(1).max(12).optional(),
  })
  .openapi('EvaluateSpeakingRequest');

export const JobEnqueueResponseSchema = z
  .object({
    jobId: z.string().uuid(),
    status: z.enum(['queued', 'processing_audio', 'evaluating', 'completed', 'failed']),
  })
  .openapi('JobEnqueueResponse');

export const CriterionEvaluationSchema = z
  .object({
    code: z.enum(['FC', 'LR', 'GRA', 'PR', 'TA', 'TR', 'CC']),
    label: z.string(),
    band: z.number().min(0).max(9),
    evidenceExcerpt: z.string(),
    feedbackNote: z.string(),
  })
  .openapi('CriterionEvaluation');

export const TranscriptAnnotationSchema = z
  .object({
    type: z.enum(['pause', 'filler', 'grammar', 'phrasing']),
    suggestion: z.string().optional(),
    rationale: z.string(),
  })
  .openapi('TranscriptAnnotation');

export const TranscriptSegmentSchema = z
  .object({
    segmentId: z.string(),
    partIndex: z.number().int().min(1).max(3),
    startMs: z.number().nonnegative(),
    endMs: z.number().nonnegative(),
    text: z.string(),
    annotations: z.array(TranscriptAnnotationSchema).default([]),
  })
  .openapi('TranscriptSegment');

export const InlineEditSchema = z
  .object({
    editId: z.string(),
    startOffset: z.number().int().nonnegative(),
    endOffset: z.number().int().nonnegative(),
    originalText: z.string(),
    suggestedText: z.string(),
    criterionCode: z.enum(['FC', 'LR', 'GRA', 'PR', 'TA', 'TR', 'CC']),
    rationale: z.string(),
  })
  .openapi('InlineEdit');

export const ModelRewriteSchema = z
  .object({
    targetBandDelta: z.number().default(1.5),
    title: z.string(),
    rewrittenText: z.string(),
    preservedIdeasNote: z.string(),
  })
  .openapi('ModelRewrite');

export const VocabUpgradeSchema = z
  .object({
    id: z.string(),
    term: z.string(),
    ipa: z.string().optional(),
    definition: z.string(),
    contextSentence: z.string(),
    paraphrases: z.array(z.string()).default([]),
    bandRationale: z.string(),
  })
  .openapi('VocabUpgrade');

export const RecommendedDrillSchema = z
  .object({
    drillType: z.string(),
    weakestCriterionCode: z.enum(['FC', 'LR', 'GRA', 'PR', 'TA', 'TR', 'CC']),
    title: z.string(),
    durationMinutes: z.number().default(3),
  })
  .openapi('RecommendedDrill');

export const EvaluationOutputSchema = z
  .object({
    attemptId: z.string().uuid(),
    overallBand: z.number().min(0).max(9),
    isEstimated: z.literal(true).default(true),
    criteria: z.array(CriterionEvaluationSchema).length(4),
    transcriptSegments: z.array(TranscriptSegmentSchema).optional(),
    inlineEdits: z.array(InlineEditSchema).optional(),
    modelRewrite: ModelRewriteSchema.optional(),
    vocabUpgrades: z.array(VocabUpgradeSchema).default([]),
    recommendedDrill: RecommendedDrillSchema.optional(),
    actionableNextStep: z.string().optional(),
    modelId: z.string(),
    rubricVersion: z.string(),
  })
  .openapi('EvaluationOutput');

export const ExplainQuestionRequestSchema = z
  .object({
    packId: z.string(),
    packVersion: z.string(),
    questionId: z.string(),
    skill: z.enum(['reading', 'listening']),
    questionType: z.string(),
    userAnswer: z.string(),
  })
  .openapi('ExplainQuestionRequest');

export const WhyWrongOptionSchema = z
  .object({
    option: z.string(),
    reason: z.string(),
  })
  .openapi('WhyWrongOption');

export const ExplainQuestionResponseSchema = z
  .object({
    cached: z.boolean(),
    explanation: z.string(),
    evidenceQuote: z.string().optional(),
    whyWrongOptions: z.array(WhyWrongOptionSchema).default([]),
  })
  .openapi('ExplainQuestionResponse');

export const JobStatusResponseSchema = z
  .object({
    jobId: z.string().uuid(),
    attemptId: z.string().uuid(),
    status: z.enum([
      'queued',
      'processing_audio',
      'transcoding',
      'evaluating',
      'repairing',
      'completed',
      'failed',
    ]),
    stage: z.string().optional(),
    result: EvaluationOutputSchema.optional(),
    errorCode: z.string().optional(),
    quotaRefunded: z.boolean().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('JobStatusResponse');

export const QuotaStatusResponseSchema = z
  .object({
    isPro: z.boolean(),
    freeDiagnosticUsed: z.boolean(),
    dailySpeakingUsed: z.number().int().nonnegative(),
    dailySpeakingLimit: z.number().int().nonnegative(),
    dailyWritingUsed: z.number().int().nonnegative(),
    dailyWritingLimit: z.number().int().nonnegative(),
    monthlyUsed: z.number().int().nonnegative(),
    monthlyLimit: z.number().int().nonnegative(),
    dailyResetAt: z.string(),
    monthlyResetAt: z.string(),
  })
  .openapi('QuotaStatusResponse');

export const CatalogPackSummarySchema = z
  .object({
    packId: z.string(),
    edition: z.enum(['glb', 'irn']),
    examId: z.string(),
    skill: z.string(),
    track: z.enum(['academic', 'general']).default('academic'),
    title: z.string().default(''),
    description: z.string().default(''),
    durationSeconds: z.number().int().nonnegative().default(0),
    questionCount: z.number().int().nonnegative().default(0),
    accent: z.string().nullable().optional(),
    mediaUrl: z.string().nullable().optional(),
    version: z.string(),
    sha256: z.string(),
    byteLength: z.number().int(),
    downloadUrl: z.string().min(1),
    contentOrigin: z
      .enum(['authored_original', 'cc_by_sa_adapted', 'open_corpus'])
      .default('authored_original'),
    humanQaReviewed: z.boolean().default(true),
    isFreeSample: z.boolean(),
  })
  .openapi('CatalogPackSummary');

export const TranscriptLineSchema = z
  .object({
    speaker: z.string(),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    text: z.string(),
  })
  .openapi('TranscriptLine');

export const ExamSectionSchema = z
  .object({
    sectionId: z.string(),
    sectionIndex: z.number().int().positive(),
    sectionType: z.string(),
    title: z.string(),
    instructions: z.string(),
    contentText: z.string(),
    paragraphs: z.record(z.string(), z.string()).nullable().optional(),
    transcript: z.array(TranscriptLineSchema).nullable().optional(),
    mediaUrl: z.string().nullable().optional(),
    durationSeconds: z.number().int().nonnegative(),
    wordCount: z.number().int().nonnegative(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .openapi('ExamSection');

export const ExamQuestionSchema = z
  .object({
    questionId: z.string(),
    sectionId: z.string(),
    questionNumber: z.number().int().positive(),
    questionType: z.string(),
    prompt: z.string(),
    options: z.array(z.string()).nullable().optional(),
    acceptedAnswers: z.array(z.string()),
    maxWords: z.number().int().positive().nullable().optional(),
    evidence: z.record(z.string(), z.unknown()).nullable().optional(),
    cueTimestampMs: z.number().int().nonnegative().nullable().optional(),
  })
  .openapi('ExamQuestion');

export const ExamBundleResponseSchema = z
  .object({
    pack: CatalogPackSummarySchema,
    sections: z.array(ExamSectionSchema),
    questions: z.array(ExamQuestionSchema),
  })
  .openapi('ExamBundleResponse');

export const MicroDrillItemSchema = z
  .object({
    id: z.string(),
    prompt: z.string(),
    options: z.array(z.string()).default([]),
    answer: z.string(),
    explanation: z.string().default(''),
  })
  .openapi('MicroDrillItem');

export const MicroDrillSchema = z
  .object({
    drillId: z.string(),
    title: z.string(),
    drillType: z.string(),
    skill: z.string(),
    durationSeconds: z.number().int().positive(),
    items: z.array(MicroDrillItemSchema),
  })
  .openapi('MicroDrill');

export const MicroDrillsResponseSchema = z
  .object({
    drills: z.array(MicroDrillSchema),
  })
  .openapi('MicroDrillsResponse');

export const VocabDeckCardSchema = z
  .object({
    cardId: z.string(),
    headword: z.string(),
    ipa: z.string(),
    definition: z.string(),
    topicTag: z.string(),
    contextSentence: z.string(),
    paraphrases: z.array(z.string()),
    collocations: z.array(z.string()),
    easeFactorMilli: z.number().int().positive(),
  })
  .openapi('VocabDeckCard');

export const VocabDeckResponseSchema = z
  .object({
    totalCount: z.number().int().nonnegative(),
    cards: z.array(VocabDeckCardSchema),
  })
  .openapi('VocabDeckResponse');

export const CatalogManifestResponseSchema = z
  .object({
    edition: z.enum(['glb', 'irn']),
    generatedAt: z.string(),
    packs: z.array(CatalogPackSummarySchema),
  })
  .openapi('CatalogManifestResponse');

export const FlagQuestionRequestSchema = z
  .object({
    questionId: z.string(),
    packId: z.string(),
    reason: z.string().min(1).max(500),
    note: z.string().max(1000).optional(),
  })
  .openapi('FlagQuestionRequest');

export const FlagQuestionResponseSchema = z
  .object({
    success: z.literal(true),
    flagId: z.string().uuid(),
  })
  .openapi('FlagQuestionResponse');

export const TelemetryEventSchema = z
  .object({
    eventName: z.string().min(1).max(100),
    properties: z.record(z.string(), z.unknown()).optional(),
    timestamp: z.string().optional(),
  })
  .openapi('TelemetryEvent');

export const TelemetryBatchRequestSchema = z
  .object({
    events: z.array(TelemetryEventSchema).min(1).max(100),
  })
  .openapi('TelemetryBatchRequest');

export const TelemetryBatchResponseSchema = z
  .object({
    acceptedCount: z.number().int().nonnegative(),
  })
  .openapi('TelemetryBatchResponse');

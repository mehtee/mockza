import { z } from '@hono/zod-openapi';

export const SupportedExamIdSchema = z
  .enum(['ielts_academic', 'ielts_general', 'toefl_ibt', 'pte_academic', 'det'])
  .openapi('SupportedExamId');

export type SupportedExamIdDto = z.infer<typeof SupportedExamIdSchema>;

export const WritingTaskTypeSchema = z
  .enum([
    'task1Academic',
    'task1General',
    'task2Essay',
    'toeflSentenceBuild',
    'toeflEmail',
    'toeflAcademicDiscussion',
    'pteSummarizeWrittenText',
    'pteEssay',
    'detWriteAboutPhoto',
    'detInteractiveWriting',
    'detWritingSample',
  ])
  .openapi('WritingTaskType');

export const CriterionCodeSchema = z
  .enum([
    'FC',
    'LR',
    'GRA',
    'PR',
    'TA',
    'TR',
    'CC',
    'CONTENT',
    'ORG',
    'VOCAB',
    'GRAM',
    'MECH',
    'DELIVERY',
    'COH',
  ])
  .openapi('CriterionCode');

export const CatalogTrackSchema = z
  .enum(['academic', 'general', 'toefl', 'pte', 'det'])
  .openapi('CatalogTrack');

export const ApiErrorCodeSchema = z.enum([
  'validation_error',
  'unauthorized',
  'attestation_required',
  'edition_forbidden',
  'edition_mismatch',
  'entitlement_required',
  'quota_exceeded',
  'attempt_conflict',
  'device_slot_limit_reached',
  'invalid_credentials',
  'email_already_registered',
  'upload_not_found',
  'upload_too_large',
  'model_unavailable',
  'billing_unavailable',
  'provider_not_configured',
  'erasure_incomplete',
  'feature_disabled',
  'UNSUPPORTED_DROP_SOURCE',
  'SSRF_BLOCKED_HOST',
  'INVALID_DROP_URL',
  'INVALID_DROP_TEXT',
  'INVALID_DROP_IMAGE',
  'DROP_AUDIO_TOO_LONG',
  'not_found',
  'internal_error',
]);

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z
  .object({
    code: ApiErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
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

export const DeviceSlotKindSchema = z.enum(['mobile', 'desktop_web']).openapi('DeviceSlotKind');

export const DevicePlatformSchema = z
  .enum(['ios', 'android', 'web_mobile', 'web_desktop', 'unknown'])
  .openapi('DevicePlatform');

export const AppSurfaceSchema = z
  .enum(['flutter_app', 'flutter_web', 'web_app'])
  .openapi('AppSurface');

export const DeviceClientMetaSchema = z
  .object({
    slotKind: DeviceSlotKindSchema.optional(),
    platform: DevicePlatformSchema.optional(),
    appSurface: AppSurfaceSchema.optional(),
    deviceName: z.string().min(1).max(120).optional(),
    timezone: z.string().min(1).max(80).optional(),
  })
  .openapi('DeviceClientMeta');

export const SocialProviderDescriptorSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['oidc', 'dev_sandbox', 'disabled']),
  clientId: z.string().optional(),
});

export const SmsOtpProviderDescriptorSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['kavenegar', 'dev_sandbox', 'disabled']),
});

export const DevicePolicySummarySchema = z.object({
  maxMobilePhones: z.number().int().positive().default(1),
  maxDesktopWebInstances: z.number().int().positive().default(1),
});

export const AuthMethodSchema = z.enum(['email', 'google', 'apple', 'sms_otp']);

export const AuthProvidersResponseSchema = z
  .object({
    emailPasswordEnabled: z.boolean(),
    google: SocialProviderDescriptorSchema,
    apple: SocialProviderDescriptorSchema,
    smsOtp: SmsOtpProviderDescriptorSchema.optional(),
    devicePolicy: DevicePolicySummarySchema,
  })
  .openapi('AuthProvidersResponse');

export const AnonymousAuthRequestSchema = z
  .object({
    deviceId: z.string().uuid(),
    appVersion: z.string().optional(),
    deviceSecret: z.string().min(16).max(256).optional(),
    deviceMeta: DeviceClientMetaSchema.optional(),
  })
  .openapi('AnonymousAuthRequest');

export const AnonymousAuthResponseSchema = z
  .object({
    accessToken: z.string(),
    deviceId: z.string().uuid(),
    expiresAt: z.string(),
    deviceSecret: z.string().min(16).max(256).optional(),
    linkedUserId: z.string().uuid().nullable().optional(),
    linkedEmail: z.string().nullable().optional(),
  })
  .openapi('AnonymousAuthResponse');

export const EmailRegisterRequestSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(128),
    displayName: z.string().trim().min(1).max(100).optional(),
    deviceId: z.string().uuid(),
    deviceSecret: z.string().min(16).max(256).optional(),
    appVersion: z.string().optional(),
    deviceMeta: DeviceClientMetaSchema.optional(),
    replaceSessionId: z.string().uuid().optional(),
  })
  .openapi('EmailRegisterRequest');

export const EmailLoginRequestSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(128),
    deviceId: z.string().uuid(),
    deviceSecret: z.string().min(16).max(256).optional(),
    appVersion: z.string().optional(),
    deviceMeta: DeviceClientMetaSchema.optional(),
    replaceSessionId: z.string().uuid().optional(),
  })
  .openapi('EmailLoginRequest');

export const OAuthSignInRequestSchema = z
  .object({
    provider: z.enum(['google', 'apple']),
    idToken: z.string().min(1),
    displayName: z.string().trim().min(1).max(100).optional(),
    deviceId: z.string().uuid(),
    deviceSecret: z.string().min(16).max(256).optional(),
    appVersion: z.string().optional(),
    deviceMeta: DeviceClientMetaSchema.optional(),
    replaceSessionId: z.string().uuid().optional(),
  })
  .openapi('OAuthSignInRequest');

export const OtpRequestSchema = z
  .object({
    phoneE164: z
      .string()
      .trim()
      .regex(/^\+989\d{9}$/),
  })
  .openapi('OtpRequest');

export const OtpRequestResponseSchema = z
  .object({
    retryAfterSec: z.number().int().nonnegative(),
    devOtpHint: z.string().optional(),
  })
  .openapi('OtpRequestResponse');

export const OtpVerifyRequestSchema = z
  .object({
    phoneE164: z
      .string()
      .trim()
      .regex(/^\+989\d{9}$/),
    otpCode: z
      .string()
      .trim()
      .regex(/^\d{4,8}$/),
    displayName: z.string().trim().min(1).max(100).optional(),
    deviceId: z.string().uuid(),
    deviceSecret: z.string().min(16).max(256).optional(),
    appVersion: z.string().optional(),
    deviceMeta: DeviceClientMetaSchema.optional(),
    replaceSessionId: z.string().uuid().optional(),
  })
  .openapi('OtpVerifyRequest');

export const AccountUserSchema = z
  .object({
    userId: z.string().uuid(),
    email: z.string().nullable(),
    phoneE164: z.string().nullable().optional(),
    displayName: z.string().nullable(),
    linkedProviders: z.array(AuthMethodSchema),
    isPro: z.boolean(),
    acceptedDevicePolicyAt: z.string().nullable().optional(),
  })
  .openapi('AccountUser');

export const DeviceSessionItemSchema = z
  .object({
    sessionId: z.string().uuid(),
    deviceId: z.string().uuid(),
    deviceIdShort: z.string(),
    slotKind: DeviceSlotKindSchema,
    platform: DevicePlatformSchema,
    appSurface: AppSurfaceSchema,
    deviceName: z.string(),
    locationLabel: z.string(),
    ipMasked: z.string().nullable(),
    authMethod: AuthMethodSchema,
    isCurrentDevice: z.boolean(),
    createdAt: z.string(),
    lastSeenAt: z.string(),
  })
  .openapi('DeviceSessionItem');

export const AuthSessionResponseSchema = z
  .object({
    accessToken: z.string(),
    expiresAt: z.string(),
    deviceId: z.string().uuid(),
    deviceSecret: z.string().min(16).max(256).optional(),
    user: AccountUserSchema,
    currentSession: DeviceSessionItemSchema,
    sessions: z.array(DeviceSessionItemSchema),
  })
  .openapi('AuthSessionResponse');

export const AccountSessionsResponseSchema = z
  .object({
    isAuthenticated: z.boolean(),
    user: AccountUserSchema.nullable(),
    currentDeviceId: z.string().uuid(),
    devicePolicy: DevicePolicySummarySchema.extend({
      mobileOccupied: z.boolean(),
      desktopWebOccupied: z.boolean(),
    }),
    sessions: z.array(DeviceSessionItemSchema),
  })
  .openapi('AccountSessionsResponse');

export const LogoutResponseSchema = z
  .object({
    success: z.boolean(),
    signedOut: z.boolean(),
    accessToken: z.string(),
    deviceId: z.string().uuid(),
    expiresAt: z.string(),
  })
  .openapi('LogoutResponse');

export const RevokeDeviceSessionResponseSchema = z
  .object({
    success: z.boolean(),
    revokedDeviceIds: z.array(z.string().uuid()),
    signedOutCurrentDevice: z.boolean().default(false),
    sessions: z.array(DeviceSessionItemSchema),
  })
  .openapi('RevokeDeviceSessionResponse');

export const LinkAccountRequestSchema = z
  .object({
    provider: z.enum(['apple', 'google']),
    idToken: z.string().min(1),
    deviceMeta: DeviceClientMetaSchema.optional(),
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

const BASE_AUDIO_MIME_TYPES = ['audio/mp4', 'audio/webm', 'audio/ogg', 'audio/wav'] as const;

export function normalizeAudioMimeType(raw: string): string {
  const mime = raw.split(';')[0]?.trim().toLowerCase() ?? '';
  if (mime === 'audio/x-m4a' || mime === 'audio/aac' || mime === 'video/mp4') {
    return 'audio/mp4';
  }
  return mime;
}

export const PresignUploadRequestSchema = z
  .object({
    attemptId: z.string().uuid(),
    partIndex: z.number().int().min(1).max(6),
    turnId: z.string().min(1).max(64).optional(),
    byteLength: z
      .number()
      .int()
      .positive()
      .max(15 * 1024 * 1024),
    contentType: z
      .string()
      .transform(normalizeAudioMimeType)
      .pipe(z.enum(BASE_AUDIO_MIME_TYPES))
      .default('audio/mp4'),
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
    examId: SupportedExamIdSchema.default('ielts_academic'),
    edition: z.enum(['glb', 'irn']).optional(),
    taskType: WritingTaskTypeSchema,
    promptTitle: z.string().default(''),
    promptBody: z.string().default(''),
    essayText: z.string().min(20).max(12000),
    durationSeconds: z.number().int().nonnegative().optional(),
    wordCount: z.number().int().nonnegative().optional(),
  })
  .openapi('EvaluateWritingRequest');

export const SpeakingTurnSchema = z
  .object({
    partIndex: z.number().int().min(1).max(6),
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
    examId: SupportedExamIdSchema.default('ielts_academic'),
    edition: z.enum(['glb', 'irn']).optional(),
    partSequence: z
      .enum(['part1', 'part2', 'part3', 'part4', 'full', 'diagnostic'])
      .default('full'),
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
    code: CriterionCodeSchema,
    label: z.string(),
    band: z.number().min(0).max(160),
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
    partIndex: z.number().int().min(1).max(6),
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
    criterionCode: CriterionCodeSchema,
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
    glossFa: z.string().optional(),
    contextSentence: z.string(),
    paraphrases: z.array(z.string()).default([]),
    bandRationale: z.string(),
  })
  .openapi('VocabUpgrade');

export const RecommendedDrillSchema = z
  .object({
    drillType: z.string(),
    weakestCriterionCode: CriterionCodeSchema,
    title: z.string(),
    durationMinutes: z.number().default(3),
  })
  .openapi('RecommendedDrill');

export const EvaluationOutputSchema = z
  .object({
    attemptId: z.string().uuid(),
    overallBand: z.number().min(0).max(160),
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
    edition: z.enum(['glb', 'irn']).optional(),
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
    advancedResult: z.record(z.string(), z.unknown()).optional(),
    errorCode: z.string().optional(),
    quotaRefunded: z.boolean().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('JobStatusResponse');

export const BillingSourceSchema = z
  .enum(['revenuecat', 'stripe', 'zarinpal', 'bazaar', 'myket', 'dev_sandbox', 'none'])
  .openapi('BillingSource');

export const EntitlementSnapshotSchema = z
  .object({
    isPro: z.boolean(),
    activePlanId: z.string().nullable(),
    expiresAt: z.string().nullable(),
    source: BillingSourceSchema,
    freeDiagnosticUsed: z.boolean(),
  })
  .openapi('EntitlementSnapshot');

export const ZarinpalRequestSchema = z
  .object({
    planId: z.string().min(1).max(64),
    amountRial: z.number().int().positive(),
    acceptedSingleDevicePerSlotTos: z.literal(true),
    returnUrl: z.string().url(),
  })
  .openapi('ZarinpalRequest');

export const ZarinpalVerifySchema = z
  .object({
    authority: z.string().trim().min(4).max(128),
    status: z.string().trim().min(1).max(16).optional(),
  })
  .openapi('ZarinpalVerify');

export const IranStoreVerifySchema = z
  .object({
    planId: z.string().min(1).max(64),
    productId: z.string().min(1).max(128),
    purchaseToken: z.string().trim().min(4).max(512),
    acceptedSingleDevicePerSlotTos: z.literal(true),
  })
  .openapi('IranStoreVerify');

export const GlbCheckoutRequestSchema = z
  .object({
    planId: z.string().min(1).max(64),
    acceptedSingleDevicePerSlotTos: z.literal(true),
    returnUrl: z.string().url(),
  })
  .openapi('GlbCheckoutRequest');

export const GlbVerifyRequestSchema = z
  .object({
    sessionId: z.string().trim().min(4).max(256),
  })
  .openapi('GlbVerifyRequest');

export const BillingCheckoutOutcomeSchema = z
  .object({
    redirectUrl: z.string().optional(),
    paymentUrl: z.string().optional(),
    authority: z.string().optional(),
    activatedSession: EntitlementSnapshotSchema.optional(),
  })
  .openapi('BillingCheckoutOutcome');

export const CustomerPortalResponseSchema = z
  .object({
    portalUrl: z.string().min(1),
  })
  .openapi('CustomerPortalResponse');

export const QuotaStatusResponseSchema = z
  .object({
    isPro: z.boolean(),
    freeDiagnosticUsed: z.boolean(),
    activePlanId: z.string().nullable().optional(),
    expiresAt: z.string().nullable().optional(),
    source: BillingSourceSchema.optional(),
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
    track: CatalogTrackSchema.default('academic'),
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

// --- Rapid Adaptive Starting-Level Check (`RAPID_DIAGNOSTIC_PLAN.md`) ---

export const DiagnosticTierSchema = z
  .enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])
  .openapi('DiagnosticTier');

export const DiagnosticRoutingCategorySchema = z
  .enum(['strong', 'mixed', 'low', 'no_evidence'])
  .openapi('DiagnosticRoutingCategory');

export const DiagnosticStopReasonSchema = z
  .enum([
    'sampling_complete',
    'stage_timeout',
    'global_timeout',
    'presentation_limit',
    'content_limit',
  ])
  .openapi('DiagnosticStopReason');

export const DiagnosticSkillStatusSchema = z
  .enum(['provisional', 'pending', 'insufficient_evidence', 'unscorable', 'failed', 'skipped'])
  .openapi('DiagnosticSkillStatus');

export const DiagnosticModeSchema = z
  .enum(['standard', 'extended', 'accessible'])
  .openapi('DiagnosticMode');

export const DiagnosticQuestionSchema = z.object({
  questionId: z.string(),
  prompt: z.string(),
  options: z.tuple([z.string(), z.string(), z.string()]),
  correctIndex: z.number().int().min(0).max(2),
  focusTag: z.string(),
});

export const DiagnosticBlockSchema = z.object({
  blockId: z.string(),
  skill: z.enum(['reading', 'listening']),
  tier: DiagnosticTierSchema,
  scenarioId: z.string(),
  title: z.string(),
  passageText: z.string().optional(),
  scriptText: z.string().optional(),
  mediaUrl: z.string().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  minRequiredSeconds: z.number().int().positive(),
  questions: z.tuple([DiagnosticQuestionSchema, DiagnosticQuestionSchema]),
});

export const DiagnosticWorkedExampleSchema = z.object({
  skill: z.enum(['reading', 'listening']),
  passageOrTranscript: z.string(),
  mediaUrl: z.string().optional(),
  questionPrompt: z.string(),
  options: z.tuple([z.string(), z.string(), z.string()]),
  correctIndex: z.number().int().min(0).max(2),
  explanation: z.string(),
});

export const DiagnosticBankResponseSchema = z
  .object({
    policyVersion: z.string(),
    contentVersion: z.string(),
    preflightAudioUrl: z.string(),
    budgetSeconds: z.object({
      intro: z.number().int().positive(),
      reading: z.number().int().positive(),
      listening: z.number().int().positive(),
      writing: z.number().int().positive(),
      speaking: z.number().int().positive(),
      transitions: z.number().int().positive(),
      collectionTotal: z.number().int().positive(),
      resultsWindow: z.number().int().positive(),
      total: z.number().int().positive(),
    }),
    workedExamples: z.object({
      reading: DiagnosticWorkedExampleSchema,
      listening: DiagnosticWorkedExampleSchema,
    }),
    readingBlocks: z.array(DiagnosticBlockSchema),
    listeningBlocks: z.array(DiagnosticBlockSchema),
    writingPrompt: z.object({
      promptId: z.string(),
      title: z.string(),
      basePrompt: z.string(),
      suggestedWordsLabel: z.string(),
      supportiveFollowUp: z.string(),
      extensionFollowUp: z.string(),
    }),
    speakingPrompt: z.object({
      promptId: z.string(),
      title: z.string(),
      basePrompt: z.string(),
      cueLabels: z.tuple([z.string(), z.string(), z.string()]),
      supportiveFollowUp: z.string(),
      extensionFollowUp: z.string(),
    }),
    examScaleInfo: z.array(
      z.object({
        examId: z.string(),
        label: z.string(),
        summary: z.string(),
      }),
    ),
  })
  .openapi('DiagnosticBankResponse');

export const DiagnosticBlockAttemptInputSchema = z.object({
  blockId: z.string().max(120),
  tier: DiagnosticTierSchema,
  selectedOptionIndices: z.array(z.number().int().min(0).max(2).nullable()).max(2),
  noEvidenceReason: z
    .enum([
      'skipped',
      'dont_know',
      'playback_failed',
      'mic_denied',
      'empty_timeout',
      'unusable_audio',
    ])
    .optional(),
  elapsedSeconds: z.number().int().nonnegative().max(600).optional(),
});

export const CreateDiagnosticSessionRequestSchema = z
  .object({
    diagId: z.string().uuid(),
    examId: z.string().max(60).default('ielts_academic'),
    mode: DiagnosticModeSchema.default('standard'),
    selectionSeed: z.string().max(120).optional(),
  })
  .openapi('CreateDiagnosticSessionRequest');

export const SubmitDiagnosticSessionRequestSchema = z
  .object({
    examId: z.string().max(60).optional(),
    mode: DiagnosticModeSchema.optional(),
    readingHistory: z.array(DiagnosticBlockAttemptInputSchema).max(4).default([]),
    readingStopReason: DiagnosticStopReasonSchema.nullable().optional(),
    readingSkipped: z.boolean().default(false),
    listeningHistory: z.array(DiagnosticBlockAttemptInputSchema).max(3).default([]),
    listeningStopReason: DiagnosticStopReasonSchema.nullable().optional(),
    listeningSkipped: z.boolean().default(false),
    writing: z
      .object({
        attemptId: z.string().uuid(),
        promptTitle: z.string().max(200),
        basePrompt: z.string().max(1000),
        followUpPrompt: z.string().max(1000).optional(),
        baseResponse: z.string().max(4000).default(''),
        followUpResponse: z.string().max(4000).optional(),
        skipped: z.boolean().default(false),
      })
      .optional(),
    speaking: z
      .object({
        attemptId: z.string().uuid(),
        basePrompt: z.string().max(1000),
        followUpPrompt: z.string().max(1000).optional(),
        turns: z
          .array(
            z.object({
              partIndex: z.number().int().min(1).max(2),
              promptText: z.string().max(1000),
              objectKey: z.string().min(5).max(500),
              durationMs: z.number().int().nonnegative().max(120_000).optional(),
            }),
          )
          .max(2)
          .default([]),
        skipped: z.boolean().default(false),
        noEvidenceReason: z
          .enum(['skipped', 'mic_denied', 'empty_timeout', 'unusable_audio'])
          .optional(),
      })
      .optional(),
  })
  .openapi('SubmitDiagnosticSessionRequest');

export const DiagnosticSkillOutcomeSchema = z.object({
  skill: z.enum(['reading', 'listening', 'writing', 'speaking']),
  status: DiagnosticSkillStatusSchema,
  suggestedPracticeLevel: z.string().nullable(),
  suggestedTier: DiagnosticTierSchema.nullable().optional(),
  observations: z.array(z.string()),
  weaknessFocus: z.string().nullable(),
  recommendedDrillType: z.string().nullable().optional(),
  jobId: z.string().uuid().nullable().optional(),
  attemptId: z.string().uuid().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  quotaRefunded: z.boolean().default(false),
  reducedSampling: z.boolean().default(false),
  hasContradictoryEvidence: z.boolean().default(false),
  stopReason: DiagnosticStopReasonSchema.nullable().optional(),
});

export const RetakeDiagnosticSkillRequestSchema = z
  .object({
    skill: z.enum(['reading', 'listening', 'writing', 'speaking']),
    readingHistory: z.array(DiagnosticBlockAttemptInputSchema).max(4).optional(),
    readingStopReason: DiagnosticStopReasonSchema.nullable().optional(),
    listeningHistory: z.array(DiagnosticBlockAttemptInputSchema).max(3).optional(),
    listeningStopReason: DiagnosticStopReasonSchema.nullable().optional(),
    writing: SubmitDiagnosticSessionRequestSchema.shape.writing.optional(),
    speaking: SubmitDiagnosticSessionRequestSchema.shape.speaking.optional(),
  })
  .openapi('RetakeDiagnosticSkillRequest');

export const DiagnosticSessionResponseSchema = z
  .object({
    diagId: z.string().uuid(),
    examId: z.string(),
    mode: DiagnosticModeSchema,
    policyVersion: z.string(),
    contentVersion: z.string(),
    status: z.enum(['in_progress', 'submitted', 'completed', 'abandoned']),
    startedAt: z.string(),
    collectionDeadlineAt: z.string(),
    resultsDeadlineAt: z.string(),
    resultRevision: z.number().int().positive(),
    skills: z.object({
      reading: DiagnosticSkillOutcomeSchema,
      listening: DiagnosticSkillOutcomeSchema,
      writing: DiagnosticSkillOutcomeSchema,
      speaking: DiagnosticSkillOutcomeSchema,
    }),
    recommendedFirstAction: z.object({
      title: z.string(),
      description: z.string(),
      drillType: z.string().nullable(),
      targetSkill: z.enum(['reading', 'listening', 'writing', 'speaking']).nullable(),
    }),
  })
  .openapi('DiagnosticSessionResponse');

// ============================================================================
// Phase A0-A5 Closed-Loop Linguistic Engine Contracts
// ============================================================================

export const LinguisticNodeKindSchema = z.enum([
  'bottleneck',
  'target_structure',
  'interest_topic',
]);

export const LinguisticNodeDtoSchema = z
  .object({
    nodeId: z.string().uuid(),
    edition: z.enum(['glb', 'irn']),
    nodeKind: LinguisticNodeKindSchema,
    canonicalKey: z.string().min(1).max(128),
    displayLabelEn: z.string().min(1).max(160),
    displayLabelFa: z.string().max(160).nullable().optional(),
    masteryScoreMilli: z.number().int().min(0).max(1000),
    signalWeightMilli: z.number().int().min(0).max(1000),
    evidenceCount: z.number().int().nonnegative(),
    lastSeenDaySerial: z.number().int().nonnegative(),
    lastExampleEn: z.string().max(300).nullable().optional(),
    coachNoteEn: z.string().max(400).nullable().optional(),
    coachNoteFa: z.string().max(400).nullable().optional(),
    isPinned: z.boolean().default(false),
    isMuted: z.boolean().default(false),
  })
  .openapi('LinguisticNodeDto');

export const LinguisticGraphResponseSchema = z
  .object({
    bottlenecks: z.array(LinguisticNodeDtoSchema),
    targetStructures: z.array(LinguisticNodeDtoSchema),
    interestTopics: z.array(LinguisticNodeDtoSchema),
    totalEvidenceCount: z.number().int().nonnegative(),
  })
  .openapi('LinguisticGraphResponse');

export const UpdateGraphInterestsRequestSchema = z
  .object({
    pinTopics: z.array(z.string().trim().min(2).max(80)).max(10).default([]),
    muteTopics: z.array(z.string().trim().min(2).max(80)).max(20).default([]),
  })
  .openapi('UpdateGraphInterestsRequest');

export const DailyMissionPayloadSchema = z.object({
  estimatedSeconds: z.number().int().min(60).max(900).default(600),
  warmupCardIds: z.array(z.string()).max(5),
  forcedTargets: z.array(
    z.object({
      canonicalKey: z.string(),
      phraseEn: z.string(),
      hintEn: z.string(),
      hintFa: z.string().nullable().optional(),
    }),
  ),
  promptTitle: z.string(),
  promptTextEn: z.string(),
  promptTextFa: z.string().nullable().optional(),
  responseMode: z.enum(['writing', 'speaking']),
});

export const DailyMissionResponseSchema = z
  .object({
    missionId: z.string().uuid(),
    edition: z.enum(['glb', 'irn']),
    examTrack: z.string(),
    missionDaySerial: z.number().int(),
    status: z.enum(['ready', 'in_progress', 'completed', 'skipped']),
    focusTopic: z.string(),
    payload: DailyMissionPayloadSchema,
    evaluationResult: z
      .object({
        matchedTargets: z.array(z.string()),
        feedbackEn: z.string(),
        feedbackFa: z.string().nullable().optional(),
        clarityScore1To5: z.number().int().min(1).max(5),
      })
      .nullable()
      .optional(),
  })
  .openapi('DailyMissionResponse');

export const CompleteDailyMissionRequestSchema = z
  .object({
    responseText: z.string().trim().min(10).max(4000).optional(),
    audioObjectKey: z.string().min(5).max(500).optional(),
  })
  .openapi('CompleteDailyMissionRequest');

export const RegisterShifterRequestSchema = z
  .object({
    objectKey: z.string().min(5).max(500),
    examTrack: z.string().default('ielts_academic'),
    topicHint: z.string().max(120).optional(),
    durationSeconds: z.number().min(5).max(45),
  })
  .openapi('RegisterShifterRequest');

export const RegisterShiftHighlightSchema = z.object({
  casualPhrase: z.string(),
  upgradedPhrase: z.string(),
  targetGear: z.enum(['workplace', 'academic']),
  whyEn: z.string(),
  whyFa: z.string().nullable().optional(),
});

export const RegisterShifterResultSchema = z
  .object({
    runId: z.string().uuid(),
    examTrack: z.string(),
    sourceTranscript: z.string(),
    gears: z.object({
      casual: z.string(),
      workplace: z.string(),
      academic: z.string(),
    }),
    shiftHighlights: z.array(RegisterShiftHighlightSchema).max(4),
    repeatAloudTarget: z.object({
      gearLevel: z.union([z.literal(1), z.literal(2)]),
      targetSentence: z.string(),
      targetPhrases: z.array(z.string()).min(1).max(4),
    }),
  })
  .openapi('RegisterShifterResult');

export const VerifyRepeatAloudRequestSchema = z
  .object({
    objectKey: z.string().min(5).max(500),
    gearLevel: z.union([z.literal(1), z.literal(2)]),
    expectedSentence: z.string().min(3).max(500),
    targetPhrases: z.array(z.string().min(1).max(120)).min(1).max(4),
  })
  .openapi('VerifyRepeatAloudRequest');

export const VerifyRepeatAloudResponseSchema = z
  .object({
    runId: z.string().uuid(),
    matchedTargets: z.array(z.string()),
    meaningPreserved: z.boolean(),
    fluencyScore1To5: z.number().int().min(1).max(5),
    graphUpdated: z.boolean(),
  })
  .openapi('VerifyRepeatAloudResponse');

export const DropInputKindSchema = z.enum(['text_url', 'text', 'image', 'audio']);

export const DropPresignMediaRequestSchema = z
  .object({
    dropId: z.string().uuid(),
    mediaKind: z.enum(['image', 'audio']),
    files: z
      .array(
        z.object({
          contentType: z.enum([
            'image/png',
            'image/jpeg',
            'image/webp',
            'audio/mp4',
            'audio/mpeg',
            'audio/wav',
            'audio/ogg',
            'audio/webm',
          ]),
          byteLength: z.number().int().positive().max(5 * 1024 * 1024),
        }),
      )
      .min(1)
      .max(4),
  })
  .openapi('DropPresignMediaRequest');

export const DropPresignMediaResponseSchema = z
  .object({
    dropId: z.string().uuid(),
    items: z.array(
      z.object({
        objectKey: z.string(),
        uploadUrl: z.string(),
        expiresInSeconds: z.number().int(),
      }),
    ),
  })
  .openapi('DropPresignMediaResponse');

export const DropIngestRequestSchema = z
  .discriminatedUnion('inputKind', [
    z.object({
      inputKind: z.literal('text_url'),
      sourceUrl: z.string().url().max(2048),
      examTrack: z.string().default('ielts_academic'),
    }),
    z.object({
      inputKind: z.literal('text'),
      rawText: z.string().min(40).max(15_000),
      sourceLabel: z.string().max(160).optional(),
      examTrack: z.string().default('ielts_academic'),
    }),
    z.object({
      inputKind: z.literal('image'),
      imageObjectKeys: z.array(z.string().min(5).max(500)).min(1).max(4).optional(),
      imageUrls: z.array(z.string().url().max(2048)).min(1).max(4).optional(),
      examTrack: z.string().default('ielts_academic'),
    }),
    z.object({
      inputKind: z.literal('audio'),
      audioObjectKey: z.string().min(5).max(500).optional(),
      audioUrl: z.string().url().max(2048).optional(),
      durationSeconds: z.number().positive().max(180),
      examTrack: z.string().default('ielts_academic'),
    }),
  ])
  .openapi('DropIngestRequest');

export const DroppedPhraseDtoSchema = z.object({
  headword: z.string(),
  ipa: z.string().nullable().optional(),
  definitionEn: z.string(),
  glossFa: z.string().nullable().optional(),
  exampleSentence: z.string(),
  startUtf16: z.number().int().nonnegative().nullable().optional(),
  endUtf16: z.number().int().nonnegative().nullable().optional(),
});

export const DroppedContentResponseSchema = z
  .object({
    dropId: z.string().uuid(),
    edition: z.enum(['glb', 'irn']),
    inputKind: DropInputKindSchema,
    sourceDomainOrLabel: z.string(),
    title: z.string(),
    cefrEstimate: z.string(),
    detectedTopics: z.array(z.string()),
    extractedPhrases: z.array(DroppedPhraseDtoSchema),
    drillPayload: z.object({
      comprehensionPrompt: z.string(),
      comprehensionOptions: z.array(z.string()).min(2).max(4),
      correctOptionIndex: z.number().int().nonnegative(),
      clozeSentence: z.string(),
      clozeAnswer: z.string(),
      shadowingPrompt: z.string(),
    }),
    createdAt: z.string(),
  })
  .openapi('DroppedContentResponse');

export const DropHistoryResponseSchema = z
  .object({
    items: z.array(DroppedContentResponseSchema),
    nextCursor: z.string().nullable(),
  })
  .openapi('DropHistoryResponse');

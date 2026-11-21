import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    userId: uuid('user_id').primaryKey(),
    email: text('email'),
    phoneE164: text('phone_e164'),
    displayName: text('display_name'),
    passwordHash: text('password_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_users_email_lower_unique')
      .on(sql`lower(${table.email})`)
      .where(sql`${table.email} IS NOT NULL`),
    uniqueIndex('idx_users_phone_e164_unique')
      .on(table.phoneE164)
      .where(sql`${table.phoneE164} IS NOT NULL`),
  ],
);

export const devices = pgTable('devices', {
  deviceId: uuid('device_id').primaryKey(),
  edition: text('edition').notNull(),
  appVersion: text('app_version'),
  slotKind: text('slot_kind').default('mobile').notNull(), // 'mobile' | 'desktop_web'
  platform: text('platform'),
  deviceName: text('device_name'),
  deviceSecretHash: text('device_secret_hash'),
  tokenVersion: integer('token_version').default(1).notNull(),
  uploadGeneration: integer('upload_generation').default(1).notNull(),
  erasingAt: timestamp('erasing_at', { withTimezone: true }),
  linkedUserId: uuid('linked_user_id').references(() => users.userId, { onDelete: 'set null' }),
  freeDiagnosticUsed: boolean('free_diagnostic_used').default(false).notNull(),
  freeRapidDiagnosticUsed: boolean('free_rapid_diagnostic_used').default(false).notNull(),
  lastAttestedAt: timestamp('last_attested_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
});

export const authChallenges = pgTable('auth_challenges', {
  challenge: text('challenge').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accountLinks = pgTable(
  'account_links',
  {
    linkId: uuid('link_id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'apple' | 'google'
    providerSubject: text('provider_subject').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('account_links_provider_subject_unique').on(table.provider, table.providerSubject),
  ],
);

export const userDeviceSessions = pgTable(
  'user_device_sessions',
  {
    sessionId: uuid('session_id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.userId, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.deviceId, { onDelete: 'cascade' }),
    slotKind: text('slot_kind').notNull(), // 'mobile' | 'desktop_web'
    platform: text('platform').default('unknown').notNull(),
    appSurface: text('app_surface').default('flutter_app').notNull(), // 'flutter_app' | 'flutter_web' | 'web_app'
    deviceName: text('device_name').notNull(),
    ipMasked: text('ip_masked'),
    locationLabel: text('location_label').default('Unknown location').notNull(),
    userAgent: text('user_agent'),
    authMethod: text('auth_method').notNull(), // 'email' | 'google' | 'apple'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
  },
  (table) => [
    uniqueIndex('uq_active_user_slot')
      .on(table.userId, table.slotKind)
      .where(sql`${table.revokedAt} IS NULL`),
    uniqueIndex('uq_active_device_session')
      .on(table.deviceId)
      .where(sql`${table.revokedAt} IS NULL`),
    index('idx_user_device_sessions_user_active').on(
      table.userId,
      table.revokedAt,
      table.lastSeenAt,
    ),
  ],
);

export const userEntitlements = pgTable('user_entitlements', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.userId, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  originalAppUserId: text('original_app_user_id'),
  productId: text('product_id'),
  isPro: boolean('is_pro').default(false).notNull(),
  acceptedDevicePolicyAt: timestamp('accepted_device_policy_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  graceUntil: timestamp('grace_until', { withTimezone: true }),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
  lastEventAt: timestamp('last_event_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const entitlements = pgTable('entitlements', {
  deviceId: uuid('device_id')
    .primaryKey()
    .references(() => devices.deviceId, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.userId, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  originalAppUserId: text('original_app_user_id'),
  productId: text('product_id'),
  isPro: boolean('is_pro').default(false).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  graceUntil: timestamp('grace_until', { withTimezone: true }),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
  lastEventAt: timestamp('last_event_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const erasureRequests = pgTable('erasure_requests', {
  erasureId: uuid('erasure_id').primaryKey(),
  accountKey: text('account_key').notNull(),
  deviceIdsJson: jsonb('device_ids_json').$type<string[]>().notNull(),
  status: text('status').notNull(), // 'pending' | 'partial' | 'completed'
  receiptTokenHash: text('receipt_token_hash'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const quotaReservations = pgTable('quota_reservations', {
  reservationId: uuid('reservation_id').primaryKey(),
  attemptId: uuid('attempt_id').notNull().unique(),
  accountKey: text('account_key').notNull(),
  deviceId: uuid('device_id'),
  skill: text('skill').notNull(), // 'speaking' | 'writing'
  utcDay: text('utc_day').notNull(), // 'YYYY-MM-DD'
  utcMonth: text('utc_month').notNull(), // 'YYYY-MM'
  status: text('status').notNull(), // 'reserved' | 'committed' | 'refunded'
  isDiagnostic: boolean('is_diagnostic').default(false).notNull(),
  diagSessionId: uuid('diag_session_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const dailyQuotaUsage = pgTable('daily_quota_usage', {
  counterKey: text('counter_key').primaryKey(), // `${accountKey}:${utcDay}`
  accountKey: text('account_key').notNull(),
  utcDay: text('utc_day').notNull(),
  speakingUsed: integer('speaking_used').default(0).notNull(),
  writingUsed: integer('writing_used').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const monthlyQuotaUsage = pgTable('monthly_quota_usage', {
  counterKey: text('counter_key').primaryKey(), // `${accountKey}:${utcMonth}`
  accountKey: text('account_key').notNull(),
  utcMonth: text('utc_month').notNull(),
  totalUsed: integer('total_used').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usageCounters = pgTable('usage_counters', {
  counterKey: text('counter_key').primaryKey(),
  deviceId: uuid('device_id')
    .notNull()
    .references(() => devices.deviceId, { onDelete: 'cascade' }),
  utcDay: text('utc_day').notNull(),
  speakingUsed: integer('speaking_used').default(0).notNull(),
  writingUsed: integer('writing_used').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const evaluationJobs = pgTable(
  'evaluation_jobs',
  {
    jobId: uuid('job_id').primaryKey(),
    attemptId: uuid('attempt_id').notNull().unique(),
    accountKey: text('account_key').notNull(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.deviceId, { onDelete: 'cascade' }),
    packId: text('pack_id'),
    examId: text('exam_id'),
    taskType: text('task_type'),
    skill: text('skill').notNull(),
    status: text('status').notNull(), // 'queued' | 'processing_audio' | 'evaluating' | 'completed' | 'failed'
    stageDetail: text('stage_detail'),
    inputHash: text('input_hash'),
    inputJson: jsonb('input_json'),
    resultJson: jsonb('result_json'),
    overallBand: real('overall_band'),
    modelId: text('model_id'),
    rubricVersion: text('rubric_version'),
    errorCode: text('error_code'),
    latencyMs: integer('latency_ms'),
    tokenUsageJson: jsonb('token_usage_json'),
    estimatedCostUsdMicros: integer('estimated_cost_usd_micros'),
    attemptsCount: integer('attempts_count').default(1).notNull(),
    executionGeneration: integer('execution_generation').default(1).notNull(),
    claimToken: text('claim_token'),
    claimExpiresAt: timestamp('claim_expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_evaluation_jobs_account_created').on(table.accountKey, table.createdAt),
    index('idx_evaluation_jobs_status_updated').on(table.status, table.updatedAt),
  ],
);

export const jobDispatchOutbox = pgTable('job_dispatch_outbox', {
  jobId: uuid('job_id')
    .primaryKey()
    .references(() => evaluationJobs.jobId, { onDelete: 'cascade' }),
  queueName: text('queue_name').notNull(),
  dispatchKey: text('dispatch_key'),
  payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull(),
  status: text('status').default('pending').notNull(), // 'pending' | 'dispatched'
  attempts: integer('attempts').default(0).notNull(),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const audioAssets = pgTable('audio_assets', {
  objectKey: text('object_key').primaryKey(),
  deviceId: uuid('device_id')
    .notNull()
    .references(() => devices.deviceId, { onDelete: 'cascade' }),
  attemptId: uuid('attempt_id').notNull(),
  byteLength: integer('byte_length').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  purgedAt: timestamp('purged_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const aiQuestionExplanations = pgTable(
  'ai_question_explanations',
  {
    questionId: text('question_id').notNull(),
    packVersion: text('pack_version').notNull(),
    skill: text('skill').notNull(),
    explanationJson: jsonb('explanation_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.questionId, table.packVersion] })],
);

export const catalogPacks = pgTable('catalog_packs', {
  packId: text('pack_id').primaryKey(),
  edition: text('edition').notNull(), // 'glb' | 'irn'
  examId: text('exam_id').notNull(),
  skill: text('skill').notNull(),
  version: text('version').notNull(),
  sha256: text('sha256').notNull(),
  byteLength: integer('byte_length').notNull(),
  cdnRelativePath: text('cdn_relative_path').notNull(),
  contentOrigin: text('content_origin').notNull(),
  humanQaReviewed: boolean('human_qa_reviewed').default(false).notNull(),
  isFreeSample: boolean('is_free_sample').default(false).notNull(),
  isPublished: boolean('is_published').default(false).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  track: text('track').default('academic').notNull(),
  title: text('title').default('').notNull(),
  description: text('description').default('').notNull(),
  durationSeconds: integer('duration_seconds').default(0).notNull(),
  questionCount: integer('question_count').default(0).notNull(),
  accent: text('accent'),
  mediaObjectKey: text('media_object_key'),
});

export const webhookEvents = pgTable('webhook_events', {
  eventId: text('event_id').primaryKey(),
  provider: text('provider').notNull(),
  eventType: text('event_type').notNull(),
  status: text('status').default('processed').notNull(), // 'processed' | 'pending_reconciliation'
  targetIdentity: text('target_identity'),
  payloadJson: jsonb('payload_json').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
});

export const questionFlags = pgTable('question_flags', {
  flagId: uuid('flag_id').primaryKey(),
  questionId: text('question_id').notNull(),
  packId: text('pack_id').notNull(),
  reason: text('reason').notNull(),
  note: text('note'),
  deviceId: uuid('device_id')
    .notNull()
    .references(() => devices.deviceId, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const examSections = pgTable(
  'exam_sections',
  {
    sectionId: text('section_id').primaryKey(),
    packId: text('pack_id')
      .notNull()
      .references(() => catalogPacks.packId, { onDelete: 'cascade' }),
    sectionIndex: integer('section_index').notNull(),
    sectionType: text('section_type').notNull(),
    title: text('title').notNull(),
    instructions: text('instructions').default('').notNull(),
    contentText: text('content_text').default('').notNull(),
    paragraphsJson: jsonb('paragraphs_json').$type<Record<string, string> | null>(),
    transcriptJson: jsonb('transcript_json').$type<Array<{
      speaker: string;
      startMs: number;
      endMs: number;
      text: string;
    }> | null>(),
    mediaObjectKey: text('media_object_key'),
    durationSeconds: integer('duration_seconds').default(0).notNull(),
    wordCount: integer('word_count').default(0).notNull(),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown> | null>(),
  },
  (table) => [index('idx_exam_sections_pack_order').on(table.packId, table.sectionIndex)],
);

export const examQuestions = pgTable(
  'exam_questions',
  {
    questionId: text('question_id').primaryKey(),
    packId: text('pack_id')
      .notNull()
      .references(() => catalogPacks.packId, { onDelete: 'cascade' }),
    sectionId: text('section_id')
      .notNull()
      .references(() => examSections.sectionId, { onDelete: 'cascade' }),
    questionNumber: integer('question_number').notNull(),
    questionType: text('question_type').notNull(),
    prompt: text('prompt').notNull(),
    optionsJson: jsonb('options_json').$type<string[] | null>(),
    acceptedAnswersJson: jsonb('accepted_answers_json').$type<string[]>().notNull(),
    evidenceJson: jsonb('evidence_json').$type<Record<string, unknown> | null>(),
    cueTimestampMs: integer('cue_timestamp_ms'),
  },
  (table) => [index('idx_exam_questions_pack_number').on(table.packId, table.questionNumber)],
);

export const microDrills = pgTable('micro_drills', {
  drillId: text('drill_id').primaryKey(),
  edition: text('edition').default('all').notNull(),
  title: text('title').notNull(),
  drillType: text('drill_type').notNull(),
  skill: text('skill').default('reading').notNull(),
  durationSeconds: integer('duration_seconds').default(180).notNull(),
  itemsJson: jsonb('items_json')
    .$type<
      Array<{
        id: string;
        prompt: string;
        options: string[];
        answer: string;
        explanation: string;
      }>
    >()
    .notNull(),
  isPublished: boolean('is_published').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const vocabDeckCards = pgTable(
  'vocab_deck_cards',
  {
    cardId: text('card_id').primaryKey(),
    headword: text('headword').notNull(),
    ipa: text('ipa').default('').notNull(),
    definition: text('definition').notNull(),
    topicTag: text('topic_tag').notNull(),
    contextSentence: text('context_sentence').notNull(),
    paraphrasesJson: jsonb('paraphrases_json').$type<string[]>().notNull(),
    collocationsJson: jsonb('collocations_json').$type<string[]>().notNull(),
    easeFactorMilli: integer('ease_factor_milli').default(2500).notNull(),
    isPublished: boolean('is_published').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_vocab_deck_topic').on(table.topicTag, table.headword)],
);

export const diagnosticSessions = pgTable(
  'diagnostic_sessions',
  {
    diagId: uuid('diag_id').primaryKey(),
    accountKey: text('account_key').notNull(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.deviceId, { onDelete: 'cascade' }),
    examId: text('exam_id').notNull(),
    mode: text('mode').default('standard').notNull(), // 'standard' | 'extended' | 'accessible'
    policyVersion: text('policy_version').notNull(),
    contentVersion: text('content_version').notNull(),
    selectionSeed: text('selection_seed').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    collectionDeadlineAt: timestamp('collection_deadline_at', { withTimezone: true }).notNull(),
    resultsDeadlineAt: timestamp('results_deadline_at', { withTimezone: true }).notNull(),
    currentStage: text('current_stage').default('intro').notNull(),
    status: text('status').default('in_progress').notNull(), // 'in_progress' | 'submitted' | 'completed' | 'abandoned'
    objectiveStateJson: jsonb('objective_state_json').$type<Record<string, unknown>>(),
    writingAttemptId: uuid('writing_attempt_id'),
    writingJobId: uuid('writing_job_id'),
    speakingAttemptId: uuid('speaking_attempt_id'),
    speakingJobId: uuid('speaking_job_id'),
    summaryJson: jsonb('summary_json').$type<Record<string, unknown>>(),
    resultRevision: integer('result_revision').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_diagnostic_sessions_account').on(table.accountKey, table.createdAt),
    index('idx_diagnostic_sessions_device').on(table.deviceId, table.createdAt),
  ],
);

export const otpChallenges = pgTable(
  'otp_challenges',
  {
    challengeId: uuid('challenge_id').primaryKey(),
    phoneE164: text('phone_e164').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_otp_challenges_phone_created').on(table.phoneE164, table.createdAt)],
);

export const billingOrders = pgTable(
  'billing_orders',
  {
    orderId: uuid('order_id').primaryKey(),
    userId: uuid('user_id').references(() => users.userId, { onDelete: 'cascade' }),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.deviceId, { onDelete: 'cascade' }),
    edition: text('edition').notNull(),
    provider: text('provider').notNull(), // 'zarinpal' | 'stripe' | 'dev_sandbox'
    planId: text('plan_id').notNull(),
    currency: text('currency').notNull(), // 'IRR' | 'USD'
    amountMinor: integer('amount_minor').notNull(),
    authority: text('authority').notNull().unique(),
    refId: text('ref_id'),
    status: text('status').default('pending').notNull(), // 'pending' | 'verified' | 'cancelled' | 'failed'
    acceptedDevicePolicyAt: timestamp('accepted_device_policy_at', {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_billing_orders_user').on(table.userId, table.createdAt),
    index('idx_billing_orders_device').on(table.deviceId, table.createdAt),
  ],
);

export const linguisticNodes = pgTable(
  'linguistic_nodes',
  {
    nodeId: uuid('node_id').primaryKey(),
    accountKey: text('account_key').notNull(),
    edition: text('edition').notNull(),
    nodeKind: text('node_kind').notNull(), // 'bottleneck' | 'target_structure' | 'interest_topic'
    canonicalKey: text('canonical_key').notNull(),
    displayLabelEn: text('display_label_en').notNull(),
    displayLabelFa: text('display_label_fa'),
    masteryScoreMilli: integer('mastery_score_milli').default(400).notNull(),
    signalWeightMilli: integer('signal_weight_milli').default(500).notNull(),
    evidenceCount: integer('evidence_count').default(1).notNull(),
    firstSeenDaySerial: integer('first_seen_day_serial').notNull(),
    lastSeenDaySerial: integer('last_seen_day_serial').notNull(),
    lastExampleEn: text('last_example_en'),
    coachNoteEn: text('coach_note_en'),
    coachNoteFa: text('coach_note_fa'),
    isPinned: boolean('is_pinned').default(false).notNull(),
    isMuted: boolean('is_muted').default(false).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_linguistic_nodes_unique').on(
      table.accountKey,
      table.edition,
      table.nodeKind,
      table.canonicalKey,
    ),
    index('idx_linguistic_nodes_account').on(table.accountKey, table.edition, table.nodeKind),
  ],
);

export const linguisticEvidenceEvents = pgTable(
  'linguistic_evidence_events',
  {
    eventId: uuid('event_id').primaryKey(),
    accountKey: text('account_key').notNull(),
    edition: text('edition').notNull(),
    nodeId: uuid('node_id')
      .notNull()
      .references(() => linguisticNodes.nodeId, { onDelete: 'cascade' }),
    sourceKind: text('source_kind').notNull(), // 'writing' | 'speaking' | 'diagnostic' | 'register_shifter' | 'drop_anything' | 'mission'
    sourceRefId: text('source_ref_id').notNull(),
    observedPolarity: text('observed_polarity').notNull(), // 'gap_observed' | 'target_used' | 'interest_matched'
    excerptText: text('excerpt_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_linguistic_events_account_created').on(
      table.accountKey,
      table.edition,
      table.createdAt,
    ),
  ],
);

export const dailyMissions = pgTable(
  'daily_missions',
  {
    missionId: uuid('mission_id').primaryKey(),
    accountKey: text('account_key').notNull(),
    edition: text('edition').notNull(),
    examTrack: text('exam_track').default('ielts_academic').notNull(),
    missionDaySerial: integer('mission_day_serial').notNull(),
    status: text('status').default('ready').notNull(), // 'ready' | 'in_progress' | 'completed' | 'skipped'
    targetNodeKeysJson: jsonb('target_node_keys_json').$type<string[]>().default([]).notNull(),
    dueCardIdsJson: jsonb('due_card_ids_json').$type<string[]>().default([]).notNull(),
    focusTopic: text('focus_topic').notNull(),
    missionPayloadJson: jsonb('mission_payload_json').$type<Record<string, unknown>>().notNull(),
    evaluationResultJson: jsonb('evaluation_result_json').$type<Record<string, unknown>>(),
    modelId: text('model_id').notNull(),
    promptVersion: text('prompt_version').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_daily_missions_account_day').on(
      table.accountKey,
      table.edition,
      table.missionDaySerial,
    ),
  ],
);

export const droppedContents = pgTable(
  'dropped_contents',
  {
    dropId: uuid('drop_id').primaryKey(),
    accountKey: text('account_key').notNull(),
    edition: text('edition').notNull(),
    inputKind: text('input_kind').notNull(), // 'text_url' | 'text' | 'image' | 'audio'
    sourceRefHash: text('source_ref_hash').notNull(),
    sourceDomainOrLabel: text('source_domain_or_label').notNull(),
    title: text('title').notNull(),
    cefrEstimate: text('cefr_estimate').default('B2').notNull(),
    detectedTopicsJson: jsonb('detected_topics_json').$type<string[]>().default([]).notNull(),
    extractedPhrasesJson: jsonb('extracted_phrases_json')
      .$type<Array<Record<string, unknown>>>()
      .default([])
      .notNull(),
    drillPayloadJson: jsonb('drill_payload_json').$type<Record<string, unknown>>().notNull(),
    mediaObjectKeysJson: jsonb('media_object_keys_json').$type<string[]>().default([]).notNull(),
    mediaPurgedAt: timestamp('media_purged_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_dropped_contents_account_created').on(
      table.accountKey,
      table.edition,
      table.createdAt,
    ),
    index('idx_dropped_contents_expires').on(table.expiresAt),
  ],
);

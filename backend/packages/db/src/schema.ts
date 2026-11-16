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
  uuid,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  userId: uuid('user_id').primaryKey(),
  email: text('email'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const devices = pgTable('devices', {
  deviceId: uuid('device_id').primaryKey(),
  edition: text('edition').notNull(),
  appVersion: text('app_version'),
  deviceSecretHash: text('device_secret_hash'),
  tokenVersion: integer('token_version').default(1).notNull(),
  uploadGeneration: integer('upload_generation').default(1).notNull(),
  erasingAt: timestamp('erasing_at', { withTimezone: true }),
  linkedUserId: uuid('linked_user_id').references(() => users.userId, { onDelete: 'set null' }),
  freeDiagnosticUsed: boolean('free_diagnostic_used').default(false).notNull(),
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

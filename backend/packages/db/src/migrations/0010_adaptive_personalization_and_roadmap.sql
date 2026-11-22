-- Adaptive Personalization, Roadmap, Kokoro TTS, Pronunciation Practice & Central Tracing/Cost Ledger

ALTER TABLE "catalog_packs"
  ADD COLUMN IF NOT EXISTS "topic_keys_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "weakness_targets_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "cefr_min" text DEFAULT 'B1' NOT NULL,
  ADD COLUMN IF NOT EXISTS "cefr_max" text DEFAULT 'C1' NOT NULL,
  ADD COLUMN IF NOT EXISTS "roadmap_order" integer DEFAULT 100 NOT NULL;

ALTER TABLE "micro_drills"
  ADD COLUMN IF NOT EXISTS "topic_keys_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "weakness_targets_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS "cefr_min" text DEFAULT 'B1' NOT NULL,
  ADD COLUMN IF NOT EXISTS "cefr_max" text DEFAULT 'C1' NOT NULL;

ALTER TABLE "vocab_deck_cards"
  ADD COLUMN IF NOT EXISTS "canonical_topic" text DEFAULT 'academic_core' NOT NULL,
  ADD COLUMN IF NOT EXISTS "cefr_level" text DEFAULT 'B2' NOT NULL,
  ADD COLUMN IF NOT EXISTS "base_wave_order" integer DEFAULT 100 NOT NULL;

ALTER TABLE "linguistic_nodes"
  ADD COLUMN IF NOT EXISTS "skill" text DEFAULT 'mixed' NOT NULL,
  ADD COLUMN IF NOT EXISTS "detected_from" text DEFAULT 'heuristic' NOT NULL;

ALTER TABLE "audio_assets"
  ADD COLUMN IF NOT EXISTS "account_key" text,
  ADD COLUMN IF NOT EXISTS "asset_kind" text DEFAULT 'speaking_attempt' NOT NULL,
  ADD COLUMN IF NOT EXISTS "source_ref_id" text,
  ADD COLUMN IF NOT EXISTS "content_type" text,
  ADD COLUMN IF NOT EXISTS "duration_ms" integer;

CREATE TABLE IF NOT EXISTS "learner_profiles" (
  "account_key" text PRIMARY KEY NOT NULL,
  "edition" text DEFAULT 'glb' NOT NULL,
  "exam_track" text DEFAULT 'ielts_academic' NOT NULL,
  "target_band" real DEFAULT 7.5 NOT NULL,
  "target_date_iso" text,
  "daily_minutes_goal" integer DEFAULT 30 NOT NULL,
  "study_focus" text DEFAULT 'both' NOT NULL,
  "favorite_topics_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "current_band" real,
  "current_reading_band" real,
  "current_listening_band" real,
  "current_writing_band" real,
  "current_speaking_band" real,
  "band_confidence" text DEFAULT 'provisional' NOT NULL,
  "band_shift" real DEFAULT 0 NOT NULL,
  "active_weakness_phase" text DEFAULT 'favorite_topics' NOT NULL,
  "vocab_unlocked_wave" integer DEFAULT 1 NOT NULL,
  "daily_new_vocab_cap" integer DEFAULT 10 NOT NULL,
  "onboarding_completed" boolean DEFAULT false NOT NULL,
  "last_band_recalc_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "learner_band_events" (
  "event_id" uuid PRIMARY KEY NOT NULL,
  "account_key" text NOT NULL,
  "edition" text NOT NULL,
  "exam_track" text NOT NULL,
  "skill" text NOT NULL,
  "source_kind" text NOT NULL,
  "source_id" text NOT NULL,
  "raw_score" real NOT NULL,
  "cefr_estimate" text,
  "weight_milli" integer DEFAULT 1000 NOT NULL,
  "duration_seconds" integer,
  "accuracy_ratio" real,
  "topic_keys_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "weakness_keys_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_band_events_source"
  ON "learner_band_events" ("account_key", "edition", "source_kind", "source_id", "skill");
CREATE INDEX IF NOT EXISTS "idx_band_events_account_skill"
  ON "learner_band_events" ("account_key", "edition", "skill", "created_at");

CREATE TABLE IF NOT EXISTS "learner_topic_weakness_coverage" (
  "coverage_id" uuid PRIMARY KEY NOT NULL,
  "account_key" text NOT NULL,
  "edition" text NOT NULL,
  "weakness_key" text NOT NULL,
  "topic_key" text NOT NULL,
  "attempts_count" integer DEFAULT 0 NOT NULL,
  "successes_count" integer DEFAULT 0 NOT NULL,
  "mastered_in_topic" boolean DEFAULT false NOT NULL,
  "last_practiced_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_topic_weakness_coverage"
  ON "learner_topic_weakness_coverage" ("account_key", "edition", "weakness_key", "topic_key");

CREATE TABLE IF NOT EXISTS "learner_roadmap_plans" (
  "plan_id" uuid PRIMARY KEY NOT NULL,
  "account_key" text NOT NULL,
  "edition" text NOT NULL,
  "exam_track" text NOT NULL,
  "plan_revision" integer DEFAULT 1 NOT NULL,
  "baseline_band" real NOT NULL,
  "target_band" real NOT NULL,
  "is_sprint_mode" boolean DEFAULT false NOT NULL,
  "milestones_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "active_step_id" uuid,
  "status" text DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_roadmap_plans_account_status"
  ON "learner_roadmap_plans" ("account_key", "edition", "status");

CREATE TABLE IF NOT EXISTS "learner_roadmap_steps" (
  "step_id" uuid PRIMARY KEY NOT NULL,
  "plan_id" uuid NOT NULL REFERENCES "learner_roadmap_plans"("plan_id") ON DELETE cascade,
  "account_key" text NOT NULL,
  "milestone_index" integer NOT NULL,
  "step_order" integer NOT NULL,
  "step_kind" text NOT NULL,
  "title_en" text NOT NULL,
  "title_fa" text NOT NULL,
  "reason_en" text NOT NULL,
  "reason_fa" text NOT NULL,
  "topic_key" text NOT NULL,
  "weakness_key" text,
  "target_route" text NOT NULL,
  "target_entity_id" text,
  "status" text DEFAULT 'locked' NOT NULL,
  "estimated_minutes" integer DEFAULT 10 NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_roadmap_steps_plan_order"
  ON "learner_roadmap_steps" ("plan_id", "step_order");

CREATE TABLE IF NOT EXISTS "tts_audio_cache" (
  "cache_key" text PRIMARY KEY NOT NULL,
  "text_hash" text NOT NULL,
  "normalized_text" text NOT NULL,
  "voice" text NOT NULL,
  "model_id" text NOT NULL,
  "speed_milli" integer DEFAULT 1000 NOT NULL,
  "format" text DEFAULT 'mp3' NOT NULL,
  "object_key" text NOT NULL,
  "byte_length" integer DEFAULT 0 NOT NULL,
  "duration_ms" integer,
  "char_count" integer DEFAULT 0 NOT NULL,
  "estimated_cost_usd_micros" integer DEFAULT 0 NOT NULL,
  "hit_count" integer DEFAULT 1 NOT NULL,
  "last_accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_tts_cache_lookup"
  ON "tts_audio_cache" ("text_hash", "voice", "model_id");

CREATE TABLE IF NOT EXISTS "pronunciation_practices" (
  "practice_id" uuid PRIMARY KEY NOT NULL,
  "account_key" text NOT NULL,
  "edition" text NOT NULL,
  "target_text" text NOT NULL,
  "practice_kind" text NOT NULL,
  "source_ref_type" text,
  "source_ref_id" text,
  "object_key" text NOT NULL,
  "duration_ms" integer,
  "transcript" text,
  "accuracy_score" real,
  "fluency_score" real,
  "intonation_score" real,
  "stress_score" real,
  "overall_score" real,
  "band_impact_label" text,
  "summary_en" text,
  "summary_fa" text,
  "mouth_tip_en" text,
  "mouth_tip_fa" text,
  "actionable_retry_en" text,
  "actionable_retry_fa" text,
  "words_feedback_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "weakness_signal_key" text,
  "status" text DEFAULT 'queued' NOT NULL,
  "model_used" text,
  "provider_request_id" text,
  "prompt_tokens" integer DEFAULT 0 NOT NULL,
  "completion_tokens" integer DEFAULT 0 NOT NULL,
  "cached_tokens" integer DEFAULT 0 NOT NULL,
  "estimated_cost_usd_micros" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_pronunciation_account_created"
  ON "pronunciation_practices" ("account_key", "edition", "created_at");

CREATE TABLE IF NOT EXISTS "ai_usage_ledger" (
  "usage_id" uuid PRIMARY KEY NOT NULL,
  "account_key" text NOT NULL,
  "device_id" uuid,
  "edition" text NOT NULL,
  "feature_kind" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "model_id" text NOT NULL,
  "provider_request_id" text,
  "prompt_tokens" integer DEFAULT 0 NOT NULL,
  "completion_tokens" integer DEFAULT 0 NOT NULL,
  "cached_tokens" integer DEFAULT 0 NOT NULL,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "estimated_cost_usd_micros" integer DEFAULT 0 NOT NULL,
  "cost_usd_source" text DEFAULT 'registry_estimate' NOT NULL,
  "latency_ms" integer DEFAULT 0 NOT NULL,
  "audio_duration_ms" integer,
  "tts_characters" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_ai_usage_account_created"
  ON "ai_usage_ledger" ("account_key", "created_at");
CREATE INDEX IF NOT EXISTS "idx_ai_usage_feature_created"
  ON "ai_usage_ledger" ("feature_kind", "created_at");
CREATE INDEX IF NOT EXISTS "idx_ai_usage_model_created"
  ON "ai_usage_ledger" ("model_id", "created_at");

CREATE TABLE IF NOT EXISTS "user_attempts_sync" (
  "attempt_id" text PRIMARY KEY NOT NULL,
  "account_key" text NOT NULL,
  "edition" text NOT NULL,
  "pack_id" text NOT NULL,
  "exam_id" text NOT NULL,
  "skill" text NOT NULL,
  "mode" text NOT NULL,
  "status" text NOT NULL,
  "score_band" real,
  "duration_seconds" integer DEFAULT 0 NOT NULL,
  "answers_json" jsonb,
  "feedback_json" jsonb,
  "topic_keys_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "device_id" uuid,
  "completed_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_user_attempts_sync_account"
  ON "user_attempts_sync" ("account_key", "edition", "updated_at");

CREATE TABLE IF NOT EXISTS "user_vocab_srs_sync" (
  "account_key" text NOT NULL,
  "card_id" text NOT NULL,
  "edition" text NOT NULL,
  "ease_factor_milli" integer DEFAULT 2500 NOT NULL,
  "interval_days" integer DEFAULT 0 NOT NULL,
  "repetitions" integer DEFAULT 0 NOT NULL,
  "due_serial_day" integer DEFAULT 0 NOT NULL,
  "lapses" integer DEFAULT 0 NOT NULL,
  "last_reviewed_at" timestamp with time zone,
  "source_kind" text DEFAULT 'seeded' NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_vocab_srs_sync_account_key_card_id_pk" PRIMARY KEY("account_key","card_id")
);

CREATE TABLE IF NOT EXISTS "user_activity_ledger" (
  "activity_id" uuid PRIMARY KEY NOT NULL,
  "account_key" text NOT NULL,
  "device_id" uuid,
  "edition" text NOT NULL,
  "activity_kind" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "topic_key" text,
  "weakness_keys_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "duration_seconds" integer,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_user_activity_account_created"
  ON "user_activity_ledger" ("account_key", "edition", "created_at");

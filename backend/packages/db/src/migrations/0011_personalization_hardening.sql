-- Phase R1/R2 Personalization, Edition-Scoped PKs, Usage Ledger & Card Snapshot Hardening

ALTER TABLE "learner_profiles"
  ADD COLUMN IF NOT EXISTS "preferred_tts_accent" text DEFAULT 'us' NOT NULL,
  ADD COLUMN IF NOT EXISTS "band_shift_ack_at" timestamp with time zone;

-- Scope learner_profiles & user_vocab_srs_sync safely by edition in shared Postgres deployments
ALTER TABLE "learner_profiles"
  DROP CONSTRAINT IF EXISTS "learner_profiles_pkey";
ALTER TABLE "learner_profiles"
  ADD CONSTRAINT "learner_profiles_account_key_edition_pk" PRIMARY KEY ("account_key", "edition");

ALTER TABLE "learner_roadmap_steps"
  ADD COLUMN IF NOT EXISTS "skill" text DEFAULT 'all' NOT NULL;

ALTER TABLE "user_vocab_srs_sync"
  ADD COLUMN IF NOT EXISTS "card_snapshot_json" jsonb;

ALTER TABLE "user_vocab_srs_sync"
  DROP CONSTRAINT IF EXISTS "user_vocab_srs_sync_account_key_card_id_pk";
ALTER TABLE "user_vocab_srs_sync"
  ADD CONSTRAINT "user_vocab_srs_sync_account_edition_card_pk" PRIMARY KEY ("account_key", "edition", "card_id");

ALTER TABLE "pronunciation_practices"
  ADD COLUMN IF NOT EXISTS "error_message" text;

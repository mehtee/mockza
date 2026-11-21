CREATE TABLE IF NOT EXISTS "linguistic_nodes" (
  "node_id" uuid PRIMARY KEY NOT NULL,
  "account_key" text NOT NULL,
  "edition" text NOT NULL,
  "node_kind" text NOT NULL,
  "canonical_key" text NOT NULL,
  "display_label_en" text NOT NULL,
  "display_label_fa" text,
  "mastery_score_milli" integer DEFAULT 400 NOT NULL,
  "signal_weight_milli" integer DEFAULT 500 NOT NULL,
  "evidence_count" integer DEFAULT 1 NOT NULL,
  "first_seen_day_serial" integer NOT NULL,
  "last_seen_day_serial" integer NOT NULL,
  "last_example_en" text,
  "coach_note_en" text,
  "coach_note_fa" text,
  "is_pinned" boolean DEFAULT false NOT NULL,
  "is_muted" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_linguistic_nodes_unique"
  ON "linguistic_nodes" ("account_key", "edition", "node_kind", "canonical_key");
CREATE INDEX IF NOT EXISTS "idx_linguistic_nodes_account"
  ON "linguistic_nodes" ("account_key", "edition", "node_kind");

CREATE TABLE IF NOT EXISTS "linguistic_evidence_events" (
  "event_id" uuid PRIMARY KEY NOT NULL,
  "account_key" text NOT NULL,
  "edition" text NOT NULL,
  "node_id" uuid NOT NULL REFERENCES "linguistic_nodes"("node_id") ON DELETE cascade,
  "source_kind" text NOT NULL,
  "source_ref_id" text NOT NULL,
  "observed_polarity" text NOT NULL,
  "excerpt_text" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_linguistic_events_account_created"
  ON "linguistic_evidence_events" ("account_key", "edition", "created_at");

CREATE TABLE IF NOT EXISTS "daily_missions" (
  "mission_id" uuid PRIMARY KEY NOT NULL,
  "account_key" text NOT NULL,
  "edition" text NOT NULL,
  "exam_track" text DEFAULT 'ielts_academic' NOT NULL,
  "mission_day_serial" integer NOT NULL,
  "status" text DEFAULT 'ready' NOT NULL,
  "target_node_keys_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "due_card_ids_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "focus_topic" text NOT NULL,
  "mission_payload_json" jsonb NOT NULL,
  "evaluation_result_json" jsonb,
  "model_id" text NOT NULL,
  "prompt_version" text NOT NULL,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_daily_missions_account_day"
  ON "daily_missions" ("account_key", "edition", "mission_day_serial");

CREATE TABLE IF NOT EXISTS "dropped_contents" (
  "drop_id" uuid PRIMARY KEY NOT NULL,
  "account_key" text NOT NULL,
  "edition" text NOT NULL,
  "input_kind" text NOT NULL,
  "source_ref_hash" text NOT NULL,
  "source_domain_or_label" text NOT NULL,
  "title" text NOT NULL,
  "cefr_estimate" text DEFAULT 'B2' NOT NULL,
  "detected_topics_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "extracted_phrases_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "drill_payload_json" jsonb NOT NULL,
  "media_object_keys_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "media_purged_at" timestamp with time zone,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_dropped_contents_account_created"
  ON "dropped_contents" ("account_key", "edition", "created_at");
CREATE INDEX IF NOT EXISTS "idx_dropped_contents_expires"
  ON "dropped_contents" ("expires_at");

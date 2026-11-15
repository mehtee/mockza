CREATE TABLE "account_links" (
	"link_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_subject" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_links_provider_subject_unique" UNIQUE("provider_subject")
);
--> statement-breakpoint
CREATE TABLE "ai_question_explanations" (
	"question_id" text NOT NULL,
	"pack_version" text NOT NULL,
	"skill" text NOT NULL,
	"explanation_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_question_explanations_question_id_pack_version_pk" PRIMARY KEY("question_id","pack_version")
);
--> statement-breakpoint
CREATE TABLE "catalog_packs" (
	"pack_id" text PRIMARY KEY NOT NULL,
	"edition" text NOT NULL,
	"exam_id" text NOT NULL,
	"skill" text NOT NULL,
	"version" text NOT NULL,
	"sha256" text NOT NULL,
	"byte_length" integer NOT NULL,
	"cdn_relative_path" text NOT NULL,
	"content_origin" text NOT NULL,
	"human_qa_reviewed" boolean DEFAULT false NOT NULL,
	"is_free_sample" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "daily_quota_usage" (
	"counter_key" text PRIMARY KEY NOT NULL,
	"account_key" text NOT NULL,
	"utc_day" text NOT NULL,
	"speaking_used" integer DEFAULT 0 NOT NULL,
	"writing_used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_quota_usage" (
	"counter_key" text PRIMARY KEY NOT NULL,
	"account_key" text NOT NULL,
	"utc_month" text NOT NULL,
	"total_used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_flags" (
	"flag_id" uuid PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"pack_id" text NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"device_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_reservations" (
	"reservation_id" uuid PRIMARY KEY NOT NULL,
	"attempt_id" uuid NOT NULL,
	"account_key" text NOT NULL,
	"skill" text NOT NULL,
	"utc_day" text NOT NULL,
	"utc_month" text NOT NULL,
	"status" text NOT NULL,
	"is_diagnostic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quota_reservations_attempt_id_unique" UNIQUE("attempt_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_type" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "app_version" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "linked_user_id" uuid;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "free_diagnostic_used" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "last_attested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "original_app_user_id" text;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "product_id" text;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "grace_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD COLUMN "account_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD COLUMN "pack_id" text;--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD COLUMN "exam_id" text;--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD COLUMN "task_type" text;--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD COLUMN "stage_detail" text;--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD COLUMN "input_json" jsonb;--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD COLUMN "latency_ms" integer;--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD COLUMN "token_usage_json" jsonb;--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD COLUMN "estimated_cost_usd_micros" integer;--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD COLUMN "attempts_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "account_links" ADD CONSTRAINT "account_links_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_flags" ADD CONSTRAINT "question_flags_device_id_devices_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("device_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_linked_user_id_users_user_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_evaluation_jobs_account_created" ON "evaluation_jobs" USING btree ("account_key","created_at");--> statement-breakpoint
CREATE INDEX "idx_evaluation_jobs_status_updated" ON "evaluation_jobs" USING btree ("status","updated_at");--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD CONSTRAINT "evaluation_jobs_attempt_id_unique" UNIQUE("attempt_id");
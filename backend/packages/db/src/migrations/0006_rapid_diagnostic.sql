ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "free_rapid_diagnostic_used" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "quota_reservations" ADD COLUMN IF NOT EXISTS "diag_session_id" uuid;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "diagnostic_sessions" (
	"diag_id" uuid PRIMARY KEY NOT NULL,
	"account_key" text NOT NULL,
	"device_id" uuid NOT NULL,
	"exam_id" text NOT NULL,
	"mode" text DEFAULT 'standard' NOT NULL,
	"policy_version" text NOT NULL,
	"content_version" text NOT NULL,
	"selection_seed" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"collection_deadline_at" timestamp with time zone NOT NULL,
	"results_deadline_at" timestamp with time zone NOT NULL,
	"current_stage" text DEFAULT 'intro' NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"objective_state_json" jsonb,
	"writing_attempt_id" uuid,
	"writing_job_id" uuid,
	"speaking_attempt_id" uuid,
	"speaking_job_id" uuid,
	"summary_json" jsonb,
	"result_revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "diagnostic_sessions" ADD CONSTRAINT "diagnostic_sessions_device_id_devices_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("device_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_diagnostic_sessions_account" ON "diagnostic_sessions" USING btree ("account_key","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_diagnostic_sessions_device" ON "diagnostic_sessions" USING btree ("device_id","created_at");

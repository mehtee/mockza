CREATE TABLE "job_dispatch_outbox" (
	"job_id" uuid PRIMARY KEY NOT NULL,
	"queue_name" text NOT NULL,
	"payload_json" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD COLUMN "input_hash" text;--> statement-breakpoint
ALTER TABLE "quota_reservations" ADD COLUMN "device_id" uuid;--> statement-breakpoint
ALTER TABLE "job_dispatch_outbox" ADD CONSTRAINT "job_dispatch_outbox_job_id_evaluation_jobs_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."evaluation_jobs"("job_id") ON DELETE cascade ON UPDATE no action;
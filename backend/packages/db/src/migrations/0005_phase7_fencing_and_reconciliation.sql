ALTER TABLE "devices" ADD COLUMN "upload_generation" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "erasing_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "erasure_requests" ADD COLUMN "receipt_token_hash" text;--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD COLUMN "execution_generation" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD COLUMN "claim_token" text;--> statement-breakpoint
ALTER TABLE "evaluation_jobs" ADD COLUMN "claim_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_dispatch_outbox" ADD COLUMN "dispatch_key" text;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "status" text DEFAULT 'processed' NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "target_identity" text;
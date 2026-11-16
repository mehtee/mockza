CREATE TABLE "auth_challenges" (
	"challenge" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erasure_requests" (
	"erasure_id" uuid PRIMARY KEY NOT NULL,
	"account_key" text NOT NULL,
	"device_ids_json" jsonb NOT NULL,
	"status" text NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_links" DROP CONSTRAINT "account_links_provider_subject_unique";--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "device_secret_hash" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "token_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "last_event_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "account_links" ADD CONSTRAINT "account_links_provider_subject_unique" UNIQUE("provider","provider_subject");
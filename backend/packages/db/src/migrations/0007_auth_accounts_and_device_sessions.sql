ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email_lower_unique" ON "users" (lower("email")) WHERE "email" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "slot_kind" text DEFAULT 'mobile' NOT NULL;
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "platform" text;
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "device_name" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_device_sessions" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"slot_kind" text NOT NULL,
	"platform" text DEFAULT 'unknown' NOT NULL,
	"app_surface" text DEFAULT 'flutter_app' NOT NULL,
	"device_name" text NOT NULL,
	"ip_masked" text,
	"location_label" text DEFAULT 'Unknown location' NOT NULL,
	"user_agent" text,
	"auth_method" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_device_sessions" ADD CONSTRAINT "user_device_sessions_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_device_sessions" ADD CONSTRAINT "user_device_sessions_device_id_devices_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("device_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_active_user_slot" ON "user_device_sessions" ("user_id","slot_kind") WHERE "revoked_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_active_device_session" ON "user_device_sessions" ("device_id") WHERE "revoked_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_device_sessions_user_active" ON "user_device_sessions" USING btree ("user_id","revoked_at","last_seen_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_entitlements" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"original_app_user_id" text,
	"product_id" text,
	"is_pro" boolean DEFAULT false NOT NULL,
	"accepted_device_policy_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"grace_until" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_entitlements" ADD CONSTRAINT "user_entitlements_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

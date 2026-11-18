ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_e164" text;
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_phone_e164_unique"
  ON "users" ("phone_e164")
  WHERE "phone_e164" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "otp_challenges" (
  "challenge_id" uuid PRIMARY KEY NOT NULL,
  "phone_e164" text NOT NULL,
  "code_hash" text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_otp_challenges_phone_created"
  ON "otp_challenges" ("phone_e164", "created_at");

CREATE TABLE IF NOT EXISTS "billing_orders" (
  "order_id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid REFERENCES "users"("user_id") ON DELETE cascade,
  "device_id" uuid NOT NULL REFERENCES "devices"("device_id") ON DELETE cascade,
  "edition" text NOT NULL,
  "provider" text NOT NULL,
  "plan_id" text NOT NULL,
  "currency" text NOT NULL,
  "amount_minor" integer NOT NULL,
  "authority" text NOT NULL UNIQUE,
  "ref_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "accepted_device_policy_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "verified_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "idx_billing_orders_user"
  ON "billing_orders" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_billing_orders_device"
  ON "billing_orders" ("device_id", "created_at");

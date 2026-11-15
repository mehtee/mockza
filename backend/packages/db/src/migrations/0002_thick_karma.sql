CREATE TABLE "exam_questions" (
	"question_id" text PRIMARY KEY NOT NULL,
	"pack_id" text NOT NULL,
	"section_id" text NOT NULL,
	"question_number" integer NOT NULL,
	"question_type" text NOT NULL,
	"prompt" text NOT NULL,
	"options_json" jsonb,
	"accepted_answers_json" jsonb NOT NULL,
	"evidence_json" jsonb,
	"cue_timestamp_ms" integer
);
--> statement-breakpoint
CREATE TABLE "exam_sections" (
	"section_id" text PRIMARY KEY NOT NULL,
	"pack_id" text NOT NULL,
	"section_index" integer NOT NULL,
	"section_type" text NOT NULL,
	"title" text NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"content_text" text DEFAULT '' NOT NULL,
	"paragraphs_json" jsonb,
	"transcript_json" jsonb,
	"media_object_key" text,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"metadata_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "micro_drills" (
	"drill_id" text PRIMARY KEY NOT NULL,
	"edition" text DEFAULT 'all' NOT NULL,
	"title" text NOT NULL,
	"drill_type" text NOT NULL,
	"skill" text DEFAULT 'reading' NOT NULL,
	"duration_seconds" integer DEFAULT 180 NOT NULL,
	"items_json" jsonb NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vocab_deck_cards" (
	"card_id" text PRIMARY KEY NOT NULL,
	"headword" text NOT NULL,
	"ipa" text DEFAULT '' NOT NULL,
	"definition" text NOT NULL,
	"topic_tag" text NOT NULL,
	"context_sentence" text NOT NULL,
	"paraphrases_json" jsonb NOT NULL,
	"collocations_json" jsonb NOT NULL,
	"ease_factor_milli" integer DEFAULT 2500 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_packs" ADD COLUMN "track" text DEFAULT 'academic' NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_packs" ADD COLUMN "title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_packs" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_packs" ADD COLUMN "duration_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_packs" ADD COLUMN "question_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog_packs" ADD COLUMN "accent" text;--> statement-breakpoint
ALTER TABLE "catalog_packs" ADD COLUMN "media_object_key" text;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_pack_id_catalog_packs_pack_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."catalog_packs"("pack_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_section_id_exam_sections_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."exam_sections"("section_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_sections" ADD CONSTRAINT "exam_sections_pack_id_catalog_packs_pack_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."catalog_packs"("pack_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_exam_questions_pack_number" ON "exam_questions" USING btree ("pack_id","question_number");--> statement-breakpoint
CREATE INDEX "idx_exam_sections_pack_order" ON "exam_sections" USING btree ("pack_id","section_index");--> statement-breakpoint
CREATE INDEX "idx_vocab_deck_topic" ON "vocab_deck_cards" USING btree ("topic_tag","headword");
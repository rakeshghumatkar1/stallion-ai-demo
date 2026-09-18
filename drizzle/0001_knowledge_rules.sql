ALTER TABLE "events" ADD COLUMN "sponsors" jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "announcements" jsonb;--> statement-breakpoint
ALTER TABLE "kb_documents" ADD COLUMN "source_type" text DEFAULT 'edition_config' NOT NULL;--> statement-breakpoint
ALTER TABLE "kb_documents" ADD COLUMN "provisional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "callback_requested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "answer_state" text;--> statement-breakpoint
-- Backfill (File 01 §2): existing evergreen documents belong to the 'evergreen' source bucket.
UPDATE "kb_documents" SET "source_type" = 'evergreen' WHERE "scope" = 'evergreen';

ALTER TABLE "product" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "specs" jsonb DEFAULT '{}'::jsonb NOT NULL;
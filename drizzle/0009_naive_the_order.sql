CREATE TABLE "order_status_config" (
	"id" text PRIMARY KEY NOT NULL,
	"pending_message" text DEFAULT '' NOT NULL,
	"completed_message" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

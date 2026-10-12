CREATE TABLE "contact_config" (
	"id" text PRIMARY KEY NOT NULL,
	"whatsapp_number" text DEFAULT '' NOT NULL,
	"order_email" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

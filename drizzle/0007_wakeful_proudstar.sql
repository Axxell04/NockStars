CREATE TABLE "shipping_city" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipping_city_name_key_unique" UNIQUE("name_key")
);
--> statement-breakpoint
CREATE TABLE "shipping_config" (
	"id" text PRIMARY KEY NOT NULL,
	"fee" double precision DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

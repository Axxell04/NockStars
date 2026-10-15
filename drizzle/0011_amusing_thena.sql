CREATE TABLE "product_view_daily" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"day" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_view_daily" ADD CONSTRAINT "product_view_daily_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_view_daily_unique_product_day" ON "product_view_daily" USING btree ("product_id","day");--> statement-breakpoint
CREATE INDEX "product_view_daily_day_idx" ON "product_view_daily" USING btree ("day");
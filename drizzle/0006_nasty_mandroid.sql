ALTER TABLE "cart_item" DROP CONSTRAINT "cart_item_product_id_product_id_fk";
--> statement-breakpoint
ALTER TABLE "order_item" DROP CONSTRAINT "order_item_product_id_product_id_fk";
--> statement-breakpoint
ALTER TABLE "cart_item" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_item" ALTER COLUMN "product_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "image_urls" jsonb;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE set null ON UPDATE no action;
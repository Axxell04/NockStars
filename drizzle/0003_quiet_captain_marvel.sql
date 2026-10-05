ALTER TABLE "img" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "img_product_id_sort_order_idx" ON "img" USING btree ("product_id","sort_order");--> statement-breakpoint
-- Backfill: no query read "img" with an ORDER BY before this change, so the
-- physical row order (ctid) is exactly what admins and customers already see.
-- Preserve it instead of inventing an order by id (ids are random, not time).
UPDATE "img" AS t
SET "sort_order" = s.rn
FROM (
	SELECT "ctid", row_number() OVER (PARTITION BY "product_id" ORDER BY "ctid") - 1 AS rn
	FROM "img"
) AS s
WHERE t."ctid" = s."ctid";

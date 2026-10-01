ALTER TABLE "product_variant" ADD COLUMN "color_hex" text;

--> statement-breakpoint
-- Backfill the swatch from the free-text label. The label is a human name, not a
-- CSS colour, so only unambiguous names are mapped; anything else lands on a
-- neutral grey that the admin can correct from the variant form.
UPDATE "product_variant"
SET "color_hex" = CASE lower(btrim("color"))
	WHEN 'negro' THEN '#000000'
	WHEN 'blanco' THEN '#ffffff'
	WHEN 'rojo' THEN '#dc2626'
	WHEN 'azul' THEN '#2563eb'
	WHEN 'verde' THEN '#16a34a'
	WHEN 'amarillo' THEN '#eab308'
	WHEN 'naranja' THEN '#ea580c'
	WHEN 'rosa' THEN '#ec4899'
	WHEN 'gris' THEN '#6b7280'
	WHEN 'gris claro' THEN '#d1d5db'
	WHEN 'gris oscuro' THEN '#374151'
	WHEN 'celeste' THEN '#38bdf8'
	WHEN 'beige' THEN '#d6c8ad'
	WHEN 'camel' THEN '#c19a6b'
	WHEN 'marron' THEN '#7c4a1e'
	WHEN 'marrón' THEN '#7c4a1e'
	WHEN 'borgona' THEN '#7f1d1d'
	WHEN 'turquesa' THEN '#14b8a6'
	ELSE '#808080'
END
WHERE "color_hex" IS NULL;

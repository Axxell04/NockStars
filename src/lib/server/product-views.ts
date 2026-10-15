import * as table from '$lib/server/db/schema';
import { getDb } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import { generateId } from './functions';

/**
 * Counts one view of a product page against today's row in
 * `product_view_daily`, creating the row on the first view of the day.
 *
 * "Today" is computed inside SQL as America/Guayaquil (Ecuador, UTC-5, no DST
 * — the timezone the storefront's `es-EC` formatting implies) so the day
 * bucket never depends on the Node process timezone.
 *
 * Callers must treat this as best-effort analytics: the public product page
 * wraps this in try/catch so a tracking failure can never break rendering.
 */
export async function recordProductView(productId: string): Promise<void> {
	await getDb()
		.insert(table.productViewDaily)
		.values({
			id: generateId(),
			productId,
			// Raw SQL: the bucket day must come from the DB clock in Guayaquil
			// time, not from `new Date()` on the server.
			day: sql<string>`(now() AT TIME ZONE 'America/Guayaquil')::date`,
			count: 1
		})
		.onConflictDoUpdate({
			target: [table.productViewDaily.productId, table.productViewDaily.day],
			set: { count: sql`${table.productViewDaily.count} + 1` }
		})
		.execute();
}

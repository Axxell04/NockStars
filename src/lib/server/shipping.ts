import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getDb } from './db';

// Single-row id: the config is an upsert target, not a lookup.
const CONFIG_ID = 'default';

export async function getShippingFee(): Promise<number> {
	const [row] = await getDb()
		.select({ fee: table.shippingConfig.fee })
		.from(table.shippingConfig)
		.where(eq(table.shippingConfig.id, CONFIG_ID))
		.execute();
	return row?.fee ?? 0;
}

export async function setShippingFee(fee: number): Promise<void> {
	const updatedAt = new Date();
	await getDb()
		.insert(table.shippingConfig)
		.values({ id: CONFIG_ID, fee, updatedAt })
		.onConflictDoUpdate({
			target: table.shippingConfig.id,
			set: { fee, updatedAt }
		})
		.execute();
}

import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getDb } from './db';

// Single-row id: the config is an upsert target, not a lookup.
const CONFIG_ID = 'default';

export async function getContactConfig(): Promise<table.ContactConfig | null> {
	const [row] = await getDb()
		.select()
		.from(table.contactConfig)
		.where(eq(table.contactConfig.id, CONFIG_ID))
		.execute();
	return row ?? null;
}

export async function setContactConfig(whatsappNumber: string, orderEmail: string): Promise<void> {
	const updatedAt = new Date();
	await getDb()
		.insert(table.contactConfig)
		.values({ id: CONFIG_ID, whatsappNumber, orderEmail, updatedAt })
		.onConflictDoUpdate({
			target: table.contactConfig.id,
			set: { whatsappNumber, orderEmail, updatedAt }
		})
		.execute();
}

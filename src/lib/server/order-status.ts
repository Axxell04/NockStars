import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getDb } from './db';

// Single-row id: the config is an upsert target, not a lookup. Mirrors
// shipping.ts. Both messages live in the same row so one save updates them
// atomically and there is no partial-state ordering to reason about.
const CONFIG_ID = 'default';

export type OrderStatusMessages = {
	pendingMessage: string;
	completedMessage: string;
};

/**
 * Both templates, or empty strings when the admin has not configured them.
 *
 * A missing row is not an error: the storefront simply renders no message, so a
 * fresh database works before anyone opens the editor.
 */
export async function getOrderStatusMessages(): Promise<OrderStatusMessages> {
	const [row] = await getDb()
		.select({
			pendingMessage: table.orderStatusConfig.pendingMessage,
			completedMessage: table.orderStatusConfig.completedMessage
		})
		.from(table.orderStatusConfig)
		.where(eq(table.orderStatusConfig.id, CONFIG_ID))
		.execute();

	return {
		pendingMessage: row?.pendingMessage ?? '',
		completedMessage: row?.completedMessage ?? ''
	};
}

export async function setOrderStatusMessages(messages: OrderStatusMessages): Promise<void> {
	const updatedAt = new Date();
	await getDb()
		.insert(table.orderStatusConfig)
		.values({ id: CONFIG_ID, ...messages, updatedAt })
		.onConflictDoUpdate({
			target: table.orderStatusConfig.id,
			set: { ...messages, updatedAt }
		})
		.execute();
}

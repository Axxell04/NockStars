import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { deleteOrder } from './order';

async function seedRevenue(value: number): Promise<string> {
	const id = `itest-revenue-${crypto.randomUUID()}`;
	await getDb()
		.insert(table.revenue)
		.values({ id, value, reason: 'order delete test', createdAt: new Date() })
		.execute();
	return id;
}

async function seedOrder(revenueId: string | null): Promise<string> {
	const id = `itest-order-${crypto.randomUUID()}`;
	await getDb()
		.insert(table.order)
		.values({ id, content: {}, clientName: 'Order delete test', revenueId })
		.execute();
	return id;
}

async function orderExists(id: string): Promise<boolean> {
	const rows = await getDb().select().from(table.order).where(eq(table.order.id, id)).execute();
	return rows.length > 0;
}

async function revenueExists(id: string): Promise<boolean> {
	const rows = await getDb().select().from(table.revenue).where(eq(table.revenue.id, id)).execute();
	return rows.length > 0;
}

describe('deleteOrder', () => {
	// The shared setup does not clean `revenue`, so this suite owns its rows.
	beforeEach(async () => {
		await getDb().delete(table.revenue).execute();
	});

	it('removes the order and the revenue it points at', async () => {
		const revenueId = await seedRevenue(1500);
		const orderId = await seedOrder(revenueId);

		await deleteOrder(orderId);

		expect(await orderExists(orderId)).toBe(false);
		expect(await revenueExists(revenueId)).toBe(false);
	});

	it('removes an order that has no revenue', async () => {
		const orderId = await seedOrder(null);

		await deleteOrder(orderId);

		expect(await orderExists(orderId)).toBe(false);
	});

	it('is a no-op for an id that does not exist', async () => {
		await expect(deleteOrder('itest-missing-order')).resolves.toBeUndefined();
	});
});

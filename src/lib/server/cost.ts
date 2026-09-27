import * as table from '$lib/server/db/schema';
import { getDb } from '$lib/server/db';
import { generateId } from './functions';
import { eq } from 'drizzle-orm';

export async function createCost(value: number, reason?: string) {
	const costId = generateId();
	const cost: table.CostInsert = {
		id: costId,
		value,
		reason: reason ?? null,
		createdAt: new Date()
	};

	await getDb().insert(table.cost).values(cost).execute();
}

export async function getCosts(page: number = 1, limit: number = 10) {
	const offset = (page - 1) * limit;
	const costs = await getDb()
		.select()
		.from(table.cost)
		.limit(limit)
		.offset(offset)
		.orderBy(table.cost.createdAt)
		.execute();

	const totalOrders = (await getDb().select().from(table.cost).execute()).length;
	const totalPages = Math.ceil(totalOrders / limit);

	return {
		costs,
		totalPages,
		currentPage: page
	};
}

export async function updateCost(id: string, value?: number, reason?: string) {
	if (typeof value !== 'undefined' && typeof reason !== 'undefined') {
		await getDb().update(table.cost).set({ value, reason }).where(eq(table.cost.id, id)).execute();
	} else if (typeof value !== 'undefined') {
		await getDb().update(table.cost).set({ value }).where(eq(table.cost.id, id)).execute();
	} else if (typeof reason !== 'undefined') {
		await getDb().update(table.cost).set({ reason }).where(eq(table.cost.id, id)).execute();
	}
}

export async function deleteCost(id: string) {
	await getDb().delete(table.cost).where(eq(table.cost.id, id));
}

export async function getTotalCost() {
	const costs = await getDb().select().from(table.cost).execute();
	const total = costs.reduce((pv, cv) => pv + cv.value, 0);
	return total;
}

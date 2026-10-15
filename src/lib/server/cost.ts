import * as table from '$lib/server/db/schema';
import { getDb } from '$lib/server/db';
import { generateId } from './functions';
import { count, eq, sql } from 'drizzle-orm';

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

	const [totalRow] = await getDb().select({ total: count() }).from(table.cost).execute();
	const totalPages = Math.ceil(Number(totalRow?.total ?? 0) / limit);

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
	const [row] = await getDb()
		.select({ total: sql<string>`coalesce(sum(${table.cost.value}), 0)` })
		.from(table.cost)
		.execute();
	return Number(row?.total ?? 0);
}

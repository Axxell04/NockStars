import * as table from '$lib/server/db/schema';
import { getDb } from '$lib/server/db';
import { generateId } from './functions';
import { desc, eq } from 'drizzle-orm';

export async function createRevenue(value: number, reason?: string) {
	const revenueId = generateId();
	const revenue: table.RevenueInsert = {
		id: revenueId,
		value,
		reason: reason ?? null,
		createdAt: new Date()
	};

	await getDb().insert(table.revenue).values(revenue).execute();

	return revenueId;
}

export async function getRevenues(page: number = 1, limit: number = 5) {
	const offset = (page - 1) * limit;
	const revenues = await getDb()
		.select()
		.from(table.revenue)
		.limit(limit)
		.offset(offset)
		.orderBy(desc(table.revenue.createdAt))
		.execute();

	const totalOrders = (await getDb().select().from(table.revenue).execute()).length;
	const totalPages = Math.ceil(totalOrders / limit);

	return {
		revenues,
		totalPages,
		currentPage: page
	};
}

export async function updateRevenue(id: string, value?: number, reason?: string) {
	const [order] = await getDb()
		.select()
		.from(table.order)
		.where(eq(table.order.revenueId, id))
		.execute();
	if (order) {
		return;
	}
	if (typeof value !== 'undefined' && typeof reason !== 'undefined') {
		await getDb()
			.update(table.revenue)
			.set({ value, reason })
			.where(eq(table.revenue.id, id))
			.execute();
	} else if (typeof value !== 'undefined') {
		await getDb().update(table.revenue).set({ value }).where(eq(table.revenue.id, id)).execute();
	} else if (typeof reason !== 'undefined') {
		await getDb().update(table.revenue).set({ reason }).where(eq(table.revenue.id, id)).execute();
	}
}

export async function deleteRevenue(id: string) {
	const [order] = await getDb()
		.select()
		.from(table.order)
		.where(eq(table.order.revenueId, id))
		.execute();
	if (order) {
		return;
	}
	await getDb().delete(table.revenue).where(eq(table.revenue.id, id));
}

export async function getTotalRevenue() {
	const revenues = await getDb().select().from(table.revenue).execute();
	const total = revenues.reduce((pv, cv) => pv + cv.value, 0);
	return total;
}

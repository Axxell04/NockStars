import * as table from '$lib/server/db/schema';
import { getDb } from '$lib/server/db';
import { generateId } from './functions';
import { count, desc, eq, sql } from 'drizzle-orm';
import type { BalanceMutationResult } from '$lib/interfaces/balance';

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

	const [totalRow] = await getDb().select({ total: count() }).from(table.revenue).execute();
	const totalPages = Math.ceil(Number(totalRow?.total ?? 0) / limit);

	return {
		revenues,
		totalPages,
		currentPage: page
	};
}

export async function updateRevenue(
	id: string,
	value?: number,
	reason?: string
): Promise<BalanceMutationResult> {
	const [order] = await getDb()
		.select()
		.from(table.order)
		.where(eq(table.order.revenueId, id))
		.execute();
	if (order) {
		// The row backs a completed order (order.revenueId points here), so
		// rewriting it would desync the order's receipt from the books.
		// Reported explicitly so the action can surface a notice instead of
		// looking like a successful edit that silently changed nothing.
		return { success: false, reason: 'order_linked' };
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
	return { success: true };
}

export async function deleteRevenue(id: string): Promise<BalanceMutationResult> {
	const [order] = await getDb()
		.select()
		.from(table.order)
		.where(eq(table.order.revenueId, id))
		.execute();
	if (order) {
		// Same protection as `updateRevenue`: deleting would orphan the
		// order's revenueId reference. Explicit result, no silent no-op.
		return { success: false, reason: 'order_linked' };
	}
	await getDb().delete(table.revenue).where(eq(table.revenue.id, id));
	return { success: true };
}

export async function getTotalRevenue() {
	const [row] = await getDb()
		.select({ total: sql<string>`coalesce(sum(${table.revenue.value}), 0)` })
		.from(table.revenue)
		.execute();
	return Number(row?.total ?? 0);
}

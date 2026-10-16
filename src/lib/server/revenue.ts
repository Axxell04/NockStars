import * as table from '$lib/server/db/schema';
import { getDb } from '$lib/server/db';
import { generateId } from './functions';
import { and, asc, count, desc, eq, gte, ilike, lt, sql } from 'drizzle-orm';
import type { BalanceMutationResult, BalanceSortKey } from '$lib/interfaces/balance';
import { BALANCE_PAGE_SIZE, DEFAULT_BALANCE_SORT } from '$lib/server/balance-list';

/** Fixed ORDER BY set for the whitelisted sort keys. */
function orderExpressions(sort: BalanceSortKey) {
	switch (sort) {
		case 'date_asc':
			return [asc(table.revenue.createdAt)];
		case 'value_desc':
			return [desc(table.revenue.value), desc(table.revenue.createdAt)];
		case 'value_asc':
			return [asc(table.revenue.value), desc(table.revenue.createdAt)];
		case 'reason_asc':
			return [asc(table.revenue.reason), desc(table.revenue.createdAt)];
		default:
			// date_desc — and createdAt desc doubles as the tiebreaker for the
			// other sorts so pagination stays stable.
			return [desc(table.revenue.createdAt)];
	}
}

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

/**
 * Rows of the revenue list, optionally bounded to the dashboard's half-open
 * date range [from, to): `createdAt >= from AND createdAt < to`, composed with
 * the `q` substring filter. Both optional bounds are omitted by legacy callers
 * (backward-compatible signature) and are applied identically to the row query
 * and the COUNT below.
 */
export async function getRevenues(
	page: number = 1,
	limit: number = BALANCE_PAGE_SIZE,
	q: string = '',
	sort: BalanceSortKey = DEFAULT_BALANCE_SORT,
	from?: Date,
	to?: Date
) {
	const offset = (page - 1) * limit;
	// Case-insensitive substring match on the reason. `ilike` parameterizes
	// the pattern, so user input never reaches the SQL text; `%`/`_` in the
	// query act as wildcards, which is acceptable for a contains search.
	// `and` drops the undefined conditions, so no filter still means "all".
	const filter = and(
		q ? ilike(table.revenue.reason, `%${q}%`) : undefined,
		from ? gte(table.revenue.createdAt, from) : undefined,
		to ? lt(table.revenue.createdAt, to) : undefined
	);

	const revenues = await getDb()
		.select()
		.from(table.revenue)
		.where(filter)
		.limit(limit)
		.offset(offset)
		.orderBy(...orderExpressions(sort))
		.execute();

	// The real COUNT applies the same filter, so totalPages stays honest
	// under an active search.
	const [totalRow] = await getDb()
		.select({ total: count() })
		.from(table.revenue)
		.where(filter)
		.execute();
	const totalItems = Number(totalRow?.total ?? 0);
	const totalPages = Math.ceil(totalItems / limit);

	return {
		revenues,
		totalPages,
		currentPage: page,
		totalItems
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

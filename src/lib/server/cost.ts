import * as table from '$lib/server/db/schema';
import { getDb } from '$lib/server/db';
import { generateId } from './functions';
import { asc, count, desc, eq, ilike, sql } from 'drizzle-orm';
import type { BalanceSortKey } from '$lib/interfaces/balance';
import { BALANCE_PAGE_SIZE, DEFAULT_BALANCE_SORT } from '$lib/server/balance-list';

/** Fixed ORDER BY set for the whitelisted sort keys. */
function orderExpressions(sort: BalanceSortKey) {
	switch (sort) {
		case 'date_asc':
			return [asc(table.cost.createdAt)];
		case 'value_desc':
			return [desc(table.cost.value), desc(table.cost.createdAt)];
		case 'value_asc':
			return [asc(table.cost.value), desc(table.cost.createdAt)];
		case 'reason_asc':
			return [asc(table.cost.reason), desc(table.cost.createdAt)];
		default:
			// date_desc — and createdAt desc doubles as the tiebreaker for the
			// other sorts so pagination stays stable.
			return [desc(table.cost.createdAt)];
	}
}

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

export async function getCosts(
	page: number = 1,
	limit: number = BALANCE_PAGE_SIZE,
	q: string = '',
	sort: BalanceSortKey = DEFAULT_BALANCE_SORT
) {
	const offset = (page - 1) * limit;
	// Case-insensitive substring match on the reason; parameterized by drizzle.
	const filter = q ? ilike(table.cost.reason, `%${q}%`) : undefined;

	const costs = await getDb()
		.select()
		.from(table.cost)
		.where(filter)
		.limit(limit)
		.offset(offset)
		.orderBy(...orderExpressions(sort))
		.execute();

	// The real COUNT applies the same filter, so totalPages stays honest
	// under an active search.
	const [totalRow] = await getDb()
		.select({ total: count() })
		.from(table.cost)
		.where(filter)
		.execute();
	const totalItems = Number(totalRow?.total ?? 0);
	const totalPages = Math.ceil(totalItems / limit);

	return {
		costs,
		totalPages,
		currentPage: page,
		totalItems
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

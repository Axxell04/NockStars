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
			return [asc(table.expense.createdAt)];
		case 'value_desc':
			return [desc(table.expense.value), desc(table.expense.createdAt)];
		case 'value_asc':
			return [asc(table.expense.value), desc(table.expense.createdAt)];
		case 'reason_asc':
			return [asc(table.expense.reason), desc(table.expense.createdAt)];
		default:
			// date_desc — and createdAt desc doubles as the tiebreaker for the
			// other sorts so pagination stays stable.
			return [desc(table.expense.createdAt)];
	}
}

export async function createExpense(value: number, reason?: string) {
	const expenseId = generateId();
	const expense: table.ExpenseInsert = {
		id: expenseId,
		value,
		reason: reason ?? null,
		createdAt: new Date()
	};

	await getDb().insert(table.expense).values(expense).execute();
}

export async function getExpenses(
	page: number = 1,
	limit: number = BALANCE_PAGE_SIZE,
	q: string = '',
	sort: BalanceSortKey = DEFAULT_BALANCE_SORT
) {
	const offset = (page - 1) * limit;
	// Case-insensitive substring match on the reason; parameterized by drizzle.
	const filter = q ? ilike(table.expense.reason, `%${q}%`) : undefined;

	const expenses = await getDb()
		.select()
		.from(table.expense)
		.where(filter)
		.limit(limit)
		.offset(offset)
		.orderBy(...orderExpressions(sort))
		.execute();

	// The real COUNT applies the same filter, so totalPages stays honest
	// under an active search.
	const [totalRow] = await getDb()
		.select({ total: count() })
		.from(table.expense)
		.where(filter)
		.execute();
	const totalItems = Number(totalRow?.total ?? 0);
	const totalPages = Math.ceil(totalItems / limit);

	return {
		expenses,
		totalPages,
		currentPage: page,
		totalItems
	};
}

export async function updateExpense(id: string, value?: number, reason?: string) {
	if (typeof value !== 'undefined' && typeof reason !== 'undefined') {
		await getDb()
			.update(table.expense)
			.set({ value, reason })
			.where(eq(table.expense.id, id))
			.execute();
	} else if (typeof value !== 'undefined') {
		await getDb().update(table.expense).set({ value }).where(eq(table.expense.id, id)).execute();
	} else if (typeof reason !== 'undefined') {
		await getDb().update(table.expense).set({ reason }).where(eq(table.expense.id, id)).execute();
	}
}

export async function deleteExpense(id: string) {
	await getDb().delete(table.expense).where(eq(table.expense.id, id));
}

export async function getTotalExpense() {
	const [row] = await getDb()
		.select({ total: sql<string>`coalesce(sum(${table.expense.value}), 0)` })
		.from(table.expense)
		.execute();
	return Number(row?.total ?? 0);
}

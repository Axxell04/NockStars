import * as table from '$lib/server/db/schema';
import { getDb } from '$lib/server/db';
import { generateId } from './functions';
import { count, eq, sql } from 'drizzle-orm';

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

export async function getExpenses(page: number = 1, limit: number = 10) {
	const offset = (page - 1) * limit;
	const expenses = await getDb()
		.select()
		.from(table.expense)
		.limit(limit)
		.offset(offset)
		.orderBy(table.expense.createdAt)
		.execute();

	const [totalRow] = await getDb().select({ total: count() }).from(table.expense).execute();
	const totalPages = Math.ceil(Number(totalRow?.total ?? 0) / limit);

	return {
		expenses,
		totalPages,
		currentPage: page
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

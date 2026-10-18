import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { drizzle } from 'drizzle-orm/postgres-js';
import { inArray } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '$lib/server/db/schema';
import { loginAsAdmin, waitForHydration } from './fixtures';

/**
 * Reproduction for "the balance view's filtering does not work": the dashboard
 * date range, the toolbar search and the sort select all have to reshape the
 * movements list without a full page reload.
 *
 * Three revenue rows with known values are seeded directly (created "now",
 * inside the default month-to-date range) and asserted in isolation by their
 * unique `e2e-` reasons, so pre-existing data in the table never makes the
 * order or the filter assertions ambiguous.
 *
 * Side effects on the shared development database: `loginAsAdmin` invalidates
 * the admin user's other sessions (the operator of a live dev server gets
 * logged out once), and the seeded rows appear in the list for the duration
 * of the test. Run this file alone, not alongside other admin suites.
 */

const SEEDED = [
	// value ascending across the three rows is b(10) < c(20) < a(30).
	{ suffix: 'a', value: 30 },
	{ suffix: 'b', value: 10 },
	{ suffix: 'c', value: 20 }
].map((entry) => ({
	id: `e2e-${randomUUID()}`,
	reason: `e2e-sort-${entry.suffix}`,
	value: entry.value
}));

const [ROW_A, ROW_B, ROW_C] = SEEDED;

async function withDb<T>(run: (db: ReturnType<typeof drizzleDb>) => Promise<T>): Promise<T> {
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error('DATABASE_URL is not set — playwright.config.ts must load .env');
	}
	const client = postgres(url, { max: 1 });
	try {
		return await run(drizzleDb(client));
	} finally {
		await client.end();
	}
}

function drizzleDb(client: ReturnType<typeof postgres>) {
	return drizzle(client, { schema });
}

test.beforeAll(async () => {
	await withDb((db) =>
		db.insert(schema.revenue).values(
			SEEDED.map((row) => ({
				id: row.id,
				value: row.value,
				reason: row.reason,
				createdAt: new Date()
			}))
		)
	);
});

test.afterAll(async () => {
	await withDb((db) =>
		db.delete(schema.revenue).where(
			inArray(
				schema.revenue.id,
				SEEDED.map((row) => row.id)
			)
		)
	);
});

test('balance list applies sort, search and date range', async ({ page }) => {
	test.setTimeout(120_000);

	// Surface client-side failures instead of letting them read as "nothing
	// happened": a hydration-time exception kills every use:enhance handler.
	page.on('pageerror', (error) => console.log('[pageerror]', error.message));
	page.on('console', (message) => {
		if (message.type() === 'error') {
			console.log('[browser-console]', message.text());
		}
	});

	await loginAsAdmin(page);
	await page.goto('/admin/balance');
	await waitForHydration(page);

	// The page opens on the Dashboard tab; the movements list lives behind
	// the Movimientos tab.
	await page.locator('[data-testid="tab-movimientos"]').click();
	await expect(page.locator('[data-testid="tab-movimientos"]')).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// Fresh sessions default to the 'resume' view (hooks.server.ts) — move to
	// the revenue list through the real dropdown so the toolbar renders.
	await page.locator('button[aria-haspopup="listbox"]').click();
	await page.locator('#balance-view-option-revenue').click();
	await expect(page.locator('#balance-sort')).toBeVisible();

	const pageText = () => page.evaluate(() => document.body.innerText);

	// Baseline: every seeded row is in the month-to-date range and on page 1.
	await expect.poll(async () => (await pageText()).includes(ROW_B.reason)).toBe(true);

	// 1) Sort — changing the select submits the search form. Across the three
	// seeded rows the document order must become b, c, a (10 < 20 < 30).
	await page.selectOption('#balance-sort', 'value_asc');
	await expect
		.poll(
			async () => {
				const text = await pageText();
				const order = [ROW_A.reason, ROW_B.reason, ROW_C.reason]
					.map((reason) => ({ reason, at: text.indexOf(reason) }))
					.sort((left, right) => left.at - right.at)
					.map((entry) => entry.reason)
					.join('|');
				return order;
			},
			{ timeout: 20_000 }
		)
		.toBe([ROW_B.reason, ROW_C.reason, ROW_A.reason].join('|'));

	// 2) Search — only the row whose reason contains the query may remain.
	await page.fill('#balance-search', ROW_B.reason);
	await page.getByRole('button', { name: 'Buscar' }).click();
	await expect
		.poll(async () => (await pageText()).includes(ROW_A.reason), { timeout: 20_000 })
		.toBe(false);
	await expect
		.poll(async () => (await pageText()).includes(ROW_C.reason), { timeout: 20_000 })
		.toBe(false);
	await expect(page.getByText(ROW_B.reason)).toBeVisible();

	// 3) Range — clearing the search restores the rows, then "Mes pasado"
	// (full GET navigation) must exclude rows created today, and returning to
	// "Mes actual" must bring them back.
	await page.fill('#balance-search', '');
	await page.getByRole('button', { name: 'Buscar' }).click();
	await expect
		.poll(async () => (await pageText()).includes(ROW_A.reason), { timeout: 20_000 })
		.toBe(true);

	await page.getByRole('link', { name: 'Mes pasado' }).click();
	await waitForHydration(page);

	// Tab persistence: a range navigation must keep the user on Movimientos —
	// the URL carries tab=movimientos and the tab button is still pressed.
	expect(new URL(page.url()).searchParams.get('tab')).toBe('movimientos');
	await expect(page.locator('[data-testid="tab-movimientos"]')).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	await expect
		.poll(async () => (await pageText()).includes(ROW_B.reason), { timeout: 20_000 })
		.toBe(false);

	await page.getByRole('link', { name: 'Mes actual' }).click();
	await waitForHydration(page);
	await expect
		.poll(async () => (await pageText()).includes(ROW_B.reason), { timeout: 20_000 })
		.toBe(true);
});

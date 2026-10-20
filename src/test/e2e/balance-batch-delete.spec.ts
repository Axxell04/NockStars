import { test, expect } from '@playwright/test';
import { drizzle } from 'drizzle-orm/postgres-js';
import { inArray } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from '$lib/server/db/schema';
import { loginAsAdmin, waitForHydration } from './fixtures';

/**
 * Regression for the balance list's batch delete: two movements are added
 * through the real "Añadir" panel, picked in selection mode, and removed with
 * a single Confirmar. Both timestamp-unique reasons must disappear from the
 * rendered copy, which proves the `?/delete_many_balance` action deleted the
 * rows AND refetched the pagination through `setBalanceDetailPagination`.
 *
 * Unlike balance-filter (which seeds rows directly), the rows are created
 * through the UI because the add flow is part of what this spec drives; the
 * afterAll only cleans up after a mid-test failure, keyed by the unique
 * reasons — it never touches other rows of the shared development database.
 * Per-row checkboxes are used instead of "Seleccionar todo" for the same
 * reason: select-all would also target rows this test never created.
 *
 * Side effects on the shared development database: `loginAsAdmin` invalidates
 * the admin user's other sessions (the operator of a live dev server gets
 * logged out once). Run this file alone, not alongside other admin suites.
 */

const stamp = Date.now();
const REASON_A = `e2e-batch-${stamp}-a`;
const REASON_B = `e2e-batch-${stamp}-b`;
const REASONS = [REASON_A, REASON_B];

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

test.afterAll(async () => {
	// Best-effort: on the happy path the batch delete already removed both
	// rows, so this is a no-op. It only matters when the test failed midway.
	await withDb((db) => db.delete(schema.revenue).where(inArray(schema.revenue.reason, REASONS)));
});

test('batch delete removes the selected balance movements', async ({ page }) => {
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
	await page.goto('/admin/finanzas');
	await waitForHydration(page);

	// The page opens on the Dashboard tab; the movements list (and its add
	// panel) lives behind the Movimientos tab.
	await page.locator('[data-testid="tab-movimientos"]').click();
	await expect(page.locator('[data-testid="tab-movimientos"]')).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// Fresh sessions default to the 'resume' view (hooks.server.ts) — move to
	// the revenue list so the toolbar and the Añadir panel render.
	await page.locator('button[aria-haspopup="listbox"]').click();
	await page.locator('#balance-view-option-revenue').click();
	await expect(page.locator('#balance-sort')).toBeVisible();

	const pageText = () => page.evaluate(() => document.body.innerText);

	// Add both movements through the real panel; each reason must render
	// before the next add, so the two rows are confirmed to exist up front.
	for (const reason of REASONS) {
		await page.getByRole('button', { name: 'Añadir', exact: true }).click();
		await page.locator('#reason').fill(reason);
		await page.locator('#value').fill('7');
		await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
		await expect
			.poll(async () => (await pageText()).includes(reason), { timeout: 20_000 })
			.toBe(true);
	}

	// Selection mode: check only this test's two rows, then batch delete.
	await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
	for (const reason of REASONS) {
		await page.getByRole('checkbox', { name: `Seleccionar movimiento ${reason}` }).check();
	}
	await page.getByRole('button', { name: 'Eliminar (2)' }).click();
	await page.getByRole('button', { name: 'Confirmar', exact: true }).click();

	// The success toast proves the use:enhance callback ran with the batch
	// result (a native POST fallback would skip it) — assert it first, it
	// auto-dismisses after a few seconds.
	await expect
		.poll(async () => (await pageText()).includes('2 movimientos eliminados'), {
			timeout: 15_000
		})
		.toBe(true);

	// The refetched pagination must no longer render either row.
	await expect
		.poll(async () => (await pageText()).includes(REASON_A), { timeout: 20_000 })
		.toBe(false);
	await expect
		.poll(async () => (await pageText()).includes(REASON_B), { timeout: 20_000 })
		.toBe(false);
});

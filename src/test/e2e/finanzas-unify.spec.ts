import { test, expect } from '@playwright/test';
import { loginAsAdmin, waitForHydration } from './fixtures';

/**
 * Covers the balance + pedidos unification under /admin/finanzas: the two
 * legacy admin routes redirect into the unified route preserving their
 * params, and the Pedidos tab keeps the old /admin/pedidos mechanics — the
 * view toggle (implicit form submit) and range navigation that stays on the
 * active tab.
 *
 * Data-agnostic: no rows are seeded, so only redirect and tab mechanics are
 * asserted and the shared development database's contents never make the
 * expectations ambiguous. One login — `loginAsAdmin` evicts other admin
 * sessions, so this spec must not run concurrently with other admin suites.
 */
test('legacy finance routes redirect and the pedidos tab keeps its mechanics', async ({ page }) => {
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

	// 1) /admin/balance keeps its whole query on the unified route — the old
	// from/to/tab params all stay valid there — and lands on Movimientos.
	await page.goto('/admin/balance?tab=movimientos&from=2026-01-01&to=2026-01-31');
	await waitForHydration(page);
	const balanceUrl = new URL(page.url());
	expect(balanceUrl.pathname).toBe('/admin/finanzas');
	expect(balanceUrl.searchParams.get('tab')).toBe('movimientos');
	expect(balanceUrl.searchParams.get('from')).toBe('2026-01-01');
	expect(balanceUrl.searchParams.get('to')).toBe('2026-01-31');
	await expect(page.locator('[data-testid="tab-movimientos"]')).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	// 2) /admin/pedidos redirects to the unified route on the Pedidos tab.
	await page.goto('/admin/pedidos');
	await waitForHydration(page);
	const pedidosUrl = new URL(page.url());
	expect(pedidosUrl.pathname).toBe('/admin/finanzas');
	expect(pedidosUrl.searchParams.get('tab')).toBe('pedidos');

	// 3) The orders view toggle lives in the shared bar on this tab; clicking
	// an option submits it and the trigger label flips. The cookie is pinned
	// first so the starting label is deterministic across runs.
	await page
		.context()
		.addCookies([{ name: 'order_view_state', value: 'pending', url: 'http://localhost:5173' }]);
	await page.goto('/admin/finanzas');
	await waitForHydration(page);
	await page.locator('[data-testid="tab-pedidos"]').click();
	await expect(page.locator('[data-testid="tab-pedidos"]')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('button', { name: 'Pendientes', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Pendientes', exact: true }).click();
	await page.getByRole('listbox').getByRole('button', { name: 'Completados' }).click();
	// The listbox closes with transition:scale, so the outgoing option button
	// stays in the DOM (and visible) until the out-transition ends. Wait for
	// the removal before matching the trigger, or both share the label.
	await expect(page.getByRole('listbox')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Completados', exact: true })).toBeVisible();

	// 4) A range preset click is a same-route navigation: it must keep the
	// Pedidos tab selected (the URL carries tab=pedidos) and the pane alive.
	await page.getByRole('link', { name: 'Mes pasado' }).click();
	await expect(page).toHaveURL(/\/admin\/finanzas\?.*tab=pedidos/);
	await expect(page.getByRole('button', { name: 'Completados', exact: true })).toBeVisible();
});

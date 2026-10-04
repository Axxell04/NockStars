import { randomUUID } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import {
	seedTestProduct,
	cleanupTestProduct,
	cleanupTestCart,
	loginAsAdmin,
	waitForHydration,
	type SeededProduct
} from './fixtures';

/**
 * The product exercised below is the catalogue entry the storefront actually
 * serves, so these tests need no fixtures of their own:
 *
 *   S / Negro  / recto      -> only cut is 'recto'
 *   S / Verde  / oversize   -> only cut is 'oversize'  (regression case)
 *   M / Blanco / oversize   -> only cut is 'oversize'  (regression case)
 *
 * `fixtures.ts` provides data for the suites that do need it; the original
 * draft's `prod-1` / `Test Product` / `Red` / `Blue` never existed and are now
 * referenced only by comments below.
 *
 * Every test in the selector suite is safe to run repeatedly:
 *   - selecting a variant only writes URL/session state;
 *   - adding to the cart writes to the cart session, which lives in the fresh
 *     browser context Playwright gives each test, so it never leaks;
 *   - product stock is decremented only at checkout (cart.ts), never on add,
 *     so browsing and adding cost nothing. The suites that do mutate the
 *     catalogue seed an `e2e-` product of their own and remove it in `finally`.
 */
const PRODUCT = 'em5y3nddwir4lyecrjcq5y3f';
const PRODUCT_URL = `/producto/${PRODUCT}`;

const sizeButton = (value: string) => `button[role="radio"][aria-label="Talla ${value}"]`;
const colourButton = (value: string) => `button[role="radio"][aria-label="Color ${value}"]`;

const SUMMARY = 'p:has-text("Variante seleccionada")';
const PENDING = 'p:has-text("Selecciona todas las opciones")';

// The cart page has no quantity input: the stepper form posts current ± 1 and
// the running total sits in a tabular span beside the buttons.
const QUANTITY = 'form[action="?/updateQuantity"] span.tabular-nums';

test.describe('Variant Selector', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(PRODUCT_URL, { waitUntil: 'load' });
		// The controls are server-rendered, but their handlers only exist once
		// SvelteKit has hydrated. There is no exposed hydration signal, so give
		// it a fixed settle window rather than clicking markup that ignores us.
		await page.waitForTimeout(1200);
	});

	test('narrows the colour list to the selected size', async ({ page }) => {
		// The page server-loads with a variant already selected, so the colour
		// list arrives filtered by that size. Select S explicitly to make the
		// starting point deterministic: Negro and Verde live in S, Blanco does not.
		await page.locator(sizeButton('S')).click();
		await expect(page.locator(colourButton('Negro'))).toBeVisible();
		await expect(page.locator(colourButton('Verde'))).toBeVisible();
		await expect(page.locator(colourButton('Blanco'))).toHaveCount(0);

		// M only has Blanco, so the other two disappear once that size is picked.
		await page.locator(sizeButton('M')).click();
		await expect(page.locator(colourButton('Blanco'))).toBeVisible();
		await expect(page.locator(colourButton('Negro'))).toHaveCount(0);
		await expect(page.locator(colourButton('Verde'))).toHaveCount(0);
	});

	test('resolves a variant whose only available cut is oversize', async ({ page }) => {
		// S / Verde is oversize-only. The cut must be re-seated onto the
		// combination's actual cut: the badge reads `availableCuts` while matching
		// reads `selectedCut`, and defaulting to 'recto' left these combinations
		// permanently unmatched — see fix bd2896e.
		await page.locator(sizeButton('S')).click();
		await page.locator(colourButton('Verde')).click();

		await expect(page.locator(SUMMARY)).toBeVisible();
		await expect(page.locator(PENDING)).toHaveCount(0);
	});

	test('resolves the other oversize-only combination', async ({ page }) => {
		await page.locator(sizeButton('M')).click();
		await page.locator(colourButton('Blanco')).click();

		await expect(page.locator(SUMMARY)).toBeVisible();
		await expect(page.locator(PENDING)).toHaveCount(0);
	});

	test('keeps asking while a dimension has not been chosen yet', async ({ page }) => {
		await page.locator(sizeButton('M')).click();

		await expect(page.locator(PENDING)).toBeVisible();
		await expect(page.locator(SUMMARY)).toHaveCount(0);
	});

	test('points the URL at the resolved variant', async ({ page }) => {
		await page.locator(sizeButton('S')).click();
		await page.locator(colourButton('Negro')).click();

		await expect(page).toHaveURL(/variant=/);
	});

	test('adds the resolved variant to the cart and says so', async ({ page }) => {
		await page.locator(sizeButton('S')).click();
		await page.locator(colourButton('Verde')).click();
		await expect(page.locator(SUMMARY)).toBeVisible();

		await page.locator('button:has-text("Añadir al carrito")').click();

		// The success notice goes through the layout-mounted Toaster queue.
		await expect(page.getByText('Producto añadido al carrito')).toBeVisible();

		await page.goto('/carrito');
		await expect(page.getByText('Verde')).toBeVisible();
	});
});

/*
 * The suites below own every row they touch: each seeds an `e2e-`-prefixed
 * product and removes it — plus any cart or order row it created — in
 * `finally`. Checkout deletes the order *before* the product because `order` is
 * not a child of `product`, and the admin suite runs serially because every
 * `login` calls `invalidateAllUserSessions`.
 *
 * Their assertions target copy the app actually renders. The drafts asserted
 * "Finalizar pedido", "Pedido creado", "Añadir variante", "Variante eliminada"
 * and "modificado por otra petición" — none of which exist anywhere in `src/`.
 */

test.describe('Multi-tab Version Conflict', () => {
	test('a stale write cannot rewind a newer one', async ({ page, context }) => {
		const product = await seedTestProduct({ name: 'E2E Multi-tab Product' });
		let cartSessionId: string | undefined;
		let second: Page | undefined;

		try {
			await page.goto(`/producto/${product.id}`);
			await waitForHydration(page);
			await page.getByRole('button', { name: 'Añadir al carrito' }).click();
			await expect(page.getByText('Producto añadido al carrito')).toBeVisible();

			await page.goto('/carrito');
			await waitForHydration(page);
			cartSessionId = (await page.context().cookies()).find(
				(c) => c.name === 'cart_session_id'
			)?.value;

			// The second tab shares the session but has its own snapshot: there is
			// no cross-tab invalidation, only a version check on the next write.
			second = await context.newPage();
			await second.goto('/carrito');
			await waitForHydration(second);
			await expect(second.locator(QUANTITY)).toHaveText('1');

			// First tab advances twice: quantity 3, version 3. Each click has to
			// land on the re-rendered form: a second click on the stale snapshot
			// would re-post version 1, and the guard under test would rightly
			// reject it — the increment would be lost, not delayed.
			await page.getByRole('button', { name: 'Aumentar cantidad' }).click();
			await expect(page.locator(QUANTITY)).toHaveText('2');
			await page.getByRole('button', { name: 'Aumentar cantidad' }).click();
			await expect(page.locator(QUANTITY)).toHaveText('3');

			// The stale tab posts quantity 2 at version 1. The version check rejects
			// it and re-seeds the list, so the cart keeps 3 instead of silently
			// rewinding to 2 — which is exactly what an unguarded write would do.
			await second.getByRole('button', { name: 'Aumentar cantidad' }).click();
			await expect(second.locator(QUANTITY)).toHaveText('3');
			await expect(second.locator('input[name="version"]')).toHaveValue('3');
		} finally {
			if (second) {
				await second.close();
			}
			if (cartSessionId) {
				await cleanupTestCart(cartSessionId);
			}
			await cleanupTestProduct(product.id);
		}
	});
});

test.describe('Admin Variant CRUD', () => {
	// Every login invalidates all of that user's sessions, so these four must
	// not overlap: a second login would evict the session of one still running.
	test.describe.configure({ mode: 'serial' });

	let product: SeededProduct;
	let productName: string;
	let cartSessionId: string | undefined;

	test.beforeEach(async ({ page }) => {
		cartSessionId = undefined;
		// A unique name per test keeps the product picker unambiguous even if an
		// earlier run leaked a row into the catalogue.
		productName = `E2E Variante ${randomUUID().slice(0, 8)}`;
		product = await seedTestProduct({ name: productName });

		await loginAsAdmin(page);

		// The Variantes tab only lists variants of the selected product. The
		// manual selection below still covers the click path; the
		// `?productId=&tab=variantes` deep link has its own test.
		await page.goto('/admin/catalogo');
		await waitForHydration(page);
		await page.getByRole('button', { name: 'Productos' }).click();
		await page.locator('[role="button"] h4', { hasText: productName }).click();
		await expect(page.getByText('Selección:')).toBeVisible();
		await page.getByRole('button', { name: 'Variantes' }).click();
		await expect(page.locator('table')).toBeVisible();
	});

	test.afterEach(async () => {
		if (cartSessionId) {
			await cleanupTestCart(cartSessionId);
		}
		await cleanupTestProduct(product.id);
	});

	test('honours the gestionar-variantes deep link', async ({ page }) => {
		// "Gestionar variantes" on the product editor lands here with the product
		// and tab in the query string. A full reload drops component state, so
		// anything the page shows can only have come from the URL.
		await page.goto(`/admin/catalogo?productId=${product.id}&tab=variantes`);

		await expect(page.getByText('Selección:')).toBeVisible();
		await expect(page.locator('table')).toBeVisible();
	});

	test('creates a variant', async ({ page }) => {
		await page.getByRole('button', { name: 'Nueva Variante' }).click();

		await page.locator('input[name="size"]').fill('XL');
		await page.locator('input[name="color"]').fill('Green');
		await page.locator('select[name="cut"]').selectOption('oversize');
		await page.locator('input[name="stock"]').fill('10');
		await page.locator('input[name="priceOverride"]').fill('44.99');
		await page.getByRole('button', { name: 'Crear variante' }).click();

		// No success copy exists, so the new row is the whole proof.
		await expect(page.locator('table tbody tr', { hasText: 'XL' })).toBeVisible();
		await expect(page.locator('table tbody tr', { hasText: 'Green' })).toBeVisible();
	});

	test('edits a variant', async ({ page }) => {
		const row = page.locator('table tbody tr', { hasText: 'Red' });
		await expect(row).toBeVisible();

		await row.getByRole('button', { name: 'Editar variante' }).click();
		await page.locator('input[name="stock"]').fill('20');
		await page.getByRole('button', { name: 'Guardar cambios' }).click();

		// Cells: imagen, talla, color, corte, stock.
		await expect(row.locator('td').nth(4)).toHaveText('20');
	});

	test('deletes a variant nothing references', async ({ page }) => {
		const row = page.locator('table tbody tr', { hasText: 'Red' });
		await expect(row).toBeVisible();

		await row.getByRole('button', { name: 'Eliminar variante' }).click();
		await page.getByRole('button', { name: 'Eliminar', exact: true }).click();

		await expect(row).toHaveCount(0);
		await expect(page.getByText('Este producto no tiene variantes')).toBeVisible();
	});

	test('blocks deleting a variant a cart still references', async ({ page }) => {
		// Add the variant from a second page in the same context, so the admin
		// session on `page` is left where it is.
		const customer = await page.context().newPage();
		try {
			await customer.goto(`/producto/${product.id}`);
			await waitForHydration(customer);
			await customer.getByRole('button', { name: 'Añadir al carrito' }).click();
			await expect(customer.getByText('Producto añadido al carrito')).toBeVisible();
			cartSessionId = (await customer.context().cookies()).find(
				(c) => c.name === 'cart_session_id'
			)?.value;
		} finally {
			await customer.close();
		}

		const row = page.locator('table tbody tr', { hasText: 'Red' });
		await expect(row).toBeVisible();

		await row.getByRole('button', { name: 'Eliminar variante' }).click();
		await page.getByRole('button', { name: 'Eliminar', exact: true }).click();

		await expect(
			page.getByText('No se puede eliminar la variante: está referenciada en un carrito')
		).toBeVisible();
		await expect(row).toHaveCount(1);
	});
});

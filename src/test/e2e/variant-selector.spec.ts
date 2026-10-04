import { test, expect } from '@playwright/test';

/**
 * The product exercised below is the catalogue entry the storefront actually
 * serves, so these tests need no fixtures of their own:
 *
 *   S / Negro  / recto      -> only cut is 'recto'
 *   S / Verde  / oversize   -> only cut is 'oversize'  (regression case)
 *   M / Blanco / oversize   -> only cut is 'oversize'  (regression case)
 *
 * `fixtures.ts` provides data for the suites that do need it; the original
 * draft's `prod-1` / `Test Product` / `Red` / `Blue` never existed and are
 * now referenced only by dormant tests.
 *
 * Every test here is safe to run repeatedly:
 *   - selecting a variant only writes URL/session state;
 *   - adding to the cart writes to the cart session, which lives in the fresh
 *     browser context Playwright gives each test, so it never leaks;
 *   - product stock is decremented only at checkout (cart.ts), never on add,
 *     which is exactly why the checkout suite below is fixme'd instead of run.
 */
const PRODUCT = 'em5y3nddwir4lyecrjcq5y3f';
const PRODUCT_URL = `/producto/${PRODUCT}`;

const sizeButton = (value: string) => `button[role="radio"][aria-label="Talla ${value}"]`;
const colourButton = (value: string) => `button[role="radio"][aria-label="Color ${value}"]`;

const SUMMARY = 'p:has-text("Variante seleccionada")';
const PENDING = 'p:has-text("Selecciona todas las opciones")';

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
 * Fixtures live in `./fixtures` now, but the suites below still need scoping
 * work before they can run: checkout has to own both the product and the order
 * it creates (an order row is not a child of the product, so product cleanup
 * alone would leave it behind), and the admin suites have to share a single
 * login because `login` calls `invalidateAllUserSessions`.
 *
 * They stay as `describe.fixme` so the intent is preserved and the suite stays
 * green instead of training everyone to ignore red.
 *
 * Cookie migration was the first suite to graduate: see
 * `migration-checkout.spec.ts`, which now seeds its own product.
 */

test.describe.fixme('Checkout Flow', () => {
	test.beforeEach(async ({ page }) => {
		// Create test product via API or seed
		await page.goto('/');
	});

	test('should add variant to cart, update quantity, checkout, and clear cart', async ({
		page
	}) => {
		// Go to product detail page
		await page.goto('/producto/prod-1?variant=var-1');

		// Verify variant is selected
		await expect(page.locator('text=M / Red / recto')).toBeVisible();

		// Add to cart
		await page.click('button:has-text("Añadir al carrito")');
		await expect(page.locator('text=Producto añadido al carrito')).toBeVisible();

		// Go to cart
		await page.goto('/carrito');

		// Update quantity
		await page.fill('input[name="quantity"]', '3');
		await page.click('button:has-text("Actualizar")');

		// Verify quantity updated
		await expect(page.locator('input[name="quantity"]')).toHaveValue('3');

		// Checkout
		await page.click('button:has-text("Finalizar pedido")');

		// Verify order created
		await expect(page.locator('text=Pedido creado')).toBeVisible();

		// Go to order detail
		const orderLink = page.locator('a[href^="/pedido/"]').first();
		await orderLink.click();

		// Verify order shows variant details
		await expect(page.locator('text=M')).toBeVisible();
		await expect(page.locator('text=Red')).toBeVisible();
		await expect(page.locator('text=recto')).toBeVisible();

		// Cart should be cleared
		await page.goto('/carrito');
		await expect(page.locator('text=Tu carrito está vacío')).toBeVisible();
	});
});

test.describe.fixme('Multi-tab Version Conflict', () => {
	test('should detect version conflict and auto-reload', async ({ page, context }) => {
		// Open first tab
		await page.goto('/producto/prod-1?variant=var-1');
		await page.click('button:has-text("Añadir al carrito")');
		await page.goto('/carrito');

		// Open second tab
		const page2 = await context.newPage();
		await page2.goto('/carrito');

		// Update quantity in first tab
		await page.fill('input[name="quantity"]', '3');
		await page.click('button:has-text("Actualizar")');

		// Try to update in second tab with stale version
		await page2.fill('input[name="quantity"]', '5');
		await page2.click('button:has-text("Actualizar")');

		// Should show version conflict error
		await expect(page2.locator('text=modificado por otra petición')).toBeVisible();

		// Should auto-reload or show refresh option
		await expect(page2.locator('button:has-text("Recargar")')).toBeVisible();
	});
});

test.describe.fixme('Admin Variant CRUD', () => {
	test.beforeEach(async ({ page }) => {
		// Login as admin
		await page.goto('/login');
		await page.fill('input[name="username"]', 'admin');
		await page.fill('input[name="password"]', 'admin123');
		await page.click('button:has-text("Iniciar sesión")');
		await page.goto('/admin/catalogo');
	});

	test('should create variant', async ({ page }) => {
		// Click add variant button
		await page.click('button:has-text("Añadir variante")');

		// Fill form
		await page.fill('input[name="size"]', 'XL');
		await page.fill('input[name="color"]', 'Green');
		await page.selectOption('select[name="cut"]', 'oversize');
		await page.fill('input[name="stock"]', '10');
		await page.fill('input[name="priceOverride"]', '44.99');

		// Submit
		await page.click('button:has-text("Guardar")');

		// Verify created
		await expect(page.locator('text=XL')).toBeVisible();
		await expect(page.locator('text=Green')).toBeVisible();
		await expect(page.locator('text=oversize')).toBeVisible();
	});

	test('should edit variant', async ({ page }) => {
		// Click edit on existing variant
		await page.click('button[aria-label="Editar variante"]:first-child');

		// Update stock
		await page.fill('input[name="stock"]', '20');
		await page.click('button:has-text("Guardar")');

		// Verify updated
		await expect(page.locator('text=20')).toBeVisible();
	});

	test('should delete variant not in cart/order', async ({ page }) => {
		// Click delete on variant not in use
		await page.click('button[aria-label="Eliminar variante"]:first-child');
		await page.click('button:has-text("Confirmar")');

		// Verify deleted
		await expect(page.locator('text=Variante eliminada')).toBeVisible();
	});

	test('should block deletion of variant in active cart', async ({ page }) => {
		// First add variant to cart as customer
		const customerPage = await page.context().newPage();
		await customerPage.goto('/producto/prod-1?variant=var-1');
		await customerPage.click('button:has-text("Añadir al carrito")');

		// Now try to delete as admin
		await page.click('button[aria-label="Eliminar variante"]:first-child');
		await page.click('button:has-text("Confirmar")');

		// Should show error
		await expect(page.locator('text=variante está en uso')).toBeVisible();
		await expect(page.locator('text=carrito activo')).toBeVisible();
	});
});

import { test, expect } from '@playwright/test';
import { seedTestProduct, cleanupTestProduct } from './fixtures';

test.describe('Cookie Migration', () => {
	test('v1 cookie should migrate to v2 on first visit', async ({ page }) => {
		const product = await seedTestProduct({ name: 'Test Product' });

		try {
			await page.goto('/');

			// Set the v1 legacy cookie against a product this test created, so the
			// migration has something real to resolve and clean up can be exact.
			await page.evaluate((productId) => {
				const item = { productId, quantity: 2, size: 'M', color: 'Red', cut: 'recto' };
				document.cookie = `cart=${JSON.stringify([item])}; path=/; max-age=2592000`;
			}, product.id);

			await page.reload();

			// Read through the context, not document.cookie: the server issues
			// cart_session_id as httpOnly, so it is deliberately invisible to JS.
			const cookies = await page.context().cookies();

			// v2 cookie exists
			expect(cookies.find((c) => c.name === 'cart_session_id')).toBeTruthy();

			// v1 cookie is gone
			expect(cookies.find((c) => c.name === 'cart')).toBeFalsy();

			// Cart actually carried the item over
			await page.goto('/carrito');
			await expect(page.getByText('Test Product').first()).toBeVisible();
		} finally {
			await cleanupTestProduct(product.id);
		}
	});
});

// Checkout settles a real order and decrements stock. It stays dormant until
// the harness can scope both the product and the order it creates — see the
// duplicate in variant-selector.spec.ts for the full reasoning.
test.describe.fixme('Checkout Flow', () => {
	test('complete checkout with variant', async ({ page }) => {
		// Visit product with variant
		await page.goto('/producto/prod-1?variant=var-1');

		// Add to cart
		await page.click('button:has-text("Añadir al carrito")');
		await expect(page.locator('text=Producto añadido al carrito')).toBeVisible();

		// Go to cart
		await page.goto('/carrito');

		// Update quantity
		await page.fill('input[name="quantity"]', '2');
		await page.click('button:has-text("Actualizar")');

		// Checkout
		await page.click('button:has-text("Finalizar pedido")');

		// Verify order
		await expect(page.locator('text=Pedido creado')).toBeVisible();

		// Check order detail
		const orderLink = page.locator('a[href^="/pedido/"]').first();
		await orderLink.click();

		// Verify variant snapshots
		await expect(page.locator('text=M')).toBeVisible();
		await expect(page.locator('text=Red')).toBeVisible();
		await expect(page.locator('text=recto')).toBeVisible();

		// Cart cleared
		await page.goto('/carrito');
		await expect(page.locator('text=Tu carrito está vacío')).toBeVisible();
	});
});

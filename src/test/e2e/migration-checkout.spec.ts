import { test, expect } from '@playwright/test';

// Both suites below are marked fixme (see variant-selector.spec.ts): they seed
// fixture ids (`prod-1`, `var-1`, `Test Product`) that only exist in the
// original dev seed, and the checkout flow settles a real order against the live
// database. Neither can run until there is a seed/fixture harness in front of
// the suite. Nothing is deleted here — flip them back to `test.describe` once
// that harness exists.
test.describe.fixme('Cookie Migration', () => {
	test('v1 cookie should migrate to v2 on first visit', async ({ page }) => {
		await page.goto('/');

		// Set v1 legacy cookie
		await page.evaluate(() => {
			document.cookie =
				'cart=[{"productId":"prod-1","quantity":2,"size":"M","color":"Red","cut":"recto"}]; path=/; max-age=2592000';
		});

		await page.reload();

		// Check v2 cookie exists
		const v2Cookie = await page.evaluate(() =>
			document.cookie.split('; ').find((c) => c.startsWith('cart_session_id='))
		);
		expect(v2Cookie).toBeTruthy();

		// Check v1 cookie is gone
		const v1Cookie = await page.evaluate(() =>
			document.cookie.split('; ').find((c) => c.startsWith('cart='))
		);
		expect(v1Cookie).toBeFalsy();

		// Verify cart migrated
		await page.goto('/carrito');
		await expect(page.locator('text=Test Product')).toBeVisible();
	});
});

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

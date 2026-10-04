import { test, expect } from '@playwright/test';
import {
	seedTestProduct,
	cleanupTestProduct,
	cleanupTestCart,
	cleanupTestOrders,
	waitForHydration
} from './fixtures';

test.describe('Cookie Migration', () => {
	test('v1 cookie should migrate to v2 on first visit', async ({ page }) => {
		const product = await seedTestProduct({ name: 'Test Product' });

		try {
			// Set the v1 legacy cookie against a product this test created, so the
			// migration has something real to resolve and clean up can be exact.
			// Seeded before the first navigation: after hydration the storefront
			// cart sync POSTs its own httpOnly `cart` cookie, which would shadow
			// a later `document.cookie` write (JS cannot overwrite httpOnly).
			const item = { productId: product.id, quantity: 2, size: 'M', color: 'Red', cut: 'recto' };
			await page
				.context()
				.addCookies([
					{ name: 'cart', value: JSON.stringify([item]), domain: 'localhost', path: '/' }
				]);

			await page.goto('/');

			// Read through the context, not document.cookie: the server issues
			// cart_session_id as httpOnly, so it is deliberately invisible to JS.
			const cookies = await page.context().cookies();

			// v2 cookie exists
			expect(cookies.find((c) => c.name === 'cart_session_id')).toBeTruthy();

			// v1 cookie is gone. Match the JS-visible cookie only: the storefront
			// cart sync (`?/update_cart`) reuses the `cart` name for its own
			// httpOnly blob and can land before this read, which would make a
			// name-only assertion flaky. The legacy cookie was set from JS, so
			// it is the only `cart` cookie that is not httpOnly.
			expect(cookies.find((c) => c.name === 'cart' && !c.httpOnly)).toBeFalsy();

			// Cart actually carried the item over
			await page.goto('/carrito');
			await expect(page.getByText('Test Product').first()).toBeVisible();
		} finally {
			await cleanupTestProduct(product.id);
		}
	});
});

// Checkout decrements stock and settles an order, so both are scoped to a
// seeded `e2e-` product and torn down in `finally`. The order has to be removed
// before the product: nothing cascades from the product up to `order`, so
// deleting the product first would strand an empty order row.
test.describe('Checkout Flow', () => {
	test('adds a variant, updates quantity, checks out and empties the cart', async ({ page }) => {
		const product = await seedTestProduct({ name: 'E2E Checkout Product' });
		// Derived from the product id, so repeated runs never share an order.
		const clientName = `E2E Cliente ${product.id}`;
		let cartSessionId: string | undefined;

		try {
			await page.goto(`/producto/${product.id}`);
			await waitForHydration(page);
			await page.getByRole('button', { name: 'Añadir al carrito' }).click();
			await expect(page.getByText('Producto añadido al carrito')).toBeVisible();

			await page.goto('/carrito');
			await waitForHydration(page);

			// Quantity is a pair of steppers, not a text field: the form posts
			// current ± 1 and the readout is the tabular span beside them.
			await page.getByRole('button', { name: 'Aumentar cantidad' }).click();
			await expect(page.locator('form[action="?/updateQuantity"] span.tabular-nums')).toHaveText(
				'2'
			);

			// Capture the session before checkout: the action deletes the cookie,
			// but the cart row itself is never removed by the app.
			cartSessionId = (await page.context().cookies()).find(
				(c) => c.name === 'cart_session_id'
			)?.value;

			await page.getByRole('button', { name: 'Proceder al pago' }).click();
			await page.fill('#client-name', clientName);
			await page.locator('form[action="?/send_cart"] button[type="submit"]').click();

			// Success closes the modal and opens wa.me in a popup; the app renders
			// no confirmation copy, so the observable proof is the emptied cart.
			await expect(page.locator('form[action="?/send_cart"]')).toBeHidden();

			await page.goto('/carrito');
			await expect(page.getByText('Tu carrito está vacío')).toBeVisible();

			expect(await cleanupTestOrders(clientName)).toBe(1);
		} finally {
			await cleanupTestOrders(clientName);
			if (cartSessionId) {
				await cleanupTestCart(cartSessionId);
			}
			await cleanupTestProduct(product.id);
		}
	});
});

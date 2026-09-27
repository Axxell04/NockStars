import { test, expect } from '@playwright/test';

test.describe('Cookie Migration v1 → v2', () => {
	test('should migrate v1 cookie to v2 on first visit', async ({ page }) => {
		// Set up v1 cookie (legacy cart format)
		await page.goto('/');
		await page.evaluate(() => {
			document.cookie =
				'cart=[{"productId":"prod-1","quantity":2,"size":"M","color":"Red","cut":"recto"}]; path=/; max-age=2592000';
		});

		// Reload to trigger migration
		await page.reload();

		// Check v2 cookie is set
		const v2Cookie = await page.evaluate(() => {
			return document.cookie.split('; ').find((c) => c.startsWith('cart_session_id='));
		});
		expect(v2Cookie).toBeDefined();

		// Check v1 cookie is cleared
		const v1Cookie = await page.evaluate(() => {
			return document.cookie.split('; ').find((c) => c.startsWith('cart='));
		});
		expect(v1Cookie).toBeUndefined();

		// Verify cart was migrated by checking cart page
		await page.goto('/carrito');
		await expect(page.locator('text=Test Product')).toBeVisible();
		await expect(page.locator('text=M / Red / recto')).toBeVisible();
	});
});

test.describe('Checkout Flow', () => {
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

test.describe('Variant Selector', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/producto/prod-1');
	});

	test('should update URL when size and color selected', async ({ page }) => {
		// Click size
		await page.click('button[role="radio"]:has-text("M")');

		// Click color
		await page.click('button[role="radio"]:has-text("Red")');

		// URL should update
		await expect(page).toHaveURL(/variant=/);
	});

	test('should update images, price, and stock when variant selected', async ({ page }) => {
		const initialPrice = await page.locator('.text-brand-400.text-3xl').textContent();

		// Select size M
		await page.click('button[role="radio"]:has-text("M")');

		// Select color Red
		await page.click('button[role="radio"]:has-text("Red")');

		// Price should update to variant price
		const updatedPrice = await page.locator('.text-brand-400.text-3xl').textContent();
		expect(updatedPrice).not.toBe(initialPrice);

		// Stock should show variant stock
		await expect(page.locator('text=Solo 5 unidades')).toBeVisible();

		// Images should update
		const variantImage = page.locator('img[alt*="Red"]').first();
		await expect(variantImage).toBeVisible();
	});

	test('should support keyboard navigation', async ({ page }) => {
		// Focus first size option
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');
		await page.keyboard.press('Tab');

		const sizeButton = page.locator('button[role="radio"]:has-text("M")');
		await sizeButton.focus();

		// Navigate with arrows
		await page.keyboard.press('ArrowRight');
		await expect(page.locator('button[role="radio"]:has-text("L")')).toBeFocused();

		await page.keyboard.press('ArrowLeft');
		await expect(sizeButton).toBeFocused();

		// Select with Enter
		await page.keyboard.press('Enter');

		// Color options should appear
		await expect(page.locator('button[role="radio"]:has-text("Red")')).toBeVisible();
	});

	test('should show "Agotado" for out of stock combinations', async ({ page }) => {
		// Select size that has out of stock combination
		await page.click('button[role="radio"]:has-text("M")');

		// Blue might be out of stock
		const blueButton = page.locator('button[role="radio"]:has-text("Blue")');
		await expect(blueButton).toHaveAttribute('aria-disabled', 'true');

		// Hover should show tooltip
		await blueButton.hover();
		await expect(page.locator('text=Agotado')).toBeVisible();
	});
});

test.describe('Multi-tab Version Conflict', () => {
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

test.describe('Admin Variant CRUD', () => {
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

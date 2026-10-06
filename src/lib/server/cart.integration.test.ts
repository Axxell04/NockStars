import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { CartErrorCode } from '$lib/actions';
import { addCartItem, getCartItemCount } from './cart';
import { setVariantActive } from './product';

/**
 * Seeds a product with one product-level image row so the setup teardown
 * exercises the img-before-product FK delete order as well.
 */
async function seedProductWithImage(): Promise<string> {
	const productId = `itest-product-${crypto.randomUUID()}`;
	await getDb()
		.insert(table.product)
		.values({ id: productId, name: 'Integration test product', price: 10, stock: 100 })
		.execute();
	await getDb()
		.insert(table.img)
		.values({ id: crypto.randomUUID(), url: 'https://example.test/img.png', productId })
		.execute();
	return productId;
}

async function seedCart(sessionId: string): Promise<string> {
	await getDb().insert(table.cart).values({ sessionId }).execute();
	const [row] = await getDb()
		.select({ id: table.cart.id })
		.from(table.cart)
		.where(eq(table.cart.sessionId, sessionId))
		.execute();
	return row.id;
}

async function seedCartItem(cartId: string, productId: string, quantity: number): Promise<void> {
	await getDb()
		.insert(table.cartItem)
		.values({ cartId, productId, quantity, unitPriceSnapshot: '10.00', version: 1 })
		.execute();
}

describe('getCartItemCount', () => {
	it('returns the sum of line quantities for a session cart (2 + 3 = 5)', async () => {
		const sessionId = crypto.randomUUID();
		const productId = await seedProductWithImage();
		const cartId = await seedCart(sessionId);
		await seedCartItem(cartId, productId, 2);
		await seedCartItem(cartId, productId, 3);

		expect(await getCartItemCount(sessionId)).toBe(5);
	});

	it('returns 0 for an unknown session', async () => {
		expect(await getCartItemCount(crypto.randomUUID())).toBe(0);
	});

	it('returns 0 for an undefined session', async () => {
		expect(await getCartItemCount(undefined)).toBe(0);
	});

	it('returns 0 for a session with an empty cart', async () => {
		const sessionId = crypto.randomUUID();
		await seedCart(sessionId);

		expect(await getCartItemCount(sessionId)).toBe(0);
	});

	it('returns 0 for a malformed (non-UUID) session cookie', async () => {
		expect(await getCartItemCount('not-a-uuid')).toBe(0);
	});
});

async function seedVariant(productId: string): Promise<string> {
	const variantId = crypto.randomUUID();
	await getDb()
		.insert(table.productVariant)
		.values({ id: variantId, productId, size: 'M', color: 'Negro', cut: 'oversize', stock: 5 })
		.execute();
	return variantId;
}

describe('addCartItem variant visibility', () => {
	it('accepts an active variant and rejects the same variant once deactivated', async () => {
		const sessionId = crypto.randomUUID();
		const productId = await seedProductWithImage();
		const variantId = await seedVariant(productId);
		const cartId = await seedCart(sessionId);

		const added = await addCartItem(cartId, { productId, variantId, quantity: 1 });
		expect(added.success).toBe(true);

		await setVariantActive(variantId, false);

		const rejected = await addCartItem(cartId, { productId, variantId, quantity: 1 });
		expect(rejected.success).toBe(false);
		if (!rejected.success) {
			expect(rejected.error.code).toBe(CartErrorCode.INVALID_VARIANT);
			expect(rejected.error.message).toBe('Variant is no longer available');
		}

		// The rejection happens before any write: the cart still holds only the
		// line that was added while the variant was active.
		const lines = await getDb()
			.select({ id: table.cartItem.id })
			.from(table.cartItem)
			.where(eq(table.cartItem.cartId, cartId))
			.execute();
		expect(lines).toHaveLength(1);
	});
});

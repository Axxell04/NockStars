import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { ProductErrorCode } from '$lib/actions';
import {
	deleteProduct,
	getProductWithVariants,
	getProducts,
	purgeInactiveProducts,
	setProductActive
} from './product';

const DAY = 86_400_000;

async function seedProduct(name = 'Visibility test product'): Promise<string> {
	const id = `itest-product-${crypto.randomUUID()}`;
	await getDb().insert(table.product).values({ id, name, price: 10, stock: 10 }).execute();
	return id;
}

async function readDeactivatedAt(productId: string): Promise<Date | null> {
	const [row] = await getDb()
		.select({ deactivatedAt: table.product.deactivatedAt })
		.from(table.product)
		.where(eq(table.product.id, productId))
		.execute();
	return row?.deactivatedAt ?? null;
}

async function productExists(productId: string): Promise<boolean> {
	const rows = await getDb()
		.select({ id: table.product.id })
		.from(table.product)
		.where(eq(table.product.id, productId))
		.execute();
	return rows.length > 0;
}

async function listIds(visibility?: 'active' | 'all', limit = 100): Promise<string[]> {
	const pagination = await getProducts({ limit, visibility });
	return pagination.products.map((entry) => entry.product.id);
}

async function totalPages(visibility?: 'active' | 'all'): Promise<number> {
	// One row per page: the total page count is exactly the filtered row count.
	return (await getProducts({ limit: 1, visibility })).totalPages;
}

async function deactivateAt(productId: string, when: Date): Promise<void> {
	await getDb()
		.update(table.product)
		.set({ deactivatedAt: when })
		.where(eq(table.product.id, productId))
		.execute();
}

async function seedOrderWithItem(productId: string): Promise<void> {
	const orderId = `itest-order-${crypto.randomUUID()}`;
	await getDb()
		.insert(table.order)
		.values({ id: orderId, content: {}, clientName: 'Integration test' })
		.execute();
	await getDb()
		.insert(table.orderItem)
		.values({
			orderId,
			productId,
			productNameSnapshot: 'Visibility test product',
			unitPriceSnapshot: '10.00',
			quantity: 1
		})
		.execute();
}

async function seedCartItem(productId: string): Promise<void> {
	const sessionId = crypto.randomUUID();
	await getDb().insert(table.cart).values({ sessionId }).execute();
	const [cart] = await getDb()
		.select({ id: table.cart.id })
		.from(table.cart)
		.where(eq(table.cart.sessionId, sessionId))
		.execute();
	await getDb()
		.insert(table.cartItem)
		.values({ cartId: cart.id, productId, quantity: 1, unitPriceSnapshot: '10.00' })
		.execute();
}

describe('getProducts visibility', () => {
	it('hides deactivated products from the default list and from the totals', async () => {
		const active = await seedProduct('Active product');
		const inactive = await seedProduct('Inactive product');
		await setProductActive(inactive, false);

		expect(await listIds('active')).toEqual([active]);
		expect(await totalPages('active')).toBe(1);

		const all = await listIds('all');
		expect(all).toContain(active);
		expect(all).toContain(inactive);
		expect(await totalPages('all')).toBe(2);
	});

	it('lists every product again once it is reactivated', async () => {
		const productId = await seedProduct();
		await setProductActive(productId, false);
		expect(await listIds()).not.toContain(productId);

		await setProductActive(productId, true);
		expect(await listIds()).toContain(productId);
	});
});

describe('setProductActive', () => {
	it('stamps the deactivation time and clears it on reactivation', async () => {
		const productId = await seedProduct();

		const off = await setProductActive(productId, false);
		expect(off.success).toBe(true);
		expect(await readDeactivatedAt(productId)).not.toBeNull();

		const on = await setProductActive(productId, true);
		expect(on.success).toBe(true);
		expect(await readDeactivatedAt(productId)).toBeNull();
	});

	it('reports an unknown product as not found', async () => {
		const result = await setProductActive('itest-missing-product', false);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(ProductErrorCode.NOT_FOUND);
		}
	});
});

describe('getProductWithVariants', () => {
	it('treats a deactivated product as missing, unless asked explicitly', async () => {
		const productId = await seedProduct();
		await setProductActive(productId, false);

		expect(await getProductWithVariants(productId)).toBeNull();

		const inactive = await getProductWithVariants(productId, { includeInactive: true });
		expect(inactive?.id).toBe(productId);
	});
});

describe('deleteProduct', () => {
	it('refuses to delete a product that appears in an order', async () => {
		const productId = await seedProduct();
		await seedOrderWithItem(productId);

		const result = await deleteProduct(productId);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(ProductErrorCode.REFERENTIAL_INTEGRITY);
		}
		expect(await productExists(productId)).toBe(true);
		expect(
			(await getDb().select().from(table.orderItem).where(eq(table.orderItem.productId, productId)))
				.length
		).toBe(1);
	});

	it('refuses to delete a product that sits in a cart', async () => {
		const productId = await seedProduct();
		await seedCartItem(productId);

		const result = await deleteProduct(productId);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(ProductErrorCode.REFERENTIAL_INTEGRITY);
		}
		expect(await productExists(productId)).toBe(true);
	});

	it('refuses to delete a product that is still active', async () => {
		const productId = await seedProduct();

		const result = await deleteProduct(productId);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(ProductErrorCode.NOT_INACTIVE);
		}
		expect(await productExists(productId)).toBe(true);
	});

	it('deletes a product nothing references', async () => {
		const productId = await seedProduct();
		await setProductActive(productId, false);

		const result = await deleteProduct(productId);

		expect(result.success).toBe(true);
		expect(await productExists(productId)).toBe(false);
	});
});

describe('purgeInactiveProducts', () => {
	it('removes old inactive products and keeps the recent and the referenced ones', async () => {
		const oldUnreferenced = await seedProduct('Old unreferenced');
		const oldReferenced = await seedProduct('Old referenced');
		const recent = await seedProduct('Recently deactivated');
		const active = await seedProduct('Never deactivated');

		await deactivateAt(oldUnreferenced, new Date(Date.now() - 40 * DAY));
		await deactivateAt(oldReferenced, new Date(Date.now() - 40 * DAY));
		await deactivateAt(recent, new Date(Date.now() - 2 * DAY));
		await seedOrderWithItem(oldReferenced);

		const { purged, skipped } = await purgeInactiveProducts();

		expect(purged).toEqual([oldUnreferenced]);
		expect(skipped).toEqual([oldReferenced]);
		expect(await productExists(oldUnreferenced)).toBe(false);
		expect(await productExists(oldReferenced)).toBe(true);
		expect(await productExists(recent)).toBe(true);
		expect(await productExists(active)).toBe(true);
	});

	it('does nothing when no inactive product is old enough', async () => {
		const recent = await seedProduct();
		await deactivateAt(recent, new Date(Date.now() - 2 * DAY));

		const { purged, skipped } = await purgeInactiveProducts();

		expect(purged).toEqual([]);
		expect(skipped).toEqual([]);
		expect(await productExists(recent)).toBe(true);
	});
});

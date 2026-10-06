import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { ProductErrorCode } from '$lib/actions';
import {
	deleteVariant,
	getProductWithVariants,
	getVariantsByProduct,
	purgeInactiveVariants,
	setVariantActive
} from './product';

const DAY = 86_400_000;

async function seedProduct(name = 'Variant visibility test product'): Promise<string> {
	const id = `itest-product-${crypto.randomUUID()}`;
	await getDb().insert(table.product).values({ id, name, price: 10, stock: 10 }).execute();
	return id;
}

async function seedVariant(
	productId: string,
	overrides: { size?: string; color?: string } = {}
): Promise<string> {
	const variantId = crypto.randomUUID();
	await getDb()
		.insert(table.productVariant)
		.values({
			id: variantId,
			productId,
			size: overrides.size ?? 'M',
			color: overrides.color ?? 'Negro',
			cut: 'oversize',
			stock: 5
		})
		.execute();
	return variantId;
}

async function readDeactivatedAt(variantId: string): Promise<Date | null> {
	const [row] = await getDb()
		.select({ deactivatedAt: table.productVariant.deactivatedAt })
		.from(table.productVariant)
		.where(eq(table.productVariant.id, variantId))
		.execute();
	return row?.deactivatedAt ?? null;
}

async function readSortOrder(variantId: string): Promise<number | null> {
	const [row] = await getDb()
		.select({ sortOrder: table.productVariant.sortOrder })
		.from(table.productVariant)
		.where(eq(table.productVariant.id, variantId))
		.execute();
	return row?.sortOrder ?? null;
}

async function variantExists(variantId: string): Promise<boolean> {
	const rows = await getDb()
		.select({ id: table.productVariant.id })
		.from(table.productVariant)
		.where(eq(table.productVariant.id, variantId))
		.execute();
	return rows.length > 0;
}

async function listVariantIds(productId: string, visibility?: 'active' | 'all'): Promise<string[]> {
	const variants = await getVariantsByProduct(productId, { visibility });
	return variants.map((variant) => variant.id);
}

async function deactivateAt(variantId: string, when: Date): Promise<void> {
	await getDb()
		.update(table.productVariant)
		.set({ deactivatedAt: when })
		.where(eq(table.productVariant.id, variantId))
		.execute();
}

async function seedOrderWithVariantItem(productId: string, variantId: string): Promise<void> {
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
			variantId,
			productNameSnapshot: 'Variant visibility test product',
			unitPriceSnapshot: '10.00',
			quantity: 1
		})
		.execute();
}

async function seedCartItemWithVariant(productId: string, variantId: string): Promise<void> {
	const sessionId = crypto.randomUUID();
	await getDb().insert(table.cart).values({ sessionId }).execute();
	const [cart] = await getDb()
		.select({ id: table.cart.id })
		.from(table.cart)
		.where(eq(table.cart.sessionId, sessionId))
		.execute();
	await getDb()
		.insert(table.cartItem)
		.values({
			cartId: cart.id,
			productId,
			variantId,
			quantity: 1,
			unitPriceSnapshot: '10.00'
		})
		.execute();
}

describe('getVariantsByProduct visibility', () => {
	it('hides deactivated variants from the default list but shows them with visibility all', async () => {
		const productId = await seedProduct();
		const active = await seedVariant(productId, { size: 'M' });
		const inactive = await seedVariant(productId, { size: 'L' });
		await setVariantActive(inactive, false);

		expect(await listVariantIds(productId, 'active')).toEqual([active]);
		expect(await listVariantIds(productId)).toEqual([active]);

		const all = await listVariantIds(productId, 'all');
		expect(all).toContain(active);
		expect(all).toContain(inactive);
	});

	it('lists a variant again once it is reactivated', async () => {
		const productId = await seedProduct();
		const variantId = await seedVariant(productId);
		await setVariantActive(variantId, false);
		expect(await listVariantIds(productId)).not.toContain(variantId);

		await setVariantActive(variantId, true);
		expect(await listVariantIds(productId)).toContain(variantId);
	});

	it('sinks deactivated variants to the bottom of the admin list', async () => {
		const productId = await seedProduct();
		const first = await seedVariant(productId, { size: 'S' });
		const second = await seedVariant(productId, { size: 'M' });
		await setVariantActive(first, false);

		// The admin list orders by sortOrder, createdAt: 999 puts the
		// deactivated variant last even though it was created first.
		expect(await listVariantIds(productId, 'all')).toEqual([second, first]);
	});
});

describe('setVariantActive', () => {
	it('stamps the deactivation time and clears it on reactivation', async () => {
		const productId = await seedProduct();
		const variantId = await seedVariant(productId);

		const off = await setVariantActive(variantId, false);
		expect(off.success).toBe(true);
		expect(await readDeactivatedAt(variantId)).not.toBeNull();

		const on = await setVariantActive(variantId, true);
		expect(on.success).toBe(true);
		expect(await readDeactivatedAt(variantId)).toBeNull();
	});

	it('reports an unknown variant as not found', async () => {
		const result = await setVariantActive(crypto.randomUUID(), false);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(ProductErrorCode.VARIANT_NOT_FOUND);
			expect(result.error.message).toBe('Variante no encontrada');
		}
	});

	it('demotes a deactivated variant to sortOrder 999 and keeps it on reactivation', async () => {
		const productId = await seedProduct();
		const variantId = await seedVariant(productId);

		await setVariantActive(variantId, false);
		expect(await readSortOrder(variantId)).toBe(999);

		// Reactivation keeps the demoted rank: no original order is stored, and
		// the admin edit form is where a variant gets re-ranked.
		await setVariantActive(variantId, true);
		expect(await readSortOrder(variantId)).toBe(999);
	});
});

describe('getProductWithVariants', () => {
	it('hides deactivated variants by default and returns them with includeInactive', async () => {
		const productId = await seedProduct();
		const active = await seedVariant(productId, { size: 'M' });
		const inactive = await seedVariant(productId, { size: 'L' });
		await setVariantActive(inactive, false);

		const visible = await getProductWithVariants(productId);
		expect(visible?.variants.map((variant) => variant.id)).toEqual([active]);

		const withInactive = await getProductWithVariants(productId, { includeInactive: true });
		const ids = withInactive?.variants.map((variant) => variant.id) ?? [];
		expect(ids).toContain(active);
		expect(ids).toContain(inactive);
	});
});

describe('deleteVariant', () => {
	it('refuses to delete a variant that appears in an order or a cart', async () => {
		const productId = await seedProduct();
		const inOrder = await seedVariant(productId, { size: 'M' });
		const inCart = await seedVariant(productId, { size: 'L' });
		await seedOrderWithVariantItem(productId, inOrder);
		await seedCartItemWithVariant(productId, inCart);

		for (const variantId of [inOrder, inCart]) {
			const result = await deleteVariant(variantId);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.code).toBe(ProductErrorCode.REFERENTIAL_INTEGRITY);
			}
			expect(await variantExists(variantId)).toBe(true);
		}
	});

	it('deletes an inactive variant nothing references', async () => {
		const productId = await seedProduct();
		const variantId = await seedVariant(productId);
		await setVariantActive(variantId, false);

		const result = await deleteVariant(variantId);

		expect(result.success).toBe(true);
		expect(await variantExists(variantId)).toBe(false);
	});
});

describe('purgeInactiveVariants', () => {
	it('removes old inactive variants and keeps the recent and the referenced ones', async () => {
		const productId = await seedProduct();
		const oldUnreferenced = await seedVariant(productId, { size: 'M', color: 'Negro' });
		const oldInOrder = await seedVariant(productId, { size: 'L', color: 'Negro' });
		const oldInCart = await seedVariant(productId, { size: 'XL', color: 'Negro' });
		const recent = await seedVariant(productId, { size: 'M', color: 'Blanco' });
		const active = await seedVariant(productId, { size: 'L', color: 'Blanco' });

		await deactivateAt(oldUnreferenced, new Date(Date.now() - 40 * DAY));
		await deactivateAt(oldInOrder, new Date(Date.now() - 40 * DAY));
		await deactivateAt(oldInCart, new Date(Date.now() - 40 * DAY));
		await deactivateAt(recent, new Date(Date.now() - 2 * DAY));
		await seedOrderWithVariantItem(productId, oldInOrder);
		await seedCartItemWithVariant(productId, oldInCart);

		const { purged, skipped } = await purgeInactiveVariants();

		expect(purged).toEqual([oldUnreferenced]);
		expect([...skipped].sort()).toEqual([oldInCart, oldInOrder].sort());
		expect(await variantExists(oldUnreferenced)).toBe(false);
		expect(await variantExists(oldInOrder)).toBe(true);
		expect(await variantExists(oldInCart)).toBe(true);
		expect(await variantExists(recent)).toBe(true);
		expect(await variantExists(active)).toBe(true);
	});

	it('does nothing when no inactive variant is old enough', async () => {
		const productId = await seedProduct();
		const recent = await seedVariant(productId);
		await deactivateAt(recent, new Date(Date.now() - 2 * DAY));

		const { purged, skipped } = await purgeInactiveVariants();

		expect(purged).toEqual([]);
		expect(skipped).toEqual([]);
		expect(await variantExists(recent)).toBe(true);
	});
});

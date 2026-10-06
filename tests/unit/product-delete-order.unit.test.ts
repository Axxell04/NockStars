import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted because `vi.mock` factories run before this module's body: the mock
// has to close over state the test body fills in afterwards.
const db = vi.hoisted(() => ({
	deleteMock: vi.fn(),
	whereMock: vi.fn(),
	executeMock: vi.fn(),
	// Rows returned per table, so a test can say "this product exists" or
	// "an order still references it" without building a real query chain.
	rowsByTable: new Map<unknown, unknown[]>()
}));

vi.mock('$lib/server/db', () => ({
	getDb: () => {
		const rowsFor = (table: unknown) => db.rowsByTable.get(table) ?? [];
		return {
			select: () => ({
				from: (table: unknown) => ({
					where: () => ({
						execute: async () => rowsFor(table),
						limit: () => ({ execute: async () => rowsFor(table) }),
						orderBy: () => ({ execute: async () => rowsFor(table) })
					})
				})
			}),
			delete: db.deleteMock
		};
	}
}));

vi.mock('$env/static/private', () => ({
	CLOUDINARY_CLOUD_NAME: 'demo',
	CLOUDINARY_API_KEY: 'demo-key',
	CLOUDINARY_API_SECRET: 'demo-secret'
}));

vi.mock('cloudinary', () => ({
	v2: {
		config: vi.fn(),
		uploader: {
			destroy: vi.fn()
		}
	}
}));

import * as schema from '$lib/server/db/schema';
import { ProductErrorCode } from '$lib/actions';
import { deleteProduct } from '$lib/server/product';

describe('deleteProduct', () => {
	beforeEach(() => {
		db.deleteMock.mockReset();
		db.whereMock.mockReset();
		db.executeMock.mockReset();
		db.rowsByTable.clear();

		db.deleteMock.mockImplementation(() => {
			const result: { where: (condition: unknown) => { execute: typeof db.executeMock } } = {
				where: (condition: unknown) => {
					db.whereMock(condition);
					return { execute: db.executeMock };
				}
			};
			return result;
		});
	});

	it('removes product catalog links before deleting the product row', async () => {
		db.rowsByTable.set(schema.product, [{ id: 'product-123', deactivatedAt: new Date() }]);

		await deleteProduct('product-123');

		expect(db.deleteMock.mock.calls[0]?.[0]).toBe(schema.productCatalog);
		expect(db.deleteMock.mock.calls[1]?.[0]).toBe(schema.product);
		expect(db.whereMock).toHaveBeenCalledTimes(2);
	});

	it('refuses to delete a product that is still active', async () => {
		db.rowsByTable.set(schema.product, [{ id: 'product-123' }]);

		const result = await deleteProduct('product-123');

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.code).toBe(ProductErrorCode.NOT_INACTIVE);
		}
		expect(db.deleteMock).not.toHaveBeenCalled();
	});

	it('deletes nothing while an order line still points at the product', async () => {
		db.rowsByTable.set(schema.product, [{ id: 'product-123', deactivatedAt: new Date() }]);
		db.rowsByTable.set(schema.orderItem, [{ id: 'order-item-1' }]);

		const result = await deleteProduct('product-123');

		expect(result.success).toBe(false);
		expect(db.deleteMock).not.toHaveBeenCalled();
	});

	it('deletes nothing while a cart line still points at the product', async () => {
		db.rowsByTable.set(schema.product, [{ id: 'product-123', deactivatedAt: new Date() }]);
		db.rowsByTable.set(schema.cartItem, [{ id: 'cart-item-1' }]);

		const result = await deleteProduct('product-123');

		expect(result.success).toBe(false);
		expect(db.deleteMock).not.toHaveBeenCalled();
	});

	it('reports a missing product without touching any table', async () => {
		const result = await deleteProduct('product-123');

		expect(result.success).toBe(false);
		expect(db.deleteMock).not.toHaveBeenCalled();
	});
});

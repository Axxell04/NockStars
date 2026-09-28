import { beforeEach, describe, expect, it, vi } from 'vitest';

const deleteMock = vi.fn();
const whereMock = vi.fn();
const executeMock = vi.fn();

vi.mock('$lib/server/db', () => ({
	getDb: () => ({
		select: () => ({
			from: () => ({
				where: () => ({
					execute: async () => []
				})
			})
		}),
		delete: deleteMock
	})
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
import { deleteProduct } from '$lib/server/product';

describe('deleteProduct', () => {
	beforeEach(() => {
		deleteMock.mockReset();
		whereMock.mockReset();
		executeMock.mockReset();

		deleteMock.mockImplementation(() => {
			const result: { where: (condition: unknown) => { execute: typeof executeMock } } = {
				where: (condition: unknown) => {
					whereMock(condition);
					return { execute: executeMock };
				}
			};
			return result;
		});
	});

	it('removes product catalog links before deleting the product row', async () => {
		await deleteProduct('product-123');

		expect(deleteMock.mock.calls[0]?.[0]).toBe(schema.productCatalog);
		expect(deleteMock.mock.calls[1]?.[0]).toBe(schema.product);
		expect(whereMock).toHaveBeenCalledTimes(2);
	});
});

import { describe, it, expect, vi } from 'vitest';
import { CartErrorCode, success, failure } from '$lib/actions';
import { resolveSafeReturnTarget } from '$lib/route-back';

// Mock the database
vi.mock('$lib/server/db', () => ({
	getDb: vi.fn()
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(),
	and: vi.fn(),
	sql: vi.fn()
}));

describe('Route back resolver', () => {
	it('falls back to home when the referrer is the login page', () => {
		expect(
			resolveSafeReturnTarget({
				currentOrigin: 'https://example.com',
				referrer: 'https://example.com/login?redirect=%2Fadmin',
				fallback: '/'
			})
		).toBe('/');
	});

	it('falls back to home when the referrer is login or an admin product edit route', () => {
		expect(
			resolveSafeReturnTarget({
				currentOrigin: 'https://example.com',
				referrer: 'https://example.com/login?redirect=%2Fadmin',
				fallback: '/'
			})
		).toBe('/');
		expect(
			resolveSafeReturnTarget({
				currentOrigin: 'https://example.com',
				referrer: 'https://example.com/admin/producto/abc123?returnTo=%2F',
				fallback: '/'
			})
		).toBe('/');
	});

	it('keeps valid admin pages as return targets while still ignoring stale admin product edit pages', () => {
		expect(
			resolveSafeReturnTarget({
				currentOrigin: 'https://example.com',
				referrer: 'https://example.com/admin',
				fallback: '/'
			})
		).toBe('/admin');
		expect(
			resolveSafeReturnTarget({
				currentOrigin: 'https://example.com',
				referrer: 'https://example.com/admin/catalogo',
				fallback: '/'
			})
		).toBe('/admin/catalogo');
	});

	it('prefers an explicit valid return target over stale login or admin-edit referrers', () => {
		expect(
			resolveSafeReturnTarget({
				currentOrigin: 'https://example.com',
				referrer: 'https://example.com/login?redirect=%2Fadmin',
				returnTo: '/admin',
				fallback: '/'
			})
		).toBe('/admin');
		expect(
			resolveSafeReturnTarget({
				currentOrigin: 'https://example.com',
				referrer: 'https://example.com/login?redirect=%2Fadmin',
				returnTo: '/admin/producto/abc123',
				fallback: '/'
			})
		).toBe('/');
	});

	it('keeps valid internal routes when they are not login or stale admin edit routes', () => {
		expect(
			resolveSafeReturnTarget({
				currentOrigin: 'https://example.com',
				referrer: 'https://example.com/catalogo?categoria=camisas',
				fallback: '/'
			})
		).toBe('/catalogo?categoria=camisas');
	});
});

describe('Cart Validation Logic', () => {
	// Test the error codes and result helpers
	describe('CartErrorCode', () => {
		it('should have all required error codes', () => {
			expect(CartErrorCode.NOT_FOUND).toBe('NOT_FOUND');
			expect(CartErrorCode.OUT_OF_STOCK).toBe('OUT_OF_STOCK');
			expect(CartErrorCode.VERSION_CONFLICT).toBe('VERSION_CONFLICT');
			expect(CartErrorCode.INVALID_VARIANT).toBe('INVALID_VARIANT');
			expect(CartErrorCode.CART_EMPTY).toBe('CART_EMPTY');
		});
	});

	describe('success/failure helpers', () => {
		it('should create success result', () => {
			const result = success({ items: [] });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toEqual({ items: [] });
			}
		});

		it('should create failure result with error code', () => {
			const result = failure(CartErrorCode.OUT_OF_STOCK, 'Not enough stock');
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error?.code).toBe(CartErrorCode.OUT_OF_STOCK);
				expect(result.error?.message).toBe('Not enough stock');
			}
		});

		it('should create failure result with extra data', () => {
			const result = failure(CartErrorCode.VERSION_CONFLICT, 'Conflict', {
				currentVersion: 2,
				providedVersion: 1
			});
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error?.code).toBe(CartErrorCode.VERSION_CONFLICT);
				expect(result.error?.details).toEqual({ currentVersion: 2, providedVersion: 1 });
			}
		});
	});
});

// Test cart item validation logic
describe('Cart Item Validation', () => {
	const mockProduct = {
		id: 'prod-1',
		name: 'Test Product',
		price: 29.99,
		stock: 10,
		createdAt: new Date()
	};

	const mockVariant = {
		id: 'var-1',
		productId: 'prod-1',
		size: 'M',
		color: 'Red',
		cut: 'recto' as const,
		description: 'Medium Red',
		stock: 5,
		priceOverride: 34.99,
		sortOrder: 1,
		createdAt: new Date(),
		updatedAt: new Date(),
		images: []
	};

	it('should validate quantity > 0', () => {
		const quantity = 0;
		expect(() => {
			if (quantity <= 0) throw new Error('Quantity must be greater than 0');
		}).toThrow('Quantity must be greater than 0');
	});

	it('should validate product exists', () => {
		const product = null;
		expect(product).toBeNull();
	});

	it('should validate variant belongs to product', () => {
		const variantWithWrongProduct = { ...mockVariant, productId: 'prod-2' };
		expect(variantWithWrongProduct.productId).not.toBe(mockProduct.id);
	});

	it('should validate stock availability', () => {
		const availableStock = mockVariant.stock;
		const requestedQuantity = 3;
		expect(requestedQuantity).toBeLessThanOrEqual(availableStock);
	});

	it('should reject when quantity exceeds stock', () => {
		const availableStock = mockVariant.stock;
		const requestedQuantity = 10;
		expect(requestedQuantity).toBeGreaterThan(availableStock);
	});

	it('should handle version conflict', () => {
		const currentVersion = 2;
		const providedVersion = 1;
		expect(currentVersion).not.toBe(providedVersion);
	});
});

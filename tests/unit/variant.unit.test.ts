import { describe, it, expect } from 'vitest';
import {
	resolveVariant,
	resolveImplicitVariant,
	effectivePrice,
	effectiveStock,
	isVariantAvailable,
	getVariantDisplayName,
	hasExplicitVariants,
	getDefaultVariant
} from '$lib/variant';
import type { Product, ProductWithVariants, VariantComplete } from '$lib/actions';
import type { Img } from '$lib/server/db/schema';

describe('Variant Utilities', () => {
	const mockProduct: Product = {
		id: 'prod-1',
		name: 'Test Product',
		description: null,
		price: 29.99,
		stock: 10,
		specs: {},
		createdAt: new Date()
	};

	const mockProductImages: Img[] = [];

	const mockVariants: VariantComplete[] = [
		{
			id: 'var-1',
			productId: 'prod-1',
			size: 'M',
			color: 'Red',
			colorHex: '#dc2626',
			cut: 'recto',
			description: 'Medium Red Recto',
			stock: 5,
			priceOverride: '34.99',
			sortOrder: 1,
			createdAt: new Date(),
			updatedAt: new Date(),
			images: []
		},
		{
			id: 'var-2',
			productId: 'prod-1',
			size: 'L',
			color: 'Blue',
			colorHex: '#2563eb',
			cut: 'oversize',
			description: 'Large Blue Oversize',
			stock: 3,
			priceOverride: null,
			sortOrder: 2,
			createdAt: new Date(),
			updatedAt: new Date(),
			images: []
		},
		{
			id: 'var-3',
			productId: 'prod-1',
			size: 'M',
			color: 'Blue',
			colorHex: '#2563eb',
			cut: 'recto',
			description: 'Medium Blue Recto',
			stock: 0, // Out of stock
			priceOverride: '39.99',
			sortOrder: 3,
			createdAt: new Date(),
			updatedAt: new Date(),
			images: []
		}
	];

	const mockProductWithVariants: ProductWithVariants = {
		...mockProduct,
		productImages: mockProductImages,
		variants: mockVariants,
		implicitVariant: {
			id: 'implicit',
			productId: 'prod-1',
			size: 'Único',
			color: 'Único',
			colorHex: null,
			cut: 'recto',
			description: null,
			stock: 10,
			priceOverride: null,
			sortOrder: -1,
			createdAt: new Date(),
			updatedAt: new Date(),
			images: []
		}
	};

	describe('resolveVariant', () => {
		it('should find matching variant by size, color, and cut', () => {
			const variant = resolveVariant(mockVariants, 'M', 'Red', 'recto');
			expect(variant).not.toBeNull();
			expect(variant?.id).toBe('var-1');
		});

		it('should return null for non-existent combination', () => {
			const variant = resolveVariant(mockVariants, 'S', 'Red', 'recto');
			expect(variant).toBeNull();
		});

		it('should return null for empty variants array', () => {
			const variant = resolveVariant([], 'M', 'Red', 'recto');
			expect(variant).toBeNull();
		});
	});

	describe('resolveImplicitVariant', () => {
		it('should create implicit variant from product', () => {
			const implicit = resolveImplicitVariant(mockProduct);
			expect(implicit.id).toBe('implicit');
			expect(implicit.productId).toBe('prod-1');
			expect(implicit.size).toBe('Único');
			expect(implicit.color).toBe('Único');
			expect(implicit.cut).toBe('recto');
			expect(implicit.stock).toBe(10);
			expect(implicit.priceOverride).toBeNull();
			expect(implicit.sortOrder).toBe(-1);
		});
	});

	describe('effectivePrice', () => {
		it('should return variant priceOverride when set', () => {
			const variant = mockVariants[0]; // priceOverride: 34.99
			const price = effectivePrice(variant, mockProduct);
			expect(price).toBe(34.99);
		});

		it('should return product price when variant has no override', () => {
			const variant = mockVariants[1]; // priceOverride: null
			const price = effectivePrice(variant, mockProduct);
			expect(price).toBe(29.99);
		});

		it('should return product price for null variant', () => {
			const price = effectivePrice(null, mockProduct);
			expect(price).toBe(29.99);
		});

		it('should return product price for implicit variant', () => {
			const implicit = resolveImplicitVariant(mockProduct);
			const price = effectivePrice(implicit, mockProduct);
			expect(price).toBe(29.99);
		});
	});

	describe('effectiveStock', () => {
		it('should return variant stock for explicit variant', () => {
			const variant = mockVariants[0]; // stock: 5
			const stock = effectiveStock(variant, mockProduct);
			expect(stock).toBe(5);
		});

		it('should return product stock for implicit variant', () => {
			const implicit = resolveImplicitVariant(mockProduct);
			const stock = effectiveStock(implicit, mockProduct);
			expect(stock).toBe(10);
		});

		it('should return product stock for null variant', () => {
			const stock = effectiveStock(null, mockProduct);
			expect(stock).toBe(10);
		});
	});

	describe('isVariantAvailable', () => {
		it('should return true for variant with stock > 0', () => {
			const variant = mockVariants[0]; // stock: 5
			expect(isVariantAvailable(variant, mockProduct)).toBe(true);
		});

		it('should return false for variant with stock = 0', () => {
			const variant = mockVariants[2]; // stock: 0
			expect(isVariantAvailable(variant, mockProduct)).toBe(false);
		});

		it('should return true for implicit variant with product stock > 0', () => {
			const implicit = resolveImplicitVariant(mockProduct);
			expect(isVariantAvailable(implicit, mockProduct)).toBe(true);
		});

		it('should return false for implicit variant with product stock = 0', () => {
			const productNoStock = { ...mockProduct, stock: 0 };
			const implicit = resolveImplicitVariant(productNoStock);
			expect(isVariantAvailable(implicit, productNoStock)).toBe(false);
		});
	});

	describe('getVariantDisplayName', () => {
		it('should return "Único" for implicit variant', () => {
			const implicit = resolveImplicitVariant(mockProduct);
			expect(getVariantDisplayName(implicit)).toBe('Único');
		});

		it('should return formatted name for explicit variant', () => {
			const variant = mockVariants[0]; // M / Red / recto
			expect(getVariantDisplayName(variant)).toBe('M / Red / recto');
		});

		it('should include cut in display name', () => {
			const variant = mockVariants[1]; // L / Blue / oversize
			expect(getVariantDisplayName(variant)).toBe('L / Blue / oversize');
		});
	});

	describe('hasExplicitVariants', () => {
		it('should return true when product has variants', () => {
			expect(hasExplicitVariants(mockProductWithVariants)).toBe(true);
		});

		it('should return false when product has no variants', () => {
			const productNoVariants: ProductWithVariants = {
				...mockProduct,
				productImages: mockProductImages,
				variants: [],
				implicitVariant: resolveImplicitVariant(mockProduct)
			};
			expect(hasExplicitVariants(productNoVariants)).toBe(false);
		});
	});

	describe('getDefaultVariant', () => {
		it('should return implicit variant when no explicit variants', () => {
			const productNoVariants: ProductWithVariants = {
				...mockProduct,
				productImages: mockProductImages,
				variants: [],
				implicitVariant: resolveImplicitVariant(mockProduct)
			};
			const defaultVariant = getDefaultVariant(productNoVariants);
			expect(defaultVariant?.id).toBe('implicit');
		});

		it('should return first variant by sortOrder', () => {
			const defaultVariant = getDefaultVariant(mockProductWithVariants);
			expect(defaultVariant?.id).toBe('var-1'); // sortOrder: 1
		});

		it('should return null for empty variants and no implicit', () => {
			const productNoVariants: ProductWithVariants = {
				...mockProduct,
				productImages: mockProductImages,
				variants: [],
				implicitVariant: null as unknown as VariantComplete
			};
			const defaultVariant = getDefaultVariant(productNoVariants);
			expect(defaultVariant).toBeNull();
		});
	});
});

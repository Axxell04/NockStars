import type { Product } from '$lib/server/db/schema';
import type { VariantComplete, ProductWithVariants } from '$lib/actions';

/**
 * Shared variant utilities - pure functions, no DB, no Svelte
 * Used by both client and server
 */

/**
 * Finds a matching variant by size, color, and cut
 * Returns null if no match found
 */
export function resolveVariant(
	variants: VariantComplete[],
	size: string,
	color: string,
	cut: 'oversize' | 'recto'
): VariantComplete | null {
	return variants.find((v) => v.size === size && v.color === color && v.cut === cut) ?? null;
}

/**
 * Computes the implicit variant for a product (size="Único", color="Único", cut="recto")
 * This represents the base product when no explicit variants exist or are selected
 */
export function resolveImplicitVariant(product: Product): VariantComplete {
	return {
		id: 'implicit' as string, // Special marker - not a real DB ID
		productId: product.id,
		size: 'Único',
		color: 'Único',
		cut: 'recto',
		description: null,
		stock: product.stock,
		priceOverride: null,
		sortOrder: -1,
		createdAt: product.createdAt ?? new Date(),
		updatedAt: product.createdAt ?? new Date(),
		images: []
	};
}

/**
 * Returns the effective price for a product/variant combination
 * Variant priceOverride takes precedence over product price
 */
export function effectivePrice(variant: VariantComplete | null, product: Product): number {
	if (variant && variant.priceOverride !== null && variant.priceOverride !== undefined) {
		return Number(variant.priceOverride);
	}
	return product.price;
}

/**
 * Returns the effective stock for a product/variant combination
 * Variant stock takes precedence over product stock
 */
export function effectiveStock(variant: VariantComplete | null, product: Product): number {
	if (variant && variant.id !== 'implicit') {
		return variant.stock;
	}
	return product.stock;
}

/**
 * Checks if a product/variant combination is available (stock > 0)
 */
export function isVariantAvailable(variant: VariantComplete | null, product: Product): boolean {
	return effectiveStock(variant, product) > 0;
}

/**
 * Gets the display name for a variant (size - color - cut)
 */
export function getVariantDisplayName(variant: VariantComplete): string {
	if (variant.id === 'implicit') {
		return 'Único';
	}
	const parts = [variant.size, variant.color];
	if (variant.cut) {
		parts.push(variant.cut);
	}
	return parts.join(' / ');
}

/**
 * Checks if a product has explicit variants (non-implicit)
 */
export function hasExplicitVariants(product: ProductWithVariants): boolean {
	return product.variants.length > 0;
}

/**
 * Finds the default variant for a product (first by sortOrder)
 */
export function getDefaultVariant(product: ProductWithVariants): VariantComplete | null {
	if (product.variants.length === 0) {
		return product.implicitVariant;
	}
	return product.variants.reduce((prev, curr) => (curr.sortOrder < prev.sortOrder ? curr : prev));
}

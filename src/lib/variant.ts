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
		colorHex: null,
		cut: 'recto',
		description: null,
		stock: product.stock,
		priceOverride: null,
		sortOrder: -1,
		createdAt: product.createdAt ?? new Date(),
		updatedAt: product.createdAt ?? new Date(),
		// The implicit variant mirrors the product row, which `load` already
		// filtered to active products — it is never itself deactivated.
		deactivatedAt: null,
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
 * Total sellable stock for a product.
 *
 * A product without variants sells its base stock. A product with variants
 * sells the sum of its variant stock, and the base number stops being
 * authoritative — it is kept only as reference.
 *
 * Computed on read: a stored mirror would have to be re-synced by every
 * variant-stock write (create, update, delete, checkout decrement) and any
 * path that forgets leaves a stale number.
 */
export function totalStock(baseStock: number, variants: readonly { stock: number }[]): number {
	if (variants.length === 0) return baseStock;
	return variants.reduce((sum, variant) => sum + variant.stock, 0);
}

/**
 * User-facing copy for stock-limit rejections, shared by every cart entry
 * point so the wording stays identical. `available` is the stock left for the
 * exact variant (or implicit variant) that was rejected; when the server does
 * not report a count, the message stays deliberately vague.
 */
export function stockLimitMessage(available?: number): string {
	if (available === undefined || available <= 0) {
		return 'No hay más unidades disponibles';
	}
	if (available === 1) {
		return 'Solo queda 1 unidad disponible';
	}
	return `Solo quedan ${available} unidades disponibles`;
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

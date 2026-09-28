import type {
	Cart,
	CartItem,
	Product,
	ProductVariant,
	VariantImg,
	Img
} from '$lib/server/db/schema';

/**
 * Shared action types for form actions (used by SSR routes)
 * Pure TypeScript - no Svelte dependencies
 */

// Re-export schema types for convenience
export type { Cart, CartItem, Product, ProductVariant, VariantImg } from '$lib/server/db/schema';

// ============================================================================
// Error Codes
// ============================================================================

export const CartErrorCode = {
	OUT_OF_STOCK: 'OUT_OF_STOCK',
	INVALID_VARIANT: 'INVALID_VARIANT',
	VERSION_CONFLICT: 'VERSION_CONFLICT',
	NOT_FOUND: 'NOT_FOUND',
	CART_EMPTY: 'CART_EMPTY',
	CHECKOUT_FAILED: 'CHECKOUT_FAILED'
} as const;

export type CartErrorCode = (typeof CartErrorCode)[keyof typeof CartErrorCode];

export const ProductErrorCode = {
	NOT_FOUND: 'NOT_FOUND',
	VARIANT_NOT_FOUND: 'VARIANT_NOT_FOUND',
	INVALID_VARIANT_DATA: 'INVALID_VARIANT_DATA',
	INVALID_PRODUCT_DATA: 'INVALID_PRODUCT_DATA',
	REFERENTIAL_INTEGRITY: 'REFERENTIAL_INTEGRITY'
} as const;

export type ProductErrorCode = (typeof ProductErrorCode)[keyof typeof ProductErrorCode];

// ============================================================================
// Cart Types
// ============================================================================

export interface CartWithItems extends Cart {
	items: CartItemWithProduct[];
}

export interface CartItemWithProduct extends CartItem {
	product: Product;
	variant: (ProductVariant & { images: VariantImg[] }) | null;
}

export interface AddToCartInput {
	productId: string;
	variantId?: string;
	quantity: number;
}

export interface UpdateQuantityInput {
	cartItemId: string;
	quantity: number;
	version: number;
}

export interface LegacyCartItem {
	productId: string;
	variantId?: string;
	quantity: number;
	size?: string;
	color?: string;
	cut?: 'oversize' | 'recto';
}

export interface OrderItemInput {
	productId: string;
	variantId?: string;
	productNameSnapshot: string;
	variantSizeSnapshot?: string;
	variantColorSnapshot?: string;
	variantCutSnapshot?: string;
	unitPriceSnapshot: number;
	quantity: number;
}

// ============================================================================
// Result Types
// ============================================================================

export interface ActionSuccess<T> {
	success: true;
	data: T;
}

export interface ActionError {
	success: false;
	error: {
		code: CartErrorCode | ProductErrorCode;
		message: string;
		details?: Record<string, unknown>;
	};
}

export type CartActionResult<T> = ActionSuccess<T> | ActionError;
export type ProductActionResult<T> = ActionSuccess<T> | ActionError;

// ============================================================================
// Helper Functions
// ============================================================================

export function success<T>(data: T): ActionSuccess<T> {
	return { success: true, data };
}

export function failure(
	code: CartErrorCode | ProductErrorCode,
	message: string,
	details?: Record<string, unknown>
): ActionError {
	return {
		success: false,
		error: { code, message, details }
	};
}

export function isSuccess<T>(result: ActionSuccess<T> | ActionError): result is ActionSuccess<T> {
	return result.success;
}

export function isError(result: ActionSuccess<unknown> | ActionError): result is ActionError {
	return !result.success;
}

// ============================================================================
// Product/Variant Types
// ============================================================================

export interface VariantComplete extends ProductVariant {
	images: VariantImg[];
}

export interface ProductWithVariants extends Product {
	productImages: Img[];
	variants: VariantComplete[];
	implicitVariant: VariantComplete;
}

export interface CreateVariantInput {
	productId: string;
	size: string;
	color: string;
	cut: 'oversize' | 'recto';
	description?: string;
	stock: number;
	priceOverride?: number;
	sortOrder?: number;
}

export interface UpdateVariantInput {
	size?: string;
	color?: string;
	cut?: 'oversize' | 'recto';
	description?: string;
	stock?: number;
	priceOverride?: number | null;
	sortOrder?: number;
}

export interface VariantImage {
	id: string;
	variantId: string;
	url: string;
	alt: string;
	sortOrder: number;
	createdAt: Date;
}

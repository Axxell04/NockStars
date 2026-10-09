/**
 * Pure helpers for the flat-fee shipping pricing model.
 *
 * The storefront shows base price + a fixed shipping fee on every public
 * price; the fee is charged once per order at checkout. Nothing here touches
 * the database or the request: the root layout load reads the configured fee
 * once per request and passes it down as `ShippingSelection`.
 */

export interface ShippingSelection {
	/** Fixed fee, charged once per order. */
	fee: number;
}

/** Public price for a base amount: the fee added on top. */
export function withShipping(base: number, selection: ShippingSelection): number {
	return base + selection.fee;
}

/**
 * Whether a listing card renders the multi-buy promo: the cart is non-empty,
 * a fee exists to discount, and this product is not the one carrying it (the
 * first cart line — it keeps showing price + fee). Display only: the charged
 * total never depends on this.
 */
export function isPromoDiscounted(input: {
	cartEmpty: boolean;
	/** `productId` of the first cart line; null when the cart is empty. */
	carrierProductId: string | null;
	productId: string;
	fee: number;
}): boolean {
	return !input.cartEmpty && input.fee > 0 && input.carrierProductId !== input.productId;
}

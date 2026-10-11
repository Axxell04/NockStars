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

export interface LineDisplay {
	/** Unit price shown for this line. */
	unitPrice: number;
	/** What this line contributes to the order: base × qty plus the fee on the carrier. */
	total: number;
}

/**
 * Cart line display math. The flat fee is charged once per order, so the
 * first line absorbs it into its unit price — to the customer that product
 * simply has a higher regular price, and the fee is never named. Every
 * displayed number equals what checkout charges.
 */
export function lineDisplay(
	base: number,
	quantity: number,
	isCarrier: boolean,
	fee: number
): LineDisplay {
	const carrier = isCarrier && fee > 0;
	return {
		unitPrice: carrier ? base + fee : base,
		// A line with no units contributes nothing — not even the carrier fee.
		total: quantity > 0 ? base * quantity + (carrier ? fee : 0) : 0
	};
}

export type ListingPromo = 'none' | 'discounted' | 'carrier-extra';

/**
 * What the listing card shows: `discounted` when the cart already covers the
 * fee (every extra unit costs base), `carrier-extra` for the carrier product
 * (its first unit pays the regular higher price; extra units cost base).
 */
export function listingPromo(input: {
	cartEmpty: boolean;
	fee: number;
	isCarrier: boolean;
}): ListingPromo {
	if (input.cartEmpty || input.fee <= 0) {
		return 'none';
	}
	return input.isCarrier ? 'carrier-extra' : 'discounted';
}

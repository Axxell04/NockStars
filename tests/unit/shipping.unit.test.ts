import { describe, it, expect } from 'vitest';
import { withShipping, isPromoDiscounted, type ShippingSelection } from '$lib/shipping';

const selection: ShippingSelection = { fee: 6 };

describe('withShipping', () => {
	it('adds the fee to the base price', () => {
		expect(withShipping(20.99, selection)).toBeCloseTo(26.99, 10);
	});

	it('returns the base price when the fee is 0', () => {
		expect(withShipping(20.99, { fee: 0 })).toBe(20.99);
	});
});

describe('isPromoDiscounted', () => {
	const fee = 6;

	it('is off while the cart is empty', () => {
		expect(
			isPromoDiscounted({ cartEmpty: true, carrierProductId: null, productId: 'p1', fee })
		).toBe(false);
	});

	it('is off when there is no fee to discount', () => {
		expect(
			isPromoDiscounted({ cartEmpty: false, carrierProductId: 'p2', productId: 'p1', fee: 0 })
		).toBe(false);
	});

	it('is off for the carrier — the first cart line keeps price + fee', () => {
		expect(
			isPromoDiscounted({ cartEmpty: false, carrierProductId: 'p1', productId: 'p1', fee })
		).toBe(false);
	});

	it('is on for every other product once the cart has lines', () => {
		expect(
			isPromoDiscounted({ cartEmpty: false, carrierProductId: 'p1', productId: 'p2', fee })
		).toBe(true);
	});

	it('treats an unknown fee as no promo', () => {
		expect(
			isPromoDiscounted({
				cartEmpty: false,
				carrierProductId: 'p1',
				productId: 'p2',
				fee: Number.NaN
			})
		).toBe(false);
	});
});

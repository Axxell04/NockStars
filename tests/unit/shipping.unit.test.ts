import { describe, it, expect } from 'vitest';
import { withShipping, lineDisplay, listingPromo, type ShippingSelection } from '$lib/shipping';

const selection: ShippingSelection = { fee: 6 };

describe('withShipping', () => {
	it('adds the fee to the base price', () => {
		expect(withShipping(20.99, selection)).toBeCloseTo(26.99, 10);
	});

	it('returns the base price when the fee is 0', () => {
		expect(withShipping(20.99, { fee: 0 })).toBe(20.99);
	});
});

describe('lineDisplay', () => {
	const base = 20.99;
	const fee = 6;

	it('bakes the fee into the unit and the total of a qty-1 carrier line', () => {
		const display = lineDisplay(base, 1, true, fee);
		expect(display.unitPrice).toBeCloseTo(26.99, 10);
		expect(display.total).toBeCloseTo(base + fee, 10);
	});

	it('charges the fee once on a qty-2 carrier line', () => {
		const display = lineDisplay(base, 2, true, fee);
		expect(display.unitPrice).toBeCloseTo(base + fee, 10);
		expect(display.total).toBeCloseTo(base * 2 + fee, 10);
	});

	it('keeps unit and total at base × qty for a non-carrier line, ignoring the fee', () => {
		const display = lineDisplay(base, 3, false, fee);
		expect(display.unitPrice).toBe(base);
		expect(display.total).toBeCloseTo(base * 3, 10);
	});

	it('ignores the carrier flag when the fee is 0', () => {
		const display = lineDisplay(base, 3, true, 0);
		expect(display.unitPrice).toBe(base);
		expect(display.total).toBeCloseTo(base * 3, 10);
	});

	it('totals 0 for a quantity of 0', () => {
		expect(lineDisplay(base, 0, true, fee).total).toBe(0);
		expect(lineDisplay(base, 0, false, fee).total).toBe(0);
	});
});

describe('listingPromo', () => {
	const fee = 6;

	it('is none while the cart is empty', () => {
		expect(listingPromo({ cartEmpty: true, fee, isCarrier: false })).toBe('none');
		expect(listingPromo({ cartEmpty: true, fee, isCarrier: true })).toBe('none');
	});

	it('is none when there is no fee to show', () => {
		expect(listingPromo({ cartEmpty: false, fee: 0, isCarrier: false })).toBe('none');
		expect(listingPromo({ cartEmpty: false, fee: 0, isCarrier: true })).toBe('none');
	});

	it('is discounted for every non-carrier once the cart has lines', () => {
		expect(listingPromo({ cartEmpty: false, fee, isCarrier: false })).toBe('discounted');
	});

	it('is carrier-extra for the carrier once the cart has lines', () => {
		expect(listingPromo({ cartEmpty: false, fee, isCarrier: true })).toBe('carrier-extra');
	});
});
